import React from 'react';
import './IntergreenMatrix.css';

const IntergreenMatrix = ({ conflictMatrix, setMatrixValue, groups, cycleLength, actionData }) => {

    // Get all "Seconde lucarne" actions
    const getSecondesLucarnes = () => {
        if (!actionData) return [];
        return actionData
            .filter(row => row.action === 'Seconde lucarne' && row.gf && row.deb !== '' && row.fin !== '')
            .map(row => ({
                gf: parseInt(row.gf),
                deb: parseInt(row.deb),
                fin: parseInt(row.fin),
                id: row.id
            }));
    };

    const secondesLucarnes = getSecondesLucarnes();

    // Check if a seconde lucarne conflicts with a group's green time
    const checkSecondeLucarneConflicts = () => {
        const conflicts = [];
        const cycle = cycleLength || 100;

        secondesLucarnes.forEach(sl => {
            const slStart = sl.deb;
            const slEnd = sl.fin;
            const slDuration = slEnd >= slStart ? slEnd - slStart : cycle - slStart + slEnd;

            // Check against all other groups
            for (let otherIdx = 0; otherIdx < groups.length; otherIdx++) {
                const otherGf = otherIdx + 1;
                if (otherGf === sl.gf) continue; // Skip same group

                // Check if there's an intergreen constraint
                const slIdx = sl.gf - 1;
                const intergreen1 = conflictMatrix[slIdx]?.[otherIdx]; // SL -> Other
                const intergreen2 = conflictMatrix[otherIdx]?.[slIdx]; // Other -> SL

                if (!intergreen1 && !intergreen2) continue; // No constraint

                const otherGroup = groups[otherIdx];
                if (!otherGroup) continue;

                const otherStart = otherGroup.offset % cycle;
                const otherEnd = (otherGroup.offset + otherGroup.durations.green) % cycle;

                // Check delay from seconde lucarne end to other group start
                if (intergreen1 && intergreen1 !== '') {
                    let delay = otherStart - slEnd;
                    if (delay < 0) delay += cycle;
                    if (delay < intergreen1) {
                        conflicts.push({
                            type: 'sl_to_group',
                            slGf: sl.gf,
                            otherGf: otherGf,
                            required: intergreen1,
                            actual: delay
                        });
                    }
                }

                // Check delay from other group end to seconde lucarne start
                if (intergreen2 && intergreen2 !== '') {
                    let delay = slStart - otherEnd;
                    if (delay < 0) delay += cycle;
                    if (delay < intergreen2) {
                        conflicts.push({
                            type: 'group_to_sl',
                            slGf: sl.gf,
                            otherGf: otherGf,
                            required: intergreen2,
                            actual: delay
                        });
                    }
                }
            }

            // Check against other secondes lucarnes
            secondesLucarnes.forEach(otherSl => {
                if (otherSl.id === sl.id) return; // Skip self
                if (otherSl.gf === sl.gf) return; // Skip same group

                const slIdx = sl.gf - 1;
                const otherIdx = otherSl.gf - 1;
                const intergreen1 = conflictMatrix[slIdx]?.[otherIdx];
                const intergreen2 = conflictMatrix[otherIdx]?.[slIdx];

                if (!intergreen1 && !intergreen2) return;

                // Check delay from SL1 end to SL2 start
                if (intergreen1 && intergreen1 !== '') {
                    let delay = otherSl.deb - slEnd;
                    if (delay < 0) delay += cycle;
                    if (delay < intergreen1) {
                        conflicts.push({
                            type: 'sl_to_sl',
                            slGf: sl.gf,
                            otherGf: otherSl.gf,
                            required: intergreen1,
                            actual: delay
                        });
                    }
                }
            });

            // Check if seconde lucarne overlaps with its own group's main green
            const ownGroup = groups[sl.gf - 1];
            if (ownGroup) {
                const mainStart = ownGroup.offset % cycle;
                const mainEnd = (ownGroup.offset + ownGroup.durations.green) % cycle;

                // Check for overlap
                const slWraps = slEnd < slStart;
                const mainWraps = mainEnd < mainStart;

                let overlaps = false;
                if (!slWraps && !mainWraps) {
                    overlaps = slStart < mainEnd && mainStart < slEnd;
                } else if (slWraps && !mainWraps) {
                    overlaps = mainStart < slEnd || mainEnd > slStart;
                } else if (!slWraps && mainWraps) {
                    overlaps = slStart < mainEnd || slEnd > mainStart;
                } else {
                    overlaps = true;
                }

                if (overlaps) {
                    conflicts.push({
                        type: 'sl_overlap_main',
                        slGf: sl.gf,
                        otherGf: sl.gf,
                        required: 0,
                        actual: 0
                    });
                }
            }
        });

        // Remove duplicates
        const seen = new Set();
        return conflicts.filter(c => {
            const key = `${c.type}-${c.slGf}-${c.otherGf}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const slConflicts = secondesLucarnes.length > 0 ? checkSecondeLucarneConflicts() : [];

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

    // Count asymmetric cells and get pairs
    const getAsymmetricPairs = () => {
        const pairs = [];
        for (let i = 0; i < conflictMatrix.length; i++) {
            for (let j = 0; j < conflictMatrix.length; j++) {
                if (i !== j && isAsymmetric(i, j)) {
                    // The cell [i][j] is empty but [j][i] has a value
                    pairs.push({ from: j + 1, to: i + 1 });
                }
            }
        }
        return pairs;
    };

    const asymmetricPairs = getAsymmetricPairs();

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
                            {indices.map(i => <th key={i}>{i}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {conflictMatrix.map((row, fromIdx) => (
                            <tr key={fromIdx}>
                                <td className="row-header">{fromIdx + 1}</td>
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
                                        cellClass = 'matrix-asymmetric-cell';
                                        inputClass = 'matrix-error-input';
                                    }

                                    return (
                                        <td key={toIdx} className={fromIdx === toIdx ? 'diagonal-cell' : cellClass}>
                                            {fromIdx === toIdx ? (
                                                <span className="diagonal">-</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    className={inputClass}
                                                    value={val}
                                                    onChange={(e) => setMatrixValue(fromIdx + 1, toIdx + 1, e.target.value)}
                                                    min="3"
                                                    max="20"
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

            {asymmetricPairs.length > 0 && (
                <div className="matrix-warning">
                    Matrice non symétrique : {asymmetricPairs.length} valeur(s) manquante(s)
                    <br />
                    <small>
                        {asymmetricPairs.map((p, i) => (
                            <span key={i}>
                                {p.from}→{p.to}
                                {i < asymmetricPairs.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </small>
                </div>
            )}

            {slConflicts.length > 0 && (
                <div className="matrix-error">
                    Conflits Secondes Lucarnes : {slConflicts.length} problème(s)
                    <ul className="conflict-details">
                        {slConflicts.map((c, i) => (
                            <li key={i}>
                                {c.type === 'sl_overlap_main' ? (
                                    <>SL {c.slGf} chevauche le vert principal</>
                                ) : c.type === 'sl_to_sl' ? (
                                    <>SL {c.slGf} → SL {c.otherGf} : {c.actual}s &lt; {c.required}s requis</>
                                ) : c.type === 'sl_to_group' ? (
                                    <>SL {c.slGf} → {c.otherGf} : {c.actual}s &lt; {c.required}s requis</>
                                ) : (
                                    <>{c.otherGf} → SL {c.slGf} : {c.actual}s &lt; {c.required}s requis</>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default IntergreenMatrix;
