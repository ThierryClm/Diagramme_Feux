import React, { useState, useEffect, useMemo } from 'react';
import './components/GreenWaveViewer.css';

const GreenWavePage = () => {
    const [intersections, setIntersections] = useState(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(8);
    const [pixelsPerMeter, setPixelsPerMeter] = useState(1);
    const [speed, setSpeed] = useState(50); // km/h

    // Load data from sessionStorage on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const greenWaveId = urlParams.get('id');
        if (greenWaveId) {
            const savedData = sessionStorage.getItem(`greenwave_${greenWaveId}`);
            if (savedData) {
                try {
                    const data = JSON.parse(savedData);
                    setIntersections(data);
                    // Set document title
                    document.title = `Onde Verte - ${data.length} carrefours`;
                } catch (e) {
                    console.error('Failed to load green wave data', e);
                }
            }
        }
    }, []);

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
    const speedMps = (speed * 1000) / 3600; // Convert km/h to m/s

    const PADDING_LEFT = 80;
    const PADDING_BOTTOM = 50;
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

    // Generate speed lines (green wave corridors)
    const speedLines = [];
    for (let startTime = 0; startTime < maxTime; startTime += cycleLength) {
        const line = {
            x1: timeToX(startTime),
            y1: distanceToY(0),
            x2: timeToX(startTime + maxDistance / speedMps),
            y2: distanceToY(maxDistance)
        };
        speedLines.push(line);
    }

    if (!intersections) {
        return (
            <div className="green-wave-page">
                <div className="green-wave-loading">
                    Chargement des données...
                </div>
            </div>
        );
    }

    return (
        <div className="green-wave-page">
            <div className="green-wave-page-header">
                <h1>Onde Verte</h1>
                <div className="green-wave-controls">
                    <label>
                        Vitesse :
                        <input
                            type="number"
                            value={speed}
                            onChange={(e) => setSpeed(parseInt(e.target.value) || 50)}
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

                    {/* Speed lines (green wave corridor) */}
                    {speedLines.map((line, idx) => (
                        <line
                            key={`speed-${idx}`}
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

                            // Group 1 bar
                            if (group1) {
                                const start1 = group1.offset + cycleOffset;
                                const duration1 = group1.durations?.green || 0;
                                bars.push(
                                    <rect
                                        key={`bar-${idx}-g1-c${cycle}`}
                                        x={timeToX(start1)}
                                        y={y - barHeight / 2 - 4}
                                        width={duration1 * pixelsPerSecond}
                                        height={barHeight / 2}
                                        fill="#4CAF50"
                                        opacity={0.9}
                                    />
                                );
                            }

                            // Group 2 bar
                            if (group2) {
                                const start2 = group2.offset + cycleOffset;
                                const duration2 = group2.durations?.green || 0;
                                bars.push(
                                    <rect
                                        key={`bar-${idx}-g2-c${cycle}`}
                                        x={timeToX(start2)}
                                        y={y + 4}
                                        width={duration2 * pixelsPerSecond}
                                        height={barHeight / 2}
                                        fill="#8BC34A"
                                        opacity={0.9}
                                    />
                                );
                            }
                        }

                        return (
                            <g key={`intersection-${idx}`}>
                                {/* Intersection label */}
                                <text
                                    x={PADDING_LEFT - 5}
                                    y={y + 4}
                                    textAnchor="end"
                                    fill="#fff"
                                    fontSize="11"
                                >
                                    {intersection.projectName}
                                </text>

                                {/* Distance label */}
                                <text
                                    x={PADDING_LEFT - 5}
                                    y={y + 16}
                                    textAnchor="end"
                                    fill="#888"
                                    fontSize="9"
                                >
                                    ({intersection.distance}m)
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
                        y={diagramHeight - 8}
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
                    <span>Groupe 1 (vert)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#8BC34A' }}></div>
                    <span>Groupe 2 (vert clair)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-line"></div>
                    <span>Corridor onde verte ({speed} km/h)</span>
                </div>
            </div>
        </div>
    );
};

export default GreenWavePage;
