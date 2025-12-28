import React from 'react';
import './IntergreenMatrix.css';

const IntergreenMatrix = ({ conflictMatrix, setMatrixValue, groups, cycleLength }) => {

    // Check if cell is 'asymmetric' (missing value where mirror has one)
    const isAsymmetric = (row, col) => {
        const val = conflictMatrix[row][col];
        const mirrorVal = conflictMatrix[col][row];
        // If mirror has a value (number) and current is empty, it's asymmetric
        if (row === col) return false;
        const valIsEmpty = val === '' || val === undefined || val === null;
        const mirrorIsEmpty = mirrorVal === '' || mirrorVal === undefined || mirrorVal === null;
        if (!mirrorIsEmpty && valIsEmpty) return true;
        return false;
    };

    // Check if two groups have overlapping green phases
    const hasOverlap = (fromIdx, toIdx) => {
        const matrixVal = conflictMatrix[fromIdx][toIdx];
        // Skip if value is empty (not defined), but consider 0 as valid
        if (matrixVal === '' || matrixVal === undefined || matrixVal === null) return false;
        if (!groups || !groups[fromIdx] || !groups[toIdx]) return false;

        const groupA = groups[fromIdx];
        const groupB = groups[toIdx];
        const cycle = cycleLength || 100;

        const aStart = groupA.offset % cycle;
        const aEnd = (groupA.offset + groupA.durations.green) % cycle;
        const bStart = groupB.offset % cycle;
        const bEnd = (groupB.offset + groupB.durations.green) % cycle;

        // Check for overlap considering cyclic timeline
        // Two intervals overlap if they share any common point
        const aWraps = aEnd <= aStart; // A wraps around cycle
        const bWraps = bEnd <= bStart; // B wraps around cycle

        if (!aWraps && !bWraps) {
            // Neither wraps: simple interval check
            return aStart < bEnd && bStart < aEnd;
        } else if (aWraps && !bWraps) {
            // A wraps: A is [aStart, cycle) + [0, aEnd)
            return bStart < aEnd || bEnd > aStart;
        } else if (!aWraps && bWraps) {
            // B wraps: B is [bStart, cycle) + [0, bEnd)
            return aStart < bEnd || aEnd > bStart;
        } else {
            // Both wrap: they definitely overlap
            return true;
        }
    };

    // Check if matrix value exceeds actual delay between groups
    const isDelayInsufficient = (fromIdx, toIdx) => {
        const matrixVal = conflictMatrix[fromIdx][toIdx];
        // Skip if value is empty (not defined), but consider 0 as valid
        if (matrixVal === '' || matrixVal === undefined || matrixVal === null) return false;
        if (!groups || !groups[fromIdx] || !groups[toIdx]) return false;

        // First check for overlap - if groups overlap, it's definitely a conflict
        if (hasOverlap(fromIdx, toIdx)) return true;

        const fromGroup = groups[fromIdx];
        const toGroup = groups[toIdx];
        const cycle = cycleLength || 100;

        // End of fromGroup green phase
        const fromEnd = (fromGroup.offset + fromGroup.durations.green) % cycle;
        // Start of toGroup green phase
        const toStart = toGroup.offset % cycle;

        // Calculate actual delay
        let actualDelay = toStart - fromEnd;
        if (actualDelay < 0) actualDelay += cycle;

        return matrixVal > actualDelay;
    };

    // 16x16 is big. Let's make it a scrollable grid.
    const size = conflictMatrix.length;
    const indices = Array.from({ length: size }, (_, i) => i + 1);

    return (
        <div className="matrix-container-inline">
            <h3>Matrice de Temps Intervert (Sécurité)</h3>

            <div className="matrix-scroll">
                <table className="matrix-grid">
                    <thead>
                        <tr>
                            <th>/</th>
                            <th className="col-name-header">Nom</th>
                            {indices.map(i => <th key={i}>G{i}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {conflictMatrix.map((row, fromIdx) => (
                            <tr key={fromIdx}>
                                <td className="row-header">G{fromIdx + 1}</td>
                                <td className="row-name">
                                    {groups && groups[fromIdx] ? groups[fromIdx].name : '-'}
                                </td>
                                {row.map((val, toIdx) => {
                                    const hasInsufficientDelay = isDelayInsufficient(fromIdx, toIdx);
                                    const hasAsymmetry = isAsymmetric(fromIdx, toIdx);
                                    let cellClass = '';
                                    let inputClass = '';
                                    if (hasInsufficientDelay) {
                                        cellClass = 'matrix-conflict-cell';
                                        inputClass = 'matrix-conflict-input';
                                    } else if (hasAsymmetry) {
                                        inputClass = 'matrix-error-input';
                                    }

                                    return (
                                        <td key={toIdx} className={cellClass}>
                                            {fromIdx === toIdx ? (
                                                <span className="diagonal">-</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    className={inputClass}
                                                    value={val}
                                                    onChange={(e) => setMatrixValue(fromIdx + 1, toIdx + 1, e.target.value)}
                                                    min="0"
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IntergreenMatrix;
