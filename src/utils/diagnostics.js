/**
 * Generates a diagnostic report of the current application state.
 * Used by the user to report bugs — no personal data, no network calls,
 * downloaded locally as a plain text file.
 */
import { APP_VERSION, APP_NAME } from '../version';
import { getInterceptedEntries } from './errorInterceptor';
import { dataUrlBytes } from './imageCompressor';
import { getSwStatus } from './swStatus';

/**
 * Horodatage du build courant, injecté par vite.config.js. Absent en test et
 * dans tout contexte non bundlé — d'où le garde typeof.
 */
const buildDate = () => {
    try {
        if (typeof __BUILD_DATE__ === 'undefined') return null;
        return new Date(__BUILD_DATE__).toLocaleString('fr-FR');
    } catch {
        return null;
    }
};

/** Origine courante — le stockage local y est cloisonné (cf. section Stockage). */
const currentOrigin = () => {
    try {
        return window.location.origin || null;
    } catch {
        return null;
    }
};

const yesNo = (v) => (v ? 'oui' : 'non');

// Petits formatages locaux au rapport — gardés ici pour rester lisibles dans
// le texte plain (pas de "1,2 Mo" mais des Ko entiers, cohérent avec la ligne
// « Taille utilisée » du localStorage).
const formatKb = (bytes) => (bytes > 0 ? `${Math.round(bytes / 1024)} Ko` : null);

// Estime la taille en octets du projet une fois sérialisé (ce que ferait un
// Enregistrer sous). Image comprise. Approche caractères ≈ octets (base64 +
// ASCII : précision largement suffisante pour un diagnostic).
const estimateProjectBytes = (ctx) => {
    try {
        const dump = JSON.stringify({
            intersectionName: ctx.intersectionName,
            projectName: ctx.projectName,
            groups: ctx.groups,
            cycleLength: ctx.cycleLength,
            conflictMatrix: ctx.conflictMatrix,
            pfTabs: ctx.pfTabs,
            activePFId: ctx.activePFId,
            intersectionImage: ctx.intersectionImage
        });
        return dump.length;
    } catch {
        return 0;
    }
};

/**
 * Estimate the size (in KB) currently used in localStorage.
 */
const estimateLocalStorageUsage = () => {
    try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            total += (key.length + (value ? value.length : 0)) * 2; // UTF-16
        }
        return Math.round(total / 1024);
    } catch {
        return null;
    }
};

/**
 * Detect the active theme from body class list.
 */
const detectTheme = () => {
    const c = document.body.classList;
    if (c.contains('high-contrast-mode')) return 'Haut contraste';
    if (c.contains('amber-mode')) return 'Ambre';
    if (c.contains('light-mode')) return 'Clair';
    if (c.contains('daltonian-mode')) return 'Daltonien';
    if (c.contains('sepia-mode')) return 'Sépia';
    if (c.contains('blue-night-mode')) return 'Bleu nuit';
    return 'Sombre (défaut)';
};

/**
 * Read a localStorage boolean with fallback.
 */
const lsBool = (key, fallback = true) => {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
};

/**
 * Short label for an intercepted entry type.
 */
const entryLabel = (type) => {
    if (type === 'error') return 'ERR';
    if (type === 'warn') return 'WARN';
    if (type === 'runtime') return 'RUN';
    if (type === 'promise') return 'PROM';
    return String(type).toUpperCase();
};

/**
 * Build the error journal as a standalone plain-text block.
 * Used both inside the full report and by the dedicated "Copier journal" button.
 */
export const buildErrorJournal = () => {
    const entries = getInterceptedEntries();
    const lines = [];
    lines.push(`Journal d'erreurs — ${APP_NAME} v${APP_VERSION}`);
    lines.push(`Généré le ${new Date().toLocaleString('fr-FR')}`);
    lines.push('');
    if (entries.length === 0) {
        lines.push('(aucune erreur ni avertissement intercepté durant cette session)');
    } else {
        lines.push(`${entries.length} entrée(s) (plus récentes en dernier) :`);
        lines.push('');
        entries.forEach(e => {
            lines.push(`[${e.ts}] ${entryLabel(e.type)} — ${e.message}`);
        });
    }
    return lines.join('\n');
};

/**
 * Build the full diagnostic report as a plain-text string.
 */
export const buildDiagnosticReport = (ctx) => {
    const {
        intersectionName,
        projectName,
        groups,
        pfTabs,
        activePFId,
        cycleLength,
        actionData,
        conflictMatrix,
        intersectionImage,
        imageNaturalDims,
        dossierReadOnly = false,
        activePfReadOnly = false,
        matricesLocked = false,
        includeProject = false,
        // Masque les noms de projet, de carrefour et de plan de feux. Actif par
        // défaut : un rapport est destiné à être collé dans une issue publique,
        // et ces noms désignent une commune et des rues réelles. Ils n'ont
        // aucune valeur de débogage.
        maskNames = true
    } = ctx;

    const now = new Date();
    const dateStr = now.toLocaleString('fr-FR');

    // Count non-empty actions
    const filledActions = (actionData || []).filter(a => a && a.action && a.action.trim() !== '').length;

    // Count conflicts (simple count of non-empty values outside diagonal)
    let matrixFilled = 0;
    let matrixSize = 0;
    if (Array.isArray(conflictMatrix)) {
        matrixSize = conflictMatrix.length;
        conflictMatrix.forEach((row, r) => {
            if (Array.isArray(row)) {
                row.forEach((v, c) => {
                    if (r !== c && v !== '' && v !== null && v !== undefined) matrixFilled++;
                });
            }
        });
    }

    const activePF = (pfTabs || []).find(p => p.id === activePFId);

    const lines = [];
    lines.push('═══════════════════════════════════════════════════════');
    lines.push(`  Rapport de diagnostic — ${APP_NAME}`);
    lines.push(`  Généré le ${dateStr}`);
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('');
    lines.push('## Application');
    lines.push(`  Version          : ${APP_VERSION}`);
    lines.push(`  Build            : ${buildDate() || 'indisponible (mode développement)'}`);
    lines.push(`  Thème actif      : ${detectTheme()}`);
    lines.push('');
    const sw = getSwStatus();
    lines.push('## Service worker (PWA)');
    lines.push(`  Support navigateur     : ${yesNo(sw.supported)}`);
    lines.push(`  Page contrôlée par SW  : ${sw.controlled ? `oui (${sw.state || 'état inconnu'})` : 'non (Ctrl+Shift+R, dev, premier chargement, ou SW désactivé)'}`);
    lines.push(`  Mise à jour en attente : ${yesNo(sw.updatePending)}`);
    if (sw.scriptUrl) lines.push(`  Script                 : ${sw.scriptUrl}`);
    // Les deux drapeaux se lisent ensemble : « mise à jour en attente » ne
    // signifie « code périmé » QUE si la page est contrôlée. Un rechargement
    // forcé contourne le SW (controller = null) : le code affiché vient alors
    // du réseau, et l'avertissement inverse serait un contresens.
    if (sw.updatePending && sw.controlled) {
        lines.push('  ⚠ Le code qui tourne peut être périmé : une nouvelle version est en');
        lines.push('    cache mais pas encore appliquée (bouton « Recharger »).');
    } else if (sw.updatePending && !sw.controlled) {
        lines.push('  → Page chargée depuis le réseau, SW contourné : le code affiché est à');
        lines.push('    jour. Une nouvelle version attend de prendre la main — une fenêtre');
        lines.push('    détachée restée ouverte peut retenir l\'ancienne.');
    }
    lines.push('');
    lines.push('## Environnement');
    lines.push(`  Navigateur       : ${navigator.userAgent}`);
    lines.push(`  Plateforme       : ${navigator.platform || 'n/a'}`);
    lines.push(`  Langue           : ${navigator.language || 'n/a'}`);
    lines.push(`  Résolution       : ${window.innerWidth} × ${window.innerHeight} px`);
    lines.push(`  DevicePixelRatio : ${window.devicePixelRatio || 1}`);
    lines.push(`  Écran total      : ${window.screen.width} × ${window.screen.height} px`);
    lines.push('');
    lines.push('## Préférences');
    lines.push(`  Notifications succès             : ${lsBool('toastPreferences.success', true) ? 'actif' : 'inactif'}`);
    lines.push(`  Notifications erreur             : ${lsBool('toastPreferences.error', true) ? 'actif' : 'inactif'}`);
    lines.push(`  Notifications info               : ${lsBool('toastPreferences.info', true) ? 'actif' : 'inactif'}`);
    lines.push(`  Ouvrir Propriétés (nouv. projet) : ${lsBool('openPropertiesOnNewProject') ? 'actif' : 'inactif'}`);
    lines.push(`  Flash valeur hors cycle          : ${lsBool('showWrapFlash') ? 'actif' : 'inactif'}`);
    lines.push(`  Rappel de sauvegarde             : ${lsBool('showSaveReminder') ? 'actif' : 'inactif'}`);
    lines.push('');
    lines.push('## Projet en cours');
    lines.push(`  Nom du projet    : ${maskNames ? '(masqué)' : (projectName || '(aucun)')}`);
    lines.push(`  Nom du carrefour : ${maskNames ? '(masqué)' : (intersectionName || '(aucun)')}`);
    lines.push(`  Groupes de feux  : ${(groups || []).length}`);
    lines.push(`  Plans de feux    : ${(pfTabs || []).length}`);
    lines.push(`  PF actif         : ${activePF ? (maskNames ? `(masqué) (id=${activePF.id})` : `${activePF.name} (id=${activePF.id})`) : '(aucun)'}`);
    lines.push(`  Durée du cycle   : ${cycleLength}s`);
    lines.push(`  Actions remplies : ${filledActions} / ${(actionData || []).length}`);
    lines.push(`  Matrice (taille) : ${matrixSize}×${matrixSize}`);
    lines.push(`  Matrice (cases remplies) : ${matrixFilled}`);
    const imageBytes = intersectionImage ? dataUrlBytes(intersectionImage) : 0;
    const imgW = (imageNaturalDims && imageNaturalDims.width) || 0;
    const imgH = (imageNaturalDims && imageNaturalDims.height) || 0;
    const imgKb = formatKb(imageBytes);
    const imgRes = (imgW > 1 && imgH > 1) ? `${imgW} × ${imgH} px` : null;
    const imgDetail = intersectionImage
        ? `chargée${imgKb ? ` — ${imgKb}` : ''}${imgRes ? `, ${imgRes}` : ''}`
        : 'absente';
    lines.push(`  Image carrefour  : ${imgDetail}`);

    const projectBytes = estimateProjectBytes(ctx);
    const projectKb = formatKb(projectBytes);
    lines.push(`  Taille JSON      : ${projectKb || 'indisponible'} (projet sérialisé, image comprise)`);
    lines.push('');
    const readOnlyPfCount = (pfTabs || []).filter(pf => pf.readOnly).length;
    lines.push('## Verrous');
    lines.push(`  Dossier en lecture seule  : ${yesNo(dossierReadOnly)}`);
    lines.push(`  PF actif en lecture seule : ${yesNo(activePfReadOnly)}`);
    lines.push(`  Matrices verrouillées     : ${yesNo(matricesLocked)}`);
    lines.push(`  PF verrouillés            : ${readOnlyPfCount} / ${(pfTabs || []).length}`);
    if (dossierReadOnly || activePfReadOnly) {
        lines.push('  ⚠ Édition bloquée par un verrou — une modification refusée est');
        lines.push('    ici un fonctionnement attendu, pas un bug.');
    }
    lines.push('');
    lines.push('## Détail des plans de feux');
    (pfTabs || []).forEach(pf => {
        const nbGreens = Array.isArray(pf.diagram) ? pf.diagram.filter(d => d.greenDuration > 0).length : 0;
        const nbActions = Array.isArray(pf.data) ? pf.data.filter(a => a && a.action && a.action.trim() !== '').length : 0;
        const flags = [];
        if (pf.readOnly) flags.push('lecture seule');
        if (pf.color) flags.push(`validé (${pf.color})`);
        lines.push(`  • ${maskNames ? '(masqué)' : pf.name} (id=${pf.id}) — verts configurés: ${nbGreens}, actions: ${nbActions}${flags.length ? `, ${flags.join(', ')}` : ''}`);
    });
    lines.push('');
    lines.push('## Stockage local');
    const lsKb = estimateLocalStorageUsage();
    lines.push(`  Origine          : ${currentOrigin() || 'indisponible'}`);
    lines.push(`  (le stockage est cloisonné par origine : un autre port = un autre cache)`);
    lines.push(`  Taille utilisée  : ${lsKb !== null ? `${lsKb} Ko` : 'indisponible'}`);
    lines.push(`  Quota estimé     : ~5 120 Ko (5 Mo typique)`);
    if (lsKb !== null && lsKb > 4000) {
        lines.push(`  ⚠ Quota presque atteint — risque de warnings « quota exceeded »`);
    }
    lines.push('');

    lines.push('## Journal d\'erreurs récent');
    const entries = getInterceptedEntries();
    if (entries.length === 0) {
        lines.push('  (aucune erreur ni avertissement intercepté durant cette session)');
    } else {
        lines.push(`  ${entries.length} entrée(s) interceptée(s) (plus récentes en dernier) :`);
        lines.push('');
        entries.forEach(e => {
            lines.push(`  [${e.ts}] ${entryLabel(e.type)} — ${e.message}`);
        });
    }
    lines.push('');

    if (includeProject) {
        lines.push('## Dump du projet (JSON)');
        lines.push('');
        try {
            const dump = JSON.stringify({
                intersectionName,
                projectName,
                groups,
                cycleLength,
                conflictMatrix,
                pfTabs,
                activePFId
            }, null, 2);
            lines.push(dump);
        } catch (e) {
            lines.push(`(échec sérialisation : ${e.message})`);
        }
        lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════');
    lines.push('  Fin du rapport');
    lines.push('═══════════════════════════════════════════════════════');

    return lines.join('\n');
};

/**
 * Build a structured JSON diagnostic object — machine-readable equivalent
 * of buildDiagnosticReport. Easier to parse / forward automatically.
 */
export const buildDiagnosticJSON = (ctx) => {
    const {
        intersectionName,
        projectName,
        groups,
        pfTabs,
        activePFId,
        cycleLength,
        actionData,
        conflictMatrix,
        intersectionImage,
        imageNaturalDims,
        dossierReadOnly = false,
        activePfReadOnly = false,
        matricesLocked = false,
        includeProject = false,
        // Masque les noms de projet, de carrefour et de plan de feux. Actif par
        // défaut : un rapport est destiné à être collé dans une issue publique,
        // et ces noms désignent une commune et des rues réelles. Ils n'ont
        // aucune valeur de débogage.
        maskNames = true
    } = ctx;

    const filledActions = (actionData || []).filter(a => a && a.action && a.action.trim() !== '').length;

    let matrixFilled = 0;
    let matrixSize = 0;
    if (Array.isArray(conflictMatrix)) {
        matrixSize = conflictMatrix.length;
        conflictMatrix.forEach((row, r) => {
            if (Array.isArray(row)) {
                row.forEach((v, c) => {
                    if (r !== c && v !== '' && v !== null && v !== undefined) matrixFilled++;
                });
            }
        });
    }

    const activePF = (pfTabs || []).find(p => p.id === activePFId);
    const lsKb = estimateLocalStorageUsage();
    const entries = getInterceptedEntries();

    const out = {
        meta: {
            format: 'diagram-feux-diagnostic-v1',
            generatedAt: new Date().toISOString()
        },
        app: {
            name: APP_NAME,
            version: APP_VERSION,
            buildDate: (typeof __BUILD_DATE__ === 'undefined') ? null : __BUILD_DATE__,
            theme: detectTheme()
        },
        serviceWorker: getSwStatus(),
        environment: {
            userAgent: navigator.userAgent,
            platform: navigator.platform || null,
            language: navigator.language || null,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            screen: { width: window.screen.width, height: window.screen.height },
            devicePixelRatio: window.devicePixelRatio || 1
        },
        preferences: {
            toastSuccess: lsBool('toastPreferences.success', true),
            toastError: lsBool('toastPreferences.error', true),
            toastInfo: lsBool('toastPreferences.info', true),
            openPropertiesOnNewProject: lsBool('openPropertiesOnNewProject'),
            showWrapFlash: lsBool('showWrapFlash'),
            showSaveReminder: lsBool('showSaveReminder')
        },
        project: {
            name: maskNames ? null : (projectName || null),
            intersectionName: maskNames ? null : (intersectionName || null),
            cycleLength,
            groupCount: (groups || []).length,
            pfCount: (pfTabs || []).length,
            activePFId: activePFId || null,
            activePFName: activePF ? (maskNames ? null : activePF.name) : null,
            filledActions,
            totalActions: (actionData || []).length,
            matrixSize,
            matrixFilled,
            hasImage: !!intersectionImage,
            imageBytes: intersectionImage ? dataUrlBytes(intersectionImage) : 0,
            imageWidth: (imageNaturalDims && imageNaturalDims.width > 1) ? imageNaturalDims.width : null,
            imageHeight: (imageNaturalDims && imageNaturalDims.height > 1) ? imageNaturalDims.height : null,
            projectBytes: estimateProjectBytes(ctx)
        },
        locks: {
            dossierReadOnly: !!dossierReadOnly,
            activePfReadOnly: !!activePfReadOnly,
            matricesLocked: !!matricesLocked,
            readOnlyPfCount: (pfTabs || []).filter(pf => pf.readOnly).length
        },
        pfDetails: (pfTabs || []).map(pf => ({
            id: pf.id,
            name: maskNames ? null : pf.name,
            greensConfigured: Array.isArray(pf.diagram) ? pf.diagram.filter(d => d.greenDuration > 0).length : 0,
            actionsFilled: Array.isArray(pf.data) ? pf.data.filter(a => a && a.action && a.action.trim() !== '').length : 0,
            readOnly: !!pf.readOnly,
            validated: pf.color || null
        })),
        storage: {
            origin: currentOrigin(),
            usageKb: lsKb,
            quotaKbEstimate: 5120,
            quotaWarning: lsKb !== null && lsKb > 4000
        },
        errorJournal: {
            count: entries.length,
            entries: entries.map(e => ({ ts: e.ts, type: e.type, message: e.message }))
        }
    };

    if (includeProject) {
        try {
            out.projectDump = {
                intersectionName,
                projectName,
                groups,
                cycleLength,
                conflictMatrix,
                pfTabs,
                activePFId
            };
        } catch (e) {
            out.projectDump = { error: e.message };
        }
    }

    return out;
};

/**
 * Build a datestamped filename part — yyyy-mm-dd_hh-mm.
 */
const datePart = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Trigger download of a Blob with the given filename.
 */
const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Trigger download of the report as a .txt file.
 */
export const downloadDiagnosticReport = (content, filename = 'diagnostic') => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `${filename}_${datePart()}.txt`);
};

/**
 * Trigger download of the structured diagnostic as a .json file.
 */
export const downloadDiagnosticJSON = (obj, filename = 'diagnostic') => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerDownload(blob, `${filename}_${datePart()}.json`);
};
