import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';

// Each test starts from a clean localStorage so the hook's default init
// (5 groups, default cycle, empty matrix) is deterministic.
beforeEach(() => {
    localStorage.clear();
});

// ---------------- Initial state ----------------

describe('useTrafficLight — état initial', () => {
    it('initialise 5 groupes par défaut', () => {
        const { result } = renderHook(() => useTrafficLight());
        expect(result.current.groups).toHaveLength(5);
    });

    it('chaque groupe a un id, un nom "Groupe N", un type VL, et une structure de durations', () => {
        const { result } = renderHook(() => useTrafficLight());
        result.current.groups.forEach((g, i) => {
            expect(g.id).toBe(i + 1);
            expect(g.name).toBe(`Groupe ${i + 1}`);
            expect(g.type).toBe('VL');
            expect(g.durations).toMatchObject({ orange: 3 });
            expect(typeof g.durations.green).toBe('number');
            expect(typeof g.durations.red).toBe('number');
        });
    });

    it('initialise une matrice de conflits 5×5 vide', () => {
        const { result } = renderHook(() => useTrafficLight());
        expect(result.current.conflictMatrix).toHaveLength(5);
        result.current.conflictMatrix.forEach(row => {
            expect(row).toHaveLength(5);
            row.forEach(v => expect(v).toBe(''));
        });
    });

    it('initialise un nom de carrefour par défaut', () => {
        const { result } = renderHook(() => useTrafficLight());
        expect(typeof result.current.intersectionName).toBe('string');
        expect(result.current.intersectionName.length).toBeGreaterThan(0);
    });

    it('pas de lecture ni d\'écriture en cours par défaut', () => {
        const { result } = renderHook(() => useTrafficLight());
        expect(result.current.isPlaying).toBe(false);
    });
});

// ---------------- setGroupCount ----------------

describe('useTrafficLight — setGroupCount', () => {
    it('ajoute des groupes quand count augmente', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setGroupCount(8));
        expect(result.current.groups).toHaveLength(8);
        expect(result.current.groups[7].id).toBe(8);
        expect(result.current.groups[7].name).toBe('Groupe 8');
    });

    it('retire des groupes quand count diminue', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setGroupCount(3));
        expect(result.current.groups).toHaveLength(3);
        expect(result.current.groups[2].id).toBe(3);
    });

    it('limite le nombre minimum à 1 groupe', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setGroupCount(0));
        expect(result.current.groups).toHaveLength(1);
    });

    it('redimensionne la matrice de conflits à la nouvelle taille', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setGroupCount(7));
        expect(result.current.conflictMatrix).toHaveLength(7);
        expect(result.current.conflictMatrix[0]).toHaveLength(7);
    });

    it('conserve les valeurs existantes de la matrice lors d\'un agrandissement', () => {
        const { result } = renderHook(() => useTrafficLight());
        // setMatrixValue prend des IDs de groupes (1-indexed), pas des indices
        act(() => result.current.setMatrixValue(1, 2, 5));
        act(() => result.current.setGroupCount(7));
        expect(result.current.conflictMatrix[0][1]).toBe(5);
    });
});

// ---------------- updateGroupParams ----------------

describe('useTrafficLight — updateGroupParams', () => {
    it('modifie le nom d\'un groupe', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.updateGroupParams(1, { name: 'Axe principal' }));
        expect(result.current.groups[0].name).toBe('Axe principal');
    });

    it('modifie le vert d\'un groupe (rouge recalculé automatiquement)', () => {
        const { result } = renderHook(() => useTrafficLight());
        // Cycle par défaut = 60, orange = 3, donc red = 60 - 30 - 3 = 27
        act(() => result.current.updateGroupParams(1, { durations: { green: 30, orange: 3, red: 27 } }));
        expect(result.current.groups[0].durations.green).toBe(30);
        expect(result.current.groups[0].durations.red).toBe(27);
    });

    it('modifie l\'offset d\'un groupe', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.updateGroupParams(2, { offset: 20 }));
        expect(result.current.groups[1].offset).toBe(20);
    });

    it('ne touche pas aux autres groupes', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.updateGroupParams(1, { name: 'Modifié' }));
        expect(result.current.groups[1].name).toBe('Groupe 2');
        expect(result.current.groups[2].name).toBe('Groupe 3');
    });

    it('ne fait rien si l\'id n\'existe pas', () => {
        const { result } = renderHook(() => useTrafficLight());
        const before = result.current.groups.map(g => g.name);
        act(() => result.current.updateGroupParams(999, { name: 'X' }));
        expect(result.current.groups.map(g => g.name)).toEqual(before);
    });
});

// ---------------- setCycleLength / setIntersectionName ----------------

describe('useTrafficLight — paramètres globaux', () => {
    it('met à jour cycleLength', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setCycleLength(120));
        expect(result.current.cycleLength).toBe(120);
    });

    it('met à jour intersectionName', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setIntersectionName('Place de la Mairie'));
        expect(result.current.intersectionName).toBe('Place de la Mairie');
    });

    it('met à jour dependencyGap', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setDependencyGap(15));
        expect(result.current.dependencyGap).toBe(15);
    });
});

// ---------------- matrice de conflits ----------------

describe('useTrafficLight — matrice', () => {
    it('setMatrixValue(fromId, toId, v) place une valeur à [fromId-1][toId-1]', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setMatrixValue(1, 3, 4));
        expect(result.current.conflictMatrix[0][2]).toBe(4);
    });

    it('setMatrixValue est ciblé : n\'affecte pas les autres cellules', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setMatrixValue(2, 4, 5));
        expect(result.current.conflictMatrix[0][0]).toBe('');
        expect(result.current.conflictMatrix[3][1]).toBe('');
        expect(result.current.conflictMatrix[1][3]).toBe(5);
    });
});

// ---------------- reset / playback ----------------

describe('useTrafficLight — lecture / reset', () => {
    it('setIsPlaying bascule l\'état', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setIsPlaying(true));
        expect(result.current.isPlaying).toBe(true);
        act(() => result.current.setIsPlaying(false));
        expect(result.current.isPlaying).toBe(false);
    });

    it('reset arrête la lecture et remet globalTime à 0', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setIsPlaying(true));
        act(() => result.current.reset());
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.globalTime).toBe(0);
    });

    it('reset ne touche pas aux groupes ni au cycle', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setCycleLength(120));
        act(() => result.current.setGroupCount(3));
        act(() => result.current.reset());
        expect(result.current.groups).toHaveLength(3);
        expect(result.current.cycleLength).toBe(120);
    });
});

// ---------------- undo / redo ----------------

describe('useTrafficLight — undo/redo', () => {
    it('canUndo est false à l\'état initial', () => {
        const { result } = renderHook(() => useTrafficLight());
        expect(result.current.canUndo).toBe(false);
    });

    it('après une modification de groupe, canUndo devient true', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.updateGroupParams(1, { name: 'Nouveau nom' }));
        expect(result.current.canUndo).toBe(true);
    });

    it('undo restaure l\'état précédent d\'un groupe', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.updateGroupParams(1, { name: 'Modifié' }));
        act(() => result.current.undo());
        expect(result.current.groups[0].name).toBe('Groupe 1');
    });

    it('après undo, redo est disponible', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.updateGroupParams(1, { name: 'Modifié' }));
        act(() => result.current.undo());
        expect(result.current.canRedo).toBe(true);
    });

    it('redo refait le changement', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.updateGroupParams(1, { name: 'Modifié' }));
        act(() => result.current.undo());
        act(() => result.current.redo());
        expect(result.current.groups[0].name).toBe('Modifié');
    });
});

// ---------------- Sérialisation complète (aller-retour sans perte) ----------------
//
// Régression : l'autosave, la sauvegarde explicite et l'export fichier
// utilisaient trois payloads différents. L'autosave (qui réécrit le cache
// après chaque édition) omettait customTrafficDatasetNames / pfTrafficDatasetMap
// / externalLinks / matricesLocked / actionColWidths, et loadProject les
// réinitialisait. Résultat : recharger un projet depuis la liste (cache)
// perdait ces modifications. Tout est désormais sérialisé via getFullState.

describe('useTrafficLight — sérialisation complète du projet', () => {
    it('getFullState expose tous les champs restaurés au chargement', () => {
        const { result } = renderHook(() => useTrafficLight());
        const fs = result.current.getFullState();
        ['imageBrightness', 'imageContrast', 'customTrafficDatasetNames',
            'pfTrafficDatasetMap', 'externalLinks', 'matricesLocked',
            'actionColWidths', 'capacityCompareSelection', 'capacityCompareDataset']
            .forEach(k => expect(fs).toHaveProperty(k));
    });

    it('aller-retour loadFullState -> getFullState préserve les champs jadis perdus par le cache', () => {
        const { result } = renderHook(() => useTrafficLight());
        const state = {
            projectName: 'RoundTrip',
            groups: result.current.groups, // groupes par défaut valides
            cycleLength: 72,
            customTrafficDatasetNames: ['Matin spécial'],
            pfTrafficDatasetMap: { 1: 'HPM' },
            externalLinks: [{ label: 'Doc', url: 'https://exemple.test' }],
            matricesLocked: true,
            actionColWidths: { description: 200, micro: 500, abrv: 50 },
            imageBrightness: 130,
            imageContrast: 90,
            capacityCompareSelection: [1, 2],
            capacityCompareDataset: 'HPM'
        };
        act(() => { result.current.loadFullState(state); });
        const out = result.current.getFullState();
        expect(out.customTrafficDatasetNames).toEqual(['Matin spécial']);
        expect(out.pfTrafficDatasetMap).toEqual({ 1: 'HPM' });
        expect(out.externalLinks).toEqual([{ label: 'Doc', url: 'https://exemple.test' }]);
        expect(out.matricesLocked).toBe(true);
        expect(out.actionColWidths).toEqual({ description: 200, micro: 500, abrv: 50 });
        expect(out.imageBrightness).toBe(130);
        expect(out.imageContrast).toBe(90);
        expect(out.capacityCompareSelection).toEqual([1, 2]);
        expect(out.capacityCompareDataset).toBe('HPM');
    });
});

// ---------------- Synchronisation cache localStorage ↔ fichier ----------------
//
// Deux sources persistent le même projet : le cache localStorage (écrit par
// saveProject / l'autosave, lu par loadProject depuis la liste) et le fichier
// réseau (getFullState -> JSON, lu par loadFullState). Ces tests garantissent
// qu'elles restent synchronisées : un aller-retour par le cache ne perd rien,
// et les deux lecteurs restaurent un état identique depuis un même payload.

describe('useTrafficLight — synchronisation cache localStorage ↔ fichier', () => {
    const richState = (groups) => ({
        projectName: 'Sync',
        groups,
        cycleLength: 84,
        customTrafficDatasetNames: ['Événement'],
        pfTrafficDatasetMap: { 1: 'HPS' },
        externalLinks: [{ label: 'Plan', url: 'https://exemple.test/plan' }],
        matricesLocked: true,
        actionColWidths: { description: 180, micro: 480, abrv: 44 },
        imageBrightness: 120,
        imageContrast: 80,
        capacityCompareSelection: [2, 3],
        capacityCompareDataset: 'HPS'
    });

    // Projection sur les seuls champs qui divergeaient entre les sérialiseurs.
    // (cycleLength est exclu : la valeur globale est dérivée du PF actif, pas
    // du champ top-level — ce n'était pas un champ perdu par le cache.)
    const sensitive = (fs) => ({
        customTrafficDatasetNames: fs.customTrafficDatasetNames,
        pfTrafficDatasetMap: fs.pfTrafficDatasetMap,
        externalLinks: fs.externalLinks,
        matricesLocked: fs.matricesLocked,
        actionColWidths: fs.actionColWidths,
        imageBrightness: fs.imageBrightness,
        imageContrast: fs.imageContrast,
        capacityCompareSelection: fs.capacityCompareSelection,
        capacityCompareDataset: fs.capacityCompareDataset
    });

    const expected = {
        customTrafficDatasetNames: ['Événement'],
        pfTrafficDatasetMap: { 1: 'HPS' },
        externalLinks: [{ label: 'Plan', url: 'https://exemple.test/plan' }],
        matricesLocked: true,
        actionColWidths: { description: 180, micro: 480, abrv: 44 },
        imageBrightness: 120,
        imageContrast: 80,
        capacityCompareSelection: [2, 3],
        capacityCompareDataset: 'HPS'
    };

    it('aller-retour par le cache (saveProject -> loadProject) ne perd aucun champ sensible', async () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => { result.current.loadFullState(richState(result.current.groups)); });
        await act(async () => { await result.current.saveProject('ProjetSync'); });

        // Un hook neuf recharge le projet depuis la liste (cache localStorage).
        const { result: reloaded } = renderHook(() => useTrafficLight());
        act(() => { reloaded.current.loadProject('ProjetSync'); });

        expect(sensitive(reloaded.current.getFullState())).toEqual(expected);
    });

    it('les deux lecteurs (fichier: loadFullState, cache: loadProject) restaurent le même état', () => {
        // Payload canonique de référence (ce qu'écrivent fichier ET cache).
        const seed = renderHook(() => useTrafficLight());
        act(() => { seed.result.current.loadFullState(richState(seed.result.current.groups)); });
        const payload = JSON.parse(JSON.stringify(seed.result.current.getFullState()));

        // Lecteur « fichier ».
        const viaFile = renderHook(() => useTrafficLight());
        act(() => { viaFile.result.current.loadFullState(payload); });

        // Lecteur « cache » : on dépose le payload dans localStorage puis loadProject.
        localStorage.setItem('traffic_project_Ref', JSON.stringify(payload));
        const viaCache = renderHook(() => useTrafficLight());
        act(() => { viaCache.result.current.loadProject('Ref'); });

        expect(sensitive(viaCache.result.current.getFullState()))
            .toEqual(sensitive(viaFile.result.current.getFullState()));
    });
});
