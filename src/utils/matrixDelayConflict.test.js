import { describe, it, expect } from 'vitest';
import {
    getFlecheAnticipations,
    hasOverlap,
    computeActualDelay,
    isDelayInsufficient
} from './matrixDelayConflict';

// Helpers de construction
const grp = (id, offset, green) => ({
    id,
    offset,
    durations: { green, orange: 3, red: 0 }
});

describe('getFlecheAnticipations', () => {
    it('renvoie {} pour actionData null/undefined', () => {
        expect(getFlecheAnticipations(null)).toEqual({});
        expect(getFlecheAnticipations(undefined)).toEqual({});
    });

    it('renvoie {} pour un tableau vide', () => {
        expect(getFlecheAnticipations([])).toEqual({});
    });

    it("ignore les actions autres que 'Flèche d'anticipation'", () => {
        const data = [
            { action: 'Autre', gf: '1', deb: '10', fin: '20' },
            { action: 'Détachement', gf: '2', deb: '5', fin: '15' }
        ];
        expect(getFlecheAnticipations(data)).toEqual({});
    });

    it('ignore les flèches dont gf/deb/fin est vide', () => {
        const data = [
            { action: "Flèche d'anticipation", gf: '', deb: '10', fin: '20' },
            { action: "Flèche d'anticipation", gf: '1', deb: '', fin: '20' },
            { action: "Flèche d'anticipation", gf: '1', deb: '10', fin: '' }
        ];
        expect(getFlecheAnticipations(data)).toEqual({});
    });

    it('parse correctement une flèche valide', () => {
        const data = [
            { action: "Flèche d'anticipation", gf: '3', deb: '12', fin: '25' }
        ];
        expect(getFlecheAnticipations(data)).toEqual({
            3: { deb: 12, fin: 25 }
        });
    });

    it('en cas de doublons sur le même gf, conserve la première rencontrée', () => {
        const data = [
            { action: "Flèche d'anticipation", gf: '1', deb: '10', fin: '20' },
            { action: "Flèche d'anticipation", gf: '1', deb: '30', fin: '40' }
        ];
        expect(getFlecheAnticipations(data)).toEqual({
            1: { deb: 10, fin: 20 }
        });
    });

    it('gère plusieurs gf différents', () => {
        const data = [
            { action: "Flèche d'anticipation", gf: '1', deb: '10', fin: '20' },
            { action: "Flèche d'anticipation", gf: '2', deb: '30', fin: '40' }
        ];
        expect(getFlecheAnticipations(data)).toEqual({
            1: { deb: 10, fin: 20 },
            2: { deb: 30, fin: 40 }
        });
    });
});

describe('hasOverlap', () => {
    const baseCtx = (overrides = {}) => ({
        conflictMatrix: [[0, 5], [5, 0]],
        groups: [grp(1, 0, 30), grp(2, 50, 30)],
        cycleLength: 100,
        flecheAnticipations: {},
        ...overrides
    });

    it('renvoie false si la case de matrice est vide', () => {
        const ctx = baseCtx({ conflictMatrix: [[0, ''], ['', 0]] });
        expect(hasOverlap(0, 1, ctx)).toBe(false);
    });

    it('renvoie false si la case de matrice est null/undefined', () => {
        expect(hasOverlap(0, 1, baseCtx({ conflictMatrix: [[0, null], [null, 0]] }))).toBe(false);
        expect(hasOverlap(0, 1, baseCtx({ conflictMatrix: [[0, undefined], [undefined, 0]] }))).toBe(false);
    });

    it("renvoie false si l'un des groupes n'est pas défini", () => {
        expect(hasOverlap(0, 1, baseCtx({ groups: null }))).toBe(false);
        expect(hasOverlap(0, 1, baseCtx({ groups: [grp(1, 0, 30)] }))).toBe(false);
    });

    it("renvoie false quand les phases vertes ne se recouvrent pas (A finit avant B)", () => {
        // A: 0..30, B: 50..80
        expect(hasOverlap(0, 1, baseCtx())).toBe(false);
    });

    it("renvoie true en cas de recouvrement simple", () => {
        // A: 0..30, B: 20..50 → recouvrement 20..30
        const ctx = baseCtx({ groups: [grp(1, 0, 30), grp(2, 20, 30)] });
        expect(hasOverlap(0, 1, ctx)).toBe(true);
    });

    it("gère le wrap-around : A enjambe la fin de cycle", () => {
        // cycle 100, A offset 90 green 20 → 90..110 → 90..100 + 0..10
        // B: 5..15 → recouvre A sur 5..10
        const ctx = baseCtx({ groups: [grp(1, 90, 20), grp(2, 5, 10)] });
        expect(hasOverlap(0, 1, ctx)).toBe(true);
    });

    it("gère le wrap-around : A enjambe sans toucher B", () => {
        // A: 90..10 (wrap), B: 30..50
        const ctx = baseCtx({ groups: [grp(1, 90, 20), grp(2, 30, 20)] });
        expect(hasOverlap(0, 1, ctx)).toBe(false);
    });

    it("renvoie true quand les deux phases enjambent la fin de cycle", () => {
        // Les deux wrappent => partagent forcément l'instant 0
        const ctx = baseCtx({ groups: [grp(1, 90, 20), grp(2, 95, 20)] });
        expect(hasOverlap(0, 1, ctx)).toBe(true);
    });

    it("utilise les timings de la flèche d'anticipation au lieu du vert principal", () => {
        // groupe A vert 0..30, mais flèche 60..80 → ne recouvre plus B (50..70)
        const ctx = baseCtx({
            groups: [grp(1, 0, 30), grp(2, 50, 20)],
            flecheAnticipations: { 1: { deb: 60, fin: 80 } }
        });
        // Flèche A: 60..80, B vert: 50..70 → recouvrement 60..70
        expect(hasOverlap(0, 1, ctx)).toBe(true);
    });

    it("flèche sur B remplace le vert de B", () => {
        // A: 0..30, B vert: 0..30 (recouvrement total) MAIS flèche B: 60..80
        const ctx = baseCtx({
            groups: [grp(1, 0, 30), grp(2, 0, 30)],
            flecheAnticipations: { 2: { deb: 60, fin: 80 } }
        });
        expect(hasOverlap(0, 1, ctx)).toBe(false);
    });

    it("utilise cycle 100 par défaut quand cycleLength manque", () => {
        const ctx = baseCtx({ cycleLength: undefined, groups: [grp(1, 90, 20), grp(2, 5, 10)] });
        expect(hasOverlap(0, 1, ctx)).toBe(true);
    });
});

describe('computeActualDelay', () => {
    const baseCtx = (overrides = {}) => ({
        conflictMatrix: [[0, 5], [5, 0]],
        groups: [grp(1, 0, 30), grp(2, 50, 30)],
        cycleLength: 100,
        flecheAnticipations: {},
        ...overrides
    });

    it("renvoie null si l'un des groupes n'est pas défini", () => {
        expect(computeActualDelay(0, 1, baseCtx({ groups: null }))).toBe(null);
        expect(computeActualDelay(0, 1, baseCtx({ groups: [grp(1, 0, 30)] }))).toBe(null);
    });

    it("calcule le délai simple (sans wrap)", () => {
        // A finit à 30, B démarre à 50 → délai 20
        expect(computeActualDelay(0, 1, baseCtx())).toBe(20);
    });

    it("gère le wrap-around quand toStart < fromEnd", () => {
        // A: offset 80 green 10 → fin à 90, B offset 5 → délai 5-90+100 = 15
        const ctx = baseCtx({ groups: [grp(1, 80, 10), grp(2, 5, 20)] });
        expect(computeActualDelay(0, 1, ctx)).toBe(15);
    });

    it("utilise la fin de la flèche d'anticipation pour fromEnd", () => {
        // A vert 0..30, flèche A fin=45, B offset=60 → délai = 60-45 = 15
        const ctx = baseCtx({
            groups: [grp(1, 0, 30), grp(2, 60, 20)],
            flecheAnticipations: { 1: { deb: 30, fin: 45 } }
        });
        expect(computeActualDelay(0, 1, ctx)).toBe(15);
    });

    it("utilise le début de la flèche d'anticipation pour toStart", () => {
        // A fin 30, flèche B deb=70 → délai 40
        const ctx = baseCtx({
            groups: [grp(1, 0, 30), grp(2, 50, 30)],
            flecheAnticipations: { 2: { deb: 70, fin: 90 } }
        });
        expect(computeActualDelay(0, 1, ctx)).toBe(40);
    });

    it("utilise cycle 100 par défaut", () => {
        const ctx = baseCtx({ cycleLength: undefined });
        expect(computeActualDelay(0, 1, ctx)).toBe(20);
    });
});

describe('isDelayInsufficient', () => {
    const baseCtx = (overrides = {}) => ({
        conflictMatrix: [[0, 5], [5, 0]],
        groups: [grp(1, 0, 30), grp(2, 50, 30)],
        cycleLength: 100,
        flecheAnticipations: {},
        ...overrides
    });

    it('renvoie false si la case de matrice est vide', () => {
        const ctx = baseCtx({ conflictMatrix: [[0, ''], ['', 0]] });
        expect(isDelayInsufficient(0, 1, ctx)).toBe(false);
    });

    it("renvoie false si l'un des groupes n'est pas défini", () => {
        expect(isDelayInsufficient(0, 1, baseCtx({ groups: null }))).toBe(false);
    });

    it('renvoie true en cas de recouvrement (englobe le conflit)', () => {
        // A: 0..30, B: 20..50 → overlap → true
        const ctx = baseCtx({ groups: [grp(1, 0, 30), grp(2, 20, 30)] });
        expect(isDelayInsufficient(0, 1, ctx)).toBe(true);
    });

    it('renvoie false quand le délai réel >= demandé', () => {
        // Délai réel 20, demandé 5 → false
        expect(isDelayInsufficient(0, 1, baseCtx())).toBe(false);
    });

    it('renvoie false quand délai réel = demandé', () => {
        // Délai réel 20, demandé 20 → false (strictement supérieur uniquement)
        const ctx = baseCtx({ conflictMatrix: [[0, 20], [20, 0]] });
        expect(isDelayInsufficient(0, 1, ctx)).toBe(false);
    });

    it('renvoie true quand le délai réel < demandé', () => {
        // Délai réel 20, demandé 25 → true
        const ctx = baseCtx({ conflictMatrix: [[0, 25], [25, 0]] });
        expect(isDelayInsufficient(0, 1, ctx)).toBe(true);
    });

    it("prend en compte la flèche d'anticipation", () => {
        // A vert 0..30, flèche A fin=40, B offset=50 → délai réel = 10
        // Si on demande 15 → conflit
        const ctx = baseCtx({
            groups: [grp(1, 0, 30), grp(2, 50, 30)],
            flecheAnticipations: { 1: { deb: 25, fin: 40 } },
            conflictMatrix: [[0, 15], [15, 0]]
        });
        expect(isDelayInsufficient(0, 1, ctx)).toBe(true);
    });
});
