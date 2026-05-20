import React, { useState, useCallback, useRef, useEffect } from 'react';
import EmptyState from './EmptyState';
import { compareWithPF1 as compareWithPF1Pure, buildCellTooltipLines as buildCellTooltipLinesPure } from '../utils/matrixComparison';
import {
    getFlecheAnticipations as getFlecheAnticipationsPure,
    hasOverlap as hasOverlapPure,
    computeActualDelay as computeActualDelayPure,
    isDelayInsufficient as isDelayInsufficientPure
} from '../utils/matrixDelayConflict';
import './IntergreenMatrix.css';
import './NumericInput.css';

// Input component with local state for intermediate values during typing
const MatrixInput = ({ value, onChange, className }) => {
    const [localValue, setLocalValue] = useState(value === '' ? '' : String(value));
    const [isEditing, setIsEditing] = useState(false);
    const [rejected, setRejected] = useState(false);
    const rejectTimerRef = React.useRef(null);

    // Sync local value with prop when not editing
    React.useEffect(() => {
        if (!isEditing) {
            setLocalValue(value === '' ? '' : String(value));
        }
    }, [value, isEditing]);

    const handleChange = (e) => {
        // Only allow digits
        const raw = e.target.value;
        const filtered = raw.replace(/[^0-9]/g, '');
        if (raw !== filtered) {
            setRejected(true);
            if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
            rejectTimerRef.current = setTimeout(() => setRejected(false), 350);
        }
        // Keep previous value if the user's keystroke would wipe a non-empty field
        if (filtered === '' && raw !== '' && localValue !== '') {
            return;
        }
        setLocalValue(filtered);
    };

    const handleFocus = (e) => {
        setIsEditing(true);
        // Select all text on focus for easy replacement
        e.target.select();
    };

    const handleBlur = () => {
        setIsEditing(false);
        // Validate and commit on blur
        onChange(localValue);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            setIsEditing(false);
            onChange(localValue);
            e.target.blur();
        }
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className={`${className || ''} ${rejected ? 'numeric-input-rejected' : ''}`.trim()}
            value={isEditing ? localValue : (value === '' ? '' : String(value))}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
        />
    );
};

const IntergreenMatrix = ({ conflictMatrix, setMatrixValue, groups, cycleLength, actionData, activePFId, pfTabs, biCarrefourSeparator, onCellHover, showGroupNames = true, locked = false, onDetach, hoveredGroupId, tooltipsEnabled = true }) => {
    const tip = (text) => tooltipsEnabled ? text : undefined;

    // Bi-carrefour separator index
    const separatorIdx = biCarrefourSeparator != null ? groups.findIndex(g => g.id === biCarrefourSeparator) : -1;

    // Get the reference matrix from PF1 for comparison
    const pf1Matrix = pfTabs?.find(pf => pf.id === 1)?.conflictMatrix || null;
    const isComparingWithPF1 = activePFId && activePFId !== 1 && pf1Matrix && pf1Matrix.length > 0;

    // Compare current value with PF1 value (logique pure dans utils/matrixComparison).
    // Returns: 'higher' (red), 'lower' (green), or null (equal or no comparison).
    const compareWithPF1 = (fromIdx, toIdx, currentVal) =>
        compareWithPF1Pure(fromIdx, toIdx, currentVal, isComparingWithPF1 ? pf1Matrix : null);

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

    // Logique de détection des conflits (verbatim dans utils/matrixDelayConflict).
    // On capture les dépendances dans un ctx partagé puis on referme via des
    // closures pour conserver la signature (fromIdx, toIdx) aux points d'appel.
    const flecheAnticipations = getFlecheAnticipationsPure(actionData);
    const conflictCtx = { conflictMatrix, groups, cycleLength, flecheAnticipations };
    const hasOverlap = (fromIdx, toIdx) => hasOverlapPure(fromIdx, toIdx, conflictCtx);
    const computeActualDelay = (fromIdx, toIdx) => computeActualDelayPure(fromIdx, toIdx, conflictCtx);
    const isDelayInsufficient = (fromIdx, toIdx) => isDelayInsufficientPure(fromIdx, toIdx, conflictCtx);

    // Lignes d'infobulle de cellule (logique pure dans utils/matrixComparison) :
    //  - écart vs PF1 (seulement quand on consulte un autre PF) ;
    //  - description du conflit pour les cases en fond rouge.
    const buildCellTooltipLines = (fromIdx, toIdx) =>
        buildCellTooltipLinesPure({
            fromIdx, toIdx,
            conflictMatrix,
            refMatrix: isComparingWithPF1 ? pf1Matrix : null,
            groups,
            isDelayInsufficient,
            hasOverlap,
            computeActualDelay
        });

    // Infobulle custom (delai 1 s a l'apparition, disparition immediate a
    // la sortie de la case). title natif limite a ~500 ms non configurable
    // -> implementation custom pour respecter le delai et eviter l'effet
    // "sapin de Noel" lors du survol rapide de la grille.
    const [cellTooltip, setCellTooltip] = useState(null); // { x, y, lines }
    const tooltipTimerRef = useRef(null);
    const scheduleCellTooltip = (e, fromIdx, toIdx) => {
        if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
        if (!tooltipsEnabled) return;   // section Matrice desactivee
        const lines = buildCellTooltipLines(fromIdx, toIdx);
        if (lines.length === 0) return;
        const x = e.clientX;
        const y = e.clientY;
        tooltipTimerRef.current = setTimeout(() => {
            setCellTooltip({ x, y, lines });
        }, 500);
    };
    const hideCellTooltip = () => {
        if (tooltipTimerRef.current) {
            clearTimeout(tooltipTimerRef.current);
            tooltipTimerRef.current = null;
        }
        setCellTooltip(null);
    };
    useEffect(() => () => {
        if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    }, []);

    // 16x16 is big. Let's make it a scrollable grid.
    const size = conflictMatrix.length;
    const indices = Array.from({ length: size }, (_, i) => i + 1);

    return (
        <div className="matrix-container-inline">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                Matrice des temps interverts
                {locked && (
                    <span
                        style={{ color: '#aaa', fontWeight: 'normal', fontSize: '0.85em' }}
                        title={tip("La matrice est en lecture seule. Décochez « Verrouiller les matrices » dans le menu Diagramme pour la modifier.")}
                    >
                        (Verrouillé)
                    </span>
                )}
                {onDetach && (
                    <button
                        className="detach-btn"
                        onClick={onDetach}
                        title={tip("Détacher dans une fenêtre séparée")}
                    >
                        Détacher
                    </button>
                )}
            </h3>

            <div className="matrix-scroll" style={{ position: 'relative' }}>
                {Array.isArray(conflictMatrix) && conflictMatrix.length > 0 && conflictMatrix.every(row => row.every(v => v === '' || v === null || v === undefined)) && (
                    <div className="empty-state-overlay">
                        <EmptyState
                            icon="matrix"
                            title={tip("Matrice non renseignée")}
                            hint="Saisissez les temps interverts (en secondes) entre les groupes de feux antagonistes. Un clic dans une cellule suffit."
                        />
                    </div>
                )}
                <table className="matrix-grid">
                    <thead>
                        <tr>
                            <th>/</th>
                            {showGroupNames && <th className="col-name-header">Nom</th>}
                            {indices.map(i => <th key={i} className={`col-index-header${separatorIdx >= 0 && (i - 1) === separatorIdx ? ' matrix-bi-sep-right' : ''}${hoveredGroupId === i ? ' matrix-hovered-col' : ''}`}>{i}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {conflictMatrix.map((row, fromIdx) => (
                            <tr key={fromIdx} className={hoveredGroupId === fromIdx + 1 ? 'matrix-hovered-row' : ''}>
                                <td className={`row-header${separatorIdx >= 0 && fromIdx === separatorIdx ? ' matrix-bi-sep-bottom' : ''}`}>{fromIdx + 1}</td>
                                {showGroupNames && (
                                    <td className={`row-name${separatorIdx >= 0 && fromIdx === separatorIdx ? ' matrix-bi-sep-bottom' : ''}`}>
                                        {groups && groups[fromIdx] ? groups[fromIdx].name : '-'}
                                    </td>
                                )}
                                {row.map((val, toIdx) => {
                                    const hasInsufficientDelay = isDelayInsufficient(fromIdx, toIdx);
                                    const hasAsymmetry = isAsymmetric(fromIdx, toIdx);
                                    const comparisonResult = compareWithPF1(fromIdx, toIdx, val);
                                    let cellClass = '';
                                    let inputClass = '';
                                    if (hasInsufficientDelay) {
                                        cellClass = 'matrix-conflict-cell';
                                        inputClass = 'matrix-conflict-input';
                                    } else if (hasAsymmetry) {
                                        cellClass = 'matrix-asymmetric-cell';
                                        inputClass = 'matrix-error-input';
                                    }

                                    // Apply comparison class for PF2, PF3, etc.
                                    if (comparisonResult === 'higher') {
                                        inputClass += ' matrix-compare-higher';
                                    } else if (comparisonResult === 'lower') {
                                        inputClass += ' matrix-compare-lower';
                                    }

                                    let biClass = '';
                                    if (separatorIdx >= 0 && fromIdx === separatorIdx) biClass += ' matrix-bi-sep-bottom';
                                    if (separatorIdx >= 0 && toIdx === separatorIdx) biClass += ' matrix-bi-sep-right';

                                    return (
                                        <td
                                            key={toIdx}
                                            className={(fromIdx === toIdx ? 'diagonal-cell' : cellClass) + biClass + (hoveredGroupId === toIdx + 1 ? ' matrix-hovered-col' : '')}
                                            onMouseEnter={fromIdx !== toIdx ? (e) => {
                                                if (onCellHover) onCellHover({ from: fromIdx + 1, to: toIdx + 1, isConflict: hasInsufficientDelay });
                                                scheduleCellTooltip(e, fromIdx, toIdx);
                                            } : undefined}
                                            onMouseLeave={fromIdx !== toIdx ? () => {
                                                if (onCellHover) onCellHover(null);
                                                hideCellTooltip();
                                            } : undefined}
                                        >
                                            {fromIdx === toIdx ? (
                                                <span className="diagonal">-</span>
                                            ) : locked ? (
                                                <span className={`matrix-locked-cell ${inputClass}`}>{val === '' ? '' : String(val)}</span>
                                            ) : (
                                                <MatrixInput
                                                    className={inputClass}
                                                    value={val}
                                                    onChange={(newValue) => setMatrixValue(fromIdx + 1, toIdx + 1, newValue)}
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

            {cellTooltip && (
                <div className="action-hover-tooltip" style={{
                    position: 'fixed',
                    left: cellTooltip.x + 12,
                    top: cellTooltip.y + 8,
                    pointerEvents: 'none',
                    zIndex: 9999,
                    maxWidth: '380px'
                }}>
                    {cellTooltip.lines.map((l, i) => (
                        <div
                            key={i}
                            className={i === 0 ? 'action-hover-tooltip-name' : 'action-hover-tooltip-micro'}
                        >{l}</div>
                    ))}
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
