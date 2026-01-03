import React from 'react';
import './TrafficTable.css';
import { TRAFFIC_DATASETS } from '../hooks/useTrafficLight';

const TrafficTable = ({
    groups,
    cycleLength,
    activeTrafficDataset,
    setActiveTrafficDataset,
    updateTrafficData,
    getTrafficData
}) => {

    const handleChange = (id, field, value) => {
        updateTrafficData(id, field, value);
    };

    // Calculate V.Utile = trafic / (1800 * coef / cycle)
    const calculateVUtile = (trafficVol, laneCoef) => {
        if (!trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return '';
        const result = trafficVol / (1800 * laneCoef / cycleLength);
        return Math.round(result); // Round to integer
    };

    return (
        <div className="traffic-table-container">
            <div className="traffic-header">
                <h3>Données Trafic</h3>
                <select
                    className="traffic-dataset-selector"
                    value={activeTrafficDataset}
                    onChange={(e) => setActiveTrafficDataset(e.target.value)}
                >
                    {TRAFFIC_DATASETS.map(ds => (
                        <option key={ds} value={ds}>{ds}</option>
                    ))}
                </select>
            </div>
            <table className="traffic-table">
                <thead>
                    <tr>
                        <th>Grp</th>
                        <th>Nom</th>
                        <th>Courant</th>
                        <th>Coef</th>
                        <th>Trafic</th>
                        <th>V.Utile</th>
                        <th>Cap.U</th>
                        <th>Retard</th>
                        <th>Attente</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map(g => {
                        const trafficData = getTrafficData(g.id);
                        return (
                            <tr key={g.id}>
                                <td className="col-id">{g.id}</td>
                                <td className="col-name-readonly">{g.name}</td>

                                {/* Courant de circulation */}
                                <td>
                                    <input
                                        type="text"
                                        className="input-trafic-text"
                                        value={trafficData.trafficStream || ''}
                                        onChange={(e) => handleChange(g.id, 'trafficStream', e.target.value)}
                                    />
                                </td>
                                {/* Coef Voie */}
                                <td>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="input-trafic-num"
                                        value={trafficData.laneCoef || ''}
                                        onChange={(e) => handleChange(g.id, 'laneCoef', parseFloat(e.target.value) || 0)}
                                    />
                                </td>
                                {/* Trafic */}
                                <td>
                                    <input
                                        type="number"
                                        className="input-trafic-num"
                                        value={trafficData.trafficVol || ''}
                                        onChange={(e) => handleChange(g.id, 'trafficVol', parseInt(e.target.value) || 0)}
                                    />
                                </td>
                                {/* Vert Utile (calculé) */}
                                <td className="col-calculated">
                                    {calculateVUtile(trafficData.trafficVol, trafficData.laneCoef)}
                                </td>
                                {/* Capacité Utilisée */}
                                <td>
                                    <input
                                        type="number"
                                        className="input-trafic-num"
                                        value={trafficData.usedCapacity || ''}
                                        onChange={(e) => handleChange(g.id, 'usedCapacity', parseInt(e.target.value) || 0)}
                                    />
                                </td>
                                {/* Retard */}
                                <td>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="input-trafic-num"
                                        value={trafficData.delay || ''}
                                        onChange={(e) => handleChange(g.id, 'delay', parseFloat(e.target.value) || 0)}
                                    />
                                </td>
                                {/* Ile d'attente (Queue) */}
                                <td>
                                    <input
                                        type="number"
                                        className="input-trafic-num"
                                        value={trafficData.queueLength || ''}
                                        onChange={(e) => handleChange(g.id, 'queueLength', parseFloat(e.target.value) || 0)}
                                    />
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
