/**
 * Calculate the simulated diagram based on selected actions
 *
 * @param {Array} groups - Original groups array
 * @param {Array} actionData - All actions
 * @param {Array} selectedActionIds - IDs of selected actions for simulation
 * @param {number} cycleLength - Original cycle length
 * @param {Array} conflictMatrix - The intergreen time matrix
 * @returns {Object} { simulatedGroups, simulatedCycleLength, conflicts }
 */
export const calculateSimulatedDiagram = (groups, actionData, selectedActionIds, cycleLength, conflictMatrix) => {
    // Deep copy groups to avoid mutation
    let simulatedGroups = groups.map(g => ({
        ...g,
        durations: { ...g.durations },
        simulatedOffset: g.offset,
        simulatedGreen: g.durations.green,
        isEscamoted: false,
        greenCuts: [] // Array of {deb, fin} for periods where green is hidden (used by Escamotage only)
    }));

    let simulatedCycleLength = cycleLength;

    // Track removed periods for filtering actions
    // Each period: { deb, fin, plage1?, plage2? } - periods to remove from the diagram
    const removedPeriods = [];

    // Track time shifts for action overlays
    // Each shift: { from: number, amount: number } - positions >= from are shifted left by amount
    const timeShifts = [];

    // Get selected actions
    const selectedActions = actionData.filter(a => selectedActionIds.includes(a.id));

    // Get UNselected Escamotage actions (for hiding the source group)
    const unselectedEscamotageActions = actionData.filter(a =>
        !selectedActionIds.includes(a.id) &&
        a.action === 'Escamotage' &&
        a.gf !== ''
    );

    // Process unselected Escamotage first - hide the source group (GF)
    // If deb/fin are specified, only hide the [deb, fin] range (greenCut) instead of the entire group
    unselectedEscamotageActions.forEach(action => {
        const gfId = parseInt(action.gf);
        const groupIndex = simulatedGroups.findIndex(g => g.id === gfId);
        if (groupIndex !== -1) {
            const deb = action.deb !== '' ? parseInt(action.deb) : null;
            const fin = action.fin !== '' ? parseInt(action.fin) : null;
            if (deb !== null && fin !== null && !isNaN(deb) && !isNaN(fin)) {
                // deb/fin définis → escamotage partiel sur la plage [deb, fin]
                simulatedGroups[groupIndex].greenCuts.push({ deb, fin });
            } else {
                // Pas de deb/fin → masquer le groupe entièrement
                simulatedGroups[groupIndex].isEscamoted = true;
                simulatedGroups[groupIndex].simulatedGreen = 0;
            }
        }
    });

    // Helper to calculate intersection of a green bar with a removed period
    const getGreenIntersection = (offset, greenDuration, deb, fin, cycle) => {
        const greenEnd = offset + greenDuration;

        // Simple case: no wrap-around for either
        if (greenEnd <= cycle && fin > deb) {
            const intersectStart = Math.max(offset, deb);
            const intersectEnd = Math.min(greenEnd, fin);
            if (intersectStart < intersectEnd) {
                return intersectEnd - intersectStart;
            }
        }
        // Handle wrap-around cases more carefully
        // For now, use a simple approach: check if green period overlaps with [deb, fin]
        if (fin > deb) {
            // Normal period [deb, fin]
            if (offset < fin && greenEnd > deb) {
                const intersectStart = Math.max(offset, deb);
                const intersectEnd = Math.min(greenEnd, fin);
                if (intersectStart < intersectEnd) {
                    return intersectEnd - intersectStart;
                }
            }
        }
        return 0;
    };

    // Process each action type in order

    // 1. Escamotage de phase - remove the phase and reduce cycle
    const escamotagePhaseActions = selectedActions.filter(a =>
        a.action === 'Escamotage de phase' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    escamotagePhaseActions.forEach(action => {
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        const duration = fin > deb ? fin - deb : (fin + simulatedCycleLength - deb);

        // If GF is specified, mark that group as escamoted
        if (action.gf) {
            const gfId = parseInt(action.gf);
            const groupIndex = simulatedGroups.findIndex(g => g.id === gfId);
            if (groupIndex !== -1) {
                simulatedGroups[groupIndex].isEscamoted = true;
                simulatedGroups[groupIndex].simulatedGreen = 0;
            }
        }

        // Record removed period for action filtering
        removedPeriods.push({ deb, fin });

        // Record time shift for action overlays
        timeShifts.push({ from: fin, amount: duration });

        // For each group, cut the green bar that intersects with [deb, fin]
        simulatedGroups.forEach(g => {
            if (g.isEscamoted) return;

            const offset = g.simulatedOffset;
            const greenEnd = offset + g.simulatedGreen;

            // Check if green bar intersects with [deb, fin]
            if (fin > deb) {
                // Case 1: Green starts before deb and extends into [deb, fin]
                if (offset < deb && greenEnd > deb) {
                    // Cut the part after deb
                    const cutAmount = Math.min(greenEnd, fin) - deb;
                    g.simulatedGreen = Math.max(0, g.simulatedGreen - cutAmount);
                }
                // Case 2: Green starts within [deb, fin]
                else if (offset >= deb && offset < fin) {
                    if (greenEnd <= fin) {
                        // Entirely within - escamote the group
                        g.isEscamoted = true;
                        g.simulatedGreen = 0;
                    } else {
                        // Starts in [deb, fin] but extends past fin
                        const cutAmount = fin - offset;
                        g.simulatedGreen = Math.max(0, g.simulatedGreen - cutAmount);
                        // Will be shifted later
                    }
                }

                // Case 4: Green bar wraps around the cycle and its wrap portion [0, wrapEnd] overlaps [deb, fin]
                if (greenEnd > simulatedCycleLength) {
                    const wrapEnd = greenEnd - simulatedCycleLength;
                    if (wrapEnd > deb) {
                        const overlapEnd = Math.min(wrapEnd, fin);
                        const wrapCutAmount = overlapEnd - deb;
                        if (wrapCutAmount > 0) {
                            g.simulatedGreen = Math.max(0, g.simulatedGreen - wrapCutAmount);
                        }
                    }
                }
            }
        });

        // Reduce cycle length
        simulatedCycleLength -= duration;

        // Shift all groups that start at or after 'fin' by -duration
        // (after the removed period, everything shifts left)
        simulatedGroups.forEach(g => {
            if (!g.isEscamoted && g.simulatedOffset >= fin) {
                g.simulatedOffset = Math.max(0, g.simulatedOffset - duration);
            } else if (!g.isEscamoted && g.simulatedOffset >= deb) {
                // Groups starting within [deb, fin) that weren't escamoted - move to deb
                g.simulatedOffset = deb;
            }
        });
    });

    // 2. Ouverture anticipée - shift the start of green earlier
    const ouvertureActions = selectedActions.filter(a =>
        a.action === 'Ouverture anticipée' &&
        a.gf !== '' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    ouvertureActions.forEach(action => {
        const gfId = parseInt(action.gf);
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        const shiftAmount = fin > deb ? fin - deb : (fin + simulatedCycleLength - deb);

        const groupIndex = simulatedGroups.findIndex(g => g.id === gfId);
        if (groupIndex !== -1 && !simulatedGroups[groupIndex].isEscamoted) {
            // Shift the start earlier and extend the green duration
            simulatedGroups[groupIndex].simulatedOffset =
                (simulatedGroups[groupIndex].simulatedOffset - shiftAmount + simulatedCycleLength) % simulatedCycleLength;
            simulatedGroups[groupIndex].simulatedGreen += shiftAmount;
        }
    });

    // 2b. Fermeture anticipée:
    // - Reduce green duration of the group in GF (end of green moves left)
    // - Apply "glissement" (shift offset left) to groups in actGf1-4
    const fermetureActions = selectedActions.filter(a =>
        a.action === 'Fermeture anticipée' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    fermetureActions.forEach(action => {
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        const shiftAmount = fin > deb ? fin - deb : (fin + simulatedCycleLength - deb);

        // 1. Reduce green duration for the group in GF field
        if (action.gf && action.gf !== '') {
            const gfId = parseInt(action.gf);
            if (!isNaN(gfId)) {
                const groupIndex = simulatedGroups.findIndex(g => g.id === gfId);
                if (groupIndex !== -1 && !simulatedGroups[groupIndex].isEscamoted) {
                    // Reduce green duration (end of green moves left)
                    simulatedGroups[groupIndex].simulatedGreen = Math.max(0, simulatedGroups[groupIndex].simulatedGreen - shiftAmount);
                }
            }
        }

        // 2. Apply glissement (shift offset left) to groups in Action GF fields
        const glissementGfIds = [];
        ['actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'].forEach(field => {
            if (action[field] && action[field] !== '') {
                const gfStr = action[field]?.toString().replace(/[Gg]/g, '').trim() || '';
                const gfId = parseInt(gfStr);
                if (!isNaN(gfId) && !glissementGfIds.includes(gfId)) {
                    glissementGfIds.push(gfId);
                }
            }
        });

        // Apply glissement to target groups
        glissementGfIds.forEach(targetGfId => {
            const groupIndex = simulatedGroups.findIndex(g => g.id === targetGfId);
            if (groupIndex !== -1 && !simulatedGroups[groupIndex].isEscamoted) {
                // Glissement: shift the start left, keep the end at the same position
                // 1. Shift offset left by shiftAmount
                // 2. Increase green duration by shiftAmount (to keep end position)
                simulatedGroups[groupIndex].simulatedOffset =
                    (simulatedGroups[groupIndex].simulatedOffset - shiftAmount + simulatedCycleLength) % simulatedCycleLength;
                simulatedGroups[groupIndex].simulatedGreen += shiftAmount;
            }
        });
    });

    // 3. Adaptatif vertical - shift groups/actions after 'deb' by the duration, reduce cycle length
    // If plage1/plage2 are defined, only groups in that range are affected for green cutting
    // If not defined, all groups are affected
    // In all cases, groups starting after 'deb' are shifted
    const adaptatifActions = selectedActions.filter(a =>
        a.action === 'Adaptatif vertical' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    const totalGroups = groups.length;

    adaptatifActions.forEach(action => {
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        const shiftAmount = fin > deb ? fin - deb : (fin + simulatedCycleLength - deb);

        // Determine affected group range
        // If plage1/plage2 not defined, all groups are affected
        const hasPlageRange = action.plage1 !== '' && action.plage2 !== '';
        const plage1 = hasPlageRange ? (parseInt(action.plage1) || 1) : 1;
        const plage2 = hasPlageRange ? (parseInt(action.plage2) || totalGroups) : totalGroups;

        // Record removed period and time shift for action overlays
        // Include plage range so actions can check if they should be shifted
        removedPeriods.push({ deb, fin });
        timeShifts.push({
            from: fin,
            amount: shiftAmount,
            plage1: plage1,
            plage2: plage2,
            isPartial: hasPlageRange  // true if plage1/plage2 were explicitly set
        });

        // Process groups in the affected range: cut green bars that overlap [deb, fin]
        // and shift their offset if they start at or after deb
        simulatedGroups.forEach(g => {
            if (g.isEscamoted) return;

            // Only process groups in the plage range (for partial) or all groups (for full)
            const isInPlageRange = g.id >= plage1 && g.id <= plage2;

            if (isInPlageRange) {
                const offset = g.simulatedOffset;
                const greenEnd = offset + g.simulatedGreen;

                if (fin > deb) {
                    // Non-wrapping adaptatif zone [deb, fin]
                    // Case 1: Green bar starts before deb and extends into [deb, fin]
                    if (offset < deb && greenEnd > deb) {
                        const cutAmount = Math.min(greenEnd, fin) - deb;
                        g.simulatedGreen = Math.max(0, g.simulatedGreen - cutAmount);
                    }
                    // Case 2: Green bar starts within [deb, fin]
                    else if (offset >= deb && offset < fin) {
                        if (greenEnd <= fin) {
                            // Entirely within - escamote the group
                            g.isEscamoted = true;
                            g.simulatedGreen = 0;
                        } else {
                            // Starts in [deb, fin] but extends past fin
                            const cutAmount = fin - offset;
                            g.simulatedGreen = Math.max(0, g.simulatedGreen - cutAmount);
                            // Shift this group to start at deb (partial mode)
                            if (hasPlageRange) {
                                g.simulatedOffset = deb;
                            }
                        }
                    }
                    // Case 3: Green bar starts at or after fin - shift left by full amount (partial mode)
                    else if (offset >= fin && hasPlageRange) {
                        g.simulatedOffset = Math.max(0, g.simulatedOffset - shiftAmount);
                    }

                    // Case 4: Green bar wraps around the cycle and its wrap portion [0, wrapEnd] overlaps [deb, fin]
                    if (greenEnd > simulatedCycleLength) {
                        const wrapEnd = greenEnd - simulatedCycleLength;
                        if (wrapEnd > deb) {
                            const overlapEnd = Math.min(wrapEnd, fin);
                            const wrapCutAmount = overlapEnd - deb;
                            if (wrapCutAmount > 0) {
                                g.simulatedGreen = Math.max(0, g.simulatedGreen - wrapCutAmount);
                            }
                        }
                    }
                }
            }
        });

        // Only reduce cycle length and shift ALL groups if Adaptatif vertical is NOT partial
        // When partial (plage defined), only groups in the plage range are shifted (done above), cycle stays the same
        if (!hasPlageRange) {
            // Reduce cycle length by the adaptatif duration
            simulatedCycleLength -= shiftAmount;

            // Shift ALL groups that start at or after 'deb' by -shiftAmount
            simulatedGroups.forEach(g => {
                if (g.isEscamoted) return;

                if (g.simulatedOffset >= fin) {
                    // Group starts after the adaptatif zone - shift left by full amount
                    g.simulatedOffset = Math.max(0, g.simulatedOffset - shiftAmount);
                } else if (g.simulatedOffset >= deb) {
                    // Group starts within [deb, fin) - move to deb
                    g.simulatedOffset = deb;
                }
                // Groups starting before deb are not shifted
            });
        }
    });

    // 4. Escamotage - cut green bar of target group (actGf1) for action duration
    const escamotageActions = selectedActions.filter(a =>
        a.action === 'Escamotage' &&
        a.actGf1 !== '' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    escamotageActions.forEach(action => {
        // Parse actGf1 - might be "G2", "2", or just a number
        const actGf1Str = action.actGf1?.toString().replace(/[Gg]/g, '').trim() || '';
        const targetGfId = parseInt(actGf1Str);
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;

        if (!isNaN(targetGfId)) {
            const groupIndex = simulatedGroups.findIndex(g => g.id === targetGfId);
            if (groupIndex !== -1 && !simulatedGroups[groupIndex].isEscamoted) {
                // Add a green cut period for this group
                simulatedGroups[groupIndex].greenCuts.push({ deb, fin });
            }
        }
    });

    // Calculate conflicts on simulated diagram
    const conflicts = calculateSimulatedConflicts(
        simulatedGroups,
        simulatedCycleLength,
        conflictMatrix
    );

    return {
        simulatedGroups,
        simulatedCycleLength,
        conflicts,
        timeShifts,
        removedPeriods
    };
};

/**
 * Calculate conflicts for the simulated diagram
 */
const calculateSimulatedConflicts = (simulatedGroups, cycleLength, conflictMatrix) => {
    const conflicts = [];
    const count = simulatedGroups.length;

    // Helper to check overlap
    const rangesOverlap = (start1, end1, start2, end2, cycle) => {
        start1 = ((start1 % cycle) + cycle) % cycle;
        end1 = ((end1 % cycle) + cycle) % cycle;
        start2 = ((start2 % cycle) + cycle) % cycle;
        end2 = ((end2 % cycle) + cycle) % cycle;

        const range1Wraps = end1 <= start1;
        const range2Wraps = end2 <= start2;

        if (!range1Wraps && !range2Wraps) {
            return start1 < end2 && start2 < end1;
        } else if (range1Wraps && !range2Wraps) {
            return (start2 < end1) || (start2 >= start1);
        } else if (!range1Wraps && range2Wraps) {
            return (start1 < end2) || (start1 >= start2);
        } else {
            return true;
        }
    };

    for (let from = 0; from < count; from++) {
        for (let to = 0; to < count; to++) {
            if (from === to) continue;

            const minGap = conflictMatrix[from]?.[to];
            if (!minGap || minGap === '' || minGap === 0) continue;

            const gFrom = simulatedGroups[from];
            const gTo = simulatedGroups[to];

            // Skip escamoted groups
            if (gFrom.isEscamoted || gTo.isEscamoted) continue;

            const startA = gFrom.simulatedOffset;
            const endA = (gFrom.simulatedOffset + gFrom.simulatedGreen) % cycleLength;
            const startB = gTo.simulatedOffset;
            const endB = (gTo.simulatedOffset + gTo.simulatedGreen) % cycleLength;

            // Check intergreen time
            const endGreenA = (gFrom.simulatedOffset + gFrom.simulatedGreen) % cycleLength;
            const startGreenB = gTo.simulatedOffset % cycleLength;

            let distance = (startGreenB - endGreenA + cycleLength) % cycleLength;

            if (distance < minGap) {
                conflicts.push({
                    from: gFrom.id,
                    to: gTo.id,
                    required: minGap,
                    actual: distance,
                    type: 'intergreen',
                    message: `Dégagement insuffisant (${distance.toFixed(1)}s / ${minGap}s requis)`
                });
            }

            // Check overlap
            if (rangesOverlap(startA, endA, startB, endB, cycleLength)) {
                const existingConflict = conflicts.find(c =>
                    c.from === gFrom.id && c.to === gTo.id && c.type === 'intergreen'
                );
                if (!existingConflict) {
                    conflicts.push({
                        from: gFrom.id,
                        to: gTo.id,
                        type: 'overlap',
                        message: 'Chevauchement des phases vertes'
                    });
                }
            }
        }
    }

    return conflicts;
};

export default calculateSimulatedDiagram;
