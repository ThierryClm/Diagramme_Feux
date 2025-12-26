import React, { useRef } from 'react';
import './TimelineDiagram.css';

const TimelineDiagram = ({ groups, globalTime, onGroupClick, pixelsPerSecond = 3, conflicts, updateGroupParams, cycleLength }) => {
    const containerRef = useRef(null);
    const TIME_WINDOW = 120; // seconds to display

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
                        {/* Ruler */}
                        <div className="timeline-ruler">
                            {Array.from({ length: TIME_WINDOW / 5 + 1 }).map((_, i) => (
                                <div key={i} className="ruler-tick" style={{ left: `${i * 5 * pixelsPerSecond}px` }}>
                                    {i * 5}s
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
                            const totalDuration = group.durations.green + group.durations.orange + group.durations.red;
                            const cyclesToRender = Math.ceil(TIME_WINDOW / totalDuration) + 1;

                            // Check for conflict involvement
                            const isConflict = conflicts && conflicts.some(c => c.from === group.id || c.to === group.id);

                            return (
                                <div
                                    key={group.id}
                                    className={`timeline-row-track ${isConflict ? 'row-conflict' : ''}`}
                                    onClick={() => onGroupClick(group)}
                                    style={{ backgroundColor: isConflict ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}
                                >
                                    {Array.from({ length: cyclesToRender }).map((_, i) => {
                                        const cycleStart = (i * totalDuration) - (group.offset % totalDuration);
                                        const greenWidth = group.durations.green * pixelsPerSecond;
                                        const orangeWidth = group.durations.orange * pixelsPerSecond;
                                        const redWidth = group.durations.red * pixelsPerSecond;
                                        const leftPos = cycleStart * pixelsPerSecond;

                                        return (
                                            <div
                                                key={i}
                                                className="cycle-block"
                                                style={{ left: `${leftPos}px` }}
                                            >
                                                <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                                                <div className="phase-bar orange" style={{ width: `${orangeWidth}px` }}></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelineDiagram;
