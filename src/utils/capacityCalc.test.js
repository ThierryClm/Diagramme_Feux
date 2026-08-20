import { describe, it, expect } from 'vitest';
import {
    SATURATION_FLOW,
    calculateVUtile,
    calculateCapacity,
    getCapacityColorClass,
    calculateOfferedCapacity,
    calculateDegreeOfSaturation,
    calculateReserveCapacity,
    calculateUniformDelay,
    calculateRandomDelay,
    calculateAverageDelay,
    calculateQueueLength,
    calculateAverageQueueLength,
    AVG_VEHICLE_LENGTH_M
} from './capacityCalc';

// Reproduit la formule HISTORIQUE de la colonne « Retard » de TrafficTable,
// pour garantir que calculateUniformDelay ne dévie pas de l'existant.
const legacyRetard = (greenTime, trafficVol, laneCoef, cycleLength) => {
    const ratio = trafficVol / (1800 * laneCoef);
    if (ratio >= 1) return null;
    const redTime = cycleLength - greenTime;
    return (redTime * redTime) / (2 * cycleLength * (1 - ratio));
};

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
    // Le cas ci-dessus tombe sur un V.Utile entier (15 s) et ne révélait donc
    // rien. Ici V.Utile vaut 9,11 s : arrondir avant de calculer le pourcentage
    // faisait dire 82 % au tableau Trafic et 0,83 au panneau Capacité, soit un
    // point d'écart sur la réserve annoncée pour le même courant.
    it("reste cohérent quand V.Utile n'est pas entier", () => {
        const [vol, coef, vert, cycle] = [303, 0.85, 11, 46];
        const x = calculateDegreeOfSaturation(vol, coef, vert, cycle);
        const capU = calculateCapacity(vert, calculateVUtile(vol, coef, cycle)).value;
        expect(calculateVUtile(vol, coef, cycle)).toBeCloseTo(9.11, 2);
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

describe('capacityCalc — attente (Webster) & file', () => {
    // Réf : coef 1, vert 30, cycle 90, trafic 300 -> d1 = 24 s, d2 = 3 s.
    it('attente uniforme d1 = terme 1 de Webster', () => {
        expect(calculateUniformDelay(300, COEF, GREEN, CYCLE)).toBeCloseTo(24, 5);
    });
    it('d1 reste identique à la formule historique « Retard »', () => {
        [[300, 1, 30], [560, 1, 41], [900, 2, 25], [120, 0.5, 12]].forEach(([q, c, g]) => {
            expect(calculateUniformDelay(q, c, g, CYCLE)).toBeCloseTo(legacyRetard(g, q, c, CYCLE), 6);
        });
    });
    it('attente aléatoire d2 = terme 2 de Webster', () => {
        expect(calculateRandomDelay(300, COEF, GREEN, CYCLE)).toBeCloseTo(3, 5);
    });
    it('attente moyenne = d1 + d2', () => {
        expect(calculateAverageDelay(300, COEF, GREEN, CYCLE)).toBeCloseTo(27, 5);
    });
    it('null en sur-saturation (x ≥ 1) ou λx ≥ 1', () => {
        expect(calculateUniformDelay(1800, COEF, GREEN, CYCLE)).toBeNull(); // λx = 1
        expect(calculateRandomDelay(600, COEF, GREEN, CYCLE)).toBeNull();   // x = 1
        expect(calculateAverageDelay(900, COEF, GREEN, CYCLE)).toBeNull();  // x = 1.5
    });
    it('file d\'attente = formule historique (mètres)', () => {
        expect(calculateQueueLength(300, COEF, GREEN, CYCLE)).toBe(36);
    });
    it('null si données insuffisantes', () => {
        expect(calculateUniformDelay(0, COEF, GREEN, CYCLE)).toBeNull();
        expect(calculateQueueLength(300, 0, GREEN, CYCLE)).toBeNull();
    });
});

describe('capacityCalc — file d\'attente moyenne (loi de Little)', () => {
    // Réf : trafic 300, attente 27 s -> file = (300/3600)·27·6 = 13,5 -> 14 m.
    it('file = débit × attente × longueur véhicule', () => {
        expect(calculateAverageQueueLength(300, COEF, GREEN, CYCLE)).toBe(14);
    });
    it('dépend de l\'attente : croît avec la saturation', () => {
        // trafic 300 (x=0,5) vs 500 (x plus élevé) : file plus longue si plus saturé.
        const q300 = calculateAverageQueueLength(300, COEF, GREEN, CYCLE);
        const q500 = calculateAverageQueueLength(500, COEF, GREEN, CYCLE);
        expect(q500).toBeGreaterThan(q300);
    });
    it('null en sur-saturation (attente indéterminée)', () => {
        expect(calculateAverageQueueLength(600, COEF, GREEN, CYCLE)).toBeNull(); // x = 1
    });
    it('constante de longueur véhicule = 6 m', () => {
        expect(AVG_VEHICLE_LENGTH_M).toBe(6);
    });
});
