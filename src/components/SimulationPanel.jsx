import { useMemo } from 'react';
import { calculateSimulatedDiagram } from '../utils/simulationCalculator';
import './SimulationPanel.css';

const SimulationPanel = ({
    actionData,
    selectedActions,
    onToggle,
    onSelectAll,
    onDeselectAll,
    groups,
    cycleLength,
    conflictMatrix,
    hoveredActionId,
    setHoveredActionId,
    activeTrafficDataset,
    getTrafficData
}) => {
    // Filter to only show actions that have a type selected
    // Exclude actions that don't affect simulation
    const excludedActions = [
        'Début de bande passante',
        'Fin de bande passante',
        'Priorité piétons',
        'Signa d\'aide à la conduite',
        'Synchro BTS',
        'Point de repos'
    ];
    const activeActions = actionData.filter(a =>
        a.action && a.action !== '' && !excludedActions.includes(a.action)
    );

    const selectedCount = activeActions.filter(a => selectedActions.includes(a.id)).length;

    // Calculate simulated diagram and conflicts
    const simulationResult = useMemo(() => {
        return calculateSimulatedDiagram(
            groups,
            actionData,
            selectedActions,
            cycleLength,
            conflictMatrix
        );
    }, [groups, actionData, selectedActions, cycleLength, conflictMatrix]);

    const { simulatedGroups, simulatedCycleLength, conflicts } = simulationResult;

    // Calculate V.Utile = trafic / (1800 * coef / cycle)
    const calculateVUtile = (trafficVol, laneCoef) => {
        if (!trafficVol || !laneCoef || !simulatedCycleLength || laneCoef === 0) return null;
        const result = trafficVol / (1800 * laneCoef / simulatedCycleLength);
        return Math.round(result);
    };

    // Calculate Cap.U = (V.Utile / green time) * 100 (percentage)
    const calculateCapacity = (greenTime, vUtile) => {
        if (!greenTime || !vUtile || greenTime === 0) return { value: null, display: '' };
        const result = Math.round((vUtile / greenTime) * 100);
        return { value: result, display: result + '%' };
    };

    // Get capacity color class based on value
    const getCapacityColorClass = (value) => {
        if (value === null) return '';
        if (value < 76) return 'capacity-green';
        if (value <= 85) return 'capacity-orange';
        if (value <= 100) return 'capacity-red';
        return 'capacity-black';
    };

    // Calculate Retard (avec condition "Début de bande passante")
    const calculateDelay = (greenTime, trafficVol, laneCoef, groupId, groupOffset) => {
        // Vérifier s'il existe une action "Début de bande passante" pour ce groupe
        const bandeAction = actionData.find(
            action => action.action === 'Début de bande passante' &&
                     parseInt(action.actGf1) === groupId &&
                     action.fin !== '' && action.fin !== null && action.fin !== undefined
        );

        if (bandeAction) {
            const finValue = parseFloat(bandeAction.fin);
            if (!isNaN(finValue) && groupOffset !== undefined && groupOffset !== null) {
                return Math.max(0, Math.round(groupOffset - finValue));
            }
        }

        // Formule standard
        if (!greenTime || !trafficVol || !laneCoef || !simulatedCycleLength || laneCoef === 0) return null;
        const saturationFlow = 1800 * laneCoef;
        const ratio = trafficVol / saturationFlow;
        if (ratio >= 1) return null;
        const denominator = 2 * simulatedCycleLength * (1 - ratio);
        if (denominator === 0) return null;
        const redTime = simulatedCycleLength - greenTime;
        const result = (redTime * redTime) / denominator;
        return Math.round(result);
    };

    // Calculate File d'attente (avec condition "Début de bande passante")
    const calculateQueue = (greenTime, trafficVol, laneCoef, groupId, groupOffset) => {
        // Vérifier s'il existe une action "Début de bande passante" pour ce groupe
        const bandeAction = actionData.find(
            action => action.action === 'Début de bande passante' &&
                     parseInt(action.actGf1) === groupId &&
                     action.fin !== '' && action.fin !== null && action.fin !== undefined
        );

        if (bandeAction) {
            const finValue = parseFloat(bandeAction.fin);
            if (!isNaN(finValue) && groupOffset !== undefined && groupOffset !== null) {
                return Math.max(0, Math.round(groupOffset - finValue));
            }
        }

        // Formule standard
        if (!greenTime || !trafficVol || !laneCoef || !simulatedCycleLength || laneCoef === 0) return null;
        const redTime = simulatedCycleLength - greenTime;
        const innerValue = trafficVol * redTime / 3600 / laneCoef;
        const result = (Math.floor(innerValue) + 1) * 6;
        return result;
    };

    // Filter only VL groups from simulated groups
    const vlSimulatedGroups = simulatedGroups.filter(g => g.type === 'VL' || g.type === 'V');

    return (
        <div className="simulation-panel">
            <div className="simulation-header">
                <h3>Simulation</h3>
                <span className="simulation-count">
                    {selectedCount}/{activeActions.length} actions
                </span>
            </div>

            <div className="simulation-controls">
                <button
                    className="sim-btn"
                    onClick={onSelectAll}
                    title="Cocher toutes les actions"
                >
                    Tout cocher
                </button>
                <button
                    className="sim-btn"
                    onClick={onDeselectAll}
                    title="Décocher toutes les actions"
                >
                    Tout décocher
                </button>
            </div>

            {/* Simulation info */}
            <div className="simulation-info">
                <div className="sim-info-item">
                    <span className="sim-info-label">Cycle simulé:</span>
                    <span className="sim-info-value">{simulatedCycleLength}s</span>
                    {simulatedCycleLength !== cycleLength && (
                        <span className="sim-info-delta">
                            ({simulatedCycleLength - cycleLength > 0 ? '+' : ''}{simulatedCycleLength - cycleLength}s)
                        </span>
                    )}
                </div>
            </div>

            {/* Actions list */}
            <div className="simulation-list-header">Actions</div>
            <div className="simulation-list">
                {activeActions.length === 0 ? (
                    <p className="no-actions">Aucune action définie dans le tableau des actions.</p>
                ) : (
                    activeActions.map(action => {
                        const isChecked = selectedActions.includes(action.id);
                        const isModifying = ['Escamotage de phase', 'Ouverture anticipée', 'Adaptatif vertical'].includes(action.action);
                        const isHovered = hoveredActionId === action.id;
                        return (
                            <label
                                key={action.id}
                                className={`simulation-item ${isChecked ? 'checked' : ''} ${isModifying ? 'modifying' : ''} ${isHovered ? 'hovered' : ''}`}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => onToggle(action.id)}
                                />
                                <span className="sim-row-num">{action.id}</span>
                                <span className="sim-action-type">{action.action}</span>
                                {action.gf && (
                                    <span className="sim-gf">GF{action.gf}</span>
                                )}
                                {action.deb !== '' && action.fin !== '' && (
                                    <span className="sim-time">{action.deb}-{action.fin}s</span>
                                )}
                                {action.description && (
                                    <span className="sim-desc" title={action.description}>
                                        {action.description.length > 15
                                            ? action.description.slice(0, 15) + '...'
                                            : action.description}
                                    </span>
                                )}
                            </label>
                        );
                    })
                )}
            </div>

            {/* Conflicts display - below actions */}
            {conflicts.length > 0 && (
                <div className="simulation-conflicts">
                    <div className="conflicts-header">
                        <span className="conflicts-icon">!</span>
                        <span className="conflicts-title">{conflicts.length} Conflit{conflicts.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="conflicts-list">
                        {conflicts.map((c, i) => (
                            <div key={i} className="conflict-item">
                                <span className="conflict-groups">GF{c.from} - GF{c.to}</span>
                                <span className="conflict-message">{c.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {conflicts.length === 0 && selectedCount > 0 && (
                <div className="simulation-valid">
                    <span className="valid-icon">OK</span>
                    <span>Aucun conflit</span>
                </div>
            )}

            {/* Traffic Data Table - using simulated green durations */}
            {vlSimulatedGroups.length > 0 && getTrafficData && (
                <div className="simulation-traffic">
                    <div className="simulation-traffic-header">
                        <span className="traffic-title">Données Trafic</span>
                        <span className="traffic-dataset">{activeTrafficDataset}</span>
                    </div>
                    <table className="simulation-traffic-table">
                        <thead>
                            <tr>
                                <th>Grp</th>
                                <th>Nom</th>
                                <th>Déb</th>
                                <th>Fin</th>
                                <th>V</th>
                                <th>V.U</th>
                                <th>Cap.U</th>
                                <th>Ret.</th>
                                <th>File</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vlSimulatedGroups.map(g => {
                                const trafficData = getTrafficData(g.id);
                                // Use simulated values for calculations
                                const greenStart = g.simulatedOffset !== undefined ? g.simulatedOffset : g.offset;
                                const greenDuration = g.simulatedGreen !== undefined ? g.simulatedGreen : g.durations?.green;
                                const greenEnd = (greenStart + greenDuration) % simulatedCycleLength;
                                const vUtile = calculateVUtile(trafficData?.trafficVol, g.laneCoef);
                                const capacity = calculateCapacity(greenDuration, vUtile);
                                const delay = calculateDelay(greenDuration, trafficData?.trafficVol, g.laneCoef, g.id, greenStart);
                                const queue = calculateQueue(greenDuration, trafficData?.trafficVol, g.laneCoef, g.id, greenStart);
                                return (
                                    <tr key={g.id}>
                                        <td className="col-id">{g.id}</td>
                                        <td className="col-name">{g.name}</td>
                                        <td className="col-start">{greenStart}''</td>
                                        <td className="col-end">{greenEnd}''</td>
                                        <td className="col-green">{greenDuration ? `${greenDuration}''` : '-'}</td>
                                        <td className="col-vutile">{vUtile ? `${vUtile}''` : '-'}</td>
                                        <td className={`col-capacity ${getCapacityColorClass(capacity.value)}`}>
                                            {capacity.display || '-'}
                                        </td>
                                        <td className="col-delay">{delay !== null ? `${delay}''` : '-'}</td>
                                        <td className="col-queue">{queue !== null ? `${queue}m` : '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SimulationPanel;
