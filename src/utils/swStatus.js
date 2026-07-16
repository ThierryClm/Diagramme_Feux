/**
 * Petit registre de l'état du service worker, alimenté par ReloadPrompt.jsx
 * (seul détenteur du hook useRegisterSW) et lu par le rapport de diagnostic.
 *
 * Raison d'être : le mode de panne le plus fréquent de l'app est un bundle
 * périmé servi par le SW (« les flèches ont disparu » → Ctrl+Shift+R). Le
 * rapport doit pouvoir dire si une mise à jour attend d'être appliquée, sinon
 * on cherche un bug dans le code là où il n'y en a pas.
 */

let updatePending = false;
let registeredUrl = null;

/**
 * L'URL publiée par le hook est relative (base: './' dans vite.config). En
 * absolu elle révèle l'origine — donc le port, utile avec le cloisonnement du
 * stockage local.
 */
const absolutize = (url) => {
    if (!url) return null;
    try {
        return new URL(url, window.location.href).href;
    } catch {
        return url;
    }
};

export const setSwUpdatePending = (pending) => { updatePending = !!pending; };

export const setSwRegisteredUrl = (url) => { registeredUrl = url || null; };

/**
 * État du service worker, volontairement synchrone : buildDiagnosticReport est
 * appelé pendant un rendu, on ne peut pas y attendre getRegistration(). Les
 * seules informations asynchrones (worker en attente / en installation) sont
 * couvertes par updatePending, publié par le hook.
 */
export const getSwStatus = () => {
    const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const controller = supported ? navigator.serviceWorker.controller : null;
    return {
        supported,
        controlled: !!controller,
        state: controller ? controller.state : null,
        scriptUrl: (controller && controller.scriptURL) || absolutize(registeredUrl),
        updatePending
    };
};

/** Remet le registre à zéro — utilisé par les tests. */
export const resetSwStatus = () => {
    updatePending = false;
    registeredUrl = null;
};
