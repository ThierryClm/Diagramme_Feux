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

    // Update traffic volume (per dataset)
    const handleTrafficChange = (id, value) => {
        updateTrafficData(id, 'trafficVol', value);
    };

    // Check if current dataset is empty
    const vlGroups = groups.filter(g => g.type === 'VL' || g.type === 'V');
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
                        <th>Coef</th>
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
                        <th>V.<br/>Utile</th>
                        <th>Cap.<br/>U</th>
                        <th>Retard</th>
                        <th>Attente</th>
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
                                <td>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="input-trafic-num"
                                        value={g.laneCoef || ''}
                                        onChange={(e) => handleSharedChange(g.id, 'laneCoef', parseFloat(e.target.value) || 0)}
                                    />
                                </td>
                                {/* Trafic (per dataset) */}
                                <td>
                                    <input
                                        type="number"
                                        className="input-trafic-num"
                                        value={trafficData.trafficVol || ''}
                                        onChange={(e) => handleTrafficChange(g.id, parseInt(e.target.value) || 0)}
                                    />
                                </td>
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
                                            {vUtile || ''}
                                        </td>
                                    );
                                })()}
                                {/* Capacité Utilisée (calculée: V.Utile / temps vert * 100) */}
                                {(() => {
                                    const capacity = calculateCapacity(g.durations?.green, calculateVUtile(trafficData.trafficVol, g.laneCoef));
                                    return (
                                        <td className={`col-calculated ${getCapacityColorClass(capacity.value)}`}>
                                            {capacity.display}
                                        </td>
                                    );
                                })()}
                                {/* Retard (calculé - lecture seule) */}
                                <td className="col-calculated">
                                    {g.delay || ''}
                                </td>
                                {/* Ile d'attente (calculé - lecture seule) */}
                                <td className="col-calculated">
                                    {g.queueLength || ''}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default TrafficTable;
