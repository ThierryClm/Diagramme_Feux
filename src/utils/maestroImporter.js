import { unzipSync } from 'fflate';

/**
 * Importe un fichier Maestro .cmpx (archive ZIP contenant un fichier MAESTRO_DIASER.cmp binaire)
 */
export async function importMaestroFile(file) {
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    let files;
    try {
        files = unzipSync(uint8);
    } catch (e) {
        throw new Error('Impossible de décompresser le fichier .cmpx : ' + e.message);
    }

    const cmpEntry = Object.entries(files).find(([name]) =>
        name.toLowerCase().endsWith('.cmp')
    );
    if (!cmpEntry) {
        throw new Error('Fichier .cmp non trouvé dans l\'archive .cmpx');
    }

    const cmpData = cmpEntry[1];
    const warnings = [];
    const microVariables = [];

    // --- Parse du param.ppc ---
    let programmationDate = '';
    const ppcEntry = Object.entries(files).find(([name]) =>
        name.toLowerCase().endsWith('.ppc')
    );
    if (ppcEntry) {
        const ppcText = new TextDecoder('iso-8859-1').decode(ppcEntry[1]);
        for (const line of ppcText.split(/\r?\n/)) {
            const parts = line.split(';');
            if (parts[0].includes('Date') && parts[1]) {
                programmationDate = parts[1].trim();
            }
            if (parts[0].includes('Indice programmation') && parts[1]) microVariables.push(`Indice programmation : ${parts[1].trim()}`);
            if (parts[0].includes('Nom DIASER') && parts[1]) microVariables.push(`Nom DIASER : ${parts[1].trim()}`);
        }
    }

    // --- Nom du carrefour (offset 0x22) ---
    let intersectionName = '';
    for (let i = 0x22; i < 0x42; i++) {
        if (cmpData[i] === 0) break;
        intersectionName += String.fromCharCode(cmpData[i]);
    }
    intersectionName = intersectionName.trim();

    // --- Contrôleur (offset 0x44) ---
    let controllerType = '';
    for (let i = 0x44; i < 0x54; i++) {
        if (cmpData[i] === 0) break;
        controllerType += String.fromCharCode(cmpData[i]);
    }
    if (controllerType) microVariables.push(`Contrôleur : ${controllerType.trim()}`);

    // --- Opérateurs (header 0x60-0xC0) ---
    const operators = [];
    let str = '';
    for (let i = 0x60; i < 0xC0; i++) {
        if (cmpData[i] >= 32 && cmpData[i] < 127) {
            str += String.fromCharCode(cmpData[i]);
        } else {
            if (str.length >= 4 && !/^\d+$/.test(str) && !str.includes('SWING') && !str.includes('MAESTRO')) {
                operators.push(str);
            }
            str = '';
        }
    }
    if (operators.length > 0) microVariables.push(`Opérateur(s) : ${operators.join(', ')}`);

    // --- Nombre de groupes CMP (offset 0x11) ---
    const numGroups = cmpData[0x11];

    // --- Section groupes (marqueur 05 04) - import séquentiel ---
    let groupSectionStart = -1;
    for (let i = 0xC0; i < cmpData.length - 3; i++) {
        if (cmpData[i] === 0x05 && cmpData[i + 1] === 0x04 && cmpData[i + 2] === numGroups) {
            groupSectionStart = i + 6;
            break;
        }
    }

    const groups = [];
    if (groupSectionStart > 0) {
        let pos = groupSectionStart;
        let prevMaxNameNum = 0;

        for (let g = 0; g < numGroups && pos < cmpData.length - 30; g++) {
            const typeByte = cmpData[pos];
            let type = 'V';
            if (typeByte === 0x0b) type = 'P';
            else if (typeByte === 0x03) type = 'B';
            else if (typeByte === 0x06) type = 'PP';

            if (cmpData[pos + 1] !== 0xff || cmpData[pos + 2] !== 0x3f) {
                let found = false;
                for (let scan = pos + 1; scan < pos + 50 && scan < cmpData.length - 2; scan++) {
                    if (cmpData[scan] === 0xff && cmpData[scan + 1] === 0x3f) {
                        pos = scan - 1; found = true; break;
                    }
                }
                if (!found) break;
            }

            const orange = cmpData[pos + 4];
            const minGreen = cmpData[pos + 7];

            let name = '';
            let nameEnd = pos + 8;
            while (nameEnd < pos + 28 && cmpData[nameEnd] !== 0) {
                name += String.fromCharCode(cmpData[nameEnd]);
                nameEnd++;
            }

            let nextGroupPos = nameEnd;
            let foundNext = false;
            while (nextGroupPos < cmpData.length - 2) {
                if (cmpData[nextGroupPos + 1] === 0xff && cmpData[nextGroupPos + 2] === 0x3f) {
                    foundNext = true; break;
                }
                nextGroupPos++;
            }

            // Détecter le numéro dans le nom (V21→21, P28→28, PP9→9)
            const numMatch = name.match(/(\d+)/);
            const nameNum = numMatch ? parseInt(numMatch[1]) : 0;

            // Si le numéro est élevé (>=20) et dépasse la position courante,
            // insérer des groupes vides pour que le GF soit à la bonne position
            if (nameNum >= 20 && nameNum > groups.length + 1) {
                const emptyCount = nameNum - groups.length - 1;
                for (let e = 0; e < emptyCount; e++) {
                    groups.push({
                        id: groups.length + 1,
                        name: ',',
                        type: 'VL',
                        offset: 0,
                        minGreen: 0,
                        durations: { green: 0, orange: 0, red: 0 }
                    });
                }
            }

            groups.push({
                id: groups.length + 1,
                name: name.trim() || `Groupe ${groups.length + 1}`,
                type,
                offset: 0,
                minGreen: minGreen || 7,
                durations: { green: 0, orange: orange || (type === 'V' || type === 'B' ? 3 : 0), red: 0 }
            });

            if (foundNext) {
                pos = nextGroupPos;
            } else {
                break;
            }
        }
    }

    // Mapping CMP index (0-based séquentiel) → groups array index
    const cmpToGroupIdx = {};
    let cmpIdx = 0;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].name !== ',') {
            cmpToGroupIdx[cmpIdx] = i;
            cmpIdx++;
        }
    }

    // Mapping absolu (utilisé dans phases et matrice) : index = groups array index directement
    // Les ff XX dans les phases utilisent des indices absolus (0x14=20 → GF21 = groups[20])
    // La matrice utilise les indices CMP séquentiels (0-24) → cmpToGroupIdx

    // --- Section phases/timing (après "Structure") ---
    const structureBytes = [0x53, 0x74, 0x72, 0x75, 0x63, 0x74, 0x75, 0x72, 0x65];
    let structurePos = -1;
    for (let i = 0; i < cmpData.length - structureBytes.length; i++) {
        let match = true;
        for (let j = 0; j < structureBytes.length; j++) {
            if (cmpData[i + j] !== structureBytes[j]) { match = false; break; }
        }
        if (match) { structurePos = i; break; }
    }

    let cycleLength = 90;
    if (structurePos > 0) {
        let pos = structurePos + structureBytes.length;
        while (pos < cmpData.length - 5 && !(cmpData[pos] === 0xff && cmpData[pos + 1] === 0x3f)) pos++;

        if (pos < cmpData.length - 5) {
            pos += 2;
            let firstEntryPos = -1;
            for (let scan = pos; scan < cmpData.length - 3; scan++) {
                if (cmpData[scan] === 0xff && cmpData[scan + 1] > 0 && cmpData[scan + 1] < 0x3f) {
                    firstEntryPos = scan; break;
                }
            }

            if (firstEntryPos > 0) {
                // GF1 (index absolu 0 = groups[0])
                const gf1Deb = cmpData[firstEntryPos - 2];
                const gf1Fin = cmpData[firstEntryPos - 1];
                const gi0 = 0; // GF1 est toujours groups[0]
                if (gi0 !== undefined && groups[gi0]) {
                    groups[gi0].offset = gf1Deb;
                    groups[gi0].durations.green = gf1Fin >= gf1Deb ? gf1Fin - gf1Deb : 0;
                    groups[gi0]._rawFin = gf1Fin;
                    groups[gi0]._wraps = gf1Fin < gf1Deb;
                }

                let scanPos = firstEntryPos;
                let maxNonWrapFin = gf1Fin;

                while (scanPos < cmpData.length - 3) {
                    if (cmpData[scanPos] !== 0xff) { scanPos++; continue; }
                    const idx = cmpData[scanPos + 1];
                    if (idx === 0xff) break;
                    const deb = cmpData[scanPos + 2];
                    const fin = cmpData[scanPos + 3];
                    scanPos += 4;

                    // idx est un index absolu (0x14=20 → groups[20] = GF21)
                    const gi = idx;
                    if (gi < groups.length && groups[gi] && groups[gi].name !== ',') {
                        groups[gi].offset = deb;
                        groups[gi]._rawFin = fin;
                        if (fin >= deb) {
                            groups[gi].durations.green = fin - deb;
                            if (fin > maxNonWrapFin) maxNonWrapFin = fin;
                        } else {
                            groups[gi].durations.green = 0;
                            groups[gi]._wraps = true;
                        }
                    }
                }

                cycleLength = Math.ceil(maxNonWrapFin / 10) * 10;
                if (cycleLength < 30) cycleLength = 90;

                groups.forEach(g => {
                    if (g._wraps) g.durations.green = cycleLength - g.offset + (g._rawFin || 0);
                    delete g._wraps;
                    delete g._rawFin;
                });
            }
        }
    }

    // --- Calculer les durées de rouge ---
    groups.forEach(g => {
        const totalUsed = g.durations.green + g.durations.orange;
        g.durations.red = Math.max(0, cycleLength - totalUsed);
    });

    // --- Associer les lignes bus au champ DA des groupes ---
    // Chercher les entrées "LIGNE XX VYY" dans le CMP
    extractBusLines(cmpData, groups);

    // --- Matrice des temps interverts ---
    const conflictMatrix = Array.from({ length: groups.length }, () =>
        Array(groups.length).fill('')
    );
    try {
        parseIntergreenMatrix(cmpData, numGroups, conflictMatrix, groups, cmpToGroupIdx, warnings);
    } catch (e) {
        warnings.push('Erreur matrice: ' + e.message);
    }

    // --- Extraire les informations supplémentaires ---
    const actionDescriptions = []; // Adaptatifs, Points repos → actions micro
    extractMicroVariables(cmpData, microVariables, actionDescriptions);

    // --- Construire les actions micro à partir des adaptatifs/repos ---
    const actionData = Array.from({ length: Math.max(30, actionDescriptions.length + 5) }, (_, i) => ({
        id: i + 1, gf: '', action: '', description: '', deb: '', fin: '',
        abrv: '', micro: '', plage1: '', plage2: '',
        actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: ''
    }));
    actionDescriptions.forEach((desc, i) => {
        if (i < actionData.length) {
            actionData[i].gf = '0';
            actionData[i].action = desc.action;
            actionData[i].description = desc.description;
        }
    });

    // --- Propriétés du projet ---
    const projectProperties = {};
    if (programmationDate) {
        const dm = programmationDate.match(/(\d{2})\/(\d{2})\/(\d{2})/);
        if (dm) {
            projectProperties.dateModification = `20${dm[3]}-${dm[2]}-${dm[1]}`;
        }
    }
    // Contrôleur = nom DIASER, Programme = type contrôleur
    const nomDiaser = microVariables.find(v => v.startsWith('Nom DIASER'));
    if (nomDiaser) {
        projectProperties.controleur = nomDiaser.replace('Nom DIASER : ', '');
        // Supprimer des variables micro
        const idx = microVariables.indexOf(nomDiaser);
        if (idx >= 0) microVariables.splice(idx, 1);
    }
    const ctrlVar = microVariables.find(v => v.startsWith('Contrôleur'));
    if (ctrlVar) {
        projectProperties.programme = ctrlVar.replace('Contrôleur : ', '');
        const idx = microVariables.indexOf(ctrlVar);
        if (idx >= 0) microVariables.splice(idx, 1);
    }

    return {
        intersectionName: intersectionName || file.name.replace(/\.cmpx$/i, ''),
        groups,
        cycleLength,
        conflictMatrix,
        actionData,
        microVariables,
        projectProperties,
        warnings
    };
}

/**
 * Extraire les lignes bus et associer au champ DA des groupes
 * Format dans le CMP : "LIGNE XX VYY" → associe le code trajet "T" au groupe VYY
 */
export function extractBusLines(cmpData, groups) {
    // Scanner les chaînes "LIGNE" dans le fichier
    let str = '';
    for (let i = 0; i < cmpData.length; i++) {
        const c = cmpData[i];
        if (c >= 32 && c < 127) {
            str += String.fromCharCode(c);
        } else {
            if (str.length >= 6 && str.startsWith('LIGNE')) {
                // Format: "LIGNE 9 V4" ou "LIGNE 11 V5"
                const match = str.match(/LIGNE\s+(\d+)\s+V(\d+)/);
                if (match) {
                    const ligneNum = match[1];
                    const vNum = parseInt(match[2]);
                    // Trouver le groupe V correspondant par son nom
                    const group = groups.find(g =>
                        g.name && g.name.match(new RegExp(`^V${vNum}\\b`))
                    );
                    if (group && !group.da) {
                        group.da = 'T';
                    }
                }
            }
            str = '';
        }
    }
}

/**
 * Extraire les informations supplémentaires du fichier CMP vers les variables micro
 */
export function extractMicroVariables(cmpData, variables, actionDescriptions) {
    let str = '', startPos = 0;
    for (let i = 0; i < cmpData.length; i++) {
        const c = cmpData[i];
        if ((c >= 32 && c < 127) || (c >= 0xC0 && c <= 0xFF)) {
            if (!str) startPos = i;
            str += String.fromCharCode(c);
        } else {
            if (str.length >= 4) {
                const lower = str.toLowerCase();
                if (lower.includes('boucle') && !variables.includes(`Boucle : ${str}`)) {
                    variables.push(`Boucle : ${str}`);
                } else if (lower.includes('adaptatif') && !actionDescriptions.some(a => a.description === str)) {
                    actionDescriptions.push({ action: 'Adaptatif vertical', description: str });
                } else if ((lower.includes('point repos') || lower.includes('point de repos')) && !actionDescriptions.some(a => a.description === str)) {
                    actionDescriptions.push({ action: 'Point de repos', description: str });
                } else if (lower.includes('cligno') && !variables.some(v => v.includes(str))) {
                    variables.push(`CLIGNO : ${str}`);
                } else if (lower.startsWith('ligne')) {
                    variables.push(`Ligne bus : ${str}`);
                } else if (lower.includes('tmab') || lower.includes('tmba')) {
                    if (!variables.some(v => v.includes(str))) variables.push(`Variable : ${str}`);
                } else if ((lower.includes('avant vert') || lower.includes('avvert')) && !variables.some(v => v.includes(str))) {
                    variables.push(`DA : ${str}`);
                } else if (lower.includes('priorit') && !variables.some(v => v.includes(str))) {
                    variables.push(`Priorité : ${str}`);
                }
            }
            str = '';
        }
    }
}

/**
 * Matrice de sécurité : entrées 4 octets [groupeA][groupeB][sec_A→B][sec_B→A]
 * Reconversion : intervert = sec + 3 si source V/B, sec si source P
 */
export function parseIntergreenMatrix(cmpData, numGroups, conflictMatrix, groups, cmpToGroupIdx, warnings) {
    const totalGroups = groups.length;
    let bestPos = -1, bestScore = 0;

    for (let start = 0; start < cmpData.length - 8; start++) {
        let pos = start, score = 0;
        while (pos < cmpData.length - 3 && score < 60) {
            const a = cmpData[pos], b = cmpData[pos + 1], vAB = cmpData[pos + 2], vBA = cmpData[pos + 3];
            if (a < totalGroups && b < totalGroups && a !== b && vAB <= 20 && vBA <= 20) {
                score++; pos += 4;
            } else break;
        }
        if (score > bestScore && score >= 5) { bestScore = score; bestPos = start; }
    }

    if (bestPos < 0) { warnings.push('Matrice non trouvée'); return; }

    let pos = bestPos, count = 0;
    while (pos < cmpData.length - 3) {
        const a = cmpData[pos], b = cmpData[pos + 1], secAB = cmpData[pos + 2], secBA = cmpData[pos + 3];
        if (a >= groups.length || b >= groups.length || a === b || secAB > 20 || secBA > 20) break;

        // Indices absolus : a et b correspondent directement aux positions dans groups[]
        const idxA = a, idxB = b;
        if (idxA < groups.length && idxB < groups.length && groups[idxA].name !== ',' && groups[idxB].name !== ',') {
            const gA = groups[idxA], gB = groups[idxB];
            const addA = (gA && (gA.type === 'V' || gA.type === 'B')) ? 3 : 0;
            const addB = (gB && (gB.type === 'V' || gB.type === 'B')) ? 3 : 0;
            if (idxA < conflictMatrix.length && idxB < conflictMatrix[idxA].length) { conflictMatrix[idxA][idxB] = secAB + addA; count++; }
            if (idxB < conflictMatrix.length && idxA < conflictMatrix[idxB].length) { conflictMatrix[idxB][idxA] = secBA + addB; count++; }
        }
        pos += 4;
    }

    if (count > 0) warnings.push(`Matrice : ${count} temps interverts importés`);
    else warnings.push('Matrice non trouvée');
}
