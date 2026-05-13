/**
 * Validates that a parsed JSON object looks like a Diagramme de Feux project.
 *
 * Returns:
 *   { ok: true,  warnings: string[] }  → safe to load (warnings are non-blocking)
 *   { ok: false, error: string, warnings: string[] } → reject with user-visible message
 *
 * Validation policy: strict on "is this our file format?", tolerant on
 * individual fields (we can still load a partial project). This prevents
 * accidentally loading unrelated JSON (logs, configuration files, etc.)
 * while remaining forward/backward compatible with schema tweaks.
 */
export const validateProject = (data) => {
    const warnings = [];

    // Must be a plain object (not null, not array, not scalar)
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return {
            ok: false,
            error: 'Le fichier ne contient pas un objet de projet valide (attendu : un objet JSON).',
            warnings
        };
    }

    // Must have at least one schema-specific marker — prevents accidentally
    // loading random JSON from another app
    const hasGroups = Array.isArray(data.groups);
    const hasPfTabs = Array.isArray(data.pfTabs);
    const hasCycle = typeof data.cycleLength === 'number';
    const hasMatrix = Array.isArray(data.conflictMatrix);
    // Signature spécifique de l'onde verte (module Onde verte de TraCflux)
    const looksLikeGreenWave = Array.isArray(data.intersections);

    if (!hasGroups && !hasPfTabs && !hasCycle && !hasMatrix) {
        if (looksLikeGreenWave) {
            return {
                ok: false,
                error: "Ce fichier est une onde verte, pas un projet de carrefour. Pour l'ouvrir, utilisez le module Onde verte (menu Onde verte de la fenêtre principale, puis Fichier → Ouvrir).",
                warnings
            };
        }
        return {
            ok: false,
            error: 'Le fichier ne ressemble pas à un projet TraCflux (aucun des champs attendus : groups, pfTabs, cycleLength, conflictMatrix).',
            warnings
        };
    }

    // Soft warnings — common fields missing, but loadable
    if (!hasGroups) warnings.push('Aucun groupe de feux trouvé (groups manquant).');
    if (!hasCycle) warnings.push('Longueur de cycle non spécifiée — valeur par défaut utilisée.');
    if (!hasMatrix) warnings.push('Matrice de conflits non fournie — elle sera vide.');

    // Per-group sanity checks
    if (hasGroups) {
        data.groups.forEach((g, i) => {
            if (!g || typeof g !== 'object') {
                warnings.push(`Groupe ${i} : format inattendu, peut être ignoré au chargement.`);
                return;
            }
            if (g.id === undefined || g.id === null) warnings.push(`Groupe ${i} : identifiant manquant (id).`);
            if (!g.name) warnings.push(`Groupe ${i} : nom manquant (name).`);
            if (!g.durations || typeof g.durations !== 'object') {
                warnings.push(`Groupe ${i} : durées manquantes (durations).`);
            }
        });
    }

    // Per-PF sanity checks
    if (hasPfTabs) {
        data.pfTabs.forEach((pf, i) => {
            if (!pf || typeof pf !== 'object') {
                warnings.push(`Plan de feux ${i} : format inattendu.`);
                return;
            }
            if (pf.id === undefined || pf.id === null) warnings.push(`Plan de feux ${i} : identifiant manquant (id).`);
            if (!pf.name) warnings.push(`Plan de feux ${i} : nom manquant (name).`);
        });
    }

    // Conflict matrix shape (if groups present)
    if (hasGroups && hasMatrix) {
        const n = data.groups.length;
        if (data.conflictMatrix.length !== n) {
            warnings.push(`Matrice de conflits : ${data.conflictMatrix.length} ligne(s) pour ${n} groupe(s) — incohérence probable.`);
        }
    }

    return { ok: true, warnings };
};
