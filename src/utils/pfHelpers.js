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

/**
 * Restreint un état de projet complet (issu de getFullState) à un sous-ensemble
 * de plans de feux, pour l'export sélectif. Fonction PURE : ne modifie pas
 * l'entrée, ne touche à rien d'autre (pas de cache, pas de projet courant).
 *
 * - pfTabs filtré aux ids sélectionnés ;
 * - activePFId recalé sur le 1er PF conservé si l'actif n'est pas retenu, avec
 *   le miroir top-level (cycleLength, conflictMatrix) réaligné sur ce PF ;
 * - pfTrafficDatasetMap réduit aux PF conservés (nettoie au passage les clés
 *   orphelines) ;
 * - capacityCompareSelection filtré aux PF conservés (null s'il ne reste rien).
 *
 * Les données partagées (groups, trafficDatasets, propriétés, image…) sont
 * conservées telles quelles. Renvoie null si la sélection est vide.
 *
 * @param {object} fullState état complet (getFullState)
 * @param {Array<number>} selectedIds ids de PF à conserver
 * @returns {object|null}
 */
export const selectPfSubset = (fullState, selectedIds) => {
    if (!fullState || !Array.isArray(fullState.pfTabs)) return null;
    const ids = new Set((selectedIds || []).map(Number));
    const pfTabs = fullState.pfTabs.filter(p => ids.has(Number(p.id)));
    if (pfTabs.length === 0) return null;

    const activePFId = ids.has(Number(fullState.activePFId))
        ? fullState.activePFId
        : pfTabs[0].id;
    const active = pfTabs.find(p => Number(p.id) === Number(activePFId));

    const pfTrafficDatasetMap = {};
    Object.entries(fullState.pfTrafficDatasetMap || {}).forEach(([k, v]) => {
        if (ids.has(Number(k))) pfTrafficDatasetMap[k] = v;
    });

    let capacityCompareSelection = fullState.capacityCompareSelection;
    if (Array.isArray(capacityCompareSelection)) {
        capacityCompareSelection = capacityCompareSelection.filter(id => ids.has(Number(id)));
        if (capacityCompareSelection.length === 0) capacityCompareSelection = null;
    }

    // Réaligner les groupes (offset, vert, DA…) sur le diagramme du PF actif
    // retenu. INDISPENSABLE quand le PF actif d'origine est exclu : sinon les
    // groupes top-level gardent la géométrie de l'ancien PF actif, l'état
    // exporté est incohérent, et au rechargement la synchro écrase le diagramme
    // du nouveau PF actif (verts faussés, « fermeture anticipée » décalée).
    // Reproduit exactement la reconstitution du reverse-sync (useTrafficLight).
    let groups = fullState.groups;
    if (active && Array.isArray(active.diagram) && Array.isArray(groups)) {
        const byId = new Map(active.diagram.map(d => [d.groupId, d]));
        groups = groups.map(g => {
            const d = byId.get(g.id);
            if (!d) return g;
            return {
                ...g,
                offset: (d.offset !== undefined && !isNaN(d.offset)) ? d.offset : g.offset,
                da: d.da !== undefined ? d.da : g.da,
                comment: d.comment !== undefined ? d.comment : g.comment,
                commentColor: d.commentColor !== undefined ? d.commentColor : g.commentColor,
                phaseFlag: d.phaseFlag !== undefined ? d.phaseFlag : g.phaseFlag,
                durations: {
                    ...g.durations,
                    green: (d.greenDuration !== undefined && !isNaN(d.greenDuration)) ? d.greenDuration : g.durations?.green
                }
            };
        });
    }

    return {
        ...fullState,
        groups,
        pfTabs,
        activePFId,
        cycleLength: active?.cycleLength ?? fullState.cycleLength,
        conflictMatrix: active?.conflictMatrix ?? fullState.conflictMatrix,
        pfTrafficDatasetMap,
        capacityCompareSelection
    };
};

/** Jeux de données trafic standard (toujours présents, non « personnalisés »). */
const STANDARD_TRAFFIC_DATASETS = ['HPM', 'HPS', 'HC', 'Estimation', 'Projection'];

/**
 * Fusionne les plans de feux d'un projet importé DANS le projet courant, pour
 * comparaison. Fonction PURE (ne modifie pas les entrées).
 *
 * - Bloque si les GROUPES diffèrent (nombre ou numérotation) : un PF référence
 *   les groupes du projet, la comparaison n'a de sens qu'entre deux versions
 *   d'un même carrefour. -> renvoie { error }.
 * - PF importés renommés « <nom>_ext » (collisions : _ext, _ext2…), avec de
 *   nouveaux ids, ajoutés à la suite. Chacun garde sa matrice et son cycle.
 * - Jeux de données trafic référencés : rapatriés s'ils manquent.
 * - Respecte la limite MAX_PF (avertissement + troncature si dépassement).
 * - opts.readOnly : marque les PF importés en lecture seule (par PF).
 *
 * @returns {{ state?: object, warnings?: string[], addedCount?: number, error?: string }}
 */
export const mergePfFromProject = (current, imported, opts = {}) => {
    const warnings = [];
    if (!current || !Array.isArray(current.pfTabs)) {
        return { error: 'Projet courant invalide.' };
    }
    if (!imported || !Array.isArray(imported.pfTabs) || imported.pfTabs.length === 0) {
        return { error: 'Le fichier importé ne contient aucun plan de feux.' };
    }

    // Compatibilité des groupes : mêmes ids (nombre + numérotation).
    const curIds = (current.groups || []).map(g => g.id).slice().sort((a, b) => a - b);
    const impIds = (imported.groups || []).map(g => g.id).slice().sort((a, b) => a - b);
    const sameGroups = curIds.length === impIds.length && curIds.every((id, i) => id === impIds[i]);
    if (!sameGroups) {
        return {
            error: `Groupes de feux incompatibles : ${curIds.length} dans le projet courant, ${impIds.length} dans le fichier importé. `
                + 'L\'import de plans de feux n\'est possible qu\'entre deux versions d\'un même carrefour (mêmes groupes).'
        };
    }

    // Limite MAX_PF.
    const existing = current.pfTabs;
    const room = MAX_PF - existing.length;
    if (room <= 0) {
        return { error: `Limite de ${MAX_PF} plans de feux déjà atteinte : supprimez-en avant d'importer.` };
    }
    let toImport = imported.pfTabs;
    if (toImport.length > room) {
        warnings.push(`${toImport.length} plans de feux dans le fichier, mais seuls ${room} peuvent être ajoutés (limite ${MAX_PF}) : les ${toImport.length - room} derniers sont ignorés.`);
        toImport = toImport.slice(0, room);
    }

    // Nouveaux ids + noms « _ext » (gestion des collisions).
    let nextId = existing.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const usedNames = new Set(existing.map(p => p.name));
    const readOnly = !!opts.readOnly;

    const newPfs = toImport.map(pf => {
        const base = `${pf.name || 'PF'}_ext`;
        let name = base;
        let n = 2;
        while (usedNames.has(name)) { name = `${base}${n++}`; }
        usedNames.add(name);
        const newId = nextId++;
        const clone = { ...pf, id: newId, name };
        if (readOnly) clone.readOnly = true; else delete clone.readOnly;
        return { source: pf, clone };
    });

    // Rapatriement des jeux de données trafic référencés par les PF importés.
    const trafficDatasets = { ...(current.trafficDatasets || {}) };
    const customNames = new Set(current.customTrafficDatasetNames || []);
    const pfTrafficDatasetMap = { ...(current.pfTrafficDatasetMap || {}) };
    newPfs.forEach(({ source, clone }) => {
        const dsName = imported.pfTrafficDatasetMap && imported.pfTrafficDatasetMap[source.id];
        if (!dsName) return;
        if (!(dsName in trafficDatasets)) {
            if (imported.trafficDatasets && dsName in imported.trafficDatasets) {
                trafficDatasets[dsName] = imported.trafficDatasets[dsName];
                if (!STANDARD_TRAFFIC_DATASETS.includes(dsName)) customNames.add(dsName);
            } else {
                return; // pas de données pour ce jeu : on n'associe rien
            }
        }
        pfTrafficDatasetMap[clone.id] = dsName;
    });

    const pfTabs = [...existing, ...newPfs.map(x => x.clone)];

    const state = {
        ...current,
        pfTabs,
        trafficDatasets,
        customTrafficDatasetNames: Array.from(customNames),
        pfTrafficDatasetMap
        // activePFId, groups, cycleLength, conflictMatrix : inchangés (on reste
        // sur le projet courant ; l'utilisateur navigue vers les PF _ext).
    };
    return { state, warnings, addedCount: newPfs.length };
};

/**
 * Copie profonde d'une matrice (tableau de tableaux). Utilisée pour copier la
 * matrice d'interverts d'un plan de feux à un autre sans partage de référence.
 */
export const deepCopyMatrix = (m) =>
    Array.isArray(m) ? m.map(row => (Array.isArray(row) ? [...row] : row)) : m;
