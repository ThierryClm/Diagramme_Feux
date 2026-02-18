import React, { useState, useMemo } from 'react';
import './GreenWaveViewer.css';

const GreenWaveViewer = ({ isOpen, onClose, intersections, folderName }) => {
    const [pixelsPerSecond, setPixelsPerSecond] = useState(8);
    const [pixelsPerMeter, setPixelsPerMeter] = useState(1);
    const [speedUp, setSpeedUp] = useState(50); // km/h - vitesse montante
    const [speedDown, setSpeedDown] = useState(50); // km/h - vitesse descendante

    // Calculate the maximum values for axes
    const { maxTime, maxDistance, cycleLength } = useMemo(() => {
        if (!intersections || intersections.length === 0) {
            return { maxTime: 100, maxDistance: 500, cycleLength: 100 };
        }

        const maxDist = Math.max(...intersections.map(i => i.distance));
        const cycle = intersections[0]?.cycleLength || 100;

        return {
            maxTime: cycle * 2, // Show 2 cycles
            maxDistance: maxDist + 50,
            cycleLength: cycle
        };
    }, [intersections]);

    // Calculate speed line slope (meters per second)
    const speedUpMps = (speedUp * 1000) / 3600; // Convert km/h to m/s - ascending
    const speedDownMps = (speedDown * 1000) / 3600; // Convert km/h to m/s - descending

    const PADDING_LEFT = 120; // Increased for longer intersection names
    const PADDING_BOTTOM = 40;
    const PADDING_TOP = 20;
    const PADDING_RIGHT = 20;

    const diagramWidth = maxTime * pixelsPerSecond + PADDING_LEFT + PADDING_RIGHT;
    const diagramHeight = maxDistance * pixelsPerMeter + PADDING_TOP + PADDING_BOTTOM;

    // Convert coordinates
    const timeToX = (time) => PADDING_LEFT + time * pixelsPerSecond;
    const distanceToY = (distance) => diagramHeight - PADDING_BOTTOM - distance * pixelsPerMeter;

    // Generate axis ticks
    const timeTicks = [];
    const timeStep = cycleLength >= 60 ? 10 : 5;
    for (let t = 0; t <= maxTime; t += timeStep) {
        timeTicks.push(t);
    }

    const distanceTicks = [];
    const distanceStep = maxDistance > 500 ? 100 : 50;
    for (let d = 0; d <= maxDistance; d += distanceStep) {
        distanceTicks.push(d);
    }

    // Generate speed lines (green wave corridors) - ascending and descending
    const speedLinesUp = [];
    const speedLinesDown = [];
    for (let startTime = 0; startTime < maxTime; startTime += cycleLength) {
        // Ascending lines (bottom to top)
        speedLinesUp.push({
            x1: timeToX(startTime),
            y1: distanceToY(0),
            x2: timeToX(startTime + maxDistance / speedUpMps),
            y2: distanceToY(maxDistance)
        });
        // Descending lines (top to bottom)
        speedLinesDown.push({
            x1: timeToX(startTime),
            y1: distanceToY(maxDistance),
            x2: timeToX(startTime + maxDistance / speedDownMps),
            y2: distanceToY(0)
        });
    }

    // Calculate bandwidth corridors (ascending and descending)
    const bandwidthData = useMemo(() => {
        if (!intersections || intersections.length === 0) return null;

        // Sort intersections by distance
        const sortedByDist = [...intersections].sort((a, b) => a.distance - b.distance);

        if (sortedByDist.length === 0) return null;

        // Reference = bottom intersection (min distance) for ascending, top for descending
        const bottomIntersection = sortedByDist[0];
        const topIntersection = sortedByDist[sortedByDist.length - 1];

        // ASCENDING bandwidth (bottom to top, positive slope) - uses Group 2 (GF montant)
        const bottomGroupAsc = bottomIntersection.groups.find(g => g.id === bottomIntersection.selectedGroup2);

        let ascStart = 0;
        let ascEnd = cycleLength;
        const bottomDist = bottomIntersection.distance;

        if (bottomGroupAsc) {
            ascStart = bottomGroupAsc.offset;
            ascEnd = bottomGroupAsc.offset + (bottomGroupAsc.durations?.green || 0);

            sortedByDist.forEach((intersection) => {
                const group = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                if (!group) return;

                // Time to travel from bottom to this intersection
                const travelTime = (intersection.distance - bottomDist) / speedUpMps;

                // Green window at this intersection
                const greenStart = group.offset;
                const greenEnd = greenStart + (group.durations?.green || 0);

                // Shift back to bottom reference time
                const greenStartAtBottom = greenStart - travelTime;
                const greenEndAtBottom = greenEnd - travelTime;

                // Intersect windows
                ascStart = Math.max(ascStart, greenStartAtBottom);
                ascEnd = Math.min(ascEnd, greenEndAtBottom);
            });
        }

        const ascWidth = ascEnd - ascStart;

        // DESCENDING bandwidth (top to bottom, negative slope) - uses Group 1 (GF descendant)
        const topGroupDesc = topIntersection.groups.find(g => g.id === topIntersection.selectedGroup1);

        let descStart = 0;
        let descEnd = cycleLength;

        if (topGroupDesc) {
            descStart = topGroupDesc.offset;
            descEnd = topGroupDesc.offset + (topGroupDesc.durations?.green || 0);

            sortedByDist.forEach((intersection) => {
                const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                if (!group) return;

                // Time to travel from top to this intersection (going down)
                const travelTime = (topIntersection.distance - intersection.distance) / speedDownMps;

                // Green window at this intersection
                const greenStart = group.offset;
                const greenEnd = greenStart + (group.durations?.green || 0);

                // Shift back to top reference time
                const greenStartAtTop = greenStart - travelTime;
                const greenEndAtTop = greenEnd - travelTime;

                descStart = Math.max(descStart, greenStartAtTop);
                descEnd = Math.min(descEnd, greenEndAtTop);
            });
        }

        const descWidth = descEnd - descStart;

        return {
            ascending: (bottomGroupAsc && ascWidth > 0) ? {
                start: ascStart,
                width: ascWidth,
                refDistance: bottomDist
            } : null,
            descending: (topGroupDesc && descWidth > 0) ? {
                start: descStart,
                width: descWidth,
                refDistance: topIntersection.distance
            } : null
        };
    }, [intersections, speedUpMps, speedDownMps, cycleLength]);

    if (!isOpen) return null;

    return (
        <div className="green-wave-overlay">
            <div className="green-wave-container">
                <div className="green-wave-header">
                    <h2>Onde Verte {(folderName || intersections?.[0]?.projectName) && <span className="folder-name">- {folderName || intersections?.[0]?.projectName}</span>}</h2>
                    <div className="green-wave-controls">
                        <label>
                            V. montante :
                            <input
                                type="number"
                                value={speedUp}
                                onChange={(e) => setSpeedUp(parseInt(e.target.value) || 50)}
                                min="10"
                                max="130"
                            />
                            km/h
                        </label>
                        <label>
                            V. descendante :
                            <input
                                type="number"
                                value={speedDown}
                                onChange={(e) => setSpeedDown(parseInt(e.target.value) || 50)}
                                min="10"
                                max="130"
                            />
                            km/h
                        </label>
                        <label>
                            Zoom X :
                            <input
                                type="range"
                                min="3"
                                max="20"
                                value={pixelsPerSecond}
                                onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))}
                            />
                            {pixelsPerSecond}px/s
                        </label>
                        <label>
                            Zoom Y :
                            <input
                                type="range"
                                min="0.5"
                                max="3"
                                step="0.1"
                                value={pixelsPerMeter}
                                onChange={(e) => setPixelsPerMeter(parseFloat(e.target.value))}
                            />
                            {pixelsPerMeter.toFixed(1)}px/m
                        </label>
                    </div>
                    <button className="green-wave-close" onClick={onClose}>×</button>
                </div>

                <div className="green-wave-diagram-scroll">
                    <svg
                        className="green-wave-svg"
                        width={diagramWidth}
                        height={diagramHeight}
                    >
                        {/* Background */}
                        <rect
                            x={PADDING_LEFT}
                            y={PADDING_TOP}
                            width={diagramWidth - PADDING_LEFT - PADDING_RIGHT}
                            height={diagramHeight - PADDING_TOP - PADDING_BOTTOM}
                            fill="#1a1a1a"
                        />


                        {/* Grid lines - vertical (time) */}
                        {timeTicks.map(t => (
                            <line
                                key={`grid-t-${t}`}
                                x1={timeToX(t)}
                                y1={PADDING_TOP}
                                x2={timeToX(t)}
                                y2={diagramHeight - PADDING_BOTTOM}
                                stroke={t % cycleLength === 0 ? '#555' : '#333'}
                                strokeWidth={t % cycleLength === 0 ? 1 : 0.5}
                            />
                        ))}

                        {/* Grid lines - horizontal (distance) */}
                        {distanceTicks.map(d => (
                            <line
                                key={`grid-d-${d}`}
                                x1={PADDING_LEFT}
                                y1={distanceToY(d)}
                                x2={diagramWidth - PADDING_RIGHT}
                                y2={distanceToY(d)}
                                stroke="#333"
                                strokeWidth={0.5}
                            />
                        ))}

                        {/* Speed lines ascending (green wave corridor) */}
                        {speedLinesUp.map((line, idx) => (
                            <line
                                key={`speed-up-${idx}`}
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="#4CAF50"
                                strokeWidth={2}
                                strokeDasharray="8,4"
                                opacity={0.6}
                            />
                        ))}
                        {/* Speed lines descending (green wave corridor) */}
                        {speedLinesDown.map((line, idx) => (
                            <line
                                key={`speed-down-${idx}`}
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="#FF9800"
                                strokeWidth={2}
                                strokeDasharray="8,4"
                                opacity={0.6}
                            />
                        ))}

                        {/* Intersection bars */}
                        {intersections?.map((intersection, idx) => {
                            const y = distanceToY(intersection.distance);
                            const barHeight = 16;

                            // Get the two selected groups
                            const group1 = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                            const group2 = intersection.groups.find(g => g.id === intersection.selectedGroup2);

                            const bars = [];

                            // Render bars for multiple cycles
                            for (let cycle = 0; cycle < 2; cycle++) {
                                const cycleOffset = cycle * intersection.cycleLength;

                                // Group 1 bar (GF descendant)
                                if (group1) {
                                    const start1 = group1.offset + cycleOffset;
                                    const duration1 = group1.durations?.green || 0;
                                    const end1 = start1 + duration1;
                                    const barY1 = y - barHeight / 2 - 4;
                                    bars.push(
                                        <g key={`bar-${idx}-g1-c${cycle}`}>
                                            <rect
                                                x={timeToX(start1)}
                                                y={barY1}
                                                width={duration1 * pixelsPerSecond}
                                                height={barHeight / 2}
                                                fill="#4CAF50"
                                                opacity={0.9}
                                            />
                                            {/* Deb value at start */}
                                            <text
                                                x={timeToX(start1) + 2}
                                                y={barY1 + barHeight / 4 + 3}
                                                fill="#fff"
                                                fontSize="9"
                                                fontWeight="bold"
                                            >
                                                {Math.round(start1 % intersection.cycleLength)}
                                            </text>
                                            {/* Fin value at end */}
                                            <text
                                                x={timeToX(end1) - 2}
                                                y={barY1 + barHeight / 4 + 3}
                                                fill="#fff"
                                                fontSize="9"
                                                fontWeight="bold"
                                                textAnchor="end"
                                            >
                                                {Math.round(end1 % intersection.cycleLength)}
                                            </text>
                                        </g>
                                    );
                                }

                                // Group 2 bar (GF montant)
                                if (group2) {
                                    const start2 = group2.offset + cycleOffset;
                                    const duration2 = group2.durations?.green || 0;
                                    const end2 = start2 + duration2;
                                    const barY2 = y + 4;
                                    bars.push(
                                        <g key={`bar-${idx}-g2-c${cycle}`}>
                                            <rect
                                                x={timeToX(start2)}
                                                y={barY2}
                                                width={duration2 * pixelsPerSecond}
                                                height={barHeight / 2}
                                                fill="#8BC34A"
                                                opacity={0.9}
                                            />
                                            {/* Deb value at start */}
                                            <text
                                                x={timeToX(start2) + 2}
                                                y={barY2 + barHeight / 4 + 3}
                                                fill="#fff"
                                                fontSize="9"
                                                fontWeight="bold"
                                            >
                                                {Math.round(start2 % intersection.cycleLength)}
                                            </text>
                                            {/* Fin value at end */}
                                            <text
                                                x={timeToX(end2) - 2}
                                                y={barY2 + barHeight / 4 + 3}
                                                fill="#fff"
                                                fontSize="9"
                                                fontWeight="bold"
                                                textAnchor="end"
                                            >
                                                {Math.round(end2 % intersection.cycleLength)}
                                            </text>
                                        </g>
                                    );
                                }
                            }

                            return (
                                <g key={`intersection-${idx}`}>
                                    {/* Intersection label */}
                                    <text
                                        x={PADDING_LEFT - 5}
                                        y={y + 5}
                                        textAnchor="end"
                                        fill="#fff"
                                        fontSize="14"
                                        fontWeight="bold"
                                    >
                                        {intersection.projectName}
                                    </text>

                                    {/* Horizontal line at intersection */}
                                    <line
                                        x1={PADDING_LEFT}
                                        y1={y}
                                        x2={diagramWidth - PADDING_RIGHT}
                                        y2={y}
                                        stroke="#666"
                                        strokeWidth={0.5}
                                        strokeDasharray="2,2"
                                    />

                                    {bars}
                                </g>
                            );
                        })}

                        {/* Clip path pour tronquer les bandes passantes à gauche de l'axe Y */}
                        <defs>
                            <clipPath id="bandwidth-clip-viewer">
                                <rect x={PADDING_LEFT} y={0} width={diagramWidth - PADDING_LEFT} height={diagramHeight} />
                            </clipPath>
                        </defs>

                        <g clipPath="url(#bandwidth-clip-viewer)">
                        {/* Ascending bandwidth corridor (bottom to top) - inscribed in bars */}
                        {bandwidthData?.ascending && intersections && (() => {
                            const sortedByDist = [...intersections].sort((a, b) => a.distance - b.distance);
                            const bottomDist = sortedByDist[0].distance;
                            const { start, width } = bandwidthData.ascending;
                            const barHeight = 8;

                            const elements = [];
                            for (let cycle = -1; cycle < 2; cycle++) {
                                const cycleOffset = cycle * cycleLength;
                                const bandStartAtBottom = start + cycleOffset;
                                const bandEndAtBottom = bandStartAtBottom + width;

                                // Draw bandwidth segment at each intersection (inscribed in bar)
                                sortedByDist.forEach((intersection, idx) => {
                                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                                    if (!group) return;

                                    const y = distanceToY(intersection.distance);
                                    const travelTime = (intersection.distance - bottomDist) / speedUpMps;

                                    // Bandwidth window at this intersection
                                    const bandStart = bandStartAtBottom + travelTime;
                                    const bandEnd = bandEndAtBottom + travelTime;

                                    // Green window at this intersection
                                    const greenStart = group.offset + cycleOffset;
                                    const greenEnd = greenStart + (group.durations?.green || 0);

                                    // Intersection of bandwidth and green
                                    const clipStart = Math.max(bandStart, greenStart);
                                    const clipEnd = Math.min(bandEnd, greenEnd);

                                    if (clipEnd > clipStart) {
                                        elements.push(
                                            <rect
                                                key={`asc-bar-${idx}-c${cycle}`}
                                                x={timeToX(clipStart)}
                                                y={y + 4}
                                                width={(clipEnd - clipStart) * pixelsPerSecond}
                                                height={barHeight}
                                                fill="#1B5E20"
                                                opacity={0.9}
                                            />
                                        );
                                    }

                                    // Draw connecting lines between intersections
                                    if (idx < sortedByDist.length - 1) {
                                        const nextIntersection = sortedByDist[idx + 1];
                                        const nextY = distanceToY(nextIntersection.distance);
                                        const nextTravelTime = (nextIntersection.distance - bottomDist) / speedUpMps;
                                        const nextBandStart = bandStartAtBottom + nextTravelTime;
                                        const nextBandEnd = bandEndAtBottom + nextTravelTime;

                                        // Left edge of bandwidth
                                        elements.push(
                                            <line
                                                key={`asc-left-${idx}-c${cycle}`}
                                                x1={timeToX(bandStart)}
                                                y1={y + 8}
                                                x2={timeToX(nextBandStart)}
                                                y2={nextY + 8}
                                                stroke="#81C784"
                                                strokeWidth={2}
                                            />
                                        );
                                        // Right edge of bandwidth
                                        elements.push(
                                            <line
                                                key={`asc-right-${idx}-c${cycle}`}
                                                x1={timeToX(bandEnd)}
                                                y1={y + 8}
                                                x2={timeToX(nextBandEnd)}
                                                y2={nextY + 8}
                                                stroke="#81C784"
                                                strokeWidth={2}
                                            />
                                        );
                                    }
                                });
                            }
                            return elements;
                        })()}

                        {/* Descending bandwidth corridor (top to bottom) - inscribed in bars */}
                        {bandwidthData?.descending && intersections && (() => {
                            const sortedByDist = [...intersections].sort((a, b) => a.distance - b.distance);
                            const topDist = sortedByDist[sortedByDist.length - 1].distance;
                            const { start, width } = bandwidthData.descending;
                            const barHeight = 8;

                            const elements = [];
                            for (let cycle = -1; cycle < 2; cycle++) {
                                const cycleOffset = cycle * cycleLength;
                                const bandStartAtTop = start + cycleOffset;
                                const bandEndAtTop = bandStartAtTop + width;

                                // Draw bandwidth segment at each intersection (inscribed in bar)
                                // Process from top to bottom
                                const sortedTopToBottom = [...sortedByDist].reverse();

                                sortedTopToBottom.forEach((intersection, idx) => {
                                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                                    if (!group) return;

                                    const y = distanceToY(intersection.distance);
                                    const travelTime = (topDist - intersection.distance) / speedDownMps;

                                    // Bandwidth window at this intersection
                                    const bandStart = bandStartAtTop + travelTime;
                                    const bandEnd = bandEndAtTop + travelTime;

                                    // Green window at this intersection
                                    const greenStart = group.offset + cycleOffset;
                                    const greenEnd = greenStart + (group.durations?.green || 0);

                                    // Intersection of bandwidth and green
                                    const clipStart = Math.max(bandStart, greenStart);
                                    const clipEnd = Math.min(bandEnd, greenEnd);

                                    if (clipEnd > clipStart) {
                                        elements.push(
                                            <rect
                                                key={`desc-bar-${idx}-c${cycle}`}
                                                x={timeToX(clipStart)}
                                                y={y - 12}
                                                width={(clipEnd - clipStart) * pixelsPerSecond}
                                                height={barHeight}
                                                fill="#BF360C"
                                                opacity={0.9}
                                            />
                                        );
                                    }

                                    // Draw connecting lines between intersections
                                    if (idx < sortedTopToBottom.length - 1) {
                                        const nextIntersection = sortedTopToBottom[idx + 1];
                                        const nextY = distanceToY(nextIntersection.distance);
                                        const nextTravelTime = (topDist - nextIntersection.distance) / speedDownMps;
                                        const nextBandStart = bandStartAtTop + nextTravelTime;
                                        const nextBandEnd = bandEndAtTop + nextTravelTime;

                                        // Left edge of bandwidth
                                        elements.push(
                                            <line
                                                key={`desc-left-${idx}-c${cycle}`}
                                                x1={timeToX(bandStart)}
                                                y1={y - 8}
                                                x2={timeToX(nextBandStart)}
                                                y2={nextY - 8}
                                                stroke="#FFAB91"
                                                strokeWidth={2}
                                            />
                                        );
                                        // Right edge of bandwidth
                                        elements.push(
                                            <line
                                                key={`desc-right-${idx}-c${cycle}`}
                                                x1={timeToX(bandEnd)}
                                                y1={y - 8}
                                                x2={timeToX(nextBandEnd)}
                                                y2={nextY - 8}
                                                stroke="#FFAB91"
                                                strokeWidth={2}
                                            />
                                        );
                                    }
                                });
                            }
                            return elements;
                        })()}
                        </g>

                        {/* X Axis (Time) */}
                        <line
                            x1={PADDING_LEFT}
                            y1={diagramHeight - PADDING_BOTTOM}
                            x2={diagramWidth - PADDING_RIGHT}
                            y2={diagramHeight - PADDING_BOTTOM}
                            stroke="#888"
                            strokeWidth={1}
                        />

                        {/* X Axis ticks and labels */}
                        {timeTicks.map(t => (
                            <g key={`tick-t-${t}`}>
                                <line
                                    x1={timeToX(t)}
                                    y1={diagramHeight - PADDING_BOTTOM}
                                    x2={timeToX(t)}
                                    y2={diagramHeight - PADDING_BOTTOM + 5}
                                    stroke="#888"
                                />
                                <text
                                    x={timeToX(t)}
                                    y={diagramHeight - PADDING_BOTTOM + 18}
                                    textAnchor="middle"
                                    fill="#888"
                                    fontSize="10"
                                >
                                    {t}
                                </text>
                            </g>
                        ))}

                        {/* X Axis label */}
                        <text
                            x={diagramWidth / 2}
                            y={diagramHeight - 5}
                            textAnchor="middle"
                            fill="#aaa"
                            fontSize="12"
                        >
                            Temps (s)
                        </text>

                        {/* Y Axis (Distance) */}
                        <line
                            x1={PADDING_LEFT}
                            y1={PADDING_TOP}
                            x2={PADDING_LEFT}
                            y2={diagramHeight - PADDING_BOTTOM}
                            stroke="#888"
                            strokeWidth={1}
                        />

                        {/* Y Axis ticks and labels */}
                        {distanceTicks.map(d => (
                            <g key={`tick-d-${d}`}>
                                <line
                                    x1={PADDING_LEFT - 5}
                                    y1={distanceToY(d)}
                                    x2={PADDING_LEFT}
                                    y2={distanceToY(d)}
                                    stroke="#888"
                                />
                                <text
                                    x={PADDING_LEFT - 8}
                                    y={distanceToY(d) + 4}
                                    textAnchor="end"
                                    fill="#888"
                                    fontSize="10"
                                >
                                    {d}
                                </text>
                            </g>
                        ))}

                        {/* Y Axis label */}
                        <text
                            x={15}
                            y={diagramHeight / 2}
                            textAnchor="middle"
                            fill="#aaa"
                            fontSize="12"
                            transform={`rotate(-90, 15, ${diagramHeight / 2})`}
                        >
                            Distance (m)
                        </text>
                    </svg>
                </div>

                <div className="green-wave-legend">
                    <div className="legend-item">
                        <div className="legend-color" style={{ background: '#4CAF50' }}></div>
                        <span>GF descendant</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-color" style={{ background: '#8BC34A' }}></div>
                        <span>GF montant</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-line" style={{ borderColor: '#4CAF50' }}></div>
                        <span>V. montante: {speedUp} km/h</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-line" style={{ borderColor: '#FF9800' }}></div>
                        <span>V. descendante: {speedDown} km/h</span>
                    </div>
                    {bandwidthData?.ascending && (
                        <div className="legend-item">
                            <div className="legend-bandwidth" style={{ background: 'rgba(76, 175, 80, 0.3)', borderColor: '#4CAF50' }}></div>
                            <span>Montant: {bandwidthData.ascending.width.toFixed(1)}s</span>
                        </div>
                    )}
                    {bandwidthData?.descending && (
                        <div className="legend-item">
                            <div className="legend-bandwidth" style={{ background: 'rgba(255, 152, 0, 0.3)', borderColor: '#FF9800' }}></div>
                            <span>Descendant: {bandwidthData.descending.width.toFixed(1)}s</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GreenWaveViewer;
