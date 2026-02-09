import React, { useState, useMemo, useRef, useCallback } from 'react';
import './TrafficTable.css';

const TrafficTable = ({
    groups,
    cycleLength,
    activeTrafficDataset,
    setActiveTrafficDataset,
    updateTrafficData,
    getTrafficData,
    updateGroupParams,
    setHoveredGroupId,
    hoveredGroupId,
    trafficDatasetNames,
    setHoveredVUtile,
    copyTrafficDataset,
    actionData = [],
    simulationSelectedActions = []
}) => {
    const [showPasteDropdown, setShowPasteDropdown] = useState(false);
    const [showAllGroups, setShowAllGroups] = useState(false);
    const [tooltipGroupId, setTooltipGroupId] = useState(null);
    const tooltipTimerRef = useRef(null);

    const handleTrafficMouseEnter = useCallback((groupId) => {
        tooltipTimerRef.current = setTimeout(() => {
            setTooltipGroupId(groupId);
        }, 5000);
    }, []);

    const handleTrafficMouseLeave = useCallback(() => {
        if (tooltipTimerRef.current) {
            clearTimeout(tooltipTimerRef.current);
            tooltipTimerRef.current = null;
        }
        setTooltipGroupId(null);
    }, []);

    // Determine which groups are inhibited by selected simulation actions
    // (Escamotage de phase, Fermeture anticipée, Adaptatif vertical)
    const inhibitedGroups = useMemo(() => {
        const inhibited = new Set();
        const inhibitActions = ['Escamotage de phase', 'Fermeture anticipée', 'Adaptatif vertical'];

        actionData.forEach(action => {
            if (simulationSelectedActions.includes(action.id) &&
                inhibitActions.includes(action.action) &&
                action.gf) {
                const gfId = parseInt(action.gf.toString().replace(/[Gg]/g, '').trim());
                if (gfId > 0) {
                    inhibited.add(gfId);
                }
            }
        });

        return inhibited;
    }, [actionData, simulationSelectedActions]);

    // Parse trafficVol: extract numeric value (ignoring trailing 'c')
    const parseTrafficVol = (val) => {
        if (!val) return 0;
        const str = String(val).replace(/c$/i, '');
        return parseInt(str) || 0;
    };

    // Check if trafficVol is coordinated (ends with 'c')
    const isCoordinated = (val) => {
        return String(val || '').endsWith('c');
    };

    // Update traffic volume (per dataset)
    const handleTrafficChange = (id, value) => {
        // Allow only digits and optional trailing 'c'
        const cleaned = String(value).replace(/[^0-9c]/gi, '');
        // Keep only one 'c' at the end
        const numPart = cleaned.replace(/c/gi, '');
        const hasC = /c/i.test(cleaned);
        const finalValue = numPart ? (hasC ? numPart + 'c' : (parseInt(numPart) || 0)) : (hasC ? 'c' : 0);
        updateTrafficData(id, 'trafficVol', finalValue);
    };

    // Handle keydown on traffic input: toggle 'c' suffix
    const handleTrafficKeyDown = (e, id, currentVal) => {
        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            const str = String(currentVal || '');
            if (str.endsWith('c')) {
                // Remove 'c'
                const numPart = str.replace(/c$/, '');
                updateTrafficData(id, 'trafficVol', parseInt(numPart) || 0);
            } else {
                // Add 'c'
                const numPart = str.replace(/[^0-9]/g, '');
                updateTrafficData(id, 'trafficVol', numPart ? numPart + 'c' : 'c');
            }
        }
    };

    // Filter groups based on showAllGroups checkbox
    const vlGroups = showAllGroups
        ? groups
        : groups.filter(g => g.type === 'VL' || g.type === 'V');
    const isDatasetEmpty = useMemo(() => {
        return vlGroups.every(g => {
            const data = getTrafficData(g.id);
            return !data.trafficVol;
        });
    }, [vlGroups, getTrafficData, activeTrafficDataset]);

    // Get other datasets that have data
    const otherDatasetsWithData = useMemo(() => {
        return trafficDatasetNames.filter(ds => ds !== activeTrafficDataset);
    }, [trafficDatasetNames, activeTrafficDataset]);

    // Handle paste from another dataset
    const handlePasteFrom = (sourceDataset) => {
        if (copyTrafficDataset) {
            copyTrafficDataset(sourceDataset, activeTrafficDataset);
        }
        setShowPasteDropdown(false);
    };

    // Update shared fields (same for all datasets)
    const handleSharedChange = (id, field, value) => {
        updateGroupParams(id, { [field]: value });
    };

    // Calculate total green time for a group (main green + seconde lucarne durations)
    const getTotalGreenTime = (groupId, mainGreenTime) => {
        if (!mainGreenTime) return 0;

        // Find all "Seconde lucarne" actions for this group
        const lucarneActions = actionData.filter(
            action => action.action === 'Seconde lucarne' &&
                     parseInt(action.gf) === groupId &&
                     action.deb !== '' && action.deb !== null &&
                     action.fin !== '' && action.fin !== null
        );

        // Sum up lucarne durations
        let lucarneDuration = 0;
        lucarneActions.forEach(lucarne => {
            const deb = parseFloat(lucarne.deb);
            const fin = parseFloat(lucarne.fin);
            if (!isNaN(deb) && !isNaN(fin)) {
                // Handle wrap-around (fin < deb means it crosses cycle boundary)
                let duration = fin - deb;
                if (duration < 0) {
                    duration += cycleLength;
                }
                lucarneDuration += duration;
            }
        });

        return mainGreenTime + lucarneDuration;
    };

    // Calculate V.Utile = trafic / (1800 * coef / cycle)
    const calculateVUtile = (trafficVol, laneCoef) => {
        if (!trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
        const result = trafficVol / (1800 * laneCoef / cycleLength);
        return Math.round(result); // Round to integer
    };

    // Calculate Cap.U = (V.Utile / green time) * 100 (percentage)
    const calculateCapacity = (greenTime, vUtile) => {
        if (!greenTime || !vUtile || greenTime === 0) return { value: null, display: '' };
        const result = Math.round((vUtile / greenTime) * 100);
        return { value: result, display: result + '%' };
    };

    // Calculate Retard = (cycle - vert)² / (2 * cycle * (1 - trafic / (1800 * coef)))
    // Si une action "Début de bande passante" a pour actGf1 le groupe, alors :
    // Retard = max(0, début_de_vert - fin_de_l'action)
    const calculateDelay = (greenTime, trafficVol, laneCoef, groupId, groupOffset) => {
        // Vérifier s'il existe une action "Début de bande passante" pour ce groupe
        const bandeAction = actionData.find(
            action => action.action === 'Début de bande passante' &&
                     parseInt(action.actGf1) === groupId &&
                     action.fin !== '' && action.fin !== null && action.fin !== undefined
        );

        if (bandeAction) {
            // Formule spéciale : max(0, début_de_vert - fin_de_l'action)
            const finValue = parseFloat(bandeAction.fin);
            if (!isNaN(finValue) && groupOffset !== undefined && groupOffset !== null) {
                return Math.max(0, Math.round(groupOffset - finValue));
            }
        }

        // Formule standard
        if (!greenTime || !trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
        const saturationFlow = 1800 * laneCoef;
        const ratio = trafficVol / saturationFlow;
        // Éviter division par zéro si ratio >= 1
        if (ratio >= 1) return null;
        const denominator = 2 * cycleLength * (1 - ratio);
        if (denominator === 0) return null;
        const redTime = cycleLength - greenTime;
        const result = (redTime * redTime) / denominator;
        return Math.round(result); // Arrondi à l'unité
    };

    // Calculate File d'attente = (Math.floor(Trafic × (Cycle - Vert) / 3600 / Coef) + 1) × 6
    // Si une action "Début de bande passante" a pour actGf1 le groupe, alors :
    // File d'attente = max(0, début_de_vert - fin_de_l'action)
    const calculateQueue = (greenTime, trafficVol, laneCoef, groupId, groupOffset) => {
        // Vérifier s'il existe une action "Début de bande passante" pour ce groupe
        const bandeAction = actionData.find(
            action => action.action === 'Début de bande passante' &&
                     parseInt(action.actGf1) === groupId &&
                     action.fin !== '' && action.fin !== null && action.fin !== undefined
        );

        if (bandeAction) {
            // Formule spéciale : max(0, début_de_vert - fin_de_l'action)
            const finValue = parseFloat(bandeAction.fin);
            if (!isNaN(finValue) && groupOffset !== undefined && groupOffset !== null) {
                return Math.max(0, Math.round(groupOffset - finValue));
            }
        }

        // Formule standard
        if (!greenTime || !trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
        const redTime = cycleLength - greenTime;
        // Formule : (partie entière de (Trafic * (cycle - vert) / 3600 / Coef) + 1) * 6
        const innerValue = trafficVol * redTime / 3600 / laneCoef;
        const result = (Math.floor(innerValue) + 1) * 6;
        return result;
    };

    // Get capacity color class based on value
    const getCapacityColorClass = (value) => {
        if (value === null) return '';
        if (value < 76) return 'capacity-green';
        if (value <= 85) return 'capacity-orange';
        if (value <= 100) return 'capacity-red';
        return 'capacity-black';
    };

    return (
        <div className="traffic-table-container">
            <div className="traffic-header">
                <h3>Données Trafic {hoveredGroupId !== null && <span style={{color: '#4ecdc4', fontSize: '0.8em'}}> [Grp {hoveredGroupId}]</span>}</h3>
                <label className="traffic-all-groups-checkbox">
                    <input
                        type="checkbox"
                        checked={showAllGroups}
                        onChange={(e) => setShowAllGroups(e.target.checked)}
                    />
                    Tous les Grp
                </label>
                <div className="traffic-dataset-group">
                    <span className="traffic-dataset-label">Associé à</span>
                    <select
                        className="traffic-dataset-selector"
                        value={activeTrafficDataset}
                        onChange={(e) => setActiveTrafficDataset(e.target.value)}
                    >
                        {trafficDatasetNames.map(ds => (
                            <option key={ds} value={ds}>{ds}</option>
                        ))}
                    </select>
                </div>
            </div>
            <table className="traffic-table">
                <thead>
                    <tr>
                        <th className="col-grp">Grp</th>
                        <th className="col-nom">Nom</th>
                        <th title="Coefficient de voie correspondant aux courants de circulation du groupe de feu">Coef</th>
                        <th className="col-trafic-header">
                            {isDatasetEmpty && otherDatasetsWithData.length > 0 ? (
                                <div className="paste-button-container">
                                    <button
                                        className="paste-button"
                                        onClick={() => setShowPasteDropdown(!showPasteDropdown)}
                                    >
                                        Coller...
                                    </button>
                                    {showPasteDropdown && (
                                        <div className="paste-dropdown">
                                            {otherDatasetsWithData.map(ds => (
                                                <div
                                                    key={ds}
                                                    className="paste-dropdown-item"
                                                    onClick={() => handlePasteFrom(ds)}
                                                >
                                                    {ds}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                'Trafic'
                            )}
                        </th>
                        <th title="Durée de vert nécessaire pour passer le trafic">V.<br/>Utile</th>
                        <th title="Capacité utilisée pour passer le trafic affecté au groupe de feu">Cap.<br/>U</th>
                        <th title="Temps d'attente théorique moyen en pied de feu hors saturation">Retard</th>
                        <th title="File d'attente théorique maximale hors saturation">File<br/>d'attente</th>
                    </tr>
                </thead>
                <tbody>
                    {vlGroups.map(g => {
                        const trafficData = getTrafficData(g.id);
                        // Check if this group is inhibited by a selected simulation action
                        const isInhibited = inhibitedGroups.has(g.id);
                        return (
                            <tr
                                key={g.id}
                                className={`${hoveredGroupId === g.id ? 'row-highlighted' : ''} ${isInhibited ? 'row-inhibited' : ''}`}
                                onMouseEnter={() => setHoveredGroupId && setHoveredGroupId(g.id)}
                                onMouseLeave={() => setHoveredGroupId && setHoveredGroupId(null)}
                            >
                                <td className="col-id">{g.id}</td>
                                <td className="col-name-readonly">{g.name}</td>

                                {/* Coef Voie (shared across all datasets) */}
                                {(() => {
                                    const totalGreen = getTotalGreenTime(g.id, g.durations?.green);
                                    const numericVol = parseTrafficVol(trafficData.trafficVol);
                                    const vUtile = isInhibited ? null : calculateVUtile(numericVol, g.laneCoef);
                                    const capacity = isInhibited ? { value: null, display: '' } : calculateCapacity(totalGreen, vUtile);
                                    return (
                                        <td
                                            onMouseEnter={() => setHoveredVUtile && vUtile && setHoveredVUtile({ groupId: g.id, vUtile, capacityValue: capacity.value })}
                                            onMouseLeave={() => setHoveredVUtile && setHoveredVUtile(null)}
                                        >
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="input-trafic-num"
                                                value={g.laneCoef || ''}
                                                onChange={(e) => handleSharedChange(g.id, 'laneCoef', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                    );
                                })()}
                                {/* Trafic (per dataset) */}
                                {(() => {
                                    const totalGreen = getTotalGreenTime(g.id, g.durations?.green);
                                    const numericVol = parseTrafficVol(trafficData.trafficVol);
                                    const vUtile = isInhibited ? null : calculateVUtile(numericVol, g.laneCoef);
                                    const capacity = isInhibited ? { value: null, display: '' } : calculateCapacity(totalGreen, vUtile);
                                    return (
                                        <td
                                            onMouseEnter={() => setHoveredVUtile && vUtile && setHoveredVUtile({ groupId: g.id, vUtile, capacityValue: capacity.value })}
                                            onMouseLeave={() => setHoveredVUtile && setHoveredVUtile(null)}
                                        >
                                            <div
                                                className="trafic-input-wrapper"
                                                onMouseEnter={() => handleTrafficMouseEnter(g.id)}
                                                onMouseLeave={handleTrafficMouseLeave}
                                            >
                                                <input
                                                    type="text"
                                                    className="input-trafic-num"
                                                    value={numericVol || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const coordinated = isCoordinated(trafficData.trafficVol);
                                                        const num = parseInt(val) || 0;
                                                        handleTrafficChange(g.id, coordinated ? num + 'c' : num);
                                                    }}
                                                    onKeyDown={(e) => handleTrafficKeyDown(e, g.id, trafficData.trafficVol)}
                                                />
                                                {isCoordinated(trafficData.trafficVol) && (
                                                    <span className="trafic-coordinated-c">c</span>
                                                )}
                                                {tooltipGroupId === g.id && (
                                                    <div className="trafic-custom-tooltip">
                                                        Appuyez sur 'c' pour indiquer un trafic coordonné
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })()}
                                {/* Vert Utile (calculé) */}
                                {(() => {
                                    const totalGreen = getTotalGreenTime(g.id, g.durations?.green);
                                    const numericVol = parseTrafficVol(trafficData.trafficVol);
                                    const vUtile = isInhibited ? null : calculateVUtile(numericVol, g.laneCoef);
                                    const capacity = isInhibited ? { value: null, display: '' } : calculateCapacity(totalGreen, vUtile);
                                    return (
                                        <td
                                            className="col-calculated col-vutile"
                                            onMouseEnter={() => setHoveredVUtile && vUtile && setHoveredVUtile({ groupId: g.id, vUtile, capacityValue: capacity.value })}
                                            onMouseLeave={() => setHoveredVUtile && setHoveredVUtile(null)}
                                        >
                                            {vUtile ? `${vUtile}''` : ''}
                                        </td>
                                    );
                                })()}
                                {/* Capacité Utilisée (calculée: V.Utile / temps vert * 100) */}
                                {(() => {
                                    const totalGreen = getTotalGreenTime(g.id, g.durations?.green);
                                    const numericVol = parseTrafficVol(trafficData.trafficVol);
                                    const vUtile = isInhibited ? null : calculateVUtile(numericVol, g.laneCoef);
                                    const capacity = isInhibited ? { value: null, display: '' } : calculateCapacity(totalGreen, vUtile);
                                    return (
                                        <td
                                            className={`col-calculated ${getCapacityColorClass(capacity.value)}`}
                                            onMouseEnter={() => setHoveredVUtile && vUtile && setHoveredVUtile({ groupId: g.id, vUtile, capacityValue: capacity.value })}
                                            onMouseLeave={() => setHoveredVUtile && setHoveredVUtile(null)}
                                        >
                                            {capacity.display}
                                        </td>
                                    );
                                })()}
                                {/* Retard (calculé) = (cycle - vert)² / (2 * cycle * (1 - trafic / (1800 * coef))) */}
                                {/* Ou si action "Début de bande passante" avec actGf1 = groupe : max(0, début_vert - fin_action) */}
                                {/* Si trafic coordonné (suffixe 'c'), retard = 0 */}
                                {(() => {
                                    const totalGreen = getTotalGreenTime(g.id, g.durations?.green);
                                    const numericVol = parseTrafficVol(trafficData.trafficVol);
                                    const coordinated = isCoordinated(trafficData.trafficVol);
                                    const vUtile = isInhibited ? null : calculateVUtile(numericVol, g.laneCoef);
                                    const capacity = isInhibited ? { value: null, display: '' } : calculateCapacity(totalGreen, vUtile);
                                    const delay = isInhibited ? null : (coordinated && numericVol ? 0 : calculateDelay(totalGreen, numericVol, g.laneCoef, g.id, g.offset));
                                    return (
                                        <td
                                            className="col-calculated"
                                            onMouseEnter={() => setHoveredVUtile && vUtile && setHoveredVUtile({ groupId: g.id, vUtile, capacityValue: capacity.value })}
                                            onMouseLeave={() => setHoveredVUtile && setHoveredVUtile(null)}
                                        >
                                            {delay !== null ? `${delay}''` : ''}
                                        </td>
                                    );
                                })()}
                                {/* File d'attente (calculé) = (Trafic * (cycle - vert) / (3600 / Coef)) * 6 */}
                                {/* Ou si action "Début de bande passante" avec actGf1 = groupe : max(0, début_vert - fin_action) */}
                                {/* Si trafic coordonné (suffixe 'c'), file d'attente = 0 */}
                                {(() => {
                                    const totalGreen = getTotalGreenTime(g.id, g.durations?.green);
                                    const numericVol = parseTrafficVol(trafficData.trafficVol);
                                    const coordinated = isCoordinated(trafficData.trafficVol);
                                    const vUtile = isInhibited ? null : calculateVUtile(numericVol, g.laneCoef);
                                    const capacity = isInhibited ? { value: null, display: '' } : calculateCapacity(totalGreen, vUtile);
                                    const queue = isInhibited ? null : (coordinated && numericVol ? 0 : calculateQueue(totalGreen, numericVol, g.laneCoef, g.id, g.offset));
                                    return (
                                        <td
                                            className="col-calculated"
                                            onMouseEnter={() => setHoveredVUtile && vUtile && setHoveredVUtile({ groupId: g.id, vUtile, capacityValue: capacity.value })}
                                            onMouseLeave={() => setHoveredVUtile && setHoveredVUtile(null)}
                                        >
                                            {queue !== null ? `${queue}m` : ''}
                                        </td>
                                    );
                                })()}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default TrafficTable;
