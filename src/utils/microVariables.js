/**
 * Variables prédéfinies de micro-régulation (Priorité Bus).
 *
 * Source unique partagée par :
 *  - la coloration violette des conditions micro (tableau + infobulle),
 *  - la fenêtre de référence « Variables Priorité Bus » (menu Options).
 *
 * La liste est éditable par l'utilisateur et persistée dans les réglages de
 * l'application (localStorage), avec repli sur les valeurs par défaut.
 */

export const DEFAULT_MICRO_VARIABLES = [
    { name: 'DA', description: "Délai d'Approche — temps de parcours entre le point d'appel et la ligne d'effet." },
    { name: 'TPPh', description: 'Temps Passé dans la Phase — temps écoulé depuis le début de la phase en cours.' },
    { name: 'AVer', description: "Avant vert — temps résiduel avant l'apparition du vert d'un groupe. Reconnu avec ou sans le T final (AVer couvre aussi AVert)." },
    { name: 'TMAB', description: "Temps Moyen d'Attente Bus — indicateur de performance de la priorité bus." },
];

const STORAGE_KEY = 'tracflux.microVariables';

/** Nettoie une liste arbitraire en entrées { name, description } valides. */
const sanitize = (list) => {
    if (!Array.isArray(list)) return null;
    const seen = new Set();
    const clean = [];
    for (const v of list) {
        if (!v || typeof v.name !== 'string') continue;
        const name = v.name.trim();
        if (name === '' || seen.has(name)) continue;
        seen.add(name);
        clean.push({ name, description: typeof v.description === 'string' ? v.description : '' });
    }
    return clean;
};

const defaultsCopy = () => DEFAULT_MICRO_VARIABLES.map(v => ({ ...v }));

export const loadMicroVariables = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultsCopy();
        const clean = sanitize(JSON.parse(raw));
        return clean && clean.length ? clean : defaultsCopy();
    } catch {
        return defaultsCopy();
    }
};

export const saveMicroVariables = (list) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(list) || []));
    } catch {
        /* quota / mode privé : la coloration reste correcte en mémoire */
    }
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Alternation des noms de variables, plus longs d'abord (AVert avant AVer).
 * Cosmétique ici car le mot entier est capturé, mais correct. Renvoie un motif
 * qui ne matche jamais si la liste est vide.
 */
export const microNamesPattern = (names) => {
    const valid = [...new Set((names || []).filter(Boolean))]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp);
    return valid.length ? valid.join('|') : '(?!)';
};

/**
 * Tokenise une condition micro pour l'affichage :
 *  - type 'keyword' : une variable prédéfinie (violet),
 *  - type 'bold'    : la syntaxe {}[]() et les connecteurs « et » / « ou »,
 *  - type 'text'    : le reste.
 * Le découpage reproduit à l'identique l'ancienne regex en dur, mais avec la
 * liste de noms fournie par l'appelant.
 */
export const tokenizeMicroText = (text, names) => {
    const pat = microNamesPattern(names);
    const splitRe = new RegExp(`(\\b\\w*(?:${pat})\\w*\\b|[{}\\[\\]()]|\\b(?:et|ou)\\b)`, 'g');
    const keywordRe = new RegExp(`(?:${pat})`);
    return (text || '').split(splitRe).map((part) => {
        if (!part) return { text: '', type: 'text' };
        if (/\w/.test(part) && keywordRe.test(part)) return { text: part, type: 'keyword' };
        if (/^[{}\[\]()]$/.test(part) || /^(et|ou)$/.test(part)) return { text: part, type: 'bold' };
        return { text: part, type: 'text' };
    });
};
