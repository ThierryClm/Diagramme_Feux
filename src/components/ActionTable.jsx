import React from 'react';
import './ActionTable.css';

const ActionTable = ({ actionData, updateActionRow }) => {
    return (
        <div className="action-table-container">
            <h3>Tableau des Actions</h3>
            <div className="action-table-scroll">
                <table className="action-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th title="Groupe Fonctionnel">GF</th>
                            <th title="Action (20 car.)">Action</th>
                            <th title="Description (30 car.)">Description</th>
                            <th>Déb</th>
                            <th>Fin</th>
                            <th title="Action Micro (40 car.)">Action_Micro</th>
                            <th>Plage1</th>
                            <th>Plage2</th>
                            <th>Act GF1</th>
                            <th>Act GF1GF2</th>
                            <th>Act GF1GF3</th>
                            <th>Act GF1GF4</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actionData.map((row, index) => (
                            <tr key={row.id}>
                                <td className="idx-col">{row.id}</td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="5"
                                        className="input-gf"
                                        value={row.gf}
                                        onChange={(e) => updateActionRow(index, 'gf', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="20"
                                        className="input-action"
                                        value={row.action}
                                        onChange={(e) => updateActionRow(index, 'action', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="30"
                                        className="input-desc"
                                        value={row.description}
                                        onChange={(e) => updateActionRow(index, 'description', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        className="input-time-xs"
                                        value={row.deb}
                                        onChange={(e) => updateActionRow(index, 'deb', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        className="input-time-xs"
                                        value={row.fin}
                                        onChange={(e) => updateActionRow(index, 'fin', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="40"
                                        className="input-micro"
                                        value={row.micro}
                                        onChange={(e) => updateActionRow(index, 'micro', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="input-small"
                                        value={row.plage1}
                                        onChange={(e) => updateActionRow(index, 'plage1', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="input-small"
                                        value={row.plage2}
                                        onChange={(e) => updateActionRow(index, 'plage2', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="input-small"
                                        value={row.actGf1}
                                        onChange={(e) => updateActionRow(index, 'actGf1', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="input-small"
                                        value={row.actGf1Gf2}
                                        onChange={(e) => updateActionRow(index, 'actGf1Gf2', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="input-small"
                                        value={row.actGf1Gf3}
                                        onChange={(e) => updateActionRow(index, 'actGf1Gf3', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="input-small"
                                        value={row.actGf1Gf4}
                                        onChange={(e) => updateActionRow(index, 'actGf1Gf4', e.target.value)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ActionTable;
