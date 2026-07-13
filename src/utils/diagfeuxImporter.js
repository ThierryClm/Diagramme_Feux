/**
 * Importateur de projets DiagFeux (CEREMA/CERTU, GPL-3.0) vers TraCflux.
 *
 * Format source : XML (extension .dfe), DataSet .NET sérialisé avec schéma
 * embarqué. Racine <DataSetDiagfeux>, namespace http://cete.fr/namespace.
 * Hiérarchie : Carrefour → Propriétés + Variante → LigneDeFeux / PlanFeux→Phase
 * / Trafic / Antagonisme.
 *
 * Parseur écrit DE ZÉRO d'après le schéma public (Diagfeux.xsd) et le guide
 * utilisateur (aucun code VB repris) : DiagFeux étant libre, lire son format
 * relève de l'interopérabilité légitime et la provenance de TraCflux reste
 * propre (AGPL, mono-auteur).
 *
 * SÉMANTIQUE (source : guide utilisateur DiagFeux) :
 * - « Fx » = ligne de feux VÉHICULES, « Px » = passage PIÉTON.
 * - Jaune : 3 s en agglomération, 5 s hors agglomération (feux véhicules
 *   R11/R13/R14). Les feux piétons n'ont pas de jaune.
 * - « Les interverts sont déduits en AJOUTANT aux rouges de dégagement les
 *   temps de jaune. » -> la matrice TraCflux (qui stocke des interverts) vaut
 *   donc rougeDégagement + jaune, et non le rouge de dégagement seul.
 * - Cycle = somme des durées de phases.
 * - Le vert d'une ligne est « la durée maximale attribuable compte tenu des
 *   contraintes de sécurité » : il se ferme donc AVANT la fin de sa phase, de
 *   l'intervert dû aux lignes antagonistes qui ouvrent ensuite.
 *
 * Hors périmètre de ce jet : géométrie (branches/voies/DXF) et agrégation du
 * trafic O-D vers les groupes — signalés dans `warnings`.
 */

// --- Aides DOM indépendantes du namespace (comparaison par localName) ---
const lname = (el) => el.localName || el.nodeName.replace(/^.*:/, '');
const kids = (parent, name) =>
    parent ? Array.from(parent.children).filter(c => lname(c) === name) : [];
const kid = (parent, name) => kids(parent, name)[0] || null;
const txt = (parent, name) => {
    const c = kid(parent, name);
    return c ? (c.textContent || '').trim() : '';
};
const numOf = (parent, name, def = 0) => {
    const v = parseFloat(txt(parent, name));
    return isNaN(v) ? def : v;
};
const boolOf = (parent, name) => /^(true|1)$/i.test(txt(parent, name));

/** Guide : « Px » = passage piéton, « Fx » = ligne de feux véhicules. */
const isPieton = (id) => /^p/i.test(String(id || ''));

/**
 * Parse un fichier DiagFeux (.dfe / XML) et renvoie un état TraCflux partiel
 * (compatible loadFullState) plus une liste d'avertissements.
 *
 * @returns {{ state: object|null, warnings: string[], error?: string }}
 */
export const parseDiagfeux = (xmlText) => {
    const warnings = [];
    if (!xmlText || typeof xmlText !== 'string') {
        return { state: null, warnings, error: 'Fichier vide ou illisible.' };
    }

    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        return { state: null, warnings, error: 'XML invalide (erreur de parsing).' };
    }

    const root = doc.documentElement;
    if (!root) {
        return { state: null, warnings, error: 'Document XML vide.' };
    }
    // Racine réelle : <DataSetDiagfeux>. On reste tolérant : on repère le
    // Carrefour plutôt que d'imposer un nom de racine.
    const carrefour = root.getElementsByTagNameNS('*', 'Carrefour')[0] || kid(root, 'Carrefour');
    if (!carrefour) {
        return {
            state: null,
            warnings,
            error: 'Aucun carrefour trouvé : fichier de paramètres seul (Diagfeux.par) ou format non reconnu.'
        };
    }

    const props = kid(carrefour, 'Propriétés');
    const variantes = kids(carrefour, 'Variante');
    if (variantes.length === 0) {
        return { state: null, warnings, error: 'Le carrefour ne contient aucune Variante.' };
    }
    if (variantes.length > 1) {
        warnings.push(`${variantes.length} variantes présentes : seule la première est importée.`);
    }
    const variante = variantes[0];

    // --- Propriétés du carrefour ---
    const nom = txt(props, 'Nom') || 'Carrefour importé';
    const enAgglo = props ? boolOf(props, 'EnAgglo') : true;
    /** Jaune d'une ligne : 3 s agglo / 5 s hors agglo ; 0 pour les feux piétons. */
    const jauneFor = (id) => isPieton(id) ? 0 : (enAgglo ? 3 : 5);

    const projectProperties = props ? {
        commune: txt(props, 'Commune'),
        controleurType: txt(props, 'TypeControleur'),
        controleurFabricant: txt(props, 'Fabricant'),
        zoneRegulation: txt(props, 'ZoneRégulation'),
        numero: txt(props, 'Numéro'),
        dateModification: txt(props, 'DateModification'),
        commentaires: txt(props, 'Commentaires')
    } : {};

    // --- LigneDeFeux ---
    const lignes = kids(variante, 'LigneDeFeux');
    if (lignes.length === 0) {
        return { state: null, warnings, error: 'La variante ne contient aucune LigneDeFeux.' };
    }
    const ids = lignes.map((lf, i) => txt(lf, 'ID') || String(i + 1));
    const idToIndex = new Map();
    ids.forEach((id, i) => idToIndex.set(id, i));

    // Verts minimaux du projet (guide : vert mini véhicules / piétons).
    const vertMiniVeh = numOf(variante, 'VertMiniVéhicules', 6) || 6;
    const vertMiniPieton = numOf(variante, 'VertMiniPiétons', 6) || 6;

    // --- Matrice des INTERVERTS = rouge de dégagement + jaune (cf. guide) ---
    const n = lignes.length;
    const conflictMatrix = Array.from({ length: n }, () => Array(n).fill(''));
    const intervert = Array.from({ length: n }, () => Array(n).fill(null));
    let matrixFound = 0;
    lignes.forEach((lf, i) => {
        const jaune = jauneFor(ids[i]);
        kids(lf, 'RougeDégagement').forEach(rd => {
            const adverse = rd.getAttribute('IDAdverse');
            const rouge = parseFloat((rd.textContent || '').trim());
            if (adverse && idToIndex.has(adverse) && !isNaN(rouge)) {
                const j = idToIndex.get(adverse);
                const iv = Math.round(rouge + jaune);
                conflictMatrix[i][j] = iv;
                intervert[i][j] = iv;
                matrixFound++;
            }
        });
    });
    if (matrixFound === 0) {
        warnings.push('Aucun rouge de dégagement lisible : matrice d\'interverts vide.');
    }

    // --- Plan de feux courant ---
    const plans = kids(variante, 'PlanFeux');
    let plan = null;
    if (plans.length > 0) {
        const currentId = variante.getAttribute('PlanFeuxCourant');
        plan = (currentId && plans.find(p => p.getAttribute('ID') === currentId))
            || plans.find(p => !txt(p, 'NomFonctionnement'))
            || plans[0];
        if (plans.length > 1) {
            warnings.push(`${plans.length} plans de feux : seul « ${txt(plan, 'NomFonctionnement') || 'plan de base'} » est importé.`);
        }
    } else {
        warnings.push('Aucun PlanFeux : groupes importés sans décalage ni vert (à saisir).');
    }

    // --- Conversion phases -> décalage + vert ---
    let cycleLength = 60;
    const start = new Array(n).fill(0);   // début de vert (offset)
    const green = new Array(n).fill(0);   // durée de vert

    if (plan) {
        const phases = kids(plan, 'Phase');
        const durs = phases.map(ph => Math.max(0, numOf(ph, 'Durée', 60)));
        const starts = [];
        let acc = 0;
        durs.forEach(d => { starts.push(acc); acc += d; });
        cycleLength = acc || 60;

        // Phases où chaque ligne est au vert (+ décalages ouverture/fermeture)
        const perLine = new Map();
        phases.forEach((ph, pi) => {
            kids(ph, 'IDLigneFeux').forEach(ref => {
                const id = (ref.textContent || '').trim();
                if (!id || !idToIndex.has(id)) return;
                const dOuvre = parseFloat(ref.getAttribute('DécalageOuvre')) || 0;
                const dFerme = parseFloat(ref.getAttribute('DécalageFerme')) || 0;
                if (!perLine.has(id)) perLine.set(id, []);
                perLine.get(id).push({ pi, dOuvre, dFerme });
            });
        });

        // 1) Début de vert (avance d'ouverture) et fin « naturelle » (fin de phase
        //    + retard de fermeture), avant contraintes de sécurité.
        const naturalEnd = new Array(n).fill(null);
        perLine.forEach((entries, id) => {
            const i = idToIndex.get(id);
            entries.sort((a, b) => a.pi - b.pi);
            const first = entries[0];
            const last = entries[entries.length - 1];
            if (entries.length !== (last.pi - first.pi + 1)) {
                warnings.push(`Ligne « ${id} » : phases non contiguës — vert approximé sur l'intervalle.`);
            }
            start[i] = ((starts[first.pi] - first.dOuvre) % cycleLength + cycleLength) % cycleLength;
            naturalEnd[i] = starts[last.pi] + durs[last.pi] + last.dFerme;
        });

        // 2) Fermeture contrainte par la sécurité : le vert doit se terminer au
        //    moins « intervert » avant l'ouverture de chaque ligne antagoniste
        //    (cf. guide : « durée maximale attribuable compte tenu des
        //    contraintes de sécurité »).
        for (let i = 0; i < n; i++) {
            if (naturalEnd[i] === null) continue;
            let end = naturalEnd[i];
            for (let j = 0; j < n; j++) {
                if (i === j || intervert[i][j] === null || naturalEnd[j] === null) continue;
                // Ouverture de j, ramenée après le début de vert de i (cyclique).
                let openJ = start[j];
                while (openJ <= start[i]) openJ += cycleLength;
                end = Math.min(end, openJ - intervert[i][j]);
            }
            green[i] = Math.max(0, Math.round(end - start[i]));
        }
    }

    // --- Groupes TraCflux ---
    const groups = lignes.map((lf, i) => {
        const id = ids[i];
        const pieton = isPieton(id);
        const orange = jauneFor(id);
        const g = green[i];
        return {
            id: i + 1,
            name: id,                                   // on conserve l'ID DiagFeux (F1, P2…)
            type: pieton ? 'P' : 'VL',
            courant: pieton ? 'Piéton' : '',
            minGreen: pieton ? vertMiniPieton : vertMiniVeh,
            offset: start[i],
            durations: { green: g, orange, red: Math.max(0, cycleLength - g - orange) },
            laneCoef: 1
        };
    });

    const nbPietons = groups.filter(g => g.type === 'P').length;
    if (nbPietons > 0) {
        warnings.push(`${nbPietons} ligne(s) piéton(s) détectée(s) par le préfixe « P » (sans jaune, conformément au guide).`);
    }
    warnings.push('Géométrie (branches, voies, passages, fond DXF) non reprise : TraCflux utilise une image de fond et des flèches.');
    warnings.push('Trafics non repris dans ce jet (matrices origine-destination à agréger par groupe).');

    const state = {
        projectName: nom,
        intersectionName: nom,
        groups,
        cycleLength,
        conflictMatrix,
        projectProperties
    };

    return { state, warnings };
};

export default parseDiagfeux;
