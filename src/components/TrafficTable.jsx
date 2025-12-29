import React from 'react';
import './TrafficTable.css';

const TrafficTable = ({ groups, updateGroupParams, cycleLength }) => {

    const handleChange = (id, field, value) => {
        // Allow float for some, int for others? Let's use generic logic for now.
        updateGroupParams(id, { [field]: value });
    };

    // Calculate V.Utile = trafic / (1800 * coef / cycle)
    const calculateVUtile = (trafficVol, laneCoef) => {
        if (!trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return '';
        const result = trafficVol / (1800 * laneCoef / cycleLength);
        return Math.round(result); // Round to integer
    };

    return (
        <div className="traffic-table-container">
            <h3>Données Trafic</h3>
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
                    {groups.map(g => (
                        <tr key={g.id}>
                            <td className="col-id">G{g.id}</td>
                            <td className="col-name-readonly">{g.name}</td>

                            {/* Courant de circulation */}
                            <td>
                                <input
                                    type="text"
                                    className="input-trafic-text"
                                    value={g.trafficStream}
                                    onChange={(e) => handleChange(g.id, 'trafficStream', e.target.value)}
                                />
                            </td>
                            {/* Coef Voie */}
                            <td>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="input-trafic-num"
                                    value={g.laneCoef}
                                    onChange={(e) => handleChange(g.id, 'laneCoef', parseFloat(e.target.value))}
                                />
                            </td>
                            {/* Trafic */}
                            <td>
                                <input
                                    type="number"
                                    className="input-trafic-num"
                                    value={g.trafficVol}
                                    onChange={(e) => handleChange(g.id, 'trafficVol', parseInt(e.target.value))}
                                />
                            </td>
                            {/* Vert Utile (calculé) */}
                            <td className="col-calculated">
                                {calculateVUtile(g.trafficVol, g.laneCoef)}
                            </td>
                            {/* Capacité Utilisée */}
                            <td>
                                <input
                                    type="number"
                                    className="input-trafic-num"
                                    value={g.usedCapacity}
                                    onChange={(e) => handleChange(g.id, 'usedCapacity', parseInt(e.target.value))}
                                />
                            </td>
                            {/* Retard */}
                            <td>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="input-trafic-num"
                                    value={g.delay}
                                    onChange={(e) => handleChange(g.id, 'delay', parseFloat(e.target.value))}
                                />
                            </td>
                            {/* Ile d'attente (Queue) */}
                            <td>
                                <input
                                    type="number"
                                    className="input-trafic-num"
                                    value={g.queueLength}
                                    onChange={(e) => handleChange(g.id, 'queueLength', parseFloat(e.target.value))}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TrafficTable;
