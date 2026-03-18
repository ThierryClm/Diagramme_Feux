import React, { useRef, useState, useCallback, useEffect } from 'react';
import './TimelineDiagram.css';

const TimelineDiagram = ({ groups, globalTime, onGroupClick, pixelsPerSecond = 3, conflicts, conflictMatrix = [], updateGroupParams, cycleLength, actionData = [], updateActionRow, startDrag, endDrag, showDependencies = false, dependencyGap = 20, hoveredActionId, setHoveredActionId, simulationFilter = null, simulationResult = null, simulationCurrentTime = null, isPlayingSimulation = false, setIsPlayingSimulation, setSimulationCurrentTime, hoveredArrowGroupId = null, hoveredArrowGroupSaturated = false, hoveredConflict = null, setHoveredGroupId: setHoveredGroupIdProp = null, setHoveredDiagramTime = null, hoveredVUtile = null, planName = '', activePFName = '', remarques = '', updateRemarques = null, biCarrefourSeparator = null, showComments = true, showRemarks = true, showGroupNames = true, cycleLengthInput, setCycleLengthInput, setCycleLength }) => {
    const containerRef = useRef(null);

    // Drag state - supports both group bars and action overlays
    const [dragState, setDragState] = useState(null);
    // Hovered group id for showing dependencies only for that group
    const [hoveredGroupIdLocal, setHoveredGroupIdLocal] = useState(null);
    // Use local state for internal logic, but also call prop setter if provided
    const hoveredGroupId = hoveredGroupIdLocal;
    const setHoveredGroupId = useCallback((id) => {
        setHoveredGroupIdLocal(id);
        if (setHoveredGroupIdProp) {
            setHoveredGroupIdProp(id);
        }
    }, [setHoveredGroupIdProp]);
    // Phase flag tooltip (aiguillage/escamotage)
    const [phaseFlagTooltipId, setPhaseFlagTooltipId] = useState(null);
    const phaseFlagTimerRef = useRef(null);

    const handleNameMouseEnter = useCallback((groupId) => {
        phaseFlagTimerRef.current = setTimeout(() => {
            setPhaseFlagTooltipId(groupId);
        }, 5000);
    }, []);

    const handleNameMouseLeave = useCallback(() => {
        if (phaseFlagTimerRef.current) {
            clearTimeout(phaseFlagTimerRef.current);
            phaseFlagTimerRef.current = null;
        }
        setPhaseFlagTooltipId(null);
    }, []);

    // Handle Alt+A / Alt+E to toggle phaseFlag
    const handlePhaseFlagKeyDown = useCallback((e, groupId, currentFlag) => {
        if (e.altKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            updateGroupParams(groupId, { phaseFlag: currentFlag === 'a' ? '' : 'a' });
        } else if (e.altKey && (e.key === 'e' || e.key === 'E')) {
            e.preventDefault();
            updateGroupParams(groupId, { phaseFlag: currentFlag === 'e' ? '' : 'e' });
        }
    }, [updateGroupParams]);

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
    const getShiftedActionPosition = (deb, fin, groupId = null, actionType = null, actionPlage = null) => {
        let hidden = false;
        let totalShift = 0;
        let adjustedDeb = deb;
        let adjustedFin = fin;
        let fullShiftOnDeb = 0;

        // For full Adaptatif vertical (applies to all groups), apply special logic:
        // - If BOTH deb and fin are inside [avDeb, avFin] → hidden = true
        // - If only deb is inside → clamp deb to avDeb
        // - If only fin is inside → clamp fin to avDeb
        // - If deb OR fin is >= avFin → shift that value left by adaptatif width
        // - Wrap-around bars (deb > fin) are handled naturally: each value is shifted independently
        // - For 'Escamotage de phase' and 'Adaptatif vertical' actions, only apply shifting (not hiding/clamping)
        if (simulationResult?.timeShifts?.length) {
            const cycle = effectiveCycleLength || cycleLength;
            const isAvOrEscamotage = actionType === 'Escamotage de phase' || actionType === 'Adaptatif vertical';

            simulationResult.timeShifts.forEach(shift => {
                if (!shift.isPartial && shift.amount > 0) {
                    // Full Adaptatif vertical (no plage1/plage2)
                    const avDeb = shift.from - shift.amount;
                    const avFin = shift.from;
                    const avWidth = shift.amount;

                    // For Adaptatif vertical and Escamotage de phase, skip hiding/clamping
                    if (!isAvOrEscamotage) {
                        const debInside = adjustedDeb >= avDeb && adjustedDeb < avFin;
                        const finInside = adjustedFin > avDeb && adjustedFin <= avFin;

                        if (debInside && finInside) {
                            // Both deb and fin are inside the adaptatif zone → hide the bar
                            hidden = true;
                        } else if (debInside) {
                            // Only deb is inside → clamp to avDeb
                            adjustedDeb = avDeb;
                        } else if (finInside) {
                            // Only fin is inside → clamp to avDeb
                            adjustedFin = avDeb;
                        }
                    }

                    // Shift values that are after the adaptatif zone (applies to ALL action types)
                    // Track how much was applied on deb to avoid double-counting with getGroupShift later
                    if (adjustedDeb >= avFin) {
                        adjustedDeb -= avWidth;
                        fullShiftOnDeb += avWidth;
                    }
                    if (adjustedFin >= avFin) {
                        adjustedFin -= avWidth;
                    }

                }
            });
        }

        // Check if action falls within any removed period (for Escamotage de phase)
        // NOTE: 'Escamotage de phase' and 'Adaptatif vertical' are NOT hidden by removed periods
        if (simulationResult?.removedPeriods?.length && actionType !== 'Escamotage de phase' && actionType !== 'Adaptatif vertical' && actionType !== 'Priorité piétons' && actionType !== 'Flèche d\'anticipation' && actionType !== 'Signal aide conduite') {
            for (const period of simulationResult.removedPeriods) {
                // Only check for Escamotage de phase removed periods (not Adaptatif vertical which is handled above)
                // Action is hidden if it's entirely within or overlaps the removed period
                if (adjustedDeb >= period.deb && adjustedDeb < period.fin) {
                    hidden = true;
                    break;
                }
                if (adjustedFin > period.deb && adjustedFin <= period.fin) {
                    hidden = true;
                    break;
                }
                if (adjustedDeb <= period.deb && adjustedFin >= period.fin) {
                    hidden = true;
                    break;
                }
            }
        }

        // For actions with a groupId, use the actual group shift (getGroupShift) which already
        // accounts for Escamotage de phase, Adaptatif vertical (full and partial) via simulatedOffset.
        // For actions WITHOUT a groupId, use timeShifts instead.
        // This avoids double-counting when both mechanisms would apply the same shift.
        // NOTE: "Seconde lucarne" actions are NOT shifted by group glissement (from Fermeture anticipée),
        //       but SHOULD be shifted by Escamotage de phase timeShifts.
        // NOTE: For full Adaptatif vertical, shifts are already applied above, so skip here
        if (groupId && simulationResult && actionType !== 'Seconde lucarne') {
            const groupShift = getGroupShift(groupId);
            if (groupShift > 0) {
                // Subtract shift already applied by the full shift logic above to avoid double-counting
                // (Escamotage de phase and full Adaptatif vertical shift deb in both places)
                totalShift = Math.max(0, groupShift - fullShiftOnDeb);
            }
            // Note: No need to add partial Adaptatif vertical shifts here - getGroupShift() already
            // includes them since simulatedOffset is modified for groups in the plage range.
        } else if (simulationResult?.timeShifts?.length) {
            // For actions without a groupId, OR for "Seconde lucarne" (which has groupId but
            // should NOT use getGroupShift), use timeShifts directly for Escamotage de phase shifts
            simulationResult.timeShifts.forEach(shift => {
                if (adjustedDeb >= shift.from) {
                    if (!shift.isPartial) {
                        // Full shift (Escamotage de phase) - but NOT Adaptatif vertical (handled above)
                        // Check if this is an Escamotage de phase shift vs Adaptatif vertical
                        // Adaptatif vertical shifts have amount > 0 and are already handled above
                        // This section is for Escamotage de phase only
                    } else if (groupId) {
                        // Partial shift (Adaptatif vertical) - check if group is in plage range
                        const gId = parseInt(groupId);
                        if (gId >= shift.plage1 && gId <= shift.plage2) {
                            totalShift += shift.amount;
                        }
                    } else {
                        // Partial shift for actions without groupId
                        // Only shift if the action's plage is entirely within the shift's plage range
                        // Actions without plage (e.g., Escamotage de phase) or with plage extending
                        // outside the shift's plage are NOT shifted (independent diagrams)
                        if (actionPlage &&
                            actionPlage.plage1 >= shift.plage1 &&
                            actionPlage.plage2 <= shift.plage2) {
                            totalShift += shift.amount;
                        }
                    }
                }
            });
        }

        // Apply remaining shift with wrap-around handling (for group shifts and partial Adaptatif vertical)
        const cycle = effectiveCycleLength || cycleLength;
        const shiftedDeb = ((adjustedDeb - totalShift) % cycle + cycle) % cycle;

        // If original fin equals cycle, don't apply modulo (keep at cycle position)
        const finAfterShift = adjustedFin - totalShift;
        const shiftedFin = (fin === cycle)
            ? finAfterShift
            : ((finAfterShift % cycle + cycle) % cycle);

        return { deb: shiftedDeb, fin: shiftedFin, hidden };
    };

    // Handlers (Duplicated from GroupTable logic, could be extracted to hook)
    const handleStartChange = (id, value) => {
        // When changing Deb, keep Fin fixed and update duration
        const group = groups.find(g => g.id === id);
        if (!group) return;

        const newStart = parseInt(value) || 0;
        const oldStart = group.offset % cycleLength;
        const oldDuration = group.durations.green;
        const oldEnd = (oldStart + oldDuration) % cycleLength;

        // Calculate new duration to keep Fin fixed
        let newDuration = oldEnd - newStart;
        if (newDuration <= 0) newDuration += cycleLength;

        updateGroupParams(id, {
            offset: newStart,
            durations: { green: Math.max(1, newDuration) }
        });
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
    // Note: actGf1 is optional - if not set, rectangle is shown on source group without arrows
    const escamotageGroupActions = actionData.filter(action =>
        action.action === 'Escamotage' && action.gf &&
        (!simulationFilter || !simulationFilter.has(action.id))
    );

    // Get SELECTED "Escamotage" actions (for cutting target group bar when checked)
    const selectedEscamotageGroup = simulationFilter ? actionData.filter(action =>
        action.action === 'Escamotage' && action.gf && action.actGf1 &&
        simulationFilter.has(action.id)
    ) : [];

    // Precompute shifted zone ranges for brace truncation (SELECTED/checked zones only - simulation mode)
    const braceZoneRanges = [];
    selectedEscamotageDePhase.forEach(a => {
        const zDeb = parseInt(a.deb) || 0;
        const zFin = parseInt(a.fin) || 0;
        const shifted = getShiftedActionPosition(zDeb, zFin, null, 'Escamotage de phase');
        if (!shifted.hidden) {
            braceZoneRanges.push({ deb: shifted.deb, fin: shifted.fin, rawDeb: zDeb, rawFin: zFin });
        }
    });
    selectedAdaptatifVertical.forEach(a => {
        const zDeb = parseInt(a.deb) || 0;
        const zFin = parseInt(a.fin) || 0;
        const plage1 = parseInt(a.plage1) || 0;
        const plage2 = parseInt(a.plage2) || 0;
        const avPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
        const shifted = getShiftedActionPosition(zDeb, zFin, null, 'Adaptatif vertical', avPlage);
        if (!shifted.hidden) {
            braceZoneRanges.push({ deb: shifted.deb, fin: shifted.fin, rawDeb: zDeb, rawFin: zFin, plage1, plage2, isPartial: !!avPlage });
        }
    });

    // Get all "Signal aide conduite" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    const signaActions = actionData.filter(action => {
        if (action.action !== 'Signal aide conduite') return false;
        if (action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        if (deb === fin) return false;
        // Only show if orange zone exists (fin - 5 > deb)
        if (fin - 5 <= deb) return false;
        return true;
    });

    // Get all "Contrôle de flot" actions
    // Shows: intermittent yellow/gray from DEB to minGreen, then orange for orange duration, then red to FIN
    const controleFlotActions = actionData.filter(action => {
        if (action.action !== 'Contrôle de flot') return false;
        if (action.gf === '' || action.gf === undefined) return false;
        if (action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        if (deb >= fin) return false;
        return true;
    });

    // Get all "Point de repos" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // If plage1 is not set, default to 1 (first group)
    // If plage2 is not set, default to groups.length (total number of groups)
    const pointReposActions = actionData.filter(action => {
        if (action.action !== 'Point de repos') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage1: (action.plage1 === '' || action.plage1 === undefined || isNaN(parseInt(action.plage1)) || parseInt(action.plage1) < 1)
            ? 1
            : action.plage1,
        plage2: (action.plage2 === '' || action.plage2 === undefined || isNaN(parseInt(action.plage2)) || parseInt(action.plage2) < 1)
            ? groups.length
            : action.plage2
    }));

    // Get all "Synchro BTS" actions
    // In simulation mode: show overlay ONLY when action is CHECKED (normal logic - hidden by default)
    // If plage1 is not set, default to 1 (first group)
    // If plage2 is not set, default to groups.length (total number of groups)
    const synchroBtsActions = actionData.filter(action => {
        if (action.action !== 'Synchro BTS') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        if (simulationFilter && !simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage1: (action.plage1 === '' || action.plage1 === undefined || isNaN(parseInt(action.plage1)) || parseInt(action.plage1) < 1)
            ? 1
            : action.plage1,
        plage2: (action.plage2 === '' || action.plage2 === undefined || isNaN(parseInt(action.plage2)) || parseInt(action.plage2) < 1)
            ? groups.length
            : action.plage2
    }));

    // Get all "Instant Co" actions
    // In simulation mode: show overlay ONLY when action is CHECKED (normal logic - hidden by default)
    // If plage1 is not set, default to 1 (first group)
    // If plage2 is not set, default to groups.length (total number of groups)
    const instantCoActions = actionData.filter(action => {
        if (action.action !== 'Instant Co') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        if (simulationFilter && !simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage1: (action.plage1 === '' || action.plage1 === undefined || isNaN(parseInt(action.plage1)) || parseInt(action.plage1) < 1)
            ? 1
            : action.plage1,
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
        // Ne pas masquer : les contractions décalent cette action via getShiftedActionPosition
        return true;
    });

    // Get all "Flèche d'anticipation" actions (same representation as Priorité piétons)
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase or Adaptatif vertical
    const flecheAnticipationActions = actionData.filter(action => {
        if (action.action !== "Flèche d'anticipation") return false;
        if (action.gf === '' || action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Ne pas masquer : les contractions décalent cette action via getShiftedActionPosition
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
    const ROW_TOTAL_HEIGHT = ROW_HEIGHT + 1; // Row height + 1px border

    // Helper to get the Y position for a group row (center of the row)
    const getGroupRowY = (groupId) => {
        const groupIndex = groups.findIndex(g => g.id === parseInt(groupId));
        if (groupIndex === -1) return null;
        // RULER_HEIGHT + 1px ruler border + (index * row total height) + half row height
        return RULER_HEIGHT + 1 + (groupIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
    };

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
    // Uses simulated offset and green duration when in simulation mode
    const getGroupEndPos = (groupId) => {
        const group = groups.find(g => g.id === parseInt(groupId));
        if (!group) return null;

        let startPos;
        let greenDuration;
        // In simulation mode, use simulated offset and green duration if available
        if (simulationResult) {
            const simGroup = simulationResult.simulatedGroups.find(g => g.id === parseInt(groupId));
            if (simGroup) {
                startPos = simGroup.simulatedOffset % effectiveCycleLength;
                greenDuration = simGroup.simulatedGreen !== undefined ? simGroup.simulatedGreen : (group.durations?.green || 0);
            } else {
                startPos = group.offset % cycleLength;
                greenDuration = group.durations?.green || 0;
            }
        } else {
            startPos = group.offset % cycleLength;
            greenDuration = group.durations?.green || 0;
        }

        const cycle = simulationResult ? effectiveCycleLength : cycleLength;
        const endPos = startPos + greenDuration;
        // If end position equals cycle exactly, keep it at cycle instead of wrapping to 0
        return endPos === cycle ? cycle : (endPos % cycle);
    };

    // Helper to check if a group wraps around the cycle (green crosses cycle boundary)
    const doesGroupWrap = (groupId) => {
        const group = groups.find(g => g.id === parseInt(groupId));
        if (!group) return false;

        let startPos;
        let greenDuration;
        if (simulationResult) {
            const simGroup = simulationResult.simulatedGroups.find(g => g.id === parseInt(groupId));
            if (simGroup) {
                startPos = simGroup.simulatedOffset % effectiveCycleLength;
                greenDuration = simGroup.simulatedGreen !== undefined ? simGroup.simulatedGreen : (group.durations?.green || 0);
            } else {
                startPos = group.offset % cycleLength;
                greenDuration = group.durations?.green || 0;
            }
        } else {
            startPos = group.offset % cycleLength;
            greenDuration = group.durations?.green || 0;
        }

        const cycle = simulationResult ? effectiveCycleLength : cycleLength;
        return (startPos + greenDuration) > cycle;
    };

    return (
        <div className={`timeline-container ${dragState ? 'dragging' : ''}`} ref={containerRef}>
            <h3 className="diagram-title">
                <span>Diagramme{planName ? ` : simulation du plan de feu ${planName}` : (activePFName ? ` - ${activePFName}` : '')}</span>
                {setCycleLengthInput && (
                    planName ? (
                        <span style={{ marginLeft: '50px', fontSize: '14px', fontWeight: 'normal' }}>
                            Cycle {simulationResult?.simulatedCycleLength || cycleLength} secondes
                        </span>
                    ) : (
                        <label className="cycle-input-label" style={{ marginLeft: '50px', fontSize: '14px', fontWeight: 'normal' }}>
                            Cycle:
                            <input
                                type="number"
                                min="10"
                                value={cycleLengthInput}
                                onChange={(e) => setCycleLengthInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.target.blur();
                                    }
                                }}
                                onBlur={() => {
                                    const newCycle = parseInt(cycleLengthInput);
                                    if (!isNaN(newCycle) && newCycle >= 10 && newCycle !== cycleLength) {
                                        setCycleLength(newCycle);
                                    } else {
                                        setCycleLengthInput(cycleLength.toString());
                                    }
                                }}
                                className="input-count"
                            />
                            <span>s</span>
                        </label>
                    )
                )}
                {planName && setIsPlayingSimulation && (
                    <div className="diagram-playback" style={{ marginLeft: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'normal' }}>
                        <button
                            className={`sim-btn ${isPlayingSimulation ? 'playing' : ''}`}
                            onClick={() => setIsPlayingSimulation(!isPlayingSimulation)}
                            title={isPlayingSimulation ? 'Pause' : 'Lecture'}
                        >
                            {isPlayingSimulation ? '⏸' : '▶'}
                        </button>
                        <button
                            className="sim-btn reset-btn"
                            onClick={() => { setIsPlayingSimulation(false); setSimulationCurrentTime(0); }}
                            title="Réinitialiser"
                        >
                            ⏹
                        </button>
                        <input
                            type="range"
                            min="0"
                            max={(simulationResult?.simulatedCycleLength || cycleLength) - 1}
                            value={simulationCurrentTime || 0}
                            onChange={(e) => setSimulationCurrentTime(parseInt(e.target.value) || 0)}
                            className="time-slider"
                            title="Position dans le cycle"
                        />
                        <span className="sim-time" style={{ color: '#fff', whiteSpace: 'nowrap', fontSize: '14px' }}>
                            {simulationCurrentTime || 0}s / {simulationResult?.simulatedCycleLength || cycleLength}s
                        </span>
                    </div>
                )}
            </h3>
            <div className="timeline-layout">
                <div className="timeline-sidebar">
                    {/* Header Label for Sidebar */}
                    <div className="sidebar-header-row">
                        <span className="col-label col-grp">Grp</span>
                        <span className="col-label col-name">Nom</span>
                        <span className="col-label col-da">DA</span>
                        <span className="col-label col-time">Déb</span>
                        <span className="col-label col-time">Fin</span>
                        <span className="col-label col-time">Durée</span>
                    </div>

                    {groups.map(g => {
                        // Use simulated values during simulation, original values otherwise
                        const simGroup = simulationResult ? getSimulatedGroup(g.id) : null;
                        const isSimEscamoted = simGroup?.isEscamoted || false;
                        const start = simGroup
                            ? (simGroup.simulatedOffset % effectiveCycleLength)
                            : (g.offset % cycleLength);
                        const duration = simGroup
                            ? simGroup.simulatedGreen
                            : g.durations.green;
                        const end = isSimEscamoted ? 0 : ((start + duration) % (simGroup ? effectiveCycleLength : cycleLength));
                        // Show both values if either is non-zero (and not escamoted during simulation)
                        const hasValue = !isSimEscamoted && (start > 0 || end > 0);

                        const isLabelHighlighted = hoveredArrowGroupId === g.id;
                        return (
                            <div
                                key={g.id}
                                className="row-label-container"
                                style={{ ...(isLabelHighlighted ? { backgroundColor: hoveredArrowGroupSaturated ? 'rgba(231, 76, 60, 0.25)' : 'rgba(100, 150, 255, 0.2)' } : {}), ...(biCarrefourSeparator != null && g.id === biCarrefourSeparator ? { borderBottom: '1px solid white' } : {}) }}
                                tabIndex={0}
                                onClick={() => onGroupClick(g)}
                                onKeyDown={(e) => handlePhaseFlagKeyDown(e, g.id, g.phaseFlag)}
                            >
                                <span className="label-id">{g.id}</span>
                                {showGroupNames && (
                                    <div
                                        className="label-name-wrapper"
                                        onMouseEnter={() => handleNameMouseEnter(g.id)}
                                        onMouseLeave={handleNameMouseLeave}
                                    >
                                        <span
                                            className="label-name"
                                            onMouseEnter={(e) => {
                                                const el = e.currentTarget;
                                                el.title = el.scrollWidth > el.clientWidth ? g.name : '';
                                            }}
                                            style={{
                                                backgroundColor:
                                                    (g.type === 'VL' || g.type === 'V') ? 'rgba(100, 180, 255, 0.25)' :
                                                    (g.type === 'TC' || g.type === 'B') ? 'rgba(148, 0, 211, 0.1)' :
                                                    (g.type === 'Piéton' || g.type === 'P') ? 'rgba(0, 255, 0, 0.1)' :
                                                    (g.type === 'Cycliste' || g.type === 'CY') ? 'rgba(255, 255, 0, 0.1)' :
                                                    'transparent'
                                            }}
                                        >
                                            {g.name || '-'}
                                            {g.phaseFlag && (
                                                <span className="phase-flag-indicator">{g.phaseFlag}</span>
                                            )}
                                        </span>
                                        {phaseFlagTooltipId === g.id && (
                                            <div className="phase-flag-tooltip">
                                                Alt+A : aiguillage, Alt+E : escamotage
                                            </div>
                                        )}
                                    </div>
                                )}
                                {(g.type === 'V' || g.type === 'B') ? (
                                    <input
                                        type="text"
                                        className="input-da"
                                        value={g.da || ''}
                                        onChange={(e) => updateGroupParams(g.id, { da: e.target.value.slice(0, 2) })}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Code trajet"
                                        maxLength={2}
                                        placeholder=""
                                    />
                                ) : (
                                    <span className="input-da-placeholder"></span>
                                )}
                                {g.type ? (
                                    <>
                                        <input
                                            type="number"
                                            className="input-time-sm"
                                            value={hasValue ? start : ''}
                                            onChange={(e) => !simulationResult && handleStartChange(g.id, e.target.value)}
                                            readOnly={!!simulationResult}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder=""
                                            style={simulationResult ? { cursor: 'default', background: 'transparent', border: 'none' } : undefined}
                                        />
                                        <input
                                            type="number"
                                            className="input-time-sm"
                                            value={hasValue ? end : ''}
                                            onChange={(e) => !simulationResult && handleEndChange(g.id, e.target.value, start)}
                                            readOnly={!!simulationResult}
                                            onClick={(e) => e.stopPropagation()}
                                            style={simulationResult
                                                ? { color: duration < g.minGreen ? '#ff4d4d' : 'inherit', cursor: 'default', background: 'transparent', border: 'none' }
                                                : { color: duration < g.minGreen ? '#ff4d4d' : 'inherit' }
                                            }
                                            placeholder=""
                                        />
                                        <input
                                            type="number"
                                            className="input-time-sm"
                                            value={hasValue && duration > 0 ? duration : ''}
                                            readOnly
                                            onClick={(e) => e.stopPropagation()}
                                            title="Durée"
                                            style={{
                                                color: duration < g.minGreen ? '#ff4d4d' : 'inherit',
                                                cursor: 'default',
                                                background: 'transparent',
                                                border: 'none'
                                            }}
                                            placeholder=""
                                        />
                                    </>
                                ) : (
                                    <>
                                        <span className="input-time-sm-placeholder"></span>
                                        <span className="input-time-sm-placeholder"></span>
                                        <span className="input-time-sm-placeholder"></span>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="timeline-scroll-area" style={{ width: `${totalWidth}px` }}>
                    <div className="timeline-track-container" style={{ width: `${totalWidth}px` }}>
                        {/* Grid lines */}
                        <div className="timeline-grid">
                            {Array.from({ length: TIME_WINDOW + 1 }).map((_, i) => {
                                let gridClass = 'grid-line grid-1s';
                                if (i === TIME_WINDOW) gridClass = 'grid-line grid-cycle-end';
                                else if (i % 10 === 0) gridClass = 'grid-line grid-10s';
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
                                    height: `${RULER_HEIGHT + 1 + (groups.length * ROW_TOTAL_HEIGHT) + 30}px`
                                }}
                            >
                                <div className="playhead-time">{simulationCurrentTime}s</div>
                            </div>
                        )}

                        {/* Rows */}
                        {groups.map((group) => {
                            const groupActions = getActionsForGroup(group.id);
                            // Filter out conflicts that are managed by a SELECTED Escamotage action
                            const isConflict = conflicts && conflicts.some(c => {
                                if (c.from !== group.id && c.to !== group.id) return false;
                                // Check if this conflict is inhibited by a selected Escamotage action
                                const isInhibitedByEscamotage = selectedEscamotageGroup.some(action => {
                                    const sourceGfId = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                                    const targetGfId = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                                    return (sourceGfId === c.from && targetGfId === c.to) ||
                                           (sourceGfId === c.to && targetGfId === c.from);
                                });
                                if (isInhibitedByEscamotage) return false;
                                // Check if first group has a phaseFlag (aiguillage/escamotage)
                                const fromGrp = groups.find(g => g.id === c.from);
                                if (fromGrp?.phaseFlag) return false;
                                return true;
                            });
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
                            const arrowHighlightClass = isHighlightedByArrow ? (hoveredArrowGroupSaturated ? 'arrow-highlighted arrow-saturated' : 'arrow-highlighted') : '';

                            return (
                                <div
                                    key={group.id}
                                    className={`timeline-row-track ${isConflict ? 'row-conflict' : ''}`}
                                    onClick={() => onGroupClick(group)}
                                    style={{ backgroundColor: isHighlightedByArrow ? (hoveredArrowGroupSaturated ? 'rgba(231, 76, 60, 0.25)' : 'rgba(100, 150, 255, 0.2)') : (isConflict ? 'rgba(231, 76, 60, 0.1)' : 'transparent'), ...(biCarrefourSeparator != null && group.id === biCarrefourSeparator ? { borderBottom: '1px solid white' } : {}) }}
                                    onMouseEnter={() => setHoveredGroupId(group.id)}
                                    onMouseLeave={() => {
                                        setHoveredGroupId(null);
                                        if (setHoveredDiagramTime) setHoveredDiagramTime(null);
                                    }}
                                    onMouseMove={(e) => {
                                        if (setHoveredDiagramTime) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const time = Math.floor(x / pixelsPerSecond);
                                            setHoveredDiagramTime(Math.max(0, Math.min(time, effectiveCycleLength - 1)));
                                        }
                                    }}
                                >
                                    {/* Base bars from group Début/Fin (sidebar values) - only if phase exists */}
                                    {hasPhase && (() => {
                                        const isPedestrian = group.type === 'P' || group.type === 'Piéton';
                                        const isCyclist = group.type === 'CY' || group.type === 'Cycliste';
                                        const isFlOrPP = group.type === 'FL' || group.type === 'PP';

                                        // FL and PP types don't show the green bar (only yellow intermittent bar)
                                        if (isFlOrPP) return null;

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

                                        // V.Utile overlay (capacity color on first green seconds) - available for ALL cases
                                        const showVUtileOverlay = hoveredVUtile && hoveredVUtile.groupId === group.id;
                                        const vUtileSec = showVUtileOverlay ? Math.min(hoveredVUtile.vUtile, greenDuration) : 0;
                                        const getCapacityColorClass = (value) => {
                                            if (value === null || value === undefined) return '';
                                            if (value < 76) return 'vutile-green';
                                            if (value <= 85) return 'vutile-orange';
                                            if (value <= 100) return 'vutile-red';
                                            return 'vutile-black';
                                        };
                                        const vUtileColorClass = showVUtileOverlay ? getCapacityColorClass(hoveredVUtile.capacityValue) : '';
                                        const vUtileTitle = showVUtileOverlay ? `V.Utile: ${hoveredVUtile.vUtile}s (${hoveredVUtile.capacityValue}%)` : '';

                                        if (greenWrapsAround) {
                                            // Green bar wraps around
                                            const firstPartSec = currentCycleLen - offset;
                                            const secondPartSec = (offset + greenDuration) % currentCycleLen;
                                            const firstPartWidth = firstPartSec * pixelsPerSecond;
                                            const secondPartWidth = secondPartSec * pixelsPerSecond;
                                            // V.Utile split across the two green parts
                                            const vUtileFirstSec = Math.min(vUtileSec, firstPartSec);
                                            const vUtileSecondSec = Math.max(0, vUtileSec - firstPartSec);

                                            // Check if orange also wraps
                                            if (orangeWrapsAround) {
                                                const orangeFirstPartWidth = (currentCycleLen - greenEnd) * pixelsPerSecond;
                                                const orangeSecondPartWidth = orangeEnd * pixelsPerSecond;

                                                return (
                                                    <React.Fragment>
                                                        {/* First part: from offset to end of cycle */}
                                                        <div
                                                            className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                                            style={{ left: `${offset * pixelsPerSecond}px` }}
                                                        >
                                                            <div
                                                                className="drag-handle drag-handle-start"
                                                                onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                                title="Glisser pour modifier le début"
                                                            />
                                                            <div className="phase-bar green" style={{ width: `${firstPartWidth}px` }}></div>
                                                            {showVUtileOverlay && vUtileFirstSec > 0 && (
                                                                <div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileFirstSec * pixelsPerSecond}px` }} title={vUtileTitle} />
                                                            )}
                                                        </div>
                                                        {/* Second part: green from 0 + orange first part to end of cycle */}
                                                        <div
                                                            className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                                            style={{ left: '0px' }}
                                                        >
                                                            <div className="phase-bar green" style={{ width: `${secondPartWidth}px` }}></div>
                                                            <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeFirstPartWidth}px` }}></div>
                                                            {showVUtileOverlay && vUtileSecondSec > 0 && (
                                                                <div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileSecondSec * pixelsPerSecond}px` }} title={vUtileTitle} />
                                                            )}
                                                            <div
                                                                className="drag-handle drag-handle-end"
                                                                onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                                                style={{ left: `${secondPartWidth}px` }}
                                                                title="Glisser pour modifier la fin"
                                                            />
                                                        </div>
                                                        {/* Third part: orange continuation at start of cycle */}
                                                        <div
                                                            className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
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
                                                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                                        style={{ left: `${offset * pixelsPerSecond}px` }}
                                                    >
                                                        <div
                                                            className="drag-handle drag-handle-start"
                                                            onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                            title="Glisser pour modifier le début"
                                                        />
                                                        <div className="phase-bar green" style={{ width: `${firstPartWidth}px` }}></div>
                                                        {showVUtileOverlay && vUtileFirstSec > 0 && (
                                                            <div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileFirstSec * pixelsPerSecond}px` }} title={vUtileTitle} />
                                                        )}
                                                    </div>
                                                    {/* Second part: from start of cycle to end */}
                                                    <div
                                                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                                        style={{ left: '0px' }}
                                                    >
                                                        <div className="phase-bar green" style={{ width: `${secondPartWidth}px` }}></div>
                                                        <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                        {showVUtileOverlay && vUtileSecondSec > 0 && (
                                                            <div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileSecondSec * pixelsPerSecond}px` }} title={vUtileTitle} />
                                                        )}
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
                                            const vUtileWidthPx = vUtileSec * pixelsPerSecond;

                                            return (
                                                <React.Fragment>
                                                    {/* Main part: green + first part of orange */}
                                                    <div
                                                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                                        style={{ left: `${offset * pixelsPerSecond}px` }}
                                                    >
                                                        <div
                                                            className="drag-handle drag-handle-start"
                                                            onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                            title="Glisser pour modifier le début"
                                                        />
                                                        <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                                                        <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeFirstPartWidth}px` }}></div>
                                                        {showVUtileOverlay && vUtileSec > 0 && (
                                                            <div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileWidthPx}px` }} title={vUtileTitle} />
                                                        )}
                                                        <div
                                                            className="drag-handle drag-handle-end"
                                                            onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                                            style={{ left: `${greenWidth}px` }}
                                                            title="Glisser pour modifier la fin"
                                                        />
                                                    </div>
                                                    {/* Orange continuation at start of cycle */}
                                                    <div
                                                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
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
                                                className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                                style={{ left: `${offset * pixelsPerSecond}px` }}
                                            >
                                                <div
                                                    className="drag-handle drag-handle-start"
                                                    onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                    title="Glisser pour modifier le début"
                                                />
                                                <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                                                <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                {showVUtileOverlay && vUtileSec > 0 && (
                                                    <div
                                                        className={`vutile-overlay ${vUtileColorClass}`}
                                                        style={{ width: `${vUtileSec * pixelsPerSecond}px` }}
                                                        title={vUtileTitle}
                                                    />
                                                )}
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

                                    {/* Green cuts from SELECTED Escamotage (group-specific) actions */}
                                    {selectedEscamotageGroup
                                        .filter(action => {
                                            const targetGfId = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                                            return targetGfId === group.id;
                                        })
                                        .map((action, idx) => {
                                            const sourceGfId = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                                            const targetGfId = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                                            if (sourceGfId === 0 || targetGfId === 0) return null;

                                            const sourceGroup = groups.find(g => g.id === sourceGfId);
                                            if (!sourceGroup) return null;

                                            // Get intergreen times from conflict matrix
                                            const intergreenSourceToTarget = conflictMatrix[sourceGfId - 1]?.[targetGfId - 1] || 0;
                                            const intergreenTargetToSource = conflictMatrix[targetGfId - 1]?.[sourceGfId - 1] || 0;

                                            // Source group times
                                            const currentCycleLen = effectiveCycleLength || cycleLength;
                                            const sourceStart = sourceGroup.offset % currentCycleLen;
                                            const sourceEndRaw = sourceStart + sourceGroup.durations.green;
                                            const sourceEnd = sourceEndRaw === currentCycleLen ? currentCycleLen : (sourceEndRaw % currentCycleLen);

                                            // Calculate arrow target positions (cut boundaries)
                                            // Arrow 1: target = sourceStart - intergreenTargetToSource
                                            const cutStart = ((sourceStart - intergreenTargetToSource) % currentCycleLen + currentCycleLen) % currentCycleLen;
                                            // Arrow 2: target = sourceEnd + intergreenSourceToTarget
                                            const cutEndRaw = sourceEnd + intergreenSourceToTarget;
                                            const cutEnd = cutEndRaw === currentCycleLen ? currentCycleLen : (cutEndRaw % currentCycleLen);

                                            const wrapsAround = cutStart > cutEnd;

                                            if (wrapsAround) {
                                                const firstPartWidth = (currentCycleLen - cutStart) * pixelsPerSecond;
                                                const secondPartWidth = cutEnd * pixelsPerSecond;
                                                return (
                                                    <React.Fragment key={`escam-group-cut-${idx}`}>
                                                        <div
                                                            className="green-cut-overlay"
                                                            style={{
                                                                left: `${cutStart * pixelsPerSecond}px`,
                                                                width: `${firstPartWidth}px`
                                                            }}
                                                        />
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

                                            const cutWidth = (cutEnd - cutStart) * pixelsPerSecond;
                                            return (
                                                <div
                                                    key={`escam-group-cut-${idx}`}
                                                    className="green-cut-overlay"
                                                    style={{
                                                        left: `${cutStart * pixelsPerSecond}px`,
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

                                        // For Fermeture anticipée: calculate brace start position
                                        // Si l'adaptatif vertical décale la fin de vert, l'accolade se décale du même delta
                                        // Si la fin de vert n'est pas décalée, l'accolade reste à sa position d'origine
                                        let fermetureStartPos = deb; // Default to shifted deb
                                        let fermetureEndPos = fin; // Default to shifted fin
                                        if (action.action === 'Fermeture anticipée' && simGroup) {
                                            const originalGreenEnd = group.offset + group.durations.green;
                                            const simulatedGreenEnd = simGroup.simulatedOffset + simGroup.simulatedGreen;
                                            if (originalGreenEnd !== simulatedGreenEnd) {
                                                // Vérifier si l'accolade chevauche une zone (début avant, fin dans la zone)
                                                let straddlesZone = null;
                                                for (const zone of braceZoneRanges) {
                                                    if (zone.isPartial) {
                                                        const gId = parseInt(group.id);
                                                        if (gId < zone.plage1 || gId > zone.plage2) continue;
                                                    }
                                                    if (origDeb < zone.rawDeb && origFin > zone.rawDeb && origFin <= zone.rawFin) {
                                                        straddlesZone = zone;
                                                        break;
                                                    }
                                                }

                                                if (straddlesZone) {
                                                    // Début avant la zone : ne pas décaler, tronquer la fin au deb de la zone
                                                    fermetureEndPos = straddlesZone.deb;
                                                } else {
                                                    // Position relative à la fin de vert simulée
                                                    const simGreenEnd = simulatedGreenEnd % effectiveCycleLength;
                                                    fermetureStartPos = ((simGreenEnd + (origDeb - originalGreenEnd)) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
                                                    fermetureEndPos = ((simGreenEnd + (origFin - originalGreenEnd)) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
                                                }
                                            }
                                        }
                                        // Tronquer l'accolade si elle chevauche une zone Escamotage/Adaptatif
                                        if (action.action === 'Fermeture anticipée') {
                                            for (const zone of braceZoneRanges) {
                                                // Adaptatif partiel : n'affecte que les groupes dans la plage
                                                if (zone.isPartial) {
                                                    const gId = parseInt(group.id);
                                                    if (gId < zone.plage1 || gId > zone.plage2) continue;
                                                }
                                                if (zone.deb < zone.fin && fermetureStartPos < fermetureEndPos) {
                                                    if (fermetureStartPos < zone.deb && fermetureEndPos > zone.deb) {
                                                        // Début accolade < début zone : tronquer la fin au début de la zone
                                                        fermetureEndPos = zone.deb;
                                                    } else if (fermetureStartPos >= zone.deb && fermetureStartPos < zone.fin) {
                                                        // Début accolade dans la zone : pousser le début après la zone
                                                        fermetureStartPos = zone.fin;
                                                    }
                                                }
                                            }
                                        }
                                        const fermetureLeftPos = fermetureStartPos * pixelsPerSecond;

                                        return (
                                            <React.Fragment key={`action-${idx}`}>
                                                {/* Abrv label on the bar (not for Ouverture anticipée, Escamotage de phase, Adaptatif vertical which have their own labels) */}
                                                {abrv && action.action !== 'Ouverture anticipée' && action.action !== 'Escamotage de phase' && action.action !== 'Adaptatif vertical' && (
                                                    <div
                                                        className="bar-label"
                                                        style={{
                                                            left: `${(action.action === 'Fermeture anticipée' ? fermetureLeftPos : leftPos) + 2}px`,
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
                                                                    onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                                                    onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
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
                                                                    onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                                                    onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
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
                                                            onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                                            onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
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
                                                    // Don't render brace if the group is escamoted or has no green
                                                    if (isEscamoted || greenDuration <= 0) {
                                                        return null;
                                                    }
                                                    // Use the pre-calculated fermetureStartPos (same as abbreviation)
                                                    // This ensures brace and abbreviation are always at the same position
                                                    const braceStart = fermetureStartPos;
                                                    const braceEnd = fermetureEndPos; // Use truncated fin (accounting for zone overlap)
                                                    // Validate: brace should have positive duration
                                                    // If braceEnd == braceStart, skip rendering
                                                    const normalDuration = braceEnd >= braceStart
                                                        ? braceEnd - braceStart
                                                        : (effectiveCycleLength - braceStart + braceEnd);
                                                    // Skip if duration is 0 or spans almost the entire cycle (which indicates an error)
                                                    if (normalDuration <= 0 || normalDuration >= effectiveCycleLength - 1) {
                                                        return null;
                                                    }
                                                    const braceDuration = normalDuration;
                                                    const braceLeftPos = braceStart * pixelsPerSecond;
                                                    const braceWidth = braceDuration * pixelsPerSecond;

                                                    const wrapsAround = braceStart > braceEnd;
                                                    if (wrapsAround) {
                                                        const firstPartWidth = (effectiveCycleLength - braceStart) * pixelsPerSecond;
                                                        const secondPartWidth = braceEnd * pixelsPerSecond;
                                                        return (
                                                            <React.Fragment>
                                                                <div
                                                                    className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: `${braceLeftPos}px`, width: `${firstPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <span className="brace-point"></span>
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-start"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}
                                                                        title="Glisser pour modifier le début"
                                                                    />
                                                                </div>
                                                                <div
                                                                    className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: '0px', width: `${secondPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <span className="brace-point"></span>
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-end"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}
                                                                        title="Glisser pour modifier la fin"
                                                                    />
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                            style={{ left: `${braceLeftPos}px`, width: `${braceWidth}px` }}
                                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                                            onMouseLeave={() => setHoveredActionId(null)}
                                                        >
                                                            <span className="brace-point"></span>
                                                            <div
                                                                className="action-drag-handle action-drag-handle-start"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}
                                                                title="Glisser pour modifier le début"
                                                            />
                                                            <div
                                                                className="action-drag-handle action-drag-handle-end"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}
                                                                title="Glisser pour modifier la fin"
                                                            />
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
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;
                            const avPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
                            const shifted = getShiftedActionPosition(origDeb, origFin, null, 'Adaptatif vertical', avPlage);
                            if (shifted.hidden) return null;
                            const deb = shifted.deb;
                            const fin = shifted.fin;
                            const leftPos = deb * pixelsPerSecond;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            let topPos, height;
                            if (plage1 > 0 && plage2 > 0) {
                                // Plage values are group numbers (1-indexed)
                                const startGroup = Math.min(plage1, plage2) - 1;
                                const endGroup = Math.max(plage1, plage2) - 1;
                                topPos = RULER_HEIGHT + 1 + (startGroup * ROW_TOTAL_HEIGHT);
                                height = (endGroup - startGroup + 1) * ROW_TOTAL_HEIGHT + 8;
                            } else {
                                // No plage values - full height
                                topPos = RULER_HEIGHT + 1;
                                height = groups.length * ROW_TOTAL_HEIGHT + 8;
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

                                // Check if target group (Action GF) overlaps with source group (GF)
                                // Get source group green period
                                const sourceGroup = groups.find(g => g.id === sourceGf);
                                const targetGroup = groups.find(g => g.id === parseInt(targetGf));
                                if (!sourceGroup || !targetGroup) return null;

                                // Skip if source group is escamoted or has no green duration
                                const sourceSimGroup = getSimulatedGroup(sourceGf);
                                if (sourceSimGroup?.isEscamoted || (sourceSimGroup?.simulatedGreen !== undefined && sourceSimGroup.simulatedGreen <= 0)) {
                                    return null;
                                }

                                const sourceStart = getGroupStartPos(sourceGf);
                                const sourceEnd = getGroupEndPos(sourceGf);
                                const targetEnd = getGroupEndPos(targetGf);

                                // Check if target group's green overlaps with source group's green
                                // Overlap occurs if target's green period intersects with source's green period
                                const cycle = simulationResult ? effectiveCycleLength : cycleLength;
                                let groupsOverlap = false;

                                if (sourceStart !== null && sourceEnd !== null && targetEnd !== null) {
                                    // Handle wrap-around cases
                                    const sourceWraps = doesGroupWrap(sourceGf);
                                    const targetWraps = doesGroupWrap(targetGf);

                                    if (!sourceWraps && !targetWraps) {
                                        // Neither wraps: simple overlap check
                                        groupsOverlap = (targetStartPos < sourceEnd && targetEnd > sourceStart);
                                    } else if (sourceWraps && !targetWraps) {
                                        // Source wraps: target overlaps if it's in [sourceStart, cycle] or [0, sourceEnd]
                                        groupsOverlap = (targetStartPos >= sourceStart || targetEnd <= sourceEnd);
                                    } else if (!sourceWraps && targetWraps) {
                                        // Target wraps: overlaps if source intersects [targetStart, cycle] or [0, targetEnd]
                                        groupsOverlap = (sourceStart <= targetEnd || sourceEnd >= targetStartPos);
                                    } else {
                                        // Both wrap: they definitely overlap
                                        groupsOverlap = true;
                                    }
                                }

                                // If groups overlap, point to end of target's green, otherwise to start
                                const targetPos = groupsOverlap ? targetEnd : targetStartPos;

                                // Calculate positions using actual group indices
                                const sourceY = getGroupRowY(sourceGf);
                                const targetY = getGroupRowY(targetGf);
                                if (sourceY === null || targetY === null) return null;
                                // Use the group's actual end position (already accounts for simulation)
                                // This ensures the arrow follows the group's green bar end, not just the action's fin value
                                const sourceX = sourceEnd * pixelsPerSecond;
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

                            // Cover all rows, starting just below ruler (12px above rows) and 22px below
                            const topPos = RULER_HEIGHT - 12;
                            const height = 12 + (groups.length * ROW_TOTAL_HEIGHT) + 22;

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
                            const hasTarget = targetGfId > 0 && targetGfId <= groups.length;

                            if (sourceGfId === 0) return null;
                            if (sourceGfId > groups.length) return null;

                            const sourceGroup = groups.find(g => g.id === sourceGfId);
                            if (!sourceGroup) return null;

                            const targetGroup = hasTarget ? groups.find(g => g.id === targetGfId) : null;

                            // Find actual group indices in the array
                            const sourceGroupIndex = groups.findIndex(g => g.id === sourceGfId);
                            const targetGroupIndex = hasTarget ? groups.findIndex(g => g.id === targetGfId) : sourceGroupIndex;
                            if (sourceGroupIndex === -1) return null;

                            // Source group times
                            const sourceStart = sourceGroup.offset % cycleLength;
                            const sourceEndRaw = sourceStart + sourceGroup.durations.green;
                            // If end equals cycle, keep it at cycle instead of wrapping to 0
                            const sourceEnd = sourceEndRaw === cycleLength ? cycleLength : (sourceEndRaw % cycleLength);

                            // Calculate rectangle position based on whether target is defined
                            let rectX, rectWidth, arrow1SourceX, arrow1TargetX, arrow2SourceX, arrow2TargetX, sourceY, targetY;
                            const barHeight = ROW_HEIGHT - 14; // Bar has top:7px and bottom:7px (16px)
                            const rectHeight = barHeight / 2; // Half the bar height (8px)

                            if (hasTarget && targetGroup) {
                                // Get intergreen times from conflict matrix
                                const intergreenSourceToTarget = conflictMatrix[sourceGfId - 1]?.[targetGfId - 1] || 0;
                                const intergreenTargetToSource = conflictMatrix[targetGfId - 1]?.[sourceGfId - 1] || 0;

                                // Y positions (center of each row)
                                sourceY = RULER_HEIGHT + 1 + (sourceGroupIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);

                                // Arrow 1: From start of source GF to (source start - intergreen target→source)
                                arrow1SourceX = sourceStart * pixelsPerSecond;
                                arrow1TargetX = ((sourceStart - intergreenTargetToSource + cycleLength) % cycleLength) * pixelsPerSecond;

                                // Arrow 2: From end of source GF to (source end + intergreen source→target)
                                arrow2SourceX = sourceEnd * pixelsPerSecond;
                                const arrow2TargetRaw = sourceEnd + intergreenSourceToTarget;
                                // If arrow end equals cycle, keep it at cycle instead of wrapping to 0
                                arrow2TargetX = (arrow2TargetRaw === cycleLength ? cycleLength : (arrow2TargetRaw % cycleLength)) * pixelsPerSecond;

                                // Rectangle between arrow endpoints on target row (lower half of bar)
                                rectX = Math.min(arrow1TargetX, arrow2TargetX);
                                rectWidth = Math.abs(arrow2TargetX - arrow1TargetX);

                                // Calculate exact bar bottom position and align rectangle there
                                const rowTopY = RULER_HEIGHT + 1 + (targetGroupIndex * ROW_TOTAL_HEIGHT);
                                const barBottomY = rowTopY + ROW_HEIGHT - 7; // Exact bottom of bar
                                targetY = barBottomY - rectHeight + 1 + rectHeight; // Arrow target Y points to bottom of rectangle
                            } else {
                                // No target defined - show rectangle on source group
                                // If deb/fin are specified, use them (e.g. for seconde lucarne); otherwise use green phase
                                const actionDeb = action.deb !== '' ? parseInt(action.deb) : null;
                                const actionFin = action.fin !== '' ? parseInt(action.fin) : null;
                                if (actionDeb !== null && actionFin !== null && !isNaN(actionDeb) && !isNaN(actionFin)) {
                                    rectX = actionDeb * pixelsPerSecond;
                                    rectWidth = (actionFin > actionDeb ? actionFin - actionDeb : (cycleLength - actionDeb + actionFin)) * pixelsPerSecond;
                                } else {
                                    rectX = sourceStart * pixelsPerSecond;
                                    rectWidth = (sourceEnd - sourceStart) * pixelsPerSecond;
                                    if (rectWidth < 0) rectWidth += cycleLength * pixelsPerSecond; // Handle wrap-around
                                }
                            }

                            // Calculate exact bar bottom position and align rectangle there
                            const displayGroupIndex = hasTarget ? targetGroupIndex : sourceGroupIndex;
                            const rowTopY = RULER_HEIGHT + 1 + (displayGroupIndex * ROW_TOTAL_HEIGHT);
                            const barBottomY = rowTopY + ROW_HEIGHT - 7; // Exact bottom of bar
                            const rectY = barBottomY - rectHeight + 1; // Rectangle bottom aligned to bar bottom +1px offset (moved up 4px)

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
                                            <polygon points="0 0, 8 3, 0 6" fill="#87CEEB" />
                                        </marker>
                                        <pattern
                                            id={`escam-hatch-${idx}`}
                                            patternUnits="userSpaceOnUse"
                                            width="6"
                                            height="6"
                                            patternTransform="rotate(-45)"
                                        >
                                            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(135,206,235,0.9)" strokeWidth="3" />
                                        </pattern>
                                    </defs>
                                    {/* Hatched rectangle between arrow endpoints */}
                                    <rect
                                        x={rectX}
                                        y={rectY}
                                        width={rectWidth}
                                        height={rectHeight}
                                        fill={`url(#escam-hatch-${idx})`}
                                        stroke="#006400"
                                        strokeWidth="1"
                                    />
                                    {/* Arrows only when target group is defined */}
                                    {hasTarget && (
                                        <>
                                            {/* Arrow 1: From source start to (source start - intergreen target→source) */}
                                            <line
                                                x1={arrow1SourceX}
                                                y1={sourceY}
                                                x2={arrow1TargetX}
                                                y2={targetY}
                                                stroke="#87CEEB"
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
                                                stroke="#87CEEB"
                                                strokeWidth="1"
                                                strokeDasharray="4,2"
                                                markerEnd={`url(#escam-arrowhead-${idx})`}
                                            />
                                        </>
                                    )}
                                    </svg>
                                </React.Fragment>
                            );
                        })}

                        {/* Signa d'aide à la conduite overlays */}
                        {signaActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const rawDeb = parseInt(action.deb) || 0;
                            const rawFin = parseInt(action.fin) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group index in array
                            const groupIndex = groups.findIndex(g => g.id === gf);
                            if (groupIndex === -1) return null;

                            // Apply time shifts (from contractions) in simulation mode
                            const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, 'Signal aide conduite');
                            if (shiftedPos.hidden) return null;
                            const deb = shiftedPos.deb;
                            const fin = shiftedPos.fin;
                            const blueStart = fin - 5;

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
                            const topPos = RULER_HEIGHT + 1 + (groupIndex * ROW_TOTAL_HEIGHT) + Math.floor((ROW_HEIGHT - height) / 2);

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

                        {/* Contrôle de flot overlays */}
                        {controleFlotActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const deb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group and get minGreen and orange duration
                            const group = groups.find(g => g.id === gf);
                            if (!group) return null;

                            const groupIndex = groups.findIndex(g => g.id === gf);
                            if (groupIndex === -1) return null;

                            const minGreen = group.minGreen || 0;
                            const orangeDuration = group.durations?.orange || 3;

                            // Calculate the three zones:
                            // 1. Intermittent yellow/gray: from DEB to (DEB + minGreen)
                            // 2. Orange/Yellow solid: from (DEB + minGreen) to (DEB + minGreen + orangeDuration)
                            // 3. Red: from (DEB + minGreen + orangeDuration) to FIN

                            const intermittentEnd = deb + minGreen;
                            const orangeEnd = intermittentEnd + orangeDuration;

                            // Positions in pixels
                            const intermittentLeft = deb * pixelsPerSecond;
                            const intermittentWidth = minGreen * pixelsPerSecond;
                            const orangeLeft = intermittentEnd * pixelsPerSecond;
                            const orangeWidth = orangeDuration * pixelsPerSecond;
                            const redLeft = orangeEnd * pixelsPerSecond;
                            const redWidth = Math.max(0, (fin - orangeEnd)) * pixelsPerSecond;
                            const totalWidth = (fin - deb) * pixelsPerSecond;

                            // Stripe width for intermittent pattern (1 second)
                            const stripeWidth = pixelsPerSecond;

                            // Vertical position
                            const height = Math.round((ROW_HEIGHT - 14) * 4 / 9);
                            const topPos = RULER_HEIGHT + 1 + (groupIndex * ROW_TOTAL_HEIGHT) + Math.floor((ROW_HEIGHT - height) / 2);

                            return (
                                <React.Fragment key={`controle-flot-${idx}`}>
                                    {/* Wrapper for drag handles */}
                                    <div
                                        className={`controle-flot-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            left: `${intermittentLeft}px`,
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
                                    {/* Intermittent yellow/gray bar (from DEB to minGreen) */}
                                    {intermittentWidth > 0 && (
                                        <div
                                            className={`controle-flot-intermittent ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: `${intermittentLeft}px`,
                                                width: `${intermittentWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`,
                                                '--stripe-width': `${stripeWidth}px`
                                            }}
                                        />
                                    )}
                                    {/* Orange/Yellow solid bar (orange duration) */}
                                    {orangeWidth > 0 && (
                                        <div
                                            className={`controle-flot-orange ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: `${orangeLeft}px`,
                                                width: `${orangeWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`
                                            }}
                                        />
                                    )}
                                    {/* Red bar (from orange end to FIN) */}
                                    {redWidth > 0 && (
                                        <div
                                            className={`controle-flot-red ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: `${redLeft}px`,
                                                width: `${redWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`
                                            }}
                                        >
                                            {abrv && (
                                                <span className="controle-flot-label">{abrv}</span>
                                            )}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Point de repos arrows - vertical red arrows */}
                        {pointReposActions.map((action, idx) => {
                            const rawDeb = parseInt(action.deb) || 0;
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            if (plage1 < 1 || plage2 < 1 || plage1 > groups.length || plage2 > groups.length) return null;

                            // Apply time shifts in simulation mode
                            const reposPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
                            const shiftedPos = getShiftedActionPosition(rawDeb, rawDeb, null, 'Point de repos', reposPlage);
                            if (shiftedPos.hidden) return null;
                            const deb = shiftedPos.deb;

                            // X position at deb
                            const xPos = deb * pixelsPerSecond;

                            // Arrow length fixed at 13 pixels
                            const arrowLength = 13;

                            // Downward arrow: ends just above plage1 row
                            const downArrowEndY = RULER_HEIGHT + 1 + (plage1 - 1) * ROW_TOTAL_HEIGHT - 2;
                            const downArrowStartY = downArrowEndY - arrowLength;

                            // Upward arrow: ends just below plage2 row
                            const upArrowEndY = RULER_HEIGHT + 1 + plage2 * ROW_TOTAL_HEIGHT + 2;
                            const upArrowStartY = upArrowEndY + arrowLength;

                            // Arrow head size
                            const arrowSize = 5;

                            // Label position below the diagram
                            const labelY = RULER_HEIGHT + 1 + groups.length * ROW_TOTAL_HEIGHT + 20;

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
                            const rawDeb = parseInt(action.deb) || 0;
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            if (plage1 < 1 || plage2 < 1 || plage1 > groups.length || plage2 > groups.length) return null;

                            // Apply time shifts in simulation mode
                            const btsPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
                            const shiftedPos = getShiftedActionPosition(rawDeb, rawDeb, null, 'Synchro BTS', btsPlage);
                            if (shiftedPos.hidden) return null;
                            const deb = shiftedPos.deb;

                            // X position at deb
                            const xPos = deb * pixelsPerSecond;

                            // Arrow length fixed at 16 pixels
                            const arrowLength = 16;

                            // Downward arrow: ends just above plage1 row
                            const downArrowEndY = RULER_HEIGHT + 1 + (plage1 - 1) * ROW_TOTAL_HEIGHT - 2;
                            const downArrowStartY = downArrowEndY - arrowLength;

                            // Upward arrow: ends just below plage2 row
                            const upArrowEndY = RULER_HEIGHT + 1 + plage2 * ROW_TOTAL_HEIGHT + 2;
                            const upArrowStartY = upArrowEndY + arrowLength;

                            // Arrow head size
                            const arrowSize = 5;

                            // Label position below the diagram
                            const labelY = RULER_HEIGHT + 1 + groups.length * ROW_TOTAL_HEIGHT + 20;

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
                            const rawDeb = parseInt(action.deb) || 0;
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            if (plage1 < 1 || plage2 < 1 || plage1 > groups.length || plage2 > groups.length) return null;

                            // Apply time shifts in simulation mode
                            const coPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
                            const shiftedPos = getShiftedActionPosition(rawDeb, rawDeb, null, 'Instant Co', coPlage);
                            if (shiftedPos.hidden) return null;
                            const deb = shiftedPos.deb;

                            // X position at deb
                            const xPos = deb * pixelsPerSecond;

                            // Arrow length fixed at 13 pixels
                            const arrowLength = 13;

                            // Downward arrow: ends just above plage1 row
                            const downArrowEndY = RULER_HEIGHT + 1 + (plage1 - 1) * ROW_TOTAL_HEIGHT - 2;
                            const downArrowStartY = downArrowEndY - arrowLength;

                            // Upward arrow: ends just below plage2 row
                            const upArrowEndY = RULER_HEIGHT + 1 + plage2 * ROW_TOTAL_HEIGHT + 2;
                            const upArrowStartY = upArrowEndY + arrowLength;

                            // Arrow head size
                            const arrowSize = 5;

                            // Label position below the diagram
                            const labelY = RULER_HEIGHT + 1 + groups.length * ROW_TOTAL_HEIGHT + 20;

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
                            const rawDeb = parseInt(action.deb) || 0;
                            const rawFin = parseInt(action.fin) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group index in array
                            const groupIndex = groups.findIndex(g => g.id === gf);
                            if (groupIndex === -1) return null;
                            if (rawDeb === rawFin) return null;

                            // Apply time shifts (from Adaptatif vertical) in simulation mode
                            const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, 'Priorité piétons');
                            if (shiftedPos.hidden) return null;
                            const deb = shiftedPos.deb;
                            const fin = shiftedPos.fin;

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
                                const firstPartWidth = (effectiveCycleLength - deb) * pixelsPerSecond;
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

                        {/* Flèche d'anticipation - intermittent yellow bar (same as Priorité piétons) */}
                        {flecheAnticipationActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const rawDeb = parseInt(action.deb) || 0;
                            const rawFin = parseInt(action.fin) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group index in array
                            const groupIndex = groups.findIndex(g => g.id === gf);
                            if (groupIndex === -1) return null;
                            if (rawDeb === rawFin) return null;

                            // Apply time shifts (from Adaptatif vertical) in simulation mode
                            const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, "Flèche d'anticipation");
                            if (shiftedPos.hidden) return null;
                            const deb = shiftedPos.deb;
                            const fin = shiftedPos.fin;

                            // Check for wrap-around (fin < deb means the bar crosses cycle boundary)
                            const wrapsAround = deb > fin;

                            // Vertical position aligned with the group's phase bar
                            const height = ROW_HEIGHT - 14;
                            const rowTotalHeight = ROW_HEIGHT + 1;
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
                                const firstPartWidth = (effectiveCycleLength - deb) * pixelsPerSecond;
                                const secondPartLeft = 0;
                                const secondPartWidth = fin * pixelsPerSecond;

                                return (
                                    <React.Fragment key={`fleche-anticipation-${idx}`}>
                                        {/* First part: from deb to end of cycle */}
                                        <div
                                            className={`fleche-anticipation-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                            <div
                                                className="action-drag-handle action-drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                title="Glisser pour modifier le début"
                                                style={{ pointerEvents: 'auto' }}
                                            />
                                        </div>
                                        <div
                                            className={`fleche-anticipation-bar ${isHighlighted ? 'highlighted' : ''}`}
                                            style={barStyle(firstPartLeft, firstPartWidth)}
                                        />
                                        {/* Second part: from start of cycle to fin */}
                                        <div
                                            className={`fleche-anticipation-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                            <div
                                                className="action-drag-handle action-drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                title="Glisser pour modifier la fin"
                                                style={{ pointerEvents: 'auto' }}
                                            />
                                        </div>
                                        <div
                                            className={`fleche-anticipation-bar ${isHighlighted ? 'highlighted' : ''}`}
                                            style={barStyle(secondPartLeft, secondPartWidth)}
                                        >
                                            {abrv && (
                                                <span className="fleche-anticipation-label" style={{
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
                            } else {
                                // Normal case: single bar
                                const leftPos = deb * pixelsPerSecond;
                                const barWidth = (fin - deb) * pixelsPerSecond;

                                return (
                                    <React.Fragment key={`fleche-anticipation-${idx}`}>
                                        <div
                                            className={`fleche-anticipation-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                            <div
                                                className="action-drag-handle action-drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}
                                                title="Glisser pour modifier le début"
                                                style={{ pointerEvents: 'auto' }}
                                            />
                                            <div
                                                className="action-drag-handle action-drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                title="Glisser pour modifier la fin"
                                                style={{ pointerEvents: 'auto' }}
                                            />
                                        </div>
                                        <div
                                            className={`fleche-anticipation-bar ${isHighlighted ? 'highlighted' : ''}`}
                                            style={barStyle(leftPos, barWidth)}
                                        >
                                            {abrv && (
                                                <span className="fleche-anticipation-label" style={{
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
                        })}

                        {/* Groupes de type FL ou PP - intermittent yellow bar based on green phase */}
                        {groups.filter(g => g.type === 'FL' || g.type === 'PP').map((group, idx) => {
                            const groupIndex = groups.findIndex(g => g.id === group.id);
                            if (groupIndex === -1) return null;

                            // Use simulated group data if available
                            const simGroup = getSimulatedGroup(group.id);
                            const offset = simGroup ? simGroup.simulatedOffset : group.offset;
                            const greenDuration = simGroup ? simGroup.simulatedGreen : group.durations.green;

                            if (greenDuration <= 0) return null;

                            const deb = offset;
                            const fin = (offset + greenDuration) % effectiveCycleLength;

                            // Check for wrap-around
                            const wrapsAround = offset + greenDuration > effectiveCycleLength;

                            // Vertical position aligned with the group's phase bar
                            const height = ROW_HEIGHT - 14;
                            const rowTotalHeight = ROW_HEIGHT + 1;
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
                                const firstPartWidth = (effectiveCycleLength - deb) * pixelsPerSecond;
                                const secondPartLeft = 0;
                                const secondPartWidth = fin * pixelsPerSecond;

                                return (
                                    <React.Fragment key={`type-fl-pp-${group.id}-${idx}`}>
                                        <div
                                            className="type-fl-pp-bar"
                                            style={barStyle(firstPartLeft, firstPartWidth)}
                                        />
                                        <div
                                            className="type-fl-pp-bar"
                                            style={barStyle(secondPartLeft, secondPartWidth)}
                                        />
                                    </React.Fragment>
                                );
                            } else {
                                // Normal case: single bar
                                const leftPos = deb * pixelsPerSecond;
                                const barWidth = greenDuration * pixelsPerSecond;

                                return (
                                    <div
                                        key={`type-fl-pp-${group.id}-${idx}`}
                                        className="type-fl-pp-bar"
                                        style={barStyle(leftPos, barWidth)}
                                    />
                                );
                            }
                        })}

                        {/* Début de bande passante arrows - dashed green diagonal arrows */}
                        {debutBandeActions.map((action, idx) => {
                            const gf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const rawDeb = parseInt(action.deb) || 0;
                            const rawFin = parseInt(action.fin) || 0;
                            const actGf1 = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group indices
                            const startGroupIndex = groups.findIndex(g => g.id === gf);
                            const endGroupIndex = groups.findIndex(g => g.id === actGf1);
                            if (startGroupIndex === -1 || endGroupIndex === -1) return null;

                            // Apply time shifts in simulation mode
                            const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, 'Début de bande passante');
                            if (shiftedPos.hidden) return null;
                            const deb = shiftedPos.deb;
                            const fin = shiftedPos.fin;

                            // Calculate positions
                            const startX = deb * pixelsPerSecond;
                            const endX = fin * pixelsPerSecond;
                            const startY = RULER_HEIGHT + 1 + (startGroupIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                            // End Y points to bottom of the bar (ROW_HEIGHT - 7 is bottom of bar)
                            const endY = RULER_HEIGHT + 1 + (endGroupIndex * ROW_TOTAL_HEIGHT) + ROW_HEIGHT - 7;
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
                                                strokeWidth="0.3"
                                                strokeDasharray="4,4"
                                            />
                                            {/* Second segment: from start of cycle to end */}
                                            <line
                                                x1={0}
                                                y1={intermediateY}
                                                x2={endX}
                                                y2={endY}
                                                stroke="#00cc00"
                                                strokeWidth="0.3"
                                                strokeDasharray="4,4"
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
                                            strokeWidth="0.3"
                                            strokeDasharray="4,4"
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
                            const rawDeb = parseInt(action.deb) || 0;
                            const rawFin = parseInt(action.fin) || 0;
                            const actGf1 = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            // Find group indices
                            const startGroupIndex = groups.findIndex(g => g.id === gf);
                            const endGroupIndex = groups.findIndex(g => g.id === actGf1);
                            if (startGroupIndex === -1 || endGroupIndex === -1) return null;

                            // Apply time shifts in simulation mode
                            const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, 'Fin de bande passante');
                            if (shiftedPos.hidden) return null;
                            const deb = shiftedPos.deb;
                            const fin = shiftedPos.fin;

                            // Calculate positions (same as début: from gf at deb to actGf1 at fin)
                            const startX = deb * pixelsPerSecond;
                            const endX = fin * pixelsPerSecond;
                            const startY = RULER_HEIGHT + 1 + (startGroupIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                            // End Y points to bottom of the bar (ROW_HEIGHT - 7 is bottom of bar)
                            const endY = RULER_HEIGHT + 1 + (endGroupIndex * ROW_TOTAL_HEIGHT) + ROW_HEIGHT - 7;
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
                                                strokeWidth="0.3"
                                                strokeDasharray="4,4"
                                            />
                                            {/* Second segment: from start of cycle to end */}
                                            <line
                                                x1={0}
                                                y1={intermediateY}
                                                x2={endX}
                                                y2={endY}
                                                stroke="#00cc00"
                                                strokeWidth="0.3"
                                                strokeDasharray="4,4"
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
                                            strokeWidth="0.3"
                                            strokeDasharray="4,4"
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
                        {(showDependencies || hoveredConflict) && (
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
                                    <marker
                                        id="dep-arrowhead-conflict"
                                        markerWidth="6"
                                        markerHeight="4"
                                        refX="6"
                                        refY="2"
                                        orient="auto"
                                    >
                                        <polygon points="0 0, 6 2, 0 4" fill="red" />
                                    </marker>
                                </defs>
                                {/* Arrows from main green phases */}
                                {groups.map((fromGroup, fromIndex) => {
                                    const fromId = fromGroup.id;
                                    const fromOffset = fromGroup.offset % cycleLength;
                                    const fromGreenEnd = (fromOffset + fromGroup.durations.green) % cycleLength;
                                    const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                                    const fromX = fromGreenEnd * pixelsPerSecond;

                                    return groups.map((toGroup, toIndex) => {
                                        const toId = toGroup.id;
                                        if (fromId === toId) return null;

                                        // Check if this arrow matches the hovered conflict (exact direction only)
                                        const showForConflict = hoveredConflict &&
                                            (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                                        // Filter: show arrows for hovered group OR hovered conflict
                                        if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                                        // If hoveredConflict is active but doesn't match this pair, hide the arrow
                                        if (hoveredConflict && !showForConflict) return null;

                                        const intergreenTime = conflictMatrix[fromId - 1]?.[toId - 1] || 0;
                                        if (intergreenTime <= 0) return null;

                                        // Determine if this arrow is a conflict (from matrix hover)
                                        const isConflictArrow = showForConflict && hoveredConflict?.isConflict;
                                        const arrowColor = isConflictArrow ? 'red' : '#999';
                                        const arrowWidth = isConflictArrow ? 3 : 1;
                                        const arrowOpacity = isConflictArrow ? 0.9 : 0.6;
                                        const arrowMarker = isConflictArrow ? 'url(#dep-arrowhead-conflict)' : 'url(#dep-arrowhead)';
                                        const arrowDash = isConflictArrow ? '6,3' : undefined;

                                        const toOffset = toGroup.offset % cycleLength;

                                        // Calculate gap between end of fromGroup green and start of toGroup green
                                        let gap = (toOffset - fromGreenEnd + cycleLength) % cycleLength;
                                        // If gap is 0, it means they're at the same time, consider it as full cycle
                                        if (gap === 0) gap = cycleLength;

                                        // Don't show arrow if gap > dependencyGap seconds (unless forced by conflict hover)
                                        if (!showForConflict && gap > dependencyGap) return null;

                                        // Arrow ends at: end of green + intergreen time
                                        const arrowEndTime = (fromGreenEnd + intergreenTime) % cycleLength;
                                        const toX = arrowEndTime * pixelsPerSecond;
                                        const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
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
                                                        stroke={arrowColor}
                                                        strokeWidth={arrowWidth}
                                                        strokeDasharray={arrowDash}
                                                        opacity={arrowOpacity}
                                                    />
                                                    {/* Second segment: from start of cycle to end point */}
                                                    <line
                                                        x1={0}
                                                        y1={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                                        x2={toX}
                                                        y2={toRowY}
                                                        stroke={arrowColor}
                                                        strokeWidth={arrowWidth}
                                                        strokeDasharray={arrowDash}
                                                        markerEnd={arrowMarker}
                                                        opacity={arrowOpacity}
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
                                                stroke={arrowColor}
                                                strokeWidth={arrowWidth}
                                                strokeDasharray={arrowDash}
                                                markerEnd={arrowMarker}
                                                opacity={arrowOpacity}
                                            />
                                        );
                                    });
                                })}

                                {/* Arrows from Seconde lucarne phases */}
                                {actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.fin !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((lucarne, lIdx) => {
                                    const fromId = parseInt(lucarne.gf);
                                    const fromIndex = groups.findIndex(g => g.id === fromId);
                                    if (fromIndex === -1) return null;

                                    const lucarneEnd = parseInt(lucarne.fin) || 0;
                                    const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                                    const fromX = lucarneEnd * pixelsPerSecond;

                                    return groups.map((toGroup, toIndex) => {
                                        const toId = toGroup.id;
                                        if (fromId === toId) return null;

                                        // Check if this arrow matches the hovered conflict (exact direction only)
                                        const showForConflict = hoveredConflict &&
                                            (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                                        // Filter: show arrows for hovered group OR hovered conflict
                                        if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                                        // If hoveredConflict is active but doesn't match this pair, hide the arrow
                                        if (hoveredConflict && !showForConflict) return null;

                                        const intergreenTime = conflictMatrix[fromId - 1]?.[toId - 1] || 0;
                                        if (intergreenTime <= 0) return null;

                                        const toOffset = toGroup.offset % cycleLength;

                                        // Calculate gap between end of lucarne and start of toGroup green
                                        let gap = (toOffset - lucarneEnd + cycleLength) % cycleLength;
                                        if (gap === 0) gap = cycleLength;

                                        // Don't show arrow if gap > dependencyGap seconds
                                        if (gap > dependencyGap) return null;

                                        // Arrow ends at: end of lucarne + intergreen time
                                        const arrowEndTime = (lucarneEnd + intergreenTime) % cycleLength;
                                        const toX = arrowEndTime * pixelsPerSecond;
                                        const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
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

                                {/* Arrows from Seconde lucarne to other Seconde lucarne */}
                                {actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.fin !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((fromLucarne, fromLIdx) => {
                                    const fromId = parseInt(fromLucarne.gf);
                                    const fromIndex = groups.findIndex(g => g.id === fromId);
                                    if (fromIndex === -1) return null;

                                    const fromLucarneEnd = parseInt(fromLucarne.fin) || 0;
                                    const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                                    const fromX = fromLucarneEnd * pixelsPerSecond;

                                    return actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.deb !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((toLucarne, toLIdx) => {
                                        const toId = parseInt(toLucarne.gf);
                                        if (fromId === toId) return null;
                                        if (fromLIdx === toLIdx) return null;

                                        // Check if this arrow matches the hovered conflict (exact direction only)
                                        const showForConflict = hoveredConflict &&
                                            (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                                        // Filter: show arrows for hovered group OR hovered conflict
                                        if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                                        // If hoveredConflict is active but doesn't match this pair, hide the arrow
                                        if (hoveredConflict && !showForConflict) return null;

                                        const intergreenTime = conflictMatrix[fromId - 1]?.[toId - 1] || 0;
                                        if (intergreenTime <= 0) return null;

                                        const toIndex = groups.findIndex(g => g.id === toId);
                                        if (toIndex === -1) return null;

                                        const toLucarneDeb = parseInt(toLucarne.deb) || 0;

                                        // Calculate gap between end of fromLucarne and start of toLucarne
                                        let gap = (toLucarneDeb - fromLucarneEnd + cycleLength) % cycleLength;
                                        if (gap === 0) gap = cycleLength;

                                        // Don't show arrow if gap > dependencyGap seconds
                                        if (gap > dependencyGap) return null;

                                        // Arrow ends at: end of lucarne + intergreen time
                                        const arrowEndTime = (fromLucarneEnd + intergreenTime) % cycleLength;
                                        const toX = arrowEndTime * pixelsPerSecond;
                                        const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                                        const cycleEndX = cycleLength * pixelsPerSecond;

                                        // If arrow would go backwards, split into two segments
                                        if (fromX > toX) {
                                            return (
                                                <g key={`dep-luc2luc-${fromLIdx}-${toLIdx}`}>
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
                                                key={`dep-luc2luc-${fromLIdx}-${toLIdx}`}
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

                                {/* Arrows from main green phases to Seconde lucarne */}
                                {groups.map((fromGroup, fromIndex) => {
                                    const fromId = fromGroup.id;
                                    const fromOffset = fromGroup.offset % cycleLength;
                                    const fromGreenEnd = (fromOffset + fromGroup.durations.green) % cycleLength;
                                    const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                                    const fromX = fromGreenEnd * pixelsPerSecond;

                                    return actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.deb !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((toLucarne, toLIdx) => {
                                        const toId = parseInt(toLucarne.gf);
                                        if (fromId === toId) return null;

                                        // Check if this arrow matches the hovered conflict (exact direction only)
                                        const showForConflict = hoveredConflict &&
                                            (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                                        // Filter: show arrows for hovered group OR hovered conflict
                                        if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                                        // If hoveredConflict is active but doesn't match this pair, hide the arrow
                                        if (hoveredConflict && !showForConflict) return null;

                                        const intergreenTime = conflictMatrix[fromId - 1]?.[toId - 1] || 0;
                                        if (intergreenTime <= 0) return null;

                                        const toIndex = groups.findIndex(g => g.id === toId);
                                        if (toIndex === -1) return null;

                                        const toLucarneDeb = parseInt(toLucarne.deb) || 0;

                                        // Calculate gap between end of main green and start of lucarne
                                        let gap = (toLucarneDeb - fromGreenEnd + cycleLength) % cycleLength;
                                        if (gap === 0) gap = cycleLength;

                                        // Don't show arrow if gap > dependencyGap seconds
                                        if (gap > dependencyGap) return null;

                                        // Arrow ends at: end of green + intergreen time
                                        const arrowEndTime = (fromGreenEnd + intergreenTime) % cycleLength;
                                        const toX = arrowEndTime * pixelsPerSecond;
                                        const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                                        const cycleEndX = cycleLength * pixelsPerSecond;

                                        // If arrow would go backwards, split into two segments
                                        if (fromX > toX) {
                                            return (
                                                <g key={`dep-main2luc-${fromId}-${toLIdx}`}>
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
                                                key={`dep-main2luc-${fromId}-${toLIdx}`}
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

                                {/* Arrows from Seconde lucarne to Seconde lucarne (end to start) */}
                                {actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.fin !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((fromLucarne, fromLIdx) => {
                                    const fromId = parseInt(fromLucarne.gf);
                                    const fromIndex = groups.findIndex(g => g.id === fromId);
                                    if (fromIndex === -1) return null;

                                    const fromLucarneEnd = parseInt(fromLucarne.fin) || 0;
                                    const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                                    const fromX = fromLucarneEnd * pixelsPerSecond;

                                    return actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.deb !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((toLucarne, toLIdx) => {
                                        const toId = parseInt(toLucarne.gf);
                                        if (fromId === toId) return null;
                                        if (fromLIdx === toLIdx) return null;

                                        // Check if this arrow matches the hovered conflict (exact direction only)
                                        const showForConflict = hoveredConflict &&
                                            (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                                        // Filter: show arrows for hovered group OR hovered conflict
                                        if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                                        // If hoveredConflict is active but doesn't match this pair, hide the arrow
                                        if (hoveredConflict && !showForConflict) return null;

                                        const intergreenTime = conflictMatrix[fromId - 1]?.[toId - 1] || 0;
                                        if (intergreenTime <= 0) return null;

                                        const toIndex = groups.findIndex(g => g.id === toId);
                                        if (toIndex === -1) return null;

                                        const toLucarneDeb = parseInt(toLucarne.deb) || 0;

                                        // Calculate gap between end of fromLucarne and start of toLucarne
                                        let gap = (toLucarneDeb - fromLucarneEnd + cycleLength) % cycleLength;
                                        if (gap === 0) gap = cycleLength;

                                        // Don't show arrow if gap > dependencyGap seconds
                                        if (gap > dependencyGap) return null;

                                        // Arrow ends at: end of lucarne + intergreen time
                                        const arrowEndTime = (fromLucarneEnd + intergreenTime) % cycleLength;
                                        const toX = arrowEndTime * pixelsPerSecond;
                                        const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                                        const cycleEndX = cycleLength * pixelsPerSecond;

                                        // If arrow would go backwards, split into two segments
                                        if (fromX > toX) {
                                            return (
                                                <g key={`dep-luc2lucdeb-${fromLIdx}-${toLIdx}`}>
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
                                                key={`dep-luc2lucdeb-${fromLIdx}-${toLIdx}`}
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

                {/* Comments column - not printable */}
                {showComments && <div className="timeline-comments no-print">
                    {/* Header for comments */}
                    <div className="comments-header">
                        <span>Commentaire</span>
                        <span className="comment-color-btn comment-color-plus" title="Couleur verte (+)">+</span>
                        <span className="comment-color-btn comment-color-minus" title="Couleur rouge (-)">−</span>
                    </div>

                    {/* Comment input for each group */}
                    {groups.map(g => (
                        <div key={g.id} className="comment-row">
                            <div
                                className="input-comment"
                                contentEditable
                                suppressContentEditableWarning
                                dangerouslySetInnerHTML={{ __html: g.comment || '' }}
                                onBlur={(e) => {
                                    const html = e.currentTarget.innerHTML;
                                    // Extract text to check length
                                    const text = e.currentTarget.textContent || '';
                                    if (text.length <= 50) {
                                        updateGroupParams(g.id, { comment: html });
                                    } else {
                                        // Truncate and save
                                        e.currentTarget.textContent = text.slice(0, 50);
                                        updateGroupParams(g.id, { comment: e.currentTarget.innerHTML });
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === '+' || e.key === '-') {
                                        e.preventDefault();
                                        const color = e.key === '+' ? '#4CAF50' : '#F44336';
                                        const selection = window.getSelection();

                                        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                                            // Has selection - wrap selection in colored span
                                            const range = selection.getRangeAt(0);
                                            const selectedText = range.toString();
                                            if (selectedText) {
                                                const span = document.createElement('span');
                                                span.style.color = color;
                                                range.surroundContents(span);
                                                // Save updated HTML
                                                updateGroupParams(g.id, { comment: e.currentTarget.innerHTML });
                                            }
                                        } else {
                                            // No selection - color entire content or toggle back to white
                                            const content = e.currentTarget.textContent || '';
                                            if (content) {
                                                // Check if content is already entirely wrapped in a colored span
                                                const firstChild = e.currentTarget.firstChild;
                                                const isEntirelyColored = firstChild &&
                                                    firstChild.nodeType === 1 &&
                                                    firstChild.tagName === 'SPAN' &&
                                                    firstChild.style.color &&
                                                    e.currentTarget.childNodes.length === 1;

                                                if (isEntirelyColored) {
                                                    // Toggle back to white (remove color)
                                                    e.currentTarget.innerHTML = content;
                                                } else {
                                                    e.currentTarget.innerHTML = `<span style="color: ${color}">${content}</span>`;
                                                }
                                                updateGroupParams(g.id, { comment: e.currentTarget.innerHTML });
                                            }
                                        }
                                    }
                                }}
                                data-tooltip="Commentaire (50 caractères max) - Sélectionnez du texte puis + pour vert, - pour rouge"
                            />
                        </div>
                    ))}
                </div>}

                {/* Remarques column - not printable */}
                {showRemarks && (() => {
                    // Calculate max characters based on available height
                    // Each group row is 30px, font line is ~17px, ~35 chars per line
                    const linesAvailable = Math.max(1, Math.floor((groups.length * 30 - 16) / 17));
                    const charsPerLine = 35;
                    const calculatedMaxLength = linesAvailable * charsPerLine;
                    return (
                        <div className="timeline-remarques no-print">
                            <div className="remarques-header">
                                <span>Remarques</span>
                                <span className="comment-color-btn comment-color-plus" title="Couleur verte (+)">+</span>
                                <span className="comment-color-btn comment-color-minus" title="Couleur rouge (-)">−</span>
                            </div>
                            <div
                                className="input-remarques"
                                contentEditable
                                suppressContentEditableWarning
                                dangerouslySetInnerHTML={{ __html: remarques || '' }}
                                onBlur={(e) => {
                                    const html = e.currentTarget.innerHTML;
                                    const text = e.currentTarget.textContent || '';
                                    if (text.length <= calculatedMaxLength) {
                                        updateRemarques && updateRemarques(html);
                                    } else {
                                        // Truncate text but keep HTML
                                        e.currentTarget.textContent = text.slice(0, calculatedMaxLength);
                                        updateRemarques && updateRemarques(e.currentTarget.innerHTML);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === '+' || e.key === '-') {
                                        const selection = window.getSelection();
                                        // Only color if there is a selection
                                        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                                            e.preventDefault();
                                            const color = e.key === '+' ? '#4CAF50' : '#F44336';
                                            const range = selection.getRangeAt(0);
                                            const selectedText = range.toString();
                                            if (selectedText) {
                                                // Check if selection is inside a colored span
                                                const parentSpan = range.commonAncestorContainer.parentElement;
                                                const isColored = parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.style.color;

                                                if (isColored) {
                                                    // Toggle back to white
                                                    const span = document.createElement('span');
                                                    span.style.color = 'white';
                                                    range.surroundContents(span);
                                                } else {
                                                    // Apply color
                                                    const span = document.createElement('span');
                                                    span.style.color = color;
                                                    range.surroundContents(span);
                                                }
                                                updateRemarques && updateRemarques(e.currentTarget.innerHTML);
                                            }
                                        }
                                        // If no selection, let the character be typed normally
                                    }
                                }}
                                data-tooltip={`Remarques générales (${charsPerLine} car. x ${linesAvailable} lignes max) - Sélectionnez du texte puis + pour vert, - pour rouge`}
                            />
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default TimelineDiagram;
