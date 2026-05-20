import { describe, it, expect } from 'vitest';
import { compareWithPF1, buildCellTooltipLines } from './matrixComparison';

describe('compareWithPF1', () => {
    it('renvoie null quand refMatrix est null', () => {
        expect(compareWithPF1(0, 1, 5, null)).toBe(null);
    });

    it('renvoie null quand refMatrix est un tableau vide', () => {
        expect(compareWithPF1(0, 1, 5, [])).toBe(null);
    });

    it('renvoie null sur la diagonale (fromIdx === toIdx)', () => {
        expect(compareWithPF1(2, 2, 5, [[0,1,0],[1,0,0],[0,0,0]])).toBe(null);
    });

    it("renvoie null quand current et ref sont tous les deux 0 (ou ''/null/undefined)", () => {
        const ref = [[0, ''], ['', 0]];
        expect(compareWithPF1(0, 1, '', ref)).toBe(null);
        expect(compareWithPF1(0, 1, 0, ref)).toBe(null);
        expect(compareWithPF1(0, 1, null, ref)).toBe(null);
        expect(compareWithPF1(0, 1, undefined, ref)).toBe(null);
    });

    it("renvoie 'higher' quand current > ref", () => {
        const ref = [[0, 5], [5, 0]];
        expect(compareWithPF1(0, 1, 8, ref)).toBe('higher');
    });

    it("renvoie 'lower' quand current < ref", () => {
        const ref = [[0, 5], [5, 0]];
        expect(compareWithPF1(0, 1, 3, ref)).toBe('lower');
    });

    it('renvoie null quand current === ref', () => {
        const ref = [[0, 5], [5, 0]];
        expect(compareWithPF1(0, 1, 5, ref)).toBe(null);
    });

    it("detecte un AJOUT (refMatrix vide a cette case, current renseignee) comme 'higher'", () => {
        const ref = [[0, ''], ['', 0]];
        expect(compareWithPF1(0, 1, 3, ref)).toBe('higher');
    });

    it("detecte une SUPPRESSION (refMatrix renseignee, current vide) comme 'lower'", () => {
        const ref = [[0, 5], [5, 0]];
        expect(compareWithPF1(0, 1, '', ref)).toBe('lower');
    });

    it('convertit les chaines numeriques en entiers pour la comparaison', () => {
        const ref = [[0, '3'], ['3', 0]];
        expect(compareWithPF1(0, 1, '5', ref)).toBe('higher');
        expect(compareWithPF1(0, 1, '3', ref)).toBe(null);
    });
});

describe('buildCellTooltipLines', () => {
    // Helpers : un projet "calme" sans conflit ni recouvrement.
    const noConflict = {
        isDelayInsufficient: () => false,
        hasOverlap: () => false,
        computeActualDelay: () => 0
    };

    it('renvoie [] sur la diagonale', () => {
        expect(buildCellTooltipLines({
            fromIdx: 1, toIdx: 1,
            conflictMatrix: [[0,5],[5,0]],
            refMatrix: null,
            groups: [{id:1},{id:2}],
            ...noConflict
        })).toEqual([]);
    });

    it("renvoie [] quand il n'y a ni ecart ni conflit", () => {
        expect(buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,5],[5,0]],
            refMatrix: [[0,5],[5,0]],
            groups: [{id:1},{id:2}],
            ...noConflict
        })).toEqual([]);
    });

    it("genere une ligne 'Augmentee' quand current > ref", () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,8],[8,0]],
            refMatrix: [[0,5],[5,0]],
            groups: [{id:1},{id:2}],
            ...noConflict
        });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('Augmentée de 3 s');
        expect(lines[0]).toContain('5 s → 8 s');
    });

    it("genere une ligne 'Reduite' quand current < ref", () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,3],[3,0]],
            refMatrix: [[0,5],[5,0]],
            groups: [{id:1},{id:2}],
            ...noConflict
        });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('Réduite de 2 s');
        expect(lines[0]).toContain('5 s → 3 s');
    });

    it('libelle un AJOUT avec « — → X s »', () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,5],[5,0]],
            refMatrix: [[0,''],['',0]],
            groups: [{id:1},{id:2}],
            ...noConflict
        });
        expect(lines[0]).toContain('— → 5 s');
    });

    it('libelle une SUPPRESSION avec « X s → — »', () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,''],['',0]],
            refMatrix: [[0,5],[5,0]],
            groups: [{id:1},{id:2}],
            ...noConflict
        });
        expect(lines[0]).toContain('5 s → —');
    });

    it("genere une ligne de RECOUVREMENT quand hasOverlap est vrai", () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,5],[5,0]],
            refMatrix: null,
            groups: [{id:1},{id:2}],
            isDelayInsufficient: () => true,
            hasOverlap: () => true,
            computeActualDelay: () => 0
        });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('GF1');
        expect(lines[0]).toContain('GF2');
        expect(lines[0]).toContain('se recouvrent');
    });

    it("genere une ligne d'INTERVERT INSUFFISANT quand delai reel < demande", () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,8],[8,0]],
            refMatrix: null,
            groups: [{id:1},{id:2}],
            isDelayInsufficient: () => true,
            hasOverlap: () => false,
            computeActualDelay: () => 5
        });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('intervert demandé 8 s');
        expect(lines[0]).toContain('délai réel 5 s');
        expect(lines[0]).toContain('GF1');
        expect(lines[0]).toContain('GF2');
    });

    it('ecart + conflit -> 2 lignes dans l\'ordre (ecart, puis conflit)', () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,8],[8,0]],
            refMatrix: [[0,5],[5,0]],
            groups: [{id:1},{id:2}],
            isDelayInsufficient: () => true,
            hasOverlap: () => false,
            computeActualDelay: () => 5
        });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('Augmentée');
        expect(lines[1]).toContain('intervert demandé');
    });

    it('utilise groups[i].id pour le libelle GFn (cas reorganisation)', () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,5],[5,0]],
            refMatrix: null,
            groups: [{id:7},{id:3}],
            isDelayInsufficient: () => true,
            hasOverlap: () => true,
            computeActualDelay: () => 0
        });
        expect(lines[0]).toContain('GF7');
        expect(lines[0]).toContain('GF3');
    });

    it('repli sur index+1 si groups[i].id est absent', () => {
        const lines = buildCellTooltipLines({
            fromIdx: 0, toIdx: 1,
            conflictMatrix: [[0,5],[5,0]],
            refMatrix: null,
            groups: [{},{}],
            isDelayInsufficient: () => true,
            hasOverlap: () => true,
            computeActualDelay: () => 0
        });
        expect(lines[0]).toContain('GF1');
        expect(lines[0]).toContain('GF2');
    });
});
