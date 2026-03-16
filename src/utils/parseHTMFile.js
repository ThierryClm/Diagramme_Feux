/**
 * Parses an HTM/HTML file content and extracts traffic light group data.
 *
 * @param {string} content - Raw HTML string
 * @returns {Array} Array of group objects { id, name, type, minGreen, offset, durations }
 */
const parseHTMFile = (content) => {
    const groups = [];

    // Parse HTML table rows - look for traffic light data patterns
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    // Try to find tables with traffic light data
    const tables = doc.querySelectorAll('table');

    for (const table of tables) {
        const rows = table.querySelectorAll('tr');

        for (const row of rows) {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 4) {
                // Try to extract group data from cells
                const cellTexts = Array.from(cells).map(c => c.textContent.trim());

                // Look for patterns like: group name, green duration, orange, red
                const nameCell = cellTexts[0];
                const greenVal = parseInt(cellTexts[1]) || parseInt(cellTexts[2]);
                const orangeVal = parseInt(cellTexts[2]) || parseInt(cellTexts[3]) || 3;

                if (nameCell && greenVal > 0) {
                    groups.push({
                        id: groups.length + 1,
                        name: nameCell,
                        type: nameCell.toLowerCase().includes('pieton') ? 'Piéton' :
                              nameCell.toLowerCase().includes('cycle') ? 'Cycliste' : 'VL',
                        minGreen: 6,
                        offset: 0,
                        durations: {
                            green: greenVal,
                            orange: orangeVal,
                            red: 0
                        }
                    });
                }
            }
        }
    }

    // If no tables found, try to parse structured text
    if (groups.length === 0) {
        const lines = content.split('\n');
        for (const line of lines) {
            // Look for patterns like "GF1: 30s vert, 3s orange"
            const match = line.match(/([A-Za-z0-9]+)\s*[:]\s*(\d+)/);
            if (match) {
                const greenMatch = line.match(/(\d+)\s*s?\s*(vert|green)/i);
                const orangeMatch = line.match(/(\d+)\s*s?\s*(orange|jaune)/i);

                if (greenMatch) {
                    groups.push({
                        id: groups.length + 1,
                        name: match[1],
                        type: 'VL',
                        minGreen: 6,
                        offset: 0,
                        durations: {
                            green: parseInt(greenMatch[1]) || 0,
                            orange: orangeMatch ? parseInt(orangeMatch[1]) : 3,
                            red: 0
                        }
                    });
                }
            }
        }
    }

    return groups;
};

export default parseHTMFile;
