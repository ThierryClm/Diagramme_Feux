import React from 'react';
import './GroupTable.css';

const GroupTable = ({ groups, updateGroupParams, cycleLength, moveGroup }) => {

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
                        <th>Ordre</th>
                        <th>Nom</th>
                        <th>Type</th>
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
                                <td>
                                    <button
                                        className="btn-move"
                                        onClick={() => moveGroup(index, 'up')}
                                        disabled={index === 0}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        className="btn-move"
                                        onClick={() => moveGroup(index, 'down')}
                                        disabled={index === groups.length - 1}
                                    >
                                        ▼
                                    </button>
                                </td>
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
                                        <option value="VL">VL</option>
                                        <option value="TC">TC</option>
                                        <option value="Cycliste">Vélo</option>
                                        <option value="Piéton">Piéton</option>
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
