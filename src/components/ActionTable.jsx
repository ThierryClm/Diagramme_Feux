import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import './ActionTable.css';

// Auto-resize textarea helper
const autoResizeTextarea = (textarea) => {
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
};

const ACTION_OPTIONS = [
    '',
    'Adaptatif vertical',
    'Début de bande passante',
    'Escamotage',
    'Escamotage de phase',
    'Fermeture anticipée',
    'Fin de bande passante',
    'Instant de coordination',
    'Ouverture anticipée',
    'Point de repos',
    'Priorité piétons',
    'Seconde lucarne',
    'Signa d\'aide à la conduite',
    'Synchro BTS'
];

// Actions where all Action GF fields (1, 2, 3, 4) should be disabled
const GF_DISABLED_ACTIONS = [
    'Adaptatif vertical',
    'Escamotage de phase',
    'Ouverture anticipée',
    'Point de repos',
    'Priorité piétons',
    'Seconde lucarne',
    'Signa d\'aide à la conduite',
    'Synchro BTS'
];

// Actions where only Action GF 2, 3, 4 should be disabled (GF 1 remains enabled)
const GF234_DISABLED_ACTIONS = [
    'Début de bande passante',
    'Fin de bande passante'
];

// Actions where Plage 1 and Plage 2 fields should be disabled
const PLAGE_DISABLED_ACTIONS = [
    'Début de bande passante',
    'Escamotage',
    'Escamotage de phase',
    'Fermeture anticipée',
    'Fin de bande passante',
    'Ouverture anticipée',
    'Priorité piétons',
    'Seconde lucarne',
    'Signa d\'aide à la conduite'
];

// Check if a row has any data
const isRowFilled = (row) => {
    return row.gf || row.action || row.description || row.deb !== '' || row.fin !== '' ||
        row.abrv || row.micro || row.plage1 || row.plage2 ||
        row.actGf1 || row.actGf1Gf2 || row.actGf1Gf3 || row.actGf1Gf4;
};

const ActionTable = ({ actionData, updateActionRow, reorderActions, cycleLength = 100, maxGroup = 16, hoveredActionId, setHoveredActionId }) => {
    // Refs for textarea auto-resize
    const textareaRefs = useRef({});

    // Validate group field value (1 to maxGroup, or empty)
    const handleGroupFieldChange = useCallback((rowId, field, value) => {
        // Allow empty value
        if (value === '') {
            updateActionRow(rowId, field, '');
            return;
        }
        // Parse as number and validate
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue >= 1 && numValue <= maxGroup) {
            updateActionRow(rowId, field, value);
        }
        // Reject invalid values silently
    }, [updateActionRow, maxGroup]);

    // Handle action change - clear disabled fields when action changes
    const handleActionChange = useCallback((rowId, newAction) => {
        updateActionRow(rowId, 'action', newAction);

        // Clear plage fields if they become disabled
        if (PLAGE_DISABLED_ACTIONS.includes(newAction)) {
            updateActionRow(rowId, 'plage1', '');
            updateActionRow(rowId, 'plage2', '');
        }

        // Clear all Action GF fields if they become disabled
        if (GF_DISABLED_ACTIONS.includes(newAction)) {
            updateActionRow(rowId, 'actGf1', '');
            updateActionRow(rowId, 'actGf1Gf2', '');
            updateActionRow(rowId, 'actGf1Gf3', '');
            updateActionRow(rowId, 'actGf1Gf4', '');
        }
        // Clear only Action GF 2, 3, 4 if they become disabled
        else if (GF234_DISABLED_ACTIONS.includes(newAction)) {
            updateActionRow(rowId, 'actGf1Gf2', '');
            updateActionRow(rowId, 'actGf1Gf3', '');
            updateActionRow(rowId, 'actGf1Gf4', '');
        }
    }, [updateActionRow]);

    // Handle sort - actually reorder the data permanently
    const handleSort = useCallback((field, direction = 'asc') => {
        if (!reorderActions) return;

        // Sort all data (filled rows first, then empty)
        const filledRows = actionData.filter(isRowFilled);
        const emptyRows = actionData.filter(row => !isRowFilled(row));

        filledRows.sort((a, b) => {
            let valA, valB;

            if (field === 'gf') {
                valA = parseInt(a.gf) || 0;
                valB = parseInt(b.gf) || 0;
            } else if (field === 'action') {
                valA = a.action || '';
                valB = b.action || '';
            } else if (field === 'deb') {
                valA = a.deb !== '' ? parseInt(a.deb) : 999;
                valB = b.deb !== '' ? parseInt(b.deb) : 999;
            }

            if (field === 'action') {
                // String comparison
                const cmp = valA.localeCompare(valB, 'fr');
                return direction === 'asc' ? cmp : -cmp;
            } else {
                // Numeric comparison
                return direction === 'asc' ? valA - valB : valB - valA;
            }
        });

        // Apply the new order permanently
        reorderActions([...filledRows, ...emptyRows]);
    }, [actionData, reorderActions]);

    // Calculate visible rows: all filled + 1 empty at the end
    const visibleRows = useMemo(() => {
        const filledRows = actionData.filter(isRowFilled);
        const emptyRows = actionData.filter(row => !isRowFilled(row));
        // Show all filled rows + only 1 empty row at the end
        const oneEmpty = emptyRows.length > 0 ? [emptyRows[0]] : [];
        return [...filledRows, ...oneEmpty];
    }, [actionData]);

    // Auto-resize all textareas when data changes
    useEffect(() => {
        Object.values(textareaRefs.current).forEach(autoResizeTextarea);
    }, [actionData]);

    return (
        <div className="action-table-container">
            <h3>Tableau des Actions</h3>
            <div className="action-table-scroll">
                <table className="action-table">
                    <thead>
                        <tr className="header-group">
                            <th
                                rowSpan="2"
                                title="Groupe Fonctionnel - Cliquer pour trier (croissant)"
                                className="sortable"
                                onClick={() => handleSort('gf', 'asc')}
                            >
                                GF ↕
                            </th>
                            <th
                                rowSpan="2"
                                title="Action - Cliquer pour trier (alphabétique)"
                                className="sortable"
                                onClick={() => handleSort('action', 'asc')}
                            >
                                Action ↕
                            </th>
                            <th rowSpan="2" title="Description (30 car.)">Description</th>
                            <th
                                rowSpan="2"
                                title="Début - Cliquer pour trier (croissant)"
                                className="sortable"
                                onClick={() => handleSort('deb', 'asc')}
                            >
                                Déb ↕
                            </th>
                            <th rowSpan="2">Fin</th>
                            <th rowSpan="2">Abrv</th>
                            <th rowSpan="2" title="Action Micro (60 car.)">Action_Micro</th>
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
                            <tr
                                key={row.id}
                                className={hoveredActionId === row.id ? 'row-highlighted' : ''}
                                onMouseEnter={() => isRowFilled(row) && setHoveredActionId(row.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                            >
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className="input-gf"
                                        value={row.gf}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'gf', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <select
                                        className="input-action"
                                        value={row.action}
                                        onChange={(e) => handleActionChange(row.id, e.target.value)}
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
                                <td>
                                    <input
                                        type="number"
                                        className="input-time-xs"
                                        value={row.deb}
                                        onChange={(e) => updateActionRow(row.id, 'deb', e.target.value)}
                                    />
                                </td>
                                <td>
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
                                        ref={(el) => {
                                            textareaRefs.current[row.id] = el;
                                            autoResizeTextarea(el);
                                        }}
                                        className="input-micro"
                                        value={row.micro || ''}
                                        onChange={(e) => {
                                            updateActionRow(row.id, 'micro', e.target.value);
                                            autoResizeTextarea(e.target);
                                        }}
                                        rows={1}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className={`input-small ${PLAGE_DISABLED_ACTIONS.includes(row.action) ? 'input-disabled' : ''}`}
                                        value={row.plage1}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'plage1', e.target.value)}
                                        disabled={PLAGE_DISABLED_ACTIONS.includes(row.action)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className={`input-small ${PLAGE_DISABLED_ACTIONS.includes(row.action) ? 'input-disabled' : ''}`}
                                        value={row.plage2}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'plage2', e.target.value)}
                                        disabled={PLAGE_DISABLED_ACTIONS.includes(row.action)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className={`input-small ${GF_DISABLED_ACTIONS.includes(row.action) ? 'input-disabled' : ''}`}
                                        value={row.actGf1}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'actGf1', e.target.value)}
                                        disabled={GF_DISABLED_ACTIONS.includes(row.action)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className={`input-small ${(GF_DISABLED_ACTIONS.includes(row.action) || GF234_DISABLED_ACTIONS.includes(row.action)) ? 'input-disabled' : ''}`}
                                        value={row.actGf1Gf2}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'actGf1Gf2', e.target.value)}
                                        disabled={GF_DISABLED_ACTIONS.includes(row.action) || GF234_DISABLED_ACTIONS.includes(row.action)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className={`input-small ${(GF_DISABLED_ACTIONS.includes(row.action) || GF234_DISABLED_ACTIONS.includes(row.action)) ? 'input-disabled' : ''}`}
                                        value={row.actGf1Gf3}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'actGf1Gf3', e.target.value)}
                                        disabled={GF_DISABLED_ACTIONS.includes(row.action) || GF234_DISABLED_ACTIONS.includes(row.action)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className={`input-small ${(GF_DISABLED_ACTIONS.includes(row.action) || GF234_DISABLED_ACTIONS.includes(row.action)) ? 'input-disabled' : ''}`}
                                        value={row.actGf1Gf4}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'actGf1Gf4', e.target.value)}
                                        disabled={GF_DISABLED_ACTIONS.includes(row.action) || GF234_DISABLED_ACTIONS.includes(row.action)}
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
