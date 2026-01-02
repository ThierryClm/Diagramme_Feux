import { useState, useEffect, useMemo } from 'react';
import { useTrafficLight } from './hooks/useTrafficLight';
import TimelineDiagram from './components/TimelineDiagram';
import GroupTable from './components/GroupTable';
import TrafficTable from './components/TrafficTable';
import IntergreenMatrix from './components/IntergreenMatrix';
import ActionTable from './components/ActionTable';
import IntersectionImage from './components/IntersectionImage';
import MenuBar from './components/MenuBar';
import Modal from './components/Modal';
import CreateGreenWaveDialog from './components/CreateGreenWaveDialog';
import GreenWaveViewer from './components/GreenWaveViewer';
import SimulationPanel from './components/SimulationPanel';
import PhasageBulle from './components/PhasageBulle';
import { calculateSimulatedDiagram } from './utils/simulationCalculator';

import './components/GroupTable.css';
import './components/IntergreenMatrix.css';
import './App.css';

function App() {
    const {
        intersectionName,
        setIntersectionName,
        groups,
        setGroupCount,
        cycleLength,
        setCycleLength,
        setMatrixValue,
        conflictMatrix,
        conflicts,
        globalTime,
        getGroupState,
        updateGroupParams,
        moveGroupToPosition,
        saveProject,
        loadProject,
        getAllSaves,
        getProjectData,
        deleteSave,
        getFullState,
        loadFullState,
        actionData,
        updateActionRow,
        reorderActions,
        pfTabs,
        activePFId,
        setActivePFId,
        duplicatePF,
        deletePF,
        renamePF,
        undo,
        redo,
        canUndo,
        canRedo,
        startDrag,
        endDrag,
        slideAllGroups,
        insertTime,
        simulationEnabled,
        setSimulationEnabled,
        simulationSelectedActions,
        toggleSimulationAction,
        selectAllSimulationActions,
        deselectAllSimulationActions,
        intersectionImage,
        setIntersectionImage,
        intersectionArrows,
        setIntersectionArrows
    } = useTrafficLight();

    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(10);
    const [activeTab, setActiveTab] = useState('config'); // 'config', 'traffic'
    const [showDependencies, setShowDependencies] = useState(false);
    const [hoveredActionId, setHoveredActionId] = useState(null);

    // Intersection image animation state
    const [isPlayingSimulation, setIsPlayingSimulation] = useState(false);
    const [simulationCurrentTime, setSimulationCurrentTime] = useState(0);
    const [hoveredArrowGroupId, setHoveredArrowGroupId] = useState(null);

    // Phasage bulle state
    const [phasageBulleEnabled, setPhasageBulleEnabled] = useState(false);
    const [phasageBulleModal, setPhasageBulleModal] = useState(false);
    const [phasageBulleTimes, setPhasageBulleTimes] = useState([0, 15, 30, 45, 60, 75]);
    const [phasageBulleCount, setPhasageBulleCount] = useState(4);
    const [phasageBulleVisibleGroups, setPhasageBulleVisibleGroups] = useState(new Set());
    const [phasageBulleVersion, setPhasageBulleVersion] = useState(0);

    // Calculate simulated diagram when in simulation mode
    const simulationResult = useMemo(() => {
        if (!simulationEnabled) return null;
        return calculateSimulatedDiagram(
            groups,
            actionData,
            simulationSelectedActions,
            cycleLength,
            conflictMatrix
        );
    }, [simulationEnabled, groups, actionData, simulationSelectedActions, cycleLength, conflictMatrix]);

    // Local input states for validation on Enter/blur
    const [groupCountInput, setGroupCountInput] = useState(groups.length.toString());
    const [cycleLengthInput, setCycleLengthInput] = useState(cycleLength.toString());

    // Initialize visible groups when entering phasage bulle mode
    useEffect(() => {
        if (phasageBulleEnabled && phasageBulleVisibleGroups.size === 0) {
            // By default, show all groups that have arrows
            const arrowGroupIds = new Set(intersectionArrows.map(a => a.groupId));
            setPhasageBulleVisibleGroups(arrowGroupIds);
        }
    }, [phasageBulleEnabled, intersectionArrows]);

    // Toggle group visibility in phasage bulle
    const togglePhasageBulleGroup = (groupId) => {
        setPhasageBulleVisibleGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
    };

    // Sync local inputs when actual values change (e.g., after undo/redo or project load)
    useEffect(() => {
        setGroupCountInput(groups.length.toString());
    }, [groups.length]);

    useEffect(() => {
        setCycleLengthInput(cycleLength.toString());
    }, [cycleLength]);

    // Modal states
    const [openModal, setOpenModal] = useState(false);
    const [slideModal, setSlideModal] = useState(false);
    const [insertModal, setInsertModal] = useState(false);
    const [optionsModal, setOptionsModal] = useState(false);
    const [helpModal, setHelpModal] = useState(false);
    const [importModal, setImportModal] = useState(false);
    const [slideValue, setSlideValue] = useState(0);
    const [insertStart, setInsertStart] = useState(0);
    const [insertDuration, setInsertDuration] = useState(5);
    const [selectedProject, setSelectedProject] = useState(null);
    const [importFile, setImportFile] = useState(null);
    const [importError, setImportError] = useState('');

    // Green wave states
    const [createGreenWaveModal, setCreateGreenWaveModal] = useState(false);
    const [openGreenWaveModal, setOpenGreenWaveModal] = useState(false);
    const [selectedGreenWave, setSelectedGreenWave] = useState(null);
    const [greenWaveViewer, setGreenWaveViewer] = useState(false);
    const [greenWaveData, setGreenWaveData] = useState(null);
    const [greenWaveListKey, setGreenWaveListKey] = useState(0);

    // Print preview states
    const [printPreviewModal, setPrintPreviewModal] = useState(false);
    const [printType, setPrintType] = useState(null); // 'matrix', 'form', 'diagram'

    // Move group modal states
    const [moveGroupModal, setMoveGroupModal] = useState(false);
    const [groupToMove, setGroupToMove] = useState('');
    const [moveAfterGroup, setMoveAfterGroup] = useState('0'); // '0' means at the beginning

    // Get all saved green waves (sorted by most recent first)
    const getSavedGreenWaves = () => {
        try {
            const saved = localStorage.getItem('savedGreenWaves');
            if (saved) {
                const greenWaves = JSON.parse(saved);
                return Object.keys(greenWaves)
                    .map(name => ({
                        name,
                        ...greenWaves[name]
                    }))
                    .sort((a, b) => {
                        // Sort by savedAt date, most recent first
                        const dateA = a.savedAt ? new Date(a.savedAt) : new Date(0);
                        const dateB = b.savedAt ? new Date(b.savedAt) : new Date(0);
                        return dateB - dateA;
                    });
            }
        } catch (e) {
            console.error('Failed to get saved green waves', e);
        }
        return [];
    };

    // Format date for display
    const formatDate = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
    };

    // Delete a saved green wave
    const deleteGreenWave = (name) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'onde verte "${name}" ?`)) {
            return;
        }
        try {
            const saved = localStorage.getItem('savedGreenWaves');
            if (saved) {
                const greenWaves = JSON.parse(saved);
                delete greenWaves[name];
                localStorage.setItem('savedGreenWaves', JSON.stringify(greenWaves));
                if (selectedGreenWave === name) {
                    setSelectedGreenWave(null);
                }
                // Force list refresh
                setGreenWaveListKey(prev => prev + 1);
            }
        } catch (e) {
            console.error('Failed to delete green wave', e);
        }
    };

    // Check for duplicated state on load
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const duplicateId = urlParams.get('duplicate');
        if (duplicateId) {
            const savedState = sessionStorage.getItem(`duplicate_${duplicateId}`);
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    loadFullState(state);
                    // Clean up
                    sessionStorage.removeItem(`duplicate_${duplicateId}`);
                    // Remove the URL parameter
                    window.history.replaceState({}, '', window.location.pathname);
                } catch (e) {
                    console.error('Failed to load duplicated state', e);
                }
            }
        }
    }, []);

    // Menu action handler
    const handleMenuAction = (action) => {
        switch (action) {
            case 'new':
                if (confirm('Créer un nouveau projet ? Les modifications non enregistrées seront perdues.')) {
                    window.location.reload();
                }
                break;
            case 'open':
                setSelectedProject(null);
                setOpenModal(true);
                break;
            case 'save':
                const name = prompt('Nom du projet:', intersectionName || 'Mon projet');
                if (name) {
                    saveProject(name);
                }
                break;
            case 'printMatrix':
                setPrintType('matrix');
                setPrintPreviewModal(true);
                break;
            case 'printForm':
                setPrintType('form');
                setPrintPreviewModal(true);
                break;
            case 'printDiagram':
                setPrintType('diagram');
                setPrintPreviewModal(true);
                break;
            case 'close':
                window.close();
                break;
            case 'duplicate':
                duplicatePF();
                break;
            case 'moveGroup':
                if (groups.length > 1) {
                    setGroupToMove(groups[0]?.id?.toString() || '');
                    setMoveAfterGroup('0');
                    setMoveGroupModal(true);
                } else {
                    alert('Il faut au moins 2 groupes pour effectuer un déplacement.');
                }
                break;
            case 'slide':
                setSlideValue(0);
                setSlideModal(true);
                break;
            case 'insert':
                setInsertStart(0);
                setInsertDuration(5);
                setInsertModal(true);
                break;
            case 'options':
                setOptionsModal(true);
                break;
            case 'help':
                setHelpModal(true);
                break;
            case 'import':
                setImportFile(null);
                setImportError('');
                setImportModal(true);
                break;
            case 'credit':
                alert('Diagramme de Feux\n\nDéveloppé avec React + Vite\n2024');
                break;
            // Green wave actions
            case 'createGreenWave':
                setCreateGreenWaveModal(true);
                break;
            case 'openGreenWave':
                setOpenGreenWaveModal(true);
                setSelectedGreenWave(null);
                break;
            case 'closeGreenWave':
                setGreenWaveViewer(false);
                setGreenWaveData(null);
                break;
            default:
                console.log('Action non implémentée:', action);
        }
    };

    // Handle green wave creation - opens in new tab
    const handleCreateGreenWave = (intersections) => {
        // Generate unique ID
        const greenWaveId = Date.now().toString();

        // Save data to sessionStorage
        sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(intersections));

        // Open new tab with green wave page
        window.open(`${window.location.pathname}?greenwave&id=${greenWaveId}`, '_blank');

        setCreateGreenWaveModal(false);
    };

    // Handle opening a saved green wave
    const handleOpenSavedGreenWave = () => {
        if (!selectedGreenWave) return;

        try {
            const saved = localStorage.getItem('savedGreenWaves');
            if (saved) {
                const greenWaves = JSON.parse(saved);
                const greenWaveData = greenWaves[selectedGreenWave];

                if (greenWaveData && greenWaveData.intersections) {
                    // Generate unique ID
                    const greenWaveId = Date.now().toString();

                    // Save data to sessionStorage
                    sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(greenWaveData.intersections));

                    // Also save additional settings
                    sessionStorage.setItem(`greenwave_settings_${greenWaveId}`, JSON.stringify({
                        name: selectedGreenWave,
                        speed: greenWaveData.speed, // Backward compatibility
                        speedUp: greenWaveData.speedUp,
                        speedDown: greenWaveData.speedDown,
                        pixelsPerSecond: greenWaveData.pixelsPerSecond,
                        pixelsPerMeter: greenWaveData.pixelsPerMeter
                    }));

                    // Open new tab with green wave page
                    window.open(`${window.location.pathname}?greenwave&id=${greenWaveId}`, '_blank');

                    setOpenGreenWaveModal(false);
                    setSelectedGreenWave(null);
                }
            }
        } catch (e) {
            console.error('Failed to open green wave', e);
            alert('Erreur lors de l\'ouverture de l\'onde verte');
        }
    };

    // Handle project selection from open modal
    const handleOpenProject = () => {
        if (selectedProject) {
            loadProject(selectedProject);
            setOpenModal(false);
            setSelectedProject(null);
        }
    };

    // Handle slide confirmation
    const handleSlide = () => {
        if (slideValue !== 0) {
            slideAllGroups(slideValue);
        }
        setSlideModal(false);
    };

    // Handle insert confirmation
    const handleInsert = () => {
        if (insertDuration > 0) {
            insertTime(insertStart, insertDuration);
        }
        setInsertModal(false);
    };

    // Handle file selection for import
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImportFile(file);
            setImportError('');
        }
    };

    // Handle CSV import
    const handleImport = () => {
        if (!importFile) {
            setImportError('Veuillez sélectionner un fichier');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const lines = content.split('\n').filter(line => line.trim());

                if (lines.length < 2) {
                    setImportError('Le fichier CSV est vide ou invalide');
                    return;
                }

                // Parse header
                const header = lines[0].split(';').map(h => h.trim().toLowerCase());

                // Parse data rows
                const importedGroups = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(';');
                    if (values.length < 2) continue;

                    const row = {};
                    header.forEach((col, idx) => {
                        row[col] = values[idx]?.trim() || '';
                    });

                    // Map CSV columns to group structure
                    const group = {
                        id: importedGroups.length + 1,
                        name: row['nom'] || row['name'] || `G${importedGroups.length + 1}`,
                        type: row['type'] || 'VL',
                        minGreen: parseInt(row['minvert'] || row['mingreen'] || row['min']) || 6,
                        offset: parseInt(row['debut'] || row['offset'] || row['deb']) || 0,
                        durations: {
                            green: parseInt(row['vert'] || row['green'] || row['duree'] || row['dur']) || 0,
                            orange: parseInt(row['orange'] || row['jaune']) || 3,
                            red: parseInt(row['rouge'] || row['red']) || 0
                        }
                    };
                    importedGroups.push(group);
                }

                if (importedGroups.length === 0) {
                    setImportError('Aucune donnée valide trouvée dans le fichier');
                    return;
                }

                // Load the imported data
                const projectName = importFile.name.replace(/\.csv$/i, '');
                loadFullState({
                    intersectionName: projectName,
                    groups: importedGroups,
                    cycleLength: cycleLength
                });

                setImportModal(false);
                setImportFile(null);
                setImportError('');
            } catch (err) {
                setImportError('Erreur lors de la lecture du fichier: ' + err.message);
            }
        };
        reader.onerror = () => {
            setImportError('Erreur lors de la lecture du fichier');
        };
        reader.readAsText(importFile);
    };

    // Keyboard shortcuts for undo (Ctrl+Z) and redo (Ctrl+Y or Ctrl+Shift+Z)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    return (
        <div className="app-container">
            <MenuBar onAction={handleMenuAction} />
            <header className="app-header">
                <div className="header-inputs">
                    <input
                        className="input-name"
                        type="text"
                        value={intersectionName}
                        onChange={(e) => setIntersectionName(e.target.value)}
                        placeholder="Nom du Carrefour"
                    />
                    <label>
                        Groupes:
                        <input
                            type="number"
                            min="1" max="32"
                            value={groupCountInput}
                            onChange={(e) => setGroupCountInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.target.blur();
                                }
                            }}
                            onBlur={() => {
                                const newCount = parseInt(groupCountInput);
                                if (!isNaN(newCount) && newCount >= 1 && newCount <= 32 && newCount !== groups.length) {
                                    setGroupCount(newCount);
                                } else {
                                    setGroupCountInput(groups.length.toString());
                                }
                            }}
                            className="input-count"
                        />
                    </label>
                    <label>
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
                    </label>
                    <label style={{ marginLeft: '1rem', color: '#aaa', fontSize: '0.9em' }}>
                        Zoom:
                        <input
                            type="range"
                            min="3" max="50"
                            value={pixelsPerSecond}
                            onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))}
                            style={{ verticalAlign: 'middle', margin: '0 5px' }}
                        />
                        {pixelsPerSecond}px/s
                    </label>
                </div>

                <div className="header-actions">
                    <button
                        className="undo-btn"
                        onClick={undo}
                        disabled={!canUndo}
                        title="Annuler (Ctrl+Z)"
                    >
                        ↶ Annuler
                    </button>
                    <button
                        className="undo-btn"
                        onClick={redo}
                        disabled={!canRedo}
                        title="Refaire (Ctrl+Y)"
                    >
                        ↷ Refaire
                    </button>
                    <button
                        className={`toggle-btn ${showDependencies ? 'active' : ''}`}
                        onClick={() => setShowDependencies(!showDependencies)}
                        title="Afficher/masquer les temps de dégagement"
                    >
                        ⟷ Dépendance
                    </button>
                    <button
                        className="toggle-btn phasage-btn"
                        onClick={() => setPhasageBulleModal(true)}
                        title="Configurer les instants du phasage bulle"
                    >
                        ◉ Phasage bulle
                    </button>
                </div>

                <div className="status-bar">
                    {conflicts.length > 0 ? (
                        <div className="status-error">
                            {conflicts.length} CONFLITS !
                        </div>
                    ) : (
                        <div className="status-ok">Valide</div>
                    )}
                </div>
            </header>

            <main className="split-view">
                <aside className="sidebar">
                    {phasageBulleEnabled ? (
                        <div className="phasage-bulle-sidebar">
                            <div className="sidebar-header">
                                <h3>Groupe de feux</h3>
                                <p className="sidebar-subtitle">Sélectionnez les groupes à afficher</p>
                            </div>
                            <div className="phasage-group-list">
                                {groups.map(g => {
                                    const hasArrow = intersectionArrows.some(a => a.groupId === g.id);
                                    const isVisible = phasageBulleVisibleGroups.has(g.id);
                                    return (
                                        <label
                                            key={g.id}
                                            className={`phasage-group-item ${isVisible ? 'checked' : ''} ${!hasArrow ? 'no-arrow' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isVisible}
                                                onChange={() => togglePhasageBulleGroup(g.id)}
                                                disabled={!hasArrow}
                                            />
                                            <span className="phasage-group-id">GF{g.id}</span>
                                            <span className="phasage-group-name">{g.name || '-'}</span>
                                            <span className="phasage-group-courant">{g.courant || '-'}</span>
                                            {!hasArrow && (
                                                <span className="phasage-no-arrow-hint" title="Aucune flèche définie pour ce groupe">∅</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="phasage-group-actions">
                                <button
                                    className="phasage-btn-select-all"
                                    onClick={() => {
                                        const allArrowGroups = new Set(intersectionArrows.map(a => a.groupId));
                                        setPhasageBulleVisibleGroups(allArrowGroups);
                                    }}
                                >
                                    Tout cocher
                                </button>
                                <button
                                    className="phasage-btn-deselect-all"
                                    onClick={() => setPhasageBulleVisibleGroups(new Set())}
                                >
                                    Tout décocher
                                </button>
                            </div>
                        </div>
                    ) : simulationEnabled ? (
                        <SimulationPanel
                            actionData={actionData}
                            selectedActions={simulationSelectedActions}
                            onToggle={toggleSimulationAction}
                            onSelectAll={selectAllSimulationActions}
                            onDeselectAll={deselectAllSimulationActions}
                            groups={groups}
                            cycleLength={cycleLength}
                            conflictMatrix={conflictMatrix}
                            hoveredActionId={hoveredActionId}
                            setHoveredActionId={setHoveredActionId}
                        />
                    ) : (
                        <>
                            <div className="sidebar-tabs">
                                <button
                                    className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('config')}
                                >
                                    Configuration
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'traffic' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('traffic')}
                                >
                                    Trafic
                                </button>
                            </div>

                            {activeTab === 'config' && (
                                <>
                                    <GroupTable
                                        groups={groups}
                                        updateGroupParams={updateGroupParams}
                                        cycleLength={cycleLength}
                                    />
                                    <div style={{ marginTop: '2rem' }}>
                                        <IntergreenMatrix
                                            conflictMatrix={conflictMatrix}
                                            setMatrixValue={setMatrixValue}
                                            groups={groups}
                                            cycleLength={cycleLength}
                                            actionData={actionData}
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === 'traffic' && (
                                <TrafficTable
                                    groups={groups}
                                    updateGroupParams={updateGroupParams}
                                    cycleLength={cycleLength}
                                />
                            )}

                            {conflicts.length > 0 && (
                                <div className="conflict-list">
                                    <h4>Conflits:</h4>
                                    <ul>
                                        {conflicts.map((c, i) => (
                                            <li key={i}>
                                                {c.type === 'intergreen' ? (
                                                    <>GF{c.from} → GF{c.to} : Dégagement insuffisant ({c.actual.toFixed(1)}s / {c.required}s requis)</>
                                                ) : (
                                                    <>GF{c.from} ↔ GF{c.to} : {c.message}</>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </aside>

                <section className="diagram-area" style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* PF Tabs */}
                    <div className="pf-tabs-bar">
                        {pfTabs.map((pf) => (
                            <div
                                key={pf.id}
                                className={`pf-tab ${activePFId === pf.id && !simulationEnabled && !phasageBulleEnabled ? 'active' : ''}`}
                                onClick={() => {
                                    setSimulationEnabled(false);
                                    setPhasageBulleEnabled(false);
                                    setActivePFId(pf.id);
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    const newName = prompt('Nouveau nom de l\'onglet:', pf.name);
                                    if (newName && newName.trim() !== '') {
                                        renamePF(pf.id, newName.trim());
                                    }
                                }}
                                title="Double-cliquez pour renommer"
                            >
                                <span className="pf-tab-name">{pf.name}</span>
                                {pfTabs.length > 1 && (
                                    <button
                                        className="pf-tab-close"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'onglet "${pf.name}" ?\nCette action est irréversible.`)) {
                                                deletePF(pf.id);
                                            }
                                        }}
                                        title="Fermer cet onglet"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <div
                            className={`pf-tab simulation-tab ${simulationEnabled && !phasageBulleEnabled ? 'active' : ''}`}
                            onClick={() => {
                                setPhasageBulleEnabled(false);
                                setSimulationEnabled(!simulationEnabled);
                            }}
                            title="Activer/désactiver le mode simulation"
                        >
                            <span className="pf-tab-name">Simulation</span>
                        </div>
                        <div
                            className={`pf-tab phasage-tab ${phasageBulleEnabled ? 'active' : ''}`}
                            onClick={() => {
                                setSimulationEnabled(false);
                                setPhasageBulleEnabled(!phasageBulleEnabled);
                            }}
                            title="Afficher le phasage en bulles"
                        >
                            <span className="pf-tab-name">Phasage bulle</span>
                        </div>
                    </div>

                    {!phasageBulleEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <TimelineDiagram
                                groups={groups}
                                globalTime={globalTime}
                                getGroupState={getGroupState}
                                onGroupClick={(g) => setSelectedGroupId(g.id)}
                                pixelsPerSecond={pixelsPerSecond}
                                conflicts={conflicts}
                                conflictMatrix={conflictMatrix}
                                updateGroupParams={updateGroupParams}
                                cycleLength={cycleLength}
                                actionData={actionData}
                                updateActionRow={updateActionRow}
                                startDrag={startDrag}
                                endDrag={endDrag}
                                showDependencies={showDependencies}
                                hoveredActionId={hoveredActionId}
                                setHoveredActionId={setHoveredActionId}
                                simulationFilter={simulationEnabled ? new Set(simulationSelectedActions) : null}
                                simulationResult={simulationResult}
                                simulationCurrentTime={simulationEnabled ? simulationCurrentTime : null}
                                isPlayingSimulation={simulationEnabled && isPlayingSimulation}
                                hoveredArrowGroupId={hoveredArrowGroupId}
                            />
                        </div>
                    )}

                    <div style={{ borderTop: phasageBulleEnabled ? 'none' : '1px solid #333', marginTop: phasageBulleEnabled ? 0 : '1rem' }}>
                        {phasageBulleEnabled ? (
                            <PhasageBulle
                                key={phasageBulleVersion}
                                groups={groups}
                                cycleLength={cycleLength}
                                intersectionImage={intersectionImage}
                                intersectionArrows={intersectionArrows.filter(a => phasageBulleVisibleGroups.has(a.groupId))}
                                simulationResult={simulationResult}
                                actionData={actionData}
                                selectedActions={simulationSelectedActions}
                                intersectionName={intersectionName}
                                initialTimes={phasageBulleTimes}
                                initialCount={phasageBulleCount}
                            />
                        ) : simulationEnabled ? (
                            <IntersectionImage
                                groups={groups}
                                imageData={intersectionImage}
                                onImageChange={setIntersectionImage}
                                arrows={intersectionArrows}
                                onArrowsChange={setIntersectionArrows}
                                cycleLength={cycleLength}
                                simulationResult={simulationResult}
                                isPlaying={isPlayingSimulation}
                                setIsPlaying={setIsPlayingSimulation}
                                currentTime={simulationCurrentTime}
                                setCurrentTime={setSimulationCurrentTime}
                                hoveredArrowGroupId={hoveredArrowGroupId}
                                setHoveredArrowGroupId={setHoveredArrowGroupId}
                                actionData={actionData}
                                selectedActions={simulationSelectedActions}
                            />
                        ) : (
                            <ActionTable
                                actionData={actionData}
                                updateActionRow={updateActionRow}
                                reorderActions={reorderActions}
                                cycleLength={cycleLength}
                                maxGroup={groups.length}
                                hoveredActionId={hoveredActionId}
                                setHoveredActionId={setHoveredActionId}
                            />
                        )}
                    </div>
                </section>
            </main>

            {/* Modal Ouvrir */}
            <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Ouvrir un projet">
                {getAllSaves().length > 0 ? (
                    <>
                        <div className="project-list-container">
                            <ul className="project-list">
                                {getAllSaves().map((projectName) => (
                                    <li
                                        key={projectName}
                                        className={selectedProject === projectName ? 'selected' : ''}
                                        onClick={() => setSelectedProject(projectName)}
                                        onDoubleClick={() => {
                                            setSelectedProject(projectName);
                                            loadProject(projectName);
                                            setOpenModal(false);
                                            setSelectedProject(null);
                                        }}
                                    >
                                        <span className="project-icon"></span>
                                        <span className="project-name">{projectName}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-secondary" onClick={() => setOpenModal(false)}>
                                Annuler
                            </button>
                            <button
                                className="modal-btn modal-btn-primary"
                                onClick={handleOpenProject}
                                disabled={!selectedProject}
                            >
                                Ouvrir
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="no-projects">Aucun projet sauvegardé</p>
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-secondary" onClick={() => setOpenModal(false)}>
                                Fermer
                            </button>
                        </div>
                    </>
                )}
            </Modal>

            {/* Modal Glisser */}
            <Modal isOpen={slideModal} onClose={() => setSlideModal(false)} title="Glisser le diagramme">
                <div className="form-row">
                    <label>
                        Décalage (secondes) :
                        <input
                            type="number"
                            value={slideValue}
                            onChange={(e) => setSlideValue(parseInt(e.target.value) || 0)}
                        />
                    </label>
                    <p style={{ color: '#888', fontSize: '0.85em', marginTop: '8px' }}>
                        Valeur positive : décale vers la droite<br />
                        Valeur négative : décale vers la gauche
                    </p>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setSlideModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleSlide}>
                        Appliquer
                    </button>
                </div>
            </Modal>

            {/* Modal Inserer */}
            <Modal isOpen={insertModal} onClose={() => setInsertModal(false)} title="Insérer une plage">
                <div className="form-row">
                    <label>
                        À partir de la seconde :
                        <input
                            type="number"
                            min="0"
                            max={cycleLength}
                            value={insertStart}
                            onChange={(e) => setInsertStart(parseInt(e.target.value) || 0)}
                        />
                    </label>
                </div>
                <div className="form-row">
                    <label>
                        Durée à insérer (secondes) :
                        <input
                            type="number"
                            min="1"
                            value={insertDuration}
                            onChange={(e) => setInsertDuration(parseInt(e.target.value) || 1)}
                        />
                    </label>
                </div>
                <p style={{ color: '#888', fontSize: '0.85em', marginTop: '8px' }}>
                    Tous les groupes commençant après la seconde {insertStart} seront décalés de {insertDuration}s.<br />
                    La durée du cycle passera de {cycleLength}s à {cycleLength + insertDuration}s.
                </p>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setInsertModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleInsert}>
                        Insérer
                    </button>
                </div>
            </Modal>

            {/* Modal Options - Légende des actions */}
            <Modal isOpen={optionsModal} onClose={() => setOptionsModal(false)} title="Options - Légende des actions">
                <div className="legend-container">
                    <div className="legend-item">
                        <div className="legend-preview legend-adaptatif"></div>
                        <span>Adaptatif vertical</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-escamotage"></div>
                        <span>Escamotage de phase</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-ouverture"></div>
                        <span>Ouverture anticipée</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-fermeture"></div>
                        <span>Fermeture anticipée</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-signa">
                            <div className="legend-signa-orange"></div>
                            <div className="legend-signa-blue"></div>
                        </div>
                        <span>Signa d'aide à la conduite</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-bande-debut"></div>
                        <span>Début de bande passante</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-bande-fin"></div>
                        <span>Fin de bande passante</span>
                    </div>
                </div>
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button className="modal-btn modal-btn-primary" onClick={() => setOptionsModal(false)}>
                        Fermer
                    </button>
                </div>
            </Modal>

            {/* Modal Aide en ligne */}
            <Modal isOpen={helpModal} onClose={() => setHelpModal(false)} title="Aide - Diagramme de Feux">
                <div className="help-content">
                    <section className="help-section">
                        <h4>Présentation</h4>
                        <p>Application de conception de diagrammes de feux de signalisation pour carrefours à feux.</p>
                    </section>

                    <section className="help-section">
                        <h4>Interface principale</h4>
                        <ul>
                            <li><strong>En-tête :</strong> Nom du carrefour, nombre de groupes, durée du cycle, zoom</li>
                            <li><strong>Panneau gauche :</strong> Onglets Projets, Configuration et Trafic</li>
                            <li><strong>Zone centrale :</strong> Diagramme temporel et tableau des actions</li>
                            <li><strong>Onglets PF :</strong> Gérez plusieurs plans de feux (PF1, PF2...) avec le bouton "+"</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Configuration des groupes</h4>
                        <ul>
                            <li><strong>Type :</strong> VL (véhicules), TC (transports en commun), Cycliste, Piéton</li>
                            <li><strong>Déc (Décalage) :</strong> Position de départ du vert dans le cycle</li>
                            <li><strong>V (Vert) :</strong> Durée du feu vert</li>
                            <li><strong>J (Jaune) :</strong> Durée du feu jaune/orange</li>
                            <li><strong>Vm (Vert minimum) :</strong> Durée minimale du vert</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Matrice de dégagement</h4>
                        <p>Définit les temps de dégagement (intervert) entre groupes conflictuels.
                        Valeurs acceptées : 3 à 20 secondes.</p>
                    </section>

                    <section className="help-section">
                        <h4>Tableau des actions</h4>
                        <p>Permet de définir des actions spéciales sur le diagramme. Survolez une ligne pour mettre en surbrillance l'action correspondante dans le diagramme (et inversement).</p>
                        <ul>
                            <li><strong>Adaptatif vertical :</strong> Zone d'adaptation du temps de vert (rectangle bleu). Utilisez Plage1/Plage2 pour définir les groupes concernés.</li>
                            <li><strong>Seconde lucarne :</strong> Deuxième phase de vert (vert foncé + orange). Crée une barre supplémentaire sur la ligne du groupe.</li>
                            <li><strong>Escamotage de phase :</strong> Phase pouvant être supprimée (rectangle gris transparent sur toute la hauteur).</li>
                            <li><strong>Escamotage :</strong> Escamotage lié à un groupe spécifique. Définissez GF (source) et Action GF 1 (cible) pour afficher les flèches de dépendance.</li>
                            <li><strong>Ouverture anticipée :</strong> Anticipation du passage au vert (barre hachurée verte).</li>
                            <li><strong>Fermeture anticipée :</strong> Anticipation du passage au rouge (accolade orange sous la barre).</li>
                            <li><strong>Signa d'aide à la conduite :</strong> Signal d'information conducteur (orange clignotant + bleu fixe).</li>
                            <li><strong>Début/Fin de bande passante :</strong> Lignes verticales verte/rouge marquant la coordination.</li>
                            <li><strong>Priorité piétons :</strong> Action pour la priorité aux piétons.</li>
                            <li><strong>Instant de coordination :</strong> Point de synchronisation dans le cycle.</li>
                            <li><strong>Synchro BTS :</strong> Synchronisation avec le système BTS.</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Colonnes du tableau des actions</h4>
                        <ul>
                            <li><strong>GF :</strong> Groupe fonctionnel concerné par l'action</li>
                            <li><strong>Action :</strong> Type d'action (liste déroulante)</li>
                            <li><strong>Description :</strong> Description libre (30 caractères max)</li>
                            <li><strong>Déb/Fin :</strong> Temps de début et fin de l'action dans le cycle</li>
                            <li><strong>Abrv :</strong> Abréviation affichée sur le diagramme</li>
                            <li><strong>Action_Micro :</strong> Commande micro-contrôleur (40 caractères)</li>
                            <li><strong>Plage 1/2 :</strong> Groupes délimitant la zone verticale (Adaptatif)</li>
                            <li><strong>Action GF 1-4 :</strong> Groupes liés à l'action (Escamotage)</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Détection des conflits</h4>
                        <p>L'application détecte automatiquement les conflits entre groupes antagonistes :</p>
                        <ul>
                            <li><strong>Dégagement insuffisant :</strong> Le temps entre la fin du vert d'un groupe et le début du vert d'un autre est inférieur au temps requis dans la matrice.</li>
                            <li><strong>Chevauchement des phases vertes :</strong> Deux groupes antagonistes ont leurs phases vertes qui se chevauchent.</li>
                            <li><strong>Seconde lucarne chevauche vert :</strong> Une seconde lucarne chevauche la phase verte d'un groupe antagoniste.</li>
                            <li><strong>Chevauchement des secondes lucarnes :</strong> Deux secondes lucarnes de groupes antagonistes se chevauchent.</li>
                        </ul>
                        <p><em>Note : Les conflits de chevauchement sont automatiquement ignorés lorsqu'un Escamotage ou Escamotage de phase est défini entre les deux groupes concernés.</em></p>
                    </section>

                    <section className="help-section">
                        <h4>Manipulation du diagramme</h4>
                        <ul>
                            <li><strong>Glisser-déposer :</strong> Déplacez les barres du diagramme avec la souris (bords gauche/droit pour redimensionner)</li>
                            <li><strong>Actions glissables :</strong> Les overlays d'actions peuvent aussi être redimensionnés par glisser-déposer</li>
                            <li><strong>Zoom :</strong> Utilisez le curseur dans l'en-tête</li>
                            <li><strong>Dépendances :</strong> Affichez les flèches de dégagement avec le bouton "Dépendance"</li>
                            <li><strong>Surbrillance :</strong> Survolez une action dans le tableau ou le diagramme pour la mettre en évidence</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Menu Diagramme</h4>
                        <ul>
                            <li><strong>Dupliquer :</strong> Crée un nouvel onglet PF avec une copie du diagramme actuel</li>
                            <li><strong>Glisser :</strong> Décale tous les groupes d'un nombre de secondes donné</li>
                            <li><strong>Insérer :</strong> Insère du temps dans le cycle à une position donnée</li>
                            <li><strong>Options :</strong> Affiche la légende visuelle des actions</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Raccourcis clavier</h4>
                        <ul>
                            <li><strong>Ctrl+Z :</strong> Annuler la dernière action</li>
                            <li><strong>Ctrl+Y :</strong> Refaire la dernière action annulée</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Données Trafic</h4>
                        <p>L'onglet Trafic permet de saisir les données de trafic par groupe :</p>
                        <ul>
                            <li><strong>Courant :</strong> Nom du courant de circulation</li>
                            <li><strong>Coef :</strong> Coefficient de voie</li>
                            <li><strong>Trafic :</strong> Volume de trafic (véh/h)</li>
                            <li><strong>V.Utile :</strong> Calculé automatiquement = Trafic / (1800 × Coef / Cycle)</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Sauvegarde et projets</h4>
                        <ul>
                            <li><strong>Sauvegarde automatique :</strong> Les données sont sauvegardées automatiquement dans le navigateur</li>
                            <li><strong>Projets nommés :</strong> Utilisez l'onglet Projets pour sauvegarder et charger des configurations</li>
                            <li><strong>Export :</strong> Menu Fichier → Exporter pour télécharger un fichier JSON</li>
                            <li><strong>Import :</strong> Menu Fichier → Importer pour charger un fichier JSON</li>
                        </ul>
                    </section>
                </div>
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button className="modal-btn modal-btn-primary" onClick={() => setHelpModal(false)}>
                        Fermer
                    </button>
                </div>
            </Modal>

            {/* Modal Importer CSV */}
            <Modal isOpen={importModal} onClose={() => setImportModal(false)} title="Importer un fichier CSV">
                <div className="form-row">
                    <label>
                        Sélectionner un fichier CSV :
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            style={{
                                display: 'block',
                                marginTop: '10px',
                                padding: '10px',
                                border: '1px dashed #555',
                                borderRadius: '4px',
                                backgroundColor: '#2a2a2a',
                                color: '#ddd',
                                cursor: 'pointer',
                                width: '100%'
                            }}
                        />
                    </label>
                </div>
                {importFile && (
                    <p style={{ color: '#8f8', fontSize: '0.9em', marginTop: '10px' }}>
                        Fichier sélectionné : {importFile.name}
                    </p>
                )}
                {importError && (
                    <p style={{ color: '#f66', fontSize: '0.9em', marginTop: '10px' }}>
                        {importError}
                    </p>
                )}
                <div style={{ color: '#888', fontSize: '0.8em', marginTop: '15px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                    <strong>Format CSV attendu (séparateur : point-virgule) :</strong><br />
                    <code style={{ color: '#aaa' }}>Nom;Type;Debut;Vert;Orange;MinVert</code><br />
                    <span style={{ fontSize: '0.9em' }}>Exemple : G1;VL;0;20;3;6</span>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setImportModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleImport} disabled={!importFile}>
                        OK
                    </button>
                </div>
            </Modal>

            {/* Open Green Wave Modal */}
            {openGreenWaveModal && (
                <div className="modal-overlay" onClick={() => setOpenGreenWaveModal(false)}>
                    <div className="modal-content open-greenwave-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Ouvrir une onde verte</h3>
                            <button className="modal-close" onClick={() => setOpenGreenWaveModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {getSavedGreenWaves().length > 0 ? (
                                <div className="project-list">
                                    {getSavedGreenWaves().map((gw) => (
                                        <div
                                            key={gw.name}
                                            className={`project-item ${selectedGreenWave === gw.name ? 'selected' : ''}`}
                                            onClick={() => setSelectedGreenWave(gw.name)}
                                            onDoubleClick={() => {
                                                setSelectedGreenWave(gw.name);
                                                setTimeout(handleOpenSavedGreenWave, 0);
                                            }}
                                        >
                                            <div className="project-icon green-wave-icon"></div>
                                            <div className="project-info">
                                                <span className="project-name">{gw.name}</span>
                                                <span className="project-details">
                                                    {gw.intersections?.length || 0} carrefours • {gw.speedUp || gw.speed || 50} km/h
                                                    {gw.savedAt && ` • ${formatDate(gw.savedAt)}`}
                                                </span>
                                            </div>
                                            <button
                                                className="btn-delete-item"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteGreenWave(gw.name);
                                                }}
                                                title="Supprimer"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-projects">Aucune onde verte sauvegardée.</p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setOpenGreenWaveModal(false)}>
                                Annuler
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={handleOpenSavedGreenWave}
                                disabled={!selectedGreenWave}
                            >
                                Ouvrir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Green Wave Dialog */}
            <CreateGreenWaveDialog
                isOpen={createGreenWaveModal}
                onClose={() => setCreateGreenWaveModal(false)}
                onConfirm={handleCreateGreenWave}
                getAllSaves={getAllSaves}
                loadProjectData={getProjectData}
            />

            {/* Green Wave Viewer */}
            <GreenWaveViewer
                isOpen={greenWaveViewer}
                onClose={() => setGreenWaveViewer(false)}
                intersections={greenWaveData}
            />

            {/* Modal Déplacer un groupe */}
            <Modal isOpen={moveGroupModal} onClose={() => setMoveGroupModal(false)} title="Déplacer un groupe de feu">
                <div className="form-row">
                    <label>
                        Groupe à déplacer :
                        <select
                            value={groupToMove}
                            onChange={(e) => setGroupToMove(e.target.value)}
                            style={{ marginLeft: '10px', padding: '5px' }}
                        >
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name || `Groupe ${g.id}`}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="form-row" style={{ marginTop: '15px' }}>
                    <label>
                        Insérer après :
                        <select
                            value={moveAfterGroup}
                            onChange={(e) => setMoveAfterGroup(e.target.value)}
                            style={{ marginLeft: '10px', padding: '5px' }}
                        >
                            <option value="0">Au début (première position)</option>
                            {groups
                                .filter((g) => g.id.toString() !== groupToMove)
                                .map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.name || `Groupe ${g.id}`}
                                    </option>
                                ))}
                        </select>
                    </label>
                </div>
                <p style={{ color: '#888', fontSize: '0.85em', marginTop: '15px' }}>
                    Cette action met à jour l'ordre des groupes dans la matrice, le diagramme et le tableau des actions.
                </p>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setMoveGroupModal(false)}>
                        Annuler
                    </button>
                    <button
                        className="modal-btn modal-btn-primary"
                        onClick={() => {
                            moveGroupToPosition(parseInt(groupToMove), parseInt(moveAfterGroup));
                            setMoveGroupModal(false);
                        }}
                    >
                        Déplacer
                    </button>
                </div>
            </Modal>

            {/* Modal Phasage bulle - Configuration des instants */}
            <Modal isOpen={phasageBulleModal} onClose={() => setPhasageBulleModal(false)} title="Configuration du phasage bulle">
                <div className="phasage-config">
                    <div className="form-row">
                        <label>
                            Nombre de phases :
                            <select
                                value={phasageBulleCount}
                                onChange={(e) => setPhasageBulleCount(parseInt(e.target.value))}
                                style={{ marginLeft: '10px', padding: '5px' }}
                            >
                                {[2, 3, 4, 5, 6].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div style={{ marginTop: '15px' }}>
                        <p style={{ color: '#aaa', marginBottom: '10px' }}>Instants des phases (en secondes) :</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {Array.from({ length: phasageBulleCount }, (_, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ color: '#dc4edc', fontWeight: 'bold', minWidth: '60px' }}>Phase {i + 1}:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max={cycleLength - 1}
                                        value={phasageBulleTimes[i] || 0}
                                        onChange={(e) => {
                                            const newTimes = [...phasageBulleTimes];
                                            newTimes[i] = Math.max(0, Math.min(cycleLength - 1, parseInt(e.target.value) || 0));
                                            setPhasageBulleTimes(newTimes);
                                        }}
                                        style={{ width: '60px', padding: '5px', textAlign: 'center' }}
                                    />
                                    <span style={{ color: '#888' }}>s</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p style={{ color: '#888', fontSize: '0.85em', marginTop: '15px' }}>
                        Cycle: {cycleLength}s. Les phases seront affichées dans l'onglet "Phasage bulle".
                    </p>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setPhasageBulleModal(false)}>
                        Fermer
                    </button>
                    <button
                        className="modal-btn modal-btn-primary"
                        onClick={() => {
                            setPhasageBulleModal(false);
                            setPhasageBulleEnabled(true);
                            setSimulationEnabled(false);
                            setPhasageBulleVersion(v => v + 1);
                        }}
                    >
                        Ouvrir Phasage bulle
                    </button>
                </div>
            </Modal>

            {/* Print Preview Modal */}
            {printPreviewModal && (
                <div className="modal-overlay" onClick={() => setPrintPreviewModal(false)}>
                    <div className="modal-content print-preview-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {printType === 'matrix' && 'Imprimer la matrice'}
                                {printType === 'form' && 'Imprimer le formulaire'}
                                {printType === 'diagram' && 'Imprimer le diagramme'}
                            </h3>
                            <button className="modal-close" onClick={() => setPrintPreviewModal(false)}>×</button>
                        </div>
                        <div className="modal-body print-preview-body">
                            <div className="print-preview-content">
                                {printType === 'matrix' && (
                                    <div className="print-section">
                                        <h4>{intersectionName || 'Sans titre'}</h4>
                                        <p>Matrice des temps intervert - {groups.length} groupes</p>
                                        <p>Durée du cycle: {cycleLength}s</p>
                                    </div>
                                )}
                                {printType === 'form' && (
                                    <div className="print-section">
                                        <h4>{intersectionName || 'Sans titre'}</h4>
                                        <p>Formulaire de configuration</p>
                                        <p>{groups.length} groupes - Cycle: {cycleLength}s</p>
                                    </div>
                                )}
                                {printType === 'diagram' && (
                                    <div className="print-section">
                                        <h4>{intersectionName || 'Sans titre'}</h4>
                                        <p>Diagramme avec tableau des actions</p>
                                        <p>{groups.length} groupes - Cycle: {cycleLength}s</p>
                                        <p>{actionData.filter(a => a.gf || a.action).length} actions définies</p>
                                    </div>
                                )}
                            </div>
                            <p className="print-info">
                                Cliquez sur "Imprimer" pour ouvrir la boîte de dialogue d'impression.
                                Vous pourrez y choisir l'imprimante et les options d'impression.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setPrintPreviewModal(false)}>
                                Annuler
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={() => {
                                    setPrintPreviewModal(false);
                                    // Add print class to body for CSS targeting
                                    document.body.classList.add(`print-${printType}`);
                                    window.print();
                                    // Remove class after print dialog closes
                                    setTimeout(() => {
                                        document.body.classList.remove(`print-${printType}`);
                                    }, 100);
                                }}
                            >
                                Imprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
