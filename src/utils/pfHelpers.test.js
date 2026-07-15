import { describe, it, expect } from 'vitest';
import {
    DEFAULT_CYCLE,
    createEmptyActionRow,
    createEmptyActionData,
    buildDiagramFromGroups,
    buildEmptyMatrix,
    createEmptyPF,
    ensurePFIntegrity,
    selectPfSubset,
    mergePfFromProject
} from './pfHelpers';

describe('createEmptyActionRow', () => {
    it('creates a row with the given id and empty fields', () => {
        const row = createEmptyActionRow(5);
        expect(row.id).toBe(5);
        expect(row.gf).toBe('');
        expect(row.action).toBe('');
        expect(row.deb).toBe('');
        expect(row.fin).toBe('');
    });

    it('has all expected fields', () => {
        const row = createEmptyActionRow(1);
        const expectedFields = ['id', 'gf', 'action', 'description', 'deb', 'fin',
            'abrv', 'micro', 'plage1', 'plage2', 'actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'];
        expectedFields.forEach(f => expect(row).toHaveProperty(f));
    });
});

describe('createEmptyActionData', () => {
    it('creates 30 rows', () => {
        expect(createEmptyActionData()).toHaveLength(30);
    });

    it('assigns sequential ids from 1 to 30', () => {
        const data = createEmptyActionData();
        expect(data[0].id).toBe(1);
        expect(data[29].id).toBe(30);
    });
});

describe('buildDiagramFromGroups', () => {
    it('returns empty array for non-array input', () => {
        expect(buildDiagramFromGroups(null)).toEqual([]);
        expect(buildDiagramFromGroups(undefined)).toEqual([]);
        expect(buildDiagramFromGroups('not an array')).toEqual([]);
    });

    it('returns empty array for empty input', () => {
        expect(buildDiagramFromGroups([])).toEqual([]);
    });

    it('builds diagram entries from groups', () => {
        const groups = [
            { id: 1, offset: 10, durations: { green: 20 }, da: 'DA1', comment: 'c', commentColor: '#fff', phaseFlag: 'A' },
            { id: 2, offset: 30, durations: { green: 15 } }
        ];
        const diagram = buildDiagramFromGroups(groups);
        expect(diagram).toHaveLength(2);
        expect(diagram[0]).toEqual({
            groupId: 1,
            offset: 10,
            greenDuration: 20,
            da: 'DA1',
            comment: 'c',
            commentColor: '#fff',
            phaseFlag: 'A'
        });
        expect(diagram[1].groupId).toBe(2);
        expect(diagram[1].offset).toBe(30);
        expect(diagram[1].greenDuration).toBe(15);
        expect(diagram[1].da).toBe('');
        expect(diagram[1].comment).toBe('');
    });

    it('uses 0 for missing offset', () => {
        const diagram = buildDiagramFromGroups([{ id: 1, durations: { green: 10 } }]);
        expect(diagram[0].offset).toBe(0);
    });

    it('uses 10 for missing greenDuration', () => {
        const diagram = buildDiagramFromGroups([{ id: 1, offset: 5 }]);
        expect(diagram[0].greenDuration).toBe(10);
    });

    it('uses 0 for NaN offset', () => {
        const diagram = buildDiagramFromGroups([{ id: 1, offset: NaN, durations: { green: 10 } }]);
        expect(diagram[0].offset).toBe(0);
    });
});

describe('buildEmptyMatrix', () => {
    it('builds a 0x0 matrix for 0', () => {
        expect(buildEmptyMatrix(0)).toEqual([]);
    });

    it('builds a 3x3 matrix', () => {
        const m = buildEmptyMatrix(3);
        expect(m).toHaveLength(3);
        expect(m[0]).toEqual(['', '', '']);
        expect(m[2]).toEqual(['', '', '']);
    });

    it('handles negative or undefined input', () => {
        expect(buildEmptyMatrix(-1)).toEqual([]);
        expect(buildEmptyMatrix(undefined)).toEqual([]);
        expect(buildEmptyMatrix(null)).toEqual([]);
    });
});

describe('createEmptyPF', () => {
    it('creates a PF with default values', () => {
        const pf = createEmptyPF();
        expect(pf.id).toBe(1);
        expect(pf.name).toBe('PF1');
        expect(pf.data).toHaveLength(30);
        expect(pf.diagram).toEqual([]);
        expect(pf.cycleLength).toBe(DEFAULT_CYCLE);
        expect(pf.microCustomFields).toEqual([]);
        expect(pf.conflictMatrix).toEqual([]);
        expect(pf.remarques).toBe('');
    });

    it('uses provided id and name', () => {
        const pf = createEmptyPF({ id: 5, name: 'Custom' });
        expect(pf.id).toBe(5);
        expect(pf.name).toBe('Custom');
    });

    it('derives name from id if not provided', () => {
        const pf = createEmptyPF({ id: 3 });
        expect(pf.name).toBe('PF3');
    });

    it('builds diagram from sourceGroups if provided', () => {
        const groups = [
            { id: 1, offset: 0, durations: { green: 10 } },
            { id: 2, offset: 20, durations: { green: 15 } }
        ];
        const pf = createEmptyPF({ sourceGroups: groups });
        expect(pf.diagram).toHaveLength(2);
        expect(pf.conflictMatrix).toHaveLength(2);
    });

    it('uses provided conflictMatrix over sourceGroups count', () => {
        const providedMatrix = [['', ''], ['', '']];
        const pf = createEmptyPF({ conflictMatrix: providedMatrix, groupCount: 2 });
        expect(pf.conflictMatrix).toBe(providedMatrix);
    });

    it('uses provided data over createEmptyActionData', () => {
        const customData = [{ id: 1, gf: 'custom' }];
        const pf = createEmptyPF({ data: customData });
        expect(pf.data).toBe(customData);
    });

    it('GUARANTEES all expected fields are present', () => {
        const pf = createEmptyPF();
        const required = ['id', 'name', 'data', 'diagram', 'cycleLength', 'microCustomFields', 'conflictMatrix', 'remarques'];
        required.forEach(f => expect(pf).toHaveProperty(f));
    });
});

describe('ensurePFIntegrity', () => {
    it('returns empty array for non-array input', () => {
        expect(ensurePFIntegrity(null)).toEqual([]);
        expect(ensurePFIntegrity(undefined)).toEqual([]);
    });

    it('fills missing fields with defaults', () => {
        const incomplete = [{ id: 1, name: 'PF1' }];
        const result = ensurePFIntegrity(incomplete, [], []);
        expect(result[0].data).toHaveLength(30);
        expect(result[0].diagram).toEqual([]);
        expect(result[0].cycleLength).toBe(DEFAULT_CYCLE);
        expect(result[0].microCustomFields).toEqual([]);
        expect(result[0].remarques).toBe('');
    });

    it('preserves existing valid fields', () => {
        const complete = [{
            id: 2,
            name: 'Special',
            data: [{ id: 1, action: 'test' }],
            diagram: [{ groupId: 1, offset: 5, greenDuration: 15 }],
            cycleLength: 90,
            microCustomFields: ['a', 'b'],
            conflictMatrix: [['', '3'], ['3', '']],
            remarques: 'hello'
        }];
        const result = ensurePFIntegrity(complete, [], []);
        expect(result[0].id).toBe(2);
        expect(result[0].name).toBe('Special');
        expect(result[0].data).toEqual(complete[0].data);
        expect(result[0].cycleLength).toBe(90);
        expect(result[0].microCustomFields).toEqual(['a', 'b']);
        expect(result[0].remarques).toBe('hello');
    });

    it('uses fallbackGroups to build diagram when missing', () => {
        const groups = [{ id: 1, offset: 0, durations: { green: 10 } }];
        const pfs = [{ id: 1 }];
        const result = ensurePFIntegrity(pfs, groups, []);
        expect(result[0].diagram).toHaveLength(1);
        expect(result[0].diagram[0].groupId).toBe(1);
    });

    it('uses fallbackMatrix when pf.conflictMatrix is missing', () => {
        const fallbackMatrix = [['', '3'], ['3', '']];
        const pfs = [{ id: 1 }];
        const result = ensurePFIntegrity(pfs, [{ id: 1, durations: { green: 10 } }, { id: 2, durations: { green: 10 } }], fallbackMatrix);
        expect(result[0].conflictMatrix).toEqual(fallbackMatrix);
    });

    it('clones fallbackMatrix (no reference sharing)', () => {
        const fallbackMatrix = [['', '3']];
        const pfs = [{ id: 1 }];
        const result = ensurePFIntegrity(pfs, [{ id: 1, durations: { green: 10 } }], fallbackMatrix);
        expect(result[0].conflictMatrix).not.toBe(fallbackMatrix);
        expect(result[0].conflictMatrix[0]).not.toBe(fallbackMatrix[0]);
    });

    it('is idempotent (applied twice gives same result)', () => {
        const groups = [{ id: 1, offset: 0, durations: { green: 10 } }];
        const once = ensurePFIntegrity([{ id: 1 }], groups, []);
        const twice = ensurePFIntegrity(once, groups, []);
        expect(twice).toEqual(once);
    });

    it('filters out null/undefined entries', () => {
        const result = ensurePFIntegrity([null, { id: 1 }, undefined], [], []);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
    });

    it('preserves optional color field', () => {
        const pfs = [{ id: 1, color: 'red' }];
        const result = ensurePFIntegrity(pfs, [], []);
        expect(result[0].color).toBe('red');
    });

    it('normalizes invalid offset/greenDuration in existing diagrams', () => {
        const pfs = [{
            id: 1,
            diagram: [
                { groupId: 1, offset: NaN, greenDuration: undefined, da: 'X' }
            ]
        }];
        const result = ensurePFIntegrity(pfs, [], []);
        expect(result[0].diagram[0].offset).toBe(0);
        expect(result[0].diagram[0].greenDuration).toBe(10);
        expect(result[0].diagram[0].da).toBe('X'); // other fields preserved
    });
});

describe('selectPfSubset', () => {
    // État complet minimal, façon getFullState : 3 PF, chacun avec sa matrice
    // et son cycle ; données partagées (groups) + mappings référençant des ids.
    const fullState = () => ({
        projectName: 'Projet',
        // groups top-level = géométrie du PF actif (id 3), comme getFullState.
        groups: [
            { id: 1, offset: 30, durations: { green: 20 } },
            { id: 2, offset: 50, durations: { green: 10 } }
        ],
        cycleLength: 90,                       // miroir du PF actif (id 3)
        conflictMatrix: [[3]],                 // miroir du PF actif
        activePFId: 3,
        pfTabs: [
            { id: 1, name: 'Matin', cycleLength: 60, conflictMatrix: [[1]], diagram: [
                { groupId: 1, offset: 0, greenDuration: 40 },
                { groupId: 2, offset: 40, greenDuration: 15 }
            ] },
            { id: 2, name: 'Soir', cycleLength: 70, conflictMatrix: [[2]], diagram: [] },
            { id: 3, name: 'Nuit', cycleLength: 90, conflictMatrix: [[3]], diagram: [
                { groupId: 1, offset: 30, greenDuration: 20 },
                { groupId: 2, offset: 50, greenDuration: 10 }
            ] }
        ],
        pfTrafficDatasetMap: { 1: 'HPM', 2: 'HPS', 3: 'HC', 9: 'orphelin' },
        capacityCompareSelection: [1, 3],
        trafficDatasets: { HPM: {} }
    });

    it('ne conserve que les PF sélectionnés', () => {
        const out = selectPfSubset(fullState(), [1, 2]);
        expect(out.pfTabs.map(p => p.id)).toEqual([1, 2]);
    });

    it('ne modifie pas l\'état source (fonction pure)', () => {
        const s = fullState();
        selectPfSubset(s, [1]);
        expect(s.pfTabs).toHaveLength(3);
    });

    it('recale l\'actif et le miroir top-level si le PF actif est exclu', () => {
        const out = selectPfSubset(fullState(), [1, 2]); // actif 3 exclu
        expect(out.activePFId).toBe(1);
        expect(out.cycleLength).toBe(60);          // cycle du nouveau PF actif
        expect(out.conflictMatrix).toEqual([[1]]); // matrice du nouveau PF actif
    });

    it('conserve l\'actif s\'il est dans la sélection', () => {
        const out = selectPfSubset(fullState(), [2, 3]);
        expect(out.activePFId).toBe(3);
        expect(out.cycleLength).toBe(90);
    });

    it('réduit pfTrafficDatasetMap aux PF conservés et nettoie les orphelins', () => {
        const out = selectPfSubset(fullState(), [1, 2]);
        expect(out.pfTrafficDatasetMap).toEqual({ 1: 'HPM', 2: 'HPS' });
    });

    it('filtre capacityCompareSelection aux PF conservés', () => {
        expect(selectPfSubset(fullState(), [1, 2]).capacityCompareSelection).toEqual([1]);
        expect(selectPfSubset(fullState(), [2]).capacityCompareSelection).toBeNull();
    });

    it('conserve les données partagées (groupes, jeux de trafic)', () => {
        const out = selectPfSubset(fullState(), [1]);
        expect(out.groups).toHaveLength(2);
        expect(out.trafficDatasets).toEqual({ HPM: {} });
    });

    it('renvoie null si la sélection est vide ou invalide', () => {
        expect(selectPfSubset(fullState(), [])).toBeNull();
        expect(selectPfSubset(fullState(), [999])).toBeNull();
        expect(selectPfSubset(null, [1])).toBeNull();
    });

    // Régression : sans réalignement, l'état exporté est incohérent (groupes de
    // l'ancien PF actif + nouvel activePFId) et le rechargement corrompt le
    // diagramme du 1er PF (verts faussés, « fermeture anticipée » décalée).
    it('réaligne les groupes sur le diagramme du PF actif retenu quand l\'actif change', () => {
        const out = selectPfSubset(fullState(), [1, 2]); // exclut l'actif d'origine (3)
        expect(out.activePFId).toBe(1);
        expect(out.groups[0].offset).toBe(0);          // diagramme de PF1
        expect(out.groups[0].durations.green).toBe(40);
        expect(out.groups[1].offset).toBe(40);
        expect(out.groups[1].durations.green).toBe(15);
    });

    it('laisse les groupes inchangés si le PF actif est conservé', () => {
        const out = selectPfSubset(fullState(), [2, 3]); // actif (3) conservé
        expect(out.activePFId).toBe(3);
        expect(out.groups[0].offset).toBe(30);          // géométrie de PF3 (inchangée)
        expect(out.groups[0].durations.green).toBe(20);
    });
});

describe('mergePfFromProject', () => {
    const current = () => ({
        projectName: 'Courant',
        groups: [{ id: 1 }, { id: 2 }, { id: 3 }],
        activePFId: 1,
        pfTabs: [
            { id: 1, name: 'PF1', data: [], diagram: [], cycleLength: 60 },
            { id: 2, name: 'PF2', data: [], diagram: [], cycleLength: 70 }
        ],
        trafficDatasets: { HPM: { 1: { trafficVol: 100 } } },
        customTrafficDatasetNames: [],
        pfTrafficDatasetMap: { 1: 'HPM' }
    });
    const imported = () => ({
        projectName: 'Tiers',
        groups: [{ id: 1 }, { id: 2 }, { id: 3 }],
        activePFId: 5,
        pfTabs: [
            { id: 5, name: 'PF1', data: [], diagram: [], cycleLength: 80 },
            { id: 6, name: 'Nuit', data: [], diagram: [], cycleLength: 90 }
        ],
        trafficDatasets: { HPM: { 1: { trafficVol: 200 } }, 'Scénario X': { 1: { trafficVol: 50 } } },
        customTrafficDatasetNames: ['Scénario X'],
        pfTrafficDatasetMap: { 5: 'HPM', 6: 'Scénario X' }
    });

    it('ajoute les PF importés à la suite, renommés « _ext » avec de nouveaux ids', () => {
        const { state, addedCount, error } = mergePfFromProject(current(), imported());
        expect(error).toBeUndefined();
        expect(addedCount).toBe(2);
        expect(state.pfTabs.map(p => p.name)).toEqual(['PF1', 'PF2', 'PF1_ext', 'Nuit_ext']);
        expect(state.pfTabs.map(p => p.id)).toEqual([1, 2, 3, 4]); // ids uniques
    });

    it('gère les collisions de noms « _ext »', () => {
        const cur = current();
        cur.pfTabs.push({ id: 3, name: 'PF1_ext', data: [], diagram: [], cycleLength: 60 });
        const { state } = mergePfFromProject(cur, imported());
        const names = state.pfTabs.map(p => p.name);
        expect(names).toContain('PF1_ext2'); // évite la collision
    });

    it('lecture seule par PF selon l\'option (uniquement sur les PF importés)', () => {
        const { state } = mergePfFromProject(current(), imported(), { readOnly: true });
        expect(state.pfTabs[0].readOnly).toBeUndefined(); // PF du projet courant
        expect(state.pfTabs[2].readOnly).toBe(true);      // PF importé
        expect(state.pfTabs[3].readOnly).toBe(true);
        const editable = mergePfFromProject(current(), imported(), { readOnly: false });
        expect(editable.state.pfTabs[2].readOnly).toBeUndefined();
    });

    it('rapatrie les jeux de trafic manquants et réutilise ceux qui existent', () => {
        const { state } = mergePfFromProject(current(), imported());
        // « HPM » existe déjà -> conservé (pas écrasé) ; « Scénario X » -> ajouté
        expect(state.trafficDatasets.HPM).toEqual({ 1: { trafficVol: 100 } });
        expect(state.trafficDatasets['Scénario X']).toEqual({ 1: { trafficVol: 50 } });
        expect(state.customTrafficDatasetNames).toContain('Scénario X');
        // mapping des nouveaux PF
        expect(state.pfTrafficDatasetMap[3]).toBe('HPM');
        expect(state.pfTrafficDatasetMap[4]).toBe('Scénario X');
    });

    it('BLOQUE si les groupes sont incompatibles', () => {
        const imp = imported();
        imp.groups = [{ id: 1 }, { id: 2 }]; // 2 au lieu de 3
        const res = mergePfFromProject(current(), imp);
        expect(res.state).toBeUndefined();
        expect(res.error).toMatch(/incompatibles/i);
    });

    it('respecte la limite MAX_PF (troncature + avertissement)', () => {
        const cur = current();
        // Remplir jusqu'à 15 - 1 = 14 PF pour ne laisser qu'une place
        cur.pfTabs = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, name: `PF${i + 1}`, data: [], diagram: [], cycleLength: 60 }));
        const { state, addedCount, warnings } = mergePfFromProject(cur, imported());
        expect(addedCount).toBe(1);           // une seule place
        expect(state.pfTabs).toHaveLength(15);
        expect(warnings.some(w => /limite/i.test(w))).toBe(true);
    });

    it('ne modifie pas les entrées (fonction pure)', () => {
        const cur = current();
        mergePfFromProject(cur, imported(), { readOnly: true });
        expect(cur.pfTabs).toHaveLength(2);
    });

    it('erreur si le fichier importé n\'a aucun PF', () => {
        expect(mergePfFromProject(current(), { pfTabs: [] }).error).toBeTruthy();
        expect(mergePfFromProject(current(), null).error).toBeTruthy();
    });
});
