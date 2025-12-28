import React, { useMemo, useState, useCallback, useEffect } from 'react';
import './ActionTable.css';

const ACTION_OPTIONS = [
    '',
    'Adaptatif vertical',
    'Escamotage',
    'Escamotage de phase',
    'Ouverture anticipée',
    'Fermeture anticipée',
    'Signa d\'aide à la conduite',
    'Seconde lucarne',
    'Début de bande passante',
    'Fin de bande passante'
];

// Check if a row has any data
const isRowFilled = (row) => {
    return row.gf || row.action || row.description || row.deb !== '' || row.fin !== '' ||
        row.abrv || row.micro || row.plage1 || row.plage2 ||
        row.actGf1 || row.actGf1Gf2 || row.actGf1Gf3 || row.actGf1Gf4;
};

const ActionTable = ({ actionData, updateActionRow, cycleLength = 100, startDrag, endDrag }) => {
    // Drag state for Déb/Fin fields
    const [dragState, setDragState] = useState(null);
    // dragState = { rowId, field: 'deb' | 'fin', initialMouseX, initialValue }

    // Drag handlers
    const handleDragStart = useCallback((e, rowId, field, currentValue) => {
        e.preventDefault();
        if (startDrag) startDrag(); // Save history once at drag start
        setDragState({
            rowId,
            field,
            initialMouseX: e.clientX,
            initialValue: parseInt(currentValue) || 0
        });
    }, [startDrag]);

    const handleDragMove = useCallback((e) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.initialMouseX;
        // 3 pixels = 1 second for finer control
        const deltaSeconds = Math.round(deltaX / 3);
        let newValue = dragState.initialValue + deltaSeconds;

        // Wrap around cycle length
        newValue = ((newValue % cycleLength) + cycleLength) % cycleLength;

        updateActionRow(dragState.rowId, dragState.field, newValue.toString());
    }, [dragState, cycleLength, updateActionRow]);

    const handleDragEnd = useCallback(() => {
        if (endDrag) endDrag(); // End drag mode
        setDragState(null);
    }, [endDrag]);

    // Global mouse event listeners for drag
    useEffect(() => {
        if (dragState) {
            const handleMouseMove = (e) => handleDragMove(e);
            const handleMouseUp = () => handleDragEnd();

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragState, handleDragMove, handleDragEnd]);

    // Calculate visible rows: all filled + 1 empty
    const visibleRows = useMemo(() => {
        let lastFilledIndex = -1;
        for (let i = actionData.length - 1; i >= 0; i--) {
            if (isRowFilled(actionData[i])) {
                lastFilledIndex = i;
                break;
            }
        }
        // Show all filled rows + 1 empty (up to max 30)
        const endIndex = Math.min(lastFilledIndex + 2, actionData.length);
        return actionData.slice(0, Math.max(endIndex, 1));
    }, [actionData]);

    return (
        <div className={`action-table-container ${dragState ? 'dragging' : ''}`}>
            <h3>Tableau des Actions</h3>
            <div className="action-table-scroll">
                <table className="action-table">
                    <thead>
                        <tr className="header-group">
                            <th rowSpan="2" title="Groupe Fonctionnel">GF</th>
                            <th rowSpan="2" title="Action (20 car.)">Action</th>
                            <th rowSpan="2" title="Description (30 car.)">Description</th>
                            <th rowSpan="2">Déb</th>
                            <th rowSpan="2">Fin</th>
                            <th rowSpan="2">Abrv</th>
                            <th rowSpan="2" title="Action Micro (40 car.)">Action_Micro</th>
                            <th colSpan="2" className="header-grouped">Plage</th>
                            <th colSpan="4" className="header-grouped">Action GF</th>
                        </tr>
                        <tr className="header-sub">
                            <th>1</th>
                            <th>2</th>
                            <th>1</th>
                            <th>2</th>
                            <th>3</th>
                            <th>4</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRows.map((row) => (
                            <tr key={row.id}>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="2"
                                        className="input-gf"
                                        value={row.gf}
                                        onChange={(e) => updateActionRow(row.id, 'gf', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <select
                                        className="input-action"
                                        value={row.action}
                                        onChange={(e) => updateActionRow(row.id, 'action', e.target.value)}
                                    >
                                        {ACTION_OPTIONS.map((opt) => (
                                            <option key={opt} value={opt}>{opt || '—'}</option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="30"
                                        className="input-desc"
                                        value={row.description}
                                        onChange={(e) => updateActionRow(row.id, 'description', e.target.value)}
                                    />
                                </td>
                                <td className="draggable-cell">
                                    <div
                                        className="drag-handle-time"
                                        onMouseDown={(e) => handleDragStart(e, row.id, 'deb', row.deb)}
                                        title="Glisser pour modifier"
                                    />
                                    <input
                                        type="number"
                                        className="input-time-xs"
                                        value={row.deb}
                                        onChange={(e) => updateActionRow(row.id, 'deb', e.target.value)}
                                    />
                                </td>
                                <td className="draggable-cell">
                                    <div
                                        className="drag-handle-time"
                                        onMouseDown={(e) => handleDragStart(e, row.id, 'fin', row.fin)}
                                        title="Glisser pour modifier"
                                    />
                                    <input
                                        type="number"
                                        className="input-time-xs"
                                        value={row.fin}
                                        onChange={(e) => updateActionRow(row.id, 'fin', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="10"
                                        className="input-abrv"
                                        value={row.abrv || ''}
                                        onChange={(e) => updateActionRow(row.id, 'abrv', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <textarea
                                        className="input-micro"
                                        value={row.micro || ''}
                                        onChange={(e) => updateActionRow(row.id, 'micro', e.target.value)}
                                        rows={1}
                                        onInput={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="2"
                                        className="input-small"
                                        value={row.plage1}
                                        onChange={(e) => updateActionRow(row.id, 'plage1', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="2"
                                        className="input-small"
                                        value={row.plage2}
                                        onChange={(e) => updateActionRow(row.id, 'plage2', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="2"
                                        className="input-small"
                                        value={row.actGf1}
                                        onChange={(e) => updateActionRow(row.id, 'actGf1', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="2"
                                        className="input-small"
                                        value={row.actGf1Gf2}
                                        onChange={(e) => updateActionRow(row.id, 'actGf1Gf2', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="2"
                                        className="input-small"
                                        value={row.actGf1Gf3}
                                        onChange={(e) => updateActionRow(row.id, 'actGf1Gf3', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        maxLength="2"
                                        className="input-small"
                                        value={row.actGf1Gf4}
                                        onChange={(e) => updateActionRow(row.id, 'actGf1Gf4', e.target.value)}
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
