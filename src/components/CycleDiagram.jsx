import React, { useMemo } from 'react';
import './CycleDiagram.css';

const CycleDiagram = ({ durations, currentPhase, elapsedTime, isPlaying }) => {
    const { red, orange, green } = durations;
    const totalDuration = red + orange + green;

    const getPhaseColor = (phase) => {
        switch (phase) {
            case 'red': return '#e74c3c';
            case 'orange': return '#f1c40f';
            case 'green': return '#2ecc71';
            default: return '#ccc';
        }
    };

    const conicGradient = useMemo(() => {
        if (totalDuration === 0) return 'gray';

        // Cycle order: Green -> Orange -> Red (Standard sequence often)
        // But wait, phase order in hook was Green -> Orange -> Red -> Green?
        // Let's verify hook logic.
        // Hook: cycleOrder = ['green', 'orange', 'red'];
        // Sequence: Green -> Orange -> Red -> Green...

        const greenDeg = (green / totalDuration) * 360;
        const orangeDeg = (orange / totalDuration) * 360;
        const redDeg = (red / totalDuration) * 360;

        // We start at 0deg (top)
        // Green from 0 to greenDeg
        // Orange from greenDeg to greenDeg + orangeDeg
        // Red from greenDeg + orangeDeg to 360

        return `conic-gradient(
      var(--color-green) 0deg ${greenDeg}deg,
      var(--color-orange) ${greenDeg}deg ${greenDeg + orangeDeg}deg,
      var(--color-red) ${greenDeg + orangeDeg}deg 360deg
    )`;
    }, [red, orange, green, totalDuration]);

    // Calculate rotation for the pointer
    const pointerRotation = useMemo(() => {
        if (totalDuration === 0) return 0;

        let baseTime = 0;
        // We match the visual order: Green, then Orange, then Red.
        if (currentPhase === 'orange') {
            baseTime += green;
        } else if (currentPhase === 'red') {
            baseTime += green + orange;
        }

        // Current total elapsed time in the cycle
        const currentTotalTime = baseTime + elapsedTime;
        const rotation = (currentTotalTime / totalDuration) * 360;
        return rotation;
    }, [currentPhase, elapsedTime, green, orange, totalDuration]);

    return (
        <div className="diagram-container">
            <div
                className="cycle-circle"
                style={{ background: conicGradient }}
            >
                <div className="inner-circle">
                    <div className="status-text">
                        <span className="phase-name" style={{ color: `var(--color-${currentPhase})` }}>
                            {currentPhase.toUpperCase()}
                        </span>
                        <span className="timer">
                            {Math.floor(elapsedTime)}s / {durations[currentPhase]}s
                        </span>
                    </div>
                </div>
                <div
                    className="pointer"
                    style={{ transform: `rotate(${pointerRotation}deg)` }}
                >
                    <div className="pointer-dot"></div>
                </div>
            </div>
        </div>
    );
};

export default CycleDiagram;
