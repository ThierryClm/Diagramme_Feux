import { describe, it, expect, beforeEach } from 'vitest';
import {
    buildErrorJournal,
    buildDiagnosticReport,
    buildDiagnosticJSON
} from './diagnostics';
import { clearInterceptedEntries, installErrorInterceptor } from './errorInterceptor';
import { APP_NAME, APP_VERSION } from '../version';

// Ensure a deterministic starting point for each test: no intercepted entries,
// clean localStorage, default theme, and the interceptor already installed so
// any subsequent console usage is captured (and can then be cleared).
beforeEach(() => {
    installErrorInterceptor();
    clearInterceptedEntries();
    localStorage.clear();
    document.body.className = '';
});

// ---------------- buildErrorJournal ----------------

describe('buildErrorJournal', () => {
    it('contient l\'en-tête avec nom et version de l\'app', () => {
        const out = buildErrorJournal();
        expect(out).toContain(APP_NAME);
        expect(out).toContain(`v${APP_VERSION}`);
    });

    it('message spécifique quand le buffer est vide', () => {
        const out = buildErrorJournal();
        expect(out).toMatch(/aucune erreur ni avertissement/);
    });

    it('liste les entrées interceptées avec leurs types traduits', () => {
        console.warn('attention');
        console.error('oups');
        const out = buildErrorJournal();
        expect(out).toMatch(/WARN.*attention/);
        expect(out).toMatch(/ERR.*oups/);
    });

    it('indique le nombre d\'entrées en tête de liste', () => {
        console.warn('a');
        console.warn('b');
        console.warn('c');
        const out = buildErrorJournal();
        expect(out).toMatch(/3 entrée\(s\)/);
    });
});

// ---------------- buildDiagnosticReport ----------------

const baseCtx = () => ({
    intersectionName: 'Carrefour Test',
    projectName: 'Projet Test',
    groups: [
        { id: 1, name: 'GF1', durations: { green: 30, orange: 3, red: 57 } },
        { id: 2, name: 'GF2', durations: { green: 25, orange: 3, red: 62 } }
    ],
    pfTabs: [
        { id: 1, name: 'PF Jour', diagram: [{ greenDuration: 30 }], data: [{ action: 'Point de repos' }] },
        { id: 2, name: 'PF Nuit', color: 'green' }
    ],
    activePFId: 1,
    cycleLength: 90,
    actionData: [
        { action: 'Démarrage' },
        { action: '' },
        { action: 'Synchro BTS' }
    ],
    conflictMatrix: [
        ['', 5],
        [5, '']
    ],
    intersectionImage: null
});

describe('buildDiagnosticReport — structure', () => {
    it('inclut toutes les sections attendues', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toContain('## Application');
        expect(out).toContain('## Environnement');
        expect(out).toContain('## Préférences');
        expect(out).toContain('## Projet en cours');
        expect(out).toContain('## Détail des plans de feux');
        expect(out).toContain('## Stockage local');
        expect(out).toContain('## Journal d\'erreurs récent');
    });

    it('contient la version de l\'app', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toContain(APP_VERSION);
    });
});

describe('buildDiagnosticReport — données projet', () => {
    it('compte les groupes et les plans de feux', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Groupes de feux\s+:\s+2/);
        expect(out).toMatch(/Plans de feux\s+:\s+2/);
    });

    it('ne compte que les actions non vides', () => {
        const out = buildDiagnosticReport(baseCtx());
        // 2 actions remplies (« Démarrage », « Synchro BTS ») sur 3 totales
        expect(out).toMatch(/Actions remplies\s+:\s+2 \/ 3/);
    });

    it('compte les cases de matrice hors diagonale', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Matrice \(cases remplies\)\s+:\s+2/);
    });

    it('indique le PF actif par nom et id', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/PF actif\s+:\s+PF Jour \(id=1\)/);
    });

    it('indique "(aucun)" si pas de PF actif', () => {
        const ctx = baseCtx();
        ctx.activePFId = 999;
        const out = buildDiagnosticReport(ctx);
        expect(out).toMatch(/PF actif\s+:\s+\(aucun\)/);
    });

    it('mentionne la présence ou l\'absence d\'image', () => {
        const out1 = buildDiagnosticReport(baseCtx());
        expect(out1).toMatch(/Image carrefour\s+:\s+absente/);

        const ctx2 = baseCtx();
        ctx2.intersectionImage = 'data:image/png;base64,...';
        const out2 = buildDiagnosticReport(ctx2);
        expect(out2).toMatch(/Image carrefour\s+:\s+chargée/);
    });

    it('détaille chaque PF avec le nombre de verts et d\'actions', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/PF Jour.*verts configurés: 1, actions: 1/);
        expect(out).toMatch(/PF Nuit.*validé \(green\)/);
    });
});

describe('buildDiagnosticReport — thème', () => {
    it('thème par défaut "Sombre"', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Thème actif\s+:\s+Sombre/);
    });

    it('thème "Clair" détecté via body.className', () => {
        document.body.classList.add('light-mode');
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Thème actif\s+:\s+Clair/);
    });

    it('thème "Haut contraste" prioritaire sur les autres', () => {
        document.body.classList.add('high-contrast-mode', 'light-mode');
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Thème actif\s+:\s+Haut contraste/);
    });

    it('thème "Ambre"', () => {
        document.body.classList.add('amber-mode');
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Thème actif\s+:\s+Ambre/);
    });
});

describe('buildDiagnosticReport — dump projet optionnel', () => {
    it('omet le dump par défaut', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).not.toContain('## Dump du projet');
    });

    it('inclut le dump quand includeProject=true', () => {
        const ctx = { ...baseCtx(), includeProject: true };
        const out = buildDiagnosticReport(ctx);
        expect(out).toContain('## Dump du projet');
        expect(out).toContain('"projectName": "Projet Test"');
    });
});

describe('buildDiagnosticReport — robustesse', () => {
    it('supporte un contexte minimal (pas de groupes, pas de pfTabs)', () => {
        const out = buildDiagnosticReport({
            intersectionName: '',
            projectName: '',
            groups: [],
            pfTabs: [],
            activePFId: null,
            cycleLength: 60,
            actionData: [],
            conflictMatrix: [],
            intersectionImage: null
        });
        expect(out).toMatch(/Groupes de feux\s+:\s+0/);
        expect(out).toMatch(/Nom du projet\s+:\s+\(aucun\)/);
    });

    it('inclut les entrées du journal d\'erreurs', () => {
        console.error('erreur de test');
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/ERR.*erreur de test/);
    });
});

// ---------------- buildDiagnosticJSON ----------------

describe('buildDiagnosticJSON — méta & structure', () => {
    it('a un format versionné stable', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.meta.format).toBe('diagram-feux-diagnostic-v1');
    });

    it('a un timestamp ISO', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('contient toutes les sections attendues', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j).toHaveProperty('app');
        expect(j).toHaveProperty('environment');
        expect(j).toHaveProperty('preferences');
        expect(j).toHaveProperty('project');
        expect(j).toHaveProperty('pfDetails');
        expect(j).toHaveProperty('storage');
        expect(j).toHaveProperty('errorJournal');
    });
});

describe('buildDiagnosticJSON — données projet', () => {
    it('compte correctement les groupes, PF, actions remplies', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.project.groupCount).toBe(2);
        expect(j.project.pfCount).toBe(2);
        expect(j.project.filledActions).toBe(2);
        expect(j.project.totalActions).toBe(3);
        expect(j.project.matrixSize).toBe(2);
        expect(j.project.matrixFilled).toBe(2);
    });

    it('résout le nom du PF actif', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.project.activePFId).toBe(1);
        expect(j.project.activePFName).toBe('PF Jour');
    });

    it('met hasImage à false quand intersectionImage est null', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.project.hasImage).toBe(false);
    });

    it('détaille chaque PF', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.pfDetails).toHaveLength(2);
        expect(j.pfDetails[0]).toMatchObject({
            id: 1,
            name: 'PF Jour',
            greensConfigured: 1,
            actionsFilled: 1
        });
        expect(j.pfDetails[1]).toMatchObject({
            id: 2,
            name: 'PF Nuit',
            validated: 'green'
        });
    });
});

describe('buildDiagnosticJSON — journal et dump', () => {
    it('errorJournal vide par défaut', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.errorJournal.count).toBe(0);
        expect(j.errorJournal.entries).toEqual([]);
    });

    it('errorJournal remonte les entrées interceptées', () => {
        console.warn('test warning');
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.errorJournal.count).toBe(1);
        expect(j.errorJournal.entries[0].type).toBe('warn');
        expect(j.errorJournal.entries[0].message).toContain('test warning');
    });

    it('projectDump omis par défaut', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.projectDump).toBeUndefined();
    });

    it('projectDump présent quand includeProject=true', () => {
        const j = buildDiagnosticJSON({ ...baseCtx(), includeProject: true });
        expect(j.projectDump).toBeDefined();
        expect(j.projectDump.projectName).toBe('Projet Test');
        expect(j.projectDump.groups).toHaveLength(2);
    });
});

describe('buildDiagnosticJSON — préférences', () => {
    it('lit les préférences depuis localStorage', () => {
        localStorage.setItem('toastPreferences.success', 'false');
        localStorage.setItem('showSaveReminder', 'true');
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.preferences.toastSuccess).toBe(false);
        expect(j.preferences.showSaveReminder).toBe(true);
    });

    it('applique les valeurs par défaut en l\'absence de préférence stockée', () => {
        const j = buildDiagnosticJSON(baseCtx());
        // toastSuccess default = true
        expect(j.preferences.toastSuccess).toBe(true);
        expect(j.preferences.toastError).toBe(true);
    });
});
