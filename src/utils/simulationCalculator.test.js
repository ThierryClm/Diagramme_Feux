import { describe, it, expect } from 'vitest';
import { calculateSimulatedDiagram } from './simulationCalculator';

// Helper: create a minimal group
const makeGroup = (id, offset, green, orange = 3, red = 10, type = 'VL') => ({
    id, name: `Groupe ${id}`, type,
    offset, minGreen: 7,
    durations: { green, orange, red },
    da: '', courant: 'TD'
});

// Helper: create an action row
const makeAction = (id, overrides = {}) => ({
    id, gf: '', action: '', description: '', deb: '', fin: '',
    abrv: '', micro: '', plage1: '', plage2: '',
    actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '',
    ...overrides
});

// Empty conflict matrix (no conflicts)
const emptyMatrix = (size) => Array.from({ length: size }, () => Array(size).fill(0));

describe('calculateSimulatedDiagram', () => {

    describe('Ordre de traitement', () => {
        it('traite Ouverture anticipée avant Escamotage de phase', () => {
            const groups = [makeGroup(1, 10, 20), makeGroup(2, 40, 15)];
            const actions = [
                makeAction(1, { gf: '1', action: 'Ouverture anticipée', deb: '5', fin: '10' }),
                makeAction(2, { action: 'Escamotage de phase', deb: '60', fin: '70' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1, 2], 80, emptyMatrix(2));
            // Ouverture shifts group 1 start earlier by 5s
            const g1 = result.simulatedGroups.find(g => g.id === 1);
            expect(g1.simulatedOffset).toBe(5); // 10 - 5
            expect(g1.simulatedGreen).toBe(25); // 20 + 5
            // EP reduces cycle
            expect(result.simulatedCycleLength).toBe(70); // 80 - 10
        });

        it('traite Fermeture anticipée avant Adaptatif vertical', () => {
            const groups = [makeGroup(1, 0, 30), makeGroup(2, 40, 20)];
            const actions = [
                makeAction(1, { gf: '1', action: 'Fermeture anticipée', deb: '25', fin: '30' }),
                makeAction(2, { action: 'Adaptatif vertical', deb: '50', fin: '55' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1, 2], 80, emptyMatrix(2));
            // Fermeture reduces group 1 green by 5s
            const g1 = result.simulatedGroups.find(g => g.id === 1);
            expect(g1.simulatedGreen).toBe(25); // 30 - 5
        });

        it('traite Escamotage groupe avant Adaptatif vertical', () => {
            const groups = [makeGroup(1, 0, 20), makeGroup(2, 30, 15)];
            const actions = [
                makeAction(1, { gf: '1', action: 'Escamotage', actGf1: '2', deb: '30', fin: '35' }),
                makeAction(2, { action: 'Adaptatif vertical', deb: '50', fin: '55' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1, 2], 80, emptyMatrix(2));
            // Escamotage adds greenCut to group 2
            const g2 = result.simulatedGroups.find(g => g.id === 2);
            expect(g2.greenCuts).toHaveLength(1);
            expect(g2.greenCuts[0]).toEqual({ deb: 30, fin: 35 });
        });

        it('traite Escamotage de phase en dernier', () => {
            const groups = [makeGroup(1, 0, 30), makeGroup(2, 40, 20)];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '35', fin: '40' }),
                makeAction(2, { action: 'Escamotage de phase', deb: '70', fin: '80' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1, 2], 90, emptyMatrix(2));
            // AV removes 5s, EP removes 10s (adjusted)
            // Cycle: 90 - 5 - 10 = 75
            expect(result.simulatedCycleLength).toBe(75);
        });
    });

    describe('Contractions cumulatives', () => {
        it('ajuste les deb/fin EP en fonction des contractions AV précédentes', () => {
            const groups = [makeGroup(1, 0, 30), makeGroup(2, 50, 20)];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '35', fin: '43' }), // removes 8s
                makeAction(2, { action: 'Escamotage de phase', deb: '70', fin: '84' }), // adjusted: 62-76
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1, 2], 97, emptyMatrix(2));
            // AV removes 8s, EP (adjusted 62-76) removes 14s
            expect(result.simulatedCycleLength).toBe(97 - 8 - 14); // 75
            // Contractions should be tracked
            expect(result.contractions).toHaveLength(2);
            expect(result.contractions[0].source).toBe('Adaptatif vertical');
            expect(result.contractions[1].source).toBe('Escamotage de phase');
        });

        it('ne cumule pas les zones qui se chevauchent', () => {
            const groups = [makeGroup(1, 0, 30)];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '35', fin: '43' }), // 8s
                makeAction(2, { action: 'Escamotage de phase', deb: '35', fin: '43' }), // same zone, adjusted to 35-35 → skip
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1, 2], 80, emptyMatrix(1));
            // EP zone [35,43] adjusted by AV contraction → [35-8, 43-8] would be wrong
            // Actually: adjustForContractions(35) = 35 (35 < 43), adjustForContractions(43) = 43-8 = 35 → duration 0 → skipped
            expect(result.simulatedCycleLength).toBe(72); // only AV's 8s removed
        });
    });

    describe('EP ne marque pas GF escamoté si vert hors zone', () => {
        it('préserve le vert quand il est hors de la zone EP', () => {
            const groups = [makeGroup(1, 0, 35)]; // green [0-35]
            const actions = [
                makeAction(1, { gf: '1', action: 'Escamotage de phase', deb: '62', fin: '76' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 97, emptyMatrix(1));
            const g1 = result.simulatedGroups.find(g => g.id === 1);
            // Green [0-35] doesn't overlap with EP [62-76]
            expect(g1.isEscamoted).toBe(false);
            expect(g1.simulatedGreen).toBe(35);
        });

        it('escamote le vert quand il chevauche la zone EP', () => {
            const groups = [makeGroup(1, 60, 20)]; // green [60-80]
            const actions = [
                makeAction(1, { gf: '1', action: 'Escamotage de phase', deb: '55', fin: '85' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 100, emptyMatrix(1));
            const g1 = result.simulatedGroups.find(g => g.id === 1);
            // Green [60-80] is entirely within EP [55-85]
            expect(g1.isEscamoted).toBe(true);
            expect(g1.simulatedGreen).toBe(0);
        });
    });

    describe('Groupes vert=0 exclus des conflits', () => {
        it('ne génère pas de conflit pour un groupe avec vert=0', () => {
            const groups = [makeGroup(1, 0, 20), makeGroup(2, 15, 20)];
            // Group 1 and 2 overlap [15-20], matrix has intergreen requirement
            const matrix = [[0, 5], [5, 0]];
            const actions = [
                makeAction(1, { gf: '1', action: 'Fermeture anticipée', deb: '0', fin: '20' }), // removes all green
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 60, matrix);
            const g1 = result.simulatedGroups.find(g => g.id === 1);
            expect(g1.simulatedGreen).toBe(0);
            // No conflicts should involve group 1
            const conflictsWithG1 = result.conflicts.filter(c => c.from === 1 || c.to === 1);
            expect(conflictsWithG1).toHaveLength(0);
        });
    });

    describe('TimeShifts et removedPeriods taggés', () => {
        it('timeShifts ont source et actionId', () => {
            const groups = [makeGroup(1, 0, 20)];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '30', fin: '35' }),
                makeAction(2, { action: 'Escamotage de phase', deb: '50', fin: '60' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1, 2], 80, emptyMatrix(1));
            const avShift = result.timeShifts.find(s => s.source === 'Adaptatif vertical');
            const epShift = result.timeShifts.find(s => s.source === 'Escamotage de phase');
            expect(avShift).toBeDefined();
            expect(avShift.actionId).toBe(1);
            expect(epShift).toBeDefined();
            expect(epShift.actionId).toBe(2);
        });

        it('removedPeriods ont source et actionId', () => {
            const groups = [makeGroup(1, 0, 20)];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '30', fin: '35' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 80, emptyMatrix(1));
            expect(result.removedPeriods[0].source).toBe('Adaptatif vertical');
            expect(result.removedPeriods[0].actionId).toBe(1);
        });

        it('contractions ont source', () => {
            const groups = [makeGroup(1, 0, 20)];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '30', fin: '35' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 80, emptyMatrix(1));
            expect(result.contractions[0].source).toBe('Adaptatif vertical');
        });
    });

    describe('Adaptatif vertical avec plage (partiel)', () => {
        it('ne réduit pas le cycle en mode partiel', () => {
            const groups = [makeGroup(1, 0, 20), makeGroup(2, 30, 15)];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '25', fin: '30', plage1: '1', plage2: '1' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 80, emptyMatrix(2));
            // Partial mode: cycle unchanged
            expect(result.simulatedCycleLength).toBe(80);
        });

        it('réduit le cycle en mode full (sans plage)', () => {
            const groups = [makeGroup(1, 0, 20), makeGroup(2, 30, 15)];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '25', fin: '30' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 80, emptyMatrix(2));
            // Full mode: cycle reduced by 5
            expect(result.simulatedCycleLength).toBe(75);
        });
    });

    describe('Fermeture anticipée : effectiveShiftAmount avec chevauchement AV', () => {
        it('réduit le shift actGf quand la FA chevauche une zone AV', () => {
            // GF1: green [21, 45] (24s), FA [31, 45] (14s), AV [33, 42] (9s)
            // effectiveShiftAmount = 14 - 9 = 5s pour les cibles actGf
            // Source GF1: green réduit de 14 (full shiftAmount) → green = 10, fin = 31
            // Cible GF4: décalé de 5s (effectiveShiftAmount)
            const groups = [
                makeGroup(1, 21, 24),
                makeGroup(4, 50, 15),
            ];
            const actions = [
                makeAction(1, { gf: '1', action: 'Fermeture anticipée', deb: '31', fin: '45', actGf1: '4' }),
                makeAction(2, { action: 'Adaptatif vertical', deb: '33', fin: '42' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1, 2], 97, emptyMatrix(2));
            const g1 = result.simulatedGroups.find(g => g.id === 1);
            const g4 = result.simulatedGroups.find(g => g.id === 4);
            // Source: full shiftAmount (14) → green = 24 - 14 = 10, end = 31
            expect(g1.simulatedGreen).toBe(10);
            // Target GF4: glissement de 5 (effectiveShiftAmount) → offset 50-5=45
            // puis AV [33,42] décale GF4 (offset 45 >= 42) de 9 → offset 36
            // Green inchangé par AV (pas de chevauchement [45,65] avec [33,42])
            expect(g4.simulatedOffset).toBe(36); // 50 - 5 - 9
            expect(g4.simulatedGreen).toBe(20); // 15 + 5
        });

        it('utilise le full shiftAmount quand pas de chevauchement AV', () => {
            // FA [25, 30] (5s) sans AV → effectiveShiftAmount = 5
            const groups = [
                makeGroup(1, 0, 30),
                makeGroup(2, 40, 15),
            ];
            const actions = [
                makeAction(1, { gf: '1', action: 'Fermeture anticipée', deb: '25', fin: '30', actGf1: '2' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 80, emptyMatrix(2));
            const g1 = result.simulatedGroups.find(g => g.id === 1);
            const g2 = result.simulatedGroups.find(g => g.id === 2);
            expect(g1.simulatedGreen).toBe(25); // 30 - 5
            // Target: décalé de 5 (no AV overlap)
            expect(g2.simulatedOffset).toBe(35); // 40 - 5
            expect(g2.simulatedGreen).toBe(20); // 15 + 5
        });

        it('FA actGf pointe sur fin du vert → réduit le green de la cible', () => {
            // GF1: [0, 28], FA [24, 28] (4s)
            // GF15: [68, 31] wrapping → offset=68, green=60 (end at 31 in cycle 97)
            // actGf1 pointe sur la fin du vert de GF15 (28 est plus proche de 31 que de 68)
            // → réduit simulatedGreen de GF15 de 4
            const groups = [
                makeGroup(1, 0, 28),
                makeGroup(15, 68, 60), // green wraps: 68 to 31 (mod 97)
            ];
            const actions = [
                makeAction(1, { gf: '1', action: 'Fermeture anticipée', deb: '24', fin: '28', actGf1: '15' }),
            ];
            const result = calculateSimulatedDiagram(groups, actions, [1], 97, emptyMatrix(2));
            const g15 = result.simulatedGroups.find(g => g.id === 15);
            // actionMid = 26, greenEnd = (68+60)%97 = 31, greenStart = 68
            // distToEnd(26, 31) = 5, distToStart(26, 68) = 42 → pointe sur fin
            expect(g15.simulatedGreen).toBe(56); // 60 - 4
        });
    });

    describe('Fermeture anticipée : overlay position avec chevauchement AV', () => {
        it('l overlay FA [31,45] chevauchant AV [33,42] reste à [31,36]', () => {
            // Vérifie que getShiftedActionPosition ne décale pas deb quand il est avant la zone AV
            // et que fin est correctement décalé de la durée AV
            // Ce test valide la logique fullShiftOnFin vs fullShiftOnDeb
            const groups = [makeGroup(1, 21, 24)];
            const actions = [
                makeAction(1, { gf: '1', action: 'Fermeture anticipée', deb: '31', fin: '45' }),
                makeAction(2, { action: 'Adaptatif vertical', deb: '33', fin: '42' }),
            ];
            // Quand AV est coché, le timeShift {from: 42, amount: 9} décale fin de 45 à 36
            // mais deb=31 est avant avFin=42, donc pas décalé
            const result = calculateSimulatedDiagram(groups, actions, [2], 97, emptyMatrix(1));
            expect(result.timeShifts).toHaveLength(1);
            expect(result.timeShifts[0].from).toBe(42);
            expect(result.timeShifts[0].amount).toBe(9);
        });
    });

    describe('Scénario complet : exemple utilisateur', () => {
        it('AV [35,43] + EP [70,84] + AV [90,92] + EP [84,97]', () => {
            const groups = [
                makeGroup(1, 0, 43),
                makeGroup(2, 50, 15),
            ];
            const actions = [
                makeAction(1, { action: 'Adaptatif vertical', deb: '35', fin: '43' }),
                makeAction(2, { action: 'Adaptatif vertical', deb: '90', fin: '92' }),
                makeAction(3, { action: 'Escamotage de phase', deb: '70', fin: '84' }),
                makeAction(4, { action: 'Escamotage de phase', deb: '84', fin: '97' }),
            ];

            // Cocher AV [35,43] uniquement
            const r1 = calculateSimulatedDiagram(groups, actions, [1], 97, emptyMatrix(2));
            expect(r1.simulatedCycleLength).toBe(89); // 97 - 8

            // Cocher AV [90,92] uniquement
            const r2 = calculateSimulatedDiagram(groups, actions, [2], 97, emptyMatrix(2));
            expect(r2.simulatedCycleLength).toBe(95); // 97 - 2

            // Cocher les deux AV
            const r3 = calculateSimulatedDiagram(groups, actions, [1, 2], 97, emptyMatrix(2));
            expect(r3.simulatedCycleLength).toBe(87); // 97 - 8 - 2

            // Cocher AV [35,43] + EP [70,84]
            const r4 = calculateSimulatedDiagram(groups, actions, [1, 3], 97, emptyMatrix(2));
            expect(r4.simulatedCycleLength).toBe(75); // 97 - 8 - 14
        });
    });
});
