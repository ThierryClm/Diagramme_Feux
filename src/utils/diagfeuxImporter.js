/**
 * Importateur de projets DiagFeux (CEREMA/CERTU, GPL-3.0) vers TraCflux.
 *
 * Format source : XML auto-documenté (DataSet .NET typé, WriteSchema).
 *   - Racine : SchémaACONDIA, namespace http://cete.fr/namespace
 *   - Carrefour → Propriétés + Variante(s)
 *   - Variante → LigneDeFeux (≈ groupes), PlanFeux → Phase (modèle par PHASES),
 *     Trafic (périodes O-D), Antagonisme (conflits)
 *
 * Ce parseur est écrit DE ZÉRO d'après le schéma public (aucun code VB repris) :
 * DiagFeux étant libre, lire son format est de l'interopérabilité légitime, et
 * la provenance de TraCflux reste propre (AGPL, mono-auteur).
 *
 * MVP : importe le plan de feux logique d'UNE variante (groupes, décalages,
 * verts déduits des phases, matrice d'interverts, propriétés). La géométrie
 * (branches/voies/DXF) et l'agrégation du trafic O-D→groupe sont hors périmètre
 * de ce premier jet et signalées dans `warnings`.
 *
 * ⚠️ À valider/affiner sur un VRAI export DiagFeux : structure interne de
 * RougeDégagement, sémantique exacte de DécalageOuvre/Ferme, partage vert/jaune.
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

/**
 * Parse un fichier DiagFeux (texte XML) et renvoie un état TraCflux partiel
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
    // Racine réelle d'un fichier DiagFeux : <DataSetDiagfeux> (nom du DataSet) ;
    // le schéma XSD embarqué la décrit sous le nom « SchémaACONDIA ». On reste
    // tolérant : on repère le Carrefour plutôt que d'imposer un nom de racine.
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
    const orangeDefault = enAgglo ? 3 : 5; // JauneAgglo / JauneHorsAgglo

    const projectProperties = props ? {
        commune: txt(props, 'Commune'),
        controleurType: txt(props, 'TypeControleur'),
        controleurFabricant: txt(props, 'Fabricant'),
        zoneRegulation: txt(props, 'ZoneRégulation'),
        numero: txt(props, 'Numéro'),
        dateModification: txt(props, 'DateModification'),
        commentaires: txt(props, 'Commentaires')
    } : {};

    // --- LigneDeFeux → groupes ---
    const lignes = kids(variante, 'LigneDeFeux');
    if (lignes.length === 0) {
        return { state: null, warnings, error: 'La variante ne contient aucune LigneDeFeux.' };
    }

    // Table d'équivalence ID DiagFeux (string) → index/id TraCflux (1-based).
    const idToIndex = new Map();
    lignes.forEach((lf, i) => {
        const id = txt(lf, 'ID') || String(i + 1);
        idToIndex.set(id, i + 1);
    });

    // --- Choix du plan de feux courant ---
    const plans = kids(variante, 'PlanFeux');
    let plan = null;
    if (plans.length > 0) {
        const currentId = variante.getAttribute('PlanFeuxCourant');
        plan = (currentId && plans.find(p => p.getAttribute('ID') === currentId))
            || plans.find(p => !txt(p, 'NomFonctionnement')) // plan de base
            || plans[0];
        if (plans.length > 1) {
            warnings.push(`${plans.length} plans de feux : seul « ${txt(plan, 'NomFonctionnement') || 'plan de base'} » est importé (MVP).`);
        }
    } else {
        warnings.push('Aucun PlanFeux : les groupes seront importés sans décalage ni vert (à saisir).');
    }

    // --- Conversion phases → décalage + vert par ligne ---
    // cycle = Σ Durée ; chaque ligne est verte durant les phases où son ID
    // apparaît. offset = début de sa 1re phase (− DécalageOuvre) ; vert = somme
    // des durées de ces phases (+ DécalageOuvre + DécalageFerme).
    const timing = new Map(); // idLigne -> { offset, green }
    let cycleLength = 60;
    if (plan) {
        const phases = kids(plan, 'Phase');
        const starts = [];
        let acc = 0;
        phases.forEach(ph => { starts.push(acc); acc += Math.max(0, numOf(ph, 'Durée', 60)); });
        cycleLength = acc || 60;

        // Pour chaque ligne, collecter (indexPhase, décalageOuvre, décalageFerme)
        const perLine = new Map();
        phases.forEach((ph, pi) => {
            kids(ph, 'IDLigneFeux').forEach(ref => {
                const id = (ref.textContent || '').trim();
                if (!id) return;
                const dOuvre = parseFloat(ref.getAttribute('DécalageOuvre')) || 0;
                const dFerme = parseFloat(ref.getAttribute('DécalageFerme')) || 0;
                if (!perLine.has(id)) perLine.set(id, []);
                perLine.get(id).push({ pi, dOuvre, dFerme });
            });
        });

        perLine.forEach((entries, id) => {
            entries.sort((a, b) => a.pi - b.pi);
            // Contiguïté simple : on prend la 1re et la dernière phase couvertes.
            const first = entries[0];
            const last = entries[entries.length - 1];
            const nonContigu = entries.length !== (last.pi - first.pi + 1);
            if (nonContigu) {
                warnings.push(`Ligne « ${id} » : phases non contiguës — vert approximé sur l'intervalle.`);
            }
            const durSpan = starts[last.pi] + Math.max(0, numOf(phases[last.pi], 'Durée', 60)) - starts[first.pi];
            const green = Math.round(durSpan + first.dOuvre + last.dFerme);
            const offset = Math.round(((starts[first.pi] - first.dOuvre) % cycleLength + cycleLength) % cycleLength);
            timing.set(id, { offset, green });
        });
    }

    const groups = lignes.map((lf, i) => {
        const id = txt(lf, 'ID') || String(i + 1);
        const t = timing.get(id) || { offset: 0, green: 0 };
        const orange = orangeDefault;
        const red = Math.max(0, cycleLength - t.green - orange);
        return {
            id: i + 1,
            name: id,                 // on conserve l'ID DiagFeux comme nom
            type: 'VL',               // MVP : type véhicule par défaut
            courant: '',
            minGreen: 6,
            offset: t.offset,
            durations: { green: t.green, orange, red },
            laneCoef: 1
        };
    });
    warnings.push('Type de tous les groupes fixé à « VL » (la distinction TC/piéton/cycle nécessite l\'analyse des trajectoires — palier suivant).');

    // --- Matrice d'interverts depuis RougeDégagement (best-effort) ---
    const n = groups.length;
    const conflictMatrix = Array.from({ length: n }, () => Array(n).fill(''));
    let matrixFound = 0;
    lignes.forEach((lf, i) => {
        kids(lf, 'RougeDégagement').forEach(rd => {
            const adverse = rd.getAttribute('IDAdverse');
            const dur = parseFloat((rd.textContent || '').trim());
            if (adverse && idToIndex.has(adverse) && !isNaN(dur)) {
                const j = idToIndex.get(adverse) - 1;
                conflictMatrix[i][j] = Math.round(dur);
                matrixFound++;
            }
        });
    });
    if (matrixFound === 0) {
        warnings.push('Aucun rouge de dégagement lisible sur les lignes : matrice d\'interverts vide (à valider sur un fichier réel).');
    }

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
