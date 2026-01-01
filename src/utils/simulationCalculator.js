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
        isEscamoted: false
    }));

    let simulatedCycleLength = cycleLength;

    // Get selected actions
    const selectedActions = actionData.filter(a => selectedActionIds.includes(a.id));

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

        // Reduce cycle length
        simulatedCycleLength -= duration;

        // Shift all groups that start after 'deb' by -duration
        simulatedGroups.forEach(g => {
            if (g.simulatedOffset >= deb && !g.isEscamoted) {
                g.simulatedOffset = Math.max(0, g.simulatedOffset - duration);
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

    // 3. Adaptatif vertical - shift bars to the left for groups in range
    const adaptatifActions = selectedActions.filter(a =>
        a.action === 'Adaptatif vertical' &&
        a.deb !== '' &&
        a.fin !== '' &&
        a.plage1 !== '' &&
        a.plage2 !== ''
    );

    adaptatifActions.forEach(action => {
        const deb = parseInt(action.deb) || 0;
        const fin = parseInt(action.fin) || 0;
        const plage1 = parseInt(action.plage1) || 1;
        const plage2 = parseInt(action.plage2) || groups.length;
        const shiftAmount = fin > deb ? fin - deb : (fin + simulatedCycleLength - deb);

        // Shift groups in range plage1 to plage2
        simulatedGroups.forEach(g => {
            if (g.id >= plage1 && g.id <= plage2 && !g.isEscamoted) {
                g.simulatedOffset =
                    (g.simulatedOffset - shiftAmount + simulatedCycleLength) % simulatedCycleLength;
            }
        });
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
        conflicts
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
