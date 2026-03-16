import { describe, it, expect } from 'vitest';
import { computeConflicts, moveGroup, rangesOverlap } from '../utils/conflictUtils';

// Helpers
const makeGroup = (id, offset, green, orange = 3) => ({
    id,
    offset,
    durations: { green, orange, red: 0 },
    phaseFlag: ''
});

const makeMatrix = (n, values) => {
    const m = Array.from({ length: n }, () => Array(n).fill(''));
    values.forEach(([from, to, val]) => { m[from][to] = val; });
    return m;
};

// ─────────────────────────────────────────
// rangesOverlap
// ─────────────────────────────────────────
describe('rangesOverlap', () => {
    it('détecte un chevauchement simple', () => {
        expect(rangesOverlap(0, 30, 20, 50, 90)).toBe(true);
    });

    it('ne détecte pas de chevauchement quand les phases sont séparées', () => {
        expect(rangesOverlap(0, 20, 25, 50, 90)).toBe(false);
    });

    it('gère le wrap autour du cycle', () => {
        // Phase A : 70→10 (wrap), Phase B : 5→15 → chevauchement
        expect(rangesOverlap(70, 10, 5, 15, 90)).toBe(true);
    });

    it('ne détecte pas de chevauchement avec wrap quand séparées', () => {
        // Phase A : 70→80, Phase B : 5→15 → pas de chevauchement
        expect(rangesOverlap(70, 80, 5, 15, 90)).toBe(false);
    });
});

// ─────────────────────────────────────────
// computeConflicts — intergreen
// ─────────────────────────────────────────
describe('computeConflicts — intergreen', () => {
    it('détecte un conflit intervert insuffisant', () => {
        // GF1 : offset=0 green=30 → fin vert = 30
        // GF2 : offset=33 → début vert = 33, écart = 3, requis = 5 → CONFLIT
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 33, 25)];
        const matrix = makeMatrix(2, [[0, 1, 5]]);
        const conflicts = computeConflicts(groups, matrix, 90);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]).toMatchObject({ from: 1, to: 2, required: 5, actual: 3, type: 'intergreen' });
    });

    it('ne signale pas de conflit quand le temps intervert est respecté', () => {
        // GF1 fin vert = 30, GF2 début = 36, écart = 6, requis = 5 → OK
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 36, 25)];
        const matrix = makeMatrix(2, [[0, 1, 5]]);
        const conflicts = computeConflicts(groups, matrix, 90);
        expect(conflicts).toHaveLength(0);
    });

    it('gère un écart qui wrape autour du cycle', () => {
        // Cycle = 90, GF1 fin vert = 85, GF2 début = 2, écart = (2 - 85 + 90) = 7, requis = 5 → OK
        const groups = [makeGroup(1, 55, 30), makeGroup(2, 2, 25)];
        const matrix = makeMatrix(2, [[0, 1, 5]]);
        const conflicts = computeConflicts(groups, matrix, 90);
        expect(conflicts).toHaveLength(0);
    });

    it('signale un conflit avec wrap insuffisant', () => {
        // GF1 fin vert = 88, GF2 début = 0, écart = (0 - 88 + 90) = 2, requis = 5 → CONFLIT
        const groups = [makeGroup(1, 58, 30), makeGroup(2, 0, 25)];
        const matrix = makeMatrix(2, [[0, 1, 5]]);
        const conflicts = computeConflicts(groups, matrix, 90);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]).toMatchObject({ type: 'intergreen', actual: 2, required: 5 });
    });
});

// ─────────────────────────────────────────
// computeConflicts — chevauchement
// ─────────────────────────────────────────
describe('computeConflicts — chevauchement de phases', () => {
    it('détecte un chevauchement de phases vertes', () => {
        // GF1 : 0→30, GF2 : 20→50 → chevauchement
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 20, 30)];
        const matrix = makeMatrix(2, [[0, 1, 5]]);
        const conflicts = computeConflicts(groups, matrix, 90);
        const overlap = conflicts.find(c => c.type === 'overlap');
        expect(overlap).toBeDefined();
    });

    it('ne détecte pas de chevauchement quand les phases ne se touchent pas', () => {
        const groups = [makeGroup(1, 0, 20), makeGroup(2, 25, 20)];
        const matrix = makeMatrix(2, [[0, 1, 5]]);
        const conflicts = computeConflicts(groups, matrix, 90);
        expect(conflicts.find(c => c.type === 'overlap')).toBeUndefined();
    });
});

// ─────────────────────────────────────────
// moveGroup
// ─────────────────────────────────────────
describe('moveGroup', () => {
    const groups = [
        makeGroup(1, 0, 20),
        makeGroup(2, 25, 20),
        makeGroup(3, 50, 20)
    ];

    it('déplace un groupe vers le bas et réassigne les ids', () => {
        const result = moveGroup(groups, 0, 2);
        expect(result.map(g => g.offset)).toEqual([25, 50, 0]);
        expect(result.map(g => g.id)).toEqual([1, 2, 3]);
    });

    it('déplace un groupe vers le haut et réassigne les ids', () => {
        const result = moveGroup(groups, 2, 0);
        expect(result.map(g => g.offset)).toEqual([50, 0, 25]);
        expect(result.map(g => g.id)).toEqual([1, 2, 3]);
    });

    it('conserve toutes les propriétés du groupe déplacé', () => {
        const result = moveGroup(groups, 0, 1);
        expect(result[1].durations.green).toBe(20);
        expect(result[1].durations.orange).toBe(3);
    });

    it('ne modifie pas le tableau original', () => {
        moveGroup(groups, 0, 2);
        expect(groups[0].id).toBe(1); // original inchangé
    });
});
