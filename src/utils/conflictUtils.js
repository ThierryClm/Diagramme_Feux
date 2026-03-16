/**
 * Vérifie si deux intervalles temporels se chevauchent dans un cycle.
 */
export function rangesOverlap(startA, endA, startB, endB, cycleLength) {
    // Normalize to [0, cycleLength)
    const sA = ((startA % cycleLength) + cycleLength) % cycleLength;
    const eA = ((endA % cycleLength) + cycleLength) % cycleLength;
    const sB = ((startB % cycleLength) + cycleLength) % cycleLength;
    const eB = ((endB % cycleLength) + cycleLength) % cycleLength;

    const wrapA = eA <= sA;
    const wrapB = eB <= sB;

    if (!wrapA && !wrapB) return sA < eB && sB < eA;
    if (wrapA && !wrapB)  return sB < eA || eB > sA;
    if (!wrapA && wrapB)  return sA < eB || eA > sB;
    return true; // Les deux wrappent → chevauchement forcé
}

/**
 * Calcule les conflits d'intervert entre groupes.
 * Logique extraite de useTrafficLight.js pour être testable indépendamment.
 *
 * @param {Array} groups - Liste des groupes de feux
 * @param {Array} conflictMatrix - Matrice 2D des temps intervert
 * @param {number} cycleLength - Durée du cycle en secondes
 * @param {Array} actionData - Données des actions (seconde lucarne, escamotage, etc.)
 * @returns {Array} Liste des conflits détectés
 */
export function computeConflicts(groups, conflictMatrix, cycleLength, actionData = []) {
    const list = [];
    const count = groups.length;

    const secondeLucarnes = actionData.filter(a =>
        a.action === 'Seconde lucarne' && a.gf !== '' && a.deb !== '' && a.fin !== ''
    ).map(a => ({ gf: parseInt(a.gf), deb: parseInt(a.deb), fin: parseInt(a.fin) }));

    const escamotages = actionData.filter(a =>
        (a.action === 'Escamotage' || a.action === 'Escamotage de phase') &&
        a.gf !== '' && a.actGf1 !== ''
    ).map(a => ({ sourceGf: parseInt(a.gf), targetGf: parseInt(a.actGf1) }));

    const flecheAnticipations = actionData.filter(a =>
        a.action === "Flèche d'anticipation" && a.gf !== '' && a.deb !== '' && a.fin !== ''
    ).reduce((acc, a) => {
        const gf = parseInt(a.gf);
        if (!acc[gf]) acc[gf] = { deb: parseInt(a.deb), fin: parseInt(a.fin) };
        return acc;
    }, {});

    const hasEscamotage = (gfA, gfB) =>
        escamotages.some(e =>
            (e.sourceGf === gfA && e.targetGf === gfB) ||
            (e.sourceGf === gfB && e.targetGf === gfA)
        );

    for (let from = 0; from < count; from++) {
        if (!conflictMatrix[from]) continue;
        for (let to = 0; to < count; to++) {
            const minGap = conflictMatrix[from][to];
            if (minGap === '' || minGap === undefined || minGap === null || from === to) continue;

            const gFrom = groups[from];
            const gTo = groups[to];

            const flecheFrom = flecheAnticipations[gFrom.id];
            const flecheTo = flecheAnticipations[gTo.id];

            const endGreenA = flecheFrom
                ? flecheFrom.fin % cycleLength
                : (gFrom.offset + gFrom.durations.green) % cycleLength;

            const startGreenB = flecheTo
                ? flecheTo.deb % cycleLength
                : gTo.offset % cycleLength;

            const distance = (startGreenB - endGreenA + cycleLength) % cycleLength;

            if (distance < minGap) {
                list.push({ from: gFrom.id, to: gTo.id, required: minGap, actual: distance, type: 'intergreen' });
            }

            const startA = flecheFrom ? flecheFrom.deb : gFrom.offset;
            const endA   = flecheFrom ? flecheFrom.fin : gFrom.offset + gFrom.durations.green;
            const startB = flecheTo ? flecheTo.deb : gTo.offset;
            const endB   = flecheTo ? flecheTo.fin : gTo.offset + gTo.durations.green;

            if (rangesOverlap(startA, endA, startB, endB, cycleLength)) {
                if (!hasEscamotage(gFrom.id, gTo.id)) {
                    const existingConflict = list.find(c =>
                        c.from === gFrom.id && c.to === gTo.id && c.type === 'intergreen'
                    );
                    if (!existingConflict) {
                        list.push({ from: gFrom.id, to: gTo.id, type: 'overlap', message: 'Chevauchement des phases vertes' });
                    }
                }
            }

            secondeLucarnes.forEach(sl => {
                if (sl.gf === gFrom.id && rangesOverlap(sl.deb, sl.fin, startB, endB, cycleLength)) {
                    list.push({ from: gFrom.id, to: gTo.id, type: 'sl-overlap', message: 'Seconde lucarne chevauche vert' });
                }
            });
        }
    }

    return list;
}

/**
 * Déplace un groupe de la position `from` à la position `to` dans le tableau.
 * Réassigne les ids séquentiellement après déplacement.
 *
 * @param {Array} groups - Liste des groupes
 * @param {number} fromIndex - Index source (0-based)
 * @param {number} toIndex - Index destination (0-based)
 * @returns {Array} Nouveau tableau de groupes
 */
export function moveGroup(groups, fromIndex, toIndex) {
    const newGroups = [...groups];
    const [moved] = newGroups.splice(fromIndex, 1);
    newGroups.splice(toIndex, 0, moved);
    return newGroups.map((g, idx) => ({ ...g, id: idx + 1 }));
}
