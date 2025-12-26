import React from 'react';
import './GroupTable.css'; // Reuse table styles

const TrafficTable = ({ groups, updateGroupParams }) => {

    const handleChange = (id, field, value) => {
        // Allow float for some, int for others? Let's use generic logic for now.
        updateGroupParams(id, { [field]: value });
    };

    return (
        <div className="group-table-container">
            <h3>Données Trafic</h3>
            <table className="group-table">
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
                            {/* Vert Utile */}
                            <td>
                                <input
                                    type="number"
                                    className="input-trafic-num"
                                    value={g.effectiveGreen}
                                    onChange={(e) => handleChange(g.id, 'effectiveGreen', parseInt(e.target.value))}
                                />
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
