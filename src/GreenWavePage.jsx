import React, { useState, useEffect, useMemo } from 'react';
import './components/GreenWaveViewer.css';

const GreenWavePage = () => {
    const [intersections, setIntersections] = useState(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(8);
    const [pixelsPerMeter, setPixelsPerMeter] = useState(1);
    const [speed, setSpeed] = useState(50); // km/h
    const [greenWaveName, setGreenWaveName] = useState('');

    // Save green wave data to localStorage
    const handleSaveGreenWave = () => {
        if (!intersections) return;

        const name = prompt('Nom de l\'onde verte:', greenWaveName || 'Onde verte');
        if (!name) return;

        const greenWaveData = {
            name,
            intersections,
            speed,
            pixelsPerSecond,
            pixelsPerMeter,
            savedAt: new Date().toISOString()
        };

        // Get existing saved green waves
        const savedGreenWaves = JSON.parse(localStorage.getItem('savedGreenWaves') || '{}');
        savedGreenWaves[name] = greenWaveData;
        localStorage.setItem('savedGreenWaves', JSON.stringify(savedGreenWaves));

        setGreenWaveName(name);
        alert(`Onde verte "${name}" enregistrée avec succès.`);
    };

    // Synchronize green wave data from saved projects
    const handleSyncGreenWave = () => {
        if (!intersections) return;

        let updatedCount = 0;
        const updatedIntersections = intersections.map(intersection => {
            // Try to load project data from localStorage
            const projectKey = `traffic_project_${intersection.projectName}`;
            const projectRaw = localStorage.getItem(projectKey);

            if (projectRaw) {
                try {
                    const projectData = JSON.parse(projectRaw);
                    if (projectData.groups) {
                        updatedCount++;
                        return {
                            ...intersection,
                            groups: projectData.groups,
                            cycleLength: projectData.cycleLength || intersection.cycleLength
                        };
                    }
                } catch (e) {
                    console.error(`Failed to sync project ${intersection.projectName}`, e);
                }
            }
            return intersection;
        });

        setIntersections(updatedIntersections);

        if (updatedCount > 0) {
            alert(`${updatedCount} carrefour(s) synchronisé(s) avec succès.`);
        } else {
            alert('Aucun carrefour mis à jour. Vérifiez que les projets existent.');
        }
    };

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

    // Update group parameter in intersection
    const updateGroupParam = (intersectionIdx, groupId, field, value) => {
        setIntersections(prev => {
            const updated = [...prev];
            const intersection = { ...updated[intersectionIdx] };
            intersection.groups = intersection.groups.map(g => {
                if (g.id === groupId) {
                    if (field === 'offset') {
                        return { ...g, offset: parseInt(value) || 0 };
                    } else if (field === 'green') {
                        return { ...g, durations: { ...g.durations, green: parseInt(value) || 0 } };
                    }
                }
                return g;
            });
            updated[intersectionIdx] = intersection;
            return updated;
        });
    };

    // Update intersection distance
    const updateDistance = (intersectionIdx, value) => {
        setIntersections(prev => {
            const updated = [...prev];
            updated[intersectionIdx] = { ...updated[intersectionIdx], distance: parseInt(value) || 0 };
            return updated;
        });
    };

    // Calculate speed line slope (meters per second)
    const speedMps = (speed * 1000) / 3600; // Convert km/h to m/s

    const PADDING_LEFT = 150;
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

    // Calculate bandwidth corridors (ascending and descending)
    const bandwidthData = useMemo(() => {
        if (!intersections || intersections.length === 0) return null;

        // Sort intersections by distance
        const sortedIntersections = [...intersections].sort((a, b) => a.distance - b.distance);
        if (sortedIntersections.length === 0) return null;

        // Reference = bottom intersection (min distance)
        const bottomIntersection = sortedIntersections[0];
        const topIntersection = sortedIntersections[sortedIntersections.length - 1];

        // ASCENDING bandwidth (bottom to top, positive slope)
        // At reference (bottom), find the time window that passes through all greens going up
        const bottomGroup = bottomIntersection.groups.find(g => g.id === bottomIntersection.selectedGroup1);
        if (!bottomGroup) return null;

        let ascStart = bottomGroup.offset;
        let ascEnd = bottomGroup.offset + (bottomGroup.durations?.green || 0);

        sortedIntersections.forEach((intersection) => {
            const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
            if (!group) return;

            // Time to travel from bottom to this intersection
            const travelTime = (intersection.distance - bottomIntersection.distance) / speedMps;

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

        const ascWidth = ascEnd - ascStart;

        // DESCENDING bandwidth (top to bottom, negative slope)
        const topGroup = topIntersection.groups.find(g => g.id === topIntersection.selectedGroup1);

        let descStart = 0;
        let descEnd = cycleLength;

        if (topGroup) {
            descStart = topGroup.offset;
            descEnd = topGroup.offset + (topGroup.durations?.green || 0);

            sortedIntersections.forEach((intersection) => {
                const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                if (!group) return;

                // Time to travel from top to this intersection (going down)
                const travelTime = (topIntersection.distance - intersection.distance) / speedMps;

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
            ascending: ascWidth > 0 ? {
                start: ascStart,
                width: ascWidth,
                refDistance: bottomIntersection.distance
            } : null,
            descending: descWidth > 0 ? {
                start: descStart,
                width: descWidth,
                refDistance: topIntersection.distance
            } : null
        };
    }, [intersections, speedMps, cycleLength]);

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
                    <button className="green-wave-sync-btn" onClick={handleSyncGreenWave}>
                        Synchroniser
                    </button>
                    <button className="green-wave-save-btn" onClick={handleSaveGreenWave}>
                        Enregistrer
                    </button>
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

                    {/* Ascending bandwidth corridor (bottom to top) */}
                    {bandwidthData?.ascending && intersections && (() => {
                        const sortedIntersections = [...intersections].sort((a, b) => a.distance - b.distance);
                        const bottomDist = sortedIntersections[0].distance;
                        const topDist = sortedIntersections[sortedIntersections.length - 1].distance;
                        const { start, width } = bandwidthData.ascending;

                        // Draw parallelogram for each cycle
                        const polygons = [];
                        for (let cycle = 0; cycle < 2; cycle++) {
                            const cycleOffset = cycle * cycleLength;
                            const startTime = start + cycleOffset;
                            const endTime = startTime + width;

                            // Bottom left, bottom right, top right, top left
                            const travelTimeToTop = (topDist - bottomDist) / speedMps;
                            const points = [
                                `${timeToX(startTime)},${distanceToY(bottomDist)}`,
                                `${timeToX(endTime)},${distanceToY(bottomDist)}`,
                                `${timeToX(endTime + travelTimeToTop)},${distanceToY(topDist)}`,
                                `${timeToX(startTime + travelTimeToTop)},${distanceToY(topDist)}`
                            ].join(' ');

                            polygons.push(
                                <polygon
                                    key={`asc-${cycle}`}
                                    points={points}
                                    fill="#4CAF50"
                                    opacity={0.25}
                                    stroke="#4CAF50"
                                    strokeWidth={2}
                                />
                            );
                        }
                        return polygons;
                    })()}

                    {/* Descending bandwidth corridor (top to bottom) */}
                    {bandwidthData?.descending && intersections && (() => {
                        const sortedIntersections = [...intersections].sort((a, b) => a.distance - b.distance);
                        const bottomDist = sortedIntersections[0].distance;
                        const topDist = sortedIntersections[sortedIntersections.length - 1].distance;
                        const { start, width } = bandwidthData.descending;

                        // Draw parallelogram for each cycle
                        const polygons = [];
                        for (let cycle = 0; cycle < 2; cycle++) {
                            const cycleOffset = cycle * cycleLength;
                            const startTime = start + cycleOffset;
                            const endTime = startTime + width;

                            // Top left, top right, bottom right, bottom left (going down = time increases)
                            const travelTimeToBottom = (topDist - bottomDist) / speedMps;
                            const points = [
                                `${timeToX(startTime)},${distanceToY(topDist)}`,
                                `${timeToX(endTime)},${distanceToY(topDist)}`,
                                `${timeToX(endTime + travelTimeToBottom)},${distanceToY(bottomDist)}`,
                                `${timeToX(startTime + travelTimeToBottom)},${distanceToY(bottomDist)}`
                            ].join(' ');

                            polygons.push(
                                <polygon
                                    key={`desc-${cycle}`}
                                    points={points}
                                    fill="#FF9800"
                                    opacity={0.25}
                                    stroke="#FF9800"
                                    strokeWidth={2}
                                />
                            );
                        }
                        return polygons;
                    })()}

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
                                {/* Project name */}
                                <text
                                    x={PADDING_LEFT - 5}
                                    y={y - 12}
                                    textAnchor="end"
                                    fill="#fff"
                                    fontSize="10"
                                    fontWeight="bold"
                                >
                                    {intersection.projectName}
                                </text>

                                {/* Group 1 name */}
                                {group1 && (
                                    <text
                                        x={PADDING_LEFT - 5}
                                        y={y}
                                        textAnchor="end"
                                        fill="#4CAF50"
                                        fontSize="9"
                                    >
                                        G{group1.id}: {group1.name || `Groupe ${group1.id}`}
                                    </text>
                                )}

                                {/* Group 2 name */}
                                {group2 && (
                                    <text
                                        x={PADDING_LEFT - 5}
                                        y={y + 12}
                                        textAnchor="end"
                                        fill="#8BC34A"
                                        fontSize="9"
                                    >
                                        G{group2.id}: {group2.name || `Groupe ${group2.id}`}
                                    </text>
                                )}

                                {/* Distance label */}
                                <text
                                    x={PADDING_LEFT - 5}
                                    y={y + 24}
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
                    <span>Vitesse: {speed} km/h</span>
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

            {/* Parameters panel */}
            <div className="green-wave-params-panel">
                <h3>Paramètres des carrefours</h3>
                <div className="params-table">
                    <div className="params-header">
                        <span className="param-col-name">Carrefour</span>
                        <span className="param-col-dist">Dist (m)</span>
                        <span className="param-col-group">Groupe</span>
                        <span className="param-col-offset">Décal</span>
                        <span className="param-col-green">Vert</span>
                    </div>
                    {intersections?.map((intersection, idx) => {
                        const group1 = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                        const group2 = intersection.groups.find(g => g.id === intersection.selectedGroup2);

                        return (
                            <div key={idx} className="params-row">
                                <span className="param-col-name">{intersection.projectName}</span>
                                <input
                                    type="number"
                                    className="param-col-dist"
                                    value={intersection.distance}
                                    onChange={(e) => updateDistance(idx, e.target.value)}
                                />
                                {group1 && (
                                    <>
                                        <span className="param-col-group" style={{ color: '#4CAF50' }}>G{group1.id}</span>
                                        <input
                                            type="number"
                                            className="param-col-offset"
                                            value={group1.offset}
                                            onChange={(e) => updateGroupParam(idx, group1.id, 'offset', e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            className="param-col-green"
                                            value={group1.durations?.green || 0}
                                            onChange={(e) => updateGroupParam(idx, group1.id, 'green', e.target.value)}
                                        />
                                    </>
                                )}
                            </div>
                        );
                    })}
                    {intersections?.map((intersection, idx) => {
                        const group2 = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                        if (!group2) return null;

                        return (
                            <div key={`g2-${idx}`} className="params-row params-row-g2">
                                <span className="param-col-name"></span>
                                <span className="param-col-dist"></span>
                                <span className="param-col-group" style={{ color: '#8BC34A' }}>G{group2.id}</span>
                                <input
                                    type="number"
                                    className="param-col-offset"
                                    value={group2.offset}
                                    onChange={(e) => updateGroupParam(idx, group2.id, 'offset', e.target.value)}
                                />
                                <input
                                    type="number"
                                    className="param-col-green"
                                    value={group2.durations?.green || 0}
                                    onChange={(e) => updateGroupParam(idx, group2.id, 'green', e.target.value)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default GreenWavePage;
