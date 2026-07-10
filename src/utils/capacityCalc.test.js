import { describe, it, expect } from 'vitest';
import {
    SATURATION_FLOW,
    calculateVUtile,
    calculateCapacity,
    getCapacityColorClass,
    calculateOfferedCapacity,
    calculateDegreeOfSaturation,
    calculateReserveCapacity
} from './capacityCalc';

// Jeu de référence : coef 1 voie, vert 30 s, cycle 90 s -> capacité 600 uvp/h.
// Trafic 300 uvp/h -> degré de saturation 0,5 ; V.Utile 15 s ; Cap.U 50 %.
const COEF = 1;
const GREEN = 30;
const CYCLE = 90;

describe('capacityCalc — existant (garde-fou)', () => {
    it('V.Utile = trafic / (1800·coef/cycle)', () => {
        expect(calculateVUtile(300, COEF, CYCLE)).toBe(15);
    });
    it('Cap.U = V.Utile / vert × 100', () => {
        expect(calculateCapacity(GREEN, 15)).toEqual({ value: 50, display: '50%' });
    });
    it('classe couleur selon les seuils métier', () => {
        expect(getCapacityColorClass(50)).toBe('capacity-green');
        expect(getCapacityColorClass(80)).toBe('capacity-orange');
        expect(getCapacityColorClass(95)).toBe('capacity-red');
        expect(getCapacityColorClass(120)).toBe('capacity-black');
    });
});

describe('capacityCalc — capacité offerte', () => {
    it('C = 1800 × coef × vert/cycle', () => {
        expect(calculateOfferedCapacity(COEF, GREEN, CYCLE)).toBe(600);
        expect(calculateOfferedCapacity(2, GREEN, CYCLE)).toBe(1200);
    });
    it('utilise la constante SATURATION_FLOW', () => {
        expect(calculateOfferedCapacity(1, CYCLE, CYCLE)).toBe(SATURATION_FLOW);
    });
    it('null si données insuffisantes', () => {
        expect(calculateOfferedCapacity(0, GREEN, CYCLE)).toBeNull();
        expect(calculateOfferedCapacity(COEF, 0, CYCLE)).toBeNull();
        expect(calculateOfferedCapacity(COEF, GREEN, 0)).toBeNull();
    });
});

describe('capacityCalc — degré de saturation', () => {
    it('x = trafic / capacité offerte', () => {
        expect(calculateDegreeOfSaturation(300, COEF, GREEN, CYCLE)).toBeCloseTo(0.5, 5);
    });
    it('x > 1 quand le courant est saturé', () => {
        expect(calculateDegreeOfSaturation(900, COEF, GREEN, CYCLE)).toBeCloseTo(1.5, 5);
    });
    it('cohérent avec Cap.U (x·100 ≈ Cap.U)', () => {
        const x = calculateDegreeOfSaturation(300, COEF, GREEN, CYCLE);
        const capU = calculateCapacity(GREEN, calculateVUtile(300, COEF, CYCLE)).value;
        expect(Math.round(x * 100)).toBe(capU);
    });
    it('null si données insuffisantes', () => {
        expect(calculateDegreeOfSaturation(0, COEF, GREEN, CYCLE)).toBeNull();
        expect(calculateDegreeOfSaturation(300, 0, GREEN, CYCLE)).toBeNull();
    });
});

describe('capacityCalc — réserve de capacité', () => {
    it('{ veh: C − trafic, ratio: 1 − x }', () => {
        expect(calculateReserveCapacity(300, COEF, GREEN, CYCLE)).toEqual({ veh: 300, ratio: 0.5 });
    });
    it('réserve négative quand le courant dépasse la capacité', () => {
        const r = calculateReserveCapacity(900, COEF, GREEN, CYCLE);
        expect(r.veh).toBe(-300);
        expect(r.ratio).toBeCloseTo(-0.5, 5);
    });
    it('trafic nul = réserve pleine', () => {
        expect(calculateReserveCapacity(0, COEF, GREEN, CYCLE)).toEqual({ veh: 600, ratio: 1 });
    });
    it('null si capacité indéterminée', () => {
        expect(calculateReserveCapacity(300, 0, GREEN, CYCLE)).toBeNull();
    });
});
