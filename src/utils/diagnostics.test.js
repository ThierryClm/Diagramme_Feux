import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    buildErrorJournal,
    buildDiagnosticReport,
    buildDiagnosticJSON
} from './diagnostics';
import { clearInterceptedEntries, installErrorInterceptor } from './errorInterceptor';
import { setSwUpdatePending, setSwRegisteredUrl, resetSwStatus } from './swStatus';
import { APP_NAME, APP_VERSION } from '../version';

// Ensure a deterministic starting point for each test: no intercepted entries,
// clean localStorage, default theme, and the interceptor already installed so
// any subsequent console usage is captured (and can then be cleared).
beforeEach(() => {
    installErrorInterceptor();
    clearInterceptedEntries();
    localStorage.clear();
    document.body.className = '';
    // Le registre SW est un module singleton : sans reset, un test qui pose une
    // mise à jour en attente contaminerait les suivants.
    resetSwStatus();
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
        expect(out).toContain('## Service worker (PWA)');
        expect(out).toContain('## Environnement');
        expect(out).toContain('## Préférences');
        expect(out).toContain('## Projet en cours');
        expect(out).toContain('## Verrous');
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
        const out = buildDiagnosticReport({ ...baseCtx(), maskNames: false });
        expect(out).toMatch(/PF actif\s+:\s+PF Jour \(id=1\)/);
    });

    // Masquage par défaut : un rapport est destiné à une issue publique, et
    // ces noms désignent une commune et des rues réelles.
    it('masque les noms par défaut', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Nom du projet\s+:\s+\(masqué\)/);
        expect(out).toMatch(/Nom du carrefour\s+:\s+\(masqué\)/);
        expect(out).not.toContain('PF Jour');
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
        const out = buildDiagnosticReport({ ...baseCtx(), maskNames: false });
        expect(out).toMatch(/PF Jour.*verts configurés: 1, actions: 1/);
        expect(out).toMatch(/PF Nuit.*validé \(green\)/);
    });
});

describe('buildDiagnosticReport — thème', () => {
    it('thème par défaut "Sombre"', () => {
        const out = buildDiagnosticReport({ ...baseCtx(), maskNames: false });
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

    it('thème "Daltonien"', () => {
        document.body.classList.add('daltonian-mode');
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Thème actif\s+:\s+Daltonien/);
    });

    it('thème "Sépia"', () => {
        document.body.classList.add('sepia-mode');
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Thème actif\s+:\s+Sépia/);
    });

    it('thème "Bleu nuit"', () => {
        document.body.classList.add('blue-night-mode');
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Thème actif\s+:\s+Bleu nuit/);
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
            intersectionImage: null,
            maskNames: false
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
        const j = buildDiagnosticJSON({ ...baseCtx(), maskNames: false });
        expect(j.project.activePFId).toBe(1);
        expect(j.project.activePFName).toBe('PF Jour');
    });

    it('masque les noms par défaut', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.project.name).toBeNull();
        expect(j.project.intersectionName).toBeNull();
        expect(j.project.activePFName).toBeNull();
    });

    it('met hasImage à false quand intersectionImage est null', () => {
        const j = buildDiagnosticJSON(baseCtx());
        expect(j.project.hasImage).toBe(false);
    });

    it('détaille chaque PF', () => {
        const j = buildDiagnosticJSON({ ...baseCtx(), maskNames: false });
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

// ---------------- Verrous ----------------
// Chaque cas ci-dessous correspond à un incident vécu : un rapport muet sur les
// verrous laissait croire à un bug alors que l'édition était simplement bloquée.

describe('rapport — verrous', () => {
    it('signale un dossier en lecture seule, texte et JSON', () => {
        const ctx = { ...baseCtx(), dossierReadOnly: true };
        const out = buildDiagnosticReport(ctx);
        expect(out).toMatch(/Dossier en lecture seule\s+:\s+oui/);
        expect(out).toMatch(/Édition bloquée par un verrou/);
        expect(buildDiagnosticJSON(ctx).locks.dossierReadOnly).toBe(true);
    });

    it('verrous à « non » par défaut, sans avertissement', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Dossier en lecture seule\s+:\s+non/);
        expect(out).toMatch(/Matrices verrouillées\s+:\s+non/);
        expect(out).not.toMatch(/Édition bloquée par un verrou/);
    });

    it('compte les PF verrouillés et les marque dans le détail', () => {
        const ctx = baseCtx();
        ctx.pfTabs = [
            { id: 1, name: 'PF Jour' },
            { id: 2, name: 'Ref_ext', readOnly: true }
        ];
        const out = buildDiagnosticReport({ ...ctx, maskNames: false });
        expect(out).toMatch(/PF verrouillés\s+:\s+1 \/ 2/);
        expect(out).toMatch(/Ref_ext.*lecture seule/);
        expect(out).not.toMatch(/PF Jour.*lecture seule/);
        const j = buildDiagnosticJSON(ctx);
        expect(j.locks.readOnlyPfCount).toBe(1);
        expect(j.pfDetails[0].readOnly).toBe(false);
        expect(j.pfDetails[1].readOnly).toBe(true);
    });

    it('remonte le verrou des matrices et celui du PF actif', () => {
        const ctx = { ...baseCtx(), matricesLocked: true, activePfReadOnly: true };
        const out = buildDiagnosticReport(ctx);
        expect(out).toMatch(/Matrices verrouillées\s+:\s+oui/);
        expect(out).toMatch(/PF actif en lecture seule\s+:\s+oui/);
        const j = buildDiagnosticJSON(ctx);
        expect(j.locks.matricesLocked).toBe(true);
        expect(j.locks.activePfReadOnly).toBe(true);
    });

    it('conserve la mention « validé » à côté du verrou', () => {
        const ctx = baseCtx();
        ctx.pfTabs = [{ id: 1, name: 'Ref_ext', readOnly: true, color: 'green' }];
        const out = buildDiagnosticReport({ ...ctx, maskNames: false });
        expect(out).toMatch(/Ref_ext.*lecture seule, validé \(green\)/);
    });
});

// ---------------- Origine du stockage ----------------
// L'affaire des « 6 projets au lieu de 15 » : le localStorage est cloisonné par
// origine (:3000 ≠ :4173) et le rapport ne disait pas laquelle il décrivait.

describe('rapport — origine du stockage', () => {
    it('indique l\'origine et rappelle le cloisonnement', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toContain(window.location.origin);
        expect(out).toMatch(/cloisonné par origine/);
    });

    it('expose l\'origine en JSON', () => {
        expect(buildDiagnosticJSON(baseCtx()).storage.origin).toBe(window.location.origin);
    });
});

// ---------------- Service worker ----------------
// Deux fois, un bundle périmé a été pris pour un bug de rendu.

describe('rapport — service worker', () => {
    // jsdom n'implémente pas serviceWorker : on le simule pour couvrir les deux
    // lectures croisées. Sans contrôleur simulé, on est dans l'état « page non
    // contrôlée », qui est justement celui d'après Ctrl+Shift+R.
    const mockController = (controller) => {
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: { controller }
        });
    };
    afterEach(() => { delete navigator.serviceWorker; });

    it('page contrôlée + mise à jour en attente → avertit d\'un code périmé', () => {
        mockController({ state: 'activated', scriptURL: 'http://localhost:4173/sw.js' });
        setSwUpdatePending(true);
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Page contrôlée par SW\s+:\s+oui \(activated\)/);
        expect(out).toMatch(/Le code qui tourne peut être périmé/);
        expect(out).not.toMatch(/SW contourné/);
    });

    it('page NON contrôlée + mise à jour en attente → aucun soupçon de code périmé', () => {
        // L'état d'après Ctrl+Shift+R : le SW est contourné, le code affiché vient
        // du réseau. Avertir d'un bundle périmé ici serait le contresens exact.
        setSwUpdatePending(true);
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Page contrôlée par SW\s+:\s+non \(Ctrl\+Shift\+R/);
        expect(out).toMatch(/le code affiché est à\s*\n?\s*jour/);
        expect(out).not.toMatch(/peut être périmé/);
    });

    it('aucune mise à jour en attente → aucun des deux messages', () => {
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toMatch(/Mise à jour en attente\s+:\s+non/);
        expect(out).not.toMatch(/peut être périmé/);
        expect(out).not.toMatch(/SW contourné/);
        expect(buildDiagnosticJSON(baseCtx()).serviceWorker.updatePending).toBe(false);
    });

    it('mentionne le rechargement forcé parmi les causes de « non contrôlée »', () => {
        // Le message d'origine listait « dev, premier chargement, SW désactivé »
        // en oubliant Ctrl+Shift+R — la cause la plus fréquente à l'usage.
        expect(buildDiagnosticReport(baseCtx())).toMatch(/Ctrl\+Shift\+R/);
    });

    it('absolutise l\'URL du script enregistré (elle révèle le port)', () => {
        setSwRegisteredUrl('./sw.js');
        const out = buildDiagnosticReport(baseCtx());
        expect(out).toContain(`Script                 : ${window.location.origin}/sw.js`);
    });

    it('expose une ligne Build dans la section Application', () => {
        expect(buildDiagnosticReport(baseCtx())).toMatch(/Build\s+:/);
    });
});
