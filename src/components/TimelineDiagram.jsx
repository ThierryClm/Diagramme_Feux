import React, { useRef, useEffect } from 'react';
import './TimelineDiagram.css';

const TimelineDiagram = ({ groups, globalTime, getGroupState, onGroupClick, pixelsPerSecond = 3 }) => {
    const containerRef = useRef(null);
    const TIME_WINDOW = 120; // seconds to display

    // Determine total width in pixels
    const totalWidth = TIME_WINDOW * pixelsPerSecond;

    return (
        <div className="timeline-container" ref={containerRef}>
            <div className="timeline-content" style={{ width: `${totalWidth}px` }}>
                <div className="timeline-header">
                    {/* Sticky Group Label Column is tricky in this layout if we scroll the whole content.
                         Better: The labels should be outside the scrollable track area.
                         Let's split: Labels Column (Fixed) | Scrollable Track Area
                     */}
                </div>

                {/* 
                   Refactoring Layout for Scroll:
                   Outer Flex Container
                     -> Left: Fixed Labels
                     -> Right: Scrollable Timeline
                */}
            </div>

            {/* Re-implementing with proper scroll layout */}
            <div className="timeline-layout">
                <div className="timeline-sidebar">
                    <div className="header-cell">Groupe</div>
                    {groups.map(g => (
                        <div key={g.id} className="row-label" onClick={() => onGroupClick(g)}>
                            G{g.id}
                        </div>
                    ))}
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

                            return (
                                <div key={group.id} className="timeline-row-track" onClick={() => onGroupClick(group)}>
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
                                                <div className="phase-bar red" style={{ width: `${redWidth}px` }}></div>
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
