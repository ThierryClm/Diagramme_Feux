// Visibilité de l'invitation « Découvrir avec un projet exemple » sur les
// écrans d'accueil (Diagramme & Onde verte).
//
// L'invitation s'efface d'elle-même une fois que l'utilisateur n'est plus
// un nouvel arrivant. Deux déclencheurs, le premier atteint l'emporte :
//   - MAX_WELCOME_VIEWS affichages de l'écran d'accueil (filet de sécurité
//     pour qui regarde sans jamais ouvrir de projet) ;
//   - MAX_PROJECTS_SEEN projets ouverts/créés (seuil 2 : un primo-visiteur
//     qui ouvre un projet dès la 1re visite revoit l'invitation une fois
//     encore avant qu'elle ne disparaisse).
//
// Compteurs indépendants par module (scope) : découvrir l'exemple Onde
// verte est un apprentissage distinct de l'exemple carrefour. Stockage
// localStorage, tolérant aux environnements où il est indisponible.

const MAX_WELCOME_VIEWS = 5;
const MAX_PROJECTS_SEEN = 2;

const key = (scope, name) => `tracflux.welcomeInvite.${scope}.${name}`;

function readInt(k) {
    try {
        const v = parseInt(localStorage.getItem(k), 10);
        return Number.isFinite(v) ? v : 0;
    } catch {
        return 0;
    }
}

function bump(k) {
    try {
        localStorage.setItem(k, String(readInt(k) + 1));
    } catch {
        // localStorage indisponible (mode privé strict, quota) : on ignore.
        // L'invitation restera visible — comportement dégradé acceptable.
    }
}

// À appeler une fois au rendu de l'écran d'accueil pour décider de
// l'affichage. Lecture seule : n'incrémente rien.
export function isInviteVisible(scope) {
    return readInt(key(scope, 'welcomeViews')) < MAX_WELCOME_VIEWS
        && readInt(key(scope, 'projectsSeen')) < MAX_PROJECTS_SEEN;
}

// L'écran d'accueil a été réellement présenté (aucun projet en cours de
// chargement). À n'appeler qu'une fois par montage.
export function noteWelcomeView(scope) {
    bump(key(scope, 'welcomeViews'));
}

// Un projet a été ouvert/créé/restauré (l'exemple compte). À n'appeler
// qu'une fois par montage, à la première activation d'un projet.
export function noteProjectSeen(scope) {
    bump(key(scope, 'projectsSeen'));
}
