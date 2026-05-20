// Logique de détection des conflits affichés case par case dans la
// matrice des temps interverts : recouvrement de verts, délai réel
// disponible, intervert insuffisant.
//
// Particularité par rapport à conflictUtils.computeConflicts : ces
// fonctions prennent en compte les flèches d'anticipation (les timings
// effectifs deviennent ceux de la flèche, pas du vert principal).
//
// Extrait d'IntergreenMatrix.jsx pour permettre les tests unitaires.

/**
 * Construit l'index { gfId: { deb, fin } } des flèches d'anticipation
 * actives. Une flèche n'est retenue que si son `gf`, son `deb` et sa
 * `fin` sont tous renseignés (champ non vide). Si plusieurs flèches
 * existent pour un même groupe, seule la première rencontrée est
 * conservée.
 *
 * @param {Array<Object>|null} actionData
 * @returns {Object<number, {deb:number, fin:number}>}
 */
export function getFlecheAnticipations(actionData) {
    if (!actionData) return {};
    return actionData.filter(action =>
        action.action === "Flèche d'anticipation" &&
        action.gf !== '' &&
        action.deb !== '' &&
        action.fin !== ''
    ).reduce((acc, action) => {
        const gf = parseInt(action.gf);
        if (!acc[gf]) {
            acc[gf] = {
                deb: parseInt(action.deb),
                fin: parseInt(action.fin)
            };
        }
        return acc;
    }, {});
}

/**
 * Vrai si les phases vertes des deux groupes se recouvrent dans le
 * cycle. Si un groupe possède une flèche d'anticipation, ses timings
 * effectifs sont ceux de la flèche, pas du vert principal.
 *
 * Renvoie false si la case de matrice est vide (pas d'intervert à
 * vérifier) ou si un des groupes n'est pas défini.
 *
 * @param {number} fromIdx
 * @param {number} toIdx
 * @param {Object} ctx
 * @param {Array<Array>}  ctx.conflictMatrix
 * @param {Array<Object>} ctx.groups
 * @param {number}        ctx.cycleLength
 * @param {Object}        ctx.flecheAnticipations  (cf. getFlecheAnticipations)
 * @returns {boolean}
 */
export function hasOverlap(fromIdx, toIdx, ctx) {
    const { conflictMatrix, groups, cycleLength, flecheAnticipations } = ctx;
    const matrixVal = conflictMatrix[fromIdx][toIdx];
    if (matrixVal === '' || matrixVal === undefined || matrixVal === null) return false;
    if (!groups || !groups[fromIdx] || !groups[toIdx]) return false;

    const groupA = groups[fromIdx];
    const groupB = groups[toIdx];
    const cycle = cycleLength || 100;

    const flecheA = flecheAnticipations[groupA.id];
    const flecheB = flecheAnticipations[groupB.id];

    const aStart = flecheA ? flecheA.deb % cycle : groupA.offset % cycle;
    const aEnd = flecheA ? flecheA.fin % cycle : (groupA.offset + groupA.durations.green) % cycle;
    const bStart = flecheB ? flecheB.deb % cycle : groupB.offset % cycle;
    const bEnd = flecheB ? flecheB.fin % cycle : (groupB.offset + groupB.durations.green) % cycle;

    const aWraps = aEnd <= aStart;
    const bWraps = bEnd <= bStart;

    if (!aWraps && !bWraps) {
        return aStart < bEnd && bStart < aEnd;
    } else if (aWraps && !bWraps) {
        return bStart < aEnd || bEnd > aStart;
    } else if (!aWraps && bWraps) {
        return aStart < bEnd || aEnd > bStart;
    } else {
        // Les deux phases enjambent la fin de cycle -> elles partagent
        // forcément au moins l'instant 0.
        return true;
    }
}

/**
 * Délai réel (s) entre la fin du vert (ou de la flèche d'anticipation)
 * du groupe source et le début du vert (ou flèche) du groupe cible,
 * mesuré dans le sens du cycle (wrap-around si nécessaire).
 *
 * @returns {number|null} le délai en secondes, ou null si les groupes
 *                        ne sont pas définis.
 */
export function computeActualDelay(fromIdx, toIdx, ctx) {
    const { groups, cycleLength, flecheAnticipations } = ctx;
    if (!groups || !groups[fromIdx] || !groups[toIdx]) return null;
    const cycle = cycleLength || 100;
    const fromGroup = groups[fromIdx];
    const toGroup = groups[toIdx];
    const flecheFrom = flecheAnticipations[fromGroup.id];
    const flecheTo = flecheAnticipations[toGroup.id];
    const fromEnd = flecheFrom
        ? flecheFrom.fin % cycle
        : (fromGroup.offset + fromGroup.durations.green) % cycle;
    const toStart = flecheTo
        ? flecheTo.deb % cycle
        : toGroup.offset % cycle;
    let d = toStart - fromEnd;
    if (d < 0) d += cycle;
    return d;
}

/**
 * Vrai si l'intervert demandé par la matrice est supérieur au délai
 * réel disponible entre les deux groupes (cas du fond rouge). Englobe
 * le recouvrement (qui est lui aussi un conflit).
 */
export function isDelayInsufficient(fromIdx, toIdx, ctx) {
    const { conflictMatrix, groups } = ctx;
    const matrixVal = conflictMatrix[fromIdx][toIdx];
    if (matrixVal === '' || matrixVal === undefined || matrixVal === null) return false;
    if (!groups || !groups[fromIdx] || !groups[toIdx]) return false;

    if (hasOverlap(fromIdx, toIdx, ctx)) return true;

    const actualDelay = computeActualDelay(fromIdx, toIdx, ctx);
    return matrixVal > actualDelay;
}
