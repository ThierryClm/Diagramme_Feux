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
    selectedActions = []
}) => {
    const fileInputRef = useRef(null);
    const containerRef = useRef(null);
    const [selectedArrow, setSelectedArrow] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // Animation refs
    const animationRef = useRef(null);
    const lastTimeRef = useRef(null);

    // Handle image upload
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                onImageChange(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle click on image to place arrow
    const handleImageClick = (e) => {
        if (!imageData || isDragging) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Find a group without an arrow yet
        const groupsWithoutArrows = groups.filter(g =>
            !arrows.some(a => a.groupId === g.id)
        );

        if (groupsWithoutArrows.length > 0) {
            const newArrow = {
                id: Date.now(),
                groupId: groupsWithoutArrows[0].id,
                x,
                y,
                rotation: 0 // Rotation in degrees (0 = up)
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

    // Set arrow rotation directly
    const setArrowRotation = (arrowId, rotation) => {
        onArrowsChange(arrows.map(a =>
            a.id === arrowId ? { ...a, rotation: parseInt(rotation) || 0 } : a
        ));
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

    // Render arrow SVG based on courant type
    const renderArrowSVG = (courant, color) => {
        const strokeWidth = 3;
        const size = 32;

        switch (courant) {
            case 'TD': // Tout droit
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàD': // Tourne à droite
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d="M8,24 L8,12 Q8,8 12,8 L26,8" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="20,2 26,8 20,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàG': // Tourne à gauche
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d="M24,24 L24,12 Q24,8 20,8 L6,8" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="12,2 6,8 12,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TDTàD': // Tout droit + Tourne à droite
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
            case 'TDTàG': // Tout droit + Tourne à gauche
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
            case 'Piéton': // Flèche 2 sens (piétons)
            case 'Cycle': // Flèche 2 sens (cyclistes)
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        {/* Flèche vers le haut */}
                        <line x1="16" y1="20" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="10,12 16,6 22,12" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche vers le bas */}
                        <line x1="16" y1="12" x2="16" y2="26" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="10,20 16,26 22,20" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
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
        const greenDuration = group.durations?.green || 0;
        const orangeDuration = group.durations?.orange || 0;

        // Normalize time within cycle
        const normalizedTime = time % effectiveCycleLength;

        // Check for "Seconde lucarne" action for this group
        const secondeLucarneAction = actionData.find(action =>
            action.action === 'Seconde lucarne' &&
            action.gf === String(groupId) &&
            action.deb !== '' &&
            action.fin !== '' &&
            selectedActions.includes(action.id)
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
    }, [groups, simulationResult, cycleLength, actionData, selectedActions, isTimeInRange]);

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
                <h3>Image du carrefour</h3>
                <div className="intersection-controls">
                    {imageData && arrows.length > 0 && (
                        <div className="simulation-controls">
                            <button
                                className={`sim-btn ${isPlaying ? 'playing' : ''}`}
                                onClick={togglePlay}
                                title={isPlaying ? 'Pause' : 'Lecture'}
                            >
                                {isPlaying ? '⏸' : '▶'}
                            </button>
                            <button
                                className="sim-btn reset-btn"
                                onClick={resetAnimation}
                                title="Réinitialiser"
                            >
                                ⏹
                            </button>
                            <input
                                type="range"
                                min="0"
                                max={(simulationResult?.cycleLength || cycleLength) - 1}
                                value={currentTime || 0}
                                onChange={(e) => handleTimeChange(e.target.value)}
                                className="time-slider"
                                title="Position dans le cycle"
                            />
                            <span className="sim-time">
                                {currentTime || 0}s / {simulationResult?.cycleLength || cycleLength}s
                            </span>
                        </div>
                    )}
                    <button
                        className="upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {imageData ? 'Changer' : 'Charger'} image
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                />
            </div>

            <div
                ref={containerRef}
                className="intersection-image-area"
                onClick={handleImageClick}
            >
                {imageData ? (
                    <>
                        <img src={imageData} alt="Carrefour" className="intersection-img" />
                        {arrows.map(arrow => {
                            const groupInfo = getGroupInfo(arrow.groupId);
                            const rotation = arrow.rotation || 0;
                            // Always show color based on current time in simulated diagram
                            const arrowColor = getGroupColorAtTime(arrow.groupId, currentTime || 0);
                            const isHovered = hoveredArrowGroupId === arrow.groupId;
                            const isSideLabel = groupInfo.courant === 'Piéton' || groupInfo.courant === 'Cycle';
                            return (
                                <div
                                    key={arrow.id}
                                    className={`arrow-marker ${selectedArrow === arrow.id ? 'selected' : ''} ${isPlaying ? 'animating' : ''} ${isHovered ? 'hovered' : ''} ${isSideLabel ? 'side-label' : ''}`}
                                    style={{
                                        left: `${arrow.x}%`,
                                        top: `${arrow.y}%`
                                    }}
                                    onMouseDown={(e) => handleArrowMouseDown(e, arrow.id)}
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
                                            transform: `rotate(${rotation}deg)`
                                        }}
                                    >
                                        {renderArrowSVG(groupInfo.courant, arrowColor)}
                                    </div>
                                    <span className="arrow-label">GF{arrow.groupId}</span>
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

            {selectedArrow && (
                <div className="arrow-editor">
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
                            <input
                                type="range"
                                min="0"
                                max="359"
                                value={arrows.find(a => a.id === selectedArrow)?.rotation || 0}
                                onChange={(e) => setArrowRotation(selectedArrow, e.target.value)}
                                className="rotation-slider"
                            />
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
                    <button className="delete-arrow-btn" onClick={() => deleteArrow(selectedArrow)}>
                        Supprimer
                    </button>
                </div>
            )}

            {imageData && (
                <p className="hint">Cliquez sur l'image pour ajouter une flèche. Glissez pour déplacer. Double-clic pour tourner de 45°.</p>
            )}
        </div>
    );
};

export default IntersectionImage;
