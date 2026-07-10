import { describe, it, expect } from 'vitest';
import { getTotalGreenTime, parseTrafficVol, isCoordinated } from './trafficHelpers';

describe('trafficHelpers — parseTrafficVol', () => {
    it('extrait la valeur numérique', () => {
        expect(parseTrafficVol(300)).toBe(300);
        expect(parseTrafficVol('450')).toBe(450);
    });
    it('ignore le suffixe de coordination « c »', () => {
        expect(parseTrafficVol('300c')).toBe(300);
        expect(parseTrafficVol('300C')).toBe(300);
    });
    it('renvoie 0 pour vide/invalide', () => {
        expect(parseTrafficVol('')).toBe(0);
        expect(parseTrafficVol(null)).toBe(0);
        expect(parseTrafficVol('c')).toBe(0);
    });
});

describe('trafficHelpers — isCoordinated', () => {
    it('vrai seulement si suffixe « c »', () => {
        expect(isCoordinated('300c')).toBe(true);
        expect(isCoordinated('300')).toBe(false);
        expect(isCoordinated(300)).toBe(false);
        expect(isCoordinated('')).toBe(false);
    });
});

describe('trafficHelpers — getTotalGreenTime', () => {
    const CYCLE = 90;
    it('vert principal seul si aucune seconde lucarne', () => {
        expect(getTotalGreenTime(1, 30, [], CYCLE)).toBe(30);
    });
    it('ajoute la durée des secondes lucarnes du groupe', () => {
        const actions = [
            { action: 'Seconde lucarne', gf: '1', deb: '70', fin: '80' } // +10 s
        ];
        expect(getTotalGreenTime(1, 30, actions, CYCLE)).toBe(40);
    });
    it('gère le passage minuit (fin < deb)', () => {
        const actions = [
            { action: 'Seconde lucarne', gf: '1', deb: '85', fin: '5' } // 90-85 + 5 = 10 s
        ];
        expect(getTotalGreenTime(1, 30, actions, CYCLE)).toBe(40);
    });
    it('ignore les lucarnes d\'un autre groupe et les incomplètes', () => {
        const actions = [
            { action: 'Seconde lucarne', gf: '2', deb: '70', fin: '80' },   // autre GF
            { action: 'Seconde lucarne', gf: '1', deb: '', fin: '80' },      // incomplète
            { action: 'Autre', gf: '1', deb: '70', fin: '80' }              // autre action
        ];
        expect(getTotalGreenTime(1, 30, actions, CYCLE)).toBe(30);
    });
    it('vert nul -> 0', () => {
        expect(getTotalGreenTime(1, 0, [], CYCLE)).toBe(0);
    });
});
