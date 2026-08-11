import React from 'react';

/**
 * Liste des conflits détectés (dégagements insuffisants, conflits de secondes
 * lucarnes, etc.). Rendue à la fois en colonne (sidebar) et dans une fenêtre
 * détachée pour mise en évidence sur un écran principal ou secondaire.
 *
 * Les conflits sont présentés en deux sections distinctes :
 *
 * - « majeurs » : rien ne les prend en charge, ils sont à traiter ;
 * - « potentiels » : bien présents dans le diagramme, mais traités par la
 *   micro-régulation (aiguillage ou escamotage sur le groupe amont).
 *
 * Le critère de partage est `isConflictGrayed`, fourni par App : il est vrai
 * quand le groupe amont porte un phaseFlag. Les potentiels restent lisibles
 * (couleur atténuée, pas d'opacité réduite) : ils sont traités, pas inexistants.
 *
 * Chaque section porte son propre titre coloré et son compte, et n'est rendue
 * que si elle a du contenu : une catégorie vide ne laisse aucune trace à
 * l'écran. Il n'y a donc pas de titre global — il ferait doublon.
 *
 * - conflicts : tableau de conflits (displayConflicts).
 * - groups : groupes du projet (pour retrouver le phaseFlag).
 * - isConflictGrayed : (conflict) => bool — conflit pris en charge par la micro-régulation.
 * - setHoveredConflict : surbrillance croisée avec le diagramme/la matrice.
 * - detached : mode fenêtre détachée (affiche l'état vide).
 * - onDetach : si fourni (mode inline), affiche un bouton « Détacher ».
 * - tip : passe-plat pour les infobulles (optionnel).
 */

const ConflictList = ({
    conflicts = [],
    groups = [],
    isConflictGrayed = () => false,
    setHoveredConflict = () => {},
    detached = false,
    onDetach = null,
    tip = (t) => t
}) => {
    const majeurs = conflicts.filter(c => !isConflictGrayed(c));
    const potentiels = conflicts.filter(c => isConflictGrayed(c));
    const count = conflicts.length;

    // Le cadre suit la gravité : rouge dès qu'il reste un conflit majeur,
    // ambre quand tout est pris en charge par la micro-régulation.
    const sansMajeur = majeurs.length === 0 && potentiels.length > 0;

    // Sans titre global, le bouton « Détacher » se pose sur le titre de la
    // première section visible — quelle qu'elle soit.
    const detacher = (onDetach && !detached) ? (
        <button
            className="detach-btn"
            onClick={onDetach}
            title={tip("Ouvrir la liste des conflits dans une fenêtre séparée (écran principal ou secondaire)")}
        >Détacher</button>
    ) : null;

    const renderItem = (c, i, potentiel) => {
        const fromGroup = groups.find(g => g.id === c.from);
        const flagLabel = fromGroup?.phaseFlag;
        return (
            <li
                key={i}
                className={potentiel ? 'conflict-item-potentiel' : 'conflict-item-majeur'}
                onMouseEnter={() => setHoveredConflict({ from: c.from, to: c.to })}
                onMouseLeave={() => setHoveredConflict(null)}
                style={{ cursor: 'pointer' }}
            >
                {c.type === 'intergreen' ? (
                    <>GF{c.from} → GF{c.to} : Dégagement insuffisant ({c.actual.toFixed(1)}s / {c.required}s requis)</>
                ) : (
                    <>GF{c.from} ↔ GF{c.to} : {c.message}</>
                )}
                {potentiel && (
                    <span className="conflict-flag">
                        ({flagLabel === 'a' ? 'aiguillage' : 'escamotage'})
                    </span>
                )}
            </li>
        );
    };

    return (
        <div className={`conflict-list${sansMajeur ? ' conflict-list-sans-majeur' : ''}${detached ? ' conflict-list-detached' : ''}`}>
            {count === 0 ? (
                <div className="conflict-empty-row">
                    <p className="conflict-none">Aucun conflit détecté.</p>
                    {detacher}
                </div>
            ) : (
                <>
                    {majeurs.length > 0 && (
                        <div className="conflict-section">
                            <h4 className="conflict-section-majeurs">
                                Conflits majeurs — {majeurs.length}
                                {detacher}
                            </h4>
                            <ul>{majeurs.map((c, i) => renderItem(c, i, false))}</ul>
                        </div>
                    )}

                    {potentiels.length > 0 && (
                        <div className="conflict-section">
                            <h4
                                className="conflict-section-potentiels"
                                title={tip("Conflits présents dans le diagramme, mais traités par la micro-régulation (aiguillage ou escamotage)")}
                            >
                                Conflits potentiels — {potentiels.length}
                                {majeurs.length === 0 ? detacher : null}
                            </h4>
                            <ul>{potentiels.map((c, i) => renderItem(c, i, true))}</ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ConflictList;
