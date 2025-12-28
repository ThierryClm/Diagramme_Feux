import React, { useRef } from 'react';
import './TimelineDiagram.css';

const TimelineDiagram = ({ groups, globalTime, onGroupClick, pixelsPerSecond = 3, conflicts, updateGroupParams, cycleLength, actionData = [] }) => {
    const containerRef = useRef(null);
    const TIME_WINDOW = cycleLength || 100; // Use cycle length as time window

    // Determine total width in pixels
    const totalWidth = TIME_WINDOW * pixelsPerSecond;

    // Handlers (Duplicated from GroupTable logic, could be extracted to hook)
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

    // Helper to get actions for a specific group
    const getActionsForGroup = (groupId) => {
        return actionData.filter(action => {
            const gf = action.gf?.toString().replace(/[Gg]/g, '').trim();
            return gf === groupId.toString() && action.deb !== '' && action.fin !== '';
        });
    };

    // Get all "Adaptatif vertical" actions
    const adaptatifActions = actionData.filter(action =>
        action.action === 'Adaptatif vertical' && action.deb !== '' && action.fin !== ''
    );

    // Get all "Fermeture anticipée" actions with arrows
    const fermetureActions = actionData.filter(action =>
        action.action === 'Fermeture anticipée' && action.deb !== '' && action.fin !== '' &&
        (action.actGf1 || action.actGf1Gf2)
    );

    // Get all "Escamotage de phase" actions
    const escamotageActions = actionData.filter(action =>
        action.action === 'Escamotage de phase' && action.deb !== '' && action.fin !== ''
    );

    // Get all "Signa d'aide à la conduite" actions
    const signaActions = actionData.filter(action =>
        action.action === 'Signa d\'aide à la conduite' && action.deb !== '' && action.fin !== ''
    );

    const ROW_HEIGHT = 30; // Height of each row in pixels
    const RULER_HEIGHT = 50; // Height of the ruler

    // Helper to get group start position (beginning of green bar on screen)
    const getGroupStartPos = (groupId) => {
        const group = groups.find(g => g.id === parseInt(groupId));
        if (!group) return null;
        // The sidebar shows start = offset, so the green begins at position offset
        return group.offset % cycleLength;
    };

    return (
        <div className="timeline-container" ref={containerRef}>
            <div className="timeline-layout">
                <div className="timeline-sidebar">
                    {/* Header Label for Sidebar */}
                    <div className="sidebar-header-row">
                        <span className="col-label">Grp</span>
                        <span className="col-label">Début</span>
                        <span className="col-label">Fin</span>
                        <span className="col-label">Durée</span>
                    </div>

                    {groups.map(g => {
                        const start = g.offset % cycleLength;
                        const duration = g.durations.green;
                        const end = (start + duration) % cycleLength;

                        return (
                            <div key={g.id} className="row-label-container" onClick={() => onGroupClick(g)}>
                                <span className="label-id">G{g.id}</span>
                                <input
                                    type="number"
                                    className="input-time"
                                    value={start}
                                    onChange={(e) => handleStartChange(g.id, e.target.value)}
                                    title="Début"
                                />
                                <input
                                    type="number"
                                    className="input-time"
                                    value={end}
                                    onChange={(e) => handleEndChange(g.id, e.target.value, start)}
                                    title="Fin"
                                />
                                <input
                                    type="number"
                                    className="input-time input-duration"
                                    value={duration}
                                    onChange={(e) => handleDurationChange(g.id, e.target.value)}
                                    title="Durée"
                                    style={{ color: duration < g.minGreen ? '#ff4d4d' : 'inherit' }}
                                />
                            </div>
                        );
                    })}
                </div>

                <div className="timeline-scroll-area">
                    <div className="timeline-track-container" style={{ width: `${totalWidth}px` }}>
                        {/* Grid lines */}
                        <div className="timeline-grid">
                            {Array.from({ length: TIME_WINDOW + 1 }).map((_, i) => {
                                let gridClass = 'grid-line grid-1s';
                                if (i % 10 === 0) gridClass = 'grid-line grid-10s';
                                else if (i % 5 === 0) gridClass = 'grid-line grid-5s';
                                return (
                                    <div
                                        key={i}
                                        className={gridClass}
                                        style={{ left: `${i * pixelsPerSecond}px` }}
                                    />
                                );
                            })}
                        </div>

                        {/* Ruler */}
                        <div className="timeline-ruler">
                            {Array.from({ length: TIME_WINDOW / 5 + 1 }).map((_, i) => (
                                <div key={i} className="ruler-tick" style={{ left: `${i * 5 * pixelsPerSecond}px` }}>
                                    {i * 5}
                                </div>
                            ))}
                            {/* Playhead */}
                            <div
                                className="playhead"
                                style={{
                                    left: `${(globalTime % TIME_WINDOW) * pixelsPerSecond}px`
                                }}
                            ></div>
                        </div>

                        {/* Rows */}
                        {groups.map((group) => {
                            const groupActions = getActionsForGroup(group.id);
                            const isConflict = conflicts && conflicts.some(c => c.from === group.id || c.to === group.id);
                            const orangeDuration = group.durations.orange || 3;

                            // Calculate base bars from group offset/duration
                            const totalDuration = group.durations.green + group.durations.orange + group.durations.red;
                            const cyclesToRender = Math.ceil(TIME_WINDOW / totalDuration) + 1;

                            return (
                                <div
                                    key={group.id}
                                    className={`timeline-row-track ${isConflict ? 'row-conflict' : ''}`}
                                    onClick={() => onGroupClick(group)}
                                    style={{ backgroundColor: isConflict ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}
                                >
                                    {/* Base bars from group Début/Fin (sidebar values) */}
                                    {Array.from({ length: cyclesToRender }).map((_, i) => {
                                        const offset = group.offset % cycleLength;
                                        const cycleStart = (i * cycleLength) + offset;
                                        const greenWidth = group.durations.green * pixelsPerSecond;
                                        const orangeWidth = group.durations.orange * pixelsPerSecond;
                                        const leftPos = cycleStart * pixelsPerSecond;
                                        const isPedestrian = group.type === 'Piéton';

                                        return (
                                            <div
                                                key={`base-${i}`}
                                                className="cycle-block"
                                                style={{ left: `${leftPos}px` }}
                                            >
                                                <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                                                <div className={`phase-bar ${isPedestrian ? 'pedestrian-orange' : 'orange'}`} style={{ width: `${orangeWidth}px` }}></div>
                                            </div>
                                        );
                                    })}

                                    {/* Action-based overlays */}
                                    {groupActions.map((action, idx) => {
                                        const deb = parseInt(action.deb) || 0;
                                        const fin = parseInt(action.fin) || 0;
                                        const duration = fin >= deb ? fin - deb : (cycleLength - deb + fin);
                                        const leftPos = deb * pixelsPerSecond;
                                        const greenWidth = duration * pixelsPerSecond;
                                        const orangeWidth = orangeDuration * pixelsPerSecond;
                                        const abrv = action.abrv || '';

                                        return (
                                            <React.Fragment key={`action-${idx}`}>
                                                {/* Abrv label on the bar */}
                                                {abrv && (
                                                    <div
                                                        className="bar-label"
                                                        style={{
                                                            left: `${leftPos + 2}px`,
                                                            width: `${greenWidth - 4}px`
                                                        }}
                                                    >
                                                        {abrv}
                                                    </div>
                                                )}

                                                {/* Seconde lucarne: additional bar with darker green */}
                                                {action.action === 'Seconde lucarne' && (
                                                    <div
                                                        className="cycle-block lucarne"
                                                        style={{ left: `${leftPos}px` }}
                                                    >
                                                        <div className="phase-bar green-dark" style={{ width: `${greenWidth}px` }}></div>
                                                        <div className="phase-bar orange" style={{ width: `${orangeWidth}px` }}></div>
                                                    </div>
                                                )}

                                                {/* Fermeture anticipée: brace */}
                                                {action.action === 'Fermeture anticipée' && (
                                                    <div
                                                        className="brace-marker"
                                                        style={{
                                                            left: `${leftPos}px`,
                                                            width: `${greenWidth}px`
                                                        }}
                                                    >
                                                        <span className="brace-text">⏎</span>
                                                    </div>
                                                )}

                                                {/* Ouverture anticipée: hatched green rectangle */}
                                                {action.action === 'Ouverture anticipée' && (
                                                    <div
                                                        className="ouverture-anticipee"
                                                        style={{
                                                            left: `${leftPos}px`,
                                                            width: `${greenWidth}px`
                                                        }}
                                                    />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Adaptatif vertical overlays */}
                        {adaptatifActions.map((action, idx) => {
                            const deb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;
                            const duration = fin >= deb ? fin - deb : (cycleLength - deb + fin);
                            const leftPos = deb * pixelsPerSecond;
                            const width = duration * pixelsPerSecond;
                            const abrv = action.abrv || '';

                            // Calculate vertical position based on Plage1/Plage2
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;

                            let topPos, height;
                            if (plage1 > 0 && plage2 > 0) {
                                // Plage values are group numbers (1-indexed)
                                const startGroup = Math.min(plage1, plage2) - 1;
                                const endGroup = Math.max(plage1, plage2) - 1;
                                topPos = RULER_HEIGHT + (startGroup * ROW_HEIGHT);
                                height = (endGroup - startGroup + 1) * ROW_HEIGHT;
                            } else {
                                // No plage values - full height
                                topPos = RULER_HEIGHT;
                                height = groups.length * ROW_HEIGHT;
                            }

                            return (
                                <div
                                    key={`adaptatif-${idx}`}
                                    className="adaptatif-overlay"
                                    style={{
                                        left: `${leftPos}px`,
                                        width: `${width}px`,
                                        top: `${topPos}px`,
                                        height: `${height}px`
                                    }}
                                >
                                    {abrv && (
                                        <span className="adaptatif-label">{abrv}</span>
                                    )}
                                </div>
                            );
                        })}

                        {/* Fermeture anticipée arrows */}
                        {fermetureActions.map((action, idx) => {
                            const sourceGf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const fin = parseInt(action.fin) || 0;

                            // Get target groups from ActGF1 or ActGF1GF2
                            const targets = [];
                            if (action.actGf1) {
                                const targetId = parseInt(action.actGf1.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }
                            if (action.actGf1Gf2) {
                                const targetId = parseInt(action.actGf1Gf2.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }

                            return targets.map((targetGf, tIdx) => {
                                const targetStartPos = getGroupStartPos(targetGf);
                                if (targetStartPos === null) return null;

                                // Calculate positions
                                const sourceY = RULER_HEIGHT + ((sourceGf - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                                const targetY = RULER_HEIGHT + ((targetGf - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                                const sourceX = fin * pixelsPerSecond;
                                const targetX = targetStartPos * pixelsPerSecond;

                                return (
                                    <svg
                                        key={`arrow-${idx}-${tIdx}`}
                                        className="fermeture-arrow"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            zIndex: 15
                                        }}
                                    >
                                        <defs>
                                            <marker
                                                id={`arrowhead-${idx}-${tIdx}`}
                                                markerWidth="8"
                                                markerHeight="6"
                                                refX="8"
                                                refY="3"
                                                orient="auto"
                                            >
                                                <polygon
                                                    points="0 0, 8 3, 0 6"
                                                    fill="#ff4444"
                                                />
                                            </marker>
                                        </defs>
                                        <line
                                            x1={sourceX}
                                            y1={sourceY}
                                            x2={targetX}
                                            y2={targetY}
                                            stroke="#ff4444"
                                            strokeWidth="2"
                                            markerEnd={`url(#arrowhead-${idx}-${tIdx})`}
                                        />
                                    </svg>
                                );
                            });
                        })}

                        {/* Escamotage de phase overlays */}
                        {escamotageActions.map((action, idx) => {
                            const deb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;
                            const duration = fin >= deb ? fin - deb : (cycleLength - deb + fin);
                            const leftPos = deb * pixelsPerSecond;
                            const width = duration * pixelsPerSecond;
                            const abrv = action.abrv || '';

                            // Cover all rows, starting just below ruler (8px above rows) and 30px below
                            const topPos = RULER_HEIGHT - 8;
                            const height = 8 + (groups.length * ROW_HEIGHT) + 30;

                            return (
                                <div
                                    key={`escamotage-${idx}`}
                                    className="escamotage-overlay"
                                    style={{
                                        left: `${leftPos}px`,
                                        width: `${width}px`,
                                        top: `${topPos}px`,
                                        height: `${height}px`
                                    }}
                                >
                                    {abrv && (
                                        <span className="escamotage-label">{abrv}</span>
                                    )}
                                </div>
                            );
                        })}

                        {/* Signa d'aide à la conduite overlays */}
                        {signaActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const deb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;
                            const blueStart = fin - 5;
                            const abrv = action.abrv || '';

                            // Calculate positions
                            const orangeLeftPos = deb * pixelsPerSecond;
                            const orangeWidth = 3 * pixelsPerSecond; // Orange intermittent zone (3s)
                            const blueLeftPos = blueStart * pixelsPerSecond;
                            const blueWidth = 5 * pixelsPerSecond; // Blue zone (5s at end)

                            // Vertical position based on GF
                            const topPos = RULER_HEIGHT + ((gf - 1) * ROW_HEIGHT) + 7;
                            const height = ROW_HEIGHT - 14;

                            return (
                                <React.Fragment key={`signa-${idx}`}>
                                    {/* Orange intermittent bar at start */}
                                    <div
                                        className="signa-orange-bar"
                                        style={{
                                            left: `${orangeLeftPos}px`,
                                            width: `${orangeWidth}px`,
                                            top: `${topPos}px`,
                                            height: `${height}px`
                                        }}
                                    />
                                    {/* Blue bar at end (last 5s) */}
                                    <div
                                        className="signa-blue-bar"
                                        style={{
                                            left: `${blueLeftPos}px`,
                                            width: `${blueWidth}px`,
                                            top: `${topPos}px`,
                                            height: `${height}px`
                                        }}
                                    >
                                        {abrv && (
                                            <span className="signa-label">{abrv}</span>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelineDiagram;
