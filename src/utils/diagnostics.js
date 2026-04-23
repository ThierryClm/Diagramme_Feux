/**
 * Generates a diagnostic report of the current application state.
 * Used by the user to report bugs — no personal data, no network calls,
 * downloaded locally as a plain text file.
 */
import { APP_VERSION, APP_NAME } from '../version';
import { getInterceptedEntries } from './errorInterceptor';

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
        includeProject = false
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
    lines.push(`  Thème actif      : ${detectTheme()}`);
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
    lines.push(`  Nom du projet    : ${projectName || '(aucun)'}`);
    lines.push(`  Nom du carrefour : ${intersectionName || '(aucun)'}`);
    lines.push(`  Groupes de feux  : ${(groups || []).length}`);
    lines.push(`  Plans de feux    : ${(pfTabs || []).length}`);
    lines.push(`  PF actif         : ${activePF ? `${activePF.name} (id=${activePF.id})` : '(aucun)'}`);
    lines.push(`  Durée du cycle   : ${cycleLength}s`);
    lines.push(`  Actions remplies : ${filledActions} / ${(actionData || []).length}`);
    lines.push(`  Matrice (taille) : ${matrixSize}×${matrixSize}`);
    lines.push(`  Matrice (cases remplies) : ${matrixFilled}`);
    lines.push(`  Image carrefour  : ${intersectionImage ? 'chargée' : 'absente'}`);
    lines.push('');
    lines.push('## Détail des plans de feux');
    (pfTabs || []).forEach(pf => {
        const nbGreens = Array.isArray(pf.diagram) ? pf.diagram.filter(d => d.greenDuration > 0).length : 0;
        const nbActions = Array.isArray(pf.data) ? pf.data.filter(a => a && a.action && a.action.trim() !== '').length : 0;
        lines.push(`  • ${pf.name} (id=${pf.id}) — verts configurés: ${nbGreens}, actions: ${nbActions}${pf.color ? `, validé (${pf.color})` : ''}`);
    });
    lines.push('');
    lines.push('## Stockage local');
    const lsKb = estimateLocalStorageUsage();
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
            const label = e.type === 'error' ? 'ERR'
                : e.type === 'warn' ? 'WARN'
                : e.type === 'runtime' ? 'RUN'
                : e.type === 'promise' ? 'PROM'
                : e.type.toUpperCase();
            lines.push(`  [${e.ts}] ${label} — ${e.message}`);
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
 * Trigger download of the report as a .txt file.
 */
export const downloadDiagnosticReport = (content, filename = 'diagnostic') => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const d = new Date();
    const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
    link.download = `${filename}_${datePart}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
