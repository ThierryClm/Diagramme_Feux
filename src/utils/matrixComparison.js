// Logique pure de comparaison entre la matrice du PF courant et le PF de
// référence (PF1), et de composition de l'infobulle des cases de matrice.
// Extrait d'IntergreenMatrix.jsx pour permettre les tests unitaires.

/**
 * Compare la valeur d'une case avec la valeur correspondante du PF de
 * référence (PF1). Renvoie :
 *   - 'higher' : la valeur courante est supérieure au PF1 (rouge UI)
 *   - 'lower'  : la valeur courante est inférieure au PF1 (vert UI)
 *   - null     : pas de comparaison (refMatrix absente, diagonale, ou
 *                valeurs égales ou toutes deux nulles)
 *
 * Le caller passe refMatrix=null quand la comparaison n'est pas
 * pertinente (ex. on consulte le PF1 lui-même).
 *
 * @param {number}     fromIdx     index ligne (groupe source)
 * @param {number}     toIdx       index colonne (groupe cible)
 * @param {*}          currentVal  valeur de la case courante (number | '' | null | undefined)
 * @param {Array|null} refMatrix   matrice de référence (PF1) ou null
 * @returns {'higher' | 'lower' | null}
 */
export function compareWithPF1(fromIdx, toIdx, currentVal, refMatrix) {
    if (!refMatrix || !refMatrix.length) return null;
    if (fromIdx === toIdx) return null;

    const refVal = refMatrix[fromIdx]?.[toIdx];
    const current = (currentVal === '' || currentVal === undefined || currentVal === null) ? 0 : parseInt(currentVal);
    const ref = (refVal === '' || refVal === undefined || refVal === null) ? 0 : parseInt(refVal);

    if (current === 0 && ref === 0) return null;
    if (current > ref) return 'higher';
    if (current < ref) return 'lower';
    return null;
}

/**
 * Construit les lignes textuelles de l'infobulle d'une case de matrice :
 *   - éventuelle ligne « écart vs PF1 » si la valeur diffère du PF1 ;
 *   - éventuelle ligne « conflit » (recouvrement ou intervert insuffisant)
 *     si la case est en fond rouge.
 *
 * Retourne un tableau de chaînes (peut être vide).
 *
 * Les prédicats isDelayInsufficient / hasOverlap / computeActualDelay
 * sont injectés pour garder la fonction pure (pas de dépendance sur les
 * groupes ni le cycle).
 *
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {Array<Array>}  params.conflictMatrix    matrice courante 2D
 * @param {Array|null}    params.refMatrix         matrice PF1 (null si pas de comparaison)
 * @param {Array<Object>} params.groups            liste des groupes (utilise .id pour les libellés GFn)
 * @param {(f:number,t:number)=>boolean} params.isDelayInsufficient
 * @param {(f:number,t:number)=>boolean} params.hasOverlap
 * @param {(f:number,t:number)=>number|null} params.computeActualDelay
 * @returns {string[]}
 */
export function buildCellTooltipLines({
    fromIdx,
    toIdx,
    conflictMatrix,
    refMatrix,
    groups,
    isDelayInsufficient,
    hasOverlap,
    computeActualDelay
}) {
    if (fromIdx === toIdx) return [];
    const lines = [];
    const val = conflictMatrix[fromIdx][toIdx];

    if (refMatrix && refMatrix.length) {
        const refVal = refMatrix[fromIdx]?.[toIdx];
        const cur = (val === '' || val == null) ? 0 : parseInt(val);
        const ref = (refVal === '' || refVal == null) ? 0 : parseInt(refVal);
        if (cur !== ref && !(cur === 0 && ref === 0)) {
            const fromLabel = ref === 0 ? '—' : ref + ' s';
            const toLabel = cur === 0 ? '—' : cur + ' s';
            const delta = Math.abs(cur - ref);
            lines.push(
                (cur > ref ? 'Augmentée' : 'Réduite') +
                ` de ${delta} s vs PF de base (PF1) : ${fromLabel} → ${toLabel}`
            );
        }
    }

    if (isDelayInsufficient(fromIdx, toIdx)) {
        const fromName = `GF${groups[fromIdx]?.id ?? fromIdx + 1}`;
        const toName   = `GF${groups[toIdx]?.id   ?? toIdx + 1}`;
        if (hasOverlap(fromIdx, toIdx)) {
            lines.push(`Conflit : les verts de ${fromName} et ${toName} se recouvrent.`);
        } else {
            const actual = computeActualDelay(fromIdx, toIdx);
            lines.push(`Conflit : intervert demandé ${val} s > délai réel ${actual} s entre fin vert ${fromName} et début vert ${toName}.`);
        }
    }

    return lines;
}
