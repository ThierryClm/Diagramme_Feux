import { useState, useCallback, useEffect } from 'react';
import './PhasageBulle.css';

const PhasageBulle = ({
    groups,
    cycleLength,
    intersectionImage,
    intersectionArrows,
    simulationResult,
    actionData = [],
    selectedActions = [],
    intersectionName = '',
    planName = '',
    initialTimes = [0, 15, 30, 45, 60, 75],
    initialCount = 4,
    hoveredGroupId = null,
    setHoveredGroupId = () => {}
}) => {
    // Number of phases to display (2-6)
    const [phaseCount, setPhaseCount] = useState(initialCount);

    // Phase times - use initial times from props
    const [phaseTimes, setPhaseTimes] = useState(initialTimes);

    // Sync state when props change (from configuration modal)
    useEffect(() => {
        setPhaseCount(initialCount);
    }, [initialCount]);

    useEffect(() => {
        setPhaseTimes(initialTimes);
    }, [initialTimes]);

    // Get group info for display
    const getGroupInfo = (groupId) => {
        const group = groups.find(g => g.id === groupId);
        return group ? { name: group.name, courant: group.courant || '' } : { name: '?', courant: '' };
    };

    // Check if time is within an action's time range (handles wrap-around)
    const isTimeInRange = (time, start, end, effectiveCycleLength) => {
        const normalizedTime = time % effectiveCycleLength;
        const normalizedStart = parseInt(start);
        const normalizedEnd = parseInt(end);

        if (normalizedEnd > normalizedStart) {
            return normalizedTime >= normalizedStart && normalizedTime < normalizedEnd;
        } else {
            return normalizedTime >= normalizedStart || normalizedTime < normalizedEnd;
        }
    };

    // Get the color for a group at a specific time
    const getGroupColorAtTime = useCallback((groupId, time) => {
        const groupsData = simulationResult?.groups || groups;
        const group = groupsData.find(g => g.id === groupId);

        if (!group) return 'rgb(255, 0, 0)';

        const effectiveCycleLength = simulationResult?.cycleLength || cycleLength;
        const offset = simulationResult ? (group.simulatedOffset ?? group.offset) : group.offset;
        const greenDuration = group.durations?.green || 0;
        const orangeDuration = group.durations?.orange || 0;

        const normalizedTime = time % effectiveCycleLength;

        // Check for "Seconde lucarne" action
        const secondeLucarneAction = actionData.find(action =>
            action.action === 'Seconde lucarne' &&
            action.gf === String(groupId) &&
            action.deb !== '' &&
            action.fin !== '' &&
            selectedActions.includes(action.id)
        );

        // Check for "Priorité piétons" action
        const prioritePietonsAction = actionData.find(action =>
            action.action === 'Priorité piétons' &&
            action.gf === String(groupId) &&
            action.deb !== '' &&
            action.fin !== '' &&
            selectedActions.includes(action.id)
        );

        if (secondeLucarneAction) {
            const inSecondeLucarne = isTimeInRange(
                normalizedTime,
                secondeLucarneAction.deb,
                secondeLucarneAction.fin,
                effectiveCycleLength
            );
            if (inSecondeLucarne) {
                return 'rgb(0, 180, 0)';
            }
        }

        if (prioritePietonsAction) {
            const inPrioritePietons = isTimeInRange(
                normalizedTime,
                prioritePietonsAction.deb,
                prioritePietonsAction.fin,
                effectiveCycleLength
            );
            if (inPrioritePietons) {
                const blink = Math.floor(time * 2) % 2 === 0;
                return blink ? 'rgb(255, 255, 0)' : 'rgb(180, 180, 0)';
            }
        }

        const greenStart = offset;
        const greenEnd = (offset + greenDuration) % effectiveCycleLength;
        const orangeEnd = (offset + greenDuration + orangeDuration) % effectiveCycleLength;

        let isGreen = false;
        if (greenEnd > greenStart) {
            isGreen = normalizedTime >= greenStart && normalizedTime < greenEnd;
        } else if (greenDuration > 0) {
            isGreen = normalizedTime >= greenStart || normalizedTime < greenEnd;
        }

        let isOrange = false;
        if (orangeDuration > 0) {
            if (orangeEnd > greenEnd) {
                isOrange = normalizedTime >= greenEnd && normalizedTime < orangeEnd;
            } else if (orangeEnd < greenEnd) {
                isOrange = normalizedTime >= greenEnd || normalizedTime < orangeEnd;
            }
        }

        if (isGreen) {
            return 'rgb(0, 255, 0)';
        } else if (isOrange) {
            return 'rgb(255, 255, 0)';
        } else {
            return 'rgb(255, 0, 0)';
        }
    }, [groups, simulationResult, cycleLength, actionData, selectedActions]);

    // Render arrow SVG based on courant type
    const renderArrowSVG = (courant, color, size = 24) => {
        const strokeWidth = 2;

        switch (courant) {
            case 'TD':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàD':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d="M8,24 L8,12 Q8,8 12,8 L26,8" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="20,2 26,8 20,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàG':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d="M24,24 L24,12 Q24,8 20,8 L6,8" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="12,2 6,8 12,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TDTàD':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="12" y1="28" x2="12" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="6,14 12,8 18,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12,20 Q20,20 20,12 L20,8" fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="16,12 20,8 24,12" fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TDTàG':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="20" y1="28" x2="20" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="14,14 20,8 26,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20,20 Q12,20 12,12 L12,8" fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="8,12 12,8 16,12" fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'Piéton':
            case 'Cycle':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="20" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="10,12 16,6 22,12" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="16" y1="12" x2="16" y2="26" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="10,20 16,26 22,20" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            default:
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
        }
    };

    // Get ellipse radii and starting angle based on number of phases
    // RadiusX reduced by 30% total for tighter horizontal distribution
    // Phase 1 always starts from left (Math.PI)
    const getEllipseConfig = (count) => {
        switch (count) {
            case 2:
                // Two bubbles: left and right
                return { radiusX: 22, radiusY: 25, startAngle: Math.PI };
            case 3:
                // Triangle: Phase 1 at left
                return { radiusX: 23, radiusY: 30, startAngle: Math.PI };
            case 5:
                // Pentagon: Phase 1 at left
                return { radiusX: 27, radiusY: 34, startAngle: Math.PI };
            case 6:
                // Hexagon: Phase 1 at left
                return { radiusX: 29, radiusY: 36, startAngle: Math.PI };
            default:
                // 4 phases: diamond shape, Phase 1 at left
                return { radiusX: 26, radiusY: 32, startAngle: Math.PI };
        }
    };

    // Calculate position on ellipse for each phase
    const getPhasePosition = (index, total) => {
        const { radiusX, radiusY, startAngle } = getEllipseConfig(total);

        // Calculate angle step and position (clockwise)
        const angleStep = (2 * Math.PI) / total;
        const angle = startAngle + angleStep * index;

        const x = 50 + radiusX * Math.cos(angle);
        const y = 50 + radiusY * Math.sin(angle);

        return { x, y, angle };
    };

    // Get ellipse radii for SVG outline (uses same config)
    const getEllipseRadii = (count) => {
        const config = getEllipseConfig(count);
        return { radiusX: config.radiusX, radiusY: config.radiusY };
    };

    // Get scale factor based on number of phases
    const getScaleFactor = (count) => {
        switch (count) {
            case 2: return 1.2;  // +20%
            case 5: return 0.9;  // -10%
            case 6: return 0.8;  // -20%
            default: return 1.0; // 3-4 phases: normal
        }
    };

    // Base sizes (proportional to image, reduced by 5%)
    const BASE_BUBBLE_WIDTH = 570;
    const BASE_BUBBLE_HEIGHT = 456;

    // Arrow size ratio from IntersectionImage (96px arrow / 500px container = 19.2%)
    const ARROW_SIZE_RATIO = 0.192;

    // Calculate scaled sizes
    const scaleFactor = getScaleFactor(phaseCount);
    const bubbleWidth = Math.round(BASE_BUBBLE_WIDTH * scaleFactor);
    const bubbleHeight = Math.round(BASE_BUBBLE_HEIGHT * scaleFactor);
    // Arrow size proportional to bubble height (same ratio as IntersectionImage)
    const arrowSize = Math.round(bubbleHeight * ARROW_SIZE_RATIO);

    // Render a phase bubble with label positioned based on vertical position
    const renderPhaseBubble = (index) => {
        const time = phaseTimes[index];
        const position = getPhasePosition(index, phaseCount);
        const isSideLabel = (courant) => courant === 'Piéton' || courant === 'Cycle';
        // Phase 1 always has label at top-left, others based on vertical position
        const isLabelTopLeft = index === 0 || position.y < 50;

        return (
            <div
                key={index}
                className="phase-bubble"
                style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`
                }}
            >
                {/* Label positioned based on bubble vertical position (Phase 1 always top-left) */}
                <div className={`phase-bubble-label ${isLabelTopLeft ? 'label-top-left' : 'label-bottom-right'}`}>
                    <span className="phase-number">Phase {index + 1}</span>
                    <span className="phase-time-display">Seconde {time}</span>
                </div>
                {/* Image bubble */}
                <div className="phase-bubble-content">
                    <div
                        className="phase-bubble-image"
                        style={{
                            width: `${bubbleWidth}px`,
                            height: `${bubbleHeight}px`
                        }}
                    >
                        {intersectionImage ? (
                            <div className="phase-image-wrapper">
                                <img src={intersectionImage} alt="" className="phase-img" />
                                {intersectionArrows.map(arrow => {
                                    const groupInfo = getGroupInfo(arrow.groupId);
                                    const rotation = arrow.rotation || 0;
                                    const arrowColor = getGroupColorAtTime(arrow.groupId, time);

                                    return (
                                        <div
                                            key={arrow.id}
                                            className={`phase-arrow-marker ${isSideLabel(groupInfo.courant) ? 'side-label' : ''} ${hoveredGroupId === arrow.groupId ? 'hovered' : ''}`}
                                            style={{
                                                left: `${arrow.x}%`,
                                                top: `${arrow.y}%`
                                            }}
                                            onMouseEnter={() => setHoveredGroupId(arrow.groupId)}
                                            onMouseLeave={() => setHoveredGroupId(null)}
                                        >
                                            <div
                                                className="phase-arrow-symbol"
                                                style={{ transform: `rotate(${rotation}deg)` }}
                                            >
                                                {renderArrowSVG(groupInfo.courant, arrowColor, arrowSize)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="phase-no-image">?</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="phasage-bulle-container">
            <div className="phasage-bulle-header">
                <div className="phasage-title-section">
                    <h3>Phasage bulle</h3>
                    {(planName || intersectionName) && (
                        <span className="phasage-plan-name">
                            {planName && intersectionName
                                ? `${planName} - ${intersectionName}`
                                : planName || intersectionName}
                        </span>
                    )}
                </div>
                <div className="phasage-controls">
                    <label className="phase-count-label">
                        Nombre de phases:
                        <select
                            value={phaseCount}
                            onChange={(e) => setPhaseCount(parseInt(e.target.value))}
                            className="phase-count-select"
                        >
                            {[2, 3, 4, 5, 6].map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </label>
                    <span className="phasage-info">Cycle: {cycleLength}s</span>
                </div>
            </div>

            <div className="phasage-circular-container">
                {/* Ellipse outline - uses dynamic radii based on phase count */}
                <svg className="ellipse-outline" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <ellipse
                        cx="50"
                        cy="50"
                        rx={getEllipseRadii(phaseCount).radiusX}
                        ry={getEllipseRadii(phaseCount).radiusY}
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                    />
                </svg>

                {/* Phase bubbles positioned around the ellipse */}
                {Array.from({ length: phaseCount }, (_, i) => renderPhaseBubble(i))}

                {/* Curved arrows between phases (clockwise, on outer periphery) */}
                <svg className="connecting-arrows" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="4"
                            markerHeight="3"
                            refX="3"
                            refY="1.5"
                            orient="auto"
                            markerUnits="strokeWidth"
                        >
                            <polygon
                                points="0,0 4,1.5 0,3"
                                fill="rgba(180,140,255,0.7)"
                            />
                        </marker>
                    </defs>
                    {Array.from({ length: phaseCount }, (_, i) => {
                        const { radiusX, radiusY, startAngle } = getEllipseConfig(phaseCount);
                        const angleStep = (2 * Math.PI) / phaseCount;

                        // Current and next angles
                        const angle1 = startAngle + angleStep * i;
                        const angle2 = startAngle + angleStep * (i + 1);

                        // Outer radius offset for the arrow path (further from center)
                        const outerOffset = 14;
                        const outerRadiusX = radiusX + outerOffset;
                        const outerRadiusY = radiusY + outerOffset;

                        // Start and end points on outer ellipse (with larger gap for shorter arrows)
                        const gapAngle = 0.55; // Larger gap = shorter arrows
                        const startAngleAdjusted = angle1 + gapAngle;
                        const endAngleAdjusted = angle2 - gapAngle;

                        const x1 = 50 + outerRadiusX * Math.cos(startAngleAdjusted);
                        const y1 = 50 + outerRadiusY * Math.sin(startAngleAdjusted);
                        const x2 = 50 + outerRadiusX * Math.cos(endAngleAdjusted);
                        const y2 = 50 + outerRadiusY * Math.sin(endAngleAdjusted);

                        // SVG arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
                        // sweep-flag=1 for clockwise
                        const largeArc = (endAngleAdjusted - startAngleAdjusted) > Math.PI ? 1 : 0;

                        return (
                            <path
                                key={i}
                                d={`M ${x1} ${y1} A ${outerRadiusX} ${outerRadiusY} 0 ${largeArc} 1 ${x2} ${y2}`}
                                fill="none"
                                stroke="rgba(180,140,255,0.7)"
                                strokeWidth="0.8"
                                markerEnd="url(#arrowhead)"
                            />
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};

export default PhasageBulle;
