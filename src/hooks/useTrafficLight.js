import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const DEFAULT_CYCLE = 100;
const MAX_HISTORY_SIZE = 50;

// Safe localStorage helper to prevent QuotaExceededError crashes
const safeLocalStorage = {
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn(`localStorage quota exceeded for key: ${key}`);
                // Don't crash the app, just skip the save
                return false;
            }
            throw e;
        }
    },
    getItem: (key) => localStorage.getItem(key),
    removeItem: (key) => localStorage.removeItem(key)
};

// Traffic dataset types
export const TRAFFIC_DATASETS = ['HPM', 'HPS', 'HC', 'Estimation', 'Projection'];

// Create empty traffic data for a group (only trafficVol varies by dataset)
const createEmptyTrafficData = () => ({
    trafficVol: 0
});

export const useTrafficLight = () => {
    const [intersectionName, setIntersectionName] = useState("Nouveau Carrefour");
    const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE);
    const [dependencyGap, setDependencyGap] = useState(20);
    const [externalLinks, setExternalLinks] = useState([]);
    const [globalTime, setGlobalTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // History for undo/redo functionality
    const [history, setHistory] = useState([]);
    const [redoHistory, setRedoHistory] = useState([]);
    const isUndoing = useRef(false);
    const isRedoing = useRef(false);
    const isDragging = useRef(false);

    // Groups State
    const createGroup = (id) => ({
        id,
        name: `Groupe ${id}`, // Default name
        type: 'VL', // VL, TC, Cycliste, Piéton
        minGreen: 6,
        durations: { green: 0, orange: 3, red: 0 }, // New groups start with no green duration
        offset: 0, // New groups start at 0
        da: '', // DA field (2 characters)
        comment: '', // Comment field (50 characters max, not printable)
        commentColor: '', // Comment color: 'green', 'red', or '' (default)
        // Traffic Engineering Props
        trafficStream: '', // Courant de circulation
        laneCoef: 1, // Coef voie
        trafficVol: 0, // Trafic
        effectiveGreen: 0, // Vert utile
        usedCapacity: 0, // Capacité utilisée
        delay: 0, // Retard
        queueLength: 0, // Ile d'attente
    });

    const [groups, setGroups] = useState(() => Array.from({ length: 5 }, (_, i) => createGroup(i + 1)));

    // Matrix: Size depends on number of groups.
    // We store as a URL-like generic object or always resize.
    // Let's keep it as 2D array, resizing when groups change.
    const [conflictMatrix, setConflictMatrix] = useState(() => Array.from({ length: 5 }, () => Array(5).fill('')));

    // Auto-save Effect
    useEffect(() => {
        safeLocalStorage.setItem('trafficGroups', JSON.stringify(groups));
        safeLocalStorage.setItem('trafficMatrix', JSON.stringify(conflictMatrix));
        safeLocalStorage.setItem('trafficName', intersectionName);
        safeLocalStorage.setItem('trafficCycle', cycleLength.toString());
        safeLocalStorage.setItem('trafficDependencyGap', dependencyGap.toString());
    }, [groups, conflictMatrix, intersectionName, cycleLength, dependencyGap]);

    const setGroupCountInternal = (count) => {
        const newCount = Math.max(1, parseInt(count) || 1);

        setGroups(prev => {
            const oldCount = prev.length;

            // Update action data when increasing group count
            if (newCount > oldCount) {
                setActionData(currentData => {
                    return currentData.map(row => {
                        const updatedRow = { ...row };
                        // Update plage1, plage2 if they equal old count
                        if (parseInt(row.plage1) === oldCount) {
                            updatedRow.plage1 = newCount.toString();
                        }
                        if (parseInt(row.plage2) === oldCount) {
                            updatedRow.plage2 = newCount.toString();
                        }
                        // Update actGf1, actGf1Gf2, actGf1Gf3, actGf1Gf4 if they equal old count
                        if (parseInt(row.actGf1?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1 = newCount.toString();
                        }
                        if (parseInt(row.actGf1Gf2?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1Gf2 = newCount.toString();
                        }
                        if (parseInt(row.actGf1Gf3?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1Gf3 = newCount.toString();
                        }
                        if (parseInt(row.actGf1Gf4?.toString().replace(/[Gg]/g, '').trim()) === oldCount) {
                            updatedRow.actGf1Gf4 = newCount.toString();
                        }
                        return updatedRow;
                    });
                });

                // Add groups
                const added = Array.from({ length: newCount - oldCount }, (_, i) => createGroup(oldCount + i + 1));
                return [...prev, ...added];
            } else if (newCount < prev.length) {
                // Remove groups
                return prev.slice(0, newCount);
            }
            return prev;
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

        // 4. Swap diagram data in ALL PF tabs (not just the active one)
        setPfTabs(currentTabs => {
            return currentTabs.map(pf => {
                const newPf = { ...pf };

                // Swap diagram data if it exists
                if (newPf.diagram && newPf.diagram.length > 0) {
                    const newDiagram = [...newPf.diagram];
                    const entryA = newDiagram.find(d => d.groupId === gfA);
                    const entryB = newDiagram.find(d => d.groupId === gfB);

                    if (entryA && entryB) {
                        // Swap all properties except groupId
                        const tempOffset = entryA.offset;
                        const tempGreenDuration = entryA.greenDuration;
                        const tempDa = entryA.da;
                        const tempComment = entryA.comment;
                        const tempCommentColor = entryA.commentColor;

                        entryA.offset = entryB.offset;
                        entryA.greenDuration = entryB.greenDuration;
                        entryA.da = entryB.da;
                        entryA.comment = entryB.comment;
                        entryA.commentColor = entryB.commentColor;

                        entryB.offset = tempOffset;
                        entryB.greenDuration = tempGreenDuration;
                        entryB.da = tempDa;
                        entryB.comment = tempComment;
                        entryB.commentColor = tempCommentColor;
                    }
                    newPf.diagram = newDiagram;
                }

                // Swap conflict matrix in PF if it exists
                if (newPf.conflictMatrix && newPf.conflictMatrix.length > 0) {
                    const newMatrix = newPf.conflictMatrix.map(row => [...row]);

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
                    newPf.conflictMatrix = newMatrix;
                }

                // Swap GF references in action data if it exists
                if (newPf.data && newPf.data.length > 0) {
                    newPf.data = newPf.data.map(row => {
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
                }

                return newPf;
            });
        });
    };

    // Move a group to a new position (after another group)
    // sourceId: the ID of the group to move
    // afterId: the ID of the group after which to insert (0 = insert at beginning)
    const moveGroupToPosition = (sourceId, afterId) => {
        const sourceIndex = groups.findIndex(g => g.id === sourceId);
        if (sourceIndex === -1) return;

        // Calculate target index
        let targetIndex;
        if (afterId === 0) {
            targetIndex = 0; // Insert at beginning
        } else {
            const afterIndex = groups.findIndex(g => g.id === afterId);
            if (afterIndex === -1) return;
            targetIndex = afterIndex + 1;
        }

        // Adjust target if source is before target
        if (sourceIndex < targetIndex) {
            targetIndex--;
        }

        if (sourceIndex === targetIndex) return; // No change needed

        // Create mapping from old positions to new positions
        const oldToNew = {};
        const newToOld = {};

        // Build the new order of groups
        const newGroups = [...groups];
        const [movedGroup] = newGroups.splice(sourceIndex, 1);
        newGroups.splice(targetIndex, 0, movedGroup);

        // Create position mappings (1-based GF numbers)
        for (let i = 0; i < groups.length; i++) {
            const oldGf = i + 1;
            const group = groups[i];
            const newIndex = newGroups.findIndex(g => g.id === group.id);
            const newGf = newIndex + 1;
            oldToNew[oldGf] = newGf;
            newToOld[newGf] = oldGf;
        }

        // 1. Reorder groups and reassign IDs to be sequential
        setGroups(() => {
            return newGroups.map((g, idx) => ({
                ...g,
                id: idx + 1
            }));
        });

        // 2. Reorder matrix rows and columns
        setConflictMatrix(currentMatrix => {
            if (!currentMatrix || currentMatrix.length === 0) return currentMatrix;

            const size = currentMatrix.length;
            const newMatrix = Array(size).fill(null).map(() => Array(size).fill(0));

            // Copy values to new positions
            for (let oldRow = 0; oldRow < size; oldRow++) {
                for (let oldCol = 0; oldCol < size; oldCol++) {
                    const newRow = oldToNew[oldRow + 1] - 1;
                    const newCol = oldToNew[oldCol + 1] - 1;
                    if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                        newMatrix[newRow][newCol] = currentMatrix[oldRow][oldCol];
                    }
                }
            }

            return newMatrix;
        });

        // 3. Update GF references in ActionTable
        const gfFields = ['gf', 'plage1', 'plage2', 'actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'];

        setActionData(currentData => {
            return currentData.map(row => {
                const newRow = { ...row };
                gfFields.forEach(field => {
                    const val = parseInt(newRow[field]);
                    if (!isNaN(val) && val > 0 && val <= groups.length) {
                        newRow[field] = oldToNew[val].toString();
                    }
                });
                return newRow;
            });
        });

        // 4. Update ALL PF tabs with reordered data
        const size = groups.length;
        setPfTabs(currentTabs => {
            return currentTabs.map(pf => {
                const newPf = { ...pf };

                // Reorder diagram data if it exists
                if (newPf.diagram && newPf.diagram.length > 0) {
                    newPf.diagram = newPf.diagram.map(entry => ({
                        ...entry,
                        groupId: oldToNew[entry.groupId] || entry.groupId
                    }));
                }

                // Reorder conflict matrix in PF if it exists
                if (newPf.conflictMatrix && newPf.conflictMatrix.length > 0) {
                    const pfSize = newPf.conflictMatrix.length;
                    const newMatrix = Array(pfSize).fill(null).map(() => Array(pfSize).fill(''));

                    for (let oldRow = 0; oldRow < pfSize; oldRow++) {
                        for (let oldCol = 0; oldCol < pfSize; oldCol++) {
                            const newRow = oldToNew[oldRow + 1] - 1;
                            const newCol = oldToNew[oldCol + 1] - 1;
                            if (newRow >= 0 && newRow < pfSize && newCol >= 0 && newCol < pfSize) {
                                newMatrix[newRow][newCol] = newPf.conflictMatrix[oldRow][oldCol];
                            }
                        }
                    }
                    newPf.conflictMatrix = newMatrix;
                }

                // Update GF references in action data if it exists
                if (newPf.data && newPf.data.length > 0) {
                    newPf.data = newPf.data.map(row => {
                        const newRow = { ...row };
                        gfFields.forEach(field => {
                            const val = parseInt(newRow[field]);
                            if (!isNaN(val) && val > 0 && val <= size) {
                                newRow[field] = oldToNew[val].toString();
                            }
                        });
                        return newRow;
                    });
                }

                return newPf;
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

    // Save/Load Logic - saveProject is defined later after all state declarations

    // Flag to prevent auto-save during project loading
    const isLoadingProjectRef = useRef(false);

    const loadProject = (name) => {
        // Set flag to prevent auto-save during loading
        isLoadingProjectRef.current = true;

        try {
            const raw = localStorage.getItem(`traffic_project_${name}`);
            if (!raw) {
                isLoadingProjectRef.current = false;
                return false;
            }
            const data = JSON.parse(raw);

            // Batch updates - use project name as intersection name
            setIntersectionName(name);

            // Migrate and validate groups structure for old projects
            if (data.groups) {
                const migratedGroups = data.groups.map((g, index) => {
                    // Ensure all required fields exist with proper defaults
                    const id = g.id !== undefined ? g.id : index + 1;

                    // Handle old duration formats
                    let durations = g.durations;
                    if (!durations || typeof durations !== 'object') {
                        // Old format might have green/orange/red directly on group
                        durations = {
                            green: g.green !== undefined ? g.green : (g.greenDuration !== undefined ? g.greenDuration : 10),
                            orange: g.orange !== undefined ? g.orange : 3,
                            red: g.red !== undefined ? g.red : 0
                        };
                    }
                    // Validate duration values
                    durations = {
                        green: !isNaN(durations.green) ? durations.green : 10,
                        orange: !isNaN(durations.orange) ? durations.orange : 3,
                        red: !isNaN(durations.red) ? durations.red : 0
                    };

                    return {
                        id,
                        name: g.name || `Groupe ${id}`,
                        type: g.type || 'VL',
                        minGreen: g.minGreen !== undefined && !isNaN(g.minGreen) ? g.minGreen : 6,
                        durations,
                        offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
                        da: g.da || '',
                        comment: g.comment || '',
                        commentColor: g.commentColor || '',
                        // Traffic Engineering Props
                        trafficStream: g.trafficStream || '',
                        laneCoef: g.laneCoef !== undefined ? g.laneCoef : 1,
                        trafficVol: g.trafficVol !== undefined ? g.trafficVol : 0,
                        effectiveGreen: g.effectiveGreen !== undefined ? g.effectiveGreen : 0,
                        usedCapacity: g.usedCapacity !== undefined ? g.usedCapacity : 0,
                        delay: g.delay !== undefined ? g.delay : 0,
                        queueLength: g.queueLength !== undefined ? g.queueLength : 0
                    };
                });
                setGroups(migratedGroups);
            }

            if (data.cycleLength) setCycleLength(data.cycleLength);

            // Ensure conflict matrix matches group count
            const groupCount = data.groups ? data.groups.length : 0;
            if (data.conflictMatrix && groupCount > 0) {
                // Clean 0 values and values outside 3-20 range, and resize to match group count
                const cleanedMatrix = Array.from({ length: groupCount }, (_, r) => {
                    return Array.from({ length: groupCount }, (_, c) => {
                        const val = data.conflictMatrix[r]?.[c];
                        if (val === undefined || val === null || val === 0 || val === '0') return '';
                        if (typeof val === 'number' && (val < 3 || val > 20)) return '';
                        return val;
                    });
                });
                setConflictMatrix(cleanedMatrix);
            } else if (groupCount > 0) {
                // No matrix in data, create empty one
                setConflictMatrix(Array.from({ length: groupCount }, () => new Array(groupCount).fill('')));
            }
            // Load action table data (pfTabs)
            if (data.pfTabs) {
                // Migrate and validate pfTabs structure
                const groupCount = data.groups ? data.groups.length : 0;
                const migratedPfTabs = data.pfTabs.map(pf => {
                    const migrated = { ...pf };

                    // Ensure data array exists
                    if (!migrated.data) {
                        migrated.data = [];
                    }

                    // Ensure diagram array exists with valid data
                    if (!migrated.diagram || !Array.isArray(migrated.diagram) || migrated.diagram.length === 0) {
                        // Initialize diagram from groups if available
                        if (data.groups) {
                            migrated.diagram = data.groups.map(g => ({
                                groupId: g.id,
                                offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
                                greenDuration: g.durations?.green !== undefined && !isNaN(g.durations.green) ? g.durations.green : 10,
                                da: g.da || '',
                                comment: g.comment || '',
                                commentColor: g.commentColor || '#000000'
                            }));
                        } else {
                            migrated.diagram = [];
                        }
                    } else {
                        // Validate existing diagram entries
                        migrated.diagram = migrated.diagram.map(d => ({
                            ...d,
                            offset: d.offset !== undefined && !isNaN(d.offset) ? d.offset : 0,
                            greenDuration: d.greenDuration !== undefined && !isNaN(d.greenDuration) ? d.greenDuration : 10
                        }));
                    }

                    // Ensure conflictMatrix exists with proper size
                    if (!migrated.conflictMatrix || !Array.isArray(migrated.conflictMatrix) || migrated.conflictMatrix.length === 0) {
                        // Initialize from main conflict matrix or create empty
                        if (data.conflictMatrix && data.conflictMatrix.length > 0) {
                            migrated.conflictMatrix = data.conflictMatrix.map(row => [...row]);
                        } else if (groupCount > 0) {
                            migrated.conflictMatrix = Array.from({ length: groupCount }, () =>
                                new Array(groupCount).fill('')
                            );
                        }
                    }

                    // Ensure remarques field exists
                    if (migrated.remarques === undefined) {
                        migrated.remarques = '';
                    }

                    return migrated;
                });
                setPfTabs(migratedPfTabs);
                if (data.activePFId) setActivePFId(data.activePFId);
            } else if (data.actionData) {
                // Handle old format for backward compatibility
                const groupCount = data.groups ? data.groups.length : 0;
                const initialDiagram = data.groups ? data.groups.map(g => ({
                    groupId: g.id,
                    offset: g.offset !== undefined && !isNaN(g.offset) ? g.offset : 0,
                    greenDuration: g.durations?.green !== undefined && !isNaN(g.durations.green) ? g.durations.green : 10,
                    da: g.da || '',
                    comment: g.comment || '',
                    commentColor: g.commentColor || '#000000'
                })) : [];
                const initialMatrix = data.conflictMatrix && data.conflictMatrix.length > 0
                    ? data.conflictMatrix.map(row => [...row])
                    : (groupCount > 0 ? Array.from({ length: groupCount }, () => new Array(groupCount).fill('')) : []);
                setPfTabs([{
                    id: 1,
                    name: 'PF1',
                    data: data.actionData,
                    diagram: initialDiagram,
                    conflictMatrix: initialMatrix,
                    remarques: ''
                }]);
                setActivePFId(1);
            }

            // Load intersection image and arrows
            if (data.intersectionImage !== undefined) {
                setIntersectionImage(data.intersectionImage);
            }
            if (data.intersectionArrows) {
                setIntersectionArrows(data.intersectionArrows);
            }

            // Load traffic datasets
            if (data.trafficDatasets) {
                setTrafficDatasets(data.trafficDatasets);
            }
            if (data.activeTrafficDataset) {
                setActiveTrafficDataset(data.activeTrafficDataset);
            }

            // Load dependency gap (default to 20 if not present)
            setDependencyGap(data.dependencyGap !== undefined ? data.dependencyGap : 20);

            // Reset simulation state when loading a project
            setSimulationEnabled(false);
            setSimulationSelectedActions([]);

            // Move project to top of the order list
            updateProjectOrder(name);

            // Reset loading flag after a delay to let React batch updates settle
            setTimeout(() => {
                isLoadingProjectRef.current = false;
            }, 3000);

            return true;
        } catch (e) {
            console.error("Load failed", e);
            isLoadingProjectRef.current = false;
            return false;
        }
    };

    // Maximum number of projects to keep in localStorage cache
    const MAX_CACHED_PROJECTS = 5;

    // Update project order - move project to top and limit to MAX_CACHED_PROJECTS
    const updateProjectOrder = (name) => {
        try {
            const orderRaw = localStorage.getItem('traffic_project_order');
            let order = orderRaw ? JSON.parse(orderRaw) : [];
            // Remove if already exists
            order = order.filter(n => n !== name);
            // Add to top
            order.unshift(name);

            // Remove old projects beyond the limit (keep last backup)
            while (order.length > MAX_CACHED_PROJECTS) {
                const oldProjectName = order.pop();
                // Delete the old project from localStorage (but keep its backup if exists)
                localStorage.removeItem(`traffic_project_${oldProjectName}`);
                console.log(`Cache nettoyé: projet "${oldProjectName}" supprimé`);
            }

            safeLocalStorage.setItem('traffic_project_order', JSON.stringify(order));
        } catch (e) {
            console.error("Update order failed", e);
        }
    };

    const getAllSaves = () => {
        const saves = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // Skip null/undefined keys
                if (!key) continue;
                // Only include main project files (exclude backups and order file)
                if (key.startsWith('traffic_project_') && !key.endsWith('_backup') && key !== 'traffic_project_order') {
                    const name = key.replace('traffic_project_', '');
                    // Skip empty names
                    if (!name) continue;

                    const raw = localStorage.getItem(key);
                    let savedAt = null;
                    let size = 0;

                    if (raw) {
                        size = raw.length;
                        try {
                            const data = JSON.parse(raw);
                            savedAt = data.savedAt || null;
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }

                    saves.push({ name, savedAt, size });
                }
            }

            // Sort by order (most recently loaded first) and limit to MAX_CACHED_PROJECTS
            const orderRaw = localStorage.getItem('traffic_project_order');
            if (orderRaw) {
                const order = JSON.parse(orderRaw);
                saves.sort((a, b) => {
                    const indexA = order.indexOf(a.name);
                    const indexB = order.indexOf(b.name);
                    // Projects not in order list go to the end
                    if (indexA === -1 && indexB === -1) return 0;
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });
            }
        } catch (e) {
            console.error("getAllSaves failed", e);
        }

        // Limit to MAX_CACHED_PROJECTS
        return saves.slice(0, MAX_CACHED_PROJECTS);
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
            // Toujours mettre à jour le nom (avec valeur par défaut si absent)
            setIntersectionName(state.intersectionName || "Nouveau Carrefour");

            // Toujours mettre à jour les groupes (avec valeur par défaut si absent)
            if (state.groups && Array.isArray(state.groups) && state.groups.length > 0) {
                setGroups(state.groups);
            } else {
                // Réinitialiser avec 5 groupes par défaut
                setGroups(Array.from({ length: 5 }, (_, i) => createGroup(i + 1)));
            }

            // Toujours mettre à jour la durée du cycle
            setCycleLength(state.cycleLength || DEFAULT_CYCLE);

            // Mettre à jour la matrice de conflits
            if (state.conflictMatrix && Array.isArray(state.conflictMatrix)) {
                const cleanedMatrix = state.conflictMatrix.map(row => row.map(val => {
                    if (val === 0 || val === '0') return '';
                    if (typeof val === 'number' && (val < 3 || val > 20)) return '';
                    return val;
                }));
                setConflictMatrix(cleanedMatrix);
            } else {
                // Réinitialiser la matrice selon le nombre de groupes
                const groupCount = (state.groups && state.groups.length) || 5;
                setConflictMatrix(Array.from({ length: groupCount }, () => Array(groupCount).fill('')));
            }

            // Handle new pfTabs format or old actionData format
            if (state.pfTabs && Array.isArray(state.pfTabs) && state.pfTabs.length > 0) {
                setPfTabs(state.pfTabs);
                setActivePFId(state.activePFId || 1);
            } else if (state.actionData && Array.isArray(state.actionData)) {
                setPfTabs([{ id: 1, name: 'PF1', data: state.actionData }]);
                setActivePFId(1);
            } else {
                // Réinitialiser avec un PF vide (structure inline pour éviter dépendance)
                const emptyRow = (id) => ({
                    id, gf: '', action: '', description: '', deb: '', fin: '',
                    abrv: '', micro: '', plage1: '', plage2: '',
                    actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: ''
                });
                setPfTabs([{ id: 1, name: 'PF1', data: Array.from({ length: 20 }, (_, i) => emptyRow(i + 1)) }]);
                setActivePFId(1);
            }

            // Load traffic datasets if provided
            if (state.trafficDatasets) {
                setTrafficDatasets(state.trafficDatasets);
            } else {
                // Réinitialiser les datasets de trafic
                setTrafficDatasets({});
            }
            // Load active traffic dataset
            if (state.activeTrafficDataset) {
                setActiveTrafficDataset(state.activeTrafficDataset);
            }

            // Load intersection image and arrows
            if (state.intersectionImage !== undefined) {
                setIntersectionImage(state.intersectionImage);
            } else {
                setIntersectionImage(null);
            }
            if (state.intersectionArrows !== undefined) {
                setIntersectionArrows(state.intersectionArrows);
            } else {
                setIntersectionArrows([]);
            }

            // Reset simulation state when loading full state
            setSimulationEnabled(false);
            setSimulationSelectedActions([]);

            // Reset dependency gap if provided
            if (state.dependencyGap !== undefined) {
                setDependencyGap(state.dependencyGap);
            }

            // Load external links
            if (state.externalLinks && Array.isArray(state.externalLinks)) {
                setExternalLinks(state.externalLinks);
            } else {
                setExternalLinks([]);
            }

            return true;
        } catch (e) {
            console.error("Load full state failed", e);
            return false;
        }
    };

    // Reset to a new empty project (8 groups, 60s cycle)
    const resetToNewProject = () => {
        // Reset intersection name
        setIntersectionName("Nouveau Carrefour");

        // Reset to 8 groups with 60s cycle
        const newGroups = Array.from({ length: 8 }, (_, i) => createGroup(i + 1));
        setGroups(newGroups);
        setCycleLength(60);

        // Reset conflict matrix (8x8)
        setConflictMatrix(Array.from({ length: 8 }, () => Array(8).fill('')));

        // Reset to single empty PF tab
        const emptyRow = (id) => ({
            id, gf: '', action: '', description: '', deb: '', fin: '',
            abrv: '', micro: '', plage1: '', plage2: '',
            actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: ''
        });
        setPfTabs([{ id: 1, name: 'PF1', data: Array.from({ length: 30 }, (_, i) => emptyRow(i + 1)) }]);
        setActivePFId(1);

        // Reset traffic datasets
        setTrafficDatasets({});
        setActiveTrafficDataset('HPM');

        // Reset intersection image and arrows
        setIntersectionImage(null);
        setIntersectionArrows([]);

        // Reset dependency gap
        setDependencyGap(20);

        // Reset external links
        setExternalLinks([]);

        // Reset simulation state
        setSimulationEnabled(false);
        setSimulationSelectedActions([]);

        // Clear history
        setHistory([]);
        setRedoHistory([]);

        return true;
    };

    // Get full state (for saving/duplication)
    const getFullState = () => ({
        intersectionName,
        groups,
        cycleLength,
        conflictMatrix,
        pfTabs,
        activePFId,
        intersectionImage,
        intersectionArrows,
        trafficDatasets,
        activeTrafficDataset,
        dependencyGap,
        externalLinks
        // Note: simulation state is NOT included (per user request)
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
    const [pfTabs, setPfTabs] = useState(() => [{ id: 1, name: 'PF1', data: createEmptyActionData(), remarques: '' }]);

    const [activePFId, setActivePFId] = useState(1);

    // Simulation mode state (not persisted - resets on page load)
    const [simulationEnabled, setSimulationEnabled] = useState(false);
    const [simulationSelectedActions, setSimulationSelectedActions] = useState([]);

    // Intersection image state (persisted with project)
    const [intersectionImage, setIntersectionImage] = useState(null);
    const [intersectionArrows, setIntersectionArrows] = useState([]);

    // Traffic datasets state (HPM, HPS, HC, Estimation, Projection)
    const [activeTrafficDataset, setActiveTrafficDataset] = useState('HPM');

    // Initialize traffic datasets with empty data for all groups
    const createInitialTrafficDatasets = (groupCount) => {
        const datasets = {};
        TRAFFIC_DATASETS.forEach(ds => {
            datasets[ds] = {};
            for (let i = 1; i <= groupCount; i++) {
                datasets[ds][i] = createEmptyTrafficData();
            }
        });
        return datasets;
    };

    const [trafficDatasets, setTrafficDatasets] = useState(() => createInitialTrafficDatasets(5));

    // Get current actionData based on active PF
    const actionData = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF ? activePF.data : createEmptyActionData();
    }, [pfTabs, activePFId]);

    // Get current microCustomFields based on active PF (4 fields for modification notes)
    const microCustomFields = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF?.microCustomFields || ['', '', '', ''];
    }, [pfTabs, activePFId]);

    // Update microCustomFields for the active PF
    const updateMicroCustomField = useCallback((index, value) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? {
                    ...pf,
                    microCustomFields: (pf.microCustomFields || ['', '', '', '']).map((f, i) =>
                        i === index ? value : f
                    )
                }
                : pf
        ));
    }, [activePFId]);

    // Get phasage bulle count for active PF
    const phasageBulleCount = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF?.phasageBulleCount ?? 4;
    }, [pfTabs, activePFId]);

    // Get phasage bulle times for active PF
    const phasageBulleTimes = useMemo(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);
        return activePF?.phasageBulleTimes || [0, 15, 30, 45, 60, 75];
    }, [pfTabs, activePFId]);

    // Update phasage bulle count for active PF
    const setPhasageBulleCount = useCallback((count) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, phasageBulleCount: count }
                : pf
        ));
    }, [activePFId]);

    // Update phasage bulle times for active PF
    const setPhasageBulleTimes = useCallback((times) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId
                ? { ...pf, phasageBulleTimes: times }
                : pf
        ));
    }, [activePFId]);

    // Dynamic traffic dataset names based on PF tabs (+ Projection at the end)
    const trafficDatasetNames = useMemo(() => {
        if (pfTabs && pfTabs.length > 0) {
            // Use PF tab names + "Projection" at the end
            return [...pfTabs.map(pf => pf.name), 'Projection'];
        }
        // Fallback to default if no PF tabs
        return TRAFFIC_DATASETS;
    }, [pfTabs]);

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

        // Get flèche d'anticipation actions - these override the green phase timing for conflict calculation
        const flecheAnticipations = actionData.filter(action =>
            action.action === "Flèche d'anticipation" &&
            action.gf !== '' &&
            action.deb !== '' &&
            action.fin !== ''
        ).reduce((acc, action) => {
            const gf = parseInt(action.gf);
            // Store the first flèche d'anticipation for each group
            if (!acc[gf]) {
                acc[gf] = {
                    deb: parseInt(action.deb),
                    fin: parseInt(action.fin)
                };
            }
            return acc;
        }, {});

        // Helper to check if an escamotage exists between two groups
        const hasEscamotage = (gfA, gfB) => {
            return escamotages.some(e =>
                (e.sourceGf === gfA && e.targetGf === gfB) ||
                (e.sourceGf === gfB && e.targetGf === gfA)
            );
        };

        // Check intergreen time conflicts (existing logic)
        for (let from = 0; from < count; from++) {
            // Safety check: skip if row doesn't exist in matrix
            if (!conflictMatrix[from]) continue;
            for (let to = 0; to < count; to++) {
                const minGap = conflictMatrix[from][to];
                // Skip empty values
                if ((minGap === '' || minGap === undefined || minGap === null) || from === to) continue;

                const gFrom = groups[from];
                const gTo = groups[to];

                // Check if groups have flèche d'anticipation - use those timings instead
                const flecheFrom = flecheAnticipations[gFrom.id];
                const flecheTo = flecheAnticipations[gTo.id];

                // For "from" group: end of green (or end of flèche d'anticipation)
                const endGreenA_Absolute = flecheFrom
                    ? flecheFrom.fin % cycleLength
                    : (gFrom.offset + gFrom.durations.green) % cycleLength;

                // For "to" group: start of green (or start of flèche d'anticipation)
                const startGreenB_Absolute = flecheTo
                    ? flecheTo.deb % cycleLength
                    : gTo.offset % cycleLength;

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
                // Use flèche d'anticipation timings if present
                const startA = flecheFrom ? flecheFrom.deb : gFrom.offset;
                const endA = flecheFrom ? flecheFrom.fin : gFrom.offset + gFrom.durations.green;
                const startB = flecheTo ? flecheTo.deb : gTo.offset;
                const endB = flecheTo ? flecheTo.fin : gTo.offset + gTo.durations.green;

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

    // Reorder actions (for sorting)
    const reorderActions = useCallback((sortedData) => {
        // Reassign IDs to maintain order
        const reorderedData = sortedData.map((row, index) => ({
            ...row,
            id: index + 1
        }));
        setActionData(reorderedData);
    }, [setActionData]);

    // Duplicate current PF
    const duplicatePF = useCallback(() => {
        const nextId = Math.max(...pfTabs.map(pf => pf.id)) + 1;
        const newName = `PF${nextId}`;
        const currentData = JSON.parse(JSON.stringify(actionData));
        const currentPF = pfTabs.find(pf => pf.id === activePFId);
        const currentRemarques = currentPF?.remarques || '';
        setPfTabs(prev => [...prev, { id: nextId, name: newName, data: currentData, remarques: currentRemarques }]);
        setActivePFId(nextId);
        return nextId;
    }, [pfTabs, actionData, activePFId]);

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

    // Set PF color (for validation)
    const setPFColor = useCallback((pfId, color) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === pfId ? { ...pf, color: color } : pf
        ));
    }, []);

    // Update remarques for active PF
    const updatePFRemarques = useCallback((remarques) => {
        setPfTabs(prev => prev.map(pf =>
            pf.id === activePFId ? { ...pf, remarques: remarques } : pf
        ));
    }, [activePFId]);

    // Simulation functions
    const toggleSimulationAction = useCallback((actionId) => {
        setSimulationSelectedActions(prev => {
            if (prev.includes(actionId)) {
                return prev.filter(id => id !== actionId);
            } else {
                return [...prev, actionId];
            }
        });
    }, []);

    const selectAllSimulationActions = useCallback(() => {
        const activeIds = actionData
            .filter(a => a.action && a.action !== '')
            .map(a => a.id);
        setSimulationSelectedActions(activeIds);
    }, [actionData]);

    const deselectAllSimulationActions = useCallback(() => {
        setSimulationSelectedActions([]);
    }, []);

    // Save project - defined after all state declarations to capture current values
    const saveProject = useCallback((name) => {
        if (!name) return false;

        // Validate data before saving to prevent empty saves
        if (!groups || groups.length === 0) {
            console.error("Save aborted: groups is empty or undefined");
            alert("Erreur: Impossible de sauvegarder - les groupes sont vides");
            return false;
        }
        if (!pfTabs || pfTabs.length === 0) {
            console.error("Save aborted: pfTabs is empty or undefined");
            alert("Erreur: Impossible de sauvegarder - les plans de feux sont vides");
            return false;
        }
        if (!conflictMatrix || conflictMatrix.length === 0) {
            console.error("Save aborted: conflictMatrix is empty or undefined");
            alert("Erreur: Impossible de sauvegarder - la matrice de conflits est vide");
            return false;
        }

        const projectData = {
            intersectionName,
            groups,
            cycleLength,
            conflictMatrix,
            pfTabs,
            activePFId,
            intersectionImage,
            intersectionArrows,
            trafficDatasets,
            activeTrafficDataset,
            dependencyGap,
            externalLinks
            // Note: simulation state is NOT saved with project (per user request)
        };

        // Check if resulting JSON is valid and not too small (likely corrupted)
        const jsonData = JSON.stringify(projectData);
        if (jsonData.length < 100) {
            console.error("Save aborted: data appears corrupted (too small)", jsonData.length);
            alert("Erreur: Impossible de sauvegarder - les données semblent corrompues");
            return false;
        }

        try {
            // Create backup of existing save before overwriting
            const existingSave = localStorage.getItem(`traffic_project_${name}`);
            if (existingSave && existingSave.length > jsonData.length * 0.5) {
                // Existing save is significantly larger - warn user
                const existingSize = existingSave.length;
                const newSize = jsonData.length;
                if (newSize < existingSize * 0.3) {
                    // New save is less than 30% of old save - likely data loss
                    const confirm = window.confirm(
                        `Attention: La nouvelle sauvegarde (${newSize} car.) est beaucoup plus petite que l'ancienne (${existingSize} car.).\n\nCela pourrait indiquer une perte de données.\n\nVoulez-vous quand même sauvegarder?`
                    );
                    if (!confirm) {
                        return false;
                    }
                }
                // Keep a backup
                localStorage.setItem(`traffic_project_${name}_backup`, existingSave);
            }

            localStorage.setItem(`traffic_project_${name}`, jsonData);
            return true;
        } catch (e) {
            console.error("Save failed", e);
            if (e.name === 'QuotaExceededError') {
                // Automatically delete the oldest project and retry
                try {
                    const orderRaw = localStorage.getItem('traffic_project_order');
                    if (orderRaw) {
                        const order = JSON.parse(orderRaw);
                        // Find the oldest project (last in the list) that is not the current one
                        const oldestProject = order.filter(n => n !== name).pop();
                        if (oldestProject) {
                            localStorage.removeItem(`traffic_project_${oldestProject}`);
                            localStorage.removeItem(`traffic_project_${oldestProject}_backup`);
                            // Update order
                            const newOrder = order.filter(n => n !== oldestProject);
                            localStorage.setItem('traffic_project_order', JSON.stringify(newOrder));
                            console.log(`Espace insuffisant: projet "${oldestProject}" supprimé automatiquement`);
                            // Retry save
                            localStorage.setItem(`traffic_project_${name}`, jsonData);
                            return true;
                        }
                    }
                } catch (retryError) {
                    console.error("Retry save failed", retryError);
                }
                alert("Erreur: Espace de stockage insuffisant même après nettoyage.");
            } else {
                alert("Erreur lors de la sauvegarde: " + e.message);
            }
            return false;
        }
    }, [intersectionName, groups, cycleLength, conflictMatrix, pfTabs, activePFId, intersectionImage, intersectionArrows, trafficDatasets, activeTrafficDataset, dependencyGap, externalLinks]);

    // Save pfTabs to localStorage
    useEffect(() => {
        safeLocalStorage.setItem('trafficPfTabs', JSON.stringify(pfTabs));
        safeLocalStorage.setItem('trafficActivePF', activePFId.toString());
    }, [pfTabs, activePFId]);

    // Flag to prevent sync during initial load
    const isInitialLoadRef = useRef(true);
    useEffect(() => {
        // Allow sync after a short delay to let initial data settle
        const timer = setTimeout(() => {
            isInitialLoadRef.current = false;
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    // Synchronize current conflict matrix with active PF tab
    // Use a ref to prevent infinite loops
    const lastSyncedMatrixRef = useRef(null);
    useEffect(() => {
        // Skip during initial load
        if (isInitialLoadRef.current) return;

        // Only sync if we have a valid active PF and the matrix has changed
        const matrixKey = JSON.stringify(conflictMatrix);
        if (lastSyncedMatrixRef.current === matrixKey) {
            return; // Already synced this matrix
        }
        lastSyncedMatrixRef.current = matrixKey;

        setPfTabs(prevTabs => {
            const tabIndex = prevTabs.findIndex(pf => pf.id === activePFId);
            if (tabIndex === -1) return prevTabs;

            // Check if matrix actually changed
            const currentPfMatrix = prevTabs[tabIndex].conflictMatrix;
            if (JSON.stringify(currentPfMatrix) === matrixKey) {
                return prevTabs; // No change needed
            }

            // Update the PF with the new matrix
            const newTabs = [...prevTabs];
            newTabs[tabIndex] = {
                ...newTabs[tabIndex],
                conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix))
            };
            return newTabs;
        });
    }, [conflictMatrix, activePFId]);

    // Synchronize current groups (diagram data) with active PF tab
    const lastSyncedGroupsRef = useRef(null);
    useEffect(() => {
        // Skip during initial load
        if (isInitialLoadRef.current) return;

        // Build diagram data from groups
        const diagramData = groups.map(g => ({
            groupId: g.id,
            offset: g.offset,
            greenDuration: g.durations.green,
            da: g.da || '',
            comment: g.comment || '',
            commentColor: g.commentColor || ''
        }));
        const groupsKey = JSON.stringify(diagramData);

        if (lastSyncedGroupsRef.current === groupsKey) {
            return; // Already synced
        }
        lastSyncedGroupsRef.current = groupsKey;

        setPfTabs(prevTabs => {
            const tabIndex = prevTabs.findIndex(pf => pf.id === activePFId);
            if (tabIndex === -1) return prevTabs;

            // Check if diagram actually changed
            const currentPfDiagram = prevTabs[tabIndex].diagram;
            if (JSON.stringify(currentPfDiagram) === groupsKey) {
                return prevTabs; // No change needed
            }

            // Update the PF with the new diagram data
            const newTabs = [...prevTabs];
            newTabs[tabIndex] = {
                ...newTabs[tabIndex],
                diagram: diagramData,
                cycleLength: cycleLength
            };
            return newTabs;
        });
    }, [groups, cycleLength, activePFId]);

    // Apply diagram data from active PF tab to groups when changing tabs
    // Use a ref to track the last applied PF to avoid unnecessary re-renders
    const lastAppliedPFRef = useRef(null);

    useEffect(() => {
        const activePF = pfTabs.find(pf => pf.id === activePFId);

        // Only apply if PF changed and has diagram data
        if (activePF && activePF.diagram && activePF.diagram.length > 0) {
            // Check if we already applied this PF's diagram
            const pfKey = `${activePF.id}-${JSON.stringify(activePF.diagram)}`;
            if (lastAppliedPFRef.current === pfKey) {
                return; // Already applied, skip
            }
            lastAppliedPFRef.current = pfKey;

            // Update groups with diagram data from active PF
            setGroups(prevGroups => {
                const newGroups = prevGroups.map(group => {
                    const diagramEntry = activePF.diagram.find(d => d.groupId === group.id);
                    if (diagramEntry) {
                        // Safely get values with fallbacks to prevent undefined
                        const newOffset = diagramEntry.offset !== undefined && !isNaN(diagramEntry.offset)
                            ? diagramEntry.offset
                            : group.offset;
                        const newGreenDuration = diagramEntry.greenDuration !== undefined && !isNaN(diagramEntry.greenDuration)
                            ? diagramEntry.greenDuration
                            : group.durations.green;
                        return {
                            ...group,
                            offset: newOffset,
                            da: diagramEntry.da !== undefined ? diagramEntry.da : group.da,
                            comment: diagramEntry.comment !== undefined ? diagramEntry.comment : group.comment,
                            commentColor: diagramEntry.commentColor !== undefined ? diagramEntry.commentColor : group.commentColor,
                            durations: {
                                ...group.durations,
                                green: newGreenDuration
                            }
                        };
                    }
                    return group;
                });
                return newGroups;
            });
            // Also update cycle length if the PF has a specific one
            if (activePF.cycleLength) {
                setCycleLength(activePF.cycleLength);
            }
            // Also update conflict matrix if the PF has a specific one
            // Resize matrix to match current group count to prevent errors
            if (activePF.conflictMatrix && activePF.conflictMatrix.length > 0) {
                setConflictMatrix(prevMatrix => {
                    const currentSize = prevMatrix.length;
                    const pfMatrixSize = activePF.conflictMatrix.length;

                    // Create a new matrix with the current size
                    const resizedMatrix = Array.from({ length: currentSize }, (_, r) => {
                        const row = new Array(currentSize).fill('');
                        for (let c = 0; c < currentSize; c++) {
                            // Copy values from PF matrix if they exist
                            if (r < pfMatrixSize && c < pfMatrixSize && activePF.conflictMatrix[r]) {
                                let val = activePF.conflictMatrix[r][c];
                                // Clean the value
                                if (val === 0 || val === '0') val = '';
                                else if (typeof val === 'number' && (val < 3 || val > 20)) val = '';
                                row[c] = val !== undefined ? val : '';
                            }
                        }
                        return row;
                    });
                    return resizedMatrix;
                });
            }
        }
    }, [activePFId, pfTabs]);

    // Save intersection image to localStorage
    useEffect(() => {
        if (intersectionImage) {
            safeLocalStorage.setItem('trafficIntersectionImage', JSON.stringify(intersectionImage));
        } else {
            safeLocalStorage.removeItem('trafficIntersectionImage');
        }
    }, [intersectionImage]);

    useEffect(() => {
        safeLocalStorage.setItem('trafficIntersectionArrows', JSON.stringify(intersectionArrows));
    }, [intersectionArrows]);

    // Save traffic datasets to localStorage
    useEffect(() => {
        safeLocalStorage.setItem('trafficDatasets', JSON.stringify(trafficDatasets));
        safeLocalStorage.setItem('trafficActiveDataset', activeTrafficDataset);
    }, [trafficDatasets, activeTrafficDataset]);

    // Auto-save current project to cache (debounced)
    const autoSaveTimerRef = useRef(null);
    useEffect(() => {
        // Skip during initial load or project loading
        if (isInitialLoadRef.current || isLoadingProjectRef.current) return;

        // Skip if no project name
        if (!intersectionName || intersectionName === 'Nouveau Carrefour') return;

        // Debounce: save after 2 seconds of inactivity
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            try {
                const projectData = {
                    groups,
                    cycleLength,
                    conflictMatrix,
                    pfTabs,
                    activePFId,
                    intersectionImage,
                    intersectionArrows,
                    trafficDatasets,
                    activeTrafficDataset,
                    dependencyGap,
                    savedAt: new Date().toISOString()
                };
                const jsonData = JSON.stringify(projectData);

                // Save project
                safeLocalStorage.setItem(`traffic_project_${intersectionName}`, jsonData);

                // Update order and clean up old projects
                updateProjectOrder(intersectionName);
            } catch (e) {
                console.warn('Auto-save failed:', e);
            }
        }, 2000);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [groups, cycleLength, conflictMatrix, pfTabs, activePFId, intersectionImage, intersectionArrows, trafficDatasets, activeTrafficDataset, dependencyGap, intersectionName]);

    // Update traffic data for a specific group in the active dataset
    const updateTrafficData = useCallback((groupId, field, value) => {
        setTrafficDatasets(prev => {
            const newDatasets = { ...prev };
            if (!newDatasets[activeTrafficDataset]) {
                newDatasets[activeTrafficDataset] = {};
            }
            if (!newDatasets[activeTrafficDataset][groupId]) {
                newDatasets[activeTrafficDataset][groupId] = createEmptyTrafficData();
            }
            newDatasets[activeTrafficDataset][groupId] = {
                ...newDatasets[activeTrafficDataset][groupId],
                [field]: value
            };
            return newDatasets;
        });
    }, [activeTrafficDataset]);

    // Get traffic data for a specific group in the active dataset
    const getTrafficData = useCallback((groupId) => {
        if (!trafficDatasets[activeTrafficDataset]) {
            return createEmptyTrafficData();
        }
        return trafficDatasets[activeTrafficDataset][groupId] || createEmptyTrafficData();
    }, [trafficDatasets, activeTrafficDataset]);

    // Copy traffic data from one dataset to another
    const copyTrafficDataset = useCallback((sourceDataset, targetDataset) => {
        setTrafficDatasets(prev => {
            const newDatasets = { ...prev };
            // Ensure target dataset exists
            if (!newDatasets[targetDataset]) {
                newDatasets[targetDataset] = {};
            }
            // Copy all data from source to target
            if (newDatasets[sourceDataset]) {
                Object.keys(newDatasets[sourceDataset]).forEach(groupId => {
                    newDatasets[targetDataset][groupId] = { ...newDatasets[sourceDataset][groupId] };
                });
            }
            return newDatasets;
        });
    }, []);

    // Ensure traffic datasets have entries for all groups when group count changes
    useEffect(() => {
        setTrafficDatasets(prev => {
            const newDatasets = { ...prev };
            let changed = false;
            TRAFFIC_DATASETS.forEach(ds => {
                if (!newDatasets[ds]) {
                    newDatasets[ds] = {};
                    changed = true;
                }
                groups.forEach(g => {
                    if (!newDatasets[ds][g.id]) {
                        newDatasets[ds][g.id] = createEmptyTrafficData();
                        changed = true;
                    }
                });
            });
            return changed ? newDatasets : prev;
        });
    }, [groups]);

    // Note: Simulation state is NOT saved to localStorage (per user request)

    // Save current state to history (for undo)
    const saveToHistory = useCallback(() => {
        if (isUndoing.current || isRedoing.current) return; // Don't save during undo/redo

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

        // Clear redo history when a new action is performed
        setRedoHistory([]);
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

        // Save current state to redo history before restoring
        const currentState = {
            groups: JSON.parse(JSON.stringify(groups)),
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            pfTabs: JSON.parse(JSON.stringify(pfTabs)),
            activePFId,
            cycleLength,
            intersectionName
        };
        setRedoHistory(prev => [...prev, currentState]);

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
    }, [history, groups, conflictMatrix, pfTabs, activePFId, cycleLength, intersectionName]);

    // Redo function
    const redo = useCallback(() => {
        if (redoHistory.length === 0) return false;

        isRedoing.current = true;

        // Save current state to history before restoring
        const currentState = {
            groups: JSON.parse(JSON.stringify(groups)),
            conflictMatrix: JSON.parse(JSON.stringify(conflictMatrix)),
            pfTabs: JSON.parse(JSON.stringify(pfTabs)),
            activePFId,
            cycleLength,
            intersectionName
        };
        setHistory(prev => [...prev, currentState]);

        const nextState = redoHistory[redoHistory.length - 1];

        // Restore next state
        setGroups(nextState.groups);
        setConflictMatrix(nextState.conflictMatrix);
        if (nextState.pfTabs) {
            setPfTabs(nextState.pfTabs);
            setActivePFId(nextState.activePFId);
        }
        setCycleLength(nextState.cycleLength);
        setIntersectionName(nextState.intersectionName);

        // Remove the last redo history entry
        setRedoHistory(prev => prev.slice(0, -1));

        // Reset the flag after a short delay
        setTimeout(() => {
            isRedoing.current = false;
        }, 100);

        return true;
    }, [redoHistory, groups, conflictMatrix, pfTabs, activePFId, cycleLength, intersectionName]);

    // Wrapped update functions that save to history (skip if dragging)
    const updateActionRowWithHistory = useCallback((rowId, field, value) => {
        if (!isDragging.current) {
            saveToHistory();
        }
        setActionData(prev => prev.map(row =>
            row.id === rowId ? { ...row, [field]: value } : row
        ));
    }, [saveToHistory]);

    // Wrapped setCycleLength that saves to history
    const setCycleLengthWithHistory = useCallback((newCycle) => {
        if (newCycle === cycleLength) return; // No change
        saveToHistory();
        setCycleLength(newCycle);
    }, [saveToHistory, cycleLength]);

    // Wrapped setGroupCount that saves to history
    const setGroupCountWithHistory = useCallback((count) => {
        const newCount = Math.max(1, parseInt(count) || 1);
        if (newCount === groups.length) return; // No change
        saveToHistory();
        setGroupCountInternal(count);
    }, [saveToHistory, groups.length]);

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

    // Reduce time at a given position for a given duration
    const reduceTime = useCallback((startSecond, duration) => {
        saveToHistory();
        const endSecond = startSecond + duration;
        setGroups(currentGroups => {
            return currentGroups.map(g => {
                const offset = g.offset;
                // If group starts at or after the end of reduced zone, shift it backward
                if (offset >= endSecond) {
                    return {
                        ...g,
                        offset: offset - duration
                    };
                }
                // If group starts within the reduced zone, clamp to startSecond
                if (offset > startSecond && offset < endSecond) {
                    return {
                        ...g,
                        offset: startSecond
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
                    if (deb >= endSecond) {
                        newRow.deb = (deb - duration).toString();
                    } else if (deb > startSecond && deb < endSecond) {
                        newRow.deb = startSecond.toString();
                    }
                }
                if (newRow.fin !== '' && newRow.fin !== undefined) {
                    const fin = parseInt(newRow.fin);
                    if (fin >= endSecond) {
                        newRow.fin = (fin - duration).toString();
                    } else if (fin > startSecond && fin < endSecond) {
                        newRow.fin = startSecond.toString();
                    }
                }
                return newRow;
            });
        });
        // Decrease cycle length
        setCycleLength(prev => Math.max(1, prev - duration));
    }, [saveToHistory]);

    return {
        intersectionName,
        setIntersectionName,
        groups,
        setGroupCount: setGroupCountWithHistory,
        cycleLength,
        setCycleLength: setCycleLengthWithHistory,
        dependencyGap,
        setDependencyGap,
        externalLinks,
        setExternalLinks,
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
        moveGroupToPosition,
        // Save/Load
        saveProject,
        loadProject,
        getAllSaves,
        getProjectData,
        deleteSave,
        getFullState,
        loadFullState,
        resetToNewProject,
        // Action Table
        actionData,
        updateActionRow: updateActionRowWithHistory,
        reorderActions,
        microCustomFields,
        updateMicroCustomField,
        // Phasage bulle (per PF)
        phasageBulleCount,
        phasageBulleTimes,
        setPhasageBulleCount,
        setPhasageBulleTimes,
        // PF (Plans de Feux) management
        pfTabs,
        activePFId,
        setActivePFId,
        duplicatePF,
        deletePF,
        renamePF,
        setPFColor,
        updatePFRemarques,
        currentRemarques: pfTabs.find(pf => pf.id === activePFId)?.remarques || '',
        // Undo/Redo
        undo,
        redo,
        canUndo: history.length > 0,
        canRedo: redoHistory.length > 0,
        // Drag helpers (for saving history only once per drag)
        startDrag,
        endDrag,
        // Diagram operations
        slideAllGroups,
        insertTime,
        reduceTime,
        // Simulation mode
        simulationEnabled,
        setSimulationEnabled,
        simulationSelectedActions,
        toggleSimulationAction,
        selectAllSimulationActions,
        deselectAllSimulationActions,
        // Intersection image
        intersectionImage,
        setIntersectionImage,
        intersectionArrows,
        setIntersectionArrows,
        // Traffic datasets
        trafficDatasets,
        activeTrafficDataset,
        setActiveTrafficDataset,
        updateTrafficData,
        getTrafficData,
        trafficDatasetNames,
        copyTrafficDataset
    };
};
