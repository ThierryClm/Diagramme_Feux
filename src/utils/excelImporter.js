import * as XLSX from 'xlsx';

/**
 * Normalize action names from Excel to match the application's action options
 * Maps various Excel naming conventions to the standard names
 */
function normalizeActionName(actionName) {
    if (!actionName) return '';

    const normalized = String(actionName).trim();
    const lower = normalized.toLowerCase();

    // Map Excel variations to standard names
    const mappings = {
        // Bande passante variations
        'bande passante début de vert': 'Début de bande passante',
        'bande passante debut de vert': 'Début de bande passante',
        'début bande passante': 'Début de bande passante',
        'debut bande passante': 'Début de bande passante',
        'bp début': 'Début de bande passante',
        'bp debut': 'Début de bande passante',
        'bande passante fin de vert': 'Fin de bande passante',
        'fin bande passante': 'Fin de bande passante',
        'bp fin': 'Fin de bande passante',
        // Other variations
        'adaptatif': 'Adaptatif vertical',
        'point repos': 'Point de repos',
        'synchro': 'Synchro BTS',
        'priorité piéton': 'Priorité piétons',
        'priorite pieton': 'Priorité piétons',
        'priorite pietons': 'Priorité piétons',
        'escamotage phase': 'Escamotage de phase',
        'fermeture': 'Fermeture anticipée',
        'ouverture': 'Ouverture anticipée',
        'instant coordination': 'Instant de coordination',
        'seconde lucarne': 'Seconde lucarne',
        'signal aide conduite': 'Signa d\'aide à la conduite',
        'signa aide conduite': 'Signa d\'aide à la conduite',
    };

    // Check for exact match (case-insensitive)
    if (mappings[lower]) {
        return mappings[lower];
    }

    // Check for partial matches
    for (const [key, value] of Object.entries(mappings)) {
        if (lower.includes(key)) {
            return value;
        }
    }

    // Return original if no mapping found (capitalize first letter)
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Helper function to get cell value, handling merged cells
 * @param {Object} sheet - The worksheet object
 * @param {number} row - 0-based row index
 * @param {number} col - 0-based column index
 * @returns {any} - The cell value or empty string
 */
function getCellValue(sheet, row, col) {
    // Convert to Excel cell address (e.g., A1, B2, etc.)
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet[cellAddress];

    if (cell) {
        return cell.v !== undefined ? cell.v : '';
    }

    // If cell is empty, check if it's part of a merged range
    if (sheet['!merges']) {
        for (const merge of sheet['!merges']) {
            // Check if this cell is within the merged range
            if (row >= merge.s.r && row <= merge.e.r && col >= merge.s.c && col <= merge.e.c) {
                // Get value from the top-left cell of the merge
                const mergeAddress = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
                const mergeCell = sheet[mergeAddress];
                if (mergeCell) {
                    return mergeCell.v !== undefined ? mergeCell.v : '';
                }
            }
        }
    }

    return '';
}

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
                    // Parse 6th sheet (index 5) for conflict matrix, diagram data, and action table (PF1)
                    else if (sheetIndex === 5) {
                        parseMatrixSheet(sheetData, result, sheet, sheetName);
                    }
                    // Parse sheets after index 5 as additional PF tabs (PF2, PF3, ...)
                    else if (sheetIndex > 5) {
                        const pfNumber = sheetIndex - 4; // index 6 = PF2, index 7 = PF3, etc.
                        console.log(`Parsing additional PF sheet: PF${pfNumber} from sheet ${sheetIndex}`);
                        parseAdditionalPFSheet(sheetData, result, pfNumber, sheetName, sheet);
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
 * Normalize group type from Excel to match the application's type options
 * Valid types: V (VL), B (TC/Bus), P (Piéton), CY (Cycliste), FL (Flèche), PP (Priorité Piéton)
 * Returns empty string if not recognized or empty
 */
function normalizeGroupType(typeValue) {
    if (!typeValue) return '';

    const normalized = String(typeValue).trim();
    if (normalized === '') return '';

    const upper = normalized.toUpperCase();

    // Map Excel codes to standard types
    const mappings = {
        'V': 'V',
        'VL': 'V',
        'B': 'B',
        'TC': 'B',
        'BUS': 'B',
        'TRAM': 'B',
        'P': 'P',
        'PIETON': 'P',
        'PIÉTON': 'P',
        'PIETONS': 'P',
        'PIÉTONS': 'P',
        'CY': 'CY',
        'CYCLE': 'CY',
        'CYCLISTE': 'CY',
        'VELO': 'CY',
        'VÉLO': 'CY',
        'FL': 'FL',
        'FLECHE': 'FL',
        'FLÈCHE': 'FL',
        'PP': 'PP',
        'PRIORITE PIETON': 'PP',
        'PRIORITÉ PIÉTON': 'PP'
    };

    if (mappings[upper]) {
        return mappings[upper];
    }

    // Return empty string if unrecognized
    console.log(`Unknown group type "${typeValue}", leaving empty`);
    return '';
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
            const gfNumber = parseNumber(row[0], groups.length + 1); // Column B (index 0) - GF number
            const groupName = String(row[1] || '').trim(); // Column C (index 1) - Group name
            const typeRaw = row[2]; // Column D (index 2) - Type
            const type = normalizeGroupType(typeRaw);
            const minGreen = parseNumber(row[3], 6); // Column E (index 3) - Vert min
            const orange = parseNumber(row[4], 3); // Column F (index 4) - Jaune

            console.log(`Row ${currentRow + 1}, Parsed: GF=${gfNumber}, Name="${groupName}", TypeRaw="${typeRaw}", Type="${type}", MinGreen=${minGreen}, Orange=${orange}`);

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
function parseMatrixSheet(sheetData, result, sheet, sheetName) {
    if (sheetData.length < 6) return;

    // Get tab color from Excel sheet properties
    let tabColor = null;
    if (sheet['!tabColor']) {
        // tabColor can be { rgb: 'RRGGBB' } or { theme: X, tint: Y }
        if (sheet['!tabColor'].rgb) {
            tabColor = '#' + sheet['!tabColor'].rgb;
        } else if (sheet['!tabColor'].argb) {
            // ARGB format: first 2 chars are alpha, rest is RGB
            tabColor = '#' + sheet['!tabColor'].argb.substring(2);
        }
    }
    console.log(`Sheet "${sheetName}" tab color:`, tabColor);

    console.log('parseMatrixSheet called, sheetData length:', sheetData.length);
    console.log('Number of groups:', result.groups.length);

    // Column indices for sheetData array (Excel col - 2)
    const COL_DA = 34;   // AJ (Excel col 36) → index 34 - Délai d'approche
    const COL_DEB = 35;  // AK (Excel col 37) → index 35 - Début
    const COL_FIN = 36;  // AL (Excel col 38) → index 36 - Fin

    // Extract cycle duration from AL3 (row 3 = index 2, col AL = index 36)
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

    // Matrix starts at D6 - using same logic as DA/Déb/Fin: Excel col - 2 = JS index
    // D = col 4 → index 2, Row 6 → index 5
    const MATRIX_COL_START = 2;  // D (Excel col 4) → index 2
    const MATRIX_ROW_START = 5;  // Row 6 in Excel → index 5

    // Store diagram data for PF1 (same format as additional PF tabs)
    const pf1Diagram = [];

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
                // Debug: show row length and raw values at expected columns
                console.log(`  Row ${excelRow + 1} length: ${row.length}, checking cols AJ(${COL_DA}), AK(${COL_DEB}), AL(${COL_FIN})`);
                console.log(`  Raw values: AJ="${row[COL_DA]}", AK="${row[COL_DEB]}", AL="${row[COL_FIN]}"`);

                // DA is a string (2 characters), Déb and Fin are numbers
                const daRaw = row[COL_DA];
                const da = (daRaw !== null && daRaw !== undefined && daRaw !== '') ? String(daRaw).trim() : '';
                const deb = parseNumber(row[COL_DEB], 0);
                const fin = parseNumber(row[COL_FIN], 0);

                console.log(`  Group ${rowIndex + 1} diagram: DA (Délai d'approche)="${da}", Déb=${deb}, Fin=${fin}`);

                // Calculate green duration from Déb and Fin
                let greenDuration = 0;
                if (deb === 0 && fin === 0) {
                    // Both are 0: no green phase defined
                    greenDuration = 0;
                } else if (fin >= deb) {
                    // Normal case: Fin > Déb
                    greenDuration = fin - deb;
                } else {
                    // Wrapping case: green phase crosses cycle boundary
                    greenDuration = (result.cycleLength - deb) + fin;
                }

                // Update group with diagram data (for initial display)
                result.groups[rowIndex].offset = deb;
                result.groups[rowIndex].da = da;
                result.groups[rowIndex].durations.green = greenDuration;

                // Also store in pf1Diagram for PF tab (same format as additional PFs)
                pf1Diagram.push({
                    groupId: result.groups[rowIndex].id,
                    da: da,
                    offset: deb,
                    greenDuration: greenDuration
                });

                console.log(`  Group ${rowIndex + 1}: offset=${deb}, green=${greenDuration}`);
            }
        }

        rowIndex++;
        excelRow += 2; // Every 2 rows: row 6, 8, 10, 12...
    }

    console.log('Conflict matrix parsed:', matrix);
    result.conflictMatrix = matrix;

    // Parse action table starting at row 110 (Excel row 110 = 0-based index 109)
    // Column A is protected, so data starts at column B
    // Using sheetData with Excel col - 2 formula (same as other imports)
    const ACTION_ROW_START = 109;  // Row 110 → index 109

    // Column indices for sheetData (Excel col - 2)
    // B = Excel col 2 → index 0
    const COL_GF = 0;              // B (Excel col 2) → index 0
    const COL_ACTION = 1;          // C (Excel col 3) → index 1
    const COL_DESCRIPTION = 2;     // D (Excel col 4) → index 2 (merged D-AJ)
    const COL_ACTION_DEB = 35;     // AK (Excel col 37) → index 35
    const COL_ACTION_FIN = 36;     // AL (Excel col 38) → index 36
    const COL_ABRV = 37;           // AM (Excel col 39) → index 37
    const COL_ACTION_MICRO = 38;   // AN (Excel col 40) → index 38 (merged AN-CK)
    const COL_ACTION_GF1 = 88;     // CL (Excel col 90) → index 88 (merged CL-CN)
    const COL_ACTION_GF2 = 91;     // CO (Excel col 93) → index 91 (merged CO-CQ)
    const COL_ACTION_GF3 = 94;     // CR (Excel col 96) → index 94 (merged CR-CT)
    const COL_ACTION_GF4 = 97;     // CU (Excel col 99) → index 97 (merged CU-CW)
    const COL_PLAGE1 = 100;        // CX (Excel col 102) → index 100 (merged CX-CZ)
    const COL_PLAGE2 = 103;        // DA (Excel col 105) → index 103 (merged DA-DC)

    console.log('Parsing action table from row 110...');
    console.log('sheetData total length:', sheetData.length);
    console.log('ACTION_ROW_START:', ACTION_ROW_START);
    console.log('Row 109 exists?', sheetData[109] ? 'yes' : 'no');
    console.log('Row 110 (index 109) first 5 cols:', sheetData[109] ? sheetData[109].slice(0, 5) : 'N/A');
    console.log('Row 111 (index 110) first 5 cols:', sheetData[110] ? sheetData[110].slice(0, 5) : 'N/A');

    const actions = [];
    let actionRow = ACTION_ROW_START;

    while (actionRow < sheetData.length) {
        const row = sheetData[actionRow];

        if (!row) {
            actionRow++;
            continue;
        }

        const gfValue = row[COL_GF];
        const actionValue = row[COL_ACTION];
        const descValue = row[COL_DESCRIPTION];

        // Stop if row is empty (10 consecutive empty rows = end of table)
        if ((gfValue === '' || gfValue === undefined) &&
            (actionValue === '' || actionValue === undefined) &&
            (descValue === '' || descValue === undefined)) {
            actionRow++;
            let emptyCount = 0;
            for (let i = 0; i < 10 && (actionRow + i) < sheetData.length; i++) {
                const checkRow = sheetData[actionRow + i];
                if (!checkRow || ((checkRow[COL_GF] === '' || checkRow[COL_GF] === undefined) &&
                    (checkRow[COL_ACTION] === '' || checkRow[COL_ACTION] === undefined))) {
                    emptyCount++;
                } else {
                    break;
                }
            }
            if (emptyCount >= 10) break;
            continue;
        }

        // If we have at least some data, create an action entry
        if (gfValue !== '' || actionValue !== '' || descValue !== '') {
            const action = {
                id: actions.length + 1,
                gf: parseNumber(gfValue, ''),
                action: normalizeActionName(actionValue),
                description: String(descValue || '').trim(),
                deb: parseNumber(row[COL_ACTION_DEB], ''),
                fin: parseNumber(row[COL_ACTION_FIN], ''),
                abrv: String(row[COL_ABRV] || '').trim(),
                micro: String(row[COL_ACTION_MICRO] || '').trim(),  // ActionTable uses 'micro'
                plage1: parseNumber(row[COL_PLAGE1], ''),
                plage2: parseNumber(row[COL_PLAGE2], ''),
                actGf1: parseNumber(row[COL_ACTION_GF1], ''),      // ActionTable uses 'actGf1'
                actGf1Gf2: parseNumber(row[COL_ACTION_GF2], ''),   // ActionTable uses 'actGf1Gf2'
                actGf1Gf3: parseNumber(row[COL_ACTION_GF3], ''),   // ActionTable uses 'actGf1Gf3'
                actGf1Gf4: parseNumber(row[COL_ACTION_GF4], '')    // ActionTable uses 'actGf1Gf4'
            };

            actions.push(action);
        }

        actionRow++;

        // Safety limit to prevent infinite loop
        if (actions.length >= 200) {
            console.log('Reached max actions limit (200)');
            break;
        }
    }

    console.log(`Total actions parsed: ${actions.length}`);

    // Helper function to create empty action row (matching useTrafficLight format)
    const createEmptyActionRow = (id) => ({
        id,
        gf: '',
        action: '',
        description: '',
        deb: '',
        fin: '',
        abrv: '',
        micro: '',
        plage1: '',
        plage2: '',
        actGf1: '',
        actGf1Gf2: '',
        actGf1Gf3: '',
        actGf1Gf4: ''
    });

    // Add empty rows after imported data to allow adding new entries
    // Total should be at least 30 rows, or imported count + 10 empty rows
    const minTotalRows = Math.max(30, actions.length + 10);
    for (let i = actions.length; i < minTotalRows; i++) {
        actions.push(createEmptyActionRow(i + 1));
    }

    // Store actions in both pfTabs and actionData for compatibility
    // Use Excel sheet name and tab color
    // Include diagram data and cycleLength for consistency with additional PF tabs
    result.pfTabs = [{
        id: 1,
        name: sheetName || 'PF1',
        color: tabColor,
        cycleLength: result.cycleLength,
        diagram: pf1Diagram,
        data: actions
    }];
    result.actionData = actions; // Also store in actionData for App.jsx compatibility
}

/**
 * Parse additional PF sheets (index > 5) for cycle, diagram data, and action table
 * - AL3: Cycle duration
 * - AJ, AK, AL columns (rows 6, 8, 10...): DA, Déb, Fin for diagram
 * - Row 110+: Action table (conditions micro)
 *
 * @param {Array} sheetData - Sheet data as 2D array
 * @param {Object} result - Result object to populate
 * @param {number} pfNumber - PF number (2, 3, 4...)
 * @param {string} sheetName - Original sheet name from Excel
 * @param {Object} sheet - Excel sheet object (for tab color)
 */
function parseAdditionalPFSheet(sheetData, result, pfNumber, sheetName, sheet) {
    console.log(`parseAdditionalPFSheet called for PF${pfNumber}, sheetData length:`, sheetData.length);

    if (sheetData.length < 6) {
        console.log(`Sheet ${sheetName} too short, skipping`);
        return;
    }

    // Get tab color from Excel sheet properties
    let tabColor = null;
    if (sheet && sheet['!tabColor']) {
        if (sheet['!tabColor'].rgb) {
            tabColor = '#' + sheet['!tabColor'].rgb;
        } else if (sheet['!tabColor'].argb) {
            tabColor = '#' + sheet['!tabColor'].argb.substring(2);
        }
    }
    console.log(`Sheet "${sheetName}" tab color:`, tabColor);

    // Column indices for sheetData array (Excel col - 2)
    const COL_DA = 34;   // AJ (Excel col 36) → index 34 - Délai d'approche
    const COL_DEB = 35;  // AK (Excel col 37) → index 35 - Début
    const COL_FIN = 36;  // AL (Excel col 38) → index 36 - Fin

    // Extract cycle duration from AL3 (row 3 = index 2, col AL = index 36)
    let pfCycleLength = result.cycleLength; // Default to main cycle
    if (sheetData[2] && sheetData[2][COL_FIN]) {
        const cycle = parseNumber(sheetData[2][COL_FIN], null);
        console.log(`Cycle length from AL3 in PF${pfNumber}:`, cycle);
        if (cycle && cycle >= 10 && cycle <= 300) {
            pfCycleLength = cycle;
        }
    }

    // Extract diagram data for each group (DA, Déb, Fin)
    // Store as pfDiagram array with group timing info
    const pfDiagram = [];
    const size = result.groups.length;
    let excelRow = 5; // Start at row 6 (index 5)

    for (let groupIndex = 0; groupIndex < size && excelRow < sheetData.length; groupIndex++) {
        const row = sheetData[excelRow];

        if (row) {
            // DA is a string (2 characters), Déb and Fin are numbers
            const daRaw = row[COL_DA];
            const da = (daRaw !== null && daRaw !== undefined && daRaw !== '') ? String(daRaw).trim() : '';
            const deb = parseNumber(row[COL_DEB], 0);
            const fin = parseNumber(row[COL_FIN], 0);

            // Calculate green duration
            let greenDuration = 0;
            if (deb === 0 && fin === 0) {
                greenDuration = 0;
            } else if (fin >= deb) {
                greenDuration = fin - deb;
            } else {
                greenDuration = (pfCycleLength - deb) + fin;
            }

            pfDiagram.push({
                groupId: result.groups[groupIndex]?.id || groupIndex + 1,
                da: da,
                offset: deb,
                greenDuration: greenDuration
            });

            console.log(`  PF${pfNumber} Group ${groupIndex + 1}: DA=${da}, Déb=${deb}, Fin=${fin}, green=${greenDuration}`);
        }

        excelRow += 2; // Every 2 rows: row 6, 8, 10...
    }

    // Parse action table starting at row 110 (Excel row 110 = 0-based index 109)
    const ACTION_ROW_START = 109;

    // Column indices for action table
    const COL_GF = 0;
    const COL_ACTION = 1;
    const COL_DESCRIPTION = 2;
    const COL_ACTION_DEB = 35;
    const COL_ACTION_FIN = 36;
    const COL_ABRV = 37;
    const COL_ACTION_MICRO = 38;
    const COL_ACTION_GF1 = 88;
    const COL_ACTION_GF2 = 91;
    const COL_ACTION_GF3 = 94;
    const COL_ACTION_GF4 = 97;
    const COL_PLAGE1 = 100;
    const COL_PLAGE2 = 103;

    const actions = [];
    let actionRow = ACTION_ROW_START;

    while (actionRow < sheetData.length) {
        const row = sheetData[actionRow];

        if (!row) {
            actionRow++;
            continue;
        }

        const gfValue = row[COL_GF];
        const actionValue = row[COL_ACTION];
        const descValue = row[COL_DESCRIPTION];

        // Stop if row is empty (10 consecutive empty rows = end of table)
        if ((gfValue === '' || gfValue === undefined) &&
            (actionValue === '' || actionValue === undefined) &&
            (descValue === '' || descValue === undefined)) {
            actionRow++;
            let emptyCount = 0;
            for (let i = 0; i < 10 && (actionRow + i) < sheetData.length; i++) {
                const checkRow = sheetData[actionRow + i];
                if (!checkRow || ((checkRow[COL_GF] === '' || checkRow[COL_GF] === undefined) &&
                    (checkRow[COL_ACTION] === '' || checkRow[COL_ACTION] === undefined))) {
                    emptyCount++;
                } else {
                    break;
                }
            }
            if (emptyCount >= 10) break;
            continue;
        }

        // If we have at least some data, create an action entry
        if (gfValue !== '' || actionValue !== '' || descValue !== '') {
            const action = {
                id: actions.length + 1,
                gf: parseNumber(gfValue, ''),
                action: normalizeActionName(actionValue),
                description: String(descValue || '').trim(),
                deb: parseNumber(row[COL_ACTION_DEB], ''),
                fin: parseNumber(row[COL_ACTION_FIN], ''),
                abrv: String(row[COL_ABRV] || '').trim(),
                micro: String(row[COL_ACTION_MICRO] || '').trim(),
                plage1: parseNumber(row[COL_PLAGE1], ''),
                plage2: parseNumber(row[COL_PLAGE2], ''),
                actGf1: parseNumber(row[COL_ACTION_GF1], ''),
                actGf1Gf2: parseNumber(row[COL_ACTION_GF2], ''),
                actGf1Gf3: parseNumber(row[COL_ACTION_GF3], ''),
                actGf1Gf4: parseNumber(row[COL_ACTION_GF4], '')
            };

            actions.push(action);
        }

        actionRow++;

        // Safety limit
        if (actions.length >= 200) {
            console.log('Reached max actions limit (200)');
            break;
        }
    }

    console.log(`PF${pfNumber}: ${actions.length} actions parsed`);

    // Helper function to create empty action row
    const createEmptyActionRow = (id) => ({
        id,
        gf: '',
        action: '',
        description: '',
        deb: '',
        fin: '',
        abrv: '',
        micro: '',
        plage1: '',
        plage2: '',
        actGf1: '',
        actGf1Gf2: '',
        actGf1Gf3: '',
        actGf1Gf4: ''
    });

    // Add empty rows after imported data
    const minTotalRows = Math.max(30, actions.length + 10);
    for (let i = actions.length; i < minTotalRows; i++) {
        actions.push(createEmptyActionRow(i + 1));
    }

    // Add this PF tab to result with Excel sheet name and color
    result.pfTabs.push({
        id: pfNumber,
        name: sheetName || `PF${pfNumber}`,
        color: tabColor,
        cycleLength: pfCycleLength,
        diagram: pfDiagram,
        data: actions
    });

    console.log(`Added "${sheetName}" tab (PF${pfNumber}) with color=${tabColor}, cycle=${pfCycleLength}, ${pfDiagram.length} diagram entries, ${actions.length} actions`);
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
 * - Column E (Excel col 5) → index 3 (using Excel col - 2 formula)
 */
function parseTrafficSheet(sheetData, result) {
    if (sheetData.length < 6) return;

    console.log('parseTrafficSheet called, sheetData length:', sheetData.length);
    console.log('Number of groups to match:', result.groups.length);

    // Column indices using Excel col - 2 formula
    const COL_COURANT = 3;  // E (Excel col 5) → index 3

    // Parse traffic data starting at row 6 (index 5)
    // Groups are at E6, E8, E10... (every 2 rows, with blank line between)
    const trafficByGroup = {};
    let currentRow = 5; // Start at row 6 (index 5)
    let groupIndex = 0; // Index into result.groups array

    while (currentRow < sheetData.length && groupIndex < result.groups.length) {
        const row = sheetData[currentRow];

        console.log(`Checking traffic row ${currentRow + 1} (Excel row ${currentRow + 1}):`, row ? row.slice(0, 10) : 'undefined');

        // Check if this row has data in column E (index 3) - the "Courant" field
        if (row && row[COL_COURANT] !== '' && row[COL_COURANT] !== null && row[COL_COURANT] !== undefined) {
            const courantValue = String(row[COL_COURANT]).trim();
            console.log(`  Col E (idx ${COL_COURANT}) Courant: "${courantValue}"`);

            if (courantValue) {
                // Match this with the corresponding group by index
                const group = result.groups[groupIndex];
                if (group) {
                    console.log(`  Assigning to group ${group.id} (${group.name})`);
                    group.courant = courantValue;

                    trafficByGroup[group.id] = {
                        courant: courantValue,
                        coef: parseNumber(row[COL_COURANT + 1], 1), // Column F
                        trafic: parseNumber(row[COL_COURANT + 2], 0), // Column G
                        vUtile: parseNumber(row[COL_COURANT + 3], 0) // Column H
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
