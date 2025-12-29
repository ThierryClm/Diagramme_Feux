import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
    'Priorité piétons',
    'Seconde lucarne',
    'Signa d\'aide à la conduite',
    'Synchro BTS'
];

// Check if a row has any data
const isRowFilled = (row) => {
    return row.gf || row.action || row.description || row.deb !== '' || row.fin !== '' ||
        row.abrv || row.micro || row.plage1 || row.plage2 ||
        row.actGf1 || row.actGf1Gf2 || row.actGf1Gf3 || row.actGf1Gf4;
};

const ActionTable = ({ actionData, updateActionRow, cycleLength = 100, maxGroup = 16, hoveredActionId, setHoveredActionId }) => {
    // Sorting state: null = no sort, 'gf' | 'action' | 'deb'
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

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

    // Handle sort toggle
    const handleSort = useCallback((field) => {
        if (sortField === field) {
            // Toggle direction or reset
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else {
                setSortField(null);
                setSortDirection('asc');
            }
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    }, [sortField, sortDirection]);

    // Calculate visible rows: all filled + 1 empty, then apply sorting
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
        let rows = actionData.slice(0, Math.max(endIndex, 1));

        // Apply sorting if a sort field is selected
        if (sortField) {
            const filledRows = rows.filter(isRowFilled);
            const emptyRows = rows.filter(row => !isRowFilled(row));

            filledRows.sort((a, b) => {
                let valA, valB;

                if (sortField === 'gf') {
                    valA = parseInt(a.gf) || 999;
                    valB = parseInt(b.gf) || 999;
                } else if (sortField === 'action') {
                    valA = a.action || '';
                    valB = b.action || '';
                } else if (sortField === 'deb') {
                    valA = a.deb !== '' ? parseInt(a.deb) : 999;
                    valB = b.deb !== '' ? parseInt(b.deb) : 999;
                }

                if (sortField === 'action') {
                    // String comparison
                    const cmp = valA.localeCompare(valB, 'fr');
                    return sortDirection === 'asc' ? cmp : -cmp;
                } else {
                    // Numeric comparison
                    return sortDirection === 'asc' ? valA - valB : valB - valA;
                }
            });

            rows = [...filledRows, ...emptyRows];
        }

        return rows;
    }, [actionData, sortField, sortDirection]);

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
                                title="Groupe Fonctionnel - Cliquer pour trier"
                                className={`sortable ${sortField === 'gf' ? 'sorted' : ''}`}
                                onClick={() => handleSort('gf')}
                            >
                                GF {sortField === 'gf' && (sortDirection === 'asc' ? '▲' : '▼')}
                            </th>
                            <th
                                rowSpan="2"
                                title="Action - Cliquer pour trier"
                                className={`sortable ${sortField === 'action' ? 'sorted' : ''}`}
                                onClick={() => handleSort('action')}
                            >
                                Action {sortField === 'action' && (sortDirection === 'asc' ? '▲' : '▼')}
                            </th>
                            <th rowSpan="2" title="Description (30 car.)">Description</th>
                            <th
                                rowSpan="2"
                                title="Début - Cliquer pour trier"
                                className={`sortable ${sortField === 'deb' ? 'sorted' : ''}`}
                                onClick={() => handleSort('deb')}
                            >
                                Déb {sortField === 'deb' && (sortDirection === 'asc' ? '▲' : '▼')}
                            </th>
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
                                        className="input-small"
                                        value={row.plage1}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'plage1', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className="input-small"
                                        value={row.plage2}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'plage2', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className="input-small"
                                        value={row.actGf1}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'actGf1', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className="input-small"
                                        value={row.actGf1Gf2}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'actGf1Gf2', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className="input-small"
                                        value={row.actGf1Gf3}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'actGf1Gf3', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxGroup}
                                        className="input-small"
                                        value={row.actGf1Gf4}
                                        onChange={(e) => handleGroupFieldChange(row.id, 'actGf1Gf4', e.target.value)}
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
