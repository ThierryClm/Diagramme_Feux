/**
 * Pure helpers for Plan de Feu (PF) management.
 * No React, no side effects — safe to unit test.
 */

export const DEFAULT_CYCLE = 60;

// Limites maximales par projet : pas une contrainte technique, mais un
// garde-fou pour eviter qu'un projet ne devienne illisible (matrice
// intervert et onglets PF saturent au-dela de ces ordres de grandeur,
// 32 groupes etant deja a la limite du lisible a l'ecran).
export const MAX_PF = 15;
export const MAX_GROUPS = 32;

/**
 * Create an empty action row with the given id.
 */
export const createEmptyActionRow = (id) => ({
    id,
    gf: '',
    action: '',
    description: '',
    deb: '',
    fin: '',
    abrv: '',
    micro: '',
    plage1: '',
    plage2: '',
    actGf1: '',
    actGf1Gf2: '',
    actGf1Gf3: '',
    actGf1Gf4: ''
});

/**
 * Create an array of 30 empty action rows (default PF data).
 */
export const createEmptyActionData = () =>
    Array.from({ length: 30 }, (_, i) => createEmptyActionRow(i + 1));

/**
 * Build a diagram array from a list of groups.
 * Used to initialize pf.diagram when missing.
 */
export const buildDiagramFromGroups = (sourceGroups) => {
    if (!Array.isArray(sourceGroups)) return [];
    return sourceGroups.map(g => ({
        groupId: g.id,
        offset: (g.offset !== undefined && !isNaN(g.offset)) ? g.offset : 0,
        greenDuration: (g.durations?.green !== undefined && !isNaN(g.durations.green)) ? g.durations.green : 10,
        da: g.da || '',
        comment: g.comment || '',
        commentColor: g.commentColor || '',
        phaseFlag: g.phaseFlag || ''
    }));
};

/**
 * Build an empty conflict matrix sized to groupCount x groupCount.
 */
export const buildEmptyMatrix = (groupCount) => {
    const n = Math.max(0, groupCount || 0);
    return Array.from({ length: n }, () => new Array(n).fill(''));
};

/**
 * Create a new PF with all required fields guaranteed.
 */
export const createEmptyPF = (opts = {}) => {
    const { id, name, sourceGroups, groupCount } = opts;
    return {
        id: id ?? 1,
        name: name ?? `PF${id ?? 1}`,
        data: Array.isArray(opts.data) && opts.data.length > 0 ? opts.data : createEmptyActionData(),
        diagram: Array.isArray(opts.diagram) && opts.diagram.length > 0
            ? opts.diagram
            : buildDiagramFromGroups(sourceGroups),
        cycleLength: opts.cycleLength ?? DEFAULT_CYCLE,
        microCustomFields: Array.isArray(opts.microCustomFields) ? opts.microCustomFields : [],
        conflictMatrix: Array.isArray(opts.conflictMatrix) && opts.conflictMatrix.length > 0
            ? opts.conflictMatrix
            : buildEmptyMatrix(groupCount ?? (sourceGroups?.length || 0)),
        remarques: opts.remarques ?? ''
    };
};

/**
 * Ensure every PF in the array has a complete structure.
 * Idempotent: preserves existing valid fields, fills only what's missing.
 */
export const ensurePFIntegrity = (pfTabsArr, fallbackGroups, fallbackMatrix) => {
    if (!Array.isArray(pfTabsArr)) return [];
    const groupCount = fallbackGroups?.length || 0;
    return pfTabsArr.map(pf => {
        if (!pf || typeof pf !== 'object') return null;
        const hasDiagram = Array.isArray(pf.diagram) && pf.diagram.length > 0;
        const hasMatrix = Array.isArray(pf.conflictMatrix) && pf.conflictMatrix.length > 0;
        return {
            id: pf.id,
            name: pf.name || `PF${pf.id}`,
            data: Array.isArray(pf.data) && pf.data.length > 0 ? pf.data : createEmptyActionData(),
            diagram: hasDiagram
                ? pf.diagram.map(d => ({
                    ...d,
                    offset: (d.offset !== undefined && !isNaN(d.offset)) ? d.offset : 0,
                    greenDuration: (d.greenDuration !== undefined && !isNaN(d.greenDuration)) ? d.greenDuration : 10
                }))
                : buildDiagramFromGroups(fallbackGroups),
            cycleLength: pf.cycleLength ?? DEFAULT_CYCLE,
            microCustomFields: Array.isArray(pf.microCustomFields) ? pf.microCustomFields : [],
            conflictMatrix: hasMatrix
                ? pf.conflictMatrix
                : (Array.isArray(fallbackMatrix) && fallbackMatrix.length > 0
                    ? fallbackMatrix.map(row => [...row])
                    : buildEmptyMatrix(groupCount)),
            remarques: pf.remarques ?? '',
            ...(pf.color !== undefined ? { color: pf.color } : {})
        };
    }).filter(Boolean);
};
