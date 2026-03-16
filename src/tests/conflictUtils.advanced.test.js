import { describe, it, expect } from 'vitest';
import { computeConflicts, moveGroup, remapMatrix, validateGroupTiming } from '../utils/conflictUtils';

// Helpers
const makeGroup = (id, offset, green, orange = 3, minGreen = 6) => ({
    id, offset, durations: { green, orange, red: 0 }, minGreen, phaseFlag: ''
});
const makeMatrix = (n, values) => {
    const m = Array.from({ length: n }, () => Array(n).fill(''));
    values.forEach(([from, to, val]) => { m[from][to] = val; });
    return m;
};

// ─────────────────────────────────────────
// computeConflicts — cas avancés
// ─────────────────────────────────────────
describe('computeConflicts — seconde lucarne', () => {
    it('détecte un chevauchement seconde lucarne / phase verte antagoniste', () => {
        // GF1 vert : 0→30, GF2 vert : 50→70
        // Seconde lucarne GF1 : 55→65 → chevauche GF2 vert
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 50, 20)];
        const matrix = makeMatrix(2, [[0, 1, 5], [1, 0, 5]]);
        const actionData = [
            { action: 'Seconde lucarne', gf: '1', deb: '55', fin: '65' }
        ];
        const conflicts = computeConflicts(groups, matrix, 90, actionData);
        const slConflict = conflicts.find(c => c.type === 'sl-overlap');
        expect(slConflict).toBeDefined();
        expect(slConflict).toMatchObject({ from: 1, to: 2 });
    });

    it('ne signale pas de SL si elle ne chevauche pas le vert antagoniste', () => {
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 50, 20)];
        const matrix = makeMatrix(2, [[0, 1, 5], [1, 0, 5]]);
        const actionData = [
            { action: 'Seconde lucarne', gf: '1', deb: '75', fin: '85' }
        ];
        const conflicts = computeConflicts(groups, matrix, 90, actionData);
        expect(conflicts.find(c => c.type === 'sl-overlap')).toBeUndefined();
    });
});

describe('computeConflicts — escamotage', () => {
    it("neutralise un conflit de chevauchement si un escamotage existe", () => {
        // GF1 : 0→30, GF2 : 20→50 → chevauchement normalement
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 20, 30)];
        const matrix = makeMatrix(2, [[0, 1, 5], [1, 0, 5]]);
        const actionData = [
            { action: 'Escamotage', gf: '1', actGf1: '2' }
        ];
        const conflicts = computeConflicts(groups, matrix, 90, actionData);
        expect(conflicts.find(c => c.type === 'overlap')).toBeUndefined();
    });

    it("n'affecte pas les conflits intervert (escamotage neutralise uniquement overlap)", () => {
        // GF1 fin vert = 30, GF2 début = 33, requis = 5 → conflit intervert même avec escamotage
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 33, 25)];
        const matrix = makeMatrix(2, [[0, 1, 5]]);
        const actionData = [
            { action: 'Escamotage', gf: '1', actGf1: '2' }
        ];
        const conflicts = computeConflicts(groups, matrix, 90, actionData);
        expect(conflicts.find(c => c.type === 'intergreen')).toBeDefined();
    });
});

describe("computeConflicts — flèche d'anticipation", () => {
    it("utilise les timings de la flèche d'anticipation plutôt que le vert normal", () => {
        // GF1 vert normal : 0→30 (fin=30), mais flèche anticipation fin=20
        // GF2 début = 24, écart réel depuis flèche = 4, requis = 5 → CONFLIT
        // Sans flèche : écart depuis fin vert = 30→24 = (24-30+90)=84 → pas de conflit
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 24, 25)];
        const matrix = makeMatrix(2, [[0, 1, 5]]);
        const actionData = [
            { action: "Flèche d'anticipation", gf: '1', deb: '5', fin: '20' }
        ];
        const conflicts = computeConflicts(groups, matrix, 90, actionData);
        expect(conflicts.find(c => c.type === 'intergreen')).toBeDefined();
    });
});

describe('computeConflicts — cas limites', () => {
    it('retourne une liste vide si la matrice est vide', () => {
        const groups = [makeGroup(1, 0, 30), makeGroup(2, 40, 25)];
        const matrix = makeMatrix(2, []);
        expect(computeConflicts(groups, matrix, 90)).toHaveLength(0);
    });

    it('retourne une liste vide avec un seul groupe', () => {
        const groups = [makeGroup(1, 0, 30)];
        const matrix = [['']];
        expect(computeConflicts(groups, matrix, 90)).toHaveLength(0);
    });

    it('ignore les entrées diagonales (groupe contre lui-même)', () => {
        const groups = [makeGroup(1, 0, 30)];
        const matrix = [[5]]; // diagonale non vide
        expect(computeConflicts(groups, matrix, 90)).toHaveLength(0);
    });
});

// ─────────────────────────────────────────
// moveGroup — cas limites
// ─────────────────────────────────────────
describe('moveGroup — cas limites', () => {
    const groups = [makeGroup(1, 0, 20), makeGroup(2, 25, 20), makeGroup(3, 50, 20)];

    it('déplace le premier vers le dernier', () => {
        const result = moveGroup(groups, 0, 2);
        expect(result.map(g => g.offset)).toEqual([25, 50, 0]);
        expect(result.map(g => g.id)).toEqual([1, 2, 3]);
    });

    it('déplace le dernier vers le premier', () => {
        const result = moveGroup(groups, 2, 0);
        expect(result.map(g => g.offset)).toEqual([50, 0, 25]);
        expect(result.map(g => g.id)).toEqual([1, 2, 3]);
    });

    it('retourne le tableau identique si déplacement sur soi-même', () => {
        const result = moveGroup(groups, 1, 1);
        expect(result.map(g => g.offset)).toEqual([0, 25, 50]);
    });

    it('fonctionne avec un seul groupe', () => {
        const single = [makeGroup(1, 0, 30)];
        const result = moveGroup(single, 0, 0);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
    });
});

// ─────────────────────────────────────────
// remapMatrix — matrice après déplacement
// ─────────────────────────────────────────
describe('remapMatrix', () => {
    // Matrice 3x3 :
    //        GF1  GF2  GF3
    // GF1  [  '',  5,   3  ]
    // GF2  [  4,  '',   6  ]
    // GF3  [  3,   3,  ''  ]
    const groups = [makeGroup(1, 0, 20), makeGroup(2, 25, 20), makeGroup(3, 50, 20)];
    const matrix = [
        ['', 5, 3],
        [4, '', 6],
        [3, 3, '']
    ];

    it('préserve les valeurs après déplacement GF1 → position 3', () => {
        // Avant : GF1→GF2=5, GF1→GF3=3, GF2→GF1=4, GF2→GF3=6, GF3→GF1=3, GF3→GF2=3
        // Après déplacement GF1 en position 3 : ordre devient GF2, GF3, GF1
        // Nouvelle matrice[0][1] = ancien GF2→GF3 = 6
        // Nouvelle matrice[0][2] = ancien GF2→GF1 = 4
        // Nouvelle matrice[2][0] = ancien GF1→GF2 = 5
        const result = remapMatrix(matrix, groups, 0, 2);
        expect(result[0][1]).toBe(6);  // GF2→GF3
        expect(result[0][2]).toBe(4);  // GF2→GF1
        expect(result[2][0]).toBe(5);  // GF1→GF2 (maintenant pos 3→pos 1)
    });

    it('préserve les valeurs après déplacement GF3 → position 1', () => {
        // Ordre devient GF3, GF1, GF2
        // Nouvelle matrice[0][1] = ancien GF3→GF1 = 3
        // Nouvelle matrice[1][0] = ancien GF1→GF3 = 3
        const result = remapMatrix(matrix, groups, 2, 0);
        expect(result[0][1]).toBe(3);  // GF3→GF1
        expect(result[1][0]).toBe(3);  // GF1→GF3
    });

    it('retourne la matrice inchangée si déplacement sur soi-même', () => {
        const result = remapMatrix(matrix, groups, 1, 1);
        expect(result[0][1]).toBe(5);  // GF1→GF2 inchangé
        expect(result[1][2]).toBe(6);  // GF2→GF3 inchangé
    });

    it('retourne la matrice originale si elle est vide', () => {
        expect(remapMatrix([], groups, 0, 1)).toEqual([]);
    });
});

// ─────────────────────────────────────────
// validateGroupTiming
// ─────────────────────────────────────────
describe('validateGroupTiming', () => {
    it("valide un groupe correct sans erreur", () => {
        const group = makeGroup(1, 0, 30, 3, 10); // offset=0, green=30, orange=3, minGreen=10
        expect(validateGroupTiming(group, 90)).toHaveLength(0);
    });

    it("signale une erreur si vert < vert minimum", () => {
        const group = makeGroup(1, 0, 5, 3, 10); // green=5 < minGreen=10
        const errors = validateGroupTiming(group, 90);
        expect(errors.find(e => e.type === 'minGreen')).toBeDefined();
    });

    it("signale une erreur si offset+vert+orange dépasse le cycle", () => {
        const group = makeGroup(1, 80, 10, 3, 6); // 80+10+3=93 > 90
        const errors = validateGroupTiming(group, 90);
        expect(errors.find(e => e.type === 'overflow')).toBeDefined();
    });

    it("valide un groupe exactement au bord du cycle", () => {
        const group = makeGroup(1, 77, 10, 3, 6); // 77+10+3=90 = cycle → OK
        expect(validateGroupTiming(group, 90)).toHaveLength(0);
    });
});
