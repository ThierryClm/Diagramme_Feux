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
        da: '', // DA field (2 characters)
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

    // Swap group data and matrix, but keep GF IDs in place (G1 stays G1, G2 stays G2)
    const moveGroup = (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === groups.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // GF numbers are 1-based (index + 1)
        const gfA = index + 1;
        const gfB = targetIndex + 1;

        // 1. Swap group DATA (but keep IDs in place)
        setGroups(currentGroups => {
            const newGroups = [...currentGroups];
            const groupA = newGroups[index];
            const groupB = newGroups[targetIndex];

            // Swap all properties except ID
            newGroups[index] = {
                ...groupB,
                id: groupA.id  // Keep original ID
            };
            newGroups[targetIndex] = {
                ...groupA,
                id: groupB.id  // Keep original ID
            };

            return newGroups;
        });

        // 2. Swap matrix rows and columns
        setConflictMatrix(currentMatrix => {
            if (!currentMatrix || currentMatrix.length === 0) return currentMatrix;

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

        // 3. Swap GF references in ActionTable
        const gfFields = ['gf', 'plage1', 'plage2', 'actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'];

        setActionData(currentData => {
            return currentData.map(row => {
                const newRow = { ...row };
                gfFields.forEach(field => {
                    const val = parseInt(newRow[field]);
                    if (val === gfA) {
                        newRow[field] = gfB.toString();
                    } else if (val === gfB) {
                        newRow[field] = gfA.toString();
                    }
                });
                return newRow;
            });
        });
    };

    // Helper: Check if two time ranges overlap in cyclic time
    const rangesOverlap = (start1, end1, start2, end2, cycle) => {
        // Normalize to cycle
        start1 = ((start1 % cycle) + cycle) % cycle;
        end1 = ((end1 % cycle) + cycle) % cycle;
        start2 = ((start2 % cycle) + cycle) % cycle;
        end2 = ((end2 % cycle) + cycle) % cycle;

        // Handle wrap-around cases
        const range1Wraps = end1 <= start1;
        const range2Wraps = end2 <= start2;

        if (!range1Wraps && !range2Wraps) {
            // Neither wraps: simple overlap check
            return start1 < end2 && start2 < end1;
        } else if (range1Wraps && !range2Wraps) {
            // Range 1 wraps: [start1, cycle) and [0, end1)
            return (start2 < end1) || (start2 >= start1);
        } else if (!range1Wraps && range2Wraps) {
            // Range 2 wraps
            return (start1 < end2) || (start1 >= start2);
        } else {
            // Both wrap: they definitely overlap
            return true;
        }
    };

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
            conflictMatrix,
            pfTabs,
            activePFId
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

            // Batch updates - use project name as intersection name
            setIntersectionName(name);
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
            // Load action table data (pfTabs)
            if (data.pfTabs) {
                setPfTabs(data.pfTabs);
                if (data.activePFId) setActivePFId(data.activePFId);
            } else if (data.actionData) {
                // Handle old format for backward compatibility
                setPfTabs([{ id: 1, name: 'PF1', data: data.actionData }]);
                setActivePFId(1);
            }

            // Move project to top of the order list
            updateProjectOrder(name);

            return true;
        } catch (e) {
            console.error("Load failed", e);
            return false;
        }
    };

    // Update project order - move project to top
    const updateProjectOrder = (name) => {
        try {
            const orderRaw = localStorage.getItem('traffic_project_order');
            let order = orderRaw ? JSON.parse(orderRaw) : [];
            // Remove if already exists
            order = order.filter(n => n !== name);
            // Add to top
            order.unshift(name);
            localStorage.setItem('traffic_project_order', JSON.stringify(order));
        } catch (e) {
            console.error("Update order failed", e);
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

        // Sort by order (most recently loaded first)
        try {
            const orderRaw = localStorage.getItem('traffic_project_order');
            if (orderRaw) {
                const order = JSON.parse(orderRaw);
                saves.sort((a, b) => {
                    const indexA = order.indexOf(a);
                    const indexB = order.indexOf(b);
                    // Projects not in order list go to the end
                    if (indexA === -1 && indexB === -1) return 0;
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });
            }
        } catch (e) {
            console.error("Sort order failed", e);
        }

        return saves;
    };

    // Get project data without applying to state (for green wave)
    const getProjectData = (name) => {
        try {
            const raw = localStorage.getItem(`traffic_project_${name}`);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.error("Get project data failed", e);
            return null;
        }
    };

    // Load full state (for duplication)
    const loadFullState = (state) => {
        try {
            if (state.intersectionName) setIntersectionName(state.intersectionName);
            if (state.groups) setGroups(state.groups);
            if (state.cycleLength) setCycleLength(state.cycleLength);
            if (state.conflictMatrix) {
                const cleanedMatrix = state.conflictMatrix.map(row => row.map(val => {
                    if (val === 0 || val === '0') return '';
                    if (typeof val === 'number' && (val < 3 || val > 20)) return '';
                    return val;
                }));
                setConflictMatrix(cleanedMatrix);
            }
            // Handle new pfTabs format or old actionData format
            if (state.pfTabs) {
                setPfTabs(state.pfTabs);
                if (state.activePFId) setActivePFId(state.activePFId);
            } else if (state.actionData) {
                setPfTabs([{ id: 1, name: 'PF1', data: state.actionData }]);
                setActivePFId(1);
            }
            return true;
        } catch (e) {
            console.error("Load full state failed", e);
            return false;
        }
    };

    // Get full state (for duplication)
    const getFullState = () => ({
        intersectionName,
        groups,
        cycleLength,
        conflictMatrix,
        pfTabs,
        activePFId
    });

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

    const createEmptyActionData = () => Array.from({ length: 30 }, (_, i) => createEmptyActionRow(i + 1));

    // Multiple PF (Plans de Feux) support
    const [pfTabs, setPfTabs] = useState(() => {
        try {
            const saved = localStorage.getItem('trafficPfTabs');
            if (saved) {
                return JSON.parse(saved);
            }
            // Migrate from old single actionData format
            const oldData = localStorage.getItem('trafficActionData');
            if (oldData) {
                return [{ id: 1, name: 'PF1', data: JSON.parse(oldData) }];
            }
            return [{ id: 1, name: 'PF1', data: createEmptyActionData() }];
        } catch (e) {
            return [{ id: 1, name: 'PF1', data: createEmptyActionData() }];
        }
    });

    const [activePFId, setActivePFId] = useState(() => {
        try {
            const saved = localStorage.getItem('trafficActivePF');
            return saved ? parseInt(saved) : 1;
        } catch (e) {
            return 1;
        }
    });

    // Get current actionData based on active PF
    const actionData = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF ? activePF.data : createEmptyActionData();
    }, [pfTabs, activePFId]);

    // Computed Conflicts
    const conflicts = useMemo(() => {
        const list = [];
        const count = groups.length;

        // Get seconde lucarne actions from current actionData
        const secondeLucarnes = actionData.filter(action =>
            action.action === 'Seconde lucarne' &&
            action.gf !== '' &&
            action.deb !== '' &&
            action.fin !== ''
        ).map(action => ({
            gf: parseInt(action.gf),
            deb: parseInt(action.deb),
            fin: parseInt(action.fin),
            abrv: action.abrv || 'SL'
        }));

        // Get escamotage actions (both types) to check for managed overlaps
        const escamotages = actionData.filter(action =>
            (action.action === 'Escamotage' || action.action === 'Escamotage de phase') &&
            action.gf !== '' &&
            action.actGf1 !== ''
        ).map(action => ({
            sourceGf: parseInt(action.gf),
            targetGf: parseInt(action.actGf1)
        }));

        // Helper to check if an escamotage exists between two groups
        const hasEscamotage = (gfA, gfB) => {
            return escamotages.some(e =>
                (e.sourceGf === gfA && e.targetGf === gfB) ||
                (e.sourceGf === gfB && e.targetGf === gfA)
            );
        };

        // Check intergreen time conflicts (existing logic)
        for (let from = 0; from < count; from++) {
            for (let to = 0; to < count; to++) {
                const minGap = conflictMatrix[from][to];
                // Skip empty values
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
                        actual: distance,
                        type: 'intergreen'
                    });
                }

                // Check for actual overlap between antagonist groups
                const startA = gFrom.offset;
                const endA = gFrom.offset + gFrom.durations.green;
                const startB = gTo.offset;
                const endB = gTo.offset + gTo.durations.green;

                if (rangesOverlap(startA, endA, startB, endB, cycleLength)) {
                    // Skip if there's an escamotage between these groups (overlap is managed)
                    if (hasEscamotage(gFrom.id, gTo.id)) {
                        continue;
                    }
                    // Only add if not already a more severe intergreen conflict
                    const existingConflict = list.find(c =>
                        c.from === gFrom.id && c.to === gTo.id && c.type === 'intergreen'
                    );
                    if (!existingConflict) {
                        list.push({
                            from: gFrom.id,
                            to: gTo.id,
                            type: 'overlap',
                            message: 'Chevauchement des phases vertes'
                        });
                    }
                }

                // Check seconde lucarne overlaps with antagonist green phases
                secondeLucarnes.forEach(sl => {
                    if (sl.gf === gFrom.id) {
                        // Check SL of gFrom against green of gTo
                        if (rangesOverlap(sl.deb, sl.fin, startB, endB, cycleLength)) {
                            list.push({
                                from: gFrom.id,
                                to: gTo.id,
                                type: 'sl-overlap',
                                message: `Seconde lucarne chevauche vert`
                            });
                        }
                    }
                    if (sl.gf === gTo.id) {
                        // Check SL of gTo against green of gFrom
                        if (rangesOverlap(sl.deb, sl.fin, startA, endA, cycleLength)) {
                            list.push({
                                from: gTo.id,
                                to: gFrom.id,
                                type: 'sl-overlap',
                                message: `Seconde lucarne chevauche vert`
                            });
                        }
                    }
                });
            }
        }

        // Check seconde lucarne overlaps between themselves for antagonist groups
        for (let i = 0; i < secondeLucarnes.length; i++) {
            for (let j = i + 1; j < secondeLucarnes.length; j++) {
                const sl1 = secondeLucarnes[i];
                const sl2 = secondeLucarnes[j];

                // Check if these groups are antagonists
                const idx1 = sl1.gf - 1;
                const idx2 = sl2.gf - 1;
                if (idx1 >= 0 && idx2 >= 0 && idx1 < count && idx2 < count) {
                    const areAntagonists = conflictMatrix[idx1][idx2] !== '' || conflictMatrix[idx2][idx1] !== '';
                    if (areAntagonists && rangesOverlap(sl1.deb, sl1.fin, sl2.deb, sl2.fin, cycleLength)) {
                        list.push({
                            from: sl1.gf,
                            to: sl2.gf,
                            type: 'sl-sl-overlap',
                            message: `Chevauchement des secondes lucarnes`
                        });
                    }
                }
            }
        }

        return list;
    }, [groups, conflictMatrix, cycleLength, actionData]);

    // Update action data for active PF
    const setActionData = useCallback((newData) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, data: typeof newData === 'function' ? newData(pf.data) : newData }
                : pf
        ));
    }, [activePFId]);

    // Duplicate current PF
    const duplicatePF = useCallback(() => {
        const nextId = Math.max(...pfTabs.map(pf => pf.id)) + 1;
        const newName = `PF${nextId}`;
        const currentData = JSON.parse(JSON.stringify(actionData));
        setPfTabs(prev => [...prev, { id: nextId, name: newName, data: currentData }]);
        setActivePFId(nextId);
        return nextId;
    }, [pfTabs, actionData]);

    // Delete a PF (cannot delete if only one remains)
    const deletePF = useCallback((pfId) => {
        if (pfTabs.length <= 1) return false;
        setPfTabs(prev => prev.filter(pf => pf.id !== pfId));
        if (activePFId === pfId) {
            const remaining = pfTabs.filter(pf => pf.id !== pfId);
            setActivePFId(remaining[0].id);
        }
        return true;
    }, [pfTabs, activePFId]);

    // Rename a PF
    const renamePF = useCallback((pfId, newName) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === pfId ? { ...pf, name: newName } : pf
        ));
    }, []);

    // Save pfTabs to localStorage
    useEffect(() => {
        localStorage.setItem('trafficPfTabs', JSON.stringify(pfTabs));
        localStorage.setItem('trafficActivePF', activePFId.toString());
    }, [pfTabs, activePFId]);

    // Save current state to history (for undo)
    const saveToHistory = useCallback(() => {
        if (isUndoing.current) return; // Don't save during undo

        const currentState = {
            groups: JSON.parse(JSON.stringify(groups)),
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            pfTabs: JSON.parse(JSON.stringify(pfTabs)),
            activePFId,
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
    }, [groups, conflictMatrix, pfTabs, activePFId, cycleLength, intersectionName]);

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
        if (previousState.pfTabs) {
            setPfTabs(previousState.pfTabs);
            setActivePFId(previousState.activePFId);
        } else if (previousState.actionData) {
            // Handle old history format
            setPfTabs(prev => prev.map(pf =>
                pf.id === activePFId ? { ...pf, data: previousState.actionData } : pf
            ));
        }
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

        // If offset or duration is changing, calculate delta to update linked bande passante actions
        // Skip this during dragging - TimelineDiagram handles it directly with stored initial values to avoid drift
        if (!isDragging.current) {
            const currentGroup = groups.find(g => g.id === id);
            if (currentGroup) {
                // Calculate old and new end of green
                const oldOffset = currentGroup.offset;
                const oldGreen = currentGroup.durations.green;
                const oldEnd = (oldOffset + oldGreen) % cycleLength;

                const newOffset = params.offset !== undefined ? params.offset : oldOffset;
                const newGreen = params.durations?.green !== undefined ? params.durations.green : oldGreen;
                const newEnd = (newOffset + newGreen) % cycleLength;

                const deltaOffset = newOffset - oldOffset;
                const deltaEnd = ((newEnd - oldEnd) % cycleLength + cycleLength) % cycleLength;
                // Normalize deltaEnd to handle wrap-around correctly
                const normalizedDeltaEnd = deltaEnd > cycleLength / 2 ? deltaEnd - cycleLength : deltaEnd;

                setActionData(currentData => {
                    return currentData.map(row => {
                        const rowGf = parseInt(row.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                        if (rowGf !== id) return row;

                        // "Début de bande passante" is linked to START of green (offset)
                        if (row.action === 'Début de bande passante' && row.deb !== '' && deltaOffset !== 0) {
                            const newDeb = ((parseInt(row.deb) + deltaOffset) % cycleLength + cycleLength) % cycleLength;
                            if (row.fin !== '') {
                                const newFin = ((parseInt(row.fin) + deltaOffset) % cycleLength + cycleLength) % cycleLength;
                                return { ...row, deb: newDeb.toString(), fin: newFin.toString() };
                            }
                            return { ...row, deb: newDeb.toString() };
                        }

                        // "Fin de bande passante" is linked to END of green (offset + green duration)
                        if (row.action === 'Fin de bande passante' && row.deb !== '' && normalizedDeltaEnd !== 0) {
                            const newDeb = ((parseInt(row.deb) + normalizedDeltaEnd) % cycleLength + cycleLength) % cycleLength;
                            if (row.fin !== '') {
                                const newFin = ((parseInt(row.fin) + normalizedDeltaEnd) % cycleLength + cycleLength) % cycleLength;
                                return { ...row, deb: newDeb.toString(), fin: newFin.toString() };
                            }
                            return { ...row, deb: newDeb.toString() };
                        }

                        return row;
                    });
                });
            }
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
    }, [saveToHistory, cycleLength, groups, setActionData]);

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

    // Slide all groups by a given offset
    const slideAllGroups = useCallback((delta) => {
        saveToHistory();
        setGroups(currentGroups => {
            return currentGroups.map(g => ({
                ...g,
                offset: ((g.offset + delta) % cycleLength + cycleLength) % cycleLength
            }));
        });
        // Also slide action data Déb/Fin
        setActionData(currentData => {
            return currentData.map(row => {
                const newRow = { ...row };
                if (newRow.deb !== '' && newRow.deb !== undefined) {
                    const newDeb = ((parseInt(newRow.deb) + delta) % cycleLength + cycleLength) % cycleLength;
                    newRow.deb = newDeb.toString();
                }
                if (newRow.fin !== '' && newRow.fin !== undefined) {
                    const newFin = ((parseInt(newRow.fin) + delta) % cycleLength + cycleLength) % cycleLength;
                    newRow.fin = newFin.toString();
                }
                return newRow;
            });
        });
    }, [saveToHistory, cycleLength]);

    // Insert time at a given position for a given duration
    const insertTime = useCallback((startSecond, duration) => {
        saveToHistory();
        setGroups(currentGroups => {
            return currentGroups.map(g => {
                const offset = g.offset;
                // If group starts at or after the insertion point, shift it
                if (offset >= startSecond) {
                    return {
                        ...g,
                        offset: offset + duration
                    };
                }
                return g;
            });
        });
        // Also shift action data Déb/Fin
        setActionData(currentData => {
            return currentData.map(row => {
                const newRow = { ...row };
                if (newRow.deb !== '' && newRow.deb !== undefined) {
                    const deb = parseInt(newRow.deb);
                    if (deb >= startSecond) {
                        newRow.deb = (deb + duration).toString();
                    }
                }
                if (newRow.fin !== '' && newRow.fin !== undefined) {
                    const fin = parseInt(newRow.fin);
                    if (fin >= startSecond) {
                        newRow.fin = (fin + duration).toString();
                    }
                }
                return newRow;
            });
        });
        // Increase cycle length
        setCycleLength(prev => prev + duration);
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
        getProjectData,
        deleteSave,
        getFullState,
        loadFullState,
        // Action Table
        actionData,
        updateActionRow: updateActionRowWithHistory,
        // PF (Plans de Feux) management
        pfTabs,
        activePFId,
        setActivePFId,
        duplicatePF,
        deletePF,
        renamePF,
        // Undo
        undo,
        canUndo: history.length > 0,
        // Drag helpers (for saving history only once per drag)
        startDrag,
        endDrag,
        // Diagram operations
        slideAllGroups,
        insertTime
    };
};
