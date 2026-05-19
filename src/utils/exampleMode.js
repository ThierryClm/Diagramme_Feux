// Session « projet exemple » (ouverte via ?example=carrefour|ondeverte).
//
// Un projet exemple est librement modifiable pour explorer, mais NON
// persistable : ni sauvegarde fichier, ni écriture localStorage (sinon
// il polluerait les projets stockés / « Restaurer un projet récent »).
//
// Le drapeau est initialisé SYNCHRONEMENT à l'import (avant le premier
// rendu React, donc avant le premier passage de l'auto-save) à partir de
// l'URL : une fenêtre exemple est inerte côté persistance dès la 1re
// frame, même si le contenu est chargé ensuite en asynchrone.
//
// Il redevient « normal » dès que l'utilisateur charge/crée un vrai
// projet (Nouveau, Ouvrir, Restaurer, Dupliquer) — cf. exitExampleSession.

let _example = false;
try {
    _example = new URLSearchParams(window.location.search).has('example');
} catch {
    _example = false;
}

export function isExampleSession() {
    return _example;
}

// À appeler dès qu'un vrai projet est chargé/créé : la sauvegarde et la
// persistance localStorage redeviennent autorisées pour cette fenêtre.
export function exitExampleSession() {
    _example = false;
}
