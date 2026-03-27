import { describe, it, expect } from 'vitest';
import { extractBusLines, parseIntergreenMatrix, extractMicroVariables } from './maestroImporter.js';

// Helper: encode a string as Uint8Array bytes with a null terminator
function strBytes(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    bytes.push(0); // null terminator
    return bytes;
}

// Helper: build a Uint8Array from an array of byte values
function makeData(byteArrays) {
    const flat = byteArrays.flat();
    return new Uint8Array(flat);
}

describe('extractBusLines', () => {
    it('finds "LIGNE 9 V4" and sets da="T" on matching group', () => {
        const groups = [
            { id: 1, name: 'V1', type: 'V' },
            { id: 2, name: 'V2', type: 'V' },
            { id: 3, name: 'V3', type: 'V' },
            { id: 4, name: 'V4', type: 'V' },
        ];
        const data = makeData([strBytes('LIGNE 9 V4')]);
        extractBusLines(data, groups);
        expect(groups[3].da).toBe('T');
        expect(groups[0].da).toBeUndefined();
    });

    it('does not overwrite existing da value', () => {
        const groups = [
            { id: 1, name: 'V4', type: 'V', da: 'X' },
        ];
        const data = makeData([strBytes('LIGNE 9 V4')]);
        extractBusLines(data, groups);
        expect(groups[0].da).toBe('X');
    });

    it('handles file with no LIGNE entries', () => {
        const groups = [
            { id: 1, name: 'V1', type: 'V' },
        ];
        const data = makeData([strBytes('some random data without bus lines')]);
        extractBusLines(data, groups);
        expect(groups[0].da).toBeUndefined();
    });
});

describe('parseIntergreenMatrix', () => {
    it('parses 4-byte entries [a][b][secAB][secBA] correctly', () => {
        // Two V groups: index 0 and 1
        const groups = [
            { id: 1, name: 'V1', type: 'V' },
            { id: 2, name: 'V2', type: 'V' },
        ];
        const conflictMatrix = [
            ['', ''],
            ['', ''],
        ];
        const warnings = [];
        // Build data with enough valid 4-byte entries to reach score >= 5
        // Each entry: [groupA, groupB, secAB, secBA]
        // We need 5 valid consecutive entries; use groups 0 and 1 alternating
        // But a===b is invalid, so we only have 0->1 and 1->0.
        // We need at least 5 entries, so use more groups.
        const groups5 = [
            { id: 1, name: 'V1', type: 'V' },
            { id: 2, name: 'V2', type: 'V' },
            { id: 3, name: 'P3', type: 'P' },
            { id: 4, name: 'V4', type: 'V' },
            { id: 5, name: 'V5', type: 'V' },
            { id: 6, name: 'V6', type: 'V' },
        ];
        const matrix5 = Array.from({ length: 6 }, () => Array(6).fill(''));
        const data = new Uint8Array([
            0, 1, 5, 4,  // group0->group1: sec=5, group1->group0: sec=4
            0, 2, 3, 2,  // group0->group2: sec=3, group2->group0: sec=2
            1, 2, 6, 7,  // group1->group2: sec=6, group2->group1: sec=7
            3, 4, 2, 3,  // group3->group4: sec=2, group4->group3: sec=3
            3, 5, 4, 1,  // group3->group5: sec=4, group5->group3: sec=1
        ]);
        parseIntergreenMatrix(data, 6, matrix5, groups5, {}, warnings);
        // V->V: +3, P->V: +0
        // group0(V)->group1(V): 5+3=8
        expect(matrix5[0][1]).toBe(8);
        // group1(V)->group0(V): 4+3=7
        expect(matrix5[1][0]).toBe(7);
        // group0(V)->group2(P): 3+3=6  (source is V)
        expect(matrix5[0][2]).toBe(6);
        // group2(P)->group0(V): 2+0=2  (source is P)
        expect(matrix5[2][0]).toBe(2);
    });

    it('adds 3 for V/B source groups, 0 for P groups', () => {
        const groups = [
            { id: 1, name: 'V1', type: 'V' },
            { id: 2, name: 'P2', type: 'P' },
            { id: 3, name: 'B3', type: 'B' },
            { id: 4, name: 'V4', type: 'V' },
            { id: 5, name: 'V5', type: 'V' },
            { id: 6, name: 'V6', type: 'V' },
        ];
        const matrix = Array.from({ length: 6 }, () => Array(6).fill(''));
        const warnings = [];
        const data = new Uint8Array([
            0, 1, 5, 4,  // V->P: 5+3=8, P->V: 4+0=4
            0, 2, 3, 2,  // V->B: 3+3=6, B->V: 2+3=5
            1, 2, 6, 7,  // P->B: 6+0=6, B->P: 7+3=10
            3, 4, 2, 3,
            3, 5, 4, 1,
        ]);
        parseIntergreenMatrix(data, 6, matrix, groups, {}, warnings);
        // V1(V)->P2(P): secAB=5, +3 (source V) = 8
        expect(matrix[0][1]).toBe(8);
        // P2(P)->V1(V): secBA=4, +0 (source P) = 4
        expect(matrix[1][0]).toBe(4);
        // B3(B)->V1(V): secBA=2, +3 (source B) = 5
        expect(matrix[2][0]).toBe(5);
    });

    it('handles empty data with no valid entries found', () => {
        const groups = [
            { id: 1, name: 'V1', type: 'V' },
            { id: 2, name: 'V2', type: 'V' },
        ];
        const matrix = [['', ''], ['', '']];
        const warnings = [];
        // Data with no valid matrix entries (all zeros or invalid)
        const data = new Uint8Array([0, 0, 0, 0, 255, 255, 255, 255]);
        parseIntergreenMatrix(data, 2, matrix, groups, {}, warnings);
        expect(warnings).toContain('Matrice non trouvée');
        expect(matrix[0][1]).toBe('');
    });
});

describe('extractMicroVariables', () => {
    it('extracts boucle, CLIGNO, TMAB, DA, Priorite entries', () => {
        const variables = [];
        const actionDescriptions = [];
        const data = makeData([
            strBytes('boucle B1'),
            strBytes('CLIGNO phase 2'),
            strBytes('TMAB V1-V3'),
            strBytes('DA avant vert GF5'),
            strBytes('Priorite bus'),
        ]);
        extractMicroVariables(data, variables, actionDescriptions);
        expect(variables.some(v => v.includes('boucle B1'))).toBe(true);
        expect(variables.some(v => v.includes('CLIGNO phase 2'))).toBe(true);
        expect(variables.some(v => v.includes('TMAB V1-V3'))).toBe(true);
        expect(variables.some(v => v.includes('avant vert GF5'))).toBe(true);
        expect(variables.some(v => v.includes('Priorite bus'))).toBe(true);
        expect(actionDescriptions.length).toBe(0);
    });

    it('separates Adaptatif vertical and Point repos into actionDescriptions', () => {
        const variables = [];
        const actionDescriptions = [];
        const data = makeData([
            strBytes('Adaptatif vertical GF3'),
            strBytes('Point repos phase 1'),
        ]);
        extractMicroVariables(data, variables, actionDescriptions);
        expect(actionDescriptions.length).toBe(2);
        expect(actionDescriptions[0].action).toBe('Adaptatif vertical');
        expect(actionDescriptions[0].description).toBe('Adaptatif vertical GF3');
        expect(actionDescriptions[1].action).toBe('Point de repos');
        expect(actionDescriptions[1].description).toBe('Point repos phase 1');
    });

    it('handles data with no relevant strings', () => {
        const variables = [];
        const actionDescriptions = [];
        // Only short strings that won't match anything
        const data = new Uint8Array([65, 66, 0, 67, 68, 0, 69, 70, 0]);
        extractMicroVariables(data, variables, actionDescriptions);
        expect(variables.length).toBe(0);
        expect(actionDescriptions.length).toBe(0);
    });
});
