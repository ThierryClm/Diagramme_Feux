import { describe, it, expect } from 'vitest';
import {
    DEFAULT_CYCLE,
    createEmptyActionRow,
    createEmptyActionData,
    buildDiagramFromGroups,
    buildEmptyMatrix,
    createEmptyPF,
    ensurePFIntegrity
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
