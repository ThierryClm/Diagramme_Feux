import * as XLSX from 'xlsx';

/**
 * Import Excel file and parse it into project structure
 * Expected Excel structure:
 * - Sheet "Groupes" or "Configuration": Groups data (GF, Nom, Type, Décalage, Vert, Orange, Vert Min)
 * - Sheet "Matrice" or "Intervert": Conflict matrix
 * - Sheet "Actions": Action table data
 * - Sheet "Trafic": Traffic data (optional)
 *
 * @param {File} file - Excel file to import
 * @returns {Promise<Object>} - Parsed project data
 */
export async function importExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                const result = {
                    intersectionName: file.name.replace(/\.(xlsx?|xls)$/i, ''),
                    groups: [],
                    cycleLength: 90,
                    conflictMatrix: null,
                    actionData: [],
                    trafficData: {},
                    pfTabs: []
                };

                // Parse specific sheets based on user specifications:
                // - "Formulaire" sheet → Groups configuration
                // - 6th sheet (index 5) → Conflict matrix
                // - Sheets from index 5 onward → PF1, PF2, PF3... (with diagrams + action tables below)

                console.log('Available sheets:', workbook.SheetNames);

                workbook.SheetNames.forEach((sheetName, sheetIndex) => {
                    const sheet = workbook.Sheets[sheetName];
                    const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    const normalizedSheetName = sheetName.toLowerCase().trim();

                    console.log(`Processing sheet ${sheetIndex}: "${sheetName}" (normalized: "${normalizedSheetName}")`);

                    // Parse "Formulaire" sheet for groups configuration
                    if (normalizedSheetName.includes('formulaire')) {
                        console.log('Found Formulaire sheet, parsing groups...');
                        parseGroupsSheet(sheetData, result, sheetName);
                    }
                    // Parse 6th sheet (index 5) for conflict matrix
                    else if (sheetIndex === 5) {
                        parseMatrixSheet(sheetData, result);
                    }
                    // Parse sheets from index 5 onward as PF tabs (PF1, PF2, PF3...)
                    else if (sheetIndex >= 5) {
                        const pfNumber = sheetIndex - 4; // PF1 = sheet 6 (index 5), PF2 = sheet 7 (index 6), etc.
                        parsePFSheet(sheetData, result, pfNumber, sheetName);
                    }
                    // Parse Traffic sheet if found
                    else if (normalizedSheetName.includes('trafic') || normalizedSheetName.includes('traffic')) {
                        parseTrafficSheet(sheetData, result);
                    }
                });

                console.log('Result after parsing:', result);

                // Ensure we have at least some groups
                if (result.groups.length === 0) {
                    reject(new Error('Aucun groupe trouvé dans le fichier Excel. Vérifiez qu\'il existe une feuille "Formulaire".'));
                    return;
                }

                // If no pfTabs were created, create a default one with empty actions
                if (result.pfTabs.length === 0) {
                    result.pfTabs = [{ id: 1, name: 'PF1', data: [] }];
                }

                resolve(result);
            } catch (err) {
                // Check if it's a password-protected file
                if (err.message && err.message.includes('password')) {
                    reject(new Error('Le fichier Excel est protégé par mot de passe.\n\nPour l\'importer, veuillez :\n1. Ouvrir le fichier dans Excel\n2. Aller dans Fichier → Informations → Protéger le classeur\n3. Supprimer le mot de passe\n4. Enregistrer le fichier\n5. Réessayer l\'import'));
                } else {
                    reject(new Error(`Erreur lors de la lecture du fichier Excel: ${err.message}`));
                }
            }
        };

        reader.onerror = () => {
            reject(new Error('Erreur lors de la lecture du fichier'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parse groups sheet - "Formulaire" sheet with specific cell positions
 * - H2: Number of groups
 * - Starting at C6: Groups (with blank lines between each group)
 * - Column C: GF number
 * - Column D: Type
 * - Column E: Vert mini
 * - Column F: Jaune/Orange
 * Note: Cycle duration is read from PF sheets (AL3), not from Formulaire
 */
function parseGroupsSheet(sheetData, result) {
    console.log('parseGroupsSheet called, sheetData length:', sheetData.length);
    console.log('First few rows:', sheetData.slice(0, 10));

    if (sheetData.length < 6) {
        console.log('Sheet too short, returning');
        return;
    }

    // Extract number of groups from H2 (row 1, column 7)
    let expectedGroupCount = null;
    if (sheetData[1] && sheetData[1][7]) {
        expectedGroupCount = parseNumber(sheetData[1][7], null);
        console.log('Expected group count from H2:', expectedGroupCount);
    }

    // Parse groups starting at row 5 (C6 = row index 5, column 2)
    // Groups are at C6, C8, C10... (every 2 rows, with blank line between)
    const groups = [];
    let currentRow = 5; // Start at row 6 (index 5)

    console.log('Starting to parse groups from row 6...');

    while (currentRow < sheetData.length) {
        const row = sheetData[currentRow];

        console.log(`Checking row ${currentRow + 1} (Excel row ${currentRow + 1}):`, row ? row.slice(0, 10) : 'undefined');

        // Debug: show all columns A-F for this row
        if (row) {
            console.log(`  Col A (idx 0): "${row[0]}"  Col B (idx 1): "${row[1]}"  Col C (idx 2): "${row[2]}"`);
            console.log(`  Col D (idx 3): "${row[3]}"  Col E (idx 4): "${row[4]}"  Col F (idx 5): "${row[5]}"`);
        }

        // Check if this row has data in column A (index 0) or B (index 1) - the group number or name
        if (row && (row[0] !== '' || row[1] !== '') && row[0] !== null && row[0] !== undefined) {
            const gfNumber = parseNumber(row[0], groups.length + 1); // Column A (index 0) - GF number
            const groupName = String(row[1] || '').trim(); // Column B (index 1) - Group name
            const type = String(row[2] || 'VL').trim(); // Column C (index 2) - Type
            const minGreen = parseNumber(row[3], 6); // Column D (index 3) - Vert min
            const orange = parseNumber(row[4], 3); // Column E (index 4) - Jaune

            console.log(`Row ${currentRow + 1}, Parsed: GF=${gfNumber}, Name="${groupName}", Type="${type}", MinGreen=${minGreen}, Orange=${orange}`);

            if (gfNumber && groupName) {
                const group = {
                    id: gfNumber,
                    name: groupName,
                    type: type,
                    minGreen: minGreen,
                    offset: 0, // Will be calculated from diagram
                    courant: '', // Will be filled from Trafic sheet
                    durations: {
                        green: 0, // Will be calculated from diagram
                        orange: orange,
                        red: 0
                    }
                };

                console.log('Added group:', group);
                groups.push(group);
            }
        }

        // Skip to next group (every 2 rows: C6, C8, C10, C12...)
        currentRow += 2;

        // Stop if we have reached the expected number of groups
        if (expectedGroupCount !== null && groups.length >= expectedGroupCount) {
            console.log('Reached expected group count, stopping');
            break;
        }
    }

    console.log('Total groups found:', groups.length);

    if (groups.length > 0) {
        result.groups = groups;
    }
}

/**
 * Parse conflict matrix sheet - 6th sheet (index 5)
 * - AL3 (column 37, row 2): Cycle duration
 * - Matrix data starts at D6 (row 5, column 3), includes diagonal (0 values)
 * - Every 2 rows: row 6, 8, 10... (with blank lines between each group)
 * - Columns are consecutive: D, E, F, G... (no spacing between columns)
 * - Column D = Group 1, Column E = Group 2, etc.
 * - Diagonal values (0 or empty) are stored but not displayed in UI
 * - Diagram data (every 2 rows starting at row 6):
 *   - AJ6, AJ8, AJ10... = DA (Délai d'approche)
 *   - AK6, AK8, AK10... = Déb (début de phase verte)
 *   - AL6, AL8, AL10... = Fin (fin de phase verte)
 */
function parseMatrixSheet(sheetData, result) {
    if (sheetData.length < 6) return;

    console.log('parseMatrixSheet called, sheetData length:', sheetData.length);
    console.log('Number of groups:', result.groups.length);

    // Column indices (0-based):
    // Excel: A=col 1, B=col 2, ... Z=col 26, AA=col 27, ... AJ=col 36, AK=col 37, AL=col 38
    // JS 0-based: A=0, B=1, ... Z=25, AA=26, ... AJ=35, AK=36, AL=37
    const COL_DA = 35;   // AJ (col 36 in Excel) - Délai d'approche
    const COL_DEB = 36;  // AK (col 37 in Excel) - Début
    const COL_FIN = 37;  // AL (col 38 in Excel) - Fin

    // Extract cycle duration from AL3 (row 3 = index 2, col AL = index 37)
    if (sheetData[2] && sheetData[2][COL_FIN]) {
        const cycle = parseNumber(sheetData[2][COL_FIN], null);
        console.log('Cycle length from AL3:', cycle);
        if (cycle && cycle >= 10 && cycle <= 300) {
            result.cycleLength = cycle;
            console.log('Cycle length set to:', cycle);
        }
    }

    const size = result.groups.length;
    const matrix = Array(size).fill(null).map(() => Array(size).fill(0));

    // Matrix starts at D6:
    // Excel: D = col 4, row 6
    // JS 0-based: col index = 4 - 1 = 3, row index = 6 - 1 = 5
    const MATRIX_COL_START = 3;  // D = col 4 in Excel → index 3
    const MATRIX_ROW_START = 5;  // Row 6 in Excel → index 5

    let rowIndex = 0;
    let excelRow = MATRIX_ROW_START;

    while (rowIndex < size && excelRow < sheetData.length) {
        const row = sheetData[excelRow];
        console.log(`Matrix row ${rowIndex} (Excel row ${excelRow + 1}):`, row ? row.slice(MATRIX_COL_START, MATRIX_COL_START + size) : 'undefined');

        if (row) {
            // Columns are consecutive starting at D (index 3): D, E, F, G...
            // D=Group1, E=Group2, F=Group3, etc.
            for (let colIndex = 0; colIndex < size; colIndex++) {
                const excelCol = MATRIX_COL_START + colIndex; // D=3, E=4, F=5, G=6...
                if (excelCol < row.length) {
                    const value = parseNumber(row[excelCol], 0);
                    // Store the value (diagonal will be 0, UI handles display)
                    matrix[rowIndex][colIndex] = Math.max(0, Math.min(20, value));
                    console.log(`  Matrix[${rowIndex}][${colIndex}] from col ${String.fromCharCode(65 + excelCol)}${excelRow + 1} = ${matrix[rowIndex][colIndex]}`);
                }
            }

            // Extract diagram data (DA, Déb, Fin) for this group
            if (result.groups[rowIndex]) {
                const da = parseNumber(row[COL_DA], 0);
                const deb = parseNumber(row[COL_DEB], 0);
                const fin = parseNumber(row[COL_FIN], 0);

                console.log(`  Group ${rowIndex + 1} diagram: DA (Délai d'approche)=${da}, Déb=${deb}, Fin=${fin}`);

                // Update group with diagram data
                // offset = Déb (start of green phase), keep 0 if Déb = 0
                result.groups[rowIndex].offset = deb;
                result.groups[rowIndex].da = da; // Délai d'approche

                // Calculate green duration from Déb and Fin
                if (deb === 0 && fin === 0) {
                    // Both are 0: no green phase defined
                    result.groups[rowIndex].durations.green = 0;
                } else if (fin >= deb) {
                    // Normal case: Fin > Déb
                    result.groups[rowIndex].durations.green = fin - deb;
                } else {
                    // Wrapping case: green phase crosses cycle boundary
                    result.groups[rowIndex].durations.green = (result.cycleLength - deb) + fin;
                }

                console.log(`  Group ${rowIndex + 1}: offset=${deb}, green=${result.groups[rowIndex].durations.green}`);
            }
        }

        rowIndex++;
        excelRow += 2; // Every 2 rows: row 6, 8, 10, 12...
    }

    console.log('Conflict matrix parsed:', matrix);
    result.conflictMatrix = matrix;
}

/**
 * Parse PF sheet (contains both diagram and action table below)
 * - AL3 (column 37, row 2): Cycle duration
 * - Rows 6-15: Diagram with merged cells (green/orange phases)
 * - Below diagram: Action table
 */
function parsePFSheet(sheetData, result, pfNumber) {
    console.log(`Parsing PF${pfNumber} sheet, sheetData length:`, sheetData.length);

    if (sheetData.length < 2) return;

    // Extract cycle duration from AL3 (row 2, column 37 - AL is column 38 in 1-indexed, 37 in 0-indexed)
    // AL = A(1) + L(12) = column 38 (1-indexed) = index 37 (0-indexed)
    if (sheetData[2] && sheetData[2][37]) {
        const cycle = parseNumber(sheetData[2][37], null);
        console.log(`Cycle length from AL3 in PF${pfNumber}:`, cycle);
        if (cycle && cycle >= 30 && cycle <= 300) {
            result.cycleLength = cycle;
            console.log('Cycle length set to:', cycle);
        }
    }

    // A PF sheet contains:
    // 1. A diagram at the top (rows 6-15, visual representation with merged cells)
    // 2. An action table below the diagram

    // Find the action table by looking for header row with "GF", "Action", "Description" etc.
    let actionTableStartRow = -1;
    for (let i = 0; i < sheetData.length; i++) {
        const row = sheetData[i].map(cell => String(cell).toLowerCase().trim());
        if (row.some(cell => cell.includes('gf') || cell.includes('action')) &&
            row.some(cell => cell.includes('description') || cell.includes('deb'))) {
            actionTableStartRow = i;
            break;
        }
    }

    // If no action table found, create empty PF tab
    if (actionTableStartRow === -1) {
        result.pfTabs.push({
            id: pfNumber,
            name: `PF${pfNumber}`,
            data: []
        });
        return;
    }

    // Parse actions from this table
    const headerRow = sheetData[actionTableStartRow].map(cell => String(cell).toLowerCase().trim());

    // Find column indices
    const colIdx = {
        gf: findColumnIndex(headerRow, ['gf', 'groupe']),
        action: findColumnIndex(headerRow, ['action', 'type']),
        description: findColumnIndex(headerRow, ['description', 'desc', 'libellé', 'libelle']),
        deb: findColumnIndex(headerRow, ['deb', 'début', 'debut', 'start']),
        fin: findColumnIndex(headerRow, ['fin', 'end']),
        abrv: findColumnIndex(headerRow, ['abrv', 'abrev', 'abréviation']),
        actionMicro: findColumnIndex(headerRow, ['action_micro', 'actionmicro', 'micro']),
        plage1: findColumnIndex(headerRow, ['plage1', 'plage 1']),
        plage2: findColumnIndex(headerRow, ['plage2', 'plage 2']),
        actionGf1: findColumnIndex(headerRow, ['action gf 1', 'actiongf1', 'gf1']),
        actionGf2: findColumnIndex(headerRow, ['action gf 2', 'actiongf2', 'gf2']),
        actionGf3: findColumnIndex(headerRow, ['action gf 3', 'actiongf3', 'gf3']),
        actionGf4: findColumnIndex(headerRow, ['action gf 4', 'actiongf4', 'gf4'])
    };

    // Parse actions
    const actions = [];
    for (let i = actionTableStartRow + 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length === 0) continue;

        // Skip completely empty rows
        const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
        if (!hasData) continue;

        const action = {
            id: actions.length + 1,
            gf: parseNumber(row[colIdx.gf], ''),
            action: String(row[colIdx.action] || '').trim(),
            description: String(row[colIdx.description] || '').trim(),
            deb: parseNumber(row[colIdx.deb], ''),
            fin: parseNumber(row[colIdx.fin], ''),
            abrv: String(row[colIdx.abrv] || '').trim(),
            action_Micro: String(row[colIdx.actionMicro] || '').trim(),
            plage1: parseNumber(row[colIdx.plage1], ''),
            plage2: parseNumber(row[colIdx.plage2], ''),
            actionGf1: parseNumber(row[colIdx.actionGf1], ''),
            actionGf2: parseNumber(row[colIdx.actionGf2], ''),
            actionGf3: parseNumber(row[colIdx.actionGf3], ''),
            actionGf4: parseNumber(row[colIdx.actionGf4], '')
        };

        actions.push(action);
    }

    // Add this PF tab with its actions
    result.pfTabs.push({
        id: pfNumber,
        name: `PF${pfNumber}`,
        data: actions
    });
}

/**
 * Parse actions sheet (standalone - not used with new structure but kept for compatibility)
 */
function parseActionsSheet(sheetData, result) {
    if (sheetData.length < 2) return;

    // Find header row
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, sheetData.length); i++) {
        const row = sheetData[i].map(cell => String(cell).toLowerCase().trim());
        if (row.some(cell => cell.includes('gf') || cell.includes('action') || cell.includes('description'))) {
            headerRowIdx = i;
            break;
        }
    }

    const headerRow = sheetData[headerRowIdx].map(cell => String(cell).toLowerCase().trim());

    // Find column indices
    const colIdx = {
        gf: findColumnIndex(headerRow, ['gf', 'groupe']),
        action: findColumnIndex(headerRow, ['action', 'type']),
        description: findColumnIndex(headerRow, ['description', 'desc', 'libellé']),
        deb: findColumnIndex(headerRow, ['deb', 'début', 'debut', 'start']),
        fin: findColumnIndex(headerRow, ['fin', 'end']),
        abrv: findColumnIndex(headerRow, ['abrv', 'abrev', 'abréviation']),
        actionMicro: findColumnIndex(headerRow, ['action_micro', 'actionmicro', 'micro']),
        plage1: findColumnIndex(headerRow, ['plage1', 'plage 1']),
        plage2: findColumnIndex(headerRow, ['plage2', 'plage 2']),
        actionGf1: findColumnIndex(headerRow, ['action gf 1', 'actiongf1', 'gf1']),
        actionGf2: findColumnIndex(headerRow, ['action gf 2', 'actiongf2', 'gf2']),
        actionGf3: findColumnIndex(headerRow, ['action gf 3', 'actiongf3', 'gf3']),
        actionGf4: findColumnIndex(headerRow, ['action gf 4', 'actiongf4', 'gf4'])
    };

    // Parse actions
    const actions = [];
    for (let i = headerRowIdx + 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length === 0) continue;

        const action = {
            id: actions.length + 1,
            gf: parseNumber(row[colIdx.gf], ''),
            action: String(row[colIdx.action] || '').trim(),
            description: String(row[colIdx.description] || '').trim(),
            deb: parseNumber(row[colIdx.deb], ''),
            fin: parseNumber(row[colIdx.fin], ''),
            abrv: String(row[colIdx.abrv] || '').trim(),
            action_Micro: String(row[colIdx.actionMicro] || '').trim(),
            plage1: parseNumber(row[colIdx.plage1], ''),
            plage2: parseNumber(row[colIdx.plage2], ''),
            actionGf1: parseNumber(row[colIdx.actionGf1], ''),
            actionGf2: parseNumber(row[colIdx.actionGf2], ''),
            actionGf3: parseNumber(row[colIdx.actionGf3], ''),
            actionGf4: parseNumber(row[colIdx.actionGf4], '')
        };

        actions.push(action);
    }

    result.actionData = actions;
}

/**
 * Parse traffic sheet - "Trafic" sheet with specific cell positions
 * - Starting at E6: "Courant" field (with blank lines between each group)
 * - E6, E8, E10, E12... (every 2 rows, same pattern as Formulaire sheet)
 * - Column E (index 4): Courant name
 */
function parseTrafficSheet(sheetData, result) {
    if (sheetData.length < 6) return;

    console.log('parseTrafficSheet called, sheetData length:', sheetData.length);
    console.log('Number of groups to match:', result.groups.length);

    // Parse traffic data starting at row 5 (E6 = row index 5, column 4)
    // Groups are at E6, E8, E10... (every 2 rows, with blank line between)
    const trafficByGroup = {};
    let currentRow = 5; // Start at row 6 (index 5)
    let groupIndex = 0; // Index into result.groups array

    while (currentRow < sheetData.length && groupIndex < result.groups.length) {
        const row = sheetData[currentRow];

        console.log(`Checking traffic row ${currentRow + 1} (Excel row ${currentRow + 1}):`, row ? row.slice(0, 10) : 'undefined');

        // Check if this row has data in column E (index 4) - the "Courant" field
        if (row && row[4] !== '' && row[4] !== null && row[4] !== undefined) {
            const courantValue = String(row[4]).trim();
            console.log(`  Col E (idx 4) Courant: "${courantValue}"`);

            if (courantValue) {
                // Match this with the corresponding group by index
                const group = result.groups[groupIndex];
                if (group) {
                    console.log(`  Assigning to group ${group.id} (${group.name})`);
                    group.courant = courantValue;

                    trafficByGroup[group.id] = {
                        courant: courantValue,
                        coef: parseNumber(row[5], 1), // Column F if exists
                        trafic: parseNumber(row[6], 0), // Column G if exists
                        vUtile: parseNumber(row[7], 0) // Column H if exists
                    };
                }

                groupIndex++;
            }
        }

        // Skip to next group (every 2 rows: E6, E8, E10, E12...)
        currentRow += 2;
    }

    console.log('Traffic data parsed:', trafficByGroup);
    result.trafficData = trafficByGroup;
}

/**
 * Find column index by possible names
 */
function findColumnIndex(headerRow, possibleNames) {
    for (let i = 0; i < headerRow.length; i++) {
        const cellValue = headerRow[i].toLowerCase().trim();
        for (const name of possibleNames) {
            if (cellValue.includes(name)) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Parse number from cell value
 */
function parseNumber(value, defaultValue) {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
}
