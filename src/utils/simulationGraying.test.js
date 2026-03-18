import { describe, it, expect } from 'vitest';

/**
 * Tests de la logique de grisage des actions dans SimulationPanel.
 * On reproduit ici la même logique que dans SimulationPanel (adjustForAVContractions + erasedActionIds).
 */

// Reproduce adjustForAVContractions from SimulationPanel
const adjustForAVContractions = (time, contractions) => {
    if (!contractions || contractions.length === 0) return time;
    let adjusted = time;
    for (const c of contractions) {
        if (c.source !== 'Adaptatif vertical') continue;
        if (adjusted >= c.fin) {
            adjusted -= (c.fin - c.deb);
        } else if (adjusted > c.deb) {
            adjusted = c.deb;
        }
    }
    return adjusted;
};

// Reproduce erasedActionIds logic from SimulationPanel
const computeErasedIds = (actions, removedPeriods, contractions) => {
    if (!removedPeriods || removedPeriods.length === 0) return new Set();
    const erased = new Set();
    actions.forEach(action => {
        if (action.deb === '') return;
        if (action.action === 'Escamotage de phase') return;
        const rawDeb = parseInt(action.deb) || 0;
        const hasFin = action.fin !== '';
        const rawFin = hasFin ? (parseInt(action.fin) || 0) : rawDeb;
        const isAV = action.action === 'Adaptatif vertical';
        for (const period of removedPeriods) {
            if (isAV && period.source !== 'Escamotage de phase') continue;
            let deb, fin;
            if (period.source === 'Escamotage de phase') {
                deb = adjustForAVContractions(rawDeb, contractions);
                fin = adjustForAVContractions(rawFin, contractions);
            } else {
                deb = rawDeb;
                fin = rawFin;
            }
            if (!hasFin) {
                if (deb >= period.deb && deb < period.fin) {
                    erased.add(action.id);
                    break;
                }
            } else {
                if (deb >= period.deb && deb < period.fin && fin > period.deb && fin <= period.fin) {
                    erased.add(action.id);
                    break;
                }
            }
        }
    });
    return erased;
};

describe('Logique de grisage des actions simulation', () => {

    describe('Actions avec deb seul (Point de repos)', () => {
        it('grise un Point de repos dans une zone AV', () => {
            const actions = [
                { id: 1, action: 'Point de repos', deb: '40', fin: '' },
            ];
            const removedPeriods = [{ deb: 35, fin: 43, source: 'Adaptatif vertical' }];
            const erased = computeErasedIds(actions, removedPeriods, []);
            expect(erased.has(1)).toBe(true);
        });

        it('ne grise pas un Point de repos hors zone', () => {
            const actions = [
                { id: 1, action: 'Point de repos', deb: '50', fin: '' },
            ];
            const removedPeriods = [{ deb: 35, fin: 43, source: 'Adaptatif vertical' }];
            const erased = computeErasedIds(actions, removedPeriods, []);
            expect(erased.has(1)).toBe(false);
        });
    });

    describe('Actions [deb, fin] — pas de chevauchement partiel', () => {
        it('grise une action entièrement dans la zone', () => {
            const actions = [
                { id: 1, action: 'Seconde lucarne', deb: '72', fin: '78' },
            ];
            const removedPeriods = [{ deb: 70, fin: 84, source: 'Escamotage de phase' }];
            const erased = computeErasedIds(actions, removedPeriods, []);
            expect(erased.has(1)).toBe(true);
        });

        it('ne grise pas une action qui chevauche partiellement', () => {
            const actions = [
                { id: 1, action: 'Fermeture anticipée', deb: '32', fin: '43' },
            ];
            const removedPeriods = [{ deb: 35, fin: 43, source: 'Adaptatif vertical' }];
            const erased = computeErasedIds(actions, removedPeriods, []);
            // deb=32 is outside [35,43], so not erased
            expect(erased.has(1)).toBe(false);
        });
    });

    describe('Ajustement par contractions AV pour zones EP', () => {
        it('ajuste les valeurs de l action pour la comparaison avec EP', () => {
            // AV [35,43] contraction, then EP removedPeriod [62,76]
            // Seconde lucarne [70, 79] → adjusted by AV: [62, 71]
            // [62,71] is inside [62,76] → erased
            const actions = [
                { id: 1, action: 'Seconde lucarne', deb: '70', fin: '79' },
            ];
            const removedPeriods = [{ deb: 62, fin: 76, source: 'Escamotage de phase' }];
            const contractions = [{ deb: 35, fin: 43, source: 'Adaptatif vertical' }];
            const erased = computeErasedIds(actions, removedPeriods, contractions);
            expect(erased.has(1)).toBe(true);
        });

        it('n utilise pas les contractions EP pour l ajustement', () => {
            // If we had an EP contraction, it should NOT be used for adjustment
            const actions = [
                { id: 1, action: 'Seconde lucarne', deb: '70', fin: '79' },
            ];
            const removedPeriods = [{ deb: 70, fin: 84, source: 'Escamotage de phase' }];
            const contractions = [{ deb: 70, fin: 84, source: 'Escamotage de phase' }];
            // EP contraction should be ignored, so raw values [70,79] are used
            const erased = computeErasedIds(actions, removedPeriods, contractions);
            expect(erased.has(1)).toBe(true); // [70,79] is inside [70,84]
        });
    });

    describe('AV grisé par EP mais pas par AV', () => {
        it('grise un AV dans une zone EP', () => {
            const actions = [
                { id: 1, action: 'Adaptatif vertical', deb: '90', fin: '92' },
            ];
            const removedPeriods = [{ deb: 84, fin: 97, source: 'Escamotage de phase' }];
            const erased = computeErasedIds(actions, removedPeriods, []);
            expect(erased.has(1)).toBe(true);
        });

        it('ne grise pas un AV par une zone AV', () => {
            const actions = [
                { id: 1, action: 'Adaptatif vertical', deb: '50', fin: '55' },
            ];
            const removedPeriods = [{ deb: 45, fin: 60, source: 'Adaptatif vertical' }];
            const erased = computeErasedIds(actions, removedPeriods, []);
            expect(erased.has(1)).toBe(false);
        });
    });

    describe('Escamotage de phase jamais grisé', () => {
        it('ne grise jamais un EP', () => {
            const actions = [
                { id: 1, action: 'Escamotage de phase', deb: '84', fin: '97' },
            ];
            const removedPeriods = [{ deb: 70, fin: 100, source: 'Escamotage de phase' }];
            const erased = computeErasedIds(actions, removedPeriods, []);
            expect(erased.has(1)).toBe(false);
        });
    });
});
