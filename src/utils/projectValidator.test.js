import { describe, it, expect } from 'vitest';
import { validateProject } from './projectValidator';

describe('validateProject — rejet des entrées non-projets', () => {
    it('rejette null', () => {
        const r = validateProject(null);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/objet de projet/);
    });

    it('rejette un tableau', () => {
        const r = validateProject([1, 2, 3]);
        expect(r.ok).toBe(false);
    });

    it('rejette un scalaire', () => {
        const r = validateProject('coucou');
        expect(r.ok).toBe(false);
    });

    it('rejette un objet vide', () => {
        const r = validateProject({});
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/ne ressemble pas à un projet/);
    });

    it('rejette un objet sans aucun marqueur (JSON d\'une autre app)', () => {
        const r = validateProject({ foo: 'bar', count: 3, users: [] });
        expect(r.ok).toBe(false);
    });
});

describe('validateProject — acceptation avec marqueurs minimaux', () => {
    it('accepte un objet avec seulement cycleLength', () => {
        const r = validateProject({ cycleLength: 90 });
        expect(r.ok).toBe(true);
    });

    it('accepte un objet avec seulement groups', () => {
        const r = validateProject({ groups: [] });
        expect(r.ok).toBe(true);
    });

    it('accepte un objet avec seulement pfTabs', () => {
        const r = validateProject({ pfTabs: [] });
        expect(r.ok).toBe(true);
    });

    it('accepte un projet complet sans avertissement', () => {
        const r = validateProject({
            cycleLength: 90,
            groups: [
                { id: 1, name: 'GF1', durations: { green: 30, orange: 3, red: 57 } }
            ],
            conflictMatrix: [[''],],
            pfTabs: [{ id: 1, name: 'PF Jour' }]
        });
        expect(r.ok).toBe(true);
        expect(r.warnings).toHaveLength(0);
    });
});

describe('validateProject — avertissements non bloquants', () => {
    it('signale un groupe sans id', () => {
        const r = validateProject({
            cycleLength: 90,
            groups: [{ name: 'GF1', durations: { green: 30, orange: 3, red: 57 } }]
        });
        expect(r.ok).toBe(true);
        expect(r.warnings.some(w => /identifiant/.test(w))).toBe(true);
    });

    it('signale un groupe sans nom', () => {
        const r = validateProject({
            groups: [{ id: 1, durations: { green: 30, orange: 3, red: 57 } }]
        });
        expect(r.ok).toBe(true);
        expect(r.warnings.some(w => /nom manquant/.test(w))).toBe(true);
    });

    it('signale un groupe sans durations', () => {
        const r = validateProject({
            groups: [{ id: 1, name: 'GF1' }]
        });
        expect(r.ok).toBe(true);
        expect(r.warnings.some(w => /durations|durées/i.test(w))).toBe(true);
    });

    it('signale une matrice de taille incohérente', () => {
        const r = validateProject({
            cycleLength: 90,
            groups: [{ id: 1, name: 'GF1', durations: { green: 30, orange: 3, red: 57 } }],
            conflictMatrix: [['', '', ''], ['', '', '']] // 2 lignes pour 1 groupe
        });
        expect(r.ok).toBe(true);
        expect(r.warnings.some(w => /ligne.*groupe|Matrice/i.test(w))).toBe(true);
    });

    it('signale un PF sans id', () => {
        const r = validateProject({
            pfTabs: [{ name: 'PF Jour' }]
        });
        expect(r.ok).toBe(true);
        expect(r.warnings.some(w => /Plan de feux.*identifiant/.test(w))).toBe(true);
    });
});
