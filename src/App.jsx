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
        actionData,
        updateActionRow,
        reorderActions,
        pfTabs,
        activePFId,
        setActivePFId,
        duplicatePF,
        deletePF,
        renamePF,
        setPFColor,
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
        setIntersectionArrows,
        activeTrafficDataset,
        setActiveTrafficDataset,
        updateTrafficData,
        getTrafficData,
        trafficDatasetNames,
        copyTrafficDataset,
        dependencyGap,
        setDependencyGap
    } = useTrafficLight();

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

    // V.Utile hover state: { groupId, vUtile } when hovering V.Utile cell
    const [hoveredVUtile, setHoveredVUtile] = useState(null);

    // Phasage bulle state
    const [phasageBulleEnabled, setPhasageBulleEnabled] = useState(false);
    const [phasageBulleModal, setPhasageBulleModal] = useState(false);
    const [phasageBulleTimes, setPhasageBulleTimes] = useState([0, 15, 30, 45, 60, 75]);
    const [phasageBulleCount, setPhasageBulleCount] = useState(4);
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

    // Save sidebar width to localStorage
    useEffect(() => {
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
    }, [sidebarWidth]);

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
    const [optionsModal, setOptionsModal] = useState(false);
    const [helpModal, setHelpModal] = useState(false);
    const [importModal, setImportModal] = useState(false);
    const [slideValue, setSlideValue] = useState(0);
    const [insertStart, setInsertStart] = useState(0);
    const [insertDuration, setInsertDuration] = useState(5);
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

    // File System Access API - mémoriser les derniers répertoires utilisés
    const lastOpenDirectoryRef = useRef(null);
    const lastSaveDirectoryRef = useRef(null);
    const lastImportDirectoryRef = useRef(null);
    const lastImageDirectoryRef = useRef(null);

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
        }
    }, [recentOpenDirs, recentImportDirs, recentImageDirs, recentSaveDirs]);

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
                if (openHandle) lastOpenDirectoryRef.current = openHandle;
                if (saveHandle) lastSaveDirectoryRef.current = saveHandle;
                if (importHandle) lastImportDirectoryRef.current = importHandle;
                if (imageHandle) lastImageDirectoryRef.current = imageHandle;
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
            const data = JSON.parse(content);

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

            // Restaurer la hauteur du diagramme si présente
            if (data.diagramHeight !== undefined) {
                setDiagramHeight(data.diagramHeight);
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
            const data = JSON.parse(content);

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

            // Restaurer la hauteur du diagramme si présente
            if (data.diagramHeight !== undefined) {
                setDiagramHeight(data.diagramHeight);
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
                diagramHeight: diagramHeight
            };

            // Écrire le fichier
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(projectData, null, 2));
            await writable.close();

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

            // Sauvegarder aussi dans localStorage pour cohérence
            saveProject(savedName);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                alert('Erreur lors de la sauvegarde du fichier: ' + e.message);
            }
        }
    }, [intersectionName, getFullState, setIntersectionName, saveProject, saveDirectoryHandle, addRecentDirectory]);

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
                diagramHeight: diagramHeight
            };

            // Écrire le fichier
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(projectData, null, 2));
            await writable.close();

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

            // Sauvegarder aussi dans localStorage pour cohérence
            saveProject(savedName);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                alert('Erreur lors de la sauvegarde du fichier: ' + e.message);
            }
        }
    }, [recentSaveDirs, intersectionName, loadDirectoryHandle, saveDirectoryHandle, addRecentDirectory, getFullState, setIntersectionName, saveProject]);

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
                    window.location.reload();
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
            case 'options':
                setOptionsModal(true);
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
            // Green wave actions
            case 'createGreenWave':
                setCreateGreenWaveModal(true);
                break;
            case 'openGreenWave':
                setOpenGreenWaveModal(true);
                setSelectedGreenWave(null);
                break;
            case 'openGreenWaveFromFile':
                handleOpenGreenWaveFromFile();
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
                        speedLineOffsetUp: greenWaveData.speedLineOffsetUp,
                        speedLineOffsetDown: greenWaveData.speedLineOffsetDown,
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
            const greenWaveData = JSON.parse(content);

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
                window.open(`${window.location.pathname}?greenwave&id=${greenWaveId}`, '_blank');
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

            alert(`Import réussi !\n\n${importedData.groups.length} groupes importés\n${importedData.actionData.length} actions importées`);
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

            alert(`Import réussi !\n\n${importedData.groups.length} groupes importés\n${importedData.actionData.length} actions importées`);
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
                alert(`Import réussi !\n\n${importedData.groups.length} groupes importés\n${importedData.actionData.length} actions importées`);
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
                <aside className="sidebar" style={{ width: `${sidebarWidth}px` }}>
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
                                        // Set width to display full traffic table
                                        // Grp(28) + Nom(200) + Coef(55) + Trafic(55) + V.Utile(55) + Cap.U(55) + Retard(55) + Attente(55) + padding(40)
                                        setSidebarWidth(650);
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
                                    trafficDatasetNames={trafficDatasetNames}
                                    setHoveredVUtile={setHoveredVUtile}
                                    copyTrafficDataset={copyTrafficDataset}
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

                {/* Resizable divider */}
                <div
                    className={`resize-divider ${isResizing ? 'resizing' : ''}`}
                    onMouseDown={handleResizeStart}
                />

                <section className="diagram-area" ref={diagramAreaRef} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* PF Tabs */}
                    <div className="pf-tabs-bar">
                        {pfTabs.map((pf) => (
                            <div
                                key={pf.id}
                                className={`pf-tab ${activePFId === pf.id && !simulationEnabled && !phasageBulleEnabled ? 'active' : ''}`}
                                style={pf.color ? {
                                    borderTopColor: pf.color,
                                    borderTopWidth: '3px',
                                    borderTopStyle: 'solid'
                                } : {}}
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
                                title="Double-cliquez pour renommer"
                            >
                                <span className="pf-tab-name">{pf.name}</span>
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
                                conflicts={conflicts}
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
                                hoveredVUtile={hoveredVUtile}
                                planName={simulationEnabled ? (pfTabs.find(pf => pf.id === activePFId)?.name || '') : ''}
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
                        overflow: 'auto'
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
                                lastImageDirectoryRef={lastImageDirectoryRef}
                                saveDirectoryHandle={saveDirectoryHandle}
                                recentImageDirs={recentImageDirs}
                                addRecentDirectory={addRecentDirectory}
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
                            <li><strong>Zone centrale :</strong> Diagramme temporel et tableau des conditions de micro-régulation</li>
                            <li><strong>Onglets PF :</strong> Gérez plusieurs plans de feux (PF1, PF2...) avec le bouton "+"</li>
                            <li><strong>Indicateur Valider/Validé :</strong> Cliquez sur "Valider" (quand aucun conflit) pour marquer l'onglet PF en vert. Cliquez à nouveau pour annuler la validation.</li>
                            <li><strong>Séparateur ajustable :</strong> La position du séparateur entre le diagramme et les conditions de micro-régulation est sauvegardée avec le projet.</li>
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
                        <h4>Conditions de micro-régulation</h4>
                        <p>Permet de définir des actions spéciales sur le diagramme. Survolez une ligne pour mettre en surbrillance l'action correspondante dans le diagramme (et inversement).</p>
                        <ul>
                            <li><strong>Adaptatif vertical :</strong> Zone d'adaptation du temps de vert (rectangle bleu). Utilisez Plage1/Plage2 pour définir les groupes concernés.</li>
                            <li><strong>Contrôle de flot :</strong> Contrôle du flux de trafic. Affiche une barre intermittente jaune/gris de DEB à (DEB + Vert minimum), puis orange pour la durée de jaune, puis rouge jusqu'à FIN.</li>
                            <li><strong>Seconde lucarne :</strong> Deuxième phase de vert (vert foncé + orange). Crée une barre supplémentaire sur la ligne du groupe.</li>
                            <li><strong>Escamotage de phase :</strong> Phase pouvant être supprimée (rectangle gris transparent sur toute la hauteur).</li>
                            <li><strong>Escamotage :</strong> Escamotage lié à un groupe spécifique. Définissez GF (source) et Action GF 1 (cible) pour afficher les flèches de dépendance.</li>
                            <li><strong>Ouverture anticipée :</strong> Anticipation du passage au vert (barre hachurée verte).</li>
                            <li><strong>Fermeture anticipée :</strong> Anticipation du passage au rouge (accolade orange sous la barre).</li>
                            <li><strong>Signal aide conduite :</strong> Signal d'information conducteur (orange clignotant + bleu fixe).</li>
                            <li><strong>Début/Fin de bande passante :</strong> Lignes verticales verte/rouge marquant la coordination.</li>
                            <li><strong>Priorité piétons :</strong> Action pour la priorité aux piétons.</li>
                            <li><strong>Instant Co :</strong> Point de synchronisation dans le cycle. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
                            <li><strong>Point de repos :</strong> Point de repos dans le cycle. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
                            <li><strong>Synchro BTS :</strong> Synchronisation avec le système BTS. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
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
                            <li><strong>Coef :</strong> Coefficient de voie (partagé entre tous les jeux de données)</li>
                            <li><strong>Trafic :</strong> Volume de trafic (véh/h) - spécifique à chaque jeu de données</li>
                            <li><strong>V.Utile :</strong> Calculé automatiquement = Trafic / (1800 × Coef / Cycle)</li>
                            <li><strong>Cap.U :</strong> Capacité utilisée = (V.Utile / Vert) × 100%</li>
                            <li><strong>Retard :</strong> Retard moyen (calculé)</li>
                            <li><strong>Attente :</strong> Longueur de file d'attente (calculé)</li>
                        </ul>
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
                </div>
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button className="modal-btn modal-btn-primary" onClick={() => setHelpModal(false)}>
                        Fermer
                    </button>
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
        </div>
    )
}

export default App
