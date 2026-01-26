import React, { useState, useMemo } from 'react';
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
    trafficDatasetNames,
    setHoveredVUtile,
    copyTrafficDataset
}) => {
    const [showPasteDropdown, setShowPasteDropdown] = useState(false);
    const [showAllGroups, setShowAllGroups] = useState(false);

    // Update traffic volume (per dataset)
    const handleTrafficChange = (id, value) => {
        updateTrafficData(id, 'trafficVol', value);
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
    const calculateDelay = (greenTime, trafficVol, laneCoef) => {
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
    const calculateQueue = (greenTime, trafficVol, laneCoef) => {
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
                <h3>Données Trafic</h3>
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
                        return (
                            <tr
                                key={g.id}
                                onMouseEnter={() => setHoveredGroupId && setHoveredGroupId(g.id)}
                                onMouseLeave={() => setHoveredGroupId && setHoveredGroupId(null)}
                            >
                                <td className="col-id">{g.id}</td>
                                <td className="col-name-readonly">{g.name}</td>

                                {/* Coef Voie (shared across all datasets) */}
                                {(() => {
                                    const vUtile = calculateVUtile(trafficData.trafficVol, g.laneCoef);
                                    const capacity = calculateCapacity(g.durations?.green, vUtile);
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
                                    const vUtile = calculateVUtile(trafficData.trafficVol, g.laneCoef);
                                    const capacity = calculateCapacity(g.durations?.green, vUtile);
                                    return (
                                        <td
                                            onMouseEnter={() => setHoveredVUtile && vUtile && setHoveredVUtile({ groupId: g.id, vUtile, capacityValue: capacity.value })}
                                            onMouseLeave={() => setHoveredVUtile && setHoveredVUtile(null)}
                                        >
                                            <input
                                                type="number"
                                                className="input-trafic-num"
                                                value={trafficData.trafficVol || ''}
                                                onChange={(e) => handleTrafficChange(g.id, parseInt(e.target.value) || 0)}
                                            />
                                        </td>
                                    );
                                })()}
                                {/* Vert Utile (calculé) */}
                                {(() => {
                                    const vUtile = calculateVUtile(trafficData.trafficVol, g.laneCoef);
                                    const capacity = calculateCapacity(g.durations?.green, vUtile);
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
                                    const vUtile = calculateVUtile(trafficData.trafficVol, g.laneCoef);
                                    const capacity = calculateCapacity(g.durations?.green, vUtile);
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
                                {(() => {
                                    const vUtile = calculateVUtile(trafficData.trafficVol, g.laneCoef);
                                    const capacity = calculateCapacity(g.durations?.green, vUtile);
                                    const delay = calculateDelay(g.durations?.green, trafficData.trafficVol, g.laneCoef);
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
                                {(() => {
                                    const vUtile = calculateVUtile(trafficData.trafficVol, g.laneCoef);
                                    const capacity = calculateCapacity(g.durations?.green, vUtile);
                                    const queue = calculateQueue(g.durations?.green, trafficData.trafficVol, g.laneCoef);
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
