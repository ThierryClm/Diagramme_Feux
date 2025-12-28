import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const DEFAULT_CYCLE = 100;
const MAX_HISTORY_SIZE = 50;

export const useTrafficLight = () => {
    const [intersectionName, setIntersectionName] = useState(() => localStorage.getItem('trafficName') || "Nouveau Carrefour");
    const [cycleLength, setCycleLength] = useState(() => parseInt(localStorage.getItem('trafficCycle')) || DEFAULT_CYCLE);
    const [globalTime, setGlobalTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // History for undo functionality
    const [history, setHistory] = useState([]);
    const isUndoing = useRef(false);
    const isDragging = useRef(false);

    // Groups State
    const createGroup = (id) => ({
        id,
        name: `Groupe ${id}`, // Default name
        type: 'VL', // VL, TC, Cycliste, Piéton
        minGreen: 6,
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

    const [groups, setGroups] = useState(() => {
        try {
            const saved = localStorage.getItem('trafficGroups');
            return saved ? JSON.parse(saved) : Array.from({ length: 5 }, (_, i) => createGroup(i + 1));
        } catch (e) {
            return Array.from({ length: 5 }, (_, i) => createGroup(i + 1));
        }
    });

    // Matrix: Size depends on number of groups.
    // We store as a URL-like generic object or always resize.
    // Let's keep it as 2D array, resizing when groups change.
    const [conflictMatrix, setConflictMatrix] = useState(() => {
        try {
            const saved = localStorage.getItem('trafficMatrix');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Clean 0 values and values outside 3-20 range
                return parsed.map(row => row.map(val => {
                    if (val === 0 || val === '0') return '';
                    if (typeof val === 'number' && (val < 3 || val > 20)) return '';
                    return val;
                }));
            }
            return Array.from({ length: 5 }, () => Array(5).fill(''));
        } catch (e) {
            return Array.from({ length: 5 }, () => Array(5).fill(''));
        }
    });

    // Auto-save Effect
    useEffect(() => {
        localStorage.setItem('trafficGroups', JSON.stringify(groups));
        localStorage.setItem('trafficMatrix', JSON.stringify(conflictMatrix));
        localStorage.setItem('trafficName', intersectionName);
        localStorage.setItem('trafficCycle', cycleLength.toString());
    }, [groups, conflictMatrix, intersectionName, cycleLength]);

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
                const row = new Array(newCount).fill('');
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
                // Skip empty values, but consider 0 as valid
                if ((minGap === '' || minGap === undefined || minGap === null) || from === to) continue;

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
                // Keep empty string if value is empty, otherwise parse as integer
                const parsedValue = value === '' ? '' : parseInt(value);
                next[fromId - 1][toId - 1] = isNaN(parsedValue) ? '' : parsedValue;
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

    // Save/Load Logic
    const saveProject = (name) => {
        if (!name) return;
        const projectData = {
            intersectionName,
            groups,
            cycleLength,
            conflictMatrix
        };
        try {
            localStorage.setItem(`traffic_project_${name}`, JSON.stringify(projectData));
            return true;
        } catch (e) {
            console.error("Save failed", e);
            return false;
        }
    };

    const loadProject = (name) => {
        try {
            const raw = localStorage.getItem(`traffic_project_${name}`);
            if (!raw) return false;
            const data = JSON.parse(raw);

            // Batch updates
            if (data.intersectionName) setIntersectionName(data.intersectionName);
            if (data.groups) setGroups(data.groups);
            if (data.cycleLength) setCycleLength(data.cycleLength);
            if (data.conflictMatrix) {
                // Clean 0 values and values outside 3-20 range
                const cleanedMatrix = data.conflictMatrix.map(row => row.map(val => {
                    if (val === 0 || val === '0') return '';
                    if (typeof val === 'number' && (val < 3 || val > 20)) return '';
                    return val;
                }));
                setConflictMatrix(cleanedMatrix);
            }

            return true;
        } catch (e) {
            console.error("Load failed", e);
            return false;
        }
    };

    const getAllSaves = () => {
        const saves = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('traffic_project_')) {
                saves.push(key.replace('traffic_project_', ''));
            }
        }
        return saves;
    };

    const deleteSave = (name) => {
        localStorage.removeItem(`traffic_project_${name}`);
    };

    // Action Table State
    const createEmptyActionRow = (id) => ({
        id,
        gf: '',
        action: '',
        description: '',
        deb: '',
        fin: '',
        abrv: '',
        micro: '',
        plage1: '',
        plage2: '',
        actGf1: '',
        actGf1Gf2: '',
        actGf1Gf3: '',
        actGf1Gf4: ''
    });

    const [actionData, setActionData] = useState(() => {
        try {
            const saved = localStorage.getItem('trafficActionData');
            return saved ? JSON.parse(saved) : Array.from({ length: 30 }, (_, i) => createEmptyActionRow(i + 1));
        } catch (e) {
            return Array.from({ length: 30 }, (_, i) => createEmptyActionRow(i + 1));
        }
    });

    // Save actionData to localStorage
    useEffect(() => {
        localStorage.setItem('trafficActionData', JSON.stringify(actionData));
    }, [actionData]);

    // Save current state to history (for undo)
    const saveToHistory = useCallback(() => {
        if (isUndoing.current) return; // Don't save during undo

        const currentState = {
            groups: JSON.parse(JSON.stringify(groups)),
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            actionData: JSON.parse(JSON.stringify(actionData)),
            cycleLength,
            intersectionName
        };

        setHistory(prev => {
            const newHistory = [...prev, currentState];
            // Limit history size
            if (newHistory.length > MAX_HISTORY_SIZE) {
                return newHistory.slice(-MAX_HISTORY_SIZE);
            }
            return newHistory;
        });
    }, [groups, conflictMatrix, actionData, cycleLength, intersectionName]);

    // Start drag - save history once at the beginning
    const startDrag = useCallback(() => {
        if (!isDragging.current) {
            saveToHistory();
            isDragging.current = true;
        }
    }, [saveToHistory]);

    // End drag
    const endDrag = useCallback(() => {
        isDragging.current = false;
    }, []);

    // Undo function
    const undo = useCallback(() => {
        if (history.length === 0) return false;

        isUndoing.current = true;

        const previousState = history[history.length - 1];

        // Restore previous state
        setGroups(previousState.groups);
        setConflictMatrix(previousState.conflictMatrix);
        setActionData(previousState.actionData);
        setCycleLength(previousState.cycleLength);
        setIntersectionName(previousState.intersectionName);

        // Remove the last history entry
        setHistory(prev => prev.slice(0, -1));

        // Reset the flag after a short delay
        setTimeout(() => {
            isUndoing.current = false;
        }, 100);

        return true;
    }, [history]);

    // Wrapped update functions that save to history (skip if dragging)
    const updateActionRowWithHistory = useCallback((rowId, field, value) => {
        if (!isDragging.current) {
            saveToHistory();
        }
        setActionData(prev => prev.map(row =>
            row.id === rowId ? { ...row, [field]: value } : row
        ));
    }, [saveToHistory]);

    const updateGroupParamsWithHistory = useCallback((id, params) => {
        if (!isDragging.current) {
            saveToHistory();
        }
        setGroups(prev => prev.map(g => {
            if (g.id !== id) return g;

            let newG = { ...g, ...params };

            if (params.durations || params.offset !== undefined) {
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
    }, [saveToHistory, cycleLength]);

    const setMatrixValueWithHistory = useCallback((fromId, toId, value) => {
        if (!isDragging.current) {
            saveToHistory();
        }
        setConflictMatrix(prev => {
            const next = prev.map(row => [...row]);
            if (next[fromId - 1]) {
                // Empty value is allowed
                if (value === '') {
                    next[fromId - 1][toId - 1] = '';
                } else {
                    const parsedValue = parseInt(value);
                    // Only allow values between 3 and 20
                    if (!isNaN(parsedValue) && parsedValue >= 3 && parsedValue <= 20) {
                        next[fromId - 1][toId - 1] = parsedValue;
                    } else if (!isNaN(parsedValue) && parsedValue < 3) {
                        // If value is less than 3, set to empty
                        next[fromId - 1][toId - 1] = '';
                    } else if (!isNaN(parsedValue) && parsedValue > 20) {
                        // If value is greater than 20, cap at 20
                        next[fromId - 1][toId - 1] = 20;
                    }
                }
            }
            return next;
        });
    }, [saveToHistory]);

    return {
        intersectionName,
        setIntersectionName,
        groups,
        setGroupCount,
        cycleLength,
        setCycleLength,
        conflictMatrix,
        setMatrixValue: setMatrixValueWithHistory,
        conflicts,
        globalTime,
        isPlaying,
        setIsPlaying,
        reset,
        updateGroupParams: updateGroupParamsWithHistory,
        getGroupState,
        moveGroup,
        // Save/Load
        saveProject,
        loadProject,
        getAllSaves,
        deleteSave,
        // Action Table
        actionData,
        updateActionRow: updateActionRowWithHistory,
        // Undo
        undo,
        canUndo: history.length > 0,
        // Drag helpers (for saving history only once per drag)
        startDrag,
        endDrag
    };
};
