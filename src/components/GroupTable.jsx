import React from 'react';
import LocalInput from './LocalInput';
import NumericInput from './NumericInput';
import EmptyState from './EmptyState';
import './GroupTable.css';

const GroupTable = ({ groups, updateGroupParams, cycleLength, showGroupNames = true, onDetach, hoveredGroupId }) => {

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
        const updates = { type: value };
        if (value === 'P') {
            updates.courant = 'Piéton';
        } else if (value === 'CY') {
            updates.courant = 'Cycle';
        }
        updateGroupParams(id, updates);
    };

    const handleMinGreenChange = (id, value) => {
        updateGroupParams(id, { minGreen: parseInt(value) || 0 });
    };

    const handleYellowChange = (id, value) => {
        updateGroupParams(id, { durations: { orange: parseInt(value) || 0 } });
    };

    return (
        <div className="group-table-container">
            <h3 className="group-table-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                Formulaire
                {onDetach && (
                    <button
                        className="detach-btn"
                        onClick={onDetach}
                        title="Détacher dans une fenêtre séparée"
                    >
                        Détacher
                    </button>
                )}
            </h3>
            <div style={{ position: 'relative' }}>
            {groups.length > 0 && groups.every(g => !g.type || g.type === '') && (
                <div className="empty-state-overlay">
                    <EmptyState
                        icon="list"
                        title="Formulaire non renseigné"
                        hint="Saisissez les noms des groupes de feu ainsi que les types (Véhicules, Piéton, Cycliste, etc.) dans la colonne « Type »."
                    />
                </div>
            )}
            <table className="group-table">
                <thead>
                    <tr>
                        <th>Grp</th>
                        {showGroupNames && <th>Nom</th>}
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
                            <tr key={g.id} className={hoveredGroupId === g.id ? 'form-hovered-row' : ''}>
                                <td className="col-id">{g.id}</td>
                                {/* Name Input */}
                                {showGroupNames && (
                                    <td>
                                        <LocalInput
                                            className="input-name-cell"
                                            value={g.name}
                                            onCommit={(val) => updateGroupParams(g.id, { name: val })}
                                            selectOnFocus={/^Groupe \d+$/.test(g.name)}
                                        />
                                    </td>
                                )}
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
                                            g.courant === 'TD_TàD' ? 'Flèche tout droit - tourne à droite' :
                                            g.courant === 'TD_TàG' ? 'Flèche tout droit - tourne à gauche' :
                                            g.courant === 'TD_G_D' ? 'Flèche tout droit - tourne à gauche et à droite' :
                                            g.courant === 'Piéton' ? 'Flèche 2 sens' :
                                            g.courant === 'Cycle' ? 'Flèche 2 sens' : ''
                                        }
                                    >
                                        <option value=""></option>
                                        <option value="TD">TD</option>
                                        <option value="TàD">TàD</option>
                                        <option value="TàG">TàG</option>
                                        <option value="TD_TàD">TD_TàD</option>
                                        <option value="TD_TàG">TD_TàG</option>
                                        <option value="TD_G_D">TD_G_D</option>
                                        <option value="Piéton">Piéton</option>
                                        <option value="Cycle">Cycle</option>
                                    </select>
                                </td>
                                {/* Min Green */}
                                <td>
                                    <NumericInput
                                        className="input-mini"
                                        value={g.minGreen}
                                        onCommit={(val) => handleMinGreenChange(g.id, val)}
                                        selectOnFocus
                                        min={0}
                                        max={cycleLength}
                                        allowEmpty={false}
                                        title="Durée minimale du vert"
                                    />
                                </td>
                                {/* Yellow Duration */}
                                <td>
                                    <NumericInput
                                        className="input-yellow"
                                        value={g.durations.orange}
                                        onCommit={(val) => handleYellowChange(g.id, val)}
                                        selectOnFocus
                                        min={0}
                                        max={cycleLength}
                                        allowEmpty={false}
                                        title="Durée de l'orange / dégagement piéton"
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
        </div>
    );
};

export default GroupTable;
