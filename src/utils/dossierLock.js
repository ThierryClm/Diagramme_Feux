/**
 * Marqueur « dossier en lecture seule » pour l'export, volontairement OBSCURCI.
 *
 * ⚠️ NON cryptographique. C'est un verrou de CONVENTION :
 *   - il décourage un utilisateur lambda (le champ porte un nom neutre et une
 *     valeur encodée, non parlante à l'ouverture du .json) ;
 *   - le format restant ouvert, un utilisateur déterminé peut le retirer, le
 *     recalculer ou l'ignorer (DevTools, édition du fichier).
 * À ne JAMAIS présenter comme une protection forte — au même titre que les
 * comptes utilisateurs de l'application.
 *
 * Le verrou est destiné à transmettre un dossier à des utilisateurs finaux pour
 * VISUALISATION, en préservant l'intégrité des données d'entrée.
 */

// Champ au nom neutre (pas « lectureSeule ») + valeur encodée base64.
const FIELD = 'stamp';

/** Ajoute le marqueur lecture seule à un objet projet (immuable). */
export const stampReadOnly = (data) => ({
    ...data,
    [FIELD]: btoa(JSON.stringify({ ro: 1, v: 1 }))
});

/** Vrai si l'objet projet porte le marqueur lecture seule. */
export const isReadOnlyStamped = (data) => {
    try {
        const raw = data && data[FIELD];
        if (typeof raw !== 'string' || !raw) return false;
        const obj = JSON.parse(atob(raw));
        return !!obj && obj.ro === 1;
    } catch {
        return false;
    }
};
