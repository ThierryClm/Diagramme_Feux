import { useState, useCallback } from 'react';
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
    initialTimes = [0, 15, 30, 45, 60, 75],
    initialCount = 4
}) => {
    // Number of phases to display (2-6)
    const [phaseCount, setPhaseCount] = useState(initialCount);

    // Phase times - use initial times from props
    const [phaseTimes, setPhaseTimes] = useState(initialTimes);

    // Update phase time
    const updatePhaseTime = (index, value) => {
        const newTimes = [...phaseTimes];
        newTimes[index] = Math.max(0, Math.min(cycleLength - 1, parseInt(value) || 0));
        setPhaseTimes(newTimes);
    };

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

    // Calculate position on ellipse for each phase (clockwise from left)
    const getPhasePosition = (index, total) => {
        // Start from left (180° = PI) and go clockwise
        const angleStep = (2 * Math.PI) / total;
        const angle = Math.PI + angleStep * index;

        // Ellipse radii (percentage of container) - reduced by 15%
        const radiusX = 36; // horizontal (was 42)
        const radiusY = 32; // vertical (was 38)

        const x = 50 + radiusX * Math.cos(angle);
        const y = 50 + radiusY * Math.sin(angle);

        return { x, y, angle };
    };

    // Determine label position based on angle (left or right of bubble)
    const getLabelPosition = (angle) => {
        // Normalize angle to 0-2PI
        const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        // If bubble is on the left half (angle between PI/2 and 3PI/2), label goes to the left
        if (normalizedAngle > Math.PI / 2 && normalizedAngle < 3 * Math.PI / 2) {
            return 'left';
        }
        return 'right';
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

    // Base sizes
    const BASE_BUBBLE_WIDTH = 500;
    const BASE_BUBBLE_HEIGHT = 400;
    const BASE_ARROW_SIZE = 64;

    // Calculate scaled sizes
    const scaleFactor = getScaleFactor(phaseCount);
    const bubbleWidth = Math.round(BASE_BUBBLE_WIDTH * scaleFactor);
    const bubbleHeight = Math.round(BASE_BUBBLE_HEIGHT * scaleFactor);
    const arrowSize = Math.round(BASE_ARROW_SIZE * scaleFactor);

    // Render a phase bubble with label outside
    const renderPhaseBubble = (index) => {
        const time = phaseTimes[index];
        const position = getPhasePosition(index, phaseCount);
        const isSideLabel = (courant) => courant === 'Piéton' || courant === 'Cycle';
        const labelPosition = getLabelPosition(position.angle);

        return (
            <div
                key={index}
                className={`phase-bubble label-${labelPosition}`}
                style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`
                }}
            >
                {/* Label section outside the bubble */}
                <div className="phase-bubble-label">
                    <span className="phase-number">Phase {index + 1}</span>
                    <div className="phase-time-control">
                        <span className="phase-time-prefix">t =</span>
                        <input
                            type="number"
                            min="0"
                            max={cycleLength - 1}
                            value={time}
                            onChange={(e) => updatePhaseTime(index, e.target.value)}
                            className="phase-time-input"
                        />
                        <span className="phase-time-unit">s</span>
                    </div>
                </div>
                {/* Image bubble with dynamic size */}
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
                                            className={`phase-arrow-marker ${isSideLabel(groupInfo.courant) ? 'side-label' : ''}`}
                                            style={{
                                                left: `${arrow.x}%`,
                                                top: `${arrow.y}%`
                                            }}
                                        >
                                            <div
                                                className="phase-arrow-symbol"
                                                style={{ transform: `rotate(${rotation}deg)` }}
                                            >
                                                {renderArrowSVG(groupInfo.courant, arrowColor, arrowSize)}
                                            </div>
                                            <span
                                                className="phase-arrow-label"
                                                style={{ fontSize: `${Math.round(12 * scaleFactor)}px` }}
                                            >
                                                GF{arrow.groupId}
                                            </span>
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
                    {intersectionName && (
                        <span className="phasage-plan-name">Plan de feu: {intersectionName}</span>
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
                {/* Ellipse outline */}
                <svg className="ellipse-outline" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <ellipse
                        cx="50"
                        cy="50"
                        rx="36"
                        ry="32"
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                    />
                </svg>

                {/* Phase bubbles positioned around the ellipse */}
                {Array.from({ length: phaseCount }, (_, i) => renderPhaseBubble(i))}

                {/* Connecting lines between phases */}
                <svg className="connecting-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {Array.from({ length: phaseCount }, (_, i) => {
                        const current = getPhasePosition(i, phaseCount);
                        const next = getPhasePosition((i + 1) % phaseCount, phaseCount);
                        return (
                            <line
                                key={i}
                                x1={current.x}
                                y1={current.y}
                                x2={next.x}
                                y2={next.y}
                                stroke="rgba(150,100,200,0.3)"
                                strokeWidth="0.3"
                            />
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};

export default PhasageBulle;
