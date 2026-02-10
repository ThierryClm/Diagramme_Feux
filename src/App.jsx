import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTrafficLight } from './hooks/useTrafficLight';
import { useAuth, PERMISSIONS } from './hooks/useAuth';
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
import LoginModal from './components/LoginModal';
import UserManagerModal from './components/UserManagerModal';
import ExternalLinksModal from './components/ExternalLinksModal';
import { calculateSimulatedDiagram } from './utils/simulationCalculator';
import { importExcelFile } from './utils/excelImporter';

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
        resetToNewProject,
        actionData,
        updateActionRow,
        reorderActions,
        microCustomFields,
        updateMicroCustomField,
        phasageBulleCount,
        phasageBulleTimes,
        setPhasageBulleCount,
        setPhasageBulleTimes,
        pfTabs,
        activePFId,
        setActivePFId,
        duplicatePF,
        deletePF,
        renamePF,
        setPFColor,
        updatePFRemarques,
        reorderPF,
        currentRemarques,
        undo,
        redo,
        canUndo,
        canRedo,
        startDrag,
        endDrag,
        slideAllGroups,
        insertTime,
        reduceTime,
        simulationEnabled,
        setSimulationEnabled,
        simulationSelectedActions,
        toggleSimulationAction,
        selectAllSimulationActions,
        deselectAllSimulationActions,
        intersectionImage,
        setIntersectionImage,
        intersectionArrows,
        setIntersectionArrows,
        activeTrafficDataset,
        setActiveTrafficDataset,
        updateTrafficData,
        getTrafficData,
        trafficDatasetNames,
        copyTrafficDataset,
        dependencyGap,
        setDependencyGap,
        externalLinks,
        setExternalLinks
    } = useTrafficLight();

    // Filter conflicts to exclude those managed by SELECTED Escamotage actions (in simulation mode)
    const filteredConflicts = useMemo(() => {
        if (!simulationEnabled || !simulationSelectedActions || simulationSelectedActions.length === 0) {
            return conflicts;
        }

        // Get selected Escamotage actions
        const selectedEscamotageGroup = actionData.filter(action =>
            action.action === 'Escamotage' && action.gf && action.actGf1 &&
            simulationSelectedActions.includes(action.id)
        );

        if (selectedEscamotageGroup.length === 0) {
            return conflicts;
        }

        // Filter out conflicts that are managed by selected Escamotage actions
        return conflicts.filter(c => {
            const isInhibitedByEscamotage = selectedEscamotageGroup.some(action => {
                const sourceGfId = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const targetGfId = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                return (sourceGfId === c.from && targetGfId === c.to) ||
                       (sourceGfId === c.to && targetGfId === c.from);
            });
            return !isInhibitedByEscamotage;
        });
    }, [conflicts, simulationEnabled, simulationSelectedActions, actionData]);

    // Further filter: separate conflicts involving groups with phaseFlag (aiguillage/escamotage)
    const activeConflicts = useMemo(() => {
        return filteredConflicts.filter(c => {
            const fromGroup = groups.find(g => g.id === c.from);
            const toGroup = groups.find(g => g.id === c.to);
            return !fromGroup?.phaseFlag;
        });
    }, [filteredConflicts, groups]);

    // Check if a conflict's first group has phaseFlag (for grayed display)
    const isConflictGrayed = useCallback((c) => {
        const fromGroup = groups.find(g => g.id === c.from);
        return !!fromGroup?.phaseFlag;
    }, [groups]);

    // Authentification
    const {
        currentUser,
        isAuthenticated,
        isLoading: authLoading,
        hasUsers,
        login,
        logout,
        createUser,
        updateUser,
        deleteUser,
        resetPassword,
        hasPermission,
        getUsersList,
        exportUsersToFile,
        importUsersFromFile
    } = useAuth();

    // État pour le modal de gestion des utilisateurs
    const [showUserManager, setShowUserManager] = useState(false);

    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(10);
    const [activeTab, setActiveTab] = useState('config'); // 'config', 'traffic'
    const [showDependencies, setShowDependencies] = useState(false);
    const [hoveredActionId, setHoveredActionId] = useState(null);

    // Intersection image animation state
    const [isPlayingSimulation, setIsPlayingSimulation] = useState(false);
    const [simulationCurrentTime, setSimulationCurrentTime] = useState(0);
    const [hoveredArrowGroupId, setHoveredArrowGroupId] = useState(null);
    const [hoveredConflict, setHoveredConflict] = useState(null); // {from, to} for conflict hover
    const [hoveredDiagramTime, setHoveredDiagramTime] = useState(null); // Time position when hovering diagram

    // Floating image state (persists across tab changes and page reloads)
    const [showFloatingImage, setShowFloatingImage] = useState(() => {
        const saved = localStorage.getItem('floating_image_visible');
        return saved === 'true';
    });
    const [floatingPosition, setFloatingPosition] = useState(() => {
        try {
            const saved = localStorage.getItem('floating_image_position');
            return saved ? JSON.parse(saved) : { x: 100, y: 100 };
        } catch {
            return { x: 100, y: 100 };
        }
    });
    const [isFloatingDragging, setIsFloatingDragging] = useState(false);
    const floatingDragOffset = useRef({ x: 0, y: 0 });
    const [floatingCrop, setFloatingCrop] = useState(() => {
        try {
            const saved = localStorage.getItem('floating_image_crop');
            return saved ? JSON.parse(saved) : { top: 0, bottom: 0, left: 0, right: 0 };
        } catch {
            return { top: 0, bottom: 0, left: 0, right: 0 };
        }
    });
    const [showCropControls, setShowCropControls] = useState(false);
    const [floatingZoom, setFloatingZoom] = useState(() => {
        try {
            const saved = localStorage.getItem('floating_image_zoom');
            return saved ? parseFloat(saved) : 1;
        } catch {
            return 1;
        }
    });

    // Floating legend state
    const [showFloatingLegend, setShowFloatingLegend] = useState(false);
    const [floatingLegendPosition, setFloatingLegendPosition] = useState({ x: 200, y: 150 });
    const [isLegendDragging, setIsLegendDragging] = useState(false);
    const legendDragOffset = useRef({ x: 0, y: 0 });

    // V.Utile hover state: { groupId, vUtile } when hovering V.Utile cell
    const [hoveredVUtile, setHoveredVUtile] = useState(null);

    // Phasage bulle state (phasageBulleCount and phasageBulleTimes come from useTrafficLight hook - saved per PF)
    const [phasageBulleEnabled, setPhasageBulleEnabled] = useState(false);
    const [phasageBulleModal, setPhasageBulleModal] = useState(false);
    const [phasageBulleVisibleGroups, setPhasageBulleVisibleGroups] = useState(new Set());
    const [phasageBulleVersion, setPhasageBulleVersion] = useState(0);
    const [hoveredPhasageGroupId, setHoveredPhasageGroupId] = useState(null);

    // Diagram arrow style
    const [diagramArrowStyle, setDiagramArrowStyle] = useState('solid');

    // Resizable sidebar
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('sidebar_width');
        return saved ? parseInt(saved) : 450;
    });
    const [isResizing, setIsResizing] = useState(false);
    const splitViewRef = useRef(null);

    // Sidebar visibility toggle
    const [sidebarVisible, setSidebarVisible] = useState(() => {
        const saved = localStorage.getItem('sidebar_visible');
        return saved !== null ? saved === 'true' : true;
    });

    // Save sidebar width to localStorage
    useEffect(() => {
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
    }, [sidebarWidth]);

    // Save sidebar visibility to localStorage
    useEffect(() => {
        localStorage.setItem('sidebar_visible', sidebarVisible.toString());
    }, [sidebarVisible]);

    // Save floating image state to localStorage
    useEffect(() => {
        localStorage.setItem('floating_image_visible', showFloatingImage.toString());
    }, [showFloatingImage]);

    useEffect(() => {
        localStorage.setItem('floating_image_position', JSON.stringify(floatingPosition));
    }, [floatingPosition]);

    useEffect(() => {
        localStorage.setItem('floating_image_crop', JSON.stringify(floatingCrop));
    }, [floatingCrop]);

    useEffect(() => {
        localStorage.setItem('floating_image_zoom', floatingZoom.toString());
    }, [floatingZoom]);

    // Handle resize drag
    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleResizeMove = useCallback((e) => {
        if (!isResizing || !splitViewRef.current) return;
        const containerRect = splitViewRef.current.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        // Limit between 300px and 1200px
        setSidebarWidth(Math.min(1200, Math.max(300, newWidth)));
    }, [isResizing]);

    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
    }, []);

    // Add/remove mouse event listeners for resizing
    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    // Handle floating image drag
    const handleFloatingMouseDown = useCallback((e) => {
        if (e.target.classList.contains('floating-close-btn')) return;
        setIsFloatingDragging(true);
        floatingDragOffset.current = {
            x: e.clientX - floatingPosition.x,
            y: e.clientY - floatingPosition.y
        };
    }, [floatingPosition]);

    useEffect(() => {
        if (!isFloatingDragging) return;

        const handleMouseMove = (e) => {
            setFloatingPosition({
                x: e.clientX - floatingDragOffset.current.x,
                y: e.clientY - floatingDragOffset.current.y
            });
        };

        const handleMouseUp = () => {
            setIsFloatingDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isFloatingDragging]);

    // Floating legend drag handling
    const handleLegendMouseDown = useCallback((e) => {
        if (e.target.classList.contains('floating-close-btn')) return;
        setIsLegendDragging(true);
        legendDragOffset.current = {
            x: e.clientX - floatingLegendPosition.x,
            y: e.clientY - floatingLegendPosition.y
        };
    }, [floatingLegendPosition]);

    useEffect(() => {
        if (!isLegendDragging) return;

        const handleMouseMove = (e) => {
            setFloatingLegendPosition({
                x: e.clientX - legendDragOffset.current.x,
                y: e.clientY - legendDragOffset.current.y
            });
        };

        const handleMouseUp = () => {
            setIsLegendDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isLegendDragging]);

    // Resizable horizontal splitter between diagram and action table
    const [diagramHeight, setDiagramHeight] = useState(() => {
        const saved = localStorage.getItem('diagram_height');
        return saved ? parseInt(saved) : null; // null = auto (show full diagram)
    });
    const [isResizingDiagram, setIsResizingDiagram] = useState(false);
    const diagramAreaRef = useRef(null);

    // Save diagram height to localStorage
    useEffect(() => {
        if (diagramHeight !== null) {
            localStorage.setItem('diagram_height', diagramHeight.toString());
        }
    }, [diagramHeight]);

    // Handle horizontal resize drag
    const handleDiagramResizeStart = useCallback((e) => {
        e.preventDefault();
        setIsResizingDiagram(true);
    }, []);

    const handleDiagramResizeMove = useCallback((e) => {
        if (!isResizingDiagram || !diagramAreaRef.current) return;
        const containerRect = diagramAreaRef.current.getBoundingClientRect();
        const newHeight = e.clientY - containerRect.top - 40; // 40 = tabs height
        // Limit between 100px and container height - 150px (for action table)
        const maxHeight = containerRect.height - 150;
        setDiagramHeight(Math.min(maxHeight, Math.max(100, newHeight)));
    }, [isResizingDiagram]);

    const handleDiagramResizeEnd = useCallback(() => {
        setIsResizingDiagram(false);
    }, []);

    // Reset diagram height to auto (full diagram visible)
    const resetDiagramHeight = useCallback(() => {
        setDiagramHeight(null);
        localStorage.removeItem('diagram_height');
    }, []);

    // Handle panel resize from ActionTable bottom handle
    const handleActionPanelResize = useCallback((deltaY) => {
        if (!diagramAreaRef.current) return;
        const containerRect = diagramAreaRef.current.getBoundingClientRect();
        const maxHeight = containerRect.height - 150;

        setDiagramHeight(prev => {
            // If prev is null, calculate current diagram height
            const currentHeight = prev !== null ? prev : containerRect.height - 200;
            const newHeight = currentHeight + deltaY;
            return Math.min(maxHeight, Math.max(100, newHeight));
        });
    }, []);

    // Add/remove mouse event listeners for diagram resizing
    useEffect(() => {
        if (isResizingDiagram) {
            document.addEventListener('mousemove', handleDiagramResizeMove);
            document.addEventListener('mouseup', handleDiagramResizeEnd);
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleDiagramResizeMove);
            document.removeEventListener('mouseup', handleDiagramResizeEnd);
            if (!isResizing) {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
    }, [isResizingDiagram, handleDiagramResizeMove, handleDiagramResizeEnd, isResizing]);

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

    // Synchronize traffic dataset with active PF tab
    useEffect(() => {
        if (pfTabs && pfTabs.length > 0 && activePFId) {
            const activePF = pfTabs.find(pf => pf.id === activePFId);
            if (activePF && trafficDatasetNames.includes(activePF.name)) {
                setActiveTrafficDataset(activePF.name);
            }
        }
    }, [activePFId, pfTabs, trafficDatasetNames, setActiveTrafficDataset]);

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
    const [reduceModal, setReduceModal] = useState(false);
    const [optionsModal, setOptionsModal] = useState(false);
    const [helpModal, setHelpModal] = useState(false);
    const [importModal, setImportModal] = useState(false);
    const [slideValue, setSlideValue] = useState(0);
    const [insertStart, setInsertStart] = useState(0);
    const [insertDuration, setInsertDuration] = useState(5);
    const [reduceStart, setReduceStart] = useState(0);
    const [reduceDuration, setReduceDuration] = useState(5);
    const [selectedProject, setSelectedProject] = useState(null);
    const [importFile, setImportFile] = useState(null);
    const [importError, setImportError] = useState('');
    const [importHintDir, setImportHintDir] = useState('');
    const [recentFiles, setRecentFiles] = useState([]);

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
    const [currentProjectPath, setCurrentProjectPath] = useState(''); // Chemin du projet courant

    // Move group modal states
    const [moveGroupModal, setMoveGroupModal] = useState(false);
    const [groupToMove, setGroupToMove] = useState('');
    const [moveAfterGroup, setMoveAfterGroup] = useState('0'); // '0' means at the beginning

    // Imported HTM files state
    const [importedHTMFiles, setImportedHTMFiles] = useState(() => {
        try {
            const saved = localStorage.getItem('importedHTMFiles');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    const [importHTMModal, setImportHTMModal] = useState(false);
    const [htmFile, setHtmFile] = useState(null);
    const [htmImportError, setHtmImportError] = useState('');
    const [showExternalLinksModal, setShowExternalLinksModal] = useState(false);

    // Drag & drop state for PF tabs
    const [draggedTabIndex, setDraggedTabIndex] = useState(null);

    // File System Access API - mémoriser les derniers répertoires utilisés
    const lastOpenDirectoryRef = useRef(null);
    const lastSaveDirectoryRef = useRef(null);
    const lastImportDirectoryRef = useRef(null);
    const lastImageDirectoryRef = useRef(null);
    const lastGreenWaveDirectoryRef = useRef(null);

    // Liste des 5 derniers répertoires par type (pour affichage dans les menus)
    const [recentOpenDirs, setRecentOpenDirs] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('recentOpenDirs') || '[]');
        } catch { return []; }
    });
    const [recentImportDirs, setRecentImportDirs] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('recentImportDirs') || '[]');
        } catch { return []; }
    });
    const [recentImageDirs, setRecentImageDirs] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('recentImageDirs') || '[]');
        } catch { return []; }
    });
    const [recentSaveDirs, setRecentSaveDirs] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('recentSaveDirs') || '[]');
        } catch { return []; }
    });
    const [recentGreenWaveDirs, setRecentGreenWaveDirs] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('recentGreenWaveDirs') || '[]');
        } catch { return []; }
    });

    // Fonction pour ajouter un répertoire à la liste des récents
    const addRecentDirectory = useCallback((type, dirName, dirHandle) => {
        const updateList = (currentList, setList, storageKey) => {
            // Créer un nouvel élément
            const newEntry = { name: dirName, timestamp: Date.now() };
            // Filtrer pour éviter les doublons
            const filtered = currentList.filter(d => d.name !== dirName);
            // Ajouter en tête et limiter à 5
            const updated = [newEntry, ...filtered].slice(0, 5);
            setList(updated);
            localStorage.setItem(storageKey, JSON.stringify(updated));
            return updated;
        };

        switch (type) {
            case 'open':
                updateList(recentOpenDirs, setRecentOpenDirs, 'recentOpenDirs');
                break;
            case 'import':
                updateList(recentImportDirs, setRecentImportDirs, 'recentImportDirs');
                break;
            case 'image':
                updateList(recentImageDirs, setRecentImageDirs, 'recentImageDirs');
                break;
            case 'save':
                updateList(recentSaveDirs, setRecentSaveDirs, 'recentSaveDirs');
                break;
            case 'greenwave':
                updateList(recentGreenWaveDirs, setRecentGreenWaveDirs, 'recentGreenWaveDirs');
                break;
        }
    }, [recentOpenDirs, recentImportDirs, recentImageDirs, recentSaveDirs, recentGreenWaveDirs]);

    // Fonctions pour sauvegarder/restaurer les handles de répertoire via IndexedDB
    const openIndexedDB = useCallback(() => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DiagrammeFeux_FileHandles', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles');
                }
            };
        });
    }, []);

    const saveDirectoryHandle = useCallback(async (key, handle) => {
        try {
            const db = await openIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['handles'], 'readwrite');
                const store = transaction.objectStore('handles');
                const request = store.put(handle, key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('Erreur sauvegarde handle:', e);
        }
    }, [openIndexedDB]);

    const loadDirectoryHandle = useCallback(async (key) => {
        try {
            const db = await openIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['handles'], 'readonly');
                const store = transaction.objectStore('handles');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('Erreur chargement handle:', e);
            return null;
        }
    }, [openIndexedDB]);

    // Charger les derniers répertoires au démarrage
    useEffect(() => {
        const loadHandles = async () => {
            try {
                const openHandle = await loadDirectoryHandle('lastOpenDirectory');
                const saveHandle = await loadDirectoryHandle('lastSaveDirectory');
                const importHandle = await loadDirectoryHandle('lastImportDirectory');
                const imageHandle = await loadDirectoryHandle('lastImageDirectory');
                const greenWaveHandle = await loadDirectoryHandle('lastGreenWaveDirectory');
                if (openHandle) lastOpenDirectoryRef.current = openHandle;
                if (saveHandle) lastSaveDirectoryRef.current = saveHandle;
                if (importHandle) lastImportDirectoryRef.current = importHandle;
                if (imageHandle) lastImageDirectoryRef.current = imageHandle;
                if (greenWaveHandle) lastGreenWaveDirectoryRef.current = greenWaveHandle;
            } catch (e) {
                console.error('Erreur chargement handles:', e);
            }
        };
        loadHandles();
    }, [loadDirectoryHandle]);

    // Ouvrir un fichier JSON avec File System Access API
    const handleOpenFileWithPicker = useCallback(async () => {
        if (!window.showOpenFilePicker) {
            // Fallback pour navigateurs sans File System Access API
            setSelectedProject(null);
            setOpenModal(true);
            return;
        }

        try {
            const options = {
                types: [{
                    description: 'Fichiers Projet',
                    accept: { 'application/json': ['.json'] }
                }],
                multiple: false
            };

            // Utiliser le dernier répertoire si disponible
            if (lastOpenDirectoryRef.current) {
                options.startIn = lastOpenDirectoryRef.current;
            }

            const [fileHandle] = await window.showOpenFilePicker(options);
            const file = await fileHandle.getFile();
            const content = await file.text();

            // Validation du contenu avant parsing
            if (!content || content.trim() === '') {
                alert('Erreur: Le fichier est vide');
                return;
            }

            let data;
            try {
                data = JSON.parse(content);
            } catch (parseError) {
                console.error('Erreur parsing JSON:', parseError);
                alert('Erreur: Le fichier JSON est invalide ou corrompu.\n\n' +
                      'Détails: ' + parseError.message + '\n\n' +
                      'Essayez d\'ouvrir le fichier dans un éditeur de texte pour vérifier sa structure.');
                return;
            }

            // Mémoriser le répertoire parent
            try {
                const dirHandle = await fileHandle.getParent?.();
                if (dirHandle) {
                    lastOpenDirectoryRef.current = dirHandle;
                    await saveDirectoryHandle('lastOpenDirectory', dirHandle);
                    // Ajouter aux répertoires récents
                    addRecentDirectory('open', dirHandle.name, dirHandle);
                }
            } catch (e) {
                // getParent n'est pas toujours disponible
            }

            // Charger les données du projet
            const projectName = file.name.replace(/\.json$/i, '');
            loadFullState({
                intersectionName: projectName,
                ...data
            });

            // Mémoriser le chemin du projet
            setCurrentProjectPath(file.name);

            // Restaurer la hauteur du diagramme si présente
            if (data.diagramHeight !== undefined) {
                setDiagramHeight(data.diagramHeight);
            }

            // Restaurer le rognage de l'image flottante si présent
            if (data.floatingCrop !== undefined) {
                setFloatingCrop(data.floatingCrop);
            }

            // Restaurer le zoom de l'image flottante si présent
            if (data.floatingZoom !== undefined) {
                setFloatingZoom(data.floatingZoom);
            }

            // Restaurer la position de l'image flottante si présente
            if (data.floatingPosition !== undefined) {
                setFloatingPosition(data.floatingPosition);
            }

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur ouverture fichier:', e);
                alert('Erreur lors de l\'ouverture du fichier: ' + e.message);
            }
        }
    }, [loadFullState, saveDirectoryHandle, addRecentDirectory, setDiagramHeight]);

    // Ouvrir un fichier depuis un répertoire récent
    const handleOpenFileFromRecentDir = useCallback(async (dirIndex) => {
        if (!window.showOpenFilePicker) {
            alert('API File System non supportée par ce navigateur');
            return;
        }

        try {
            const dirInfo = recentOpenDirs[dirIndex];
            if (!dirInfo) return;

            const options = {
                types: [{
                    description: 'Fichiers Projet',
                    accept: { 'application/json': ['.json'] }
                }],
                multiple: false
            };

            // Essayer de récupérer le handle du répertoire depuis IndexedDB
            const savedHandle = await loadDirectoryHandle(`recentOpenDir_${dirIndex}`);
            if (savedHandle) {
                options.startIn = savedHandle;
            }

            const [fileHandle] = await window.showOpenFilePicker(options);
            const file = await fileHandle.getFile();
            const content = await file.text();

            // Validation du contenu avant parsing
            if (!content || content.trim() === '') {
                alert('Erreur: Le fichier est vide');
                return;
            }

            let data;
            try {
                data = JSON.parse(content);
            } catch (parseError) {
                console.error('Erreur parsing JSON:', parseError);
                alert('Erreur: Le fichier JSON est invalide ou corrompu.\n\n' +
                      'Détails: ' + parseError.message + '\n\n' +
                      'Essayez d\'ouvrir le fichier dans un éditeur de texte pour vérifier sa structure.');
                return;
            }

            // Mémoriser le répertoire parent
            try {
                const dirHandle = await fileHandle.getParent?.();
                if (dirHandle) {
                    lastOpenDirectoryRef.current = dirHandle;
                    await saveDirectoryHandle('lastOpenDirectory', dirHandle);
                    addRecentDirectory('open', dirHandle.name, dirHandle);
                }
            } catch (e) {
                // getParent n'est pas toujours disponible
            }

            const projectName = file.name.replace(/\.json$/i, '');
            loadFullState({
                intersectionName: projectName,
                ...data
            });

            // Mémoriser le chemin du projet
            setCurrentProjectPath(file.name);

            // Restaurer la hauteur du diagramme si présente
            if (data.diagramHeight !== undefined) {
                setDiagramHeight(data.diagramHeight);
            }

            // Restaurer le rognage de l'image flottante si présent
            if (data.floatingCrop !== undefined) {
                setFloatingCrop(data.floatingCrop);
            }

            // Restaurer le zoom de l'image flottante si présent
            if (data.floatingZoom !== undefined) {
                setFloatingZoom(data.floatingZoom);
            }

            // Restaurer la position de l'image flottante si présente
            if (data.floatingPosition !== undefined) {
                setFloatingPosition(data.floatingPosition);
            }

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur ouverture fichier:', e);
                alert('Erreur lors de l\'ouverture du fichier: ' + e.message);
            }
        }
    }, [recentOpenDirs, loadDirectoryHandle, saveDirectoryHandle, addRecentDirectory, loadFullState, setDiagramHeight]);

    // Enregistrer un fichier JSON avec File System Access API
    const handleSaveFileWithPicker = useCallback(async () => {
        if (!window.showSaveFilePicker) {
            // Fallback pour navigateurs sans File System Access API
            const name = prompt('Nom du projet:', intersectionName || 'Mon projet');
            if (name) {
                saveProject(name);
            }
            return;
        }

        try {
            const options = {
                suggestedName: `${intersectionName || 'projet'}.json`,
                types: [{
                    description: 'Fichier Projet JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            };

            // Utiliser le dernier répertoire si disponible
            if (lastSaveDirectoryRef.current) {
                options.startIn = lastSaveDirectoryRef.current;
            }

            const fileHandle = await window.showSaveFilePicker(options);

            // Préparer les données du projet
            const fullState = getFullState();
            const projectData = {
                intersectionName: fullState.intersectionName,
                groups: fullState.groups,
                cycleLength: fullState.cycleLength,
                conflictMatrix: fullState.conflictMatrix,
                pfTabs: fullState.pfTabs,
                activePFId: fullState.activePFId,
                intersectionImage: fullState.intersectionImage,
                intersectionArrows: fullState.intersectionArrows,
                trafficDatasets: fullState.trafficDatasets,
                activeTrafficDataset: fullState.activeTrafficDataset,
                externalLinks: fullState.externalLinks,
                diagramHeight: diagramHeight,
                floatingCrop: floatingCrop,
                floatingZoom: floatingZoom,
                floatingPosition: floatingPosition,
                // Noms des répertoires utilisés (avec fallback sur les récents)
                directoryNames: {
                    open: lastOpenDirectoryRef.current?.name || recentOpenDirs[0]?.name || null,
                    save: lastSaveDirectoryRef.current?.name || recentSaveDirs[0]?.name || null,
                    import: lastImportDirectoryRef.current?.name || recentImportDirs[0]?.name || null,
                    image: lastImageDirectoryRef.current?.name || recentImageDirs[0]?.name || null,
                    greenWave: lastGreenWaveDirectoryRef.current?.name || recentGreenWaveDirs[0]?.name || null
                }
            };

            // Écrire le fichier
            const jsonContent = JSON.stringify(projectData, null, 2);
            const writable = await fileHandle.createWritable();
            await writable.write(jsonContent);
            await writable.close();

            // Vérifier que le fichier n'est pas vide après sauvegarde
            try {
                const savedFile = await fileHandle.getFile();
                const savedContent = await savedFile.text();
                if (!savedContent || savedContent.trim() === '') {
                    alert('Attention: Le fichier semble vide après la sauvegarde.\n\n' +
                          'Veuillez réessayer la sauvegarde ou utiliser "Enregistrer" pour sauvegarder dans le localStorage.');
                    return;
                }
            } catch (verifyError) {
                console.warn('Impossible de vérifier le fichier sauvegardé:', verifyError);
            }

            // Mémoriser le répertoire parent
            try {
                const dirHandle = await fileHandle.getParent?.();
                if (dirHandle) {
                    lastSaveDirectoryRef.current = dirHandle;
                    await saveDirectoryHandle('lastSaveDirectory', dirHandle);
                    // Ajouter aux répertoires récents d'enregistrement
                    addRecentDirectory('save', dirHandle.name, dirHandle);
                }
            } catch (e) {
                // getParent n'est pas toujours disponible
            }

            // Mettre à jour le nom du projet
            const savedName = fileHandle.name.replace(/\.json$/i, '');
            setIntersectionName(savedName);

            // Mémoriser le chemin du projet
            setCurrentProjectPath(fileHandle.name);

            // Sauvegarder aussi dans localStorage pour cohérence
            saveProject(savedName);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                alert('Erreur lors de la sauvegarde du fichier: ' + e.message);
            }
        }
    }, [intersectionName, getFullState, setIntersectionName, saveProject, saveDirectoryHandle, addRecentDirectory, recentOpenDirs, recentSaveDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs]);

    // Enregistrer un fichier dans un répertoire récent
    const handleSaveFileToRecentDir = useCallback(async (dirIndex) => {
        if (!window.showSaveFilePicker) {
            alert('API File System non supportée par ce navigateur');
            return;
        }

        try {
            const dirInfo = recentSaveDirs[dirIndex];
            if (!dirInfo) return;

            const options = {
                suggestedName: `${intersectionName || 'projet'}.json`,
                types: [{
                    description: 'Fichier Projet JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            };

            // Essayer de récupérer le handle du répertoire depuis IndexedDB
            const savedHandle = await loadDirectoryHandle(`recentSaveDir_${dirIndex}`);
            if (savedHandle) {
                options.startIn = savedHandle;
            }

            const fileHandle = await window.showSaveFilePicker(options);

            // Préparer les données du projet
            const fullState = getFullState();
            const projectData = {
                intersectionName: fullState.intersectionName,
                groups: fullState.groups,
                cycleLength: fullState.cycleLength,
                conflictMatrix: fullState.conflictMatrix,
                pfTabs: fullState.pfTabs,
                activePFId: fullState.activePFId,
                intersectionImage: fullState.intersectionImage,
                intersectionArrows: fullState.intersectionArrows,
                trafficDatasets: fullState.trafficDatasets,
                activeTrafficDataset: fullState.activeTrafficDataset,
                externalLinks: fullState.externalLinks,
                diagramHeight: diagramHeight,
                floatingCrop: floatingCrop,
                floatingZoom: floatingZoom,
                floatingPosition: floatingPosition,
                // Noms des répertoires utilisés (avec fallback sur les récents)
                directoryNames: {
                    open: lastOpenDirectoryRef.current?.name || recentOpenDirs[0]?.name || null,
                    save: lastSaveDirectoryRef.current?.name || recentSaveDirs[0]?.name || null,
                    import: lastImportDirectoryRef.current?.name || recentImportDirs[0]?.name || null,
                    image: lastImageDirectoryRef.current?.name || recentImageDirs[0]?.name || null,
                    greenWave: lastGreenWaveDirectoryRef.current?.name || recentGreenWaveDirs[0]?.name || null
                }
            };

            // Écrire le fichier
            const jsonContent = JSON.stringify(projectData, null, 2);
            const writable = await fileHandle.createWritable();
            await writable.write(jsonContent);
            await writable.close();

            // Vérifier que le fichier n'est pas vide après sauvegarde
            try {
                const savedFile = await fileHandle.getFile();
                const savedContent = await savedFile.text();
                if (!savedContent || savedContent.trim() === '') {
                    alert('Attention: Le fichier semble vide après la sauvegarde.\n\n' +
                          'Veuillez réessayer la sauvegarde ou utiliser "Enregistrer" pour sauvegarder dans le localStorage.');
                    return;
                }
            } catch (verifyError) {
                console.warn('Impossible de vérifier le fichier sauvegardé:', verifyError);
            }

            // Mémoriser le répertoire parent
            try {
                const dirHandle = await fileHandle.getParent?.();
                if (dirHandle) {
                    lastSaveDirectoryRef.current = dirHandle;
                    await saveDirectoryHandle('lastSaveDirectory', dirHandle);
                    addRecentDirectory('save', dirHandle.name, dirHandle);
                }
            } catch (e) {
                // getParent n'est pas toujours disponible
            }

            // Mettre à jour le nom du projet
            const savedName = fileHandle.name.replace(/\.json$/i, '');
            setIntersectionName(savedName);

            // Mémoriser le chemin du projet
            setCurrentProjectPath(fileHandle.name);

            // Sauvegarder aussi dans localStorage pour cohérence
            saveProject(savedName);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                alert('Erreur lors de la sauvegarde du fichier: ' + e.message);
            }
        }
    }, [recentSaveDirs, intersectionName, loadDirectoryHandle, saveDirectoryHandle, addRecentDirectory, getFullState, setIntersectionName, saveProject, recentOpenDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs]);

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

    // Load recent files from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('recentFiles');
            if (saved) {
                const files = JSON.parse(saved);
                setRecentFiles(files);
            }
        } catch (e) {
            console.error('Failed to load recent files', e);
        }
    }, []);

    // Add file to recent files list
    const addToRecentFiles = (filePath, fileName) => {
        try {
            // Extract directory from path (handle both / and \ separators)
            const lastSlash = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
            const directory = lastSlash > 0 ? filePath.substring(0, lastSlash) : '';

            const newFile = {
                path: filePath,
                name: fileName,
                directory: directory,
                timestamp: new Date().toISOString()
            };

            // Get existing recent files
            const saved = localStorage.getItem('recentFiles');
            let files = saved ? JSON.parse(saved) : [];

            // Remove if already exists (to avoid duplicates)
            files = files.filter(f => f.path !== filePath);

            // Add to beginning
            files.unshift(newFile);

            // Keep only last 10 files
            files = files.slice(0, 10);

            // Save to state and localStorage
            setRecentFiles(files);
            localStorage.setItem('recentFiles', JSON.stringify(files));
        } catch (e) {
            console.error('Failed to add to recent files', e);
        }
    };

    // Get unique recent directories
    const getRecentDirectories = () => {
        try {
            const directories = new Map();
            recentFiles.forEach(file => {
                if (file.directory && !directories.has(file.directory)) {
                    directories.set(file.directory, file.timestamp);
                }
            });

            // Sort by most recent
            return Array.from(directories.entries())
                .sort((a, b) => new Date(b[1]) - new Date(a[1]))
                .map(([dir]) => dir)
                .slice(0, 5); // Keep only last 5 directories
        } catch (e) {
            console.error('Failed to get recent directories', e);
            return [];
        }
    };

    // Get recent directories for menu (with shortened names)
    const getRecentDirectoriesForMenu = () => {
        const dirs = getRecentDirectories();
        return dirs.map(dir => {
            // Extract just the last folder name for display
            const parts = dir.replace(/\\/g, '/').split('/');
            const name = parts[parts.length - 1] || parts[parts.length - 2] || dir;
            return { path: dir, name: name };
        });
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
                    resetToNewProject();
                    setActiveTab('config');
                    setDiagramHeight(null);
                    setGroupCountInput('8');
                    setCycleLengthInput('60');
                    setCurrentProjectPath('');
                }
                break;
            case 'open':
                handleOpenFileWithPicker();
                break;
            case 'openLocalStorage':
                setSelectedProject(null);
                setOpenModal(true);
                break;
            case 'save':
                handleSaveFileWithPicker();
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
            case 'deleteActiveDiagram':
                if (pfTabs.length > 1) {
                    const activePF = pfTabs.find(pf => pf.id === activePFId);
                    const tabName = activePF?.name || `PF${activePFId}`;
                    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'onglet "${tabName}" ?\nCette action est irréversible.`)) {
                        deletePF(activePFId);
                    }
                } else {
                    alert('Impossible de supprimer le dernier onglet.');
                }
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
            case 'reduce':
                setReduceStart(0);
                setReduceDuration(5);
                setReduceModal(true);
                break;
            case 'options':
                setOptionsModal(true);
                break;
            case 'legend':
                setShowFloatingLegend(true);
                break;
            case 'help':
                setHelpModal(true);
                break;
            case 'import':
                handleImportExcelDirect();
                break;
            case 'browseImport':
                setImportFile(null);
                setImportError('');
                // Use the most recent directory as hint
                const recentDirs = getRecentDirectories();
                setImportHintDir(recentDirs.length > 0 ? recentDirs[0] : '');
                setImportModal(true);
                break;
            case 'importHTM':
                setHtmFile(null);
                setHtmImportError('');
                setImportHTMModal(true);
                break;
            case 'credit':
                alert('Diagramme de Feux\n\nDéveloppé avec React + Vite\n2024');
                break;
            case 'externalLinks':
                setShowExternalLinksModal(true);
                break;
            // Green wave actions
            case 'createGreenWave':
                setCreateGreenWaveModal(true);
                break;
            case 'openGreenWave':
                handleOpenGreenWaveFromFile();
                break;
            case 'openGreenWaveFromLocalStorage':
                setOpenGreenWaveModal(true);
                setSelectedGreenWave(null);
                break;
            case 'closeGreenWave':
                setGreenWaveViewer(false);
                setGreenWaveData(null);
                break;
            default:
                // Handle opening imported HTM files
                if (action.startsWith('openImportedFile:')) {
                    const fileId = action.replace('openImportedFile:', '');
                    const file = importedHTMFiles.find(f => f.id === fileId);
                    if (file && file.data) {
                        loadFullState({
                            intersectionName: file.name,
                            groups: file.data.groups || [],
                            cycleLength: file.data.cycleLength || cycleLength
                        });
                    }
                } else if (action.startsWith('importFromDir:')) {
                    // Import from recent directory
                    const dirIndex = parseInt(action.replace('importFromDir:', ''));
                    const dirs = getRecentDirectoriesForMenu();
                    if (dirs[dirIndex]) {
                        setImportFile(null);
                        setImportError('');
                        setImportHintDir(dirs[dirIndex].path);
                        setImportModal(true);
                    }
                } else if (action.startsWith('openFromRecentDir:')) {
                    // Open file from recent directory
                    const dirIndex = parseInt(action.replace('openFromRecentDir:', ''));
                    if (recentOpenDirs[dirIndex]) {
                        handleOpenFileFromRecentDir(dirIndex);
                    }
                } else if (action.startsWith('importFromRecentDir:')) {
                    // Import Excel from recent directory
                    const dirIndex = parseInt(action.replace('importFromRecentDir:', ''));
                    if (recentImportDirs[dirIndex]) {
                        handleImportExcelFromRecentDir(dirIndex);
                    }
                } else if (action.startsWith('saveToRecentDir:')) {
                    // Save to recent directory
                    const dirIndex = parseInt(action.replace('saveToRecentDir:', ''));
                    if (recentSaveDirs[dirIndex]) {
                        handleSaveFileToRecentDir(dirIndex);
                    }
                } else {
                    console.log('Action non implémentée:', action);
                }
        }
    };

    // Handle green wave creation - opens in new tab
    const handleCreateGreenWave = (intersections) => {
        // Generate unique ID
        const greenWaveId = Date.now().toString();

        // Save data to sessionStorage
        sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(intersections));

        // Open new tab with green wave page
        window.open(`${window.location.origin}/?greenwave&id=${greenWaveId}`, '_blank');

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
                        speedLineOffsetUp: greenWaveData.speedLineOffsetUp,
                        speedLineOffsetDown: greenWaveData.speedLineOffsetDown,
                        pixelsPerSecond: greenWaveData.pixelsPerSecond,
                        pixelsPerMeter: greenWaveData.pixelsPerMeter
                    }));

                    // Open new tab with green wave page
                    window.open(`${window.location.origin}/?greenwave&id=${greenWaveId}`, '_blank');

                    setOpenGreenWaveModal(false);
                    setSelectedGreenWave(null);
                }
            }
        } catch (e) {
            console.error('Failed to open green wave', e);
            alert('Erreur lors de l\'ouverture de l\'onde verte');
        }
    };

    // Handle opening green wave from file system
    const handleOpenGreenWaveFromFile = async () => {
        if (!window.showOpenFilePicker) {
            alert('Votre navigateur ne supporte pas l\'ouverture de fichiers. Utilisez "Ouvrir une onde verte..." pour charger depuis le local storage.');
            return;
        }

        try {
            const options = {
                types: [{
                    description: 'Fichier Onde Verte JSON',
                    accept: { 'application/json': ['.json'] }
                }],
                multiple: false
            };

            const [fileHandle] = await window.showOpenFilePicker(options);
            const file = await fileHandle.getFile();
            const content = await file.text();

            // Validation du contenu avant parsing
            if (!content || content.trim() === '') {
                alert('Erreur: Le fichier est vide');
                return;
            }

            let greenWaveData;
            try {
                greenWaveData = JSON.parse(content);
            } catch (parseError) {
                console.error('Erreur parsing JSON:', parseError);
                alert('Erreur: Le fichier JSON est invalide ou corrompu.\n\n' +
                      'Détails: ' + parseError.message + '\n\n' +
                      'Essayez d\'ouvrir le fichier dans un éditeur de texte pour vérifier sa structure.');
                return;
            }

            if (greenWaveData && greenWaveData.intersections) {
                // Generate unique ID
                const greenWaveId = Date.now().toString();

                // Save data to sessionStorage
                sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(greenWaveData.intersections));

                // Also save additional settings
                sessionStorage.setItem(`greenwave_settings_${greenWaveId}`, JSON.stringify({
                    name: greenWaveData.name || file.name.replace(/\.json$/i, ''),
                    speed: greenWaveData.speed,
                    speedUp: greenWaveData.speedUp,
                    speedDown: greenWaveData.speedDown,
                    speedLineOffsetUp: greenWaveData.speedLineOffsetUp,
                    speedLineOffsetDown: greenWaveData.speedLineOffsetDown,
                    showSpeedLines: greenWaveData.showSpeedLines,
                    pfParams: greenWaveData.pfParams,
                    pixelsPerSecond: greenWaveData.pixelsPerSecond,
                    pixelsPerMeter: greenWaveData.pixelsPerMeter,
                    displayCycles: greenWaveData.displayCycles
                }));

                // Open new tab with green wave page
                window.open(`${window.location.origin}/?greenwave&id=${greenWaveId}`, '_blank');
            } else {
                alert('Le fichier ne contient pas de données d\'onde verte valides.');
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur ouverture fichier onde verte:', e);
                alert('Erreur lors de l\'ouverture du fichier: ' + e.message);
            }
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

    // Handle reduce confirmation
    const handleReduce = () => {
        if (reduceDuration > 0 && reduceStart + reduceDuration <= cycleLength) {
            reduceTime(reduceStart, reduceDuration);
        }
        setReduceModal(false);
    };

    // Handle file selection for import
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImportFile(file);
            setImportError('');

            // Add to recent files (webkitRelativePath or name only due to browser security)
            const filePath = file.webkitRelativePath || file.name;
            addToRecentFiles(filePath, file.name);
        }
    };

    // Handle direct Excel import via File System Access API
    const handleImportExcelDirect = async () => {
        if (!window.showOpenFilePicker) {
            // Fallback pour navigateurs sans File System Access API
            setImportFile(null);
            setImportError('');
            setImportHintDir('');
            setImportModal(true);
            return;
        }

        try {
            const options = {
                types: [{
                    description: 'Fichiers Excel',
                    accept: {
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                        'application/vnd.ms-excel': ['.xls']
                    }
                }],
                multiple: false
            };

            // Utiliser le dernier répertoire d'import si disponible
            if (lastImportDirectoryRef.current) {
                options.startIn = lastImportDirectoryRef.current;
            }

            const [fileHandle] = await window.showOpenFilePicker(options);
            const file = await fileHandle.getFile();

            // Mémoriser le répertoire parent
            try {
                const dirHandle = await fileHandle.getParent?.();
                if (dirHandle) {
                    lastImportDirectoryRef.current = dirHandle;
                    await saveDirectoryHandle('lastImportDirectory', dirHandle);
                    // Ajouter aux répertoires récents
                    addRecentDirectory('import', dirHandle.name, dirHandle);
                }
            } catch (e) {
                // getParent n'est pas toujours disponible
            }

            const importedData = await importExcelFile(file);

            // Load the imported data
            loadFullState({
                intersectionName: importedData.intersectionName,
                groups: importedData.groups,
                cycleLength: importedData.cycleLength,
                conflictMatrix: importedData.conflictMatrix,
                actionData: importedData.actionData,
                pfTabs: importedData.pfTabs.length > 0 ? importedData.pfTabs : undefined,
                activePFId: 1,
                trafficDatasets: importedData.trafficDatasets
            });

            // Apply traffic data if available
            if (importedData.trafficData && Object.keys(importedData.trafficData).length > 0) {
                importedData.groups.forEach((group) => {
                    const trafficInfo = importedData.trafficData[group.id];
                    if (trafficInfo && trafficInfo.courant) {
                        updateGroupParams(group.id, { courant: trafficInfo.courant });
                    }
                });
            }

            // Afficher le résultat avec les avertissements éventuels
            let message = `Import réussi !\n\n${importedData.groups.length} groupes importés\n${importedData.actionData.length} actions importées`;
            if (importedData.warnings && importedData.warnings.length > 0) {
                message += `\n\n⚠️ Avertissements (${importedData.warnings.length}) :\n${importedData.warnings.join('\n')}`;
            }
            alert(message);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur import Excel:', e);
                alert('Erreur lors de l\'import: ' + e.message);
            }
        }
    };

    // Import Excel depuis un répertoire récent
    const handleImportExcelFromRecentDir = async (dirIndex) => {
        if (!window.showOpenFilePicker) {
            alert('API File System non supportée par ce navigateur');
            return;
        }

        try {
            const dirInfo = recentImportDirs[dirIndex];
            if (!dirInfo) return;

            const options = {
                types: [{
                    description: 'Fichiers Excel',
                    accept: {
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                        'application/vnd.ms-excel': ['.xls']
                    }
                }],
                multiple: false
            };

            // Essayer de récupérer le handle du répertoire depuis IndexedDB
            const savedHandle = await loadDirectoryHandle(`recentImportDir_${dirIndex}`);
            if (savedHandle) {
                options.startIn = savedHandle;
            }

            const [fileHandle] = await window.showOpenFilePicker(options);
            const file = await fileHandle.getFile();

            // Mémoriser le répertoire parent
            try {
                const dirHandle = await fileHandle.getParent?.();
                if (dirHandle) {
                    lastImportDirectoryRef.current = dirHandle;
                    await saveDirectoryHandle('lastImportDirectory', dirHandle);
                    addRecentDirectory('import', dirHandle.name, dirHandle);
                }
            } catch (e) {
                // getParent n'est pas toujours disponible
            }

            const importedData = await importExcelFile(file);

            loadFullState({
                intersectionName: importedData.intersectionName,
                groups: importedData.groups,
                cycleLength: importedData.cycleLength,
                conflictMatrix: importedData.conflictMatrix,
                actionData: importedData.actionData,
                pfTabs: importedData.pfTabs.length > 0 ? importedData.pfTabs : undefined,
                activePFId: 1,
                trafficDatasets: importedData.trafficDatasets
            });

            if (importedData.trafficData && Object.keys(importedData.trafficData).length > 0) {
                importedData.groups.forEach((group) => {
                    const trafficInfo = importedData.trafficData[group.id];
                    if (trafficInfo && trafficInfo.courant) {
                        updateGroupParams(group.id, { courant: trafficInfo.courant });
                    }
                });
            }

            // Afficher le résultat avec les avertissements éventuels
            let message = `Import réussi !\n\n${importedData.groups.length} groupes importés\n${importedData.actionData.length} actions importées`;
            if (importedData.warnings && importedData.warnings.length > 0) {
                message += `\n\n⚠️ Avertissements (${importedData.warnings.length}) :\n${importedData.warnings.join('\n')}`;
            }
            alert(message);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur import Excel:', e);
                alert('Erreur lors de l\'import: ' + e.message);
            }
        }
    };

    // Handle CSV/Excel import
    const handleImport = async () => {
        if (!importFile) {
            setImportError('Veuillez sélectionner un fichier');
            return;
        }

        try {
            const fileExt = importFile.name.toLowerCase().split('.').pop();

            // Handle Excel files
            if (fileExt === 'xlsx' || fileExt === 'xls') {
                const importedData = await importExcelFile(importFile);

                // Load the imported data
                loadFullState({
                    intersectionName: importedData.intersectionName,
                    groups: importedData.groups,
                    cycleLength: importedData.cycleLength,
                    conflictMatrix: importedData.conflictMatrix,
                    actionData: importedData.actionData,
                    pfTabs: importedData.pfTabs.length > 0 ? importedData.pfTabs : undefined,
                    activePFId: 1,
                    trafficDatasets: importedData.trafficDatasets
                });

                // Apply traffic data if available
                if (importedData.trafficData && Object.keys(importedData.trafficData).length > 0) {
                    // Update groups with traffic courant
                    importedData.groups.forEach((group, idx) => {
                        const trafficInfo = importedData.trafficData[group.id];
                        if (trafficInfo && trafficInfo.courant) {
                            updateGroupParams(group.id, { courant: trafficInfo.courant });
                        }
                    });
                }

                setImportModal(false);
                setImportFile(null);
                setImportError('');
                // Afficher le résultat avec les avertissements éventuels
                let message = `Import réussi !\n\n${importedData.groups.length} groupes importés\n${importedData.actionData.length} actions importées`;
                if (importedData.warnings && importedData.warnings.length > 0) {
                    message += `\n\n⚠️ Avertissements (${importedData.warnings.length}) :\n${importedData.warnings.join('\n')}`;
                }
                alert(message);
            }
            // Handle CSV files
            else if (fileExt === 'csv') {
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
            } else {
                setImportError('Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv');
            }
        } catch (err) {
            setImportError(err.message);
        }
    };

    // Handle HTM file selection
    const handleHTMFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setHtmFile(file);
            setHtmImportError('');
        }
    };

    // Parse HTM file to extract traffic light data
    const parseHTMFile = (content) => {
        const groups = [];

        // Parse HTML table rows - look for traffic light data patterns
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        // Try to find tables with traffic light data
        const tables = doc.querySelectorAll('table');

        for (const table of tables) {
            const rows = table.querySelectorAll('tr');

            for (const row of rows) {
                const cells = row.querySelectorAll('td, th');
                if (cells.length >= 4) {
                    // Try to extract group data from cells
                    const cellTexts = Array.from(cells).map(c => c.textContent.trim());

                    // Look for patterns like: group name, green duration, orange, red
                    const nameCell = cellTexts[0];
                    const greenVal = parseInt(cellTexts[1]) || parseInt(cellTexts[2]);
                    const orangeVal = parseInt(cellTexts[2]) || parseInt(cellTexts[3]) || 3;

                    if (nameCell && greenVal > 0) {
                        groups.push({
                            id: groups.length + 1,
                            name: nameCell,
                            type: nameCell.toLowerCase().includes('pieton') ? 'Piéton' :
                                  nameCell.toLowerCase().includes('cycle') ? 'Cycliste' : 'VL',
                            minGreen: 6,
                            offset: 0,
                            durations: {
                                green: greenVal,
                                orange: orangeVal,
                                red: 0
                            }
                        });
                    }
                }
            }
        }

        // If no tables found, try to parse structured text
        if (groups.length === 0) {
            const lines = content.split('\n');
            for (const line of lines) {
                // Look for patterns like "GF1: 30s vert, 3s orange"
                const match = line.match(/([A-Za-z0-9]+)\s*[:]\s*(\d+)/);
                if (match) {
                    const greenMatch = line.match(/(\d+)\s*s?\s*(vert|green)/i);
                    const orangeMatch = line.match(/(\d+)\s*s?\s*(orange|jaune)/i);

                    if (greenMatch) {
                        groups.push({
                            id: groups.length + 1,
                            name: match[1],
                            type: 'VL',
                            minGreen: 6,
                            offset: 0,
                            durations: {
                                green: parseInt(greenMatch[1]) || 0,
                                orange: orangeMatch ? parseInt(orangeMatch[1]) : 3,
                                red: 0
                            }
                        });
                    }
                }
            }
        }

        return groups;
    };

    // Handle HTM import
    const handleHTMImport = () => {
        if (!htmFile) {
            setHtmImportError('Veuillez sélectionner un fichier HTM');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const parsedGroups = parseHTMFile(content);

                if (parsedGroups.length === 0) {
                    setHtmImportError('Aucune donnée de groupe de feu trouvée dans le fichier HTM');
                    return;
                }

                const fileName = htmFile.name.replace(/\.htm[l]?$/i, '');
                const fileId = Date.now().toString();

                // Create new imported file entry
                const newFile = {
                    id: fileId,
                    name: fileName,
                    importedAt: new Date().toISOString(),
                    data: {
                        groups: parsedGroups,
                        cycleLength: cycleLength
                    }
                };

                // Save to imported files list
                const updatedFiles = [...importedHTMFiles, newFile];
                setImportedHTMFiles(updatedFiles);
                localStorage.setItem('importedHTMFiles', JSON.stringify(updatedFiles));

                // Load the data as a new project
                loadFullState({
                    intersectionName: fileName,
                    groups: parsedGroups,
                    cycleLength: cycleLength
                });

                setImportHTMModal(false);
                setHtmFile(null);
                setHtmImportError('');
            } catch (err) {
                setHtmImportError('Erreur lors de la lecture du fichier: ' + err.message);
            }
        };
        reader.onerror = () => {
            setHtmImportError('Erreur lors de la lecture du fichier');
        };
        reader.readAsText(htmFile);
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

    // Render arrow SVG for floating image
    const renderFloatingArrowSVG = (courant, color, arrowLength = 1, turnLength = 1) => {
        const strokeWidth = 3;
        const thinStrokeWidth = 2;
        const size = 32;

        switch (courant) {
            case 'TD':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàD': {
                const tadEndX = 14 + (12 * turnLength);
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d={`M8,24 L8,12 Q8,8 12,8 L${tadEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${tadEndX - 6},2 ${tadEndX},8 ${tadEndX - 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'TàG': {
                const tagEndX = 18 - (12 * turnLength);
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d={`M24,24 L24,12 Q24,8 20,8 L${tagEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${tagEndX + 6},2 ${tagEndX},8 ${tagEndX + 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'TDTàD':
            case 'TD-TàD':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="12" y1="28" x2="12" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="6,14 12,8 18,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12,20 Q20,20 20,12 L20,8" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="16,12 20,8 24,12" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TDTàG':
            case 'TD-TàG':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="20" y1="28" x2="20" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="14,14 20,8 26,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20,20 Q12,20 12,12 L12,8" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="8,12 12,8 16,12" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TD_G_D':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="10,14 16,8 22,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16,20 Q8,20 8,12 L8,10" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="4,14 8,10 12,14" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16,20 Q24,20 24,12 L24,10" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="20,14 24,10 28,14" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'Piéton':
            case 'Cycle': {
                const extendedHeight = size + (arrowLength - 1) * 24;
                const viewBoxHeight = 32 + (arrowLength - 1) * 24;
                const topY = 6;
                const bottomY = 26 + (arrowLength - 1) * 24;
                const centerY = (topY + bottomY) / 2;
                return (
                    <svg width={size} height={extendedHeight} viewBox={`0 0 32 ${viewBoxHeight}`}>
                        <line x1="16" y1={centerY} x2="16" y2={topY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${topY + 5} 16,${topY} 21,${topY + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="16" y1={centerY} x2="16" y2={bottomY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${bottomY - 5} 16,${bottomY} 21,${bottomY - 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            default:
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
        }
    };

    // Afficher l'écran de connexion si non authentifié
    if (!isAuthenticated) {
        return (
            <LoginModal
                onLogin={login}
                onCreateUser={createUser}
                hasUsers={hasUsers()}
                isLoading={authLoading}
            />
        );
    }

    return (
        <div className="app-container">
            <MenuBar
                    onAction={handleMenuAction}
                    arrowStyle={diagramArrowStyle}
                    onArrowStyleChange={setDiagramArrowStyle}
                    importedFiles={importedHTMFiles}
                    recentDirectories={getRecentDirectoriesForMenu()}
                    recentOpenDirs={recentOpenDirs}
                    recentImportDirs={recentImportDirs}
                    recentSaveDirs={recentSaveDirs}
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    onManageUsers={() => setShowUserManager(true)}
                />
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
                        GFx
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
                    <label style={{ marginLeft: '1rem', color: '#aaa', fontSize: '0.9em' }}>
                        Zoom:
                        <input
                            type="range"
                            min="4" max="20"
                            value={pixelsPerSecond}
                            onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))}
                            style={{ verticalAlign: 'middle', margin: '0 5px', width: '55px' }}
                        />
                        {pixelsPerSecond}px/s
                    </label>
                    <button
                        className={`toggle-btn ${!sidebarVisible ? 'active' : ''}`}
                        onClick={() => setSidebarVisible(!sidebarVisible)}
                        title={sidebarVisible ? "Masquer le panneau de configuration" : "Afficher le panneau de configuration"}
                        style={{ marginLeft: '1rem' }}
                    >
                        {sidebarVisible ? '◀ Paramètre' : '▶ Paramètre'}
                    </button>
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
                    {showDependencies && (
                        <input
                            type="number"
                            min="1"
                            max="99"
                            value={dependencyGap}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 20;
                                setDependencyGap(Math.max(1, Math.min(99, val)));
                            }}
                            className="input-dependency-gap"
                            title="Écart maximum pour afficher les dépendances (secondes)"
                        />
                    )}
                </div>

                <div className="status-bar">
                    {activeConflicts.length > 0 ? (
                        <div className="status-error">
                            {activeConflicts.length} CONFLITS !
                        </div>
                    ) : (
                        <div
                            className="status-ok status-clickable"
                            onClick={() => {
                                const activePF = pfTabs.find(pf => pf.id === activePFId);
                                if (activePF?.color) {
                                    setPFColor(activePFId, null);
                                } else {
                                    setPFColor(activePFId, '#4CAF50');
                                }
                            }}
                            title={pfTabs.find(pf => pf.id === activePFId)?.color ? "Cliquez pour invalider ce plan de feux" : "Cliquez pour valider ce plan de feux"}
                        >
                            {pfTabs.find(pf => pf.id === activePFId)?.color ? 'Validé' : 'Valider'}
                        </div>
                    )}
                </div>

                <div className="user-info">
                    <span className="user-name" title={`Permissions: ${PERMISSIONS[currentUser?.permissions]?.label || 'Inconnues'}`}>
                        {currentUser?.username}
                        {currentUser?.isAdmin && ' (Admin)'}
                    </span>
                    <button
                        className="logout-btn"
                        onClick={logout}
                        title="Se déconnecter"
                    >
                        Déconnexion
                    </button>
                </div>
            </header>

            <main className="split-view" ref={splitViewRef}>
                <aside className="sidebar" style={{
                    width: sidebarVisible ? `${sidebarWidth}px` : '0px',
                    minWidth: sidebarVisible ? '300px' : '0px',
                    padding: sidebarVisible ? '1rem' : '0',
                    overflow: 'hidden'
                }}>
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
                                            className={`phasage-group-item ${isVisible ? 'checked' : ''} ${!hasArrow ? 'no-arrow' : ''} ${hoveredPhasageGroupId === g.id ? 'hovered' : ''}`}
                                            onMouseEnter={() => hasArrow && setHoveredPhasageGroupId(g.id)}
                                            onMouseLeave={() => setHoveredPhasageGroupId(null)}
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
                            activeTrafficDataset={activeTrafficDataset}
                            getTrafficData={getTrafficData}
                        />
                    ) : (
                        <>
                            <div className="sidebar-tabs">
                                <button
                                    className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('config');
                                        setSidebarWidth(450);
                                    }}
                                >
                                    Configuration
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('matrix');
                                        // Calculate optimal width for matrix:
                                        // Find longest group name to calculate Nom column width
                                        const maxNameLength = Math.max(3, ...groups.map(g => (g.name || '').length));
                                        const nomColWidth = Math.max(70, maxNameLength * 7); // ~7px per character at 0.75em font-size
                                        // Row header (24px) + Nom col (variable) + data cells (19px each with border) + first header col (19px) + padding (51px)
                                        const matrixWidth = 24 + nomColWidth + (groups.length * 19) + 19 + 51;
                                        setSidebarWidth(Math.min(1200, Math.max(300, matrixWidth)));
                                    }}
                                >
                                    Matrice
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'traffic' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('traffic');
                                        // Set width to display full traffic table (optimized)
                                        // Grp(28) + Nom(160) + inputs(38*6) + padding
                                        setSidebarWidth(520);
                                    }}
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
                                            activePFId={activePFId}
                                            pfTabs={pfTabs}
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === 'matrix' && (
                                <IntergreenMatrix
                                    conflictMatrix={conflictMatrix}
                                    setMatrixValue={setMatrixValue}
                                    groups={groups}
                                    cycleLength={cycleLength}
                                    actionData={actionData}
                                    activePFId={activePFId}
                                    pfTabs={pfTabs}
                                />
                            )}

                            {activeTab === 'traffic' && (
                                <TrafficTable
                                    groups={groups}
                                    cycleLength={cycleLength}
                                    activeTrafficDataset={activeTrafficDataset}
                                    setActiveTrafficDataset={setActiveTrafficDataset}
                                    updateTrafficData={updateTrafficData}
                                    getTrafficData={getTrafficData}
                                    updateGroupParams={updateGroupParams}
                                    setHoveredGroupId={setHoveredArrowGroupId}
                                    hoveredGroupId={hoveredArrowGroupId}
                                    trafficDatasetNames={trafficDatasetNames}
                                    setHoveredVUtile={setHoveredVUtile}
                                    copyTrafficDataset={copyTrafficDataset}
                                    actionData={actionData}
                                    simulationSelectedActions={simulationSelectedActions}
                                />
                            )}

                            {filteredConflicts.length > 0 && (
                                <div className="conflict-list">
                                    <h4>Conflits:</h4>
                                    <ul>
                                        {filteredConflicts.map((c, i) => {
                                            const grayed = isConflictGrayed(c);
                                            const fromGroup = groups.find(g => g.id === c.from);
                                            const toGroup = groups.find(g => g.id === c.to);
                                            const flagLabel = fromGroup?.phaseFlag;
                                            return (
                                                <li
                                                    key={i}
                                                    onMouseEnter={() => setHoveredConflict({ from: c.from, to: c.to })}
                                                    onMouseLeave={() => setHoveredConflict(null)}
                                                    style={{ cursor: 'pointer', opacity: grayed ? 0.4 : 1 }}
                                                >
                                                    {c.type === 'intergreen' ? (
                                                        <>GF{c.from} → GF{c.to} : Dégagement insuffisant ({c.actual.toFixed(1)}s / {c.required}s requis)</>
                                                    ) : (
                                                        <>GF{c.from} ↔ GF{c.to} : {c.message}</>
                                                    )}
                                                    {grayed && <span style={{ marginLeft: 6, fontSize: '0.85em', color: '#888' }}>({flagLabel === 'a' ? 'aiguillage' : 'escamotage'})</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* Répertoires mémorisés */}
                            {(recentOpenDirs.length > 0 || recentSaveDirs.length > 0) && (
                                <div className="directories-info">
                                    <h4>Répertoires mémorisés</h4>
                                    {recentOpenDirs.length > 0 && (
                                        <div className="dir-row">
                                            <span className="dir-label">Ouvrir:</span>
                                            <span className="dir-value" title={recentOpenDirs[0].name}>{recentOpenDirs[0].name}</span>
                                        </div>
                                    )}
                                    {recentSaveDirs.length > 0 && (
                                        <div className="dir-row">
                                            <span className="dir-label">Enregistrer:</span>
                                            <span className="dir-value" title={recentSaveDirs[0].name}>{recentSaveDirs[0].name}</span>
                                        </div>
                                    )}
                                    {recentImportDirs.length > 0 && (
                                        <div className="dir-row">
                                            <span className="dir-label">Importer:</span>
                                            <span className="dir-value" title={recentImportDirs[0].name}>{recentImportDirs[0].name}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </aside>

                {/* Resizable divider */}
                {sidebarVisible && (
                    <div
                        className={`resize-divider ${isResizing ? 'resizing' : ''}`}
                        onMouseDown={handleResizeStart}
                    />
                )}

                <section className="diagram-area" ref={diagramAreaRef} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* PF Tabs */}
                    <div className="pf-tabs-bar">
                        {pfTabs.map((pf, index) => (
                            <div
                                key={pf.id}
                                className={`pf-tab ${activePFId === pf.id && !simulationEnabled && !phasageBulleEnabled ? 'active' : ''} ${draggedTabIndex === index ? 'dragging' : ''}`}
                                style={pf.color ? {
                                    borderTopColor: pf.color,
                                    borderTopWidth: '3px',
                                    borderTopStyle: 'solid'
                                } : {}}
                                draggable="true"
                                onDragStart={(e) => {
                                    setDraggedTabIndex(index);
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedTabIndex !== null && draggedTabIndex !== index) {
                                        reorderPF(draggedTabIndex, index);
                                    }
                                    setDraggedTabIndex(null);
                                }}
                                onDragEnd={() => {
                                    setDraggedTabIndex(null);
                                }}
                                onClick={() => {
                                    setSimulationEnabled(false);
                                    setPhasageBulleEnabled(false);
                                    setActivePFId(pf.id);
                                    // Sync traffic dataset if tab name matches a dataset
                                    if (TRAFFIC_DATASETS.includes(pf.name)) {
                                        setActiveTrafficDataset(pf.name);
                                    }
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    const newName = prompt('Nouveau nom de l\'onglet:', pf.name);
                                    if (newName && newName.trim() !== '') {
                                        renamePF(pf.id, newName.trim());
                                    }
                                }}
                                data-pf-tooltip="Glissez pour réordonner, double-cliquez pour renommer"
                            >
                                <span className="pf-tab-name">{pf.name}</span>
                            </div>
                        ))}
                        <div
                            className={`pf-tab simulation-tab ${simulationEnabled && !phasageBulleEnabled ? 'active' : ''}`}
                            onClick={() => {
                                setPhasageBulleEnabled(false);
                                const newSimState = !simulationEnabled;
                                setSimulationEnabled(newSimState);
                                if (newSimState) {
                                    // Largeur pour le tableau Données Trafic:
                                    // Grp(28) + Nom(70) + Déb(35) + Fin(35) + V(35) + V.U(35) + Cap.U(40) + Ret(35) + File(35) + spacing(27) + padding(20)
                                    setSidebarWidth(395);
                                }
                            }}
                            title="Activer/désactiver le mode simulation"
                        >
                            <span className="pf-tab-name">Simulation</span>
                        </div>
                        <div
                            className={`pf-tab phasage-tab ${phasageBulleEnabled ? 'active' : ''}`}
                            onClick={() => {
                                setSimulationEnabled(false);
                                if (!phasageBulleEnabled) {
                                    // Ouvrir la configuration quand on active le phasage bulle
                                    setPhasageBulleModal(true);
                                }
                                setPhasageBulleEnabled(!phasageBulleEnabled);
                            }}
                            title="Afficher le phasage en bulles"
                        >
                            <span className="pf-tab-name">Phasage bulle</span>
                        </div>

                        {/* Cycle length input - positioned at the right of tabs */}
                        <div className="pf-tabs-spacer"></div>
                        <label className="cycle-input-label">
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
                    </div>

                    {!phasageBulleEnabled && (
                        <div
                            className="diagram-panel"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: diagramHeight !== null ? `${diagramHeight}px` : 'auto',
                                minHeight: diagramHeight !== null ? `${diagramHeight}px` : 'auto',
                                maxHeight: diagramHeight !== null ? `${diagramHeight}px` : 'none',
                                overflow: diagramHeight !== null ? 'auto' : 'visible'
                            }}
                        >
                            <TimelineDiagram
                                groups={groups}
                                globalTime={globalTime}
                                getGroupState={getGroupState}
                                onGroupClick={(g) => setSelectedGroupId(g.id)}
                                pixelsPerSecond={pixelsPerSecond}
                                conflicts={filteredConflicts}
                                conflictMatrix={conflictMatrix}
                                updateGroupParams={updateGroupParams}
                                cycleLength={cycleLength}
                                actionData={actionData}
                                updateActionRow={updateActionRow}
                                startDrag={startDrag}
                                endDrag={endDrag}
                                showDependencies={showDependencies}
                                dependencyGap={dependencyGap}
                                hoveredActionId={hoveredActionId}
                                setHoveredActionId={setHoveredActionId}
                                simulationFilter={simulationEnabled ? new Set(simulationSelectedActions) : null}
                                simulationResult={simulationResult}
                                simulationCurrentTime={simulationEnabled ? simulationCurrentTime : null}
                                isPlayingSimulation={simulationEnabled && isPlayingSimulation}
                                hoveredArrowGroupId={hoveredArrowGroupId}
                                hoveredConflict={hoveredConflict}
                                setHoveredGroupId={setHoveredArrowGroupId}
                                setHoveredDiagramTime={setHoveredDiagramTime}
                                hoveredVUtile={hoveredVUtile}
                                planName={simulationEnabled ? (pfTabs.find(pf => pf.id === activePFId)?.name || '') : ''}
                                remarques={currentRemarques}
                                updateRemarques={updatePFRemarques}
                            />
                        </div>
                    )}

                    {/* Horizontal resizable divider */}
                    {!phasageBulleEnabled && (
                        <div
                            className={`horizontal-resize-divider ${isResizingDiagram ? 'resizing' : ''}`}
                            onMouseDown={handleDiagramResizeStart}
                            onDoubleClick={resetDiagramHeight}
                            title="Faites glisser pour redimensionner. Double-clic pour réinitialiser."
                        >
                            <div className="horizontal-resize-handle"></div>
                        </div>
                    )}

                    <div className="action-panel" style={{
                        borderTop: phasageBulleEnabled ? 'none' : 'none',
                        marginTop: phasageBulleEnabled ? 0 : 0,
                        flex: diagramHeight !== null ? '1' : '0 0 auto',
                        overflow: (phasageBulleEnabled || simulationEnabled) ? 'auto' : 'hidden'
                    }}>
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
                                planName={pfTabs.find(pf => pf.id === activePFId)?.name || ''}
                                initialTimes={phasageBulleTimes}
                                initialCount={phasageBulleCount}
                                hoveredGroupId={hoveredPhasageGroupId}
                                setHoveredGroupId={setHoveredPhasageGroupId}
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
                                conflictMatrix={conflictMatrix}
                                lastImageDirectoryRef={lastImageDirectoryRef}
                                saveDirectoryHandle={saveDirectoryHandle}
                                recentImageDirs={recentImageDirs}
                                addRecentDirectory={addRecentDirectory}
                                onShowFloatingImage={() => setShowFloatingImage(true)}
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
                                microCustomFields={microCustomFields}
                                updateMicroCustomField={updateMicroCustomField}
                                onResizePanel={handleActionPanelResize}
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
                                {getAllSaves().map((project) => {
                                    const formatDate = (isoString) => {
                                        if (!isoString) return '-';
                                        const date = new Date(isoString);
                                        return date.toLocaleDateString('fr-FR', {
                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        });
                                    };
                                    const formatSize = (bytes) => {
                                        if (!bytes) return '-';
                                        return `${(bytes / 1024).toFixed(1)} Ko`;
                                    };
                                    return (
                                        <li
                                            key={project.name}
                                            className={selectedProject === project.name ? 'selected' : ''}
                                            onClick={() => setSelectedProject(project.name)}
                                            onDoubleClick={() => {
                                                setSelectedProject(project.name);
                                                loadProject(project.name);
                                                setOpenModal(false);
                                                setSelectedProject(null);
                                            }}
                                        >
                                            <span className="project-icon"></span>
                                            <div className="project-info-modal">
                                                <span className="project-name">{project.name}</span>
                                                <span className="project-details-modal">{formatDate(project.savedAt)} - {formatSize(project.size)}</span>
                                            </div>
                                        </li>
                                    );
                                })}
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

            {/* Modal Réduire */}
            <Modal isOpen={reduceModal} onClose={() => setReduceModal(false)} title="Réduire une plage">
                <div className="form-row">
                    <label>
                        À partir de la seconde :
                        <input
                            type="number"
                            min="0"
                            max={cycleLength - 1}
                            value={reduceStart}
                            onChange={(e) => setReduceStart(parseInt(e.target.value) || 0)}
                        />
                    </label>
                </div>
                <div className="form-row">
                    <label>
                        Durée à supprimer (secondes) :
                        <input
                            type="number"
                            min="1"
                            max={cycleLength - reduceStart}
                            value={reduceDuration}
                            onChange={(e) => setReduceDuration(parseInt(e.target.value) || 1)}
                        />
                    </label>
                </div>
                <p style={{ color: '#888', fontSize: '0.85em', marginTop: '8px' }}>
                    Tous les groupes commençant après la seconde {reduceStart + reduceDuration} seront décalés de -{reduceDuration}s.<br />
                    La durée du cycle passera de {cycleLength}s à {Math.max(1, cycleLength - reduceDuration)}s.
                </p>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setReduceModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleReduce}>
                        Réduire
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
                        <span>Signal aide conduite</span>
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
            <Modal isOpen={helpModal} onClose={() => setHelpModal(false)} title="Aide - Diagramme de Feux" className="modal-wide">
                <div className="help-content">
                    <h3 style={{ color: '#4ecdc4', borderBottom: '1px solid #4ecdc4', paddingBottom: '8px', marginBottom: '16px' }}>Chapitre 1 — Boite à outils d'optimisation des diagrammes de feu</h3>
                    <section className="help-section">
                        <h4>Présentation</h4>
                        <p>Application de conception de diagrammes de feux de signalisation pour carrefours à feux.</p>
                    </section>

                    <section className="help-section">
                        <h4>Interface principale</h4>
                        <ul>
                            <li><strong>En-tête :</strong> Nom du carrefour, nombre de groupes, durée du cycle, zoom</li>
                            <li><strong>Panneau gauche :</strong> Onglets Projets, Configuration et Trafic</li>
                            <li><strong>Zone centrale :</strong> Diagramme temporel et tableau des conditions de micro-régulation</li>
                            <li><strong>Onglets PF :</strong> Gérez plusieurs plans de feux (PF1, PF2...) avec le bouton "+"</li>
                            <li><strong>Indicateur Valider/Validé :</strong> Cliquez sur "Valider" (quand aucun conflit) pour marquer l'onglet PF en vert. Cliquez à nouveau pour annuler la validation.</li>
                            <li><strong>Séparateur ajustable :</strong> La position du séparateur entre le diagramme et les conditions de micro-régulation est sauvegardée avec le projet.</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Configuration des groupes</h4>
                        <ul>
                            <li><strong>Type :</strong> Catégorie d'usager du groupe de feux
                                <ul>
                                    <li><em>VL :</em> Véhicules légers (voitures, motos)</li>
                                    <li><em>TC :</em> Transports en commun (bus, tramway)</li>
                                    <li><em>Cycliste :</em> Pistes cyclables</li>
                                    <li><em>Piéton :</em> Passages piétons</li>
                                </ul>
                            </li>
                            <li><strong>Courant :</strong> Identification du mouvement de trafic associé au groupe de feux (ex: "Entrée Nord", "Tourne-à-gauche Est")</li>
                            <li><strong>J (Jaune) :</strong> Durée du feu jaune/orange pour les véhicules. <em>Pour les types Piéton et Cycliste, ce champ correspond au temps de dégagement (affiché dans le diagramme après le vert).</em></li>
                            <li><strong>Vm (Vert minimum) :</strong> Durée minimale du vert garantie, utilisée pour les calculs de micro-régulation</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Matrice des temps interverts</h4>
                        <p>Définit les temps de dégagement (intervert) entre groupes conflictuels.
                        Valeurs acceptées : 3 à 20 secondes.</p>
                    </section>

                    <section className="help-section">
                        <h4>Diagramme</h4>
                        <ul>
                            <li><strong>DA (Délai d'approche) :</strong> Temps nécessaire pour qu'un véhicule atteigne la ligne de feu depuis le détecteur d'approche</li>
                            <li><strong>Déb (Début de vert) :</strong> Position de départ du vert dans le cycle (en secondes depuis le début du cycle)</li>
                            <li><strong>Fin (Fin de vert) :</strong> Position de fin du vert dans le cycle (en secondes depuis le début du cycle)</li>
                            <li><strong>V (Vert) :</strong> Durée du feu vert, calculée automatiquement comme la différence entre Fin et Déb</li>
                            <li><strong>Indicateur aiguillage/escamotage :</strong> Cliquez sur un nom de groupe puis utilisez <em>Alt+A</em> (aiguillage) ou <em>Alt+E</em> (escamotage) pour marquer le groupe. Un petit "a" ou "e" apparaît à côté du nom. Les conflits où ce groupe est en première position (GFx dans "GFx ↔ GFy") sont alors grisés et non comptabilisés, ce qui peut permettre de valider le plan de feux.</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Conditions de micro-régulation</h4>
                        <p>Permet de définir des actions spéciales sur le diagramme. Survolez une ligne pour mettre en surbrillance l'action correspondante dans le diagramme (et inversement).</p>
                        <ul>
                            <li><strong>Adaptatif vertical :</strong> Zone d'adaptation du temps de vert (rectangle bleu). Utilisez Plage1/Plage2 pour définir les groupes concernés.</li>
                            <li><strong>Contrôle de flot :</strong> Contrôle du flux de trafic. Affiche une barre intermittente jaune/gris de DEB à (DEB + Vert minimum), puis orange pour la durée de jaune, puis rouge jusqu'à FIN.</li>
                            <li><strong>Seconde lucarne :</strong> Deuxième phase de vert (vert foncé + orange). Crée une barre supplémentaire sur la ligne du groupe.</li>
                            <li><strong>Escamotage de phase :</strong> Phase pouvant être supprimée (rectangle gris transparent sur toute la hauteur).</li>
                            <li><strong>Escamotage :</strong> Escamotage lié à un groupe spécifique. Définissez GF (source) et Action GF 1 (cible) pour afficher les flèches de dépendance. Si les valeurs Déb et Fin sont renseignées, le rectangle hachuré est positionné sur cette plage au lieu de la phase verte par défaut du groupe, ce qui permet de cibler une seconde lucarne.</li>
                            <li><strong>Ouverture anticipée :</strong> Anticipation du passage au vert (barre hachurée verte).</li>
                            <li><strong>Fermeture anticipée :</strong> Anticipation du passage au rouge (accolade orange sous la barre).</li>
                            <li><strong>Signal aide conduite :</strong> Signal d'information conducteur (orange clignotant + bleu fixe).</li>
                            <li><strong>Début/Fin de bande passante :</strong> Ligne discontinue affichant la synchronisation à l'ouverture ou à la fermeture entre 2 groupes de feu.</li>
                            <li><strong>Priorité piétons :</strong> Action pour la priorité aux piétons.</li>
                            <li><strong>Instant Co :</strong> Point de synchronisation dans le cycle. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
                            <li><strong>Point de repos :</strong> Point de repos dans le cycle. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
                            <li><strong>Synchro BTS :</strong> Synchronisation avec le système BTS. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
                        </ul>

                        <h5 style={{ marginTop: '20px', marginBottom: '10px', color: '#aaa' }}>Légende des symboles</h5>
                        <div className="legend-container" style={{ gap: '8px' }}>
                            <div className="legend-item">
                                <div className="legend-preview legend-adaptatif"></div>
                                <span>Adaptatif vertical</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-controle-flot">
                                    <div className="legend-cf-intermittent"></div>
                                    <div className="legend-cf-orange"></div>
                                    <div className="legend-cf-red"></div>
                                </div>
                                <span>Contrôle de flot</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-bande-debut">
                                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                        <line x1="5" y1="2" x2="58" y2="16" stroke="#00cc00" strokeWidth="0.8" strokeDasharray="4,3" />
                                        <path d="M58,16 L68,18 L62,10 Z" fill="#00cc00" />
                                    </svg>
                                </div>
                                <span>Début de bande passante</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-escamotage-group">
                                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                        <defs>
                                            <pattern id="help-escam-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(-45)">
                                                <line x1="0" y1="0" x2="0" y2="4" stroke="#1565C0" strokeWidth="2" />
                                            </pattern>
                                        </defs>
                                        <rect x="20" y="5" width="40" height="10" fill="url(#help-escam-hatch)" stroke="#1565C0" strokeWidth="0.5" strokeDasharray="2,2" />
                                        <line x1="5" y1="3" x2="20" y2="10" stroke="#1565C0" strokeWidth="0.8" strokeDasharray="3,2" />
                                        <line x1="75" y1="3" x2="60" y2="10" stroke="#1565C0" strokeWidth="0.8" strokeDasharray="3,2" />
                                    </svg>
                                </div>
                                <span>Escamotage</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-escamotage"></div>
                                <span>Escamotage de phase</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-fermeture">
                                    <span className="brace-point"></span>
                                </div>
                                <span>Fermeture anticipée</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-bande-fin">
                                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                        <line x1="5" y1="2" x2="58" y2="16" stroke="#00cc00" strokeWidth="0.8" strokeDasharray="4,3" />
                                        <path d="M58,16 L68,18 L62,10 Z" fill="#00cc00" />
                                    </svg>
                                </div>
                                <span>Fin de bande passante</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-instant-co"></div>
                                <span>Instant Co</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-ouverture"></div>
                                <span>Ouverture anticipée</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-point-repos"></div>
                                <span>Point de repos</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-priorite-pietons"></div>
                                <span>Priorité piétons</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-lucarne"></div>
                                <span>Seconde lucarne</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-signa">
                                    <div className="legend-signa-orange"></div>
                                    <div className="legend-signa-blue"></div>
                                </div>
                                <span>Signal aide conduite</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-synchro-bts"></div>
                                <span>Synchro BTS</span>
                            </div>
                        </div>
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
                            <li><strong>Réduire :</strong> Réduit la plage de temps dans le cycle à une position donnée</li>
                            <li><strong>Déplacer un groupe :</strong> Déplace un groupe vers le haut ou le bas. <em>Cette action synchronise automatiquement les données (diagramme, matrice, actions) dans tous les plans de feux.</em></li>
                            <li><strong>Options :</strong> Affiche la légende visuelle des actions</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Image du carrefour</h4>
                        <p>L'image du carrefour affiche les flèches des groupes de feux avec un code couleur dynamique :</p>
                        <ul>
                            <li><strong>Survol du diagramme :</strong> En survolant le diagramme, les flèches changent de couleur selon la phase à l'instant survolé :
                                <ul>
                                    <li><span style={{color: '#00cc00'}}>Vert</span> : Phase verte normale</li>
                                    <li><span style={{color: '#00aa00'}}>Vert foncé</span> : Seconde lucarne active</li>
                                    <li><span style={{color: '#ff9900'}}>Orange</span> : Phase orange/jaune</li>
                                    <li><span style={{color: '#cc0000'}}>Rouge</span> : Phase rouge</li>
                                </ul>
                            </li>
                            <li><strong>Mode simulation :</strong> Les flèches suivent le temps de la simulation en cours</li>
                            <li><strong>Escamotage :</strong> Quand un escamotage est actif, la flèche du groupe cible passe à l'orange puis au rouge pendant la zone de coupure</li>
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
                        <h4>Commentaires et Remarques</h4>
                        <p>Les champs Commentaire (par groupe) et Remarques (par plan de feu) permettent d'ajouter des annotations :</p>
                        <ul>
                            <li><strong>Coloration du texte :</strong> Sélectionnez du texte puis appuyez sur <span style={{color: '#4CAF50'}}>+</span> (vert) ou <span style={{color: '#F44336'}}>−</span> (rouge)</li>
                            <li><strong>Coloration de toute la ligne :</strong> Sans sélection, + ou − colore tout le contenu</li>
                            <li><strong>Basculer en blanc :</strong> Si une ligne entière est déjà colorée, appuyez à nouveau sur + ou − pour supprimer la couleur</li>
                            <li><strong>Infobulle :</strong> L'infobulle s'affiche après 20 secondes de survol</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Données Trafic</h4>
                        <p>L'onglet Trafic permet de saisir les données de trafic par groupe :</p>
                        <ul>
                            <li><strong>Coef :</strong> Coefficient de voie correspondant aux courants de circulation du groupe de feu (partagé entre tous les jeux de données)</li>
                            <li><strong>Trafic :</strong> Volume de trafic (véh/h) - spécifique à chaque jeu de données. Appuyez sur la touche <em>c</em> pour indiquer un trafic coordonné : un petit "c" apparaît à côté de la valeur et les colonnes Retard et File d'attente sont mises à 0. Appuyez à nouveau sur <em>c</em> pour retirer la coordination.</li>
                            <li><strong>V.Utile :</strong> Durée de vert nécessaire pour passer le trafic. Formule = Trafic / (1800 × Coef / Cycle)</li>
                            <li><strong>Cap.U :</strong> Capacité utilisée pour passer le trafic affecté au groupe de feu. Formule = (V.Utile / Vert total) × 100%</li>
                            <li><strong>Retard :</strong> Temps d'attente théorique moyen en pied de feu hors saturation. Formule = (Cycle - Vert total)² / (2 × Cycle × (1 - Trafic / (1800 × Coef))). <em>Si une action "Début de bande passante" cible ce groupe (Action GF), alors Retard = max(0, Début de vert - Fin de l'action).</em></li>
                            <li><strong>File d'attente :</strong> File d'attente théorique maximale hors saturation. Formule = (partie entière de (Trafic × (Cycle - Vert total) / 3600 / Coef) + 1) × 6 mètres. <em>Si une action "Début de bande passante" cible ce groupe (Action GF), alors File d'attente = max(0, Début de vert - Fin de l'action).</em></li>
                            <li><strong>Vert total :</strong> Les calculs de Cap.U, Retard et File d'attente prennent en compte le temps de vert principal + la durée des secondes lucarnes du groupe.</li>
                        </ul>
                        <p><strong>Surbrillance interactive :</strong> Le survol des champs Coef, Trafic, V.Utile, Cap.U, Retard ou File d'attente met en surbrillance la barre correspondante dans le diagramme.</p>
                        <p><strong>Jeux de données :</strong> La listbox "Associé à" permet de basculer entre plusieurs jeux de données trafic (HPM, HPS, etc.). Chaque jeu de données conserve ses propres valeurs de trafic.</p>
                        <p><strong>Bouton Coller :</strong> Si le jeu de données sélectionné est vide, un bouton "Coller..." apparaît pour copier les données depuis un autre jeu de données.</p>
                        <p><strong>Code couleur Cap.U :</strong></p>
                        <ul>
                            <li><span style={{color: '#4caf50'}}>Vert</span> : &lt; 76% (fluide)</li>
                            <li><span style={{color: '#ff9800'}}>Orange</span> : 76-85% (chargé)</li>
                            <li><span style={{color: '#f44336'}}>Rouge</span> : 86-100% (saturé)</li>
                            <li><span style={{color: '#000', background: '#ff6b6b', padding: '0 4px'}}>Noir/Rouge</span> : &gt; 100% (sursaturé)</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Authentification</h4>
                        <p>L'application nécessite une connexion pour accéder aux fonctionnalités :</p>
                        <ul>
                            <li><strong>Premier utilisateur :</strong> Le premier compte créé devient automatiquement administrateur</li>
                            <li><strong>Niveaux de permissions :</strong></li>
                            <ul>
                                <li><em>Lecture seule :</em> Consultation uniquement (ouvrir, imprimer, onde verte)</li>
                                <li><em>Modification partielle :</em> Ouvrir, enregistrer, importer Excel, imprimer, dupliquer</li>
                                <li><em>Modification totale :</em> Toutes les fonctionnalités + gestion des utilisateurs</li>
                            </ul>
                            <li><strong>Gestion des utilisateurs :</strong> Menu "Utilisateurs" (admin uniquement) pour créer, modifier ou supprimer des comptes</li>
                            <li><strong>Import/Export :</strong> Possibilité d'exporter et importer la liste des utilisateurs en JSON</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Sauvegarde et projets</h4>
                        <ul>
                            <li><strong>Sauvegarde automatique :</strong> Les données sont sauvegardées automatiquement dans le navigateur</li>
                            <li><strong>Projets nommés :</strong> Utilisez l'onglet Projets pour sauvegarder et charger des configurations</li>
                            <li><strong>Export :</strong> Menu Fichier → Exporter pour télécharger un fichier JSON</li>
                            <li><strong>Import JSON :</strong> Menu Fichier → Importer pour charger un fichier JSON</li>
                            <li><strong>Répertoires récents :</strong> Les menus "Ouvrir", "Importer Excel" et "Charger image" proposent les 5 derniers répertoires utilisés</li>
                            <li><strong>Sauvegarde complète :</strong> Chaque plan de feux (PF) conserve sa propre matrice de dégagement et ses données de diagramme</li>
                        </ul>
                        <h5 style={{ marginTop: '15px', marginBottom: '10px', color: '#aaa' }}>Sécurité de la sauvegarde</h5>
                        <p>L'application inclut des protections contre la perte de données :</p>
                        <ul>
                            <li><strong>Validation des données :</strong> La sauvegarde est refusée si les groupes, plans de feux ou matrice de conflits sont vides</li>
                            <li><strong>Détection de corruption :</strong> Alerte si les données à sauvegarder semblent anormalement petites</li>
                            <li><strong>Backup automatique :</strong> Une copie de secours est créée avant d'écraser une sauvegarde existante</li>
                            <li><strong>Confirmation de sécurité :</strong> Demande de confirmation si la nouvelle sauvegarde est significativement plus petite que l'ancienne</li>
                            <li><strong>Gestion des erreurs :</strong> Messages d'erreur explicites en cas de problème (espace insuffisant, données invalides)</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Liens externes</h4>
                        <p>Menu Fichier → Liens externes permet de créer des raccourcis vers des fichiers ou URLs associés au projet :</p>
                        <ul>
                            <li><strong>Ajouter un lien :</strong> Renseignez un nom et un chemin (fichier local ou URL)</li>
                            <li><strong>Format du chemin :</strong>
                                <ul>
                                    <li>URL : <code>https://exemple.com</code></li>
                                    <li>Fichier local : <code>C:\Documents\plan.pdf</code></li>
                                </ul>
                            </li>
                            <li><strong>Ouvrir un lien :</strong> Double-cliquez sur le lien pour l'ouvrir</li>
                            <li><strong>Fichiers PDF :</strong> S'ouvrent directement dans le navigateur (lecteur intégré)</li>
                            <li><strong>Sauvegarde :</strong> Les liens sont sauvegardés avec chaque projet (pas globalement)</li>
                        </ul>
                        <p><em>Note : Pour des raisons de sécurité, le navigateur ne peut pas lancer d'applications externes (Word, Excel). Ces fichiers seront proposés en téléchargement.</em></p>
                    </section>

                    <section className="help-section">
                        <h4>Impression</h4>
                        <p>Le menu Fichier propose trois options d'impression avec prévisualisation :</p>
                        <ul>
                            <li><strong>Imprimer la matrice :</strong> Imprime la matrice de dégagement avec le nom du carrefour</li>
                            <li><strong>Imprimer le formulaire :</strong> Imprime la liste des groupes avec leurs paramètres</li>
                            <li><strong>Imprimer le diagramme :</strong> Imprime le diagramme temporel complet en format A4 paysage, incluant :
                                <ul>
                                    <li>En-tête : nom du carrefour et plan de feu actif</li>
                                    <li>Diagramme des phases avec les barres colorées</li>
                                    <li>Tableau des conditions de micro-régulation (si définies)</li>
                                    <li>Pied de page : nom du fichier projet et date d'impression</li>
                                </ul>
                            </li>
                        </ul>
                        <p><strong>Paramètres d'impression recommandés :</strong></p>
                        <ul>
                            <li><strong>Couleur :</strong> Sélectionnez "Couleur" pour imprimer les barres du diagramme en couleur</li>
                            <li><strong>Marges :</strong> Sélectionnez "Minimum" ou "Aucune" pour maximiser l'espace</li>
                            <li><strong>Graphiques d'arrière-plan :</strong> Activez cette option pour imprimer les couleurs des barres de phase</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Import Excel</h4>
                        <p>L'application peut importer des fichiers Excel (.xlsx) contenant la configuration complète du carrefour :</p>
                        <ul>
                            <li><strong>Feuille Formulaire :</strong> Configuration des groupes (nom, type, durées)</li>
                            <li><strong>Feuille PF :</strong> Diagramme et matrice de dégagement pour chaque plan de feux</li>
                            <li><strong>Feuille Trafic :</strong> Données de trafic par groupe</li>
                        </ul>
                        <p><strong>Import des données trafic :</strong></p>
                        <ul>
                            <li>Colonne I : Coefficient de voie (Coef)</li>
                            <li>Colonne J : Premier jeu de données trafic, nommé par la cellule J3</li>
                            <li>Colonne O : Second jeu de données trafic, nommé par la cellule O3</li>
                        </ul>
                        <p><strong>Synchronisation automatique :</strong> Quand vous changez d'onglet PF (PF1, PF2...), le jeu de données trafic "Associé à" se synchronise automatiquement avec l'onglet actif si un dataset du même nom existe.</p>
                        <p><strong>Groupes :</strong> Tous les groupes de 1 au nombre total (cellule H2) sont importés, y compris les groupes vides (sans nom ni configuration).</p>
                    </section>

                    <h3 style={{ color: '#4ecdc4', borderBottom: '1px solid #4ecdc4', paddingBottom: '8px', marginTop: '32px', marginBottom: '16px' }}>Chapitre 2 — Onde verte</h3>

                    <section className="help-section">
                        <h4>Présentation</h4>
                        <p>L'onde verte permet de coordonner les feux de signalisation le long d'un axe routier afin d'offrir aux usagers une progression fluide sans arrêt aux feux successifs. L'outil exploite directement les plans de feux des carrefours sauvegardés pour construire un diagramme espace-temps interactif.</p>
                    </section>

                    <section className="help-section">
                        <h4>Création d'une onde verte</h4>
                        <ul>
                            <li><strong>Menu Fichier → Onde verte :</strong> Ouvre l'assistant de création</li>
                            <li><strong>Ajout de carrefours :</strong> Sélectionnez des projets sauvegardés et ajoutez-les à la liste (minimum 2 carrefours requis)</li>
                            <li><strong>Plan de feu :</strong> Pour chaque carrefour, choisissez le plan de feu (PF) à utiliser</li>
                            <li><strong>Groupes de feux :</strong> Assignez un groupe pour le sens montant (GF montant) et un pour le sens descendant (GF descendant)</li>
                            <li><strong>Distances :</strong> Renseignez la distance en mètres pour chaque sens. La distance du sens descendant est pré-remplie automatiquement (distance montant + 20 m)</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Interaction avec les plans de feux</h4>
                        <p>L'onde verte est directement liée aux données des carrefours :</p>
                        <ul>
                            <li><strong>Chargement des données :</strong> Les groupes, durées de vert, offsets et durées de cycle sont automatiquement extraits du plan de feu sélectionné pour chaque carrefour</li>
                            <li><strong>Changement de PF individuel :</strong> Dans le tableau des données saisies, modifiez le PF d'un carrefour pour voir instantanément l'effet sur le diagramme</li>
                            <li><strong>Changement de PF global :</strong> Le sélecteur en haut de page permet de basculer tous les carrefours sur un même plan de feu simultanément. Les paramètres (vitesses, offsets) sont sauvegardés et restaurés automatiquement pour chaque PF</li>
                            <li><strong>Synchronisation :</strong> Le bouton "Synchroniser" recharge les données de tous les carrefours depuis les projets sauvegardés, intégrant ainsi les modifications apportées aux diagrammes de feux</li>
                            <li><strong>Détection des conflits de cycle :</strong> Si un carrefour a un cycle différent des autres, sa ligne est surlignée en rouge dans le tableau</li>
                            <li><strong>Actions prises en compte :</strong> Les secondes lucarnes et ouvertures anticipées définies dans les conditions de micro-régulation sont affichées sur le diagramme de l'onde verte</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Diagramme espace-temps</h4>
                        <p>Le diagramme représente les phases de vert de chaque carrefour en fonction du temps (axe horizontal) et de la distance (axe vertical) :</p>
                        <ul>
                            <li><strong>Barres vertes :</strong> Phases de vert du groupe montant, positionnées à la distance du GF montant</li>
                            <li><strong>Barres orange :</strong> Phases de vert du groupe descendant, positionnées à la distance du GF descendant</li>
                            <li><strong>Lignes de vitesse (tirets) :</strong> Représentent la progression des véhicules :
                                <ul>
                                    <li><span style={{color: '#4CAF50'}}>Vert</span> : Sens montant (bas vers haut)</li>
                                    <li><span style={{color: '#FF9800'}}>Orange</span> : Sens descendant (haut vers bas)</li>
                                </ul>
                            </li>
                            <li><strong>Bandes passantes :</strong> Zones colorées semi-transparentes montrant la fenêtre temporelle où les véhicules peuvent traverser tous les carrefours sans s'arrêter. La largeur en secondes est affichée dans la légende</li>
                            <li><strong>Affichage multi-cycles :</strong> Choisissez d'afficher 2 ou 3 cycles pour une meilleure visibilité de la coordination</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Contrôles interactifs</h4>
                        <ul>
                            <li><strong>Vitesses :</strong> Ajustez les vitesses montante et descendante (10 à 130 km/h) pour modifier l'inclinaison des lignes de vitesse et le calcul des bandes passantes</li>
                            <li><strong>Glisser les lignes de vitesse :</strong> Cliquez et glissez horizontalement une ligne de vitesse pour ajuster l'offset en secondes. L'épaisseur de la ligne augmente pendant le glissement</li>
                            <li><strong>Zoom X :</strong> Curseur de 3 à 20 pixels/seconde pour ajuster l'échelle temporelle</li>
                            <li><strong>Zoom Y :</strong> Curseur de 0.5 à 3 pixels/mètre pour ajuster l'échelle des distances</li>
                            <li><strong>Lignes de vitesse :</strong> Case à cocher pour afficher ou masquer les lignes guides</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Tableau des données saisies</h4>
                        <ul>
                            <li><strong>Ordre :</strong> Réorganisez les carrefours avec les boutons ↑ et ↓</li>
                            <li><strong>Carrefour :</strong> Nom du projet (lecture seule)</li>
                            <li><strong>PF :</strong> Sélection individuelle du plan de feu</li>
                            <li><strong>Cycle :</strong> Durée du cycle (surligné en rouge si différent du cycle de référence)</li>
                            <li><strong>GF Montant / Descendant :</strong> Sélection du groupe de feux et de la distance pour chaque sens</li>
                            <li><strong>Ajouter :</strong> Le bouton "+" permet d'ajouter de nouveaux carrefours à la liste</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Sauvegarde et impression</h4>
                        <ul>
                            <li><strong>Enregistrer :</strong> Sauvegarde dans le navigateur (localStorage) avec un nom personnalisable</li>
                            <li><strong>Enregistrer sur réseau :</strong> Exporte un fichier JSON via le gestionnaire de fichiers du système</li>
                            <li><strong>Ouvrir :</strong> Chargez une onde verte précédemment sauvegardée ou un fichier JSON depuis le réseau</li>
                            <li><strong>Imprimer :</strong> Génère une version imprimable du diagramme en format paysage avec légende, paramètres et horodatage</li>
                            <li><strong>Paramètres par PF :</strong> Les vitesses, offsets et options d'affichage sont sauvegardés séparément pour chaque plan de feu, permettant de comparer facilement différents scénarios</li>
                        </ul>
                    </section>
                </div>
            </Modal>

            {/* Modal Importer CSV/Excel */}
            <Modal isOpen={importModal} onClose={() => setImportModal(false)} title="Importer un fichier">
                {importHintDir && (
                    <div style={{
                        backgroundColor: '#2a3a2a',
                        border: '1px solid #4a6a4a',
                        borderRadius: '4px',
                        padding: '10px',
                        marginBottom: '15px',
                        fontSize: '0.9em'
                    }}>
                        <span style={{ color: '#8f8' }}>Répertoire suggéré :</span>
                        <div style={{ color: '#aaa', marginTop: '5px', wordBreak: 'break-all' }}>
                            {importHintDir}
                        </div>
                    </div>
                )}
                <div className="form-row">
                    <label>
                        Sélectionner un fichier CSV ou Excel :
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
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

                {/* Recent files list */}
                {recentFiles.length > 0 && (
                    <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '10px' }}>Fichiers récents (cliquez pour réimporter) :</h4>
                        <div style={{
                            maxHeight: '150px',
                            overflowY: 'auto',
                            backgroundColor: '#1a1a1a',
                            borderRadius: '4px',
                            padding: '5px'
                        }}>
                            {recentFiles.map((file, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        // Note: Due to browser security, we can't access the file directly
                                        // We can only show the filename as a hint to the user
                                        alert(`Pour réimporter "${file.name}", veuillez le sélectionner à nouveau via le bouton ci-dessus.\n\nPour des raisons de sécurité, le navigateur ne permet pas d'accéder directement aux fichiers précédemment sélectionnés.`);
                                    }}
                                    style={{
                                        padding: '8px 10px',
                                        margin: '2px 0',
                                        backgroundColor: '#2a2a2a',
                                        borderRadius: '3px',
                                        fontSize: '0.85em',
                                        cursor: 'pointer',
                                        borderLeft: '3px solid #4a9eff',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                                >
                                    <div style={{ color: '#ddd', fontWeight: '500' }}>{file.name}</div>
                                    <div style={{ color: '#888', fontSize: '0.9em', marginTop: '2px' }}>
                                        {formatDate(file.timestamp)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent directories list */}
                {getRecentDirectories().length > 0 && (
                    <div style={{ marginTop: '15px', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '10px' }}>Répertoires récents :</h4>
                        <div style={{
                            maxHeight: '120px',
                            overflowY: 'auto',
                            backgroundColor: '#1a1a1a',
                            borderRadius: '4px',
                            padding: '5px'
                        }}>
                            {getRecentDirectories().map((dir, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '6px 10px',
                                        margin: '2px 0',
                                        backgroundColor: '#2a2a2a',
                                        borderRadius: '3px',
                                        fontSize: '0.8em',
                                        color: '#999',
                                        borderLeft: '3px solid #6a6a6a'
                                    }}
                                >
                                    {dir}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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
                    <strong>Format supporté :</strong>
                    <ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
                        <li><strong>Excel (.xlsx/.xls)</strong> avec structure :
                            <ul style={{ marginTop: '5px', fontSize: '0.95em' }}>
                                <li>Feuille "Formulaire" : Configuration des groupes (A6, B6, C6, D6, E6... puis A8, B8, C8...)</li>
                                <li>6ème feuille : Matrice de dégagement</li>
                                <li>Feuilles 6, 7, 8... : Onglets PF1, PF2, PF3... (diagrammes et tableaux d'actions)</li>
                                <li>Feuille "Trafic" : Données de trafic (E6, E8, E10...)</li>
                            </ul>
                        </li>
                    </ul>
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

            {/* Modal Importer HTM */}
            <Modal isOpen={importHTMModal} onClose={() => setImportHTMModal(false)} title="Importer un fichier HTM">
                <div className="form-row">
                    <label>
                        Sélectionner un fichier HTM :
                        <input
                            type="file"
                            accept=".htm,.html"
                            onChange={handleHTMFileSelect}
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
                {htmFile && (
                    <p style={{ color: '#8f8', fontSize: '0.9em', marginTop: '10px' }}>
                        Fichier sélectionné : {htmFile.name}
                    </p>
                )}
                {htmImportError && (
                    <p style={{ color: '#f66', fontSize: '0.9em', marginTop: '10px' }}>
                        {htmImportError}
                    </p>
                )}
                <div style={{ color: '#888', fontSize: '0.8em', marginTop: '15px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                    <strong>Format HTM attendu :</strong><br />
                    <span style={{ fontSize: '0.9em' }}>Le fichier doit contenir un tableau avec les données des groupes de feu (nom, durée vert, orange, etc.)</span>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setImportHTMModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleHTMImport} disabled={!htmFile}>
                        Importer et ouvrir
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
            <Modal isOpen={phasageBulleModal} onClose={() => setPhasageBulleModal(false)} title="Configuration du phasage bulle" overlayClassName="modal-phasage-bulle-overlay">
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '8px' }}>
                            {Array.from({ length: phasageBulleCount }, (_, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ color: '#dc4edc', fontWeight: 'bold' }}>P{i + 1}:</span>
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
                                        style={{ width: '40px', padding: '3px', textAlign: 'center' }}
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
                    <button className="modal-btn modal-btn-secondary" onClick={() => {
                        setPhasageBulleModal(false);
                        setPhasageBulleEnabled(false);
                    }}>
                        Annuler
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
                        OK
                    </button>
                </div>
            </Modal>

            {/* Print Preview Modal */}
            {printPreviewModal && (
                <div className="modal-overlay print-preview-overlay" onClick={() => setPrintPreviewModal(false)}>
                    <div className="modal-content print-preview-modal-large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {printType === 'matrix' && 'Aperçu - Matrice de dégagement'}
                                {printType === 'form' && 'Aperçu - Formulaire'}
                                {printType === 'diagram' && 'Aperçu - Diagramme'}
                            </h3>
                            <button className="modal-close" onClick={() => setPrintPreviewModal(false)}>×</button>
                        </div>
                        <div className="print-preview-container">
                            <div className="print-preview-page">
                                {/* Header commun (sauf pour diagramme qui a son propre en-tête) */}
                                {printType !== 'diagram' && (
                                    <div className="print-preview-header">
                                        <h2>{intersectionName || 'Sans titre'}</h2>
                                        <p>{groups.length} groupes - Cycle: {cycleLength}s</p>
                                    </div>
                                )}

                                {/* Contenu selon le type */}
                                {printType === 'matrix' && (
                                    <div className="print-preview-matrix">
                                        <table className="preview-matrix-table">
                                            <thead>
                                                <tr>
                                                    <th></th>
                                                    {groups.map(g => (
                                                        <th key={g.id}>{g.id}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groups.map((fromGroup, fromIdx) => (
                                                    <tr key={fromGroup.id}>
                                                        <td className="row-header">{fromGroup.id}</td>
                                                        {groups.map((toGroup, toIdx) => (
                                                            <td
                                                                key={toGroup.id}
                                                                className={fromIdx === toIdx ? 'diagonal' : ''}
                                                            >
                                                                {fromIdx !== toIdx ? (conflictMatrix[fromIdx]?.[toIdx] || '') : ''}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {printType === 'form' && (
                                    <div className="print-preview-form">
                                        <table className="preview-form-table">
                                            <thead>
                                                <tr>
                                                    <th>GF</th>
                                                    <th>Nom</th>
                                                    <th>Type</th>
                                                    <th>Déc</th>
                                                    <th>V</th>
                                                    <th>J</th>
                                                    <th>R</th>
                                                    <th>Vm</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groups.map(g => (
                                                    <tr key={g.id}>
                                                        <td>{g.id}</td>
                                                        <td>{g.name || ''}</td>
                                                        <td>{g.type || 'VL'}</td>
                                                        <td>{g.offset}</td>
                                                        <td>{g.durations?.green || 0}</td>
                                                        <td>{g.durations?.orange || 0}</td>
                                                        <td>{g.durations?.red || 0}</td>
                                                        <td>{g.minGreen || 0}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {printType === 'diagram' && (() => {
                                    // A4 paysage avec marges 5mm: ~287mm x 200mm
                                    // Largeur imprimable: ~1050px à 96dpi, ~790px à 72dpi (Edge)
                                    // Sidebar timeline: 325px (ne pas modifier pour garder l'alignement des barres)
                                    // Sans les colonnes commentaires/remarques: sidebar effective ~200px
                                    const printSidebarWidth = 200; // sidebar sans commentaires/remarques
                                    const printTotalWidth = 750; // largeur disponible conservatrice
                                    const printTimelineWidth = printTotalWidth - printSidebarWidth; // ~550px

                                    // Calcul pixelsPerSecond pour que le timeline tienne dans la largeur
                                    const optimalPPS = Math.max(2, Math.floor(printTimelineWidth / cycleLength));

                                    // Calculer le scale si nécessaire
                                    const actualWidth = printSidebarWidth + (cycleLength * optimalPPS);
                                    const printScale = actualWidth > printTotalWidth ? printTotalWidth / actualWidth : 1;

                                    return (
                                    <div className="print-preview-diagram print-preview-landscape" style={{
                                        transform: printScale < 1 ? `scale(${printScale.toFixed(3)})` : 'none',
                                        transformOrigin: 'top left'
                                    }}>
                                        {/* En-tête du diagramme */}
                                        <div className="print-diagram-header">
                                            <h3>Diagramme {intersectionName || 'Sans titre'} - {pfTabs.find(pf => pf.id === activePFId)?.name || 'PF1'}</h3>
                                        </div>

                                        {/* Diagramme réel - A4 paysage optimisé */}
                                        <div className="print-diagram-content">
                                            <TimelineDiagram
                                                groups={groups}
                                                globalTime={0}
                                                onGroupClick={() => {}}
                                                pixelsPerSecond={optimalPPS}
                                                conflicts={[]}
                                                conflictMatrix={conflictMatrix}
                                                updateGroupParams={() => {}}
                                                cycleLength={cycleLength}
                                                actionData={actionData}
                                                updateActionRow={() => {}}
                                                startDrag={() => {}}
                                                endDrag={() => {}}
                                                showDependencies={false}
                                                dependencyGap={20}
                                                hoveredActionId={null}
                                                setHoveredActionId={() => {}}
                                                planName={pfTabs.find(pf => pf.id === activePFId)?.name || 'PF1'}
                                                isPrintMode={true}
                                            />
                                        </div>

                                        {/* Conditions de micro-régulation */}
                                        {actionData.filter(row => row.gf || row.action || row.description || row.deb !== '' || row.fin !== '').length > 0 && (
                                            <div className="print-actions-section">
                                                <h4>Conditions de micro-régulation</h4>
                                                <table className="print-actions-table">
                                                    <thead>
                                                        <tr>
                                                            <th>GF</th>
                                                            <th>Action</th>
                                                            <th>Description</th>
                                                            <th>Déb</th>
                                                            <th>Fin</th>
                                                            <th>Abrv</th>
                                                            <th>Action_Micro</th>
                                                            <th colSpan="2">Plage</th>
                                                            <th colSpan="4">Action GF</th>
                                                        </tr>
                                                        <tr className="print-actions-subheader">
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th>1</th>
                                                            <th>2</th>
                                                            <th>1</th>
                                                            <th>2</th>
                                                            <th>3</th>
                                                            <th>4</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {actionData
                                                            .filter(row => row.gf || row.action || row.description || row.deb !== '' || row.fin !== '')
                                                            .map(row => (
                                                                <tr key={row.id}>
                                                                    <td>{row.gf}</td>
                                                                    <td>{row.action}</td>
                                                                    <td>{row.description}</td>
                                                                    <td>{row.deb}</td>
                                                                    <td>{row.fin}</td>
                                                                    <td>{row.abrv}</td>
                                                                    <td>{row.micro}</td>
                                                                    <td>{row.plage1}</td>
                                                                    <td>{row.plage2}</td>
                                                                    <td>{row.actGf1}</td>
                                                                    <td>{row.actGf1Gf2}</td>
                                                                    <td>{row.actGf1Gf3}</td>
                                                                    <td>{row.actGf1Gf4}</td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Pied de page: chemin du fichier JSON à gauche, date à droite */}
                                        <div className="print-diagram-footer">
                                            <span className="print-footer-path">
                                                {currentProjectPath || 'Projet non enregistré'}
                                            </span>
                                            <span className="print-footer-date">{new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setPrintPreviewModal(false)}>
                                Annuler
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={() => {
                                    // Ajouter la classe pour l'impression AVANT d'imprimer
                                    document.body.classList.add(`print-${printType}`);
                                    // Imprimer avec le modal ouvert
                                    window.print();
                                    // Retirer la classe après l'impression
                                    document.body.classList.remove(`print-${printType}`);
                                }}
                            >
                                Imprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Manager Modal */}
            <UserManagerModal
                isOpen={showUserManager}
                onClose={() => setShowUserManager(false)}
                currentUser={currentUser}
                getUsersList={getUsersList}
                createUser={createUser}
                updateUser={updateUser}
                deleteUser={deleteUser}
                resetPassword={resetPassword}
                exportUsersToFile={exportUsersToFile}
                importUsersFromFile={importUsersFromFile}
            />

            {/* External Links Modal */}
            <ExternalLinksModal
                isOpen={showExternalLinksModal}
                onClose={() => setShowExternalLinksModal(false)}
                links={externalLinks}
                onLinksChange={setExternalLinks}
            />

            {/* Floating image modal (persists across tab changes) */}
            {showFloatingImage && intersectionImage && (
                <div
                    className="floating-image-modal"
                    style={{
                        left: floatingPosition.x,
                        top: floatingPosition.y
                    }}
                >
                    <div
                        className="floating-image-header"
                        onMouseDown={handleFloatingMouseDown}
                    >
                        <span>Image du carrefour</span>
                        <div className="floating-header-buttons">
                            <div className="floating-zoom-control">
                                <button
                                    className="floating-zoom-btn"
                                    onClick={() => setFloatingZoom(z => Math.max(0.3, z - 0.1))}
                                    title="Réduire"
                                >
                                    −
                                </button>
                                <span className="floating-zoom-value">{Math.round(floatingZoom * 100)}%</span>
                                <button
                                    className="floating-zoom-btn"
                                    onClick={() => setFloatingZoom(z => Math.min(2, z + 0.1))}
                                    title="Agrandir"
                                >
                                    +
                                </button>
                            </div>
                            <button
                                className={`floating-crop-btn ${showCropControls ? 'active' : ''}`}
                                onClick={() => setShowCropControls(!showCropControls)}
                                title="Rogner l'image"
                            >
                                ✂
                            </button>
                            <button
                                className="floating-close-btn"
                                onClick={() => setShowFloatingImage(false)}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                    {showCropControls && (
                        <div className="floating-crop-controls">
                            <div className="crop-control">
                                <label>Haut</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="250"
                                    value={floatingCrop.top}
                                    onChange={(e) => setFloatingCrop(prev => ({ ...prev, top: parseInt(e.target.value) }))}
                                />
                                <span>{floatingCrop.top}px</span>
                            </div>
                            <div className="crop-control">
                                <label>Bas</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="250"
                                    value={floatingCrop.bottom}
                                    onChange={(e) => setFloatingCrop(prev => ({ ...prev, bottom: parseInt(e.target.value) }))}
                                />
                                <span>{floatingCrop.bottom}px</span>
                            </div>
                            <div className="crop-control">
                                <label>Gauche</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="350"
                                    value={floatingCrop.left}
                                    onChange={(e) => setFloatingCrop(prev => ({ ...prev, left: parseInt(e.target.value) }))}
                                />
                                <span>{floatingCrop.left}px</span>
                            </div>
                            <div className="crop-control">
                                <label>Droite</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="350"
                                    value={floatingCrop.right}
                                    onChange={(e) => setFloatingCrop(prev => ({ ...prev, right: parseInt(e.target.value) }))}
                                />
                                <span>{floatingCrop.right}px</span>
                            </div>
                            <button
                                className="crop-reset-btn"
                                onClick={() => setFloatingCrop({ top: 0, bottom: 0, left: 0, right: 0 })}
                            >
                                Réinitialiser
                            </button>
                        </div>
                    )}
                    <div className="floating-image-content">
                        <div
                            className="floating-image-wrapper"
                            style={{
                                width: (750 - floatingCrop.left - floatingCrop.right) * floatingZoom,
                                height: (530 - floatingCrop.top - floatingCrop.bottom) * floatingZoom
                            }}
                        >
                            <div
                                className="floating-image-inner"
                                style={{
                                    marginTop: -floatingCrop.top,
                                    marginLeft: -floatingCrop.left,
                                    width: 750,
                                    height: 530,
                                    transform: `scale(${floatingZoom})`,
                                    transformOrigin: 'top left'
                                }}
                            >
                                <img src={intersectionImage} alt="Carrefour" />
                                {intersectionArrows.map(arrow => {
                                    const group = groups.find(g => g.id === arrow.groupId);
                                    const courant = group?.courant || '';
                                    const groupType = group?.type || '';
                                    const rotation = arrow.rotation || 0;
                                    const scale = arrow.scale || 1;
                                    const arrowLength = arrow.length || 1;
                                    const turnLength = arrow.turnLength || 1;
                                    const isHovered = hoveredArrowGroupId === arrow.groupId;

                                    // Calculate arrow color based on diagram time position or simulation
                                    let arrowColor = '#000000'; // Default: BLACK

                                    // Use simulation time when playing, otherwise use hovered time
                                    const activeTime = (simulationEnabled && isPlayingSimulation)
                                        ? simulationCurrentTime
                                        : hoveredDiagramTime;

                                    if (activeTime !== null && group) {
                                        // Calculate phase color based on time
                                        const offset = group.offset || 0;
                                        const greenDuration = group.durations?.green || 0;
                                        const orangeDuration = group.durations?.orange || 0;
                                        const cycle = cycleLength || 100;

                                        // Check for "Seconde lucarne" action for this group
                                        const secondeLucarneAction = actionData.find(action =>
                                            action.action === 'Seconde lucarne' &&
                                            action.gf === String(arrow.groupId) &&
                                            action.deb !== '' &&
                                            action.fin !== ''
                                        );

                                        // Check if time is in seconde lucarne period
                                        let isInSecondeLucarne = false;
                                        if (secondeLucarneAction) {
                                            const slDeb = parseInt(secondeLucarneAction.deb) || 0;
                                            const slFin = parseInt(secondeLucarneAction.fin) || 0;
                                            const normalizedTime = activeTime % cycle;
                                            if (slDeb <= slFin) {
                                                isInSecondeLucarne = normalizedTime >= slDeb && normalizedTime < slFin;
                                            } else {
                                                // Wrap-around case
                                                isInSecondeLucarne = normalizedTime >= slDeb || normalizedTime < slFin;
                                            }
                                        }

                                        if (isInSecondeLucarne) {
                                            arrowColor = '#00aa00'; // Dark green for Seconde lucarne
                                        } else {
                                            // Normalize time relative to group offset
                                            let relativeTime = (activeTime - offset + cycle) % cycle;

                                            if (relativeTime < greenDuration) {
                                                arrowColor = '#00cc00'; // Green phase
                                            } else if (relativeTime < greenDuration + orangeDuration) {
                                                arrowColor = '#ff9900'; // Orange phase
                                            } else {
                                                arrowColor = '#cc0000'; // Red phase
                                            }
                                        }
                                    }

                                    return (
                                        <div
                                            key={arrow.id}
                                            className={`floating-arrow-marker ${isHovered ? 'hovered' : ''}`}
                                            style={{
                                                left: `${arrow.x}%`,
                                                top: `${arrow.y}%`
                                            }}
                                        >
                                            <div
                                                className="arrow-symbol"
                                                style={{
                                                    transform: `rotate(${rotation}deg) scale(${scale})`
                                                }}
                                            >
                                                {renderFloatingArrowSVG(courant, arrowColor, arrowLength, turnLength)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating legend window (non-modal) */}
            {showFloatingLegend && (
                <div
                    className="floating-legend-window"
                    style={{
                        left: floatingLegendPosition.x,
                        top: floatingLegendPosition.y
                    }}
                >
                    <div
                        className="floating-legend-header"
                        onMouseDown={handleLegendMouseDown}
                    >
                        <span>Légende du diagramme</span>
                        <button
                            className="floating-close-btn"
                            onClick={() => setShowFloatingLegend(false)}
                        >
                            ✕
                        </button>
                    </div>
                    <div className="floating-legend-content">
                        <div className="legend-section">
                            <div className="legend-section-title">Actions de micro-régulation</div>
                            <div className="legend-item">
                                <div className="legend-preview legend-adaptatif"></div>
                                <span>Adaptatif vertical</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-controle-flot">
                                    <div className="legend-cf-intermittent"></div>
                                    <div className="legend-cf-orange"></div>
                                    <div className="legend-cf-red"></div>
                                </div>
                                <span>Contrôle de flot</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-bande-debut">
                                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                        <line x1="5" y1="2" x2="58" y2="16" stroke="#00cc00" strokeWidth="0.8" strokeDasharray="4,3" />
                                        <path d="M58,16 L68,18 L62,10 Z" fill="#00cc00" />
                                    </svg>
                                </div>
                                <span>Début de bande passante</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-escamotage-group">
                                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                        <defs>
                                            <pattern id="legend-escam-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(-45)">
                                                <line x1="0" y1="0" x2="0" y2="4" stroke="#1565C0" strokeWidth="2" />
                                            </pattern>
                                        </defs>
                                        <rect x="20" y="5" width="40" height="10" fill="url(#legend-escam-hatch)" stroke="#1565C0" strokeWidth="0.5" strokeDasharray="2,2" />
                                        <line x1="5" y1="3" x2="20" y2="10" stroke="#1565C0" strokeWidth="0.8" strokeDasharray="3,2" />
                                        <line x1="75" y1="3" x2="60" y2="10" stroke="#1565C0" strokeWidth="0.8" strokeDasharray="3,2" />
                                    </svg>
                                </div>
                                <span>Escamotage</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-escamotage"></div>
                                <span>Escamotage de phase</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-fermeture">
                                    <span className="brace-point"></span>
                                </div>
                                <span>Fermeture anticipée</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-bande-fin">
                                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                        <line x1="5" y1="2" x2="58" y2="16" stroke="#00cc00" strokeWidth="0.8" strokeDasharray="4,3" />
                                        <path d="M58,16 L68,18 L62,10 Z" fill="#00cc00" />
                                    </svg>
                                </div>
                                <span>Fin de bande passante</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-instant-co"></div>
                                <span>Instant Co</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-ouverture"></div>
                                <span>Ouverture anticipée</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-point-repos"></div>
                                <span>Point de repos</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-priorite-pietons"></div>
                                <span>Priorité piétons</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-lucarne"></div>
                                <span>Seconde lucarne</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-signa">
                                    <div className="legend-signa-orange"></div>
                                    <div className="legend-signa-blue"></div>
                                </div>
                                <span>Signal aide conduite</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-preview legend-synchro-bts"></div>
                                <span>Synchro BTS</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
