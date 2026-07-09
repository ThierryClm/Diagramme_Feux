import React from 'react';

/**
 * Liste des conflits détectés (dégagements insuffisants, conflits de secondes
 * lucarnes, etc.). Rendue à la fois en colonne (sidebar) et dans une fenêtre
 * détachée pour mise en évidence sur un écran principal ou secondaire.
 *
 * - conflicts : tableau de conflits (displayConflicts).
 * - groups : groupes du projet (pour retrouver le phaseFlag).
 * - isConflictGrayed : (conflict) => bool — conflit neutralisé (aiguillage/escamotage).
 * - setHoveredConflict : surbrillance croisée avec le diagramme/la matrice.
 * - detached : mode fenêtre détachée (affiche le compteur + état vide).
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
    const count = conflicts.length;
    return (
        <div className={`conflict-list${detached ? ' conflict-list-detached' : ''}`}>
            <h4>
                Conflits{detached ? ` (${count})` : ':'}
                {onDetach && !detached && (
                    <button
                        className="detach-btn"
                        onClick={onDetach}
                        title={tip("Ouvrir la liste des conflits dans une fenêtre séparée (écran principal ou secondaire)")}
                    >Détacher</button>
                )}
            </h4>
            {count === 0 ? (
                <p className="conflict-none">Aucun conflit détecté.</p>
            ) : (
                <ul>
                    {conflicts.map((c, i) => {
                        const grayed = isConflictGrayed(c);
                        const fromGroup = groups.find(g => g.id === c.from);
                        const flagLabel = fromGroup?.phaseFlag;
                        return (
                            <li
                                key={i}
                                onMouseEnter={() => setHoveredConflict({ from: c.from, to: c.to })}
                                onMouseLeave={() => setHoveredConflict(null)}
                                style={{ cursor: 'pointer', opacity: grayed ? 0.4 : 1 }}
                            >
                                {c.type === 'intergreen' ? (
                                    <>GF{c.from} → GF{c.to} : Dégagement insuffisant ({c.actual.toFixed(1)}s / {c.required}s requis)</>
                                ) : (
                                    <>GF{c.from} ↔ GF{c.to} : {c.message}</>
                                )}
                                {grayed && <span style={{ marginLeft: 6, fontSize: '0.85em', color: '#888' }}>({flagLabel === 'a' ? 'aiguillage' : 'escamotage'})</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default ConflictList;
