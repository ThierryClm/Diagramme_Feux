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
    setHoveredArrowGroupId
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
            return 'rgb(255, 165, 0)'; // Orange
        } else {
            return 'rgb(255, 0, 0)'; // Red
        }
    }, [groups, simulationResult, cycleLength]);

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
                            const arrowColor = (isPlaying || currentTime > 0)
                                ? getGroupColorAtTime(arrow.groupId, currentTime)
                                : '#4ecdc4'; // Default cyan color
                            const isHovered = hoveredArrowGroupId === arrow.groupId;
                            return (
                                <div
                                    key={arrow.id}
                                    className={`arrow-marker ${selectedArrow === arrow.id ? 'selected' : ''} ${isPlaying ? 'animating' : ''} ${isHovered ? 'hovered' : ''}`}
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
                                    <span
                                        className="arrow-symbol"
                                        style={{
                                            transform: `rotate(${rotation}deg)`,
                                            color: arrowColor,
                                            textShadow: `0 0 8px ${arrowColor}, 0 0 12px ${arrowColor}, 0 0 4px #000`
                                        }}
                                    >
                                        ↑
                                    </span>
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
