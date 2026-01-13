import React from 'react';
import './GroupTable.css';

const GroupTable = ({ groups, updateGroupParams, cycleLength }) => {

    const handleStartChange = (id, value) => {
        updateGroupParams(id, { offset: parseInt(value) || 0 });
    };

    const handleDurationChange = (id, value) => {
        updateGroupParams(id, { durations: { green: parseInt(value) || 0 } });
    };

    const handleEndChange = (id, endValue, startValue) => {
        let duration = (parseInt(endValue) || 0) - startValue;
        if (duration < 0) duration += cycleLength;
        updateGroupParams(id, { durations: { green: Math.max(0, duration) } });
    };

    const handleTypeChange = (id, value) => {
        updateGroupParams(id, { type: value });
    };

    const handleMinGreenChange = (id, value) => {
        updateGroupParams(id, { minGreen: parseInt(value) || 0 });
    };

    const handleYellowChange = (id, value) => {
        updateGroupParams(id, { durations: { orange: parseInt(value) || 0 } });
    };

    return (
        <div className="group-table-container">
            <h3 className="group-table-title">Formulaire</h3>
            <table className="group-table">
                <thead>
                    <tr>
                        <th>Grp</th>
                        <th>Nom</th>
                        <th>Type</th>
                        <th>Courant</th>
                        <th>Mini</th>
                        <th>Jaune</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map((g, index) => {
                        const start = g.offset % cycleLength;
                        const duration = g.durations.green;
                        const end = (start + duration) % cycleLength;

                        return (
                            <tr key={g.id}>
                                <td className="col-id">{g.id}</td>
                                {/* Name Input */}
                                <td>
                                    <input
                                        type="text"
                                        className="input-name-cell"
                                        value={g.name}
                                        onChange={(e) => updateGroupParams(g.id, { name: e.target.value })}
                                    />
                                </td>
                                {/* Type Selection */}
                                <td>
                                    <select
                                        value={g.type}
                                        onChange={(e) => handleTypeChange(g.id, e.target.value)}
                                        className="input-type"
                                    >
                                        <option value=""></option>
                                        <option value="V">V</option>
                                        <option value="B">B</option>
                                        <option value="P">P</option>
                                        <option value="CY">CY</option>
                                        <option value="FL">FL</option>
                                        <option value="PP">PP</option>
                                    </select>
                                </td>
                                {/* Courant */}
                                <td>
                                    <select
                                        className="input-courant"
                                        value={g.courant || ''}
                                        onChange={(e) => updateGroupParams(g.id, { courant: e.target.value })}
                                        title={
                                            g.courant === 'TD' ? 'Flèche tout droit' :
                                            g.courant === 'TàD' ? 'Flèche tourne à droite' :
                                            g.courant === 'TàG' ? 'Flèche tourne à gauche' :
                                            g.courant === 'TD-TàD' ? 'Flèche tout droit - tourne à droite' :
                                            g.courant === 'TD-TàG' ? 'Flèche tout droit - tourne à gauche' :
                                            g.courant === 'TD_G_D' ? 'Flèche tout droit - tourne à gauche et à droite' :
                                            g.courant === 'Piéton' ? 'Flèche 2 sens' :
                                            g.courant === 'Cycle' ? 'Flèche 2 sens' : ''
                                        }
                                    >
                                        <option value=""></option>
                                        <option value="TD">TD</option>
                                        <option value="TàD">TàD</option>
                                        <option value="TàG">TàG</option>
                                        <option value="TD-TàD">TD-TàD</option>
                                        <option value="TD-TàG">TD-TàG</option>
                                        <option value="TD_G_D">TD_G_D</option>
                                        <option value="Piéton">Piéton</option>
                                        <option value="Cycle">Cycle</option>
                                    </select>
                                </td>
                                {/* Min Green */}
                                <td>
                                    <input
                                        type="number"
                                        className="input-mini"
                                        value={g.minGreen}
                                        onChange={(e) => handleMinGreenChange(g.id, e.target.value)}
                                    />
                                </td>
                                {/* Yellow Duration */}
                                <td>
                                    <input
                                        type="number"
                                        className="input-yellow"
                                        value={g.durations.orange}
                                        onChange={(e) => handleYellowChange(g.id, e.target.value)}
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

export default GroupTable;
