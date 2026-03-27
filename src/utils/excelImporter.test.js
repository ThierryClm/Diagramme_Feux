import { describe, it, expect } from 'vitest';
import { normalizeActionName, colNameToIndex, getColOffset } from './excelImporter.js';

// ---------------------------------------------------------------------------
// normalizeActionName
// ---------------------------------------------------------------------------
describe('normalizeActionName', () => {
    describe('exact matches (case-insensitive)', () => {
        it('maps "bande passante début de vert" to Début de bande passante', () => {
            expect(normalizeActionName('Bande passante début de vert')).toBe('Début de bande passante');
        });

        it('maps "bande passante fin de vert" to Fin de bande passante', () => {
            expect(normalizeActionName('bande passante fin de vert')).toBe('Fin de bande passante');
        });

        it('maps "point de repos" to Point de repos', () => {
            expect(normalizeActionName('Point de repos')).toBe('Point de repos');
        });

        it('maps "synchro bts" to Synchro BTS', () => {
            expect(normalizeActionName('synchro bts')).toBe('Synchro BTS');
        });

        it('maps "adaptatif" to Adaptatif vertical', () => {
            expect(normalizeActionName('Adaptatif')).toBe('Adaptatif vertical');
        });

        it('maps "escamotage phase" to Escamotage de phase', () => {
            expect(normalizeActionName('escamotage phase')).toBe('Escamotage de phase');
        });

        it('maps "contrôle de flot" (with accent) to Contrôle de flot', () => {
            expect(normalizeActionName('contrôle de flot')).toBe('Contrôle de flot');
        });
    });

    describe('partial matches', () => {
        it('matches when input contains a known key as substring', () => {
            expect(normalizeActionName('xxx bp début yyy')).toBe('Début de bande passante');
        });

        it('matches "synchro" as partial', () => {
            expect(normalizeActionName('mode synchro avancé')).toBe('Synchro BTS');
        });

        it('matches "fermeture" within longer text', () => {
            expect(normalizeActionName('action fermeture spéciale')).toBe('Fermeture anticipée');
        });
    });

    describe('unknown names', () => {
        it('returns the original name with first letter capitalized', () => {
            expect(normalizeActionName('quelque chose inconnu')).toBe('Quelque chose inconnu');
        });

        it('preserves casing after first letter for unknown names', () => {
            expect(normalizeActionName('mYCustomAction')).toBe('MYCustomAction');
        });
    });

    describe('empty / null / undefined input', () => {
        it('returns empty string for null', () => {
            expect(normalizeActionName(null)).toBe('');
        });

        it('returns empty string for undefined', () => {
            expect(normalizeActionName(undefined)).toBe('');
        });

        it('returns empty string for empty string', () => {
            expect(normalizeActionName('')).toBe('');
        });
    });
});

// ---------------------------------------------------------------------------
// colNameToIndex
// ---------------------------------------------------------------------------
describe('colNameToIndex', () => {
    it('converts A to 0', () => {
        expect(colNameToIndex('A')).toBe(0);
    });

    it('converts B to 1', () => {
        expect(colNameToIndex('B')).toBe(1);
    });

    it('converts Z to 25', () => {
        expect(colNameToIndex('Z')).toBe(25);
    });

    it('converts AA to 26', () => {
        expect(colNameToIndex('AA')).toBe(26);
    });

    it('converts AB to 27', () => {
        expect(colNameToIndex('AB')).toBe(27);
    });

    it('converts AZ to 51', () => {
        expect(colNameToIndex('AZ')).toBe(51);
    });

    it('converts BA to 52', () => {
        expect(colNameToIndex('BA')).toBe(52);
    });
});

// ---------------------------------------------------------------------------
// getColOffset
// ---------------------------------------------------------------------------
describe('getColOffset', () => {
    it('returns 1 when sheet range starts at column A', () => {
        const sheet = { '!ref': 'A1:Z50' };
        expect(getColOffset(sheet)).toBe(1);
    });

    it('returns 0 when sheet range starts at column B', () => {
        const sheet = { '!ref': 'B1:Z50' };
        expect(getColOffset(sheet)).toBe(0);
    });

    it('returns 0 when sheet is null', () => {
        expect(getColOffset(null)).toBe(0);
    });
});
