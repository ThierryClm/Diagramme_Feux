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

    // --- Nom du carrefour (offset 0x22, null-terminated) ---
    let intersectionName = '';
    for (let i = 0x22; i < 0x42; i++) {
        if (cmpData[i] === 0) break;
        intersectionName += String.fromCharCode(cmpData[i]);
    }
    intersectionName = intersectionName.trim();

    // --- Nombre de groupes (offset 0x11) ---
    const numGroups = cmpData[0x11];
    if (numGroups === 0 || numGroups > 64) {
        warnings.push(`Nombre de groupes suspect: ${numGroups}`);
    }

    // --- Section groupes (marqueur 05 04) ---
    let groupSectionStart = -1;
    for (let i = 0xC0; i < cmpData.length - 3; i++) {
        if (cmpData[i] === 0x05 && cmpData[i + 1] === 0x04 && cmpData[i + 2] === numGroups) {
            groupSectionStart = i + 6;
            break;
        }
    }

    const groups = [];
    let groupSectionEnd = 0;
    if (groupSectionStart > 0) {
        let pos = groupSectionStart;
        for (let g = 0; g < numGroups && pos < cmpData.length - 30; g++) {
            const typeByte = cmpData[pos];
            let type = 'V';
            if (typeByte === 0x0b) type = 'P';
            else if (typeByte === 0x03) type = 'B';

            if (cmpData[pos + 1] !== 0xff || cmpData[pos + 2] !== 0x3f) {
                warnings.push(`Groupe ${g + 1}: marqueur ff3f non trouvé`);
                let found = false;
                for (let scan = pos + 1; scan < pos + 50 && scan < cmpData.length - 2; scan++) {
                    if (cmpData[scan] === 0xff && cmpData[scan + 1] === 0x3f) {
                        pos = scan - 1;
                        found = true;
                        break;
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
                    foundNext = true;
                    break;
                }
                nextGroupPos++;
            }

            const groupId = g + 1;
            groups.push({
                id: groupId,
                name: name.trim() || `Groupe ${groupId}`,
                type,
                offset: 0,
                minGreen: minGreen || 7,
                durations: { green: 0, orange: orange || 3, red: 0 }
            });

            if (foundNext) {
                pos = nextGroupPos;
                groupSectionEnd = nextGroupPos;
            } else {
                groupSectionEnd = nextGroupPos;
                break;
            }
        }
    } else {
        warnings.push('Section des groupes (marqueur 05 04) non trouvée');
    }

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
        // Chercher ff 3f après "Structure"
        let pos = structurePos + structureBytes.length;
        while (pos < cmpData.length - 5 && !(cmpData[pos] === 0xff && cmpData[pos + 1] === 0x3f)) {
            pos++;
        }

        if (pos < cmpData.length - 5) {
            pos += 2; // Sauter ff 3f

            // Chercher la première entrée ff XX où XX < numGroups (et XX > 0)
            let firstEntryPos = -1;
            for (let scan = pos; scan < cmpData.length - 3; scan++) {
                if (cmpData[scan] === 0xff && cmpData[scan + 1] > 0 && cmpData[scan + 1] < 0x3f) {
                    firstEntryPos = scan;
                    break;
                }
            }

            if (firstEntryPos > 0) {
                // GF1 (index 0) : les 2 octets juste avant le premier ff XX
                const gf1Deb = cmpData[firstEntryPos - 2];
                const gf1Fin = cmpData[firstEntryPos - 1];
                if (groups.length > 0) {
                    groups[0].offset = gf1Deb;
                    groups[0].durations.green = gf1Fin >= gf1Deb ? gf1Fin - gf1Deb : 0;
                    groups[0]._rawFin = gf1Fin;
                }

                // Lire les entrées ff [index_0based] [deb] [fin]
                // index_0based + 1 = numéro du groupe
                let scanPos = firstEntryPos;
                let maxNonWrapFin = gf1Fin;
                let parsedCount = 1; // GF1 déjà parsé

                while (scanPos < cmpData.length - 3) {
                    if (cmpData[scanPos] !== 0xff) { scanPos++; continue; }
                    const idx = cmpData[scanPos + 1];
                    if (idx === 0xff) break; // ff ff = fin

                    const deb = cmpData[scanPos + 2];
                    const fin = cmpData[scanPos + 3];
                    scanPos += 4;

                    // Groupe = idx + 1 (indices 0-based dans le fichier)
                    const groupId = idx + 1;
                    const group = groups.find(g => g.id === groupId);
                    if (group) {
                        group.offset = deb;
                        group._rawFin = fin;
                        if (fin >= deb) {
                            group.durations.green = fin - deb;
                            if (fin > maxNonWrapFin) maxNonWrapFin = fin;
                        } else {
                            // Wrap-around : recalcul après estimation du cycle
                            group.durations.green = 0; // temporaire
                            group._wraps = true;
                        }
                        parsedCount++;
                    }
                }

                // Estimer la durée de cycle : arrondir max fin à la dizaine supérieure
                cycleLength = Math.ceil(maxNonWrapFin / 10) * 10;
                if (cycleLength < 30) cycleLength = 90;

                // Recalculer les durées vertes pour les groupes wrap-around
                groups.forEach(g => {
                    if (g._wraps) {
                        g.durations.green = cycleLength - g.offset + g._rawFin;
                        delete g._wraps;
                    }
                    delete g._rawFin;
                });

                if (parsedCount < numGroups) {
                    warnings.push(`${parsedCount} phases trouvées pour ${numGroups} groupes`);
                }
            } else {
                warnings.push('Entrées de phase non trouvées après "Structure"');
            }
        } else {
            warnings.push('Marqueur ff3f non trouvé après "Structure"');
        }
    } else {
        warnings.push('Chaîne "Structure" non trouvée - timing non importé');
    }

    // --- Calculer les durées de rouge ---
    groups.forEach(g => {
        const totalUsed = g.durations.green + g.durations.orange;
        g.durations.red = Math.max(0, cycleLength - totalUsed);
    });

    // --- Tentative de parse de la matrice des temps interverts ---
    const conflictMatrix = Array.from({ length: groups.length }, () =>
        Array(groups.length).fill('')
    );

    try {
        parseIntergreenMatrix(cmpData, 0, cmpData.length, numGroups, conflictMatrix, groups, warnings);
    } catch (e) {
        warnings.push('Erreur matrice: ' + e.message);
    }

    if (groups.length === 0) {
        warnings.push('Aucun groupe de feux trouvé dans le fichier');
    }

    return {
        intersectionName: intersectionName || file.name.replace(/\.cmpx$/i, ''),
        groups,
        cycleLength,
        conflictMatrix,
        warnings
    };
}

/**
 * Parse de la matrice de sécurité (temps interverts)
 * Format : entrées de 4 octets [groupeA] [groupeB] [sec_A→B] [sec_B→A]
 * Reconversion : intervert = sec + 3 si source V/B, sec si source P
 */
function parseIntergreenMatrix(cmpData, startPos, endPos, numGroups, matrix, groups, warnings) {
    // Chercher la meilleure position pour des entrées 4 octets
    let bestPos = -1;
    let bestScore = 0;

    for (let start = startPos; start < endPos - 8; start++) {
        let pos = start;
        let score = 0;

        while (pos < endPos - 3 && score < 60) {
            const a = cmpData[pos];
            const b = cmpData[pos + 1];
            const vAB = cmpData[pos + 2];
            const vBA = cmpData[pos + 3];

            // Entrée valide : a et b < numGroups, a ≠ b, valeurs raisonnables (0-20)
            if (a < numGroups && b < numGroups && a !== b && vAB <= 20 && vBA <= 20) {
                score++;
                pos += 4;
            } else {
                break;
            }
        }

        if (score > bestScore && score >= 5) {
            bestScore = score;
            bestPos = start;
        }
    }

    if (bestPos < 0) {
        warnings.push('Matrice de sécurité non trouvée dans le fichier');
        return;
    }

    // Lire les entrées 4 octets et convertir sécurité → intervert
    let pos = bestPos;
    let count = 0;

    while (pos < endPos - 3) {
        const a = cmpData[pos];
        const b = cmpData[pos + 1];
        const secAB = cmpData[pos + 2];
        const secBA = cmpData[pos + 3];

        if (a >= numGroups || b >= numGroups || a === b || secAB > 20 || secBA > 20) break;

        // A→B : source=A, intervert = sec + 3 si V/B, sec si P
        const groupA = groups.find(g => g.id === a + 1);
        const addA = (groupA && (groupA.type === 'V' || groupA.type === 'B')) ? 3 : 0;
        const intAB = secAB + addA;

        // B→A : source=B
        const groupB = groups.find(g => g.id === b + 1);
        const addB = (groupB && (groupB.type === 'V' || groupB.type === 'B')) ? 3 : 0;
        const intBA = secBA + addB;

        if (a < matrix.length && b < matrix[a].length) {
            matrix[a][b] = intAB;
            count++;
        }
        if (b < matrix.length && a < matrix[b].length) {
            matrix[b][a] = intBA;
            count++;
        }

        pos += 4;
    }

    if (count > 0) {
        warnings.push(`Matrice : ${count} temps interverts importés`);
    } else {
        warnings.push('Matrice de sécurité non trouvée dans le fichier');
    }
}
