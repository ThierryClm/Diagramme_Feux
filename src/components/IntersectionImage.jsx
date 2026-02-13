import { useState, useRef, useEffect, useCallback } from 'react';
import './IntersectionImage.css';

const IntersectionImage = ({
    groups,
    imageData,
    onImageChange,
    arrows,
    onArrowsChange,
    cycleLength,
    simulationResult,
    // Animation state (lifted to parent)
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    // Hover state for diagram highlighting
    hoveredArrowGroupId,
    setHoveredArrowGroupId,
    // Action data for special actions simulation
    actionData = [],
    selectedActions = [],
    // Conflict matrix for escamotage cut zones
    conflictMatrix = [],
    // File System Access API for remembering directory
    lastImageDirectoryRef,
    saveDirectoryHandle,
    // Recent directories
    recentImageDirs = [],
    addRecentDirectory,
    // Floating image callback (handled by parent)
    onShowFloatingImage,
    // Project name
    intersectionName,
    // Image brightness/contrast (persisted with project)
    imageBrightness = 100,
    setImageBrightness,
    imageContrast = 100,
    setImageContrast
}) => {
    const fileInputRef = useRef(null);
    const containerRef = useRef(null);
    const [selectedArrow, setSelectedArrow] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showImageMenu, setShowImageMenu] = useState(false);
    const imageMenuRef = useRef(null);

    // Load display options from localStorage
    const [showGroupNumbers, setShowGroupNumbers] = useState(() => {
        const saved = localStorage.getItem('intersection_showGroupNumbers');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [showGroupNames, setShowGroupNames] = useState(() => {
        const saved = localStorage.getItem('intersection_showGroupNames');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [showArrows, setShowArrows] = useState(() => {
        const saved = localStorage.getItem('intersection_showArrows');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [applyToAllSameType, setApplyToAllSameType] = useState(false);

    // Save display options to localStorage when they change
    useEffect(() => {
        localStorage.setItem('intersection_showGroupNumbers', JSON.stringify(showGroupNumbers));
    }, [showGroupNumbers]);

    useEffect(() => {
        localStorage.setItem('intersection_showGroupNames', JSON.stringify(showGroupNames));
    }, [showGroupNames]);

    useEffect(() => {
        localStorage.setItem('intersection_showArrows', JSON.stringify(showArrows));
    }, [showArrows]);

    // Close image menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (imageMenuRef.current && !imageMenuRef.current.contains(e.target)) {
                setShowImageMenu(false);
            }
        };
        if (showImageMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showImageMenu]);

    // Animation refs
    const animationRef = useRef(null);
    const lastTimeRef = useRef(null);

    // Handle image upload via File System Access API
    const handleImageUpload = async (e) => {
        // If called from input element (fallback)
        if (e && e.target && e.target.files) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    onImageChange(event.target.result);
                };
                reader.readAsDataURL(file);
            }
            return;
        }

        // Use File System Access API if available
        if (window.showOpenFilePicker) {
            try {
                const options = {
                    types: [{
                        description: 'Images',
                        accept: {
                            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
                        }
                    }],
                    multiple: false
                };

                // Use last image directory if available
                if (lastImageDirectoryRef?.current) {
                    options.startIn = lastImageDirectoryRef.current;
                }

                const [fileHandle] = await window.showOpenFilePicker(options);
                const file = await fileHandle.getFile();

                // Save directory handle
                try {
                    const dirHandle = await fileHandle.getParent?.();
                    if (dirHandle && lastImageDirectoryRef && saveDirectoryHandle) {
                        lastImageDirectoryRef.current = dirHandle;
                        await saveDirectoryHandle('lastImageDirectory', dirHandle);
                        // Ajouter aux répertoires récents
                        if (addRecentDirectory) {
                            addRecentDirectory('image', dirHandle.name, dirHandle);
                        }
                    }
                } catch (err) {
                    // getParent not always available
                }

                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        onImageChange(event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Erreur sélection image:', err);
                }
            }
        } else {
            // Fallback to input element
            fileInputRef.current?.click();
        }
    };

    // Handle click on image to place arrow
    const handleImageClick = (e) => {
        if (!imageData || isDragging || !showArrows) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Find a group without an arrow yet
        const groupsWithoutArrows = groups.filter(g =>
            !arrows.some(a => a.groupId === g.id)
        );

        if (groupsWithoutArrows.length > 0) {
            const group = groupsWithoutArrows[0];
            const courant = group.courant || '';
            const newArrow = {
                id: Date.now(),
                groupId: group.id,
                x,
                y,
                rotation: 0, // Rotation in degrees (0 = up)
                ...(courant === 'TàD' || courant === 'TàG' ? { turnLength: 0.5 } : {}),
                ...(courant === 'Piéton' || courant === 'Cycle' ? { length: 2 } : {})
            };
            onArrowsChange([...arrows, newArrow]);
            setSelectedArrow(newArrow.id);
        }
    };

    // Handle arrow drag
    const handleArrowMouseDown = (e, arrowId) => {
        e.stopPropagation();
        setSelectedArrow(arrowId);
        setIsDragging(true);

        const handleMouseMove = (moveEvent) => {
            const rect = containerRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / rect.height) * 100));

            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, x, y } : a
            ));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Rotate arrow by 45 degrees
    const rotateArrow = (arrowId) => {
        onArrowsChange(arrows.map(a => {
            if (a.id === arrowId) {
                const newRotation = ((a.rotation || 0) + 45) % 360;
                return { ...a, rotation: newRotation };
            }
            return a;
        }));
    };

    // Helper to get arrows of the same type as the given arrow
    const getArrowsOfSameType = (arrowId) => {
        const arrow = arrows.find(a => a.id === arrowId);
        if (!arrow) return [];
        const arrowCourant = getGroupInfo(arrow.groupId).courant;
        return arrows.filter(a => getGroupInfo(a.groupId).courant === arrowCourant);
    };

    // Set arrow rotation directly
    const setArrowRotation = (arrowId, rotation) => {
        const rotationValue = parseInt(rotation) || 0;
        if (applyToAllSameType) {
            const sameTypeArrows = getArrowsOfSameType(arrowId);
            const sameTypeIds = new Set(sameTypeArrows.map(a => a.id));
            onArrowsChange(arrows.map(a =>
                sameTypeIds.has(a.id) ? { ...a, rotation: rotationValue } : a
            ));
        } else {
            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, rotation: rotationValue } : a
            ));
        }
    };

    // Set arrow scale (zoom)
    const setArrowScale = (arrowId, scale) => {
        const scaleValue = parseFloat(scale) || 1;
        if (applyToAllSameType) {
            const sameTypeArrows = getArrowsOfSameType(arrowId);
            const sameTypeIds = new Set(sameTypeArrows.map(a => a.id));
            onArrowsChange(arrows.map(a =>
                sameTypeIds.has(a.id) ? { ...a, scale: scaleValue } : a
            ));
        } else {
            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, scale: scaleValue } : a
            ));
        }
    };

    // Change arrow's associated group
    const changeArrowGroup = (arrowId, newGroupId) => {
        onArrowsChange(arrows.map(a =>
            a.id === arrowId ? { ...a, groupId: newGroupId } : a
        ));
    };

    // Delete arrow
    const deleteArrow = (arrowId) => {
        onArrowsChange(arrows.filter(a => a.id !== arrowId));
        if (selectedArrow === arrowId) {
            setSelectedArrow(null);
        }
    };

    // Get group info for display
    const getGroupInfo = (groupId) => {
        const group = groups.find(g => g.id === groupId);
        return group ? { name: group.name, courant: group.courant || '' } : { name: '?', courant: '' };
    };

    // Set arrow length (for Piéton/Cycle arrows)
    const setArrowLength = (arrowId, length) => {
        const lengthValue = parseFloat(length) || 1;
        if (applyToAllSameType) {
            const sameTypeArrows = getArrowsOfSameType(arrowId);
            const sameTypeIds = new Set(sameTypeArrows.map(a => a.id));
            onArrowsChange(arrows.map(a =>
                sameTypeIds.has(a.id) ? { ...a, length: lengthValue } : a
            ));
        } else {
            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, length: lengthValue } : a
            ));
        }
    };

    // Set arrow turn length (for TàD/TàG arrows - controls the length of the horizontal part)
    const setArrowTurnLength = (arrowId, turnLength) => {
        const turnLengthValue = parseFloat(turnLength) || 1;
        if (applyToAllSameType) {
            const sameTypeArrows = getArrowsOfSameType(arrowId);
            const sameTypeIds = new Set(sameTypeArrows.map(a => a.id));
            onArrowsChange(arrows.map(a =>
                sameTypeIds.has(a.id) ? { ...a, turnLength: turnLengthValue } : a
            ));
        } else {
            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, turnLength: turnLengthValue } : a
            ));
        }
    };

    // Render arrow SVG based on courant type
    const renderArrowSVG = (courant, color, arrowLength = 1, turnLength = 1) => {
        const strokeWidth = 3;
        const thinStrokeWidth = 2; // Thinner stroke for Piéton/Cycle
        const size = 32;
        // Calculate vertical part length reduction for turn arrows (1 = full, 0.5 = half)
        const verticalReduction = 12 * (1 - turnLength); // Reduce from bottom

        switch (courant) {
            case 'TD': // Tout droit
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàD': // Tourne à droite
                // Reduce horizontal part: full = 26, min = 14 (just after the curve)
                const tadEndX = 14 + (12 * turnLength); // 14 to 26
                const tadArrowX = tadEndX;
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d={`M8,24 L8,12 Q8,8 12,8 L${tadEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${tadArrowX - 6},2 ${tadArrowX},8 ${tadArrowX - 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàG': // Tourne à gauche
                // Reduce horizontal part: full = 6, max = 18 (just after the curve)
                const tagEndX = 18 - (12 * turnLength); // 18 to 6
                const tagArrowX = tagEndX;
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d={`M24,24 L24,12 Q24,8 20,8 L${tagEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${tagArrowX + 6},2 ${tagArrowX},8 ${tagArrowX + 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TDTàD': // Legacy support
            case 'TD-TàD': // Tout droit + Tourne à droite
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        {/* Flèche tout droit */}
                        <line x1="12" y1="28" x2="12" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="6,14 12,8 18,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche tourne à droite */}
                        <path d="M12,20 Q20,20 20,12 L20,8" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="16,12 20,8 24,12" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TDTàG': // Legacy support
            case 'TD-TàG': // Tout droit + Tourne à gauche
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        {/* Flèche tout droit */}
                        <line x1="20" y1="28" x2="20" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="14,14 20,8 26,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche tourne à gauche */}
                        <path d="M20,20 Q12,20 12,12 L12,8" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="8,12 12,8 16,12" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TD_G_D': // Tout droit + Tourne à gauche et à droite
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        {/* Flèche tout droit au centre */}
                        <line x1="16" y1="28" x2="16" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="10,14 16,8 22,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche tourne à gauche */}
                        <path d="M16,20 Q8,20 8,12 L8,10" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="4,14 8,10 12,14" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche tourne à droite */}
                        <path d="M16,20 Q24,20 24,12 L24,10" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="20,14 24,10 28,14" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'Piéton': // Flèche 2 sens (piétons)
            case 'Cycle': // Flèche 2 sens (cyclistes)
                // Calculate extended height based on arrowLength (1 = normal, 2 = double, etc.)
                const extendedHeight = size + (arrowLength - 1) * 24; // Add 24px per unit above 1
                const viewBoxHeight = 32 + (arrowLength - 1) * 24;
                const topY = 6;
                const bottomY = 26 + (arrowLength - 1) * 24;
                const centerY = (topY + bottomY) / 2;
                return (
                    <svg width={size} height={extendedHeight} viewBox={`0 0 32 ${viewBoxHeight}`}>
                        {/* Flèche vers le haut */}
                        <line x1="16" y1={centerY} x2="16" y2={topY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${topY + 5} 16,${topY} 21,${topY + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche vers le bas */}
                        <line x1="16" y1={centerY} x2="16" y2={bottomY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${bottomY - 5} 16,${bottomY} 21,${bottomY - 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            default: // Flèche simple par défaut
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
        }
    };

    // Check if time is within an action's time range (handles wrap-around)
    const isTimeInRange = useCallback((time, start, end, effectiveCycleLength) => {
        const normalizedTime = time % effectiveCycleLength;
        const normalizedStart = parseInt(start);
        const normalizedEnd = parseInt(end);

        if (normalizedEnd > normalizedStart) {
            return normalizedTime >= normalizedStart && normalizedTime < normalizedEnd;
        } else {
            // Wrap-around case
            return normalizedTime >= normalizedStart || normalizedTime < normalizedEnd;
        }
    }, []);

    // Get the color for a group at a specific time
    const getGroupColorAtTime = useCallback((groupId, time) => {
        // Use simulation result if available, otherwise use original groups
        const groupsData = simulationResult?.groups || groups;
        const group = groupsData.find(g => g.id === groupId);

        if (!group) return 'rgb(255, 0, 0)'; // Red by default

        const effectiveCycleLength = simulationResult?.cycleLength || cycleLength;
        const offset = simulationResult ? (group.simulatedOffset ?? group.offset) : group.offset;
        const greenDuration = simulationResult ? (group.simulatedGreen ?? group.durations?.green ?? 0) : (group.durations?.green || 0);
        const orangeDuration = group.durations?.orange || 0;
        const greenCuts = simulationResult ? (group.greenCuts || []) : [];

        // Normalize time within cycle
        const normalizedTime = time % effectiveCycleLength;

        // Check for "Seconde lucarne" action for this group
        // In normal mode (hovering): always show secondes lucarnes
        // In simulation mode: only show if action is selected
        const isSimulationMode = selectedActions && selectedActions.length > 0;
        const secondeLucarneAction = actionData.find(action =>
            action.action === 'Seconde lucarne' &&
            action.gf === String(groupId) &&
            action.deb !== '' &&
            action.fin !== '' &&
            (!isSimulationMode || selectedActions.includes(action.id))
        );

        // Check for "Priorité piétons" action for this group
        const prioritePietonsAction = actionData.find(action =>
            action.action === 'Priorité piétons' &&
            action.gf === String(groupId) &&
            action.deb !== '' &&
            action.fin !== '' &&
            selectedActions.includes(action.id)
        );

        // Check if current time is in "Seconde lucarne" period
        if (secondeLucarneAction) {
            const inSecondeLucarne = isTimeInRange(
                normalizedTime,
                secondeLucarneAction.deb,
                secondeLucarneAction.fin,
                effectiveCycleLength
            );
            if (inSecondeLucarne) {
                return 'rgb(0, 180, 0)'; // Dark green for Seconde lucarne
            }
        }

        // Check if current time is in "Priorité piétons" period
        if (prioritePietonsAction) {
            const inPrioritePietons = isTimeInRange(
                normalizedTime,
                prioritePietonsAction.deb,
                prioritePietonsAction.fin,
                effectiveCycleLength
            );
            if (inPrioritePietons) {
                // Blinking yellow - alternate based on time (every 0.5s = blink)
                const blink = Math.floor(time * 2) % 2 === 0;
                return blink ? 'rgb(255, 255, 0)' : 'rgb(180, 180, 0)'; // Blinking yellow
            }
        }

        // Check for "Escamotage" action where this group is the TARGET (actGf1)
        // When escamotage is active (checked), the target group bar is cut
        const escamotageAction = actionData.find(action =>
            action.action === 'Escamotage' &&
            action.gf &&
            action.actGf1 &&
            parseInt(action.actGf1.toString().replace(/[Gg]/g, '').trim()) === groupId &&
            selectedActions.includes(action.id)
        );

        if (escamotageAction) {
            // Get source group info - use simulated data if available
            const sourceGfId = parseInt(escamotageAction.gf.toString().replace(/[Gg]/g, '').trim()) || 0;
            const sourceGroup = groupsData.find(g => g.id === sourceGfId);

            if (sourceGroup && conflictMatrix && conflictMatrix.length > 0) {
                // Get intergreen times from conflict matrix
                const intergreenSourceToTarget = conflictMatrix[sourceGfId - 1]?.[groupId - 1] || 0;
                const intergreenTargetToSource = conflictMatrix[groupId - 1]?.[sourceGfId - 1] || 0;

                // Source group times - use simulated values if available
                const sourceOffset = simulationResult ? (sourceGroup.simulatedOffset ?? sourceGroup.offset) : sourceGroup.offset;
                const sourceGreen = simulationResult ? (sourceGroup.simulatedGreen ?? sourceGroup.durations?.green ?? 0) : (sourceGroup.durations?.green || 0);
                const sourceStart = sourceOffset % effectiveCycleLength;
                const sourceEndRaw = sourceStart + sourceGreen;
                const sourceEnd = sourceEndRaw === effectiveCycleLength ? effectiveCycleLength : (sourceEndRaw % effectiveCycleLength);

                // Calculate cut zone boundaries
                const cutStart = ((sourceStart - intergreenTargetToSource) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
                const cutEndRaw = sourceEnd + intergreenSourceToTarget;
                const cutEnd = cutEndRaw === effectiveCycleLength ? effectiveCycleLength : (cutEndRaw % effectiveCycleLength);

                // Check if current time is in cut zone
                let isInCutZone = false;
                if (cutStart <= cutEnd) {
                    isInCutZone = normalizedTime >= cutStart && normalizedTime < cutEnd;
                } else {
                    // Wrap-around case
                    isInCutZone = normalizedTime >= cutStart || normalizedTime < cutEnd;
                }

                if (isInCutZone) {
                    // Calculate time elapsed in cut zone
                    const timeInCut = cutStart <= normalizedTime
                        ? normalizedTime - cutStart
                        : (effectiveCycleLength - cutStart + normalizedTime);

                    // Return orange for first orangeDuration seconds, then red
                    if (timeInCut < orangeDuration) {
                        return 'rgb(255, 255, 0)'; // Orange/Yellow
                    } else {
                        return 'rgb(255, 0, 0)'; // Red
                    }
                }
            }
        }

        // Calculate phase boundaries
        const greenStart = offset;
        const greenEnd = (offset + greenDuration) % effectiveCycleLength;
        const orangeEnd = (offset + greenDuration + orangeDuration) % effectiveCycleLength;

        // Check if time is in green phase (handle wrap-around)
        let isGreen = false;
        if (greenEnd > greenStart) {
            isGreen = normalizedTime >= greenStart && normalizedTime < greenEnd;
        } else if (greenDuration > 0) {
            // Wrap-around case
            isGreen = normalizedTime >= greenStart || normalizedTime < greenEnd;
        }

        // If in green phase, check greenCuts (from simulation Escamotage actions)
        if (isGreen && greenCuts.length > 0) {
            for (const cut of greenCuts) {
                const cutDeb = Number(cut.deb);
                const cutFin = Number(cut.fin);
                if (cutDeb <= cutFin) {
                    if (normalizedTime >= cutDeb && normalizedTime < cutFin) {
                        isGreen = false;
                        break;
                    }
                } else {
                    // Wrap-around cut
                    if (normalizedTime >= cutDeb || normalizedTime < cutFin) {
                        isGreen = false;
                        break;
                    }
                }
            }
        }

        // Check if group is escamoted (removed entirely by simulation)
        if (simulationResult && group.isEscamoted) {
            return 'rgb(255, 0, 0)'; // Always red
        }

        // Check if time is in orange phase
        let isOrange = false;
        if (orangeDuration > 0) {
            if (orangeEnd > greenEnd) {
                isOrange = normalizedTime >= greenEnd && normalizedTime < orangeEnd;
            } else if (orangeEnd < greenEnd) {
                // Wrap-around case
                isOrange = normalizedTime >= greenEnd || normalizedTime < orangeEnd;
            }
        }

        if (isGreen) {
            return 'rgb(0, 255, 0)'; // Green
        } else if (isOrange) {
            return 'rgb(255, 255, 0)'; // Yellow (Jaune)
        } else {
            return 'rgb(255, 0, 0)'; // Red
        }
    }, [groups, simulationResult, cycleLength, actionData, selectedActions, isTimeInRange, conflictMatrix]);

    // Animation loop
    useEffect(() => {
        if (isPlaying) {
            lastTimeRef.current = performance.now();

            const animate = (timestamp) => {
                if (lastTimeRef.current === null) {
                    lastTimeRef.current = timestamp;
                }

                const elapsed = timestamp - lastTimeRef.current;

                // Update every second (1000ms)
                if (elapsed >= 1000) {
                    lastTimeRef.current = timestamp;
                    setCurrentTime(prev => {
                        const effectiveCycleLength = simulationResult?.cycleLength || cycleLength;
                        const next = prev + 1;
                        return next >= effectiveCycleLength ? 0 : next;
                    });
                }

                animationRef.current = requestAnimationFrame(animate);
            };

            animationRef.current = requestAnimationFrame(animate);
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, cycleLength, simulationResult]);

    // Toggle play/pause
    const togglePlay = () => {
        if (setIsPlaying) setIsPlaying(prev => !prev);
    };

    // Reset animation
    const resetAnimation = () => {
        if (setIsPlaying) setIsPlaying(false);
        if (setCurrentTime) setCurrentTime(0);
    };

    // Handle time slider change
    const handleTimeChange = (newTime) => {
        if (setCurrentTime) setCurrentTime(parseInt(newTime) || 0);
    };

    return (
        <div className="intersection-image-container">
            <div className="intersection-header">
                <h3>Image du carrefour{intersectionName ? ` — ${intersectionName}` : ''}</h3>
                <div className="intersection-controls">
                    {imageData && onShowFloatingImage && (
                        <button
                            className="upload-btn floating-btn"
                            onClick={onShowFloatingImage}
                        >
                            Incruster image
                        </button>
                    )}
                    <div className="upload-btn-container" ref={imageMenuRef}>
                        <button
                            className="upload-btn"
                            onClick={() => {
                                if (recentImageDirs.length > 0) {
                                    setShowImageMenu(!showImageMenu);
                                } else {
                                    handleImageUpload();
                                }
                            }}
                        >
                            {imageData ? 'Changer' : 'Charger'} image
                            {recentImageDirs.length > 0 && <span className="dropdown-arrow">▼</span>}
                        </button>
                        {showImageMenu && recentImageDirs.length > 0 && (
                            <div className="upload-dropdown">
                                <button onClick={() => { setShowImageMenu(false); handleImageUpload(); }}>
                                    Parcourir...
                                </button>
                                <div className="dropdown-separator" />
                                <div className="dropdown-header">Répertoires récents</div>
                                {recentImageDirs.map((dir, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setShowImageMenu(false);
                                            handleImageUpload();
                                        }}
                                        title={dir.name}
                                    >
                                        {dir.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                />
            </div>

            <div className="intersection-content">
                <div
                    ref={containerRef}
                    className="intersection-image-area"
                    onClick={handleImageClick}
                >
                {imageData ? (
                    <>
                        <img
                            src={imageData}
                            alt="Carrefour"
                            className="intersection-img"
                            style={{ filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%)` }}
                        />
                        {arrows.map(arrow => {
                            const groupInfo = getGroupInfo(arrow.groupId);
                            const rotation = arrow.rotation || 0;
                            const scale = arrow.scale || 1;
                            const arrowLength = arrow.length || 1;
                            const turnLength = arrow.turnLength || 1;
                            // Always show color based on current time in simulated diagram
                            const arrowColor = getGroupColorAtTime(arrow.groupId, currentTime || 0);
                            const isHovered = hoveredArrowGroupId === arrow.groupId;
                            const isPedestrianOrCycle = groupInfo.courant === 'Piéton' || groupInfo.courant === 'Cycle';
                            return (
                                <div
                                    key={arrow.id}
                                    className={`arrow-marker ${selectedArrow === arrow.id ? 'selected' : ''} ${isPlaying ? 'animating' : ''} ${isHovered ? 'hovered' : ''} ${isPedestrianOrCycle ? 'side-label' : ''}`}
                                    style={{
                                        left: `${arrow.x}%`,
                                        top: `${arrow.y}%`
                                    }}
                                    onMouseDown={(e) => handleArrowMouseDown(e, arrow.id)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedArrow(arrow.id);
                                    }}
                                    onMouseEnter={() => setHoveredArrowGroupId && setHoveredArrowGroupId(arrow.groupId)}
                                    onMouseLeave={() => setHoveredArrowGroupId && setHoveredArrowGroupId(null)}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        rotateArrow(arrow.id);
                                    }}
                                    title={`GF${arrow.groupId} - ${groupInfo.courant || 'Sans courant'} - Double-clic pour tourner`}
                                >
                                    <div
                                        className="arrow-symbol"
                                        style={{
                                            transform: `rotate(${rotation}deg) scale(${scale})`
                                        }}
                                    >
                                        {renderArrowSVG(groupInfo.courant, arrowColor, arrowLength, turnLength)}
                                    </div>
                                    {(showGroupNumbers || showGroupNames) && (
                                        <span className="arrow-label">
                                            {showGroupNumbers ? `GF${arrow.groupId}` : ''}
                                            {showGroupNumbers && showGroupNames && groupInfo.name ? ' - ' : ''}
                                            {showGroupNames && groupInfo.name ? groupInfo.name : ''}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </>
                ) : (
                    <div className="no-image-placeholder">
                        <p>Cliquez pour charger une image du carrefour</p>
                        <p className="hint">Format: JPEG, PNG</p>
                    </div>
                )}
                </div>

                {/* Right side: Arrow editor */}
                <div className="intersection-sidebar">
                    {selectedArrow ? (
                        <div className="arrow-editor">
                            <h4>Modifier la flèche</h4>
                            {/* Apply to all same type option */}
                            <label className="checkbox-option apply-all-option">
                                <input
                                    type="checkbox"
                                    checked={applyToAllSameType}
                                    onChange={(e) => setApplyToAllSameType(e.target.checked)}
                                />
                                <span>Appliquer à toutes ({(() => {
                                    const selectedArrowData = arrows.find(a => a.id === selectedArrow);
                                    const courant = selectedArrowData ? getGroupInfo(selectedArrowData.groupId).courant : '';
                                    return courant || '?';
                                })()})</span>
                            </label>
                            <div className="editor-row">
                                <label>Groupe:</label>
                                <select
                                    value={arrows.find(a => a.id === selectedArrow)?.groupId || ''}
                                    onChange={(e) => changeArrowGroup(selectedArrow, parseInt(e.target.value))}
                                >
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>
                                            GF{g.id} - {g.name} {g.courant ? `(${g.courant})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="editor-row">
                                <label>Rotation:</label>
                                <div className="rotation-controls">
                                    <button
                                        className="slider-btn minus"
                                        onClick={() => {
                                            const current = arrows.find(a => a.id === selectedArrow)?.rotation || 0;
                                            setArrowRotation(selectedArrow, (current - 1 + 360) % 360);
                                        }}
                                        title="-1°"
                                    >−</button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="359"
                                        value={arrows.find(a => a.id === selectedArrow)?.rotation || 0}
                                        onChange={(e) => setArrowRotation(selectedArrow, e.target.value)}
                                        className="rotation-slider"
                                    />
                                    <button
                                        className="slider-btn plus"
                                        onClick={() => {
                                            const current = arrows.find(a => a.id === selectedArrow)?.rotation || 0;
                                            setArrowRotation(selectedArrow, (current + 1) % 360);
                                        }}
                                        title="+1°"
                                    >+</button>
                                    <input
                                        type="number"
                                        min="0"
                                        max="359"
                                        value={arrows.find(a => a.id === selectedArrow)?.rotation || 0}
                                        onChange={(e) => setArrowRotation(selectedArrow, e.target.value)}
                                        className="rotation-input"
                                    />
                                    <span className="rotation-unit">°</span>
                                </div>
                            </div>
                            <div className="editor-row">
                                <label>Zoom:</label>
                                <div className="scale-controls">
                                    <button
                                        className="slider-btn minus"
                                        onClick={() => {
                                            const current = arrows.find(a => a.id === selectedArrow)?.scale || 1;
                                            setArrowScale(selectedArrow, Math.max(0.5, current - 0.1).toFixed(1));
                                        }}
                                        title="-0.1"
                                    >−</button>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="3"
                                        step="0.1"
                                        value={arrows.find(a => a.id === selectedArrow)?.scale || 1}
                                        onChange={(e) => setArrowScale(selectedArrow, e.target.value)}
                                        className="scale-slider"
                                    />
                                    <button
                                        className="slider-btn plus"
                                        onClick={() => {
                                            const current = arrows.find(a => a.id === selectedArrow)?.scale || 1;
                                            setArrowScale(selectedArrow, Math.min(3, current + 0.1).toFixed(1));
                                        }}
                                        title="+0.1"
                                    >+</button>
                                    <input
                                        type="number"
                                        min="0.5"
                                        max="3"
                                        step="0.1"
                                        value={arrows.find(a => a.id === selectedArrow)?.scale || 1}
                                        onChange={(e) => setArrowScale(selectedArrow, e.target.value)}
                                        className="scale-input"
                                    />
                                    <span className="scale-unit">x</span>
                                </div>
                            </div>
                            {/* Length option - only for Piéton/Cycle arrows */}
                            {(() => {
                                const selectedArrowData = arrows.find(a => a.id === selectedArrow);
                                const selectedGroupInfo = selectedArrowData ? getGroupInfo(selectedArrowData.groupId) : null;
                                const isPedOrCycle = selectedGroupInfo && (selectedGroupInfo.courant === 'Piéton' || selectedGroupInfo.courant === 'Cycle');
                                return isPedOrCycle ? (
                                    <div className="editor-row">
                                        <label>Longueur:</label>
                                        <div className="length-controls">
                                            <input
                                                type="range"
                                                min="1"
                                                max="4"
                                                step="0.5"
                                                value={selectedArrowData?.length || 1}
                                                onChange={(e) => setArrowLength(selectedArrow, e.target.value)}
                                                className="length-slider"
                                            />
                                            <input
                                                type="number"
                                                min="1"
                                                max="4"
                                                step="0.5"
                                                value={selectedArrowData?.length || 1}
                                                onChange={(e) => setArrowLength(selectedArrow, e.target.value)}
                                                className="length-input"
                                            />
                                            <span className="length-unit">x</span>
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                            {/* Turn length option - only for TàD/TàG arrows */}
                            {(() => {
                                const selectedArrowData = arrows.find(a => a.id === selectedArrow);
                                const selectedGroupInfo = selectedArrowData ? getGroupInfo(selectedArrowData.groupId) : null;
                                const isTurnArrow = selectedGroupInfo && (selectedGroupInfo.courant === 'TàD' || selectedGroupInfo.courant === 'TàG');
                                return isTurnArrow ? (
                                    <div className="editor-row">
                                        <label>Retour:</label>
                                        <div className="turn-length-controls">
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={selectedArrowData?.turnLength || 1}
                                                onChange={(e) => setArrowTurnLength(selectedArrow, e.target.value)}
                                                className="turn-length-slider"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={selectedArrowData?.turnLength || 1}
                                                onChange={(e) => setArrowTurnLength(selectedArrow, e.target.value)}
                                                className="turn-length-input"
                                            />
                                            <span className="turn-length-unit">x</span>
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                            <button className="delete-arrow-btn" onClick={() => deleteArrow(selectedArrow)}>
                                Supprimer
                            </button>
                        </div>
                    ) : showArrows ? (
                        <div className="no-selection-hint">
                            <p>Cliquez sur l'image pour ajouter une flèche</p>
                            <p>Sélectionnez une flèche pour la modifier</p>
                        </div>
                    ) : null}

                    {/* Display options */}
                    <div className="display-options">
                        <label className="checkbox-option">
                            <input
                                type="checkbox"
                                checked={showGroupNumbers}
                                onChange={(e) => setShowGroupNumbers(e.target.checked)}
                            />
                            <span>Afficher n° des groupes</span>
                        </label>
                        <label className="checkbox-option">
                            <input
                                type="checkbox"
                                checked={showGroupNames}
                                onChange={(e) => setShowGroupNames(e.target.checked)}
                            />
                            <span>Afficher noms des groupes</span>
                        </label>
                        <label className="checkbox-option">
                            <input
                                type="checkbox"
                                checked={showArrows}
                                onChange={(e) => setShowArrows(e.target.checked)}
                            />
                            <span>Ajout de flèches</span>
                        </label>
                    </div>
                    {imageData && setImageBrightness && (
                        <div className="image-filters">
                            <div className="filter-row">
                                <label>Luminosité:</label>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    value={imageBrightness}
                                    onChange={(e) => setImageBrightness(Number(e.target.value))}
                                    className="filter-slider"
                                />
                                <span className="filter-value">{imageBrightness}%</span>
                            </div>
                            <div className="filter-row">
                                <label>Contraste:</label>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    value={imageContrast}
                                    onChange={(e) => setImageContrast(Number(e.target.value))}
                                    className="filter-slider"
                                />
                                <span className="filter-value">{imageContrast}%</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {imageData && (
                <p className="hint">Glissez pour déplacer. Double-clic pour tourner de 45°.</p>
            )}
        </div>
    );
};

export default IntersectionImage;
