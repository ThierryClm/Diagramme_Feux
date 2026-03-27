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

    if (groupSectionEnd > 0 && structurePos > groupSectionEnd) {
        try {
            parseIntergreenMatrix(cmpData, groupSectionEnd, structurePos, numGroups, conflictMatrix, warnings);
        } catch (e) {
            warnings.push('Erreur matrice: ' + e.message);
        }
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
 * Tentative de parsing de la matrice des temps interverts
 */
function parseIntergreenMatrix(cmpData, startPos, endPos, numGroups, matrix, warnings) {
    // Scanner la zone pour trouver des triplets [from, to, value] cohérents
    for (let pos = startPos; pos < endPos - 2; pos++) {
        const a = cmpData[pos];
        const b = cmpData[pos + 1];
        const c = cmpData[pos + 2];

        if (a < numGroups && b < numGroups && a !== b && c >= 1 && c <= 20) {
            let valid = 0;
            let scanPos = pos;
            while (scanPos < endPos - 2) {
                const f = cmpData[scanPos];
                const t = cmpData[scanPos + 1];
                const v = cmpData[scanPos + 2];
                if (f < numGroups && t < numGroups && f !== t && v >= 1 && v <= 20) {
                    valid++;
                    scanPos += 3;
                } else {
                    break;
                }
            }

            if (valid >= 5) {
                let matPos = pos;
                let count = 0;
                while (matPos < endPos - 2) {
                    const from = cmpData[matPos];
                    const to = cmpData[matPos + 1];
                    const val = cmpData[matPos + 2];
                    if (from < numGroups && to < numGroups && from !== to && val >= 1 && val <= 20) {
                        matrix[from][to] = val;
                        count++;
                        matPos += 3;
                    } else {
                        break;
                    }
                }
                if (count > 0) {
                    warnings.push(`Matrice : ${count} temps interverts importés (à vérifier)`);
                }
                return;
            }
        }
    }
    warnings.push('Matrice non trouvée - matrice vide');
}
