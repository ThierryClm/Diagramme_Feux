import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
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
 */
const ReloadPrompt = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            // Vérifie périodiquement l'existence d'une nouvelle version
            // (toutes les heures) sans dépendre d'un rechargement manuel.
            if (registration) {
                setInterval(() => { registration.update(); }, 60 * 60 * 1000);
            }
        }
    });

    if (!needRefresh) return null;

    return (
        <div className="reload-prompt" role="alert">
            <span className="reload-prompt-msg">Nouvelle version disponible.</span>
            <button
                className="reload-prompt-btn"
                onClick={() => updateServiceWorker(true)}
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
