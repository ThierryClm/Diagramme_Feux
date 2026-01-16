import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './components/GreenWaveViewer.css';

const GreenWavePage = () => {
    const [intersections, setIntersections] = useState(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(8);
    const [pixelsPerMeter, setPixelsPerMeter] = useState(1);
    const [speedUp, setSpeedUp] = useState(50); // km/h - vitesse montante
    const [speedDown, setSpeedDown] = useState(50); // km/h - vitesse descendante
    const [greenWaveName, setGreenWaveName] = useState('');
    const [speedLineOffsetUp, setSpeedLineOffsetUp] = useState(0); // Offset horizontal ligne montante (en secondes)
    const [speedLineOffsetDown, setSpeedLineOffsetDown] = useState(0); // Offset horizontal ligne descendante (en secondes)
    const [dragging, setDragging] = useState(null); // 'up' ou 'down' ou null
    const [displayCycles, setDisplayCycles] = useState(2); // Number of cycles to display (2 or 3)
    const [showSpeedLines, setShowSpeedLines] = useState(true); // Affichage des lignes directrices
    // Parameters per PF (indexed by PF name): { pfName: { speedUp, speedDown, offsetUp, offsetDown } }
    const [pfParams, setPfParams] = useState({});

    // Get current PF name from first intersection
    const getCurrentPfName = useCallback(() => {
        if (!intersections || intersections.length === 0) return 'PF1';
        const firstIntersection = intersections[0];
        const selectedPfId = firstIntersection.selectedPfId || 1;
        const selectedPf = firstIntersection.pfTabs?.find(pf => pf.id === selectedPfId);
        return selectedPf?.name || 'PF1';
    }, [intersections]);

    // Save current parameters to pfParams for current PF
    const saveCurrentPfParams = useCallback(() => {
        const pfName = getCurrentPfName();
        setPfParams(prev => ({
            ...prev,
            [pfName]: {
                speedUp,
                speedDown,
                offsetUp: speedLineOffsetUp,
                offsetDown: speedLineOffsetDown,
                showSpeedLines
            }
        }));
    }, [getCurrentPfName, speedUp, speedDown, speedLineOffsetUp, speedLineOffsetDown, showSpeedLines]);

    // Save green wave data to localStorage
    const handleSaveGreenWave = () => {
        if (!intersections) return;

        const name = prompt('Nom de l\'onde verte:', greenWaveName || 'Onde verte');
        if (!name) return;

        // Save current PF params before saving
        const currentPfName = getCurrentPfName();
        const updatedPfParams = {
            ...pfParams,
            [currentPfName]: {
                speedUp,
                speedDown,
                offsetUp: speedLineOffsetUp,
                offsetDown: speedLineOffsetDown,
                showSpeedLines
            }
        };
        setPfParams(updatedPfParams);

        const greenWaveData = {
            name,
            intersections,
            speedUp,
            speedDown,
            speedLineOffsetUp,
            speedLineOffsetDown,
            showSpeedLines,
            pfParams: updatedPfParams, // Save all PF params
            pixelsPerSecond,
            pixelsPerMeter,
            displayCycles,
            savedAt: new Date().toISOString()
        };

        // Get existing saved green waves
        const savedGreenWaves = JSON.parse(localStorage.getItem('savedGreenWaves') || '{}');
        savedGreenWaves[name] = greenWaveData;
        localStorage.setItem('savedGreenWaves', JSON.stringify(savedGreenWaves));

        setGreenWaveName(name);
        alert(`Onde verte "${name}" enregistrée avec succès.`);
    };

    // Synchronize green wave data from saved projects
    const handleSyncGreenWave = () => {
        if (!intersections) return;

        let updatedCount = 0;
        const updatedIntersections = intersections.map(intersection => {
            // Try to load project data from localStorage
            const projectKey = `traffic_project_${intersection.projectName}`;
            const projectRaw = localStorage.getItem(projectKey);

            if (projectRaw) {
                try {
                    const projectData = JSON.parse(projectRaw);
                    if (projectData.groups) {
                        updatedCount++;
                        // Get pfTabs and actionData from the selected plan de feu
                        const pfTabs = projectData.pfTabs || [{ id: 1, name: 'PF1', data: [] }];
                        const selectedPfId = intersection.selectedPfId || pfTabs[0]?.id || 1;
                        const selectedPf = pfTabs.find(pf => pf.id === selectedPfId);

                        // Use PF-specific cycleLength if available
                        const pfCycleLength = selectedPf?.cycleLength || projectData.cycleLength || intersection.cycleLength;

                        // Update groups with PF-specific diagram data (offset and green durations)
                        let updatedGroups = projectData.groups;
                        if (selectedPf?.diagram && Array.isArray(selectedPf.diagram)) {
                            updatedGroups = projectData.groups.map(group => {
                                const diagramEntry = selectedPf.diagram.find(d => d.groupId === group.id);
                                if (diagramEntry) {
                                    return {
                                        ...group,
                                        offset: diagramEntry.offset ?? group.offset,
                                        durations: {
                                            ...group.durations,
                                            green: diagramEntry.greenDuration ?? group.durations?.green
                                        }
                                    };
                                }
                                return group;
                            });
                        }

                        return {
                            ...intersection,
                            groups: updatedGroups,
                            cycleLength: pfCycleLength,
                            pfTabs: pfTabs,
                            actionData: selectedPf?.data || []
                        };
                    }
                } catch (e) {
                    console.error(`Failed to sync project ${intersection.projectName}`, e);
                }
            }
            return intersection;
        });

        setIntersections(updatedIntersections);

        if (updatedCount > 0) {
            alert(`${updatedCount} carrefour(s) synchronisé(s) avec succès.`);
        } else {
            alert('Aucun carrefour mis à jour. Vérifiez que les projets existent.');
        }
    };

    // Load data from sessionStorage on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const greenWaveId = urlParams.get('id');
        if (greenWaveId) {
            // Load intersections data
            const savedData = sessionStorage.getItem(`greenwave_${greenWaveId}`);
            if (savedData) {
                try {
                    const data = JSON.parse(savedData);
                    setIntersections(data);
                    // Set document title
                    document.title = `Onde Verte - ${data.length} carrefours`;
                } catch (e) {
                    console.error('Failed to load green wave data', e);
                }
            }

            // Load settings if available (from saved green wave)
            const savedSettings = sessionStorage.getItem(`greenwave_settings_${greenWaveId}`);
            if (savedSettings) {
                try {
                    const settings = JSON.parse(savedSettings);
                    if (settings.name) setGreenWaveName(settings.name);
                    if (settings.speedUp) setSpeedUp(settings.speedUp);
                    else if (settings.speed) setSpeedUp(settings.speed); // Backward compatibility
                    if (settings.speedDown) setSpeedDown(settings.speedDown);
                    else if (settings.speed) setSpeedDown(settings.speed); // Backward compatibility
                    if (settings.pixelsPerSecond) setPixelsPerSecond(settings.pixelsPerSecond);
                    if (settings.pixelsPerMeter) setPixelsPerMeter(settings.pixelsPerMeter);
                    if (settings.speedLineOffsetUp !== undefined) setSpeedLineOffsetUp(settings.speedLineOffsetUp);
                    if (settings.speedLineOffsetDown !== undefined) setSpeedLineOffsetDown(settings.speedLineOffsetDown);
                    if (settings.showSpeedLines !== undefined) setShowSpeedLines(settings.showSpeedLines);
                    // Load pfParams if available
                    if (settings.pfParams) {
                        setPfParams(settings.pfParams);
                    }
                    // Load displayCycles if available
                    if (settings.displayCycles) {
                        setDisplayCycles(settings.displayCycles);
                    }
                    // Update title with name
                    if (settings.name) {
                        document.title = `Onde Verte - ${settings.name}`;
                    }
                } catch (e) {
                    console.error('Failed to load green wave settings', e);
                }
            }
        }
    }, []);

    // Calculate the maximum values for axes
    const { maxTime, maxDistance, cycleLength } = useMemo(() => {
        if (!intersections || intersections.length === 0) {
            return { maxTime: 100, maxDistance: 500, cycleLength: 100 };
        }

        const maxDist = Math.max(...intersections.map(i => i.distance));
        const cycle = intersections[0]?.cycleLength || 100;

        return {
            maxTime: cycle * displayCycles, // Show 2 or 3 cycles
            maxDistance: maxDist + 50,
            cycleLength: cycle
        };
    }, [intersections, displayCycles]);


    // Update intersection distance for group 1
    const updateDistance = (intersectionIdx, value) => {
        setIntersections(prev => {
            const updated = [...prev];
            updated[intersectionIdx] = { ...updated[intersectionIdx], distance: parseInt(value) || 0 };
            return updated;
        });
    };

    // Update intersection distance for group 2
    const updateDistanceG2 = (intersectionIdx, value) => {
        setIntersections(prev => {
            const updated = [...prev];
            updated[intersectionIdx] = { ...updated[intersectionIdx], distanceG2: parseInt(value) || 0 };
            return updated;
        });
    };

    // Update selected plan de feu for an intersection
    // Also reloads groups, cycleLength and green durations from the saved project
    const updateSelectedPf = (intersectionIdx, pfId) => {
        setIntersections(prev => {
            const updated = [...prev];
            const intersection = updated[intersectionIdx];

            // Try to load fresh data from the saved project
            const projectKey = `traffic_project_${intersection.projectName}`;
            const projectRaw = localStorage.getItem(projectKey);

            let newGroups = intersection.groups;
            let newCycleLength = intersection.cycleLength;
            let newPfTabs = intersection.pfTabs;

            if (projectRaw) {
                try {
                    const projectData = JSON.parse(projectRaw);
                    if (projectData.groups) {
                        newGroups = projectData.groups;
                    }
                    if (projectData.cycleLength) {
                        newCycleLength = projectData.cycleLength;
                    }
                    if (projectData.pfTabs) {
                        newPfTabs = projectData.pfTabs;
                    }
                } catch (e) {
                    console.error(`Failed to load project data for ${intersection.projectName}`, e);
                }
            }

            const selectedPf = newPfTabs?.find(pf => pf.id === pfId);

            // Use PF-specific cycleLength if available, otherwise fallback to project cycleLength
            const pfCycleLength = selectedPf?.cycleLength || newCycleLength;

            // Update groups with PF-specific diagram data (offset and green durations)
            let updatedGroups = newGroups;
            if (selectedPf?.diagram && Array.isArray(selectedPf.diagram)) {
                updatedGroups = newGroups.map(group => {
                    const diagramEntry = selectedPf.diagram.find(d => d.groupId === group.id);
                    if (diagramEntry) {
                        return {
                            ...group,
                            offset: diagramEntry.offset ?? group.offset,
                            durations: {
                                ...group.durations,
                                green: diagramEntry.greenDuration ?? group.durations?.green
                            }
                        };
                    }
                    return group;
                });
            }

            updated[intersectionIdx] = {
                ...intersection,
                selectedPfId: pfId,
                groups: updatedGroups,
                cycleLength: pfCycleLength,
                pfTabs: newPfTabs,
                actionData: selectedPf?.data || []
            };
            return updated;
        });
    };

    // Update selected group 1 (descendant) for an intersection
    const updateSelectedGroup1 = (intersectionIdx, groupId) => {
        setIntersections(prev => {
            const updated = [...prev];
            updated[intersectionIdx] = { ...updated[intersectionIdx], selectedGroup1: groupId };
            return updated;
        });
    };

    // Update selected group 2 (montant) for an intersection
    const updateSelectedGroup2 = (intersectionIdx, groupId) => {
        setIntersections(prev => {
            const updated = [...prev];
            updated[intersectionIdx] = { ...updated[intersectionIdx], selectedGroup2: groupId };
            return updated;
        });
    };

    // Change PF for all intersections based on a reference PF
    // Tries to match by name first, then by cycle length
    const handleGlobalPfChange = (referencePfId) => {
        if (!intersections || intersections.length === 0) return;

        const firstIntersection = intersections[0];
        const referencePf = firstIntersection.pfTabs?.find(pf => pf.id === referencePfId);
        if (!referencePf) return;

        // Save current PF params before switching
        const currentPfName = getCurrentPfName();
        const updatedPfParams = {
            ...pfParams,
            [currentPfName]: {
                speedUp,
                speedDown,
                offsetUp: speedLineOffsetUp,
                offsetDown: speedLineOffsetDown,
                showSpeedLines
            }
        };
        setPfParams(updatedPfParams);

        const referencePfName = referencePf.name;
        const referenceCycleLength = referencePf.cycleLength || firstIntersection.cycleLength;

        // Load params for the new PF (if they exist)
        const newPfParamsData = updatedPfParams[referencePfName];
        if (newPfParamsData) {
            setSpeedUp(newPfParamsData.speedUp ?? 50);
            setSpeedDown(newPfParamsData.speedDown ?? 50);
            setSpeedLineOffsetUp(newPfParamsData.offsetUp ?? 0);
            setSpeedLineOffsetDown(newPfParamsData.offsetDown ?? 0);
            setShowSpeedLines(newPfParamsData.showSpeedLines ?? true);
        } else {
            // Reset to defaults if no saved params for this PF
            setSpeedLineOffsetUp(0);
            setSpeedLineOffsetDown(0);
            setShowSpeedLines(true);
        }

        setIntersections(prev => {
            return prev.map((intersection, idx) => {
                // Load fresh data from localStorage for this intersection
                const projectKey = `traffic_project_${intersection.projectName}`;
                const projectRaw = localStorage.getItem(projectKey);

                let newGroups = intersection.groups;
                let newCycleLength = intersection.cycleLength;
                let newPfTabs = intersection.pfTabs;

                if (projectRaw) {
                    try {
                        const projectData = JSON.parse(projectRaw);
                        if (projectData.groups) {
                            newGroups = projectData.groups;
                        }
                        if (projectData.cycleLength) {
                            newCycleLength = projectData.cycleLength;
                        }
                        if (projectData.pfTabs) {
                            newPfTabs = projectData.pfTabs;
                        }
                    } catch (e) {
                        console.error(`Failed to load project data for ${intersection.projectName}`, e);
                    }
                }

                // Find matching PF: first by name, then by cycle length
                let matchingPf = newPfTabs?.find(pf => pf.name === referencePfName);

                if (!matchingPf) {
                    // Try to find first PF with matching cycle length
                    matchingPf = newPfTabs?.find(pf => {
                        const pfCycle = pf.cycleLength || newCycleLength;
                        return pfCycle === referenceCycleLength;
                    });
                }

                // Fallback to first PF if no match found
                if (!matchingPf && newPfTabs?.length > 0) {
                    matchingPf = newPfTabs[0];
                }

                const selectedPfId = matchingPf?.id || 1;
                const selectedPf = newPfTabs?.find(pf => pf.id === selectedPfId);

                // Use PF-specific cycleLength if available
                const pfCycleLength = selectedPf?.cycleLength || newCycleLength;

                // Update groups with PF-specific diagram data
                let updatedGroups = newGroups;
                if (selectedPf?.diagram && Array.isArray(selectedPf.diagram)) {
                    updatedGroups = newGroups.map(group => {
                        const diagramEntry = selectedPf.diagram.find(d => d.groupId === group.id);
                        if (diagramEntry) {
                            return {
                                ...group,
                                offset: diagramEntry.offset ?? group.offset,
                                durations: {
                                    ...group.durations,
                                    green: diagramEntry.greenDuration ?? group.durations?.green
                                }
                            };
                        }
                        return group;
                    });
                }

                return {
                    ...intersection,
                    selectedPfId: selectedPfId,
                    groups: updatedGroups,
                    cycleLength: pfCycleLength,
                    pfTabs: newPfTabs,
                    actionData: selectedPf?.data || []
                };
            });
        });
    };

    // Add a new intersection from saved projects
    const addIntersection = () => {
        // Get list of saved projects from localStorage (same logic as getAllSaves in useTrafficLight)
        const availableProjects = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('traffic_project_')) {
                availableProjects.push(key.replace('traffic_project_', ''));
            }
        }

        // Sort by saved order if available
        const orderRaw = localStorage.getItem('traffic_project_order');
        if (orderRaw) {
            try {
                const order = JSON.parse(orderRaw);
                availableProjects.sort((a, b) => {
                    const idxA = order.indexOf(a);
                    const idxB = order.indexOf(b);
                    if (idxA === -1 && idxB === -1) return 0;
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            } catch (e) {
                // ignore
            }
        }

        if (availableProjects.length === 0) {
            alert('Aucun projet sauvegardé disponible.');
            return;
        }

        // Show selection dialog
        const projectName = prompt(
            `Sélectionnez un projet à ajouter:\n\n${availableProjects.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nEntrez le numéro ou le nom du projet:`,
            '1'
        );

        if (!projectName) return;

        // Find the project by number or name
        let selectedProject;
        const projectNumber = parseInt(projectName);
        if (!isNaN(projectNumber) && projectNumber >= 1 && projectNumber <= availableProjects.length) {
            selectedProject = availableProjects[projectNumber - 1];
        } else {
            selectedProject = availableProjects.find(p => p.toLowerCase() === projectName.toLowerCase());
        }

        if (!selectedProject) {
            alert('Projet non trouvé.');
            return;
        }

        // Load project data from localStorage
        const projectKey = `traffic_project_${selectedProject}`;
        const projectRaw = localStorage.getItem(projectKey);
        if (!projectRaw) {
            alert(`Impossible de charger le projet "${selectedProject}".`);
            return;
        }

        try {
            const projectData = JSON.parse(projectRaw);
            const pfTabs = projectData.pfTabs || [{ id: 1, name: 'PF1', data: [] }];
            const selectedPfId = pfTabs[0]?.id || 1;
            const selectedPf = pfTabs.find(pf => pf.id === selectedPfId);
            const pfCycleLength = selectedPf?.cycleLength || projectData.cycleLength || 90;

            // Get groups with PF-specific data if available
            let groups = projectData.groups || [];
            if (selectedPf?.diagram && Array.isArray(selectedPf.diagram)) {
                groups = groups.map(group => {
                    const diagramEntry = selectedPf.diagram.find(d => d.groupId === group.id);
                    if (diagramEntry) {
                        return {
                            ...group,
                            offset: diagramEntry.offset ?? group.offset,
                            durations: {
                                ...group.durations,
                                green: diagramEntry.greenDuration ?? group.durations?.green
                            }
                        };
                    }
                    return group;
                });
            }

            // Calculate default distance (last intersection distance + 100m or 0)
            const lastDistance = intersections?.length > 0
                ? Math.max(...intersections.map(i => i.distance))
                : 0;
            const newDistance = lastDistance + 100;

            // Create new intersection object
            const newIntersection = {
                projectName: selectedProject,
                groups: groups,
                cycleLength: pfCycleLength,
                pfTabs: pfTabs,
                selectedPfId: selectedPfId,
                selectedGroup1: groups[0]?.id || 1,
                selectedGroup2: groups[0]?.id || 1,
                distance: newDistance,
                distanceG2: newDistance,
                actionData: selectedPf?.data || []
            };

            setIntersections(prev => [...(prev || []), newIntersection]);
        } catch (e) {
            console.error('Failed to load project data', e);
            alert(`Erreur lors du chargement du projet "${selectedProject}".`);
        }
    };

    // Move intersection up or down in the list
    const moveIntersection = (index, direction) => {
        setIntersections(prev => {
            if (!prev) return prev;
            const newList = [...prev].map(item => ({ ...item }));
            const targetIndex = direction === 'up' ? index - 1 : index + 1;

            if (targetIndex < 0 || targetIndex >= newList.length) return prev;

            // Swap intersections (each keeps its own distance)
            [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
            return newList;
        });
    };

    // Calculate speed line slope (meters per second)
    const speedUpMps = (speedUp * 1000) / 3600; // Convert km/h to m/s - ascending
    const speedDownMps = (speedDown * 1000) / 3600; // Convert km/h to m/s - descending

    const PADDING_LEFT = 260;
    const PADDING_BOTTOM = 50;
    const PADDING_TOP = 20;
    const PADDING_RIGHT = 20;

    const diagramWidth = maxTime * pixelsPerSecond + PADDING_LEFT + PADDING_RIGHT;
    const diagramHeight = maxDistance * pixelsPerMeter + PADDING_TOP + PADDING_BOTTOM;

    // Convert coordinates
    const timeToX = (time) => PADDING_LEFT + time * pixelsPerSecond;
    const distanceToY = (distance) => diagramHeight - PADDING_BOTTOM - distance * pixelsPerMeter;

    // Generate axis ticks
    const timeTicks = [];
    const timeStep = cycleLength >= 60 ? 10 : 5;
    for (let t = 0; t <= maxTime; t += timeStep) {
        timeTicks.push(t);
    }

    const distanceTicks = [];
    const distanceStep = maxDistance > 500 ? 100 : 50;
    for (let d = 0; d <= maxDistance; d += distanceStep) {
        distanceTicks.push(d);
    }

    // Calculate bandwidth corridors (ascending and descending)
    const bandwidthData = useMemo(() => {
        if (!intersections || intersections.length === 0) return null;

        // Sort intersections by distance for G1 (descending) and distanceG2 for G2 (ascending)
        const sortedByDistG1 = [...intersections].sort((a, b) => a.distance - b.distance);
        const sortedByDistG2 = [...intersections].sort((a, b) =>
            (a.distanceG2 ?? a.distance) - (b.distanceG2 ?? b.distance)
        );

        if (sortedByDistG1.length === 0) return null;

        // Reference = bottom intersection (min distance) for each group
        const bottomIntersectionG2 = sortedByDistG2[0];
        const topIntersectionG1 = sortedByDistG1[sortedByDistG1.length - 1];

        // Helper function to normalize a time value to [0, cycleLength) range
        const normalizeTime = (t) => {
            const mod = t % cycleLength;
            return mod < 0 ? mod + cycleLength : mod;
        };

        // Helper function to compute intersection of two green windows with cycle wrap-around
        // Returns the intersection window [start, end] relative to the reference
        // Windows are represented as [start, start + width] where width is the green duration
        const intersectWindows = (refStart, refWidth, windowStart, windowWidth) => {
            // Both windows are expressed in the same time reference
            // We need to find the overlap considering cycle wrap-around

            // Normalize windowStart relative to refStart to handle cycle boundaries
            // We want to find where windowStart is relative to refStart in the cycle
            let relativeStart = normalizeTime(windowStart - refStart);

            // If the relative start is more than half a cycle away, it's actually before us
            // This handles the wrap-around case
            if (relativeStart > cycleLength / 2) {
                relativeStart -= cycleLength;
            }

            // Now compute intersection
            // Reference window is [0, refWidth] in relative coordinates
            // Other window is [relativeStart, relativeStart + windowWidth]
            const overlapStart = Math.max(0, relativeStart);
            const overlapEnd = Math.min(refWidth, relativeStart + windowWidth);

            if (overlapEnd <= overlapStart) {
                return null; // No intersection
            }

            return {
                start: overlapStart,
                width: overlapEnd - overlapStart
            };
        };

        // ASCENDING bandwidth (bottom to top, positive slope) - uses Group 2 with distanceG2
        // Calculate bandwidth successively: from 1st to last, 2nd to last, 3rd to last, etc.
        // Then create segments that can widen when starting from a later intersection gives more bandwidth
        let ascSegments = [];
        const bottomDistG2 = bottomIntersectionG2.distanceG2 ?? bottomIntersectionG2.distance;

        if (sortedByDistG2.length > 0) {
            // Calculate bandwidth from each starting intersection to the top
            const bandwidthFromEachStart = [];

            for (let startIdx = 0; startIdx < sortedByDistG2.length; startIdx++) {
                const startIntersection = sortedByDistG2[startIdx];
                const startGroup = startIntersection.groups.find(g => g.id === startIntersection.selectedGroup2);
                if (!startGroup) {
                    bandwidthFromEachStart.push({ width: 0, start: 0 });
                    continue;
                }

                const startDistG2 = startIntersection.distanceG2 ?? startIntersection.distance;
                const startRefStart = startGroup.offset;
                const startRefWidth = startGroup.durations?.green || 0;

                let calcStart = 0;
                let calcWidth = startRefWidth;

                // Calculate intersection of windows from startIdx to the end
                for (let i = startIdx; i < sortedByDistG2.length; i++) {
                    if (calcWidth <= 0) break;

                    const intersection = sortedByDistG2[i];
                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                    if (!group) continue;

                    const distG2 = intersection.distanceG2 ?? intersection.distance;
                    const travelTime = (distG2 - startDistG2) / speedUpMps;
                    const greenStart = group.offset;
                    const greenWidth = group.durations?.green || 0;
                    const greenStartAtStart = greenStart - travelTime;

                    const intersection2 = intersectWindows(
                        startRefStart + calcStart,
                        calcWidth,
                        greenStartAtStart,
                        greenWidth
                    );

                    if (intersection2) {
                        calcStart += intersection2.start;
                        calcWidth = intersection2.width;
                    } else {
                        calcWidth = 0;
                    }
                }

                // Convert start time to bottom reference for consistent rendering
                const travelTimeFromBottom = (startDistG2 - bottomDistG2) / speedUpMps;
                const startAtBottom = normalizeTime(startRefStart + calcStart - travelTimeFromBottom);

                bandwidthFromEachStart.push({
                    width: calcWidth,
                    start: startAtBottom,
                    startDist: startDistG2
                });
            }

            // Build segments: find where bandwidth can widen
            // Each segment covers from its startIdx to the end, but only extends visually to
            // where the next wider segment begins
            let segmentStartIdx = 0;
            let currentWidth = bandwidthFromEachStart[0]?.width || 0;
            let currentStart = bandwidthFromEachStart[0]?.start || 0;

            // Collect widening points
            const wideningPoints = [{ idx: 0, width: currentWidth, start: currentStart }];

            for (let i = 1; i < sortedByDistG2.length; i++) {
                const maxFromHere = bandwidthFromEachStart[i]?.width || 0;

                // If starting from this intersection gives a wider bandwidth
                if (maxFromHere > currentWidth) {
                    wideningPoints.push({
                        idx: i,
                        width: maxFromHere,
                        start: bandwidthFromEachStart[i].start
                    });
                    currentWidth = maxFromHere;
                }
            }

            // Create segments between widening points
            for (let w = 0; w < wideningPoints.length; w++) {
                const point = wideningPoints[w];
                // Each segment goes from this widening point to the next one (or to the end)
                const nextIdx = w + 1 < wideningPoints.length
                    ? wideningPoints[w + 1].idx
                    : sortedByDistG2.length;

                if (point.width > 0) {
                    ascSegments.push({
                        startIdx: point.idx,
                        endIdx: nextIdx - 1,
                        width: point.width,
                        start: point.start,
                        refDistance: bottomDistG2
                    });
                }
            }
        }

        // For backwards compatibility
        let ascResult = null;
        if (ascSegments.length > 0) {
            const firstSegment = ascSegments[0];
            ascResult = {
                start: firstSegment.start,
                width: firstSegment.width,
                refDistance: firstSegment.refDistance,
                segments: ascSegments
            };
        }

        // DESCENDING bandwidth (top to bottom, negative slope) - uses Group 1 with distance
        // Calculate bandwidth successively: from 1st (top) to last (bottom), 2nd to last, 3rd to last, etc.
        // Then create segments that can widen when starting from a later intersection gives more bandwidth
        let descSegments = [];
        const topDist = topIntersectionG1.distance;

        // sortedByDistG1 is sorted ascending (bottom to top), so we need to process from top to bottom
        const sortedTopToBottom = [...sortedByDistG1].reverse();

        if (sortedTopToBottom.length > 0) {
            // Calculate bandwidth from each starting intersection (top to bottom) to the bottom
            const bandwidthFromEachStart = [];

            for (let startIdx = 0; startIdx < sortedTopToBottom.length; startIdx++) {
                const startIntersection = sortedTopToBottom[startIdx];
                const startGroup = startIntersection.groups.find(g => g.id === startIntersection.selectedGroup1);
                if (!startGroup) {
                    bandwidthFromEachStart.push({ width: 0, start: 0 });
                    continue;
                }

                const startDist = startIntersection.distance;
                const startRefStart = startGroup.offset;
                const startRefWidth = startGroup.durations?.green || 0;

                let calcStart = 0;
                let calcWidth = startRefWidth;

                // Calculate intersection of windows from startIdx to the end (bottom)
                for (let i = startIdx; i < sortedTopToBottom.length; i++) {
                    if (calcWidth <= 0) break;

                    const intersection = sortedTopToBottom[i];
                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                    if (!group) continue;

                    const dist = intersection.distance;
                    const travelTime = (startDist - dist) / speedDownMps;
                    const greenStart = group.offset;
                    const greenWidth = group.durations?.green || 0;
                    const greenStartAtStart = greenStart - travelTime;

                    const intersection2 = intersectWindows(
                        startRefStart + calcStart,
                        calcWidth,
                        greenStartAtStart,
                        greenWidth
                    );

                    if (intersection2) {
                        calcStart += intersection2.start;
                        calcWidth = intersection2.width;
                    } else {
                        calcWidth = 0;
                    }
                }

                // Convert start time to top reference for consistent rendering
                const travelTimeFromTop = (topDist - startDist) / speedDownMps;
                const startAtTop = normalizeTime(startRefStart + calcStart - travelTimeFromTop);

                bandwidthFromEachStart.push({
                    width: calcWidth,
                    start: startAtTop,
                    startDist: startDist
                });
            }

            // Build segments: find where bandwidth can widen
            // Each segment covers from its startIdx to the end, but only extends visually to
            // where the next wider segment begins
            let currentWidth = bandwidthFromEachStart[0]?.width || 0;
            let currentStart = bandwidthFromEachStart[0]?.start || 0;

            // Collect widening points
            const wideningPoints = [{ idx: 0, width: currentWidth, start: currentStart }];

            for (let i = 1; i < sortedTopToBottom.length; i++) {
                const maxFromHere = bandwidthFromEachStart[i]?.width || 0;

                // If starting from this intersection gives a wider bandwidth
                if (maxFromHere > currentWidth) {
                    wideningPoints.push({
                        idx: i,
                        width: maxFromHere,
                        start: bandwidthFromEachStart[i].start
                    });
                    currentWidth = maxFromHere;
                }
            }

            // Create segments between widening points
            for (let w = 0; w < wideningPoints.length; w++) {
                const point = wideningPoints[w];
                // Each segment goes from this widening point to the next one (or to the end)
                const nextIdx = w + 1 < wideningPoints.length
                    ? wideningPoints[w + 1].idx
                    : sortedTopToBottom.length;

                if (point.width > 0) {
                    descSegments.push({
                        startIdx: point.idx,
                        endIdx: nextIdx - 1,
                        width: point.width,
                        start: point.start,
                        refDistance: topDist
                    });
                }
            }
        }

        // For backwards compatibility
        let descResult = null;
        if (descSegments.length > 0) {
            const firstSegment = descSegments[0];
            descResult = {
                start: firstSegment.start,
                width: firstSegment.width,
                refDistance: firstSegment.refDistance,
                segments: descSegments
            };
        }

        return {
            ascending: ascResult,
            descending: descResult
        };
    }, [intersections, speedUpMps, speedDownMps, cycleLength]);

    // Generate speed lines (green wave corridors) - ascending and descending
    // Apply offsets (in seconds) to shift lines horizontally
    const speedLinesUp = [];
    const speedLinesDown = [];
    for (let startTime = 0; startTime < maxTime; startTime += cycleLength) {
        // Ascending lines (bottom to top) - apply speedLineOffsetUp
        const startTimeUp = startTime + speedLineOffsetUp;
        speedLinesUp.push({
            x1: timeToX(startTimeUp),
            y1: distanceToY(0),
            x2: timeToX(startTimeUp + maxDistance / speedUpMps),
            y2: distanceToY(maxDistance)
        });
        // Descending lines (top to bottom) - apply speedLineOffsetDown
        const startTimeDown = startTime + speedLineOffsetDown;
        speedLinesDown.push({
            x1: timeToX(startTimeDown),
            y1: distanceToY(maxDistance),
            x2: timeToX(startTimeDown + maxDistance / speedDownMps),
            y2: distanceToY(0)
        });
    }

    // Drag handlers for speed lines
    const [dragStartX, setDragStartX] = useState(0);
    const [initialOffset, setInitialOffset] = useState(0);

    const handleMouseDownUp = (e) => {
        e.preventDefault();
        setDragging('up');
        setDragStartX(e.clientX);
        setInitialOffset(speedLineOffsetUp);
    };

    const handleMouseDownDown = (e) => {
        e.preventDefault();
        setDragging('down');
        setDragStartX(e.clientX);
        setInitialOffset(speedLineOffsetDown);
    };

    const handleMouseMove = (e) => {
        if (!dragging) return;
        const deltaX = e.clientX - dragStartX;
        const deltaSeconds = deltaX / pixelsPerSecond;
        if (dragging === 'up') {
            setSpeedLineOffsetUp(initialOffset + deltaSeconds);
        } else if (dragging === 'down') {
            setSpeedLineOffsetDown(initialOffset + deltaSeconds);
        }
    };

    const handleMouseUp = () => {
        setDragging(null);
    };

    if (!intersections) {
        return (
            <div className="green-wave-page">
                <div className="green-wave-loading">
                    Chargement des données...
                </div>
            </div>
        );
    }

    return (
        <div className="green-wave-page">
            <div className="green-wave-page-header">
                <h1>
                    Onde Verte
                    {greenWaveName && <span className="folder-name">- {greenWaveName}</span>}
                </h1>
                {intersections?.[0]?.pfTabs && intersections[0].pfTabs.length > 0 && (
                    <select
                        className="green-wave-pf-select"
                        value={intersections[0].selectedPfId || 1}
                        onChange={(e) => handleGlobalPfChange(parseInt(e.target.value))}
                        title="Changer le plan de feu pour tous les carrefours (par nom ou durée de cycle)"
                    >
                        {intersections[0].pfTabs.map(pf => (
                            <option key={pf.id} value={pf.id}>
                                {pf.name}{pf.cycleLength ? ` (${pf.cycleLength}s)` : ''}
                            </option>
                        ))}
                    </select>
                )}
                <div className="green-wave-controls">
                    <label style={{ color: '#8BC34A' }}>
                        V. mont :
                        <input
                            type="number"
                            value={speedUp}
                            onChange={(e) => setSpeedUp(parseInt(e.target.value) || 50)}
                            min="10"
                            max="130"
                            style={{ width: '40px' }}
                        />
                        km/h
                    </label>
                    <label style={{ color: '#FF9800' }}>
                        V. desc :
                        <input
                            type="number"
                            value={speedDown}
                            onChange={(e) => setSpeedDown(parseInt(e.target.value) || 50)}
                            min="10"
                            max="130"
                            style={{ width: '40px' }}
                        />
                        km/h
                    </label>
                    <label>
                        Zoom X :
                        <input
                            type="range"
                            min="3"
                            max="20"
                            value={pixelsPerSecond}
                            onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))}
                        />
                        {pixelsPerSecond}px/s
                    </label>
                    <label>
                        Zoom Y :
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={pixelsPerMeter}
                            onChange={(e) => setPixelsPerMeter(parseFloat(e.target.value))}
                        />
                        {pixelsPerMeter.toFixed(1)}px/m
                    </label>
                    <label>
                        Cycles :
                        <select
                            value={displayCycles}
                            onChange={(e) => setDisplayCycles(parseInt(e.target.value))}
                            style={{ marginLeft: '8px', padding: '4px 8px', background: '#444', border: '1px solid #555', borderRadius: '3px', color: '#fff' }}
                        >
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                        </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={showSpeedLines}
                            onChange={(e) => setShowSpeedLines(e.target.checked)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        Lignes directrices
                    </label>
                    <button
                        className="green-wave-sync-btn"
                        onClick={handleSyncGreenWave}
                        title="Actualise les données (offset, durée de vert, cycle) depuis les projets sauvegardés pour le plan de feu sélectionné de chaque carrefour"
                    >
                        Synchroniser
                    </button>
                    <button className="green-wave-save-btn" onClick={handleSaveGreenWave}>
                        Enregistrer
                    </button>
                    <button className="green-wave-print-btn" onClick={() => {
                        const svgElement = document.querySelector('.green-wave-svg');
                        if (!svgElement) return;

                        const printWindow = window.open('', '_blank');
                        const svgClone = svgElement.cloneNode(true);

                        // Build title
                        let title = 'Onde Verte';
                        if (greenWaveName) title += ` - ${greenWaveName}`;
                        if (intersections?.[0]?.pfTabs && intersections[0].selectedPfId) {
                            const pfName = intersections[0].pfTabs.find(pf => pf.id === intersections[0].selectedPfId)?.name || 'PF1';
                            title += ` (${pfName})`;
                        }

                        // Get SVG dimensions for scaling
                        const svgWidth = svgElement.getAttribute('width') || svgElement.getBoundingClientRect().width;
                        const svgHeight = svgElement.getAttribute('height') || svgElement.getBoundingClientRect().height;

                        // Get current date and time for footer
                        const now = new Date();
                        const dateTimeStr = now.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        printWindow.document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>${title}</title>
                                <style>
                                    @page {
                                        size: landscape;
                                        margin: 10mm 5mm 10mm 5mm; /* top right bottom left */
                                    }
                                    body {
                                        margin: 0;
                                        padding: 5px;
                                        background: white;
                                        -webkit-print-color-adjust: exact;
                                        print-color-adjust: exact;
                                        color-adjust: exact;
                                        font-family: Arial, sans-serif;
                                    }
                                    h1 {
                                        color: #2E7D32;
                                        font-family: Arial, sans-serif;
                                        margin-bottom: 10px;
                                        font-size: 16px;
                                    }
                                    h1 .folder-name {
                                        color: #558B2F;
                                        font-weight: normal;
                                    }
                                    .svg-container {
                                        width: 100%;
                                        overflow: visible;
                                    }
                                    svg {
                                        display: block;
                                        max-width: 100%;
                                        height: auto;
                                        background: white;
                                    }
                                    .print-footer {
                                        margin-top: 10px;
                                        padding-top: 5px;
                                        border-top: 1px solid #ccc;
                                        font-size: 10px;
                                        color: #666;
                                        text-align: right;
                                    }
                                    .print-info {
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        margin-bottom: 8px;
                                        font-size: 11px;
                                        color: #333;
                                    }
                                    .print-speeds {
                                        display: flex;
                                        gap: 20px;
                                    }
                                    .print-speeds span {
                                        display: flex;
                                        align-items: center;
                                        gap: 5px;
                                    }
                                    .print-legend {
                                        display: flex;
                                        gap: 15px;
                                        flex-wrap: wrap;
                                    }
                                    .legend-item {
                                        display: flex;
                                        align-items: center;
                                        gap: 5px;
                                        font-size: 10px;
                                        color: #555;
                                    }
                                    .legend-color {
                                        width: 16px;
                                        height: 10px;
                                        border-radius: 2px;
                                    }
                                    .legend-line {
                                        width: 24px;
                                        height: 0;
                                        border-top: 2px dashed;
                                    }
                                    .legend-bandwidth {
                                        width: 16px;
                                        height: 10px;
                                        border-radius: 2px;
                                        border: 1px solid;
                                    }
                                    /* Force white background on SVG elements */
                                    svg rect[fill="#1a1a1a"],
                                    svg rect[fill="#1e1e1e"] {
                                        fill: #f5f5f5 !important;
                                    }
                                    /* Adjust text colors for print */
                                    svg text[fill="#fff"],
                                    svg text[fill="white"] {
                                        fill: #333 !important;
                                    }
                                    svg text[fill="#ccc"],
                                    svg text[fill="#aaa"],
                                    svg text[fill="#888"] {
                                        fill: #555 !important;
                                    }
                                    /* Keep colored elements visible */
                                    svg text[fill="#4CAF50"] { fill: #2E7D32 !important; }
                                    svg text[fill="#8BC34A"] { fill: #558B2F !important; }
                                    svg text[fill="#FF9800"] { fill: #E65100 !important; }
                                    svg line[stroke="#333"],
                                    svg line[stroke="#555"] {
                                        stroke: #ccc !important;
                                    }
                                    @media print {
                                        body {
                                            -webkit-print-color-adjust: exact;
                                            print-color-adjust: exact;
                                            color-adjust: exact;
                                        }
                                    }
                                </style>
                            </head>
                            <body>
                                <h1>Onde Verte${greenWaveName ? ` <span class="folder-name">- ${greenWaveName}</span>` : ''}${intersections?.[0]?.pfTabs && intersections[0].selectedPfId ? ` <span class="folder-name">(${intersections[0].pfTabs.find(pf => pf.id === intersections[0].selectedPfId)?.name || 'PF1'})</span>` : ''}</h1>
                                <div class="print-info">
                                    <div class="print-speeds">
                                        <span><strong>V. montante:</strong> ${speedUp} km/h</span>
                                        <span><strong>V. descendante:</strong> ${speedDown} km/h</span>
                                    </div>
                                    <div class="print-legend">
                                        <div class="legend-item">
                                            <div class="legend-color" style="background: #4CAF50;"></div>
                                            <span>Vert</span>
                                        </div>
                                        <div class="legend-item">
                                            <div class="legend-color" style="background: #FF9800;"></div>
                                            <span>Orange</span>
                                        </div>
                                        <div class="legend-item">
                                            <div class="legend-color" style="background: #f44336;"></div>
                                            <span>Rouge</span>
                                        </div>
                                        <div class="legend-item">
                                            <div class="legend-line" style="border-color: #4CAF50;"></div>
                                            <span>Vitesse montante</span>
                                        </div>
                                        <div class="legend-item">
                                            <div class="legend-line" style="border-color: #FF9800;"></div>
                                            <span>Vitesse descendante</span>
                                        </div>
                                        <div class="legend-item">
                                            <div class="legend-bandwidth" style="background: rgba(76, 175, 80, 0.3); border-color: #4CAF50;"></div>
                                            <span>Bande passante</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="svg-container">
                                    ${svgClone.outerHTML}
                                </div>
                                <div class="print-footer">
                                    Imprimé le ${dateTimeStr}
                                </div>
                            </body>
                            </html>
                        `);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => {
                            printWindow.print();
                        }, 250);
                    }}>
                        Imprimer
                    </button>
                </div>
            </div>

            <div className="green-wave-diagram-scroll">
                <svg
                    className="green-wave-svg"
                    width={diagramWidth}
                    height={diagramHeight}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: dragging ? 'ew-resize' : 'default' }}
                >
                    {/* Background */}
                    <rect
                        x={PADDING_LEFT}
                        y={PADDING_TOP}
                        width={diagramWidth - PADDING_LEFT - PADDING_RIGHT}
                        height={diagramHeight - PADDING_TOP - PADDING_BOTTOM}
                        fill="#1a1a1a"
                    />

                    {/* Grid lines - vertical (time) */}
                    {timeTicks.map(t => (
                        <line
                            key={`grid-t-${t}`}
                            x1={timeToX(t)}
                            y1={PADDING_TOP}
                            x2={timeToX(t)}
                            y2={diagramHeight - PADDING_BOTTOM}
                            stroke={t % cycleLength === 0 ? '#555' : '#333'}
                            strokeWidth={t % cycleLength === 0 ? 1 : 0.5}
                        />
                    ))}

                    {/* Grid lines - horizontal (distance) */}
                    {distanceTicks.map(d => (
                        <line
                            key={`grid-d-${d}`}
                            x1={PADDING_LEFT}
                            y1={distanceToY(d)}
                            x2={diagramWidth - PADDING_RIGHT}
                            y2={distanceToY(d)}
                            stroke="#333"
                            strokeWidth={0.5}
                        />
                    ))}

                    {/* Speed lines ascending (green wave corridor) - draggable */}
                    {showSpeedLines && speedLinesUp.map((line, idx) => (
                        <g key={`speed-up-${idx}`}>
                            {/* Invisible wider hit area for easier dragging */}
                            <line
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="transparent"
                                strokeWidth={16}
                                style={{ cursor: 'ew-resize' }}
                                onMouseDown={handleMouseDownUp}
                            />
                            {/* Visible line */}
                            <line
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="#4CAF50"
                                strokeWidth={dragging === 'up' ? 4 : 2}
                                strokeDasharray="8,4"
                                opacity={dragging === 'up' ? 0.9 : 0.6}
                                style={{ cursor: 'ew-resize', pointerEvents: 'none' }}
                            />
                        </g>
                    ))}
                    {/* Speed lines descending (green wave corridor) - draggable */}
                    {showSpeedLines && speedLinesDown.map((line, idx) => (
                        <g key={`speed-down-${idx}`}>
                            {/* Invisible wider hit area for easier dragging */}
                            <line
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="transparent"
                                strokeWidth={16}
                                style={{ cursor: 'ew-resize' }}
                                onMouseDown={handleMouseDownDown}
                            />
                            {/* Visible line */}
                            <line
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="#FF9800"
                                strokeWidth={dragging === 'down' ? 4 : 2}
                                strokeDasharray="8,4"
                                opacity={dragging === 'down' ? 0.9 : 0.6}
                                style={{ cursor: 'ew-resize', pointerEvents: 'none' }}
                            />
                        </g>
                    ))}

                    {/* Intersection bars */}
                    {intersections?.map((intersection, idx) => {
                        const yG1 = distanceToY(intersection.distance);
                        const yG2 = distanceToY(intersection.distanceG2 ?? intersection.distance);
                        const barHeight = 12;

                        // Get the two selected groups
                        const group1 = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                        const group2 = intersection.groups.find(g => g.id === intersection.selectedGroup2);

                        const bars = [];

                        // Render bars for multiple cycles
                        for (let cycle = 0; cycle < 2; cycle++) {
                            const cycleOffset = cycle * intersection.cycleLength;

                            // Group 1 bar (Descendant - Orange) at distance
                            if (group1) {
                                const start1 = group1.offset + cycleOffset;
                                const duration1 = group1.durations?.green || 0;
                                const end1 = start1 + duration1;
                                bars.push(
                                    <g key={`bar-${idx}-g1-c${cycle}`}>
                                        <rect
                                            x={timeToX(start1)}
                                            y={yG1 - barHeight / 2}
                                            width={duration1 * pixelsPerSecond}
                                            height={barHeight}
                                            fill="#FF9800"
                                            opacity={0.9}
                                        />
                                        {/* Deb value at start - above bar */}
                                        <text
                                            x={timeToX(start1) + 2}
                                            y={yG1 - barHeight / 2 - 3}
                                            fill="#FF9800"
                                            fontSize="14"
                                        >
                                            {Math.round(start1 % intersection.cycleLength)}
                                        </text>
                                        {/* Fin value at end - above bar */}
                                        <text
                                            x={timeToX(end1) - 2}
                                            y={yG1 - barHeight / 2 - 3}
                                            fill="#FF9800"
                                            fontSize="14"
                                            textAnchor="end"
                                        >
                                            {Math.round(end1 % intersection.cycleLength)}
                                        </text>
                                    </g>
                                );
                            }

                            // Group 2 bar (Montant - Vert) at distanceG2
                            if (group2) {
                                const start2 = group2.offset + cycleOffset;
                                const duration2 = group2.durations?.green || 0;
                                const end2 = start2 + duration2;
                                bars.push(
                                    <g key={`bar-${idx}-g2-c${cycle}`}>
                                        <rect
                                            x={timeToX(start2)}
                                            y={yG2 - barHeight / 2}
                                            width={duration2 * pixelsPerSecond}
                                            height={barHeight}
                                            fill="#4CAF50"
                                            opacity={0.9}
                                        />
                                        {/* Deb value at start - above bar */}
                                        <text
                                            x={timeToX(start2) + 2}
                                            y={yG2 - barHeight / 2 - 3}
                                            fill="#4CAF50"
                                            fontSize="14"
                                        >
                                            {Math.round(start2 % intersection.cycleLength)}
                                        </text>
                                        {/* Fin value at end - above bar */}
                                        <text
                                            x={timeToX(end2) - 2}
                                            y={yG2 - barHeight / 2 - 3}
                                            fill="#4CAF50"
                                            fontSize="14"
                                            textAnchor="end"
                                        >
                                            {Math.round(end2 % intersection.cycleLength)}
                                        </text>
                                    </g>
                                );
                            }

                            // Render actions (Seconde lucarne, Ouverture anticipée) for selected groups
                            const actions = intersection.actionData || [];
                            // Debug: log actions data
                            if (cycle === 0) {
                                const relevantActions = actions.filter(a => a.action === 'Seconde lucarne' || a.action === 'Ouverture anticipée');
                                console.log('=== Debug Actions ===');
                                console.log('Intersection:', intersection.projectName);
                                console.log('Selected Group1:', intersection.selectedGroup1, 'Group2:', intersection.selectedGroup2);
                                console.log('Total actions in actionData:', actions.length);
                                console.log('Relevant actions (Seconde lucarne / Ouverture anticipée):', relevantActions);
                                if (relevantActions.length > 0) {
                                    relevantActions.forEach(a => console.log('  - GF:', a.gf, 'Action:', a.action, 'Deb:', a.deb, 'Fin:', a.fin));
                                }
                            }
                            actions.forEach((action, actionIdx) => {
                                // Skip if no group, or no start/end time
                                if (!action.gf || action.deb === '' || action.deb === undefined ||
                                    action.fin === '' || action.fin === undefined) return;
                                // Skip if not the right action type
                                if (action.action !== 'Seconde lucarne' && action.action !== 'Ouverture anticipée') return;

                                const actionGroupId = parseInt(action.gf);
                                const isGroup1 = actionGroupId === intersection.selectedGroup1;
                                const isGroup2 = actionGroupId === intersection.selectedGroup2;
                                if (!isGroup1 && !isGroup2) return;

                                const yAction = isGroup1 ? yG1 : yG2;
                                const actionStart = parseInt(action.deb) + cycleOffset;
                                const actionEnd = parseInt(action.fin) + cycleOffset;
                                const actionDuration = actionEnd - actionStart;

                                if (action.action === 'Seconde lucarne') {
                                    // Seconde lucarne - darker green bar
                                    bars.push(
                                        <rect
                                            key={`lucarne-${idx}-${actionIdx}-c${cycle}`}
                                            x={timeToX(actionStart)}
                                            y={yAction - barHeight / 2 - 2}
                                            width={actionDuration * pixelsPerSecond}
                                            height={barHeight}
                                            fill={isGroup1 ? '#E65100' : '#2E7D32'}
                                            opacity={0.9}
                                            stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                            strokeWidth={1}
                                        />
                                    );
                                } else if (action.action === 'Ouverture anticipée') {
                                    // Ouverture anticipée - hatched rectangle
                                    const patternId = `hatch-${idx}-${actionIdx}-${cycle}`;
                                    bars.push(
                                        <g key={`oa-${idx}-${actionIdx}-c${cycle}`}>
                                            <defs>
                                                <pattern id={patternId} patternUnits="userSpaceOnUse" width="4" height="4">
                                                    <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
                                                          stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                                          strokeWidth="1" />
                                                </pattern>
                                            </defs>
                                            <rect
                                                x={timeToX(actionStart)}
                                                y={yAction - barHeight / 2}
                                                width={actionDuration * pixelsPerSecond}
                                                height={barHeight}
                                                fill={`url(#${patternId})`}
                                                stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                                strokeWidth={1}
                                            />
                                        </g>
                                    );
                                }
                            });
                        }

                        // Helper to truncate names to 40 characters
                        const truncateName = (name, maxLen = 40) => {
                            if (!name) return '';
                            return name.length > maxLen ? name.substring(0, maxLen) + '…' : name;
                        };

                        return (
                            <g key={`intersection-${idx}`}>
                                {/* Group 1 name (Descendant) */}
                                {group1 && (
                                    <text
                                        x={PADDING_LEFT - 5}
                                        y={yG1 + 4}
                                        textAnchor="end"
                                        fill="#FF9800"
                                        fontSize="13"
                                        fontWeight="bold"
                                    >
                                        {`G${group1.id} - ${truncateName(group1.name) || 'Sans nom'}`}
                                    </text>
                                )}

                                {/* Project name - 16px above group 1 (Descendant) */}
                                <text
                                    x={PADDING_LEFT - 5}
                                    y={yG1 - 12}
                                    textAnchor="end"
                                    fill="#fff"
                                    fontSize="13"
                                    fontWeight="bold"
                                >
                                    {truncateName(intersection.projectName)}
                                </text>

                                {/* Group 2 name (Montant) */}
                                {group2 && (
                                    <text
                                        x={PADDING_LEFT - 5}
                                        y={yG2 + 4}
                                        textAnchor="end"
                                        fill="#8BC34A"
                                        fontSize="13"
                                        fontWeight="bold"
                                    >
                                        {`G${group2.id} - ${truncateName(group2.name) || 'Sans nom'}`}
                                    </text>
                                )}

                                {/* Horizontal lines at each group position */}
                                <line
                                    x1={PADDING_LEFT}
                                    y1={yG1}
                                    x2={diagramWidth - PADDING_RIGHT}
                                    y2={yG1}
                                    stroke="#FF9800"
                                    strokeWidth={0.5}
                                    strokeDasharray="2,2"
                                    opacity={0.3}
                                />
                                <line
                                    x1={PADDING_LEFT}
                                    y1={yG2}
                                    x2={diagramWidth - PADDING_RIGHT}
                                    y2={yG2}
                                    stroke="#8BC34A"
                                    strokeWidth={0.5}
                                    strokeDasharray="2,2"
                                    opacity={0.3}
                                />

                                {bars}
                            </g>
                        );
                    })}

                    {/* Ascending bandwidth corridor (bottom to top) - as polygon surface with segments */}
                    {bandwidthData?.ascending?.segments && intersections && (() => {
                        // Sort by distanceG2 for ascending (Group 2)
                        const sortedByDistG2 = [...intersections].sort((a, b) =>
                            (a.distanceG2 ?? a.distance) - (b.distanceG2 ?? b.distance)
                        );
                        const segments = bandwidthData.ascending.segments;

                        const elements = [];

                        // Draw each segment as a separate polygon
                        segments.forEach((segment, segIdx) => {
                            const { startIdx, endIdx, width, start, refDistance } = segment;

                            for (let cycle = 0; cycle < 2; cycle++) {
                                const cycleOffset = cycle * cycleLength;
                                const bandStartAtRef = start + cycleOffset + speedLineOffsetUp;
                                const bandEndAtRef = bandStartAtRef + width;

                                const leftPoints = [];
                                const rightPoints = [];

                                // Process intersections in this segment
                                // Include endIdx + 1 if it exists to ensure we have at least 2 points for polygon
                                const actualEndIdx = Math.min(
                                    endIdx < sortedByDistG2.length - 1 ? endIdx + 1 : endIdx,
                                    sortedByDistG2.length - 1
                                );

                                for (let i = startIdx; i <= actualEndIdx; i++) {
                                    const intersection = sortedByDistG2[i];
                                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                                    if (!group) continue;

                                    const distG2 = intersection.distanceG2 ?? intersection.distance;
                                    const y = distanceToY(distG2);

                                    // Time to travel from segment's reference distance
                                    const travelTime = (distG2 - refDistance) / speedUpMps;

                                    const bandStart = bandStartAtRef + travelTime;
                                    const bandEnd = bandEndAtRef + travelTime;

                                    leftPoints.push({ x: timeToX(bandStart), y });
                                    rightPoints.push({ x: timeToX(bandEnd), y });
                                }

                                if (leftPoints.length >= 2) {
                                    const polygonPoints = [
                                        ...leftPoints.map(p => `${p.x},${p.y}`),
                                        ...[...rightPoints].reverse().map(p => `${p.x},${p.y}`)
                                    ].join(' ');

                                    elements.push(
                                        <polygon
                                            key={`asc-polygon-seg${segIdx}-c${cycle}`}
                                            points={polygonPoints}
                                            fill="#4CAF50"
                                            opacity={0.2}
                                            stroke="#81C784"
                                            strokeWidth={2}
                                        />
                                    );
                                }
                            }
                        });

                        return elements;
                    })()}

                    {/* Descending bandwidth corridor (top to bottom) - as polygon surface with segments */}
                    {bandwidthData?.descending?.segments && intersections && (() => {
                        // Sort by distance for descending (Group 1) - top to bottom
                        const sortedByDistG1 = [...intersections].sort((a, b) => a.distance - b.distance);
                        const sortedTopToBottom = [...sortedByDistG1].reverse();
                        const segments = bandwidthData.descending.segments;

                        const elements = [];

                        // Draw each segment as a separate polygon
                        segments.forEach((segment, segIdx) => {
                            const { startIdx, endIdx, width, start, refDistance } = segment;

                            for (let cycle = 0; cycle < 2; cycle++) {
                                const cycleOffset = cycle * cycleLength;
                                const bandStartAtRef = start + cycleOffset + speedLineOffsetDown;
                                const bandEndAtRef = bandStartAtRef + width;

                                const leftPoints = [];
                                const rightPoints = [];

                                // Process intersections in this segment
                                // Include endIdx + 1 if it exists to ensure we have at least 2 points for polygon
                                const actualEndIdx = Math.min(
                                    endIdx < sortedTopToBottom.length - 1 ? endIdx + 1 : endIdx,
                                    sortedTopToBottom.length - 1
                                );

                                for (let i = startIdx; i <= actualEndIdx; i++) {
                                    const intersection = sortedTopToBottom[i];
                                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                                    if (!group) continue;

                                    const dist = intersection.distance;
                                    const y = distanceToY(dist);

                                    // Time to travel from segment's reference distance (going down)
                                    const travelTime = (refDistance - dist) / speedDownMps;

                                    const bandStart = bandStartAtRef + travelTime;
                                    const bandEnd = bandEndAtRef + travelTime;

                                    leftPoints.push({ x: timeToX(bandStart), y });
                                    rightPoints.push({ x: timeToX(bandEnd), y });
                                }

                                if (leftPoints.length >= 2) {
                                    const polygonPoints = [
                                        ...leftPoints.map(p => `${p.x},${p.y}`),
                                        ...[...rightPoints].reverse().map(p => `${p.x},${p.y}`)
                                    ].join(' ');

                                    elements.push(
                                        <polygon
                                            key={`desc-polygon-seg${segIdx}-c${cycle}`}
                                            points={polygonPoints}
                                            fill="#FF9800"
                                            opacity={0.2}
                                            stroke="#FFAB91"
                                            strokeWidth={2}
                                        />
                                    );
                                }
                            }
                        });

                        return elements;
                    })()}

                    {/* X Axis (Time) */}
                    <line
                        x1={PADDING_LEFT}
                        y1={diagramHeight - PADDING_BOTTOM}
                        x2={diagramWidth - PADDING_RIGHT}
                        y2={diagramHeight - PADDING_BOTTOM}
                        stroke="#888"
                        strokeWidth={1}
                    />

                    {/* X Axis ticks and labels */}
                    {timeTicks.map(t => (
                        <g key={`tick-t-${t}`}>
                            <line
                                x1={timeToX(t)}
                                y1={diagramHeight - PADDING_BOTTOM}
                                x2={timeToX(t)}
                                y2={diagramHeight - PADDING_BOTTOM + 5}
                                stroke="#888"
                            />
                            <text
                                x={timeToX(t)}
                                y={diagramHeight - PADDING_BOTTOM + 18}
                                textAnchor="middle"
                                fill="#888"
                                fontSize="10"
                            >
                                {t}
                            </text>
                        </g>
                    ))}

                    {/* X Axis label */}
                    <text
                        x={diagramWidth / 2}
                        y={diagramHeight - 8}
                        textAnchor="middle"
                        fill="#aaa"
                        fontSize="12"
                    >
                        Temps (s)
                    </text>

                    {/* Y Axis (Distance) */}
                    <line
                        x1={PADDING_LEFT}
                        y1={PADDING_TOP}
                        x2={PADDING_LEFT}
                        y2={diagramHeight - PADDING_BOTTOM}
                        stroke="#888"
                        strokeWidth={1}
                    />

                    {/* Y Axis ticks and labels */}
                    {distanceTicks.map(d => (
                        <g key={`tick-d-${d}`}>
                            <line
                                x1={PADDING_LEFT - 5}
                                y1={distanceToY(d)}
                                x2={PADDING_LEFT}
                                y2={distanceToY(d)}
                                stroke="#888"
                            />
                            <text
                                x={PADDING_LEFT - 8}
                                y={distanceToY(d) + 4}
                                textAnchor="end"
                                fill="#888"
                                fontSize="10"
                            >
                                {d}
                            </text>
                        </g>
                    ))}

                    {/* Y Axis label */}
                    <text
                        x={15}
                        y={diagramHeight / 2}
                        textAnchor="middle"
                        fill="#aaa"
                        fontSize="12"
                        transform={`rotate(-90, 15, ${diagramHeight / 2})`}
                    >
                        Distance (m)
                    </text>
                </svg>
            </div>

            <div className="green-wave-legend">
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#FF9800' }}></div>
                    <span>Groupe 1 (descendant)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#8BC34A' }}></div>
                    <span>Groupe 2 (montant)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-line" style={{ borderColor: '#4CAF50' }}></div>
                    <span>V. montante: {speedUp} km/h</span>
                </div>
                <div className="legend-item">
                    <div className="legend-line" style={{ borderColor: '#FF9800' }}></div>
                    <span>V. descendante: {speedDown} km/h</span>
                </div>
                {bandwidthData?.ascending && (
                    <div className="legend-item">
                        <div className="legend-bandwidth" style={{ background: 'rgba(76, 175, 80, 0.3)', borderColor: '#4CAF50' }}></div>
                        <span>Montant: {bandwidthData.ascending.width.toFixed(1)}s</span>
                    </div>
                )}
                {bandwidthData?.descending && (
                    <div className="legend-item">
                        <div className="legend-bandwidth" style={{ background: 'rgba(255, 152, 0, 0.3)', borderColor: '#FF9800' }}></div>
                        <span>Descendant: {bandwidthData.descending.width.toFixed(1)}s</span>
                    </div>
                )}
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#2E7D32', border: '1px solid #4CAF50' }}></div>
                    <span>Seconde lucarne</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{
                        background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #4CAF50 2px, #4CAF50 4px)',
                        border: '1px solid #4CAF50'
                    }}></div>
                    <span>Ouverture anticipée</span>
                </div>
            </div>

            {/* Parameters panel */}
            <div className="green-wave-params-panel">
                <h3>
                    Tableau des données saisies
                    <button
                        className="btn-add-intersection"
                        onClick={addIntersection}
                        title="Ajouter un carrefour"
                    >+</button>
                </h3>
                <table className="green-wave-data-table">
                    <thead>
                        <tr>
                            <th rowSpan="2">Ordre</th>
                            <th rowSpan="2">Carrefour</th>
                            <th rowSpan="2">PF</th>
                            <th rowSpan="2">Cycle</th>
                            <th colSpan="2" style={{ background: '#3d4a2d' }}>GF Montant</th>
                            <th colSpan="2" style={{ background: '#2d4a2d' }}>GF Descendant</th>
                        </tr>
                        <tr className="sub-header">
                            <th style={{ color: '#4CAF50' }}>Groupe</th>
                            <th style={{ color: '#4CAF50' }}>Dist</th>
                            <th style={{ color: '#FF9800' }}>Groupe</th>
                            <th style={{ color: '#FF9800' }}>Dist</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(() => {
                            // Calculate most common cycle length to detect conflicts
                            const cycleCounts = {};
                            intersections?.forEach(i => {
                                const c = i.cycleLength || 0;
                                cycleCounts[c] = (cycleCounts[c] || 0) + 1;
                            });
                            const mostCommonCycle = Object.entries(cycleCounts)
                                .sort((a, b) => b[1] - a[1])[0]?.[0];
                            const referenceCycle = parseInt(mostCommonCycle) || 0;

                            return intersections?.map((intersection, idx) => {
                                const group1 = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                                const group2 = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                                const hasCycleConflict = intersection.cycleLength !== referenceCycle;

                                return (
                                    <tr key={idx} className={hasCycleConflict ? 'row-cycle-conflict' : ''}>
                                        <td className="col-order">
                                            <div className="order-controls">
                                                <button
                                                    className="btn-move"
                                                    onClick={() => moveIntersection(idx, 'up')}
                                                    disabled={idx === 0}
                                                    title="Monter"
                                                >↑</button>
                                                <span>{idx + 1}</span>
                                                <button
                                                    className="btn-move"
                                                    onClick={() => moveIntersection(idx, 'down')}
                                                    disabled={idx === intersections.length - 1}
                                                    title="Descendre"
                                                >↓</button>
                                            </div>
                                        </td>
                                        <td className="col-name">{intersection.projectName}</td>
                                        <td className="col-pf">
                                            <select
                                                value={intersection.selectedPfId || ''}
                                                onChange={(e) => updateSelectedPf(idx, parseInt(e.target.value))}
                                            >
                                                {intersection.pfTabs?.map(pf => (
                                                    <option key={pf.id} value={pf.id}>
                                                        {pf.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className={`col-cycle ${hasCycleConflict ? 'cycle-conflict' : ''}`} title={hasCycleConflict ? `Cycle différent du cycle de référence (${referenceCycle}s)` : ''}>
                                            {intersection.cycleLength}
                                        </td>
                                    <td className="col-group-select">
                                        <select
                                            value={intersection.selectedGroup2 || ''}
                                            onChange={(e) => updateSelectedGroup2(idx, parseInt(e.target.value))}
                                            style={{ color: '#4CAF50' }}
                                        >
                                            {intersection.groups.map(g => (
                                                <option key={g.id} value={g.id}>
                                                    G{g.id} - {g.name || 'Sans nom'}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="col-distance">
                                        <input
                                            type="number"
                                            value={intersection.distanceG2 ?? intersection.distance}
                                            onChange={(e) => updateDistanceG2(idx, e.target.value)}
                                        />
                                    </td>
                                    <td className="col-group-select">
                                        <select
                                            value={intersection.selectedGroup1 || ''}
                                            onChange={(e) => updateSelectedGroup1(idx, parseInt(e.target.value))}
                                            style={{ color: '#FF9800' }}
                                        >
                                            {intersection.groups.map(g => (
                                                <option key={g.id} value={g.id}>
                                                    G{g.id} - {g.name || 'Sans nom'}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="col-distance">
                                        <input
                                            type="number"
                                            value={intersection.distance}
                                            onChange={(e) => updateDistance(idx, e.target.value)}
                                        />
                                    </td>
                                    </tr>
                                );
                            });
                        })()}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GreenWavePage;
