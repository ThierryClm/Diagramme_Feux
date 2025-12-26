import { useState, useEffect, useCallback, useMemo } from 'react';

const DEFAULT_CYCLE = 100;

export const useTrafficLight = () => {
    const [intersectionName, setIntersectionName] = useState("Nouveau Carrefour");
    const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE);
    const [globalTime, setGlobalTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Groups State
    const createGroup = (id) => ({
        id,
        name: `Groupe ${id}`, // Default name
        type: 'VL', // VL, TC, Cycliste, Piéton
        minGreen: 5,
        durations: { green: 30, orange: 3, red: 67 }, // Default orange is now 3s? Or 5s? Standard is usually 3s for VL.
        offset: (id - 1) * 5,
        // Traffic Engineering Props
        trafficStream: '', // Courant de circulation
        laneCoef: 1, // Coef voie
        trafficVol: 0, // Trafic
        effectiveGreen: 0, // Vert utile
        usedCapacity: 0, // Capacité utilisée
        delay: 0, // Retard
        queueLength: 0, // Ile d'attente
    });

    const [groups, setGroups] = useState(() =>
        Array.from({ length: 5 }, (_, i) => createGroup(i + 1))
    );

    // Matrix: Size depends on number of groups.
    // We store as a URL-like generic object or always resize.
    // Let's keep it as 2D array, resizing when groups change.
    const [conflictMatrix, setConflictMatrix] = useState(() =>
        Array.from({ length: 5 }, () => Array(5).fill(0))
    );

    const setGroupCount = (count) => {
        const newCount = Math.max(1, parseInt(count) || 1);
        setGroups(prev => {
            if (newCount > prev.length) {
                // Add groups
                const added = Array.from({ length: newCount - prev.length }, (_, i) => createGroup(prev.length + i + 1));
                return [...prev, ...added];
            } else {
                // Remove groups
                return prev.slice(0, newCount);
            }
        });

        setConflictMatrix(prev => {
            const currentSize = prev.length;
            if (newCount === currentSize) return prev;

            // Resize matrix
            const newMatrix = Array.from({ length: newCount }, (_, r) => {
                const row = new Array(newCount).fill(0);
                // Copy existing values
                for (let c = 0; c < newCount; c++) {
                    if (r < currentSize && c < currentSize) {
                        row[c] = prev[r][c];
                    }
                }
                return row;
            });
            return newMatrix;
        });
    };

    // Swap Logic
    const moveGroup = (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === groups.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // 1. Swap Groups Steps
        setGroups(currentGroups => {
            const newGroups = [...currentGroups];
            // Swap standard array swap
            const temp = newGroups[index];
            newGroups[index] = newGroups[targetIndex];
            newGroups[targetIndex] = temp;

            // Re-assign IDs to match position? 
            // The previous logic tried to preserve ID but swap data. 
            // Actually, for a list of items, we usually just want to re-order the items.
            // Items carry their ID. Re-assigning ID based on position is optional but clean for "Group 1", "Group 2".
            // Let's just swap the items. If Group 5 moves up, it remains "Group 5" (ID=5) but is now at index 3.
            // But verify: user wants to "intervertir", usually implied re-ordering the sequence.

            return newGroups;
        });

        setConflictMatrix(currentMatrix => {
            if (!currentMatrix || currentMatrix.length === 0) return currentMatrix;

            // Update Matrix: Swap Row index and Row targetIndex
            // And Swap Col index and Col targetIndex
            const newMatrix = currentMatrix.map(row => [...row]);

            // Swap Rows
            const tempRow = newMatrix[index];
            newMatrix[index] = newMatrix[targetIndex];
            newMatrix[targetIndex] = tempRow;

            // Swap Cols
            for (let r = 0; r < newMatrix.length; r++) {
                const row = newMatrix[r];
                const tempVal = row[index];
                row[index] = row[targetIndex];
                row[targetIndex] = tempVal;
            }
            return newMatrix;
        });
    };

    // Computed Conflicts
    const conflicts = useMemo(() => {
        const list = [];
        const count = groups.length;
        for (let from = 0; from < count; from++) {
            for (let to = 0; to < count; to++) {
                const minGap = conflictMatrix[from][to];
                if (minGap > 0 && from !== to) {
                    const gFrom = groups[from];
                    const gTo = groups[to];

                    const endGreenA_Absolute = (gFrom.offset + gFrom.durations.green) % cycleLength;
                    const startGreenB_Absolute = gTo.offset % cycleLength;

                    let distance = (startGreenB_Absolute - endGreenA_Absolute + cycleLength) % cycleLength;

                    if (distance < minGap) {
                        list.push({
                            from: gFrom.id,
                            to: gTo.id,
                            required: minGap,
                            actual: distance
                        });
                    }
                }
            }
        }
        return list;
    }, [groups, conflictMatrix, cycleLength]);

    const updateGroupParams = (id, params) => {
        setGroups(prev => prev.map(g => {
            if (g.id !== id) return g;

            // Handle nested durations update specifically if needed, or spread top level
            // params can contain { type, minGreen, durations: { ... }, offset }

            let newG = { ...g, ...params };

            // If durations or cycle changed, recalc Red
            if (params.durations || params.offset !== undefined) {
                // Merge durations carefully
                const mergedDurations = { ...g.durations, ...(params.durations || {}) };

                const currentGreen = mergedDurations.green;
                const currentOrange = mergedDurations.orange;

                const newRed = Math.max(0, cycleLength - currentGreen - currentOrange);

                newG.durations = {
                    green: currentGreen,
                    orange: currentOrange,
                    red: newRed
                };
            }
            return newG;
        }));
    };

    const setMatrixValue = (fromId, toId, value) => {
        setConflictMatrix(prev => {
            const next = prev.map(row => [...row]);
            // Guard against out of bounds if resizing happened async
            if (next[fromId - 1]) {
                next[fromId - 1][toId - 1] = parseInt(value) || 0;
            }
            return next;
        });
    };

    const getGroupState = useCallback((group, time) => {
        const { durations, offset } = group;
        const totalDuration = cycleLength;
        const cycleTime = (time + offset) % totalDuration;

        if (cycleTime < durations.green) {
            return { currentPhase: 'green' };
        } else if (cycleTime < durations.green + durations.orange) {
            return { currentPhase: 'orange' };
        } else {
            return { currentPhase: 'red' };
        }
    }, [cycleLength]);

    useEffect(() => {
        let intervalId;
        if (isPlaying) {
            const step = 50;
            intervalId = setInterval(() => {
                setGlobalTime(prev => prev + (step / 1000));
            }, step);
        }
        return () => clearInterval(intervalId);
    }, [isPlaying]);

    const reset = () => {
        setIsPlaying(false);
        setGlobalTime(0);
    };

    return {
        intersectionName,
        setIntersectionName,
        groups,
        setGroupCount,
        cycleLength,
        setCycleLength,
        conflictMatrix,
        setMatrixValue,
        conflicts,
        globalTime,
        isPlaying,
        setIsPlaying,
        reset,
        updateGroupParams,
        getGroupState
    };
};
