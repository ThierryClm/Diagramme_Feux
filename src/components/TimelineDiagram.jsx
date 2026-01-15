import React, { useRef, useState, useCallback, useEffect } from 'react';
import './TimelineDiagram.css';

const TimelineDiagram = ({ groups, globalTime, onGroupClick, pixelsPerSecond = 3, conflicts, conflictMatrix = [], updateGroupParams, cycleLength, actionData = [], updateActionRow, startDrag, endDrag, showDependencies = false, hoveredActionId, setHoveredActionId, simulationFilter = null, simulationResult = null, simulationCurrentTime = null, isPlayingSimulation = false, hoveredArrowGroupId = null }) => {
    const containerRef = useRef(null);

    // Drag state - supports both group bars and action overlays
    const [dragState, setDragState] = useState(null);
    // dragState = { groupId, type: 'start' | 'end', initialMouseX, initialValue }
    // OR dragState = { actionId, field: 'deb' | 'fin', initialMouseX, initialValue }
    // Use simulated cycle length when in simulation mode
    const effectiveCycleLength = simulationResult ? simulationResult.simulatedCycleLength : cycleLength;
    const TIME_WINDOW = effectiveCycleLength || 100; // Use cycle length as time window

    // Determine total width in pixels
    const totalWidth = TIME_WINDOW * pixelsPerSecond;

    // Helper to get simulated group data
    const getSimulatedGroup = (groupId) => {
        if (!simulationResult) return null;
        return simulationResult.simulatedGroups.find(g => g.id === groupId);
    };

    // Helper to get the shift amount for a group (how much its offset changed)
    // Returns the difference: originalOffset - simulatedOffset (positive = shifted left)
    const getGroupShift = (groupId) => {
        if (!simulationResult) return 0;
        const originalGroup = groups.find(g => g.id === parseInt(groupId));
        const simGroup = simulationResult.simulatedGroups.find(g => g.id === parseInt(groupId));
        if (!originalGroup || !simGroup) return 0;

        // Calculate shift (positive = moved left/earlier)
        const cycle = simulationResult.simulatedCycleLength || cycleLength;
        let shift = originalGroup.offset - simGroup.simulatedOffset;

        // Handle wrap-around: normalize to [0, cycle)
        shift = ((shift % cycle) + cycle) % cycle;

        // If shift is more than half the cycle, it's actually a shift to the right
        // For "Fermeture anticipée" glissement, we want left shifts only
        if (shift > cycle / 2) {
            return 0; // No left shift
        }

        return shift;
    };

    // Helper to calculate shifted position for action overlays
    // Returns adjusted deb/fin values after applying time shifts
    // Also returns hidden=true if the action is within a removed period
    // actionType: optional action type - "Seconde lucarne" is NOT shifted by group glissement
    const getShiftedActionPosition = (deb, fin, groupId = null, actionType = null) => {
        let hidden = false;
        let totalShift = 0;

        // Check if action falls within any removed period
        // NOTE: 'Escamotage de phase' is NOT hidden by removed periods - it's reduced in width instead
        if (simulationResult?.removedPeriods?.length && actionType !== 'Escamotage de phase') {
            for (const period of simulationResult.removedPeriods) {
                // Action is hidden if it's entirely within or overlaps the removed period
                if (deb >= period.deb && deb < period.fin) {
                    hidden = true;
                    break;
                }
                if (fin > period.deb && fin <= period.fin) {
                    hidden = true;
                    break;
                }
                if (deb <= period.deb && fin >= period.fin) {
                    hidden = true;
                    break;
                }
            }
        }

        // If we have a groupId, use the actual group shift (more accurate for Adaptatif vertical)
        // NOTE: "Seconde lucarne" actions are NOT shifted by group glissement (from Fermeture anticipée)
        if (groupId && simulationResult && actionType !== 'Seconde lucarne') {
            const groupShift = getGroupShift(groupId);
            if (groupShift > 0) {
                totalShift = groupShift;
            }
        }

        // Actions that should be shifted by Adaptatif vertical or Escamotage de phase
        const adaptatifShiftableActions = [
            'Seconde lucarne',
            'Fermeture anticipée',
            'Priorité piétons',
            'Escamotage',
            'Ouverture anticipée',
            'Signa d\'aide à la conduite',
            'Adaptatif vertical',
            'Escamotage de phase'
        ];

        // Find stopping points (Point de repos, Synchro BTS)
        const stoppingActions = actionData.filter(a =>
            (a.action === 'Point de repos' || a.action === 'Synchro BTS') &&
            a.deb !== ''
        );
        let maxStopTime = -1;
        stoppingActions.forEach(stopAction => {
            const stopTime = parseInt(stopAction.deb) || 0;
            if (stopTime > maxStopTime) {
                maxStopTime = stopTime;
            }
        });

        // Also apply global time shifts (from Escamotage de phase and Adaptatif vertical)
        if (simulationResult?.timeShifts?.length) {
            simulationResult.timeShifts.forEach(shift => {
                if (shift.plage1 && shift.plage2) {
                    // This is PARTIAL Adaptatif vertical shift - apply to specific action types
                    // BUT NOT to 'Adaptatif vertical' or 'Escamotage de phase' overlays themselves
                    // Only if action is after the adaptatif zone and before stopping point
                    const excludedFromPartialShift = ['Adaptatif vertical', 'Escamotage de phase'];
                    if (adaptatifShiftableActions.includes(actionType) && !excludedFromPartialShift.includes(actionType)) {
                        const isAfterZone = deb >= shift.from;
                        const isBeforeStop = maxStopTime < 0 || deb <= maxStopTime;
                        if (isAfterZone && isBeforeStop) {
                            totalShift += shift.amount;
                        }
                    }
                } else {
                    // Global shift (Escamotage de phase or FULL Adaptatif vertical) - apply if position is after the shift point
                    if (deb >= shift.from) {
                        totalShift += shift.amount;
                    }
                }
            });
        }

        // Apply shift with wrap-around handling
        const cycle = effectiveCycleLength || cycleLength;
        const shiftedDeb = ((deb - totalShift) % cycle + cycle) % cycle;
        const shiftedFin = ((fin - totalShift) % cycle + cycle) % cycle;

        return { deb: shiftedDeb, fin: shiftedFin, hidden };
    };

    // Handlers (Duplicated from GroupTable logic, could be extracted to hook)
    const handleStartChange = (id, value) => {
        updateGroupParams(id, { offset: parseInt(value) || 0 });
    };

    const handleDurationChange = (id, value) => {
        updateGroupParams(id, { durations: { green: parseInt(value) || 0 } });
    };

    const handleEndChange = (id, endValue, startValue) => {
        let duration = (parseInt(endValue) || 0) - startValue;
        if (duration < 0) duration += cycleLength;
        updateGroupParams(id, { durations: { green: Math.max(0, duration) } });
    };

    // Drag handlers for resizing phase bars
    const handleDragStart = useCallback((e, groupId, type, currentValue) => {
        e.stopPropagation();
        e.preventDefault();
        if (startDrag) startDrag(); // Save history once at drag start

        // Store initial values for linked "Début de bande passante" actions (linked to START of green)
        let linkedDebutBandeActions = [];
        if (type === 'start' && actionData) {
            linkedDebutBandeActions = actionData
                .filter(action => {
                    const rowGf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                    return rowGf === groupId &&
                        action.action === 'Début de bande passante' &&
                        action.deb !== '';
                })
                .map(action => ({
                    id: action.id,
                    initialDeb: parseInt(action.deb) || 0,
                    initialFin: action.fin !== '' ? parseInt(action.fin) || 0 : null
                }));
        }

        // Store initial values for linked "Fin de bande passante" actions (linked to END of green)
        let linkedFinBandeActions = [];
        if (type === 'end' && actionData) {
            linkedFinBandeActions = actionData
                .filter(action => {
                    const rowGf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                    return rowGf === groupId &&
                        action.action === 'Fin de bande passante' &&
                        action.deb !== '';
                })
                .map(action => ({
                    id: action.id,
                    initialDeb: parseInt(action.deb) || 0,
                    initialFin: action.fin !== '' ? parseInt(action.fin) || 0 : null
                }));
        }

        setDragState({
            groupId,
            type, // 'start' or 'end'
            initialMouseX: e.clientX,
            initialValue: currentValue,
            linkedDebutBandeActions, // Store initial values of linked "Début de bande passante" actions
            linkedFinBandeActions // Store initial values of linked "Fin de bande passante" actions
        });
    }, [startDrag, actionData]);

    // Drag handler for action overlays
    const handleActionDragStart = useCallback((e, actionId, field, currentValue) => {
        e.stopPropagation();
        e.preventDefault();
        if (startDrag) startDrag(); // Save history once at drag start

        // For "Début de bande passante" and "Fin de bande passante", store initial fin value when dragging deb
        const action = actionData.find(a => a.id === actionId);
        let initialFinValue = null;
        if (action &&
            (action.action === 'Début de bande passante' || action.action === 'Fin de bande passante') &&
            field === 'deb' &&
            action.fin !== '') {
            initialFinValue = parseInt(action.fin) || 0;
        }

        setDragState({
            actionId,
            field, // 'deb' or 'fin'
            initialMouseX: e.clientX,
            initialValue: parseInt(currentValue) || 0,
            initialFinValue // Store initial fin value for bande passante
        });
    }, [startDrag, actionData]);

    const handleDragMove = useCallback((e) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.initialMouseX;
        const deltaSeconds = Math.round(deltaX / pixelsPerSecond);

        // Handle action overlay drag
        if (dragState.actionId !== undefined && updateActionRow) {
            let newValue = dragState.initialValue + deltaSeconds;
            // Wrap around cycle length
            newValue = ((newValue % cycleLength) + cycleLength) % cycleLength;

            // For "Début de bande passante" and "Fin de bande passante", when dragging 'deb', also update 'fin' to maintain the gap
            if (dragState.initialFinValue !== null && dragState.initialFinValue !== undefined) {
                const newFin = ((dragState.initialFinValue + deltaSeconds) % cycleLength + cycleLength) % cycleLength;
                updateActionRow(dragState.actionId, 'deb', newValue.toString());
                updateActionRow(dragState.actionId, 'fin', newFin.toString());
            } else {
                updateActionRow(dragState.actionId, dragState.field, newValue.toString());
            }
            return;
        }

        // Handle group bar drag
        if (dragState.type === 'start') {
            // Dragging start (offset)
            let newOffset = dragState.initialValue + deltaSeconds;
            // Wrap around cycle
            newOffset = ((newOffset % cycleLength) + cycleLength) % cycleLength;

            // Also adjust duration to keep end position fixed
            const group = groups.find(g => g.id === dragState.groupId);
            if (group) {
                const oldEnd = (group.offset + group.durations.green) % cycleLength;
                let newDuration = oldEnd - newOffset;
                if (newDuration <= 0) newDuration += cycleLength;
                if (newDuration > 0 && newDuration <= cycleLength) {
                    // Update group offset and duration WITHOUT triggering bande passante update in useTrafficLight
                    // We handle bande passante update manually here using stored initial values
                    updateGroupParams(dragState.groupId, {
                        offset: newOffset,
                        durations: { green: newDuration }
                    });

                    // Update linked "Début de bande passante" actions
                    // using stored initial values to avoid drift
                    if (dragState.linkedDebutBandeActions && dragState.linkedDebutBandeActions.length > 0 && updateActionRow) {
                        dragState.linkedDebutBandeActions.forEach(linkedAction => {
                            const newDeb = ((linkedAction.initialDeb + deltaSeconds) % cycleLength + cycleLength) % cycleLength;
                            updateActionRow(linkedAction.id, 'deb', newDeb.toString());
                            if (linkedAction.initialFin !== null) {
                                const newFin = ((linkedAction.initialFin + deltaSeconds) % cycleLength + cycleLength) % cycleLength;
                                updateActionRow(linkedAction.id, 'fin', newFin.toString());
                            }
                        });
                    }
                }
            }
        } else if (dragState.type === 'end') {
            // Dragging end (duration)
            const group = groups.find(g => g.id === dragState.groupId);
            if (group) {
                const offset = group.offset % cycleLength;
                let newEnd = dragState.initialValue + deltaSeconds;
                // Wrap around cycle
                newEnd = ((newEnd % cycleLength) + cycleLength) % cycleLength;
                let newDuration = newEnd - offset;
                if (newDuration <= 0) newDuration += cycleLength;
                if (newDuration > 0 && newDuration <= cycleLength) {
                    updateGroupParams(dragState.groupId, { durations: { green: newDuration } });

                    // Update linked "Fin de bande passante" actions
                    // using stored initial values to avoid drift
                    if (dragState.linkedFinBandeActions && dragState.linkedFinBandeActions.length > 0 && updateActionRow) {
                        dragState.linkedFinBandeActions.forEach(linkedAction => {
                            const newDeb = ((linkedAction.initialDeb + deltaSeconds) % cycleLength + cycleLength) % cycleLength;
                            updateActionRow(linkedAction.id, 'deb', newDeb.toString());
                            if (linkedAction.initialFin !== null) {
                                const newFin = ((linkedAction.initialFin + deltaSeconds) % cycleLength + cycleLength) % cycleLength;
                                updateActionRow(linkedAction.id, 'fin', newFin.toString());
                            }
                        });
                    }
                }
            }
        }
    }, [dragState, pixelsPerSecond, cycleLength, groups, updateGroupParams, updateActionRow]);

    const handleDragEnd = useCallback(() => {
        if (endDrag) endDrag(); // End drag mode
        setDragState(null);
    }, [endDrag]);

    // Global mouse event listeners for drag
    useEffect(() => {
        if (dragState) {
            const handleMouseMove = (e) => handleDragMove(e);
            const handleMouseUp = () => handleDragEnd();

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragState, handleDragMove, handleDragEnd]);

    // Helper to get actions for a specific group
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    const getActionsForGroup = (groupId) => {
        return actionData.filter(action => {
            const gf = action.gf?.toString().replace(/[Gg]/g, '').trim();
            return gf === groupId.toString() && action.deb !== '' && action.fin !== '' &&
                (!simulationFilter || !simulationFilter.has(action.id));
        });
    };

    // Get SELECTED "Escamotage de phase" actions (for hiding overlays and arrows within their range)
    const selectedEscamotageDePhase = simulationFilter ? actionData.filter(action =>
        action.action === 'Escamotage de phase' && action.deb !== '' && action.fin !== '' &&
        simulationFilter.has(action.id)
    ) : [];

    // Get SELECTED "Adaptatif vertical" actions (for hiding arrows within their range)
    const selectedAdaptatifVertical = simulationFilter ? actionData.filter(action =>
        action.action === 'Adaptatif vertical' && action.deb !== '' && action.fin !== '' &&
        simulationFilter.has(action.id)
    ) : [];

    // Helper to check if a time range overlaps with any selected Escamotage de phase or Adaptatif vertical
    const isWithinSelectedEscamotageOrAdaptatif = (deb, fin) => {
        const allSelectedZones = [...selectedEscamotageDePhase, ...selectedAdaptatifVertical];
        if (allSelectedZones.length === 0) return false;
        for (const zone of allSelectedZones) {
            const zoneDeb = parseInt(zone.deb) || 0;
            const zoneFin = parseInt(zone.fin) || 0;
            // Check if ranges overlap (handling wrap-around)
            if (zoneDeb <= zoneFin) {
                // Normal case: zone doesn't wrap
                if (deb >= zoneDeb && deb < zoneFin) return true;
                if (fin > zoneDeb && fin <= zoneFin) return true;
                if (deb <= zoneDeb && fin >= zoneFin) return true;
            } else {
                // Zone wraps around cycle
                if (deb >= zoneDeb || deb < zoneFin) return true;
                if (fin > zoneDeb || fin <= zoneFin) return true;
            }
        }
        return false;
    };

    // Helper to check if a time range overlaps with any selected Escamotage de phase only
    const isWithinSelectedEscamotage = (deb, fin) => {
        if (selectedEscamotageDePhase.length === 0) return false;
        for (const escamotage of selectedEscamotageDePhase) {
            const escDeb = parseInt(escamotage.deb) || 0;
            const escFin = parseInt(escamotage.fin) || 0;
            // Check if ranges overlap (handling wrap-around)
            if (escDeb <= escFin) {
                // Normal case: escamotage doesn't wrap
                if (deb >= escDeb && deb < escFin) return true;
                if (fin > escDeb && fin <= escFin) return true;
                if (deb <= escDeb && fin >= escFin) return true;
            } else {
                // Escamotage wraps around cycle
                if (deb >= escDeb || deb < escFin) return true;
                if (fin > escDeb || fin <= escFin) return true;
            }
        }
        return false;
    };

    // Get all "Adaptatif vertical" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase
    const adaptatifActions = actionData.filter(action => {
        if (action.action !== 'Adaptatif vertical' || action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Hide if within a selected Escamotage de phase
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        if (isWithinSelectedEscamotage(deb, fin)) return false;
        return true;
    });

    // Get all "Fermeture anticipée" actions with arrows and braces
    // In simulation mode: show overlay and arrows when action is UNCHECKED (inverted logic)
    // Arrows and braces are inseparable - they appear/disappear together
    // Also hide if within a SELECTED Escamotage de phase
    const fermetureActions = actionData.filter(action => {
        if (action.action !== 'Fermeture anticipée' || action.deb === '' || action.fin === '') return false;
        if (!(action.actGf1 || action.actGf1Gf2 || action.actGf1Gf3 || action.actGf1Gf4)) return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Hide if within a selected Escamotage de phase
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        if (isWithinSelectedEscamotage(deb, fin)) return false;
        return true;
    });

    // Get all "Escamotage de phase" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    const escamotageActions = actionData.filter(action =>
        action.action === 'Escamotage de phase' && action.deb !== '' && action.fin !== '' &&
        (!simulationFilter || !simulationFilter.has(action.id))
    );

    // Get all "Escamotage" actions (linked to specific group via actGf1)
    // No deb/fin required - arrows are calculated from group times and intergreen
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    const escamotageGroupActions = actionData.filter(action =>
        action.action === 'Escamotage' && action.gf && action.actGf1 &&
        (!simulationFilter || !simulationFilter.has(action.id))
    );

    // Get all "Signa d'aide à la conduite" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    const signaActions = actionData.filter(action => {
        if (action.action !== 'Signa d\'aide à la conduite') return false;
        if (action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        if (deb === fin) return false;
        // Only show if orange zone exists (fin - 5 > deb)
        if (fin - 5 <= deb) return false;
        return true;
    });

    // Get all "Point de repos" actions
    // In simulation mode: show overlay ONLY when action is CHECKED (normal logic - hidden by default)
    // If plage2 is not set, default to groups.length (total number of groups)
    const pointReposActions = actionData.filter(action => {
        if (action.action !== 'Point de repos') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        // plage1 must be valid (>= 1), plage2 defaults to groups.length if not set
        const p1 = parseInt(action.plage1);
        if (isNaN(p1) || p1 < 1) return false;
        if (simulationFilter && !simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage2: (action.plage2 === '' || action.plage2 === undefined || isNaN(parseInt(action.plage2)) || parseInt(action.plage2) < 1)
            ? groups.length
            : action.plage2
    }));

    // Get all "Synchro BTS" actions
    // In simulation mode: show overlay ONLY when action is CHECKED (normal logic - hidden by default)
    // If plage2 is not set, default to groups.length (total number of groups)
    const synchroBtsActions = actionData.filter(action => {
        if (action.action !== 'Synchro BTS') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        // plage1 must be valid (>= 1), plage2 defaults to groups.length if not set
        const p1 = parseInt(action.plage1);
        if (isNaN(p1) || p1 < 1) return false;
        if (simulationFilter && !simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage2: (action.plage2 === '' || action.plage2 === undefined || isNaN(parseInt(action.plage2)) || parseInt(action.plage2) < 1)
            ? groups.length
            : action.plage2
    }));

    // Get all "Instant Co" actions
    // In simulation mode: show overlay ONLY when action is CHECKED (normal logic - hidden by default)
    // If plage2 is not set, default to groups.length (total number of groups)
    const instantCoActions = actionData.filter(action => {
        if (action.action !== 'Instant Co') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        // plage1 must be valid (>= 1), plage2 defaults to groups.length if not set
        const p1 = parseInt(action.plage1);
        if (isNaN(p1) || p1 < 1) return false;
        if (simulationFilter && !simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage2: (action.plage2 === '' || action.plage2 === undefined || isNaN(parseInt(action.plage2)) || parseInt(action.plage2) < 1)
            ? groups.length
            : action.plage2
    }));

    // Get all "Priorité piétons" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase or Adaptatif vertical
    const prioritePietonsActions = actionData.filter(action => {
        if (action.action !== 'Priorité piétons') return false;
        if (action.gf === '' || action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Hide if within a selected Escamotage de phase or Adaptatif vertical
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        if (isWithinSelectedEscamotageOrAdaptatif(deb, fin)) return false;
        return true;
    });

    // Get all "Début de bande passante" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase or Adaptatif vertical
    const debutBandeActions = actionData.filter(action => {
        if (action.action !== 'Début de bande passante') return false;
        if (action.gf === '' || action.deb === '' || action.fin === '' || action.actGf1 === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Hide if within a selected Escamotage de phase or Adaptatif vertical
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        if (isWithinSelectedEscamotageOrAdaptatif(deb, fin)) return false;
        return true;
    });

    // Get all "Fin de bande passante" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase or Adaptatif vertical
    const finBandeActions = actionData.filter(action => {
        if (action.action !== 'Fin de bande passante') return false;
        if (action.gf === '' || action.deb === '' || action.fin === '' || action.actGf1 === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Hide if within a selected Escamotage de phase or Adaptatif vertical
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        if (isWithinSelectedEscamotageOrAdaptatif(deb, fin)) return false;
        return true;
    });

    const ROW_HEIGHT = 30; // Height of each row in pixels
    const RULER_HEIGHT = 50; // Height of the ruler

    // Helper to get group start position (beginning of green bar on screen)
    // Uses simulated offset when in simulation mode
    const getGroupStartPos = (groupId) => {
        const group = groups.find(g => g.id === parseInt(groupId));
        if (!group) return null;

        // In simulation mode, use simulated offset if available
        if (simulationResult) {
            const simGroup = simulationResult.simulatedGroups.find(g => g.id === parseInt(groupId));
            if (simGroup) {
                return simGroup.simulatedOffset % effectiveCycleLength;
            }
        }

        // The sidebar shows start = offset, so the green begins at position offset
        return group.offset % cycleLength;
    };

    // Helper to get group end position (end of green bar on screen)
    // Uses simulated offset when in simulation mode
    const getGroupEndPos = (groupId) => {
        const group = groups.find(g => g.id === parseInt(groupId));
        if (!group) return null;

        let startPos;
        // In simulation mode, use simulated offset if available
        if (simulationResult) {
            const simGroup = simulationResult.simulatedGroups.find(g => g.id === parseInt(groupId));
            if (simGroup) {
                startPos = simGroup.simulatedOffset % effectiveCycleLength;
            } else {
                startPos = group.offset % cycleLength;
            }
        } else {
            startPos = group.offset % cycleLength;
        }

        const greenDuration = group.durations?.green || 0;
        const cycle = simulationResult ? effectiveCycleLength : cycleLength;
        return (startPos + greenDuration) % cycle;
    };

    // Helper to check if a group wraps around the cycle (green crosses cycle boundary)
    const doesGroupWrap = (groupId) => {
        const group = groups.find(g => g.id === parseInt(groupId));
        if (!group) return false;

        let startPos;
        if (simulationResult) {
            const simGroup = simulationResult.simulatedGroups.find(g => g.id === parseInt(groupId));
            if (simGroup) {
                startPos = simGroup.simulatedOffset % effectiveCycleLength;
            } else {
                startPos = group.offset % cycleLength;
            }
        } else {
            startPos = group.offset % cycleLength;
        }

        const greenDuration = group.durations?.green || 0;
        const cycle = simulationResult ? effectiveCycleLength : cycleLength;
        return (startPos + greenDuration) > cycle;
    };

    return (
        <div className={`timeline-container ${dragState ? 'dragging' : ''}`} ref={containerRef}>
            <h3 className="diagram-title">Diagramme</h3>
            <div className="timeline-layout">
                <div className="timeline-sidebar">
                    {/* Header Label for Sidebar */}
                    <div className="sidebar-header-row">
                        <span className="col-label col-grp">Grp</span>
                        <span className="col-label col-name">Nom</span>
                        <span className="col-label col-da">DA</span>
                        <span className="col-label col-time">Déb</span>
                        <span className="col-label col-time">Fin</span>
                        <span className="col-label col-time">Dur</span>
                    </div>

                    {groups.map(g => {
                        const start = g.offset % cycleLength;
                        const duration = g.durations.green;
                        const end = (start + duration) % cycleLength;
                        // Show both values if either is non-zero
                        const hasValue = start > 0 || end > 0;

                        return (
                            <div key={g.id} className="row-label-container" onClick={() => onGroupClick(g)}>
                                <span className="label-id">{g.id}</span>
                                <span
                                    className="label-name"
                                    title={g.name}
                                    style={{
                                        backgroundColor:
                                            g.type === 'VL' ? 'rgba(100, 180, 255, 0.25)' :
                                            g.type === 'TC' ? 'rgba(148, 0, 211, 0.1)' :
                                            g.type === 'Piéton' ? 'rgba(0, 255, 0, 0.1)' :
                                            g.type === 'Cycliste' ? 'rgba(255, 255, 0, 0.1)' :
                                            'transparent'
                                    }}
                                >{g.name || '-'}</span>
                                <input
                                    type="text"
                                    className="input-da"
                                    value={g.da || ''}
                                    onChange={(e) => updateGroupParams(g.id, { da: e.target.value.slice(0, 2) })}
                                    onClick={(e) => e.stopPropagation()}
                                    title="DA (Délai d'approche)"
                                    maxLength={2}
                                    placeholder=""
                                />
                                <input
                                    type="number"
                                    className="input-time-sm"
                                    value={hasValue ? start : ''}
                                    onChange={(e) => handleStartChange(g.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Début"
                                    placeholder=""
                                />
                                <input
                                    type="number"
                                    className="input-time-sm"
                                    value={hasValue ? end : ''}
                                    onChange={(e) => handleEndChange(g.id, e.target.value, start)}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Fin"
                                    style={{ color: duration < g.minGreen ? '#ff4d4d' : 'inherit' }}
                                    placeholder=""
                                />
                                <input
                                    type="number"
                                    className="input-time-sm"
                                    value={duration === 0 ? '' : duration}
                                    readOnly
                                    onClick={(e) => e.stopPropagation()}
                                    title="Durée (calculée automatiquement)"
                                    style={{
                                        color: duration < g.minGreen ? '#ff4d4d' : 'inherit',
                                        cursor: 'default',
                                        opacity: 0.8
                                    }}
                                    placeholder=""
                                />
                            </div>
                        );
                    })}
                </div>

                <div className="timeline-scroll-area">
                    <div className="timeline-track-container" style={{ width: `${totalWidth}px` }}>
                        {/* Grid lines */}
                        <div className="timeline-grid">
                            {Array.from({ length: TIME_WINDOW + 1 }).map((_, i) => {
                                let gridClass = 'grid-line grid-1s';
                                if (i % 10 === 0) gridClass = 'grid-line grid-10s';
                                else if (i % 5 === 0) gridClass = 'grid-line grid-5s';
                                return (
                                    <div
                                        key={i}
                                        className={gridClass}
                                        style={{ left: `${i * pixelsPerSecond}px` }}
                                    />
                                );
                            })}
                        </div>

                        {/* Ruler */}
                        <div className="timeline-ruler">
                            {Array.from({ length: TIME_WINDOW / 5 + 1 }).map((_, i) => (
                                <div key={i} className="ruler-tick" style={{ left: `${i * 5 * pixelsPerSecond}px` }}>
                                    {i * 5}
                                </div>
                            ))}
                        </div>

                        {/* Playhead - Simulation time cursor */}
                        {simulationCurrentTime !== null && (
                            <div
                                className={`simulation-playhead ${isPlayingSimulation ? 'playing' : ''}`}
                                style={{
                                    left: `${simulationCurrentTime * pixelsPerSecond}px`,
                                    height: `${RULER_HEIGHT + (groups.length * ROW_HEIGHT) + 30}px`
                                }}
                            >
                                <div className="playhead-time">{simulationCurrentTime}s</div>
                            </div>
                        )}

                        {/* Rows */}
                        {groups.map((group) => {
                            const groupActions = getActionsForGroup(group.id);
                            const isConflict = conflicts && conflicts.some(c => c.from === group.id || c.to === group.id);
                            const orangeDuration = group.durations.orange || 3;

                            // Get simulated group data if in simulation mode
                            const simGroup = getSimulatedGroup(group.id);
                            const isEscamoted = simGroup?.isEscamoted || false;

                            // Use simulated values when in simulation mode, otherwise use original values
                            const offset = simGroup
                                ? (simGroup.simulatedOffset % effectiveCycleLength)
                                : (group.offset % cycleLength);
                            const greenDuration = simGroup
                                ? simGroup.simulatedGreen
                                : group.durations.green;
                            const endValue = (offset + greenDuration) % effectiveCycleLength;
                            const hasPhase = !isEscamoted && (greenDuration > 0 || offset > 0 || endValue > 0);

                            // Calculate base bars from group offset/duration
                            const totalDuration = group.durations.green + group.durations.orange + group.durations.red;
                            const cyclesToRender = Math.ceil(TIME_WINDOW / totalDuration) + 1;

                            const isHighlightedByArrow = hoveredArrowGroupId === group.id;

                            return (
                                <div
                                    key={group.id}
                                    className={`timeline-row-track ${isConflict ? 'row-conflict' : ''} ${isHighlightedByArrow ? 'arrow-highlighted' : ''}`}
                                    onClick={() => onGroupClick(group)}
                                    style={{ backgroundColor: isConflict ? 'rgba(231, 76, 60, 0.1)' : isHighlightedByArrow ? 'rgba(100, 100, 255, 0.15)' : 'transparent' }}
                                >
                                    {/* Base bars from group Début/Fin (sidebar values) - only if phase exists */}
                                    {hasPhase && (() => {
                                        const isPedestrian = group.type === 'P' || group.type === 'Piéton';
                                        const isCyclist = group.type === 'CY' || group.type === 'Cycliste';
                                        // P (piéton) gets red bar (pedestrian-orange), CY (cycle) gets dashed red bar (cyclist-orange), others get yellow (orange)
                                        const orangeClass = isPedestrian ? 'pedestrian-orange' : isCyclist ? 'cyclist-orange' : 'orange';
                                        const orangeDur = group.durations.orange;
                                        const orangeWidth = orangeDur * pixelsPerSecond;

                                        // Check if green bar wraps around cycle
                                        const currentCycleLen = simGroup ? effectiveCycleLength : cycleLength;
                                        const greenWrapsAround = offset + greenDuration > currentCycleLen;
                                        // Check if orange bar wraps around cycle (for pedestrians and cyclists with their special display)
                                        const greenEnd = (offset + greenDuration) % currentCycleLen;
                                        const orangeEnd = (greenEnd + orangeDur) % currentCycleLen;
                                        const orangeWrapsAround = (isPedestrian || isCyclist) && (greenEnd + orangeDur > currentCycleLen);

                                        if (greenWrapsAround) {
                                            // Green bar wraps around
                                            const firstPartWidth = (currentCycleLen - offset) * pixelsPerSecond;
                                            const secondPartWidth = ((offset + greenDuration) % currentCycleLen) * pixelsPerSecond;

                                            // Check if orange also wraps
                                            if (orangeWrapsAround) {
                                                const orangeFirstPartWidth = (currentCycleLen - greenEnd) * pixelsPerSecond;
                                                const orangeSecondPartWidth = orangeEnd * pixelsPerSecond;

                                                return (
                                                    <React.Fragment>
                                                        {/* First part: from offset to end of cycle */}
                                                        <div
                                                            className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''}`}
                                                            style={{ left: `${offset * pixelsPerSecond}px` }}
                                                        >
                                                            <div
                                                                className="drag-handle drag-handle-start"
                                                                onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                                title="Glisser pour modifier le début"
                                                            />
                                                            <div className="phase-bar green" style={{ width: `${firstPartWidth}px` }}></div>
                                                        </div>
                                                        {/* Second part: green from 0 + orange first part to end of cycle */}
                                                        <div
                                                            className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''}`}
                                                            style={{ left: '0px' }}
                                                        >
                                                            <div className="phase-bar green" style={{ width: `${secondPartWidth}px` }}></div>
                                                            <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeFirstPartWidth}px` }}></div>
                                                            <div
                                                                className="drag-handle drag-handle-end"
                                                                onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                                                style={{ left: `${secondPartWidth}px` }}
                                                                title="Glisser pour modifier la fin"
                                                            />
                                                        </div>
                                                        {/* Third part: orange continuation at start of cycle */}
                                                        <div
                                                            className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''}`}
                                                            style={{ left: '0px' }}
                                                        >
                                                            <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeSecondPartWidth}px` }}></div>
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            }

                                            return (
                                                <React.Fragment>
                                                    {/* First part: from offset to end of cycle */}
                                                    <div
                                                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''}`}
                                                        style={{ left: `${offset * pixelsPerSecond}px` }}
                                                    >
                                                        <div
                                                            className="drag-handle drag-handle-start"
                                                            onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                            title="Glisser pour modifier le début"
                                                        />
                                                        <div className="phase-bar green" style={{ width: `${firstPartWidth}px` }}></div>
                                                    </div>
                                                    {/* Second part: from start of cycle to end */}
                                                    <div
                                                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''}`}
                                                        style={{ left: '0px' }}
                                                    >
                                                        <div className="phase-bar green" style={{ width: `${secondPartWidth}px` }}></div>
                                                        <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                        <div
                                                            className="drag-handle drag-handle-end"
                                                            onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                                            style={{ left: `${secondPartWidth}px` }}
                                                            title="Glisser pour modifier la fin"
                                                        />
                                                    </div>
                                                </React.Fragment>
                                            );
                                        }

                                        // Green doesn't wrap, but orange might wrap (for pedestrians/cyclists)
                                        const greenWidth = greenDuration * pixelsPerSecond;

                                        if (orangeWrapsAround) {
                                            const orangeFirstPartWidth = (currentCycleLen - greenEnd) * pixelsPerSecond;
                                            const orangeSecondPartWidth = orangeEnd * pixelsPerSecond;

                                            return (
                                                <React.Fragment>
                                                    {/* Main part: green + first part of orange */}
                                                    <div
                                                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''}`}
                                                        style={{ left: `${offset * pixelsPerSecond}px` }}
                                                    >
                                                        <div
                                                            className="drag-handle drag-handle-start"
                                                            onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                            title="Glisser pour modifier le début"
                                                        />
                                                        <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                                                        <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeFirstPartWidth}px` }}></div>
                                                        <div
                                                            className="drag-handle drag-handle-end"
                                                            onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                                            style={{ left: `${greenWidth}px` }}
                                                            title="Glisser pour modifier la fin"
                                                        />
                                                    </div>
                                                    {/* Orange continuation at start of cycle */}
                                                    <div
                                                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''}`}
                                                        style={{ left: '0px' }}
                                                    >
                                                        <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeSecondPartWidth}px` }}></div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        }

                                        // Normal case: neither wraps
                                        return (
                                            <div
                                                className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''}`}
                                                style={{ left: `${offset * pixelsPerSecond}px` }}
                                            >
                                                <div
                                                    className="drag-handle drag-handle-start"
                                                    onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                    title="Glisser pour modifier le début"
                                                />
                                                <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                                                <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                <div
                                                    className="drag-handle drag-handle-end"
                                                    onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                                    style={{ left: `${greenWidth}px` }}
                                                    title="Glisser pour modifier la fin"
                                                />
                                            </div>
                                        );
                                    })()}

                                    {/* Green cuts from Escamotage actions - mask portions of the green bar */}
                                    {simGroup?.greenCuts?.map((cut, idx) => {
                                        const cutDeb = cut.deb;
                                        const cutFin = cut.fin;
                                        const currentCycleLen = effectiveCycleLength || cycleLength;
                                        const wrapsAround = cutDeb > cutFin;

                                        if (wrapsAround) {
                                            // Cut wraps around cycle
                                            const firstPartWidth = (currentCycleLen - cutDeb) * pixelsPerSecond;
                                            const secondPartWidth = cutFin * pixelsPerSecond;
                                            return (
                                                <React.Fragment key={`green-cut-${idx}`}>
                                                    {/* First part: from cutDeb to end of cycle */}
                                                    <div
                                                        className="green-cut-overlay"
                                                        style={{
                                                            left: `${cutDeb * pixelsPerSecond}px`,
                                                            width: `${firstPartWidth}px`
                                                        }}
                                                    />
                                                    {/* Second part: from start of cycle to cutFin */}
                                                    <div
                                                        className="green-cut-overlay"
                                                        style={{
                                                            left: '0px',
                                                            width: `${secondPartWidth}px`
                                                        }}
                                                    />
                                                </React.Fragment>
                                            );
                                        }

                                        // Normal case: cut doesn't wrap
                                        const cutWidth = (cutFin - cutDeb) * pixelsPerSecond;
                                        return (
                                            <div
                                                key={`green-cut-${idx}`}
                                                className="green-cut-overlay"
                                                style={{
                                                    left: `${cutDeb * pixelsPerSecond}px`,
                                                    width: `${cutWidth}px`
                                                }}
                                            />
                                        );
                                    })}

                                    {/* Action-based overlays */}
                                    {groupActions.map((action, idx) => {
                                        const origDeb = parseInt(action.deb) || 0;
                                        const origFin = parseInt(action.fin) || 0;
                                        // Apply time shifts from escamotage/adaptatif
                                        // Pass action type to exclude "Seconde lucarne" from group shift
                                        const shifted = getShiftedActionPosition(origDeb, origFin, group.id, action.action);

                                        // Skip rendering if action is hidden (entirely within removed period)
                                        if (shifted.hidden) {
                                            return null;
                                        }

                                        const deb = shifted.deb;
                                        const fin = shifted.fin;
                                        const duration = fin >= deb ? fin - deb : (effectiveCycleLength - deb + fin);
                                        const leftPos = deb * pixelsPerSecond;
                                        const greenWidth = duration * pixelsPerSecond;
                                        const orangeWidth = orangeDuration * pixelsPerSecond;
                                        const abrv = action.abrv || '';
                                        const isHighlighted = hoveredActionId === action.id;

                                        return (
                                            <React.Fragment key={`action-${idx}`}>
                                                {/* Abrv label on the bar (not for Ouverture anticipée which has its own label) */}
                                                {abrv && action.action !== 'Ouverture anticipée' && (
                                                    <div
                                                        className="bar-label"
                                                        style={{
                                                            left: `${leftPos + 2}px`,
                                                            width: `${greenWidth - 4}px`
                                                        }}
                                                    >
                                                        {abrv}
                                                    </div>
                                                )}

                                                {/* Seconde lucarne: additional bar with darker green */}
                                                {action.action === 'Seconde lucarne' && (() => {
                                                    // Determine orange class based on group type
                                                    const isPedestrian = group.type === 'P' || group.type === 'Piéton';
                                                    const isCyclist = group.type === 'CY' || group.type === 'Cycliste';
                                                    const lucarneOrangeClass = isPedestrian ? 'pedestrian-orange' : isCyclist ? 'cyclist-orange' : 'orange';
                                                    const wrapsAround = deb > fin;
                                                    if (wrapsAround) {
                                                        const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                                        const secondPartWidth = fin * pixelsPerSecond;
                                                        return (
                                                            <React.Fragment>
                                                                {/* First part: from deb to end of cycle */}
                                                                <div
                                                                    className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: `${leftPos}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <div
                                                                        className="drag-handle drag-handle-start"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                                        title="Glisser pour modifier le début"
                                                                    />
                                                                    <div className="phase-bar green-dark" style={{ width: `${firstPartWidth}px` }}></div>
                                                                </div>
                                                                {/* Second part: from start of cycle to fin */}
                                                                <div
                                                                    className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: '0px' }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <div className="phase-bar green-dark" style={{ width: `${secondPartWidth}px` }}></div>
                                                                    <div className={`phase-bar ${lucarneOrangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                                    <div
                                                                        className="drag-handle drag-handle-end"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                                        style={{ left: `${secondPartWidth}px` }}
                                                                        title="Glisser pour modifier la fin"
                                                                    />
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                            style={{ left: `${leftPos}px` }}
                                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                                            onMouseLeave={() => setHoveredActionId(null)}
                                                        >
                                                            <div
                                                                className="drag-handle drag-handle-start"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                                title="Glisser pour modifier le début"
                                                            />
                                                            <div className="phase-bar green-dark" style={{ width: `${greenWidth}px` }}></div>
                                                            <div className={`phase-bar ${lucarneOrangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                            <div
                                                                className="drag-handle drag-handle-end"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                                style={{ left: `${greenWidth}px` }}
                                                                title="Glisser pour modifier la fin"
                                                            />
                                                        </div>
                                                    );
                                                })()}

                                                {/* Fermeture anticipée: brace */}
                                                {action.action === 'Fermeture anticipée' && (() => {
                                                    const wrapsAround = deb > fin;
                                                    if (wrapsAround) {
                                                        const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                                        const secondPartWidth = fin * pixelsPerSecond;
                                                        return (
                                                            <React.Fragment>
                                                                <div
                                                                    className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: `${leftPos}px`, width: `${firstPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-start"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                                        title="Glisser pour modifier le début"
                                                                    />
                                                                </div>
                                                                <div
                                                                    className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: '0px', width: `${secondPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-end"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                                        title="Glisser pour modifier la fin"
                                                                    />
                                                                    <span className="brace-text">⏎</span>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                            style={{ left: `${leftPos}px`, width: `${greenWidth}px` }}
                                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                                            onMouseLeave={() => setHoveredActionId(null)}
                                                        >
                                                            <div
                                                                className="action-drag-handle action-drag-handle-start"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                                title="Glisser pour modifier le début"
                                                            />
                                                            <div
                                                                className="action-drag-handle action-drag-handle-end"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                                title="Glisser pour modifier la fin"
                                                            />
                                                            <span className="brace-text">⏎</span>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Ouverture anticipée: hatched green rectangle */}
                                                {action.action === 'Ouverture anticipée' && (() => {
                                                    const wrapsAround = deb > fin;
                                                    if (wrapsAround) {
                                                        const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                                        const secondPartWidth = fin * pixelsPerSecond;
                                                        return (
                                                            <React.Fragment>
                                                                <div
                                                                    className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: `${leftPos}px`, width: `${firstPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-start"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                                        title="Glisser pour modifier le début"
                                                                    />
                                                                    {abrv && (
                                                                        <span className="ouverture-anticipee-label">{abrv}</span>
                                                                    )}
                                                                </div>
                                                                <div
                                                                    className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: '0px', width: `${secondPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-end"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                                        title="Glisser pour modifier la fin"
                                                                    />
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                            style={{ left: `${leftPos}px`, width: `${greenWidth}px` }}
                                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                                            onMouseLeave={() => setHoveredActionId(null)}
                                                        >
                                                            <div
                                                                className="action-drag-handle action-drag-handle-start"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                                title="Glisser pour modifier le début"
                                                            />
                                                            <div
                                                                className="action-drag-handle action-drag-handle-end"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                                title="Glisser pour modifier la fin"
                                                            />
                                                            {abrv && (
                                                                <span className="ouverture-anticipee-label">{abrv}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Adaptatif vertical overlays */}
                        {adaptatifActions.map((action, idx) => {
                            const origDeb = parseInt(action.deb) || 0;
                            const origFin = parseInt(action.fin) || 0;
                            // Apply shift from other Escamotage de phase or Adaptatif vertical actions
                            const shifted = getShiftedActionPosition(origDeb, origFin, null, 'Adaptatif vertical');
                            if (shifted.hidden) return null;
                            const deb = shifted.deb;
                            const fin = shifted.fin;
                            const leftPos = deb * pixelsPerSecond;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Calculate vertical position based on Plage1/Plage2
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;

                            let topPos, height;
                            if (plage1 > 0 && plage2 > 0) {
                                // Plage values are group numbers (1-indexed)
                                const startGroup = Math.min(plage1, plage2) - 1;
                                const endGroup = Math.max(plage1, plage2) - 1;
                                topPos = RULER_HEIGHT + (startGroup * ROW_HEIGHT);
                                height = (endGroup - startGroup + 1) * ROW_HEIGHT;
                            } else {
                                // No plage values - full height
                                topPos = RULER_HEIGHT;
                                height = groups.length * ROW_HEIGHT;
                            }

                            // Check if overlay wraps around cycle
                            const wrapsAround = deb > fin;

                            if (wrapsAround) {
                                const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                const secondPartWidth = fin * pixelsPerSecond;
                                return (
                                    <React.Fragment key={`adaptatif-${idx}`}>
                                        {/* First part: from deb to end of cycle */}
                                        <div
                                            className={`adaptatif-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: `${leftPos}px`,
                                                width: `${firstPartWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`
                                            }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <div
                                                className="action-drag-handle action-drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}
                                                title="Glisser pour modifier le début"
                                            />
                                        </div>
                                        {/* Second part: from start of cycle to fin */}
                                        <div
                                            className={`adaptatif-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: '0px',
                                                width: `${secondPartWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`
                                            }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <div
                                                className="action-drag-handle action-drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}
                                                title="Glisser pour modifier la fin"
                                            />
                                            {abrv && (
                                                <span className="adaptatif-label">{abrv}</span>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            }

                            const duration = fin - deb;
                            const width = duration * pixelsPerSecond;

                            return (
                                <div
                                    key={`adaptatif-${idx}`}
                                    className={`adaptatif-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                    style={{
                                        left: `${leftPos}px`,
                                        width: `${width}px`,
                                        top: `${topPos}px`,
                                        height: `${height}px`
                                    }}
                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                    onMouseLeave={() => setHoveredActionId(null)}
                                >
                                    {/* Drag handle for start (left edge) */}
                                    <div
                                        className="action-drag-handle action-drag-handle-start"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}
                                        title="Glisser pour modifier le début"
                                    />
                                    {/* Drag handle for end (right edge) */}
                                    <div
                                        className="action-drag-handle action-drag-handle-end"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}
                                        title="Glisser pour modifier la fin"
                                    />
                                    {abrv && (
                                        <span className="adaptatif-label">{abrv}</span>
                                    )}
                                </div>
                            );
                        })}

                        {/* Fermeture anticipée arrows */}
                        {fermetureActions.map((action, idx) => {
                            const sourceGf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const fin = parseInt(action.fin) || 0;

                            // Get target groups from ActGF1, ActGF2, ActGF3, ActGF4
                            const targets = [];
                            if (action.actGf1) {
                                const targetId = parseInt(action.actGf1.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }
                            if (action.actGf1Gf2) {
                                const targetId = parseInt(action.actGf1Gf2.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }
                            if (action.actGf1Gf3) {
                                const targetId = parseInt(action.actGf1Gf3.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }
                            if (action.actGf1Gf4) {
                                const targetId = parseInt(action.actGf1Gf4.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }

                            return targets.map((targetGf, tIdx) => {
                                const targetStartPos = getGroupStartPos(targetGf);
                                if (targetStartPos === null) return null;

                                // If target group wraps around cycle, point to end of green instead of start
                                const targetWraps = doesGroupWrap(targetGf);
                                const targetEndPos = getGroupEndPos(targetGf);
                                const targetPos = targetWraps ? targetEndPos : targetStartPos;

                                // Calculate positions
                                const sourceY = RULER_HEIGHT + ((sourceGf - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                                const targetY = RULER_HEIGHT + ((targetGf - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                                // Apply group shift to source position in simulation mode
                                const sourceShift = getGroupShift(sourceGf);
                                const shiftedFin = Math.max(0, fin - sourceShift);
                                const sourceX = shiftedFin * pixelsPerSecond;
                                const targetX = targetPos * pixelsPerSecond;
                                const cycleEndX = effectiveCycleLength * pixelsPerSecond;

                                // If arrow would go backwards, split into two segments
                                if (sourceX > targetX) {
                                    return (
                                        <svg
                                            key={`arrow-${idx}-${tIdx}`}
                                            className="fermeture-arrow"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                pointerEvents: 'none',
                                                zIndex: 20
                                            }}
                                        >
                                            <defs>
                                                <marker
                                                    id={`arrowhead-${idx}-${tIdx}`}
                                                    markerWidth="6"
                                                    markerHeight="4"
                                                    refX="6"
                                                    refY="2"
                                                    orient="auto"
                                                >
                                                    <polygon
                                                        points="0 0, 6 2, 0 4"
                                                        fill="#ff0000"
                                                    />
                                                </marker>
                                            </defs>
                                            {/* First segment: from source to end of cycle */}
                                            <line
                                                x1={sourceX}
                                                y1={sourceY}
                                                x2={cycleEndX}
                                                y2={sourceY + (targetY - sourceY) * ((cycleEndX - sourceX) / (cycleEndX - sourceX + targetX))}
                                                stroke="#ff0000"
                                                strokeWidth="1.5"
                                            />
                                            {/* Second segment: from start of cycle to target */}
                                            <line
                                                x1={0}
                                                y1={sourceY + (targetY - sourceY) * ((cycleEndX - sourceX) / (cycleEndX - sourceX + targetX))}
                                                x2={targetX}
                                                y2={targetY}
                                                stroke="#ff0000"
                                                strokeWidth="1.5"
                                                markerEnd={`url(#arrowhead-${idx}-${tIdx})`}
                                            />
                                        </svg>
                                    );
                                }

                                return (
                                    <svg
                                        key={`arrow-${idx}-${tIdx}`}
                                        className="fermeture-arrow"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            zIndex: 20
                                        }}
                                    >
                                        <defs>
                                            <marker
                                                id={`arrowhead-${idx}-${tIdx}`}
                                                markerWidth="6"
                                                markerHeight="4"
                                                refX="6"
                                                refY="2"
                                                orient="auto"
                                            >
                                                <polygon
                                                    points="0 0, 6 2, 0 4"
                                                    fill="#ff0000"
                                                />
                                            </marker>
                                        </defs>
                                        <line
                                            x1={sourceX}
                                            y1={sourceY}
                                            x2={targetX}
                                            y2={targetY}
                                            stroke="#ff0000"
                                            strokeWidth="1.5"
                                            markerEnd={`url(#arrowhead-${idx}-${tIdx})`}
                                        />
                                    </svg>
                                );
                            });
                        })}

                        {/* Escamotage de phase overlays */}
                        {escamotageActions.map((action, idx) => {
                            const origDeb = parseInt(action.deb) || 0;
                            const origFin = parseInt(action.fin) || 0;
                            // Apply shift from other Escamotage de phase or Adaptatif vertical actions
                            const shifted = getShiftedActionPosition(origDeb, origFin, null, 'Escamotage de phase');
                            if (shifted.hidden) return null;
                            const deb = shifted.deb;
                            const fin = shifted.fin;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Calculate overlap with selected Adaptatif vertical zones
                            // Use ORIGINAL values (origDeb, origFin) for comparison with Adaptatif vertical
                            let adaptatifReduction = 0;

                            // Method 1: Check selectedAdaptatifVertical (works for partial Adaptatif vertical)
                            selectedAdaptatifVertical.forEach(av => {
                                const avDeb = parseInt(av.deb) || 0;
                                const avFin = parseInt(av.fin) || 0;
                                // Calculate overlap using simple min/max formula
                                const overlapStart = Math.max(avDeb, origDeb);
                                const overlapEnd = Math.min(avFin, origFin);
                                if (overlapEnd > overlapStart) {
                                    adaptatifReduction += (overlapEnd - overlapStart);
                                }
                            });

                            // Method 2: Check timeShifts for FULL Adaptatif vertical (no plage1/plage2)
                            // This handles the case when Adaptatif vertical covers all groups
                            if (simulationResult?.timeShifts?.length && adaptatifReduction === 0) {
                                simulationResult.timeShifts.forEach(shift => {
                                    // FULL Adaptatif vertical has no plage1/plage2
                                    if (!shift.plage1 && !shift.plage2 && shift.amount > 0) {
                                        const avFin = shift.from;
                                        const avDeb = shift.from - shift.amount;
                                        const overlapStart = Math.max(avDeb, origDeb);
                                        const overlapEnd = Math.min(avFin, origFin);
                                        if (overlapEnd > overlapStart) {
                                            adaptatifReduction += (overlapEnd - overlapStart);
                                        }
                                    }
                                });
                            }

                            const leftPos = deb * pixelsPerSecond;

                            // Cover all rows, starting just below ruler (8px above rows) and 30px below
                            const topPos = RULER_HEIGHT - 8;
                            const height = 8 + (groups.length * ROW_HEIGHT) + 30;

                            // Check if overlay wraps around cycle
                            const wrapsAround = deb > fin;

                            if (wrapsAround) {
                                const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                const secondPartWidth = Math.max(0, fin - adaptatifReduction) * pixelsPerSecond;
                                return (
                                    <React.Fragment key={`escamotage-${idx}`}>
                                        {/* First part: from deb to end of cycle */}
                                        <div
                                            className={`escamotage-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: `${leftPos}px`,
                                                width: `${firstPartWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`
                                            }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <div
                                                className="action-drag-handle action-drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}
                                                title="Glisser pour modifier le début"
                                            />
                                        </div>
                                        {/* Second part: from start of cycle to fin */}
                                        <div
                                            className={`escamotage-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: '0px',
                                                width: `${secondPartWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`
                                            }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <div
                                                className="action-drag-handle action-drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}
                                                title="Glisser pour modifier la fin"
                                            />
                                            {abrv && (
                                                <span className="escamotage-label">{abrv}</span>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            }

                            const duration = Math.max(0, (fin - deb) - adaptatifReduction);
                            const width = duration * pixelsPerSecond;

                            return (
                                <div
                                    key={`escamotage-${idx}`}
                                    className={`escamotage-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                    style={{
                                        left: `${leftPos}px`,
                                        width: `${width}px`,
                                        top: `${topPos}px`,
                                        height: `${height}px`
                                    }}
                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                    onMouseLeave={() => setHoveredActionId(null)}
                                >
                                    {/* Drag handle for start (left edge) */}
                                    <div
                                        className="action-drag-handle action-drag-handle-start"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}
                                        title="Glisser pour modifier le début"
                                    />
                                    {/* Drag handle for end (right edge) */}
                                    <div
                                        className="action-drag-handle action-drag-handle-end"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}
                                        title="Glisser pour modifier la fin"
                                    />
                                    {abrv && (
                                        <span className="escamotage-label">{abrv}</span>
                                    )}
                                </div>
                            );
                        })}

                        {/* Escamotage (group-specific) with arrows */}
                        {escamotageGroupActions.map((action, idx) => {
                            const sourceGfId = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const targetGfId = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const isHighlighted = hoveredActionId === action.id;

                            if (sourceGfId === 0 || targetGfId === 0) return null;
                            if (sourceGfId > groups.length || targetGfId > groups.length) return null;

                            const sourceGroup = groups.find(g => g.id === sourceGfId);
                            const targetGroup = groups.find(g => g.id === targetGfId);
                            if (!sourceGroup || !targetGroup) return null;

                            // Get intergreen times from conflict matrix
                            const intergreenSourceToTarget = conflictMatrix[sourceGfId - 1]?.[targetGfId - 1] || 0;
                            const intergreenTargetToSource = conflictMatrix[targetGfId - 1]?.[sourceGfId - 1] || 0;

                            // Source group times
                            const sourceStart = sourceGroup.offset % cycleLength;
                            const sourceEnd = (sourceStart + sourceGroup.durations.green) % cycleLength;

                            // Y positions (center of each row)
                            const sourceY = RULER_HEIGHT + ((sourceGfId - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);

                            // Arrow 1: From start of source GF to (source start - intergreen target→source)
                            const arrow1SourceX = sourceStart * pixelsPerSecond;
                            const arrow1TargetX = ((sourceStart - intergreenTargetToSource + cycleLength) % cycleLength) * pixelsPerSecond;

                            // Arrow 2: From end of source GF to (source end + intergreen source→target)
                            const arrow2SourceX = sourceEnd * pixelsPerSecond;
                            const arrow2TargetX = ((sourceEnd + intergreenSourceToTarget) % cycleLength) * pixelsPerSecond;

                            // Rectangle between arrow endpoints on target row (lower half of bar)
                            const rectX = Math.min(arrow1TargetX, arrow2TargetX);
                            const rectWidth = Math.abs(arrow2TargetX - arrow1TargetX);
                            const barHeight = ROW_HEIGHT - 14; // Bar has top:7px and bottom:7px (16px)
                            const rectHeight = barHeight / 2; // Half the bar height (8px)
                            // Calculate exact bar bottom position and align rectangle there
                            const rowTopY = RULER_HEIGHT + ((targetGfId - 1) * ROW_HEIGHT);
                            const barBottomY = rowTopY + ROW_HEIGHT - 7; // Exact bottom of bar
                            const rectY = barBottomY - rectHeight + 5; // Rectangle bottom aligned to bar bottom +5px offset

                            // Arrow target Y points to bottom of rectangle
                            const targetY = rectY + rectHeight;

                            return (
                                <React.Fragment key={`escamotage-group-${idx}`}>
                                    {/* Hover zone for highlighting */}
                                    <div
                                        className={`escamotage-group-hover ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            left: `${rectX}px`,
                                            top: `${rectY - 5}px`,
                                            width: `${rectWidth}px`,
                                            height: `${rectHeight + 10}px`,
                                            zIndex: 21,
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={() => setHoveredActionId(action.id)}
                                        onMouseLeave={() => setHoveredActionId(null)}
                                    />
                                    <svg
                                        className={`escamotage-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            zIndex: 20
                                        }}
                                    >
                                    <defs>
                                        <marker
                                            id={`escam-arrowhead-${idx}`}
                                            markerWidth="8"
                                            markerHeight="6"
                                            refX="8"
                                            refY="3"
                                            orient="auto"
                                        >
                                            <polygon points="0 0, 8 3, 0 6" fill="#1565C0" />
                                        </marker>
                                        <pattern
                                            id={`escam-hatch-${idx}`}
                                            patternUnits="userSpaceOnUse"
                                            width="6"
                                            height="6"
                                            patternTransform="rotate(-45)"
                                        >
                                            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(21,101,192,0.9)" strokeWidth="3" />
                                        </pattern>
                                    </defs>
                                    {/* Hatched rectangle between arrow endpoints */}
                                    <rect
                                        x={rectX}
                                        y={rectY}
                                        width={rectWidth}
                                        height={rectHeight}
                                        fill={`url(#escam-hatch-${idx})`}
                                        stroke="#1565C0"
                                        strokeWidth="0.5"
                                        strokeDasharray="2,2"
                                    />
                                    {/* Arrow 1: From source start to (source start - intergreen target→source) */}
                                    <line
                                        x1={arrow1SourceX}
                                        y1={sourceY}
                                        x2={arrow1TargetX}
                                        y2={targetY}
                                        stroke="#1565C0"
                                        strokeWidth="1"
                                        strokeDasharray="4,2"
                                        markerEnd={`url(#escam-arrowhead-${idx})`}
                                    />
                                    {/* Arrow 2: From source end to (source end + intergreen source→target) */}
                                    <line
                                        x1={arrow2SourceX}
                                        y1={sourceY}
                                        x2={arrow2TargetX}
                                        y2={targetY}
                                        stroke="#1565C0"
                                        strokeWidth="1"
                                        strokeDasharray="4,2"
                                        markerEnd={`url(#escam-arrowhead-${idx})`}
                                    />
                                    </svg>
                                </React.Fragment>
                            );
                        })}

                        {/* Signa d'aide à la conduite overlays */}
                        {signaActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const deb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;
                            const blueStart = fin - 5;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group index in array
                            const groupIndex = groups.findIndex(g => g.id === gf);
                            if (groupIndex === -1) return null;

                            // Calculate positions
                            const orangeLeftPos = deb * pixelsPerSecond;
                            const orangeDuration = blueStart - deb; // From Déb to (Fin-5)
                            const orangeWidth = orangeDuration * pixelsPerSecond;
                            const blueLeftPos = blueStart * pixelsPerSecond;
                            const blueWidth = 5 * pixelsPerSecond; // Blue zone (5s at end)
                            const totalWidth = (fin - deb) * pixelsPerSecond;

                            // Calculate stripe width based on 1 second interval
                            const stripeWidth = pixelsPerSecond;

                            // Vertical position based on group index (height reduced by 2/3 total)
                            const height = Math.round((ROW_HEIGHT - 14) * 4 / 9);
                            const topPos = RULER_HEIGHT + (groupIndex * ROW_HEIGHT) + Math.floor((ROW_HEIGHT - height) / 2);

                            return (
                                <React.Fragment key={`signa-${idx}`}>
                                    {/* Wrapper for drag handles */}
                                    <div
                                        className={`signa-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            left: `${orangeLeftPos}px`,
                                            width: `${totalWidth}px`,
                                            top: `${topPos}px`,
                                            height: `${height}px`,
                                            pointerEvents: 'auto'
                                        }}
                                        onMouseEnter={() => setHoveredActionId(action.id)}
                                        onMouseLeave={() => setHoveredActionId(null)}
                                    >
                                        {/* Drag handle for start (left edge) */}
                                        <div
                                            className="action-drag-handle action-drag-handle-start"
                                            onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                            title="Glisser pour modifier le début"
                                            style={{ pointerEvents: 'auto' }}
                                        />
                                        {/* Drag handle for end (right edge) */}
                                        <div
                                            className="action-drag-handle action-drag-handle-end"
                                            onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                            title="Glisser pour modifier la fin"
                                            style={{ pointerEvents: 'auto' }}
                                        />
                                    </div>
                                    {/* Orange intermittent bar at start */}
                                    <div
                                        className={`signa-orange-bar ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            left: `${orangeLeftPos}px`,
                                            width: `${orangeWidth}px`,
                                            top: `${topPos}px`,
                                            height: `${height}px`,
                                            '--stripe-width': `${stripeWidth}px`
                                        }}
                                    />
                                    {/* Blue bar at end (last 5s) */}
                                    <div
                                        className={`signa-blue-bar ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            left: `${blueLeftPos}px`,
                                            width: `${blueWidth}px`,
                                            top: `${topPos}px`,
                                            height: `${height}px`
                                        }}
                                    >
                                        {abrv && (
                                            <span className="signa-label">{abrv}</span>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}

                        {/* Point de repos arrows - vertical red arrows */}
                        {pointReposActions.map((action, idx) => {
                            const deb = parseInt(action.deb) || 0;
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            if (plage1 < 1 || plage2 < 1 || plage1 > groups.length || plage2 > groups.length) return null;

                            // X position at deb
                            const xPos = deb * pixelsPerSecond;

                            // Arrow length fixed at 13 pixels
                            const arrowLength = 13;

                            // Downward arrow: ends just above plage1 row
                            const downArrowEndY = RULER_HEIGHT + (plage1 - 1) * ROW_HEIGHT - 2;
                            const downArrowStartY = downArrowEndY - arrowLength;

                            // Upward arrow: ends just below plage2 row
                            const upArrowEndY = RULER_HEIGHT + plage2 * ROW_HEIGHT + 2;
                            const upArrowStartY = upArrowEndY + arrowLength;

                            // Arrow head size
                            const arrowSize = 5;

                            // Label position below the diagram
                            const labelY = RULER_HEIGHT + groups.length * ROW_HEIGHT + 20;

                            return (
                                <React.Fragment key={`point-repos-${idx}`}>
                                    <svg
                                        className={`point-repos-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            zIndex: 100,
                                            overflow: 'visible'
                                        }}
                                    >
                                        {/* Downward arrow line */}
                                        <line
                                            x1={xPos}
                                            y1={downArrowStartY}
                                            x2={xPos}
                                            y2={downArrowEndY}
                                            stroke="#ff0000"
                                            strokeWidth="2"
                                        />
                                        {/* Downward arrow head (pointing down) */}
                                        <polygon
                                            points={`${xPos - arrowSize},${downArrowEndY} ${xPos + arrowSize},${downArrowEndY} ${xPos},${downArrowEndY + arrowSize * 1.5}`}
                                            fill="#ff0000"
                                        />
                                        {/* Upward arrow line */}
                                        <line
                                            x1={xPos}
                                            y1={upArrowStartY}
                                            x2={xPos}
                                            y2={upArrowEndY}
                                            stroke="#ff0000"
                                            strokeWidth="2"
                                        />
                                        {/* Upward arrow head (pointing up) */}
                                        <polygon
                                            points={`${xPos - arrowSize},${upArrowEndY} ${xPos + arrowSize},${upArrowEndY} ${xPos},${upArrowEndY - arrowSize * 1.5}`}
                                            fill="#ff0000"
                                        />
                                    </svg>
                                    {/* Label below diagram */}
                                    {abrv && (
                                        <div
                                            className="point-repos-label"
                                            style={{
                                                position: 'absolute',
                                                left: `${xPos}px`,
                                                top: `${labelY}px`,
                                                transform: 'translateX(-50%)',
                                                color: '#ffffff',
                                                fontSize: '0.7em',
                                                fontWeight: 'bold',
                                                whiteSpace: 'nowrap',
                                                zIndex: 100
                                            }}
                                        >
                                            {abrv}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Synchro BTS arrows - vertical blue arrows */}
                        {synchroBtsActions.map((action, idx) => {
                            const deb = parseInt(action.deb) || 0;
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            if (plage1 < 1 || plage2 < 1 || plage1 > groups.length || plage2 > groups.length) return null;

                            // X position at deb
                            const xPos = deb * pixelsPerSecond;

                            // Arrow length fixed at 16 pixels
                            const arrowLength = 16;

                            // Downward arrow: ends just above plage1 row
                            const downArrowEndY = RULER_HEIGHT + (plage1 - 1) * ROW_HEIGHT - 2;
                            const downArrowStartY = downArrowEndY - arrowLength;

                            // Upward arrow: ends just below plage2 row
                            const upArrowEndY = RULER_HEIGHT + plage2 * ROW_HEIGHT + 2;
                            const upArrowStartY = upArrowEndY + arrowLength;

                            // Arrow head size
                            const arrowSize = 5;

                            // Label position below the diagram
                            const labelY = RULER_HEIGHT + groups.length * ROW_HEIGHT + 20;

                            return (
                                <React.Fragment key={`synchro-bts-${idx}`}>
                                    <svg
                                        className={`synchro-bts-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            zIndex: 100,
                                            overflow: 'visible'
                                        }}
                                    >
                                        {/* Downward arrow line */}
                                        <line
                                            x1={xPos}
                                            y1={downArrowStartY}
                                            x2={xPos}
                                            y2={downArrowEndY}
                                            stroke="#0000FF"
                                            strokeWidth="2"
                                        />
                                        {/* Downward arrow head (pointing down) */}
                                        <polygon
                                            points={`${xPos - arrowSize},${downArrowEndY} ${xPos + arrowSize},${downArrowEndY} ${xPos},${downArrowEndY + arrowSize * 1.5}`}
                                            fill="#0000FF"
                                        />
                                        {/* Upward arrow line */}
                                        <line
                                            x1={xPos}
                                            y1={upArrowStartY}
                                            x2={xPos}
                                            y2={upArrowEndY}
                                            stroke="#0000FF"
                                            strokeWidth="2"
                                        />
                                        {/* Upward arrow head (pointing up) */}
                                        <polygon
                                            points={`${xPos - arrowSize},${upArrowEndY} ${xPos + arrowSize},${upArrowEndY} ${xPos},${upArrowEndY - arrowSize * 1.5}`}
                                            fill="#0000FF"
                                        />
                                    </svg>
                                    {/* Label below diagram */}
                                    {abrv && (
                                        <div
                                            className="synchro-bts-label"
                                            style={{
                                                position: 'absolute',
                                                left: `${xPos}px`,
                                                top: `${labelY}px`,
                                                transform: 'translateX(-50%)',
                                                color: '#ffffff',
                                                fontSize: '0.7em',
                                                fontWeight: 'bold',
                                                whiteSpace: 'nowrap',
                                                zIndex: 100
                                            }}
                                        >
                                            {abrv}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Instant Co arrows - vertical orange arrows */}
                        {instantCoActions.map((action, idx) => {
                            const deb = parseInt(action.deb) || 0;
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            if (plage1 < 1 || plage2 < 1 || plage1 > groups.length || plage2 > groups.length) return null;

                            // X position at deb
                            const xPos = deb * pixelsPerSecond;

                            // Arrow length fixed at 13 pixels
                            const arrowLength = 13;

                            // Downward arrow: ends just above plage1 row
                            const downArrowEndY = RULER_HEIGHT + (plage1 - 1) * ROW_HEIGHT - 2;
                            const downArrowStartY = downArrowEndY - arrowLength;

                            // Upward arrow: ends just below plage2 row
                            const upArrowEndY = RULER_HEIGHT + plage2 * ROW_HEIGHT + 2;
                            const upArrowStartY = upArrowEndY + arrowLength;

                            // Arrow head size
                            const arrowSize = 5;

                            // Label position below the diagram
                            const labelY = RULER_HEIGHT + groups.length * ROW_HEIGHT + 20;

                            return (
                                <React.Fragment key={`instant-co-${idx}`}>
                                    <svg
                                        className={`instant-co-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            zIndex: 100,
                                            overflow: 'visible'
                                        }}
                                    >
                                        {/* Downward arrow line */}
                                        <line
                                            x1={xPos}
                                            y1={downArrowStartY}
                                            x2={xPos}
                                            y2={downArrowEndY}
                                            stroke="#FF8C00"
                                            strokeWidth="2"
                                        />
                                        {/* Downward arrow head (pointing down) */}
                                        <polygon
                                            points={`${xPos - arrowSize},${downArrowEndY} ${xPos + arrowSize},${downArrowEndY} ${xPos},${downArrowEndY + arrowSize * 1.5}`}
                                            fill="#FF8C00"
                                        />
                                        {/* Upward arrow line */}
                                        <line
                                            x1={xPos}
                                            y1={upArrowStartY}
                                            x2={xPos}
                                            y2={upArrowEndY}
                                            stroke="#FF8C00"
                                            strokeWidth="2"
                                        />
                                        {/* Upward arrow head (pointing up) */}
                                        <polygon
                                            points={`${xPos - arrowSize},${upArrowEndY} ${xPos + arrowSize},${upArrowEndY} ${xPos},${upArrowEndY - arrowSize * 1.5}`}
                                            fill="#FF8C00"
                                        />
                                    </svg>
                                    {/* Label below diagram */}
                                    {abrv && (
                                        <div
                                            className="instant-co-label"
                                            style={{
                                                position: 'absolute',
                                                left: `${xPos}px`,
                                                top: `${labelY}px`,
                                                transform: 'translateX(-50%)',
                                                color: '#FF8C00',
                                                fontSize: '0.7em',
                                                fontWeight: 'bold',
                                                whiteSpace: 'nowrap',
                                                zIndex: 100
                                            }}
                                        >
                                            {abrv}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Priorité piétons - intermittent yellow bar */}
                        {prioritePietonsActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const deb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group index in array
                            const groupIndex = groups.findIndex(g => g.id === gf);
                            if (groupIndex === -1) return null;
                            if (deb === fin) return null;

                            // Check for wrap-around (fin < deb means the bar crosses cycle boundary)
                            const wrapsAround = deb > fin;

                            // Vertical position aligned with the group's phase bar
                            // The ruler has height RULER_HEIGHT (50px) + 1px border-bottom = 51px
                            // Each row has height ROW_HEIGHT (30px) + 1px border-bottom = 31px
                            const height = ROW_HEIGHT - 14;
                            const rowTotalHeight = ROW_HEIGHT + 1; // 30px height + 1px border
                            const topPos = RULER_HEIGHT + 1 + (groupIndex * rowTotalHeight) + Math.floor((ROW_HEIGHT - height) / 2);

                            // Stripe width based on 1 second interval
                            const stripeWidth = pixelsPerSecond;

                            // Common style for the yellow intermittent bar
                            const barStyle = (left, width) => ({
                                position: 'absolute',
                                left: `${left}px`,
                                width: `${width}px`,
                                top: `${topPos}px`,
                                height: `${height}px`,
                                borderRadius: '2px',
                                pointerEvents: 'none',
                                zIndex: 15,
                                background: `repeating-linear-gradient(
                                    90deg,
                                    #FFFF00,
                                    #FFFF00 ${stripeWidth}px,
                                    transparent ${stripeWidth}px,
                                    transparent ${stripeWidth * 2}px
                                )`,
                                boxShadow: '0 0 3px rgba(255, 255, 0, 0.5)'
                            });

                            if (wrapsAround) {
                                // Wrap-around case: draw 2 bars
                                const firstPartLeft = deb * pixelsPerSecond;
                                const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                const secondPartLeft = 0;
                                const secondPartWidth = fin * pixelsPerSecond;

                                return (
                                    <React.Fragment key={`priorite-pietons-${idx}`}>
                                        {/* First part: from deb to end of cycle */}
                                        <div
                                            className={`priorite-pietons-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                position: 'absolute',
                                                left: `${firstPartLeft}px`,
                                                width: `${firstPartWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`,
                                                pointerEvents: 'auto'
                                            }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            {/* Drag handle for start (left edge) */}
                                            <div
                                                className="action-drag-handle action-drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                title="Glisser pour modifier le début"
                                                style={{ pointerEvents: 'auto' }}
                                            />
                                        </div>
                                        <div
                                            className={`priorite-pietons-bar ${isHighlighted ? 'highlighted' : ''}`}
                                            style={barStyle(firstPartLeft, firstPartWidth)}
                                        />

                                        {/* Second part: from start of cycle to fin */}
                                        <div
                                            className={`priorite-pietons-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                position: 'absolute',
                                                left: `${secondPartLeft}px`,
                                                width: `${secondPartWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`,
                                                pointerEvents: 'auto'
                                            }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            {/* Drag handle for end (right edge) */}
                                            <div
                                                className="action-drag-handle action-drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                title="Glisser pour modifier la fin"
                                                style={{ pointerEvents: 'auto', left: 'auto', right: '0' }}
                                            />
                                        </div>
                                        <div
                                            className={`priorite-pietons-bar ${isHighlighted ? 'highlighted' : ''}`}
                                            style={barStyle(secondPartLeft, secondPartWidth)}
                                        >
                                            {abrv && (
                                                <span className="priorite-pietons-label" style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    fontSize: '0.65em',
                                                    color: '#000',
                                                    fontWeight: 'bold',
                                                    textShadow: '0 0 2px rgba(255, 255, 255, 0.8)',
                                                    whiteSpace: 'nowrap',
                                                    zIndex: 50,
                                                    pointerEvents: 'none'
                                                }}>
                                                    {abrv}
                                                </span>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            }

                            // Normal case: single bar
                            const leftPos = deb * pixelsPerSecond;
                            const barWidth = (fin - deb) * pixelsPerSecond;

                            return (
                                <React.Fragment key={`priorite-pietons-${idx}`}>
                                    {/* Wrapper for drag handles */}
                                    <div
                                        className={`priorite-pietons-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            left: `${leftPos}px`,
                                            width: `${barWidth}px`,
                                            top: `${topPos}px`,
                                            height: `${height}px`,
                                            pointerEvents: 'auto'
                                        }}
                                        onMouseEnter={() => setHoveredActionId(action.id)}
                                        onMouseLeave={() => setHoveredActionId(null)}
                                    >
                                        {/* Drag handle for start (left edge) */}
                                        <div
                                            className="action-drag-handle action-drag-handle-start"
                                            onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                            title="Glisser pour modifier le début"
                                            style={{ pointerEvents: 'auto' }}
                                        />
                                        {/* Drag handle for end (right edge) */}
                                        <div
                                            className="action-drag-handle action-drag-handle-end"
                                            onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                            title="Glisser pour modifier la fin"
                                            style={{ pointerEvents: 'auto' }}
                                        />
                                    </div>
                                    {/* Intermittent yellow bar */}
                                    <div
                                        className={`priorite-pietons-bar ${isHighlighted ? 'highlighted' : ''}`}
                                        style={barStyle(leftPos, barWidth)}
                                    >
                                        {abrv && (
                                            <span className="priorite-pietons-label" style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                fontSize: '0.65em',
                                                color: '#000',
                                                fontWeight: 'bold',
                                                textShadow: '0 0 2px rgba(255, 255, 255, 0.8)',
                                                whiteSpace: 'nowrap',
                                                zIndex: 50,
                                                pointerEvents: 'none'
                                            }}>
                                                {abrv}
                                            </span>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}

                        {/* Début de bande passante arrows - dashed green diagonal arrows */}
                        {debutBandeActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const deb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;
                            const actGf1 = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group indices
                            const startGroupIndex = groups.findIndex(g => g.id === gf);
                            const endGroupIndex = groups.findIndex(g => g.id === actGf1);
                            if (startGroupIndex === -1 || endGroupIndex === -1) return null;

                            // Calculate positions
                            const startX = deb * pixelsPerSecond;
                            const endX = fin * pixelsPerSecond;
                            const startY = RULER_HEIGHT + (startGroupIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                            // End Y points to bottom of the bar (ROW_HEIGHT - 7 is bottom of bar)
                            const endY = RULER_HEIGHT + (endGroupIndex * ROW_HEIGHT) + ROW_HEIGHT - 7;
                            const cycleEndX = cycleLength * pixelsPerSecond;

                            // Arrow head size
                            const arrowSize = 4;

                            // Check if arrow wraps around cycle (deb > fin)
                            const wrapsAround = deb > fin;

                            if (wrapsAround) {
                                // Calculate intermediate Y at cycle boundary
                                const totalXDistance = (cycleLength - deb) + fin;
                                const firstSegmentRatio = (cycleLength - deb) / totalXDistance;
                                const intermediateY = startY + (endY - startY) * firstSegmentRatio;

                                // Angle for second segment arrow head
                                const angle2 = Math.atan2(endY - intermediateY, endX - 0);

                                return (
                                    <React.Fragment key={`debut-bande-${idx}`}>
                                        <svg
                                            className={`debut-bande-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                pointerEvents: 'none',
                                                zIndex: 50,
                                                overflow: 'visible'
                                            }}
                                        >
                                            {/* First segment: from start to end of cycle */}
                                            <line
                                                x1={startX}
                                                y1={startY}
                                                x2={cycleEndX}
                                                y2={intermediateY}
                                                stroke="#00cc00"
                                                strokeWidth="0.5"
                                                strokeDasharray="4,3"
                                            />
                                            {/* Second segment: from start of cycle to end */}
                                            <line
                                                x1={0}
                                                y1={intermediateY}
                                                x2={endX}
                                                y2={endY}
                                                stroke="#00cc00"
                                                strokeWidth="0.5"
                                                strokeDasharray="4,3"
                                            />
                                            {/* Arrow head at end */}
                                            <polygon
                                                points={`
                                                    ${endX},${endY}
                                                    ${endX - arrowSize * Math.cos(angle2 - Math.PI / 6)},${endY - arrowSize * Math.sin(angle2 - Math.PI / 6)}
                                                    ${endX - arrowSize * Math.cos(angle2 + Math.PI / 6)},${endY - arrowSize * Math.sin(angle2 + Math.PI / 6)}
                                                `}
                                                fill="#00cc00"
                                            />
                                        </svg>
                                    </React.Fragment>
                                );
                            }

                            const angle = Math.atan2(endY - startY, endX - startX);

                            return (
                                <React.Fragment key={`debut-bande-${idx}`}>
                                    <svg
                                        className={`debut-bande-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            zIndex: 50,
                                            overflow: 'visible'
                                        }}
                                    >
                                        {/* Dashed diagonal line */}
                                        <line
                                            x1={startX}
                                            y1={startY}
                                            x2={endX}
                                            y2={endY}
                                            stroke="#00cc00"
                                            strokeWidth="0.5"
                                            strokeDasharray="4,3"
                                        />
                                        {/* Arrow head at end */}
                                        <polygon
                                            points={`
                                                ${endX},${endY}
                                                ${endX - arrowSize * Math.cos(angle - Math.PI / 6)},${endY - arrowSize * Math.sin(angle - Math.PI / 6)}
                                                ${endX - arrowSize * Math.cos(angle + Math.PI / 6)},${endY - arrowSize * Math.sin(angle + Math.PI / 6)}
                                            `}
                                            fill="#00cc00"
                                        />
                                    </svg>
                                </React.Fragment>
                            );
                        })}

                        {/* Fin de bande passante arrows - dashed red diagonal arrows */}
                        {finBandeActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const deb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;
                            const actGf1 = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group indices
                            const startGroupIndex = groups.findIndex(g => g.id === gf);
                            const endGroupIndex = groups.findIndex(g => g.id === actGf1);
                            if (startGroupIndex === -1 || endGroupIndex === -1) return null;

                            // Calculate positions (same as début: from gf at deb to actGf1 at fin)
                            const startX = deb * pixelsPerSecond;
                            const endX = fin * pixelsPerSecond;
                            const startY = RULER_HEIGHT + (startGroupIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                            // End Y points to bottom of the bar (ROW_HEIGHT - 7 is bottom of bar)
                            const endY = RULER_HEIGHT + (endGroupIndex * ROW_HEIGHT) + ROW_HEIGHT - 7;
                            const cycleEndX = cycleLength * pixelsPerSecond;

                            // Arrow head size
                            const arrowSize = 4;

                            // Check if arrow wraps around cycle (deb > fin)
                            const wrapsAround = deb > fin;

                            if (wrapsAround) {
                                // Calculate intermediate Y at cycle boundary
                                const totalXDistance = (cycleLength - deb) + fin;
                                const firstSegmentRatio = (cycleLength - deb) / totalXDistance;
                                const intermediateY = startY + (endY - startY) * firstSegmentRatio;

                                // Angle for second segment arrow head
                                const angle2 = Math.atan2(endY - intermediateY, endX - 0);

                                return (
                                    <React.Fragment key={`fin-bande-${idx}`}>
                                        <svg
                                            className={`fin-bande-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                pointerEvents: 'none',
                                                zIndex: 50,
                                                overflow: 'visible'
                                            }}
                                        >
                                            {/* First segment: from start to end of cycle */}
                                            <line
                                                x1={startX}
                                                y1={startY}
                                                x2={cycleEndX}
                                                y2={intermediateY}
                                                stroke="#00cc00"
                                                strokeWidth="0.5"
                                                strokeDasharray="4,3"
                                            />
                                            {/* Second segment: from start of cycle to end */}
                                            <line
                                                x1={0}
                                                y1={intermediateY}
                                                x2={endX}
                                                y2={endY}
                                                stroke="#00cc00"
                                                strokeWidth="0.5"
                                                strokeDasharray="4,3"
                                            />
                                            {/* Arrow head at end */}
                                            <polygon
                                                points={`
                                                    ${endX},${endY}
                                                    ${endX - arrowSize * Math.cos(angle2 - Math.PI / 6)},${endY - arrowSize * Math.sin(angle2 - Math.PI / 6)}
                                                    ${endX - arrowSize * Math.cos(angle2 + Math.PI / 6)},${endY - arrowSize * Math.sin(angle2 + Math.PI / 6)}
                                                `}
                                                fill="#00cc00"
                                            />
                                        </svg>
                                    </React.Fragment>
                                );
                            }

                            const angle = Math.atan2(endY - startY, endX - startX);

                            return (
                                <React.Fragment key={`fin-bande-${idx}`}>
                                    <svg
                                        className={`fin-bande-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            zIndex: 50,
                                            overflow: 'visible'
                                        }}
                                    >
                                        {/* Dashed diagonal line */}
                                        <line
                                            x1={startX}
                                            y1={startY}
                                            x2={endX}
                                            y2={endY}
                                            stroke="#00cc00"
                                            strokeWidth="0.5"
                                            strokeDasharray="4,3"
                                        />
                                        {/* Arrow head at end */}
                                        <polygon
                                            points={`
                                                ${endX},${endY}
                                                ${endX - arrowSize * Math.cos(angle - Math.PI / 6)},${endY - arrowSize * Math.sin(angle - Math.PI / 6)}
                                                ${endX - arrowSize * Math.cos(angle + Math.PI / 6)},${endY - arrowSize * Math.sin(angle + Math.PI / 6)}
                                            `}
                                            fill="#00cc00"
                                        />
                                    </svg>
                                </React.Fragment>
                            );
                        })}

                        {/* Dependency arrows - intergreen times between groups */}
                        {showDependencies && (
                            <svg
                                className="dependency-arrows"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 5
                                }}
                            >
                                <defs>
                                    <marker
                                        id="dep-arrowhead"
                                        markerWidth="6"
                                        markerHeight="4"
                                        refX="6"
                                        refY="2"
                                        orient="auto"
                                    >
                                        <polygon points="0 0, 6 2, 0 4" fill="#999" />
                                    </marker>
                                </defs>
                                {/* Arrows from main green phases */}
                                {groups.map((fromGroup) => {
                                    const fromId = fromGroup.id;
                                    const fromOffset = fromGroup.offset % cycleLength;
                                    const fromGreenEnd = (fromOffset + fromGroup.durations.green) % cycleLength;
                                    const fromRowY = RULER_HEIGHT + ((fromId - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                                    const fromX = fromGreenEnd * pixelsPerSecond;

                                    return groups.map((toGroup) => {
                                        const toId = toGroup.id;
                                        if (fromId === toId) return null;

                                        const intergreenTime = conflictMatrix[fromId - 1]?.[toId - 1] || 0;
                                        if (intergreenTime <= 0) return null;

                                        const toOffset = toGroup.offset % cycleLength;

                                        // Calculate gap between end of fromGroup green and start of toGroup green
                                        let gap = (toOffset - fromGreenEnd + cycleLength) % cycleLength;
                                        // If gap is 0, it means they're at the same time, consider it as full cycle
                                        if (gap === 0) gap = cycleLength;

                                        // Don't show arrow if gap > 20 seconds
                                        if (gap > 20) return null;

                                        // Arrow ends at: end of green + intergreen time
                                        const arrowEndTime = (fromGreenEnd + intergreenTime) % cycleLength;
                                        const toX = arrowEndTime * pixelsPerSecond;
                                        const toRowY = RULER_HEIGHT + ((toId - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                                        const cycleEndX = cycleLength * pixelsPerSecond;

                                        // If arrow would go backwards, split into two segments
                                        if (fromX > toX) {
                                            return (
                                                <g key={`dep-${fromId}-${toId}`}>
                                                    {/* First segment: from start to end of cycle */}
                                                    <line
                                                        x1={fromX}
                                                        y1={fromRowY}
                                                        x2={cycleEndX}
                                                        y2={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                                        stroke="#999"
                                                        strokeWidth="1"
                                                        opacity="0.6"
                                                    />
                                                    {/* Second segment: from start of cycle to end point */}
                                                    <line
                                                        x1={0}
                                                        y1={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                                        x2={toX}
                                                        y2={toRowY}
                                                        stroke="#999"
                                                        strokeWidth="1"
                                                        markerEnd="url(#dep-arrowhead)"
                                                        opacity="0.6"
                                                    />
                                                </g>
                                            );
                                        }

                                        return (
                                            <line
                                                key={`dep-${fromId}-${toId}`}
                                                x1={fromX}
                                                y1={fromRowY}
                                                x2={toX}
                                                y2={toRowY}
                                                stroke="#999"
                                                strokeWidth="1"
                                                markerEnd="url(#dep-arrowhead)"
                                                opacity="0.6"
                                            />
                                        );
                                    });
                                })}

                                {/* Arrows from Seconde lucarne phases */}
                                {actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.fin !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((lucarne, lIdx) => {
                                    const fromId = parseInt(lucarne.gf);
                                    if (isNaN(fromId) || fromId < 1 || fromId > groups.length) return null;

                                    const lucarneEnd = parseInt(lucarne.fin) || 0;
                                    const fromRowY = RULER_HEIGHT + ((fromId - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                                    const fromX = lucarneEnd * pixelsPerSecond;

                                    return groups.map((toGroup) => {
                                        const toId = toGroup.id;
                                        if (fromId === toId) return null;

                                        const intergreenTime = conflictMatrix[fromId - 1]?.[toId - 1] || 0;
                                        if (intergreenTime <= 0) return null;

                                        const toOffset = toGroup.offset % cycleLength;

                                        // Calculate gap between end of lucarne and start of toGroup green
                                        let gap = (toOffset - lucarneEnd + cycleLength) % cycleLength;
                                        if (gap === 0) gap = cycleLength;

                                        // Don't show arrow if gap > 20 seconds
                                        if (gap > 20) return null;

                                        // Arrow ends at: end of lucarne + intergreen time
                                        const arrowEndTime = (lucarneEnd + intergreenTime) % cycleLength;
                                        const toX = arrowEndTime * pixelsPerSecond;
                                        const toRowY = RULER_HEIGHT + ((toId - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                                        const cycleEndX = cycleLength * pixelsPerSecond;

                                        // If arrow would go backwards, split into two segments
                                        if (fromX > toX) {
                                            return (
                                                <g key={`dep-luc-${lIdx}-${toId}`}>
                                                    {/* First segment: from start to end of cycle */}
                                                    <line
                                                        x1={fromX}
                                                        y1={fromRowY}
                                                        x2={cycleEndX}
                                                        y2={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                                        stroke="#999"
                                                        strokeWidth="1"
                                                        opacity="0.6"
                                                    />
                                                    {/* Second segment: from start of cycle to end point */}
                                                    <line
                                                        x1={0}
                                                        y1={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                                        x2={toX}
                                                        y2={toRowY}
                                                        stroke="#999"
                                                        strokeWidth="1"
                                                        markerEnd="url(#dep-arrowhead)"
                                                        opacity="0.6"
                                                    />
                                                </g>
                                            );
                                        }

                                        return (
                                            <line
                                                key={`dep-luc-${lIdx}-${toId}`}
                                                x1={fromX}
                                                y1={fromRowY}
                                                x2={toX}
                                                y2={toRowY}
                                                stroke="#999"
                                                strokeWidth="1"
                                                markerEnd="url(#dep-arrowhead)"
                                                opacity="0.6"
                                            />
                                        );
                                    });
                                })}
                            </svg>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelineDiagram;
