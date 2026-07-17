import React, { useCallback, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { setSwUpdatePending, setSwRegisteredUrl } from '../utils/swStatus';
import './ReloadPrompt.css';

/**
 * Bandeau discret proposant de recharger quand une nouvelle version de
 * l'application a été mise en cache par le service worker (registerType:
 * 'prompt' dans vite.config.js).
 *
 * - Ne recharge JAMAIS de lui-même : l'utilisateur clique « Recharger » quand
 *   il est prêt — pas d'interruption d'édition ni de fermeture des fenêtres
 *   détachées.
 * - En développement (SW inactif) et hors mise à jour, le hook laisse
 *   needRefresh à false → le composant ne rend rien.
 *
 * Pourquoi on recharge nous-mêmes (cf. handleReload) : updateServiceWorker()
 * de vite-plugin-pwa IGNORE son argument reloadPage et se contente d'envoyer
 * SKIP_WAITING. Le rechargement effectif dépend de son écouteur « controlling »,
 * gardé par `if (event.isUpdate)`. Or workbox fixe isUpdate à
 * Boolean(navigator.serviceWorker.controller) AU MOMENT DU REGISTER : après un
 * Ctrl+Shift+R la page n'est pas contrôlée, isUpdate vaut false, et le bouton
 * restait donc sans effet visible.
 */
const ReloadPrompt = () => {
    // Deux chemins peuvent déclencher le rechargement : l'écouteur du plugin
    // (page contrôlée) ou notre clic (page non contrôlée). Un seul doit aboutir.
    const reloadingRef = useRef(false);
    const reloadOnce = useCallback(() => {
        if (reloadingRef.current) return;
        reloadingRef.current = true;
        window.location.reload();
    }, []);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker
    } = useRegisterSW({
        // Quand la page EST contrôlée, le plugin nous délègue le rechargement
        // au bon moment (le nouveau SW vient de prendre la main).
        onNeedReload: reloadOnce,
        onRegisteredSW(swUrl, registration) {
            setSwRegisteredUrl(swUrl);
            // Vérifie périodiquement l'existence d'une nouvelle version
            // (toutes les heures) sans dépendre d'un rechargement manuel.
            if (registration) {
                setInterval(() => { registration.update(); }, 60 * 60 * 1000);
            }
        }
    });

    // Publie l'état pour le rapport de diagnostic (cf. swStatus.js) : le hook
    // vit ici, mais le rapport doit savoir qu'une version attend d'être appliquée.
    useEffect(() => { setSwUpdatePending(needRefresh); }, [needRefresh]);

    const handleReload = async () => {
        try {
            // N'envoie que SKIP_WAITING : ne recharge pas malgré son argument.
            await updateServiceWorker(true);
        } catch {
            // Envoi impossible : on recharge quand même, c'est ce qui est demandé.
        }
        // Laisse au nouveau SW une chance de s'activer et de prendre la main —
        // si c'est le cas, onNeedReload aura déjà rechargé et reloadOnce est
        // neutralisé. Sinon (page non contrôlée), ce délai est notre filet.
        setTimeout(reloadOnce, 300);
    };

    if (!needRefresh) return null;

    return (
        <div className="reload-prompt" role="alert">
            <span className="reload-prompt-msg">Nouvelle version disponible.</span>
            <button
                className="reload-prompt-btn"
                onClick={handleReload}
            >
                Recharger
            </button>
            <button
                className="reload-prompt-close"
                onClick={() => setNeedRefresh(false)}
                title="Plus tard"
                aria-label="Plus tard"
            >
                ×
            </button>
        </div>
    );
};

export default ReloadPrompt;
