import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
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
import PropertiesPanel from './components/PropertiesPanel';
import { calculateSimulatedDiagram } from './utils/simulationCalculator';
import usePopupWindow from './hooks/usePopupWindow';
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
        phasageBubbleScale,
        phasageEllipseScale,
        setPhasageBubbleScale,
        setPhasageEllipseScale,
        phasageBubbleRatio,
        setPhasageBubbleRatio,
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
        imageBrightness,
        setImageBrightness,
        imageContrast,
        setImageContrast,
        activeTrafficDataset,
        setActiveTrafficDataset,
        updateTrafficData,
        getTrafficData,
        trafficDatasetNames,
        copyTrafficDataset,
        addCustomTrafficDataset,
        pfTrafficDatasetMap,
        dependencyGap,
        setDependencyGap,
        biCarrefourSeparator,
        setBiCarrefourSeparator,
        externalLinks,
        setExternalLinks,
        projectProperties,
        updateProjectProperty,
        projectName,
        setProjectName,
        appCommunes,
        appMoaLogos,
        appMoeLogos
    } = useTrafficLight();

    // Update yellow/orange duration for VL and B groups when horsAgglomeration changes
    useEffect(() => {
        const orangeValue = projectProperties.horsAgglomeration ? 5 : 3;
        groups.forEach(g => {
            if ((g.type === 'V' || g.type === 'VL' || g.type === 'B' || g.type === 'TC') && g.durations.orange !== orangeValue) {
                updateGroupParams(g.id, { durations: { orange: orangeValue } });
            }
        });
    }, [projectProperties.horsAgglomeration]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const [hoveredArrowGroupSaturated, setHoveredArrowGroupSaturated] = useState(false);
    const [hoveredConflict, setHoveredConflict] = useState(null); // {from, to} for conflict hover
    const [hoveredDiagramTime, setHoveredDiagramTime] = useState(null); // Time position when hovering diagram

    // Track whether project has been modified (for "Nouveau projet" menu)
    const [projectModified, setProjectModified] = useState(false);
    const projectModifiedSkip = useRef(true);
    useEffect(() => {
        if (projectModifiedSkip.current) {
            projectModifiedSkip.current = false;
            return;
        }
        setProjectModified(true);
    }, [groups, actionData, cycleLength, conflictMatrix, projectProperties, intersectionName]);

    // Warn before closing if project has unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (projectModified) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [projectModified]);

    // Floating image state (persists across tab changes and page reloads)
    const [showFloatingImage, setShowFloatingImage] = useState(() => {
        const saved = localStorage.getItem('floating_image_visible');
        return saved === 'true';
    });

    // Floating matrix state
    const [showFloatingMatrix, setShowFloatingMatrix] = useState(() => {
        return localStorage.getItem('floating_matrix_visible') === 'true';
    });
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
    const [imageNaturalDims, setImageNaturalDims] = useState({ width: 1, height: 1 });

    // Compute natural dimensions of intersection image (for print scaling)
    useEffect(() => {
        if (intersectionImage) {
            const img = new Image();
            img.onload = () => setImageNaturalDims({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
            img.src = intersectionImage;
        }
    }, [intersectionImage]);

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

    // Save floating matrix state to localStorage
    useEffect(() => {
        localStorage.setItem('floating_matrix_visible', showFloatingMatrix.toString());
    }, [showFloatingMatrix]);

    useEffect(() => {
        localStorage.setItem('floating_image_crop', JSON.stringify(floatingCrop));
    }, [floatingCrop]);

    useEffect(() => {
        localStorage.setItem('floating_image_zoom', floatingZoom.toString());
    }, [floatingZoom]);

    // Popup window for floating image
    const floatingImagePopup = usePopupWindow({
        isOpen: showFloatingImage && !!intersectionImage,
        onClose: () => setShowFloatingImage(false),
        title: 'Carrefour',
        width: Math.round((750 - floatingCrop.left - floatingCrop.right) * floatingZoom) + 40,
        height: Math.round((530 - floatingCrop.top - floatingCrop.bottom) * floatingZoom) + 120
    });

    // Popup window for floating matrix
    const matrixPopup = usePopupWindow({
        isOpen: showFloatingMatrix,
        onClose: () => setShowFloatingMatrix(false),
        title: 'Matrice',
        width: Math.min(900, 120 + groups.length * 55),
        height: Math.min(800, 120 + groups.length * 55)
    });

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

    // On first load with no saved height, reduce diagram by 120px to show more action table
    useEffect(() => {
        if (diagramHeight === null && diagramAreaRef.current) {
            const panel = diagramAreaRef.current.querySelector('.diagram-panel');
            if (panel) {
                const h = panel.offsetHeight;
                if (h > 200) setDiagramHeight(h - 120);
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Synchronize traffic dataset with active PF tab (only when no saved mapping)
    useEffect(() => {
        if (pfTabs && pfTabs.length > 0 && activePFId) {
            // Si une association PF→dataset est sauvegardée, le wrapper setActivePFId s'en charge
            if (pfTrafficDatasetMap[activePFId]) return;
            // Sinon, fallback : associer au nom du PF si c'est un dataset connu
            const activePF = pfTabs.find(pf => pf.id === activePFId);
            if (activePF && trafficDatasetNames.includes(activePF.name)) {
                setActiveTrafficDataset(activePF.name);
            }
        }
    }, [activePFId, pfTabs, trafficDatasetNames, setActiveTrafficDataset, pfTrafficDatasetMap]);

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
    const helpZoneRef = useRef(null);
    const [importModal, setImportModal] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [showComments, setShowComments] = useState(true);
    const [showRemarks, setShowRemarks] = useState(true);
    const [showGroupNamesForm, setShowGroupNamesForm] = useState(true);
    const [showGroupNamesMatrix, setShowGroupNamesMatrix] = useState(true);
    const [showGroupNamesDiagram, setShowGroupNamesDiagram] = useState(true);
    const [slideValue, setSlideValue] = useState(0);
    const [slideFromGroup, setSlideFromGroup] = useState(1);
    const [slideToGroup, setSlideToGroup] = useState(1);
    const [slideTouched, setSlideTouched] = useState(false);
    const [insertStart, setInsertStart] = useState(0);
    const [insertDuration, setInsertDuration] = useState(5);
    const [insertTouched, setInsertTouched] = useState(false);
    const [reduceStart, setReduceStart] = useState(0);
    const [reduceDuration, setReduceDuration] = useState(5);
    const [reduceTouched, setReduceTouched] = useState(false);
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
    const [printType, setPrintType] = useState(null); // 'matrix', 'form', 'diagram', 'dossier'
    const [dossierDialog, setDossierDialog] = useState(false);
    const [dossierSections, setDossierSections] = useState({});
    const [currentProjectPath, setCurrentProjectPath] = useState(''); // Chemin du projet courant

    // Bi-carrefour modal states
    const [biCarrefourModal, setBiCarrefourModal] = useState(false);
    const [biCarrefourGroupId, setBiCarrefourGroupId] = useState('');
    const [biCarrefourTouched, setBiCarrefourTouched] = useState(false);

    // Move group modal states
    const [moveGroupModal, setMoveGroupModal] = useState(false);
    const [groupToMove, setGroupToMove] = useState('');
    const [moveAfterGroup, setMoveAfterGroup] = useState('0'); // '0' means at the beginning
    const [moveGroupTouched, setMoveGroupTouched] = useState(false);

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
            const projName = file.name.replace(/\.json$/i, '');
            loadFullState({
                projectName: projName,
                ...data
            });

            // Mémoriser le chemin du projet
            setCurrentProjectPath(file.name);
            setProjectModified(true);

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

            // Décocher commentaires/remarques s'il n'y en a pas dans le projet
            const hasComments = data.groups?.some(g => g.comment && g.comment.trim() !== '') || (data.pfTabs || []).some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== ''));
            setShowComments(!!hasComments);
            const pfList = data.pfTabs || [];
            const hasRemarks = pfList.some(pf => pf.remarques && pf.remarques.trim() !== '');
            setShowRemarks(!!hasRemarks);

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

            const projName = file.name.replace(/\.json$/i, '');
            loadFullState({
                projectName: projName,
                ...data
            });

            // Mémoriser le chemin du projet
            setCurrentProjectPath(file.name);
            setProjectModified(true);

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

            // Décocher commentaires/remarques s'il n'y en a pas dans le projet
            const hasComments = data.groups?.some(g => g.comment && g.comment.trim() !== '') || (data.pfTabs || []).some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== ''));
            setShowComments(!!hasComments);
            const pfList = data.pfTabs || [];
            const hasRemarks = pfList.some(pf => pf.remarques && pf.remarques.trim() !== '');
            setShowRemarks(!!hasRemarks);

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
            const name = prompt('Nom du projet:', projectName || 'Mon projet');
            if (name) {
                saveProject(name);
            }
            return;
        }

        try {
            const options = {
                suggestedName: `${projectName || 'projet'}.json`,
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
                ...fullState,
                diagramHeight: diagramHeight,
                floatingCrop: floatingCrop,
                floatingZoom: floatingZoom,
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
            setProjectModified(true);

            // Sauvegarder aussi dans localStorage pour cohérence
            saveProject(savedName);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                alert('Erreur lors de la sauvegarde du fichier: ' + e.message);
            }
        }
    }, [intersectionName, projectName, getFullState, setIntersectionName, saveProject, saveDirectoryHandle, addRecentDirectory, recentOpenDirs, recentSaveDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs]);

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
                suggestedName: `${projectName || 'projet'}.json`,
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
                ...fullState,
                diagramHeight: diagramHeight,
                floatingCrop: floatingCrop,
                floatingZoom: floatingZoom,
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
            setProjectModified(true);

            // Sauvegarder aussi dans localStorage pour cohérence
            saveProject(savedName);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                alert('Erreur lors de la sauvegarde du fichier: ' + e.message);
            }
        }
    }, [recentSaveDirs, intersectionName, projectName, loadDirectoryHandle, saveDirectoryHandle, addRecentDirectory, getFullState, setIntersectionName, saveProject, recentOpenDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs]);

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

    // Inject dynamic @page margin box content for dossier footer
    const injectDossierFooterStyle = () => {
        // Remove previous if exists
        const prev = document.getElementById('dossier-print-footer-style');
        if (prev) prev.remove();
        const path = currentProjectPath ? currentProjectPath.replace(/\.json$/i, '').replace(/"/g, '\\"') : 'Projet non enregistré';
        const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const style = document.createElement('style');
        style.id = 'dossier-print-footer-style';
        style.textContent = `
            @page dossier-page {
                @bottom-left { content: "${path}"; font-size: 10px; color: #444; }
                @bottom-center { content: "${dateStr}"; font-size: 10px; color: #444; }
                @bottom-right { content: "Page " counter(page); font-size: 10px; color: #444; }
            }
        `;
        document.head.appendChild(style);
        return style;
    };

    // Handler confirmation impression dossier
    const handleDossierConfirm = () => {
        setDossierDialog(false);
        setPrintType('dossier');
        setPrintPreviewModal(true);
        setTimeout(() => {
            document.body.classList.add('print-dossier');
            const footerStyle = injectDossierFooterStyle();
            window.print();
            footerStyle.remove();
            document.body.classList.remove('print-dossier');
            setPrintPreviewModal(false);
            setPrintType(null);
        }, 500);
    };

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
                    setProjectModified(false);
                    projectModifiedSkip.current = true;
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
            case 'printDossier':
                // Ouvrir le dialog de sélection des sections
                // Initialiser uniquement si vide (premier accès), sinon conserver les choix
                setDossierSections(prev => {
                    if (Object.keys(prev).length > 0) return prev;
                    return {
                        image: true,
                        gfNumbers: true,
                        formulaire: true,
                        securiteMatrix: false,
                        matrice: true,
                        ...Object.fromEntries(pfTabs.flatMap(pf => {
                            const checked = !!pf.color;
                            return [
                                [`diagram_${pf.id}`, checked],
                                [`conditionsMicro_${pf.id}`, checked],
                                [`variablesMicro_${pf.id}`, checked],
                                [`phasageBulle_${pf.id}`, checked],
                                [`traficCapacite_${pf.id}`, checked],
                            ];
                        })),
                    };
                });
                setDossierDialog(true);
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
                    setMoveGroupTouched(false);
                    setMoveGroupModal(true);
                } else {
                    alert('Il faut au moins 2 groupes pour effectuer un déplacement.');
                }
                break;
            case 'biCarrefour':
                if (groups.length > 1) {
                    setBiCarrefourGroupId(groups[0]?.id?.toString() || '');
                    setBiCarrefourTouched(false);
                    setBiCarrefourModal(true);
                } else {
                    alert('Il faut au moins 2 groupes pour intégrer un bi-carrefour.');
                }
                break;
            case 'uniCarrefour':
                setBiCarrefourSeparator(null);
                break;
            case 'slide':
                setSlideValue(0);
                setSlideFromGroup(groups[0]?.id || 1);
                setSlideToGroup(groups[groups.length - 1]?.id || 1);
                setSlideTouched(false);
                setSlideModal(true);
                break;
            case 'insert':
                setInsertStart(0);
                setInsertDuration(5);
                setInsertTouched(false);
                setInsertModal(true);
                break;
            case 'reduce':
                setReduceStart(0);
                setReduceDuration(5);
                setReduceTouched(false);
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
            case 'toggleParameters':
                setSidebarVisible(v => !v);
                break;
            case 'toggleComments':
                setShowComments(v => !v);
                break;
            case 'toggleRemarks':
                setShowRemarks(v => !v);
                break;
            case 'toggleDarkMode':
                setDarkMode(v => !v);
                break;
            case 'toggleGroupNamesForm':
                setShowGroupNamesForm(v => !v);
                break;
            case 'toggleGroupNamesMatrix':
                setShowGroupNamesMatrix(v => !v);
                break;
            case 'toggleGroupNamesDiagram':
                setShowGroupNamesDiagram(v => !v);
                break;
            case 'toggleFloatingImage':
                setShowFloatingImage(v => !v);
                break;
            case 'toggleFloatingMatrix':
                setShowFloatingMatrix(v => !v);
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
                            projectName: file.name,
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

    // IndexedDB pour données greenwave (localStorage trop limité en taille)
    const openGreenWaveDB = useCallback(() => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DiagrammeFeux_GreenWave', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('data')) {
                    db.createObjectStore('data');
                }
            };
        });
    }, []);

    const saveGreenWaveToIDB = useCallback(async (key, value) => {
        const db = await openGreenWaveDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['data'], 'readwrite');
            const store = tx.objectStore('data');
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }, [openGreenWaveDB]);

    // Handle green wave creation - opens in new tab
    const handleCreateGreenWave = async (intersections) => {
        const greenWaveId = Date.now().toString();
        let useIDB = false;

        try {
            sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(intersections));
        } catch (e) {
            // Quota dépassé : fallback IndexedDB
            await saveGreenWaveToIDB(`greenwave_${greenWaveId}`, intersections);
            useIDB = true;
        }

        window.open(`${window.location.origin}${window.location.pathname}?greenwave&id=${greenWaveId}${useIDB ? '&idb=1' : ''}`, '_blank');
        setCreateGreenWaveModal(false);
    };

    // Handle opening a saved green wave
    const handleOpenSavedGreenWave = async () => {
        if (!selectedGreenWave) return;

        try {
            const saved = localStorage.getItem('savedGreenWaves');
            if (saved) {
                const greenWaves = JSON.parse(saved);
                const greenWaveData = greenWaves[selectedGreenWave];

                if (greenWaveData && greenWaveData.intersections) {
                    const greenWaveId = Date.now().toString();
                    let useIDB = false;

                    try {
                        sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(greenWaveData.intersections));
                        sessionStorage.setItem(`greenwave_settings_${greenWaveId}`, JSON.stringify({
                            name: selectedGreenWave,
                            speed: greenWaveData.speed,
                            speedUp: greenWaveData.speedUp,
                            speedDown: greenWaveData.speedDown,
                            speedLineOffsetUp: greenWaveData.speedLineOffsetUp,
                            speedLineOffsetDown: greenWaveData.speedLineOffsetDown,
                            pixelsPerSecond: greenWaveData.pixelsPerSecond,
                            pixelsPerMeter: greenWaveData.pixelsPerMeter
                        }));
                    } catch (e) {
                        await saveGreenWaveToIDB(`greenwave_${greenWaveId}`, greenWaveData.intersections);
                        await saveGreenWaveToIDB(`greenwave_settings_${greenWaveId}`, {
                            name: selectedGreenWave,
                            speed: greenWaveData.speed,
                            speedUp: greenWaveData.speedUp,
                            speedDown: greenWaveData.speedDown,
                            speedLineOffsetUp: greenWaveData.speedLineOffsetUp,
                            speedLineOffsetDown: greenWaveData.speedLineOffsetDown,
                            pixelsPerSecond: greenWaveData.pixelsPerSecond,
                            pixelsPerMeter: greenWaveData.pixelsPerMeter
                        });
                        useIDB = true;
                    }

                    window.open(`${window.location.origin}${window.location.pathname}?greenwave&id=${greenWaveId}${useIDB ? '&idb=1' : ''}`, '_blank');
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
                const greenWaveId = Date.now().toString();
                let useIDB = false;

                try {
                    sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(greenWaveData.intersections));
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
                } catch (e) {
                    await saveGreenWaveToIDB(`greenwave_${greenWaveId}`, greenWaveData.intersections);
                    await saveGreenWaveToIDB(`greenwave_settings_${greenWaveId}`, {
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
                    });
                    useIDB = true;
                }

                window.open(`${window.location.origin}${window.location.pathname}?greenwave&id=${greenWaveId}${useIDB ? '&idb=1' : ''}`, '_blank');
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
            const data = loadProject(selectedProject);
            setOpenModal(false);
            setSelectedProject(null);
            if (data && typeof data === 'object') {
                const hasComments = data.groups?.some(g => g.comment && g.comment.trim() !== '') || (data.pfTabs || []).some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== ''));
                setShowComments(!!hasComments);
                const pfList = data.pfTabs || [];
                const hasRemarks = pfList.some(pf => pf.remarques && pf.remarques.trim() !== '');
                setShowRemarks(!!hasRemarks);
            }
        }
    };

    // Handle slide confirmation
    const handleSlide = () => {
        if (slideValue !== 0) {
            slideAllGroups(slideValue, slideFromGroup, slideToGroup);
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
                projectName: importedData.intersectionName,
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
                projectName: importedData.intersectionName,
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
                    projectName: importedData.intersectionName,
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
                        const csvProjName = importFile.name.replace(/\.csv$/i, '');
                        loadFullState({
                            projectName: csvProjName,
                            intersectionName: csvProjName,
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
                    projectName: fileName,
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
            } else if (e.key === 'F1') {
                e.preventDefault();
                setHelpModal(true);
                const zone = helpZoneRef.current;
                if (zone) {
                    setTimeout(() => {
                        const el = document.getElementById(`help-${zone}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // Apply dark/light mode to body
    useEffect(() => {
        document.body.classList.toggle('light-mode', !darkMode);
    }, [darkMode]);

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

    // Render floating image content into popup window
    useEffect(() => {
        if (!showFloatingImage || !intersectionImage) return;

        const showNums = JSON.parse(localStorage.getItem('intersection_showGroupNumbers') ?? 'true');

        // Compute group number centroids
        const groupMap = {};
        intersectionArrows.forEach(arrow => {
            if (!arrow.groupId) return;
            const group = groups.find(g => g.id === arrow.groupId);
            const courant = group?.courant || '';
            let px = arrow.x;
            let py = arrow.y;
            if (courant === 'TàD' || courant === 'TàG') {
                const sc = arrow.scale || 1;
                const svgSize = 96 * sc;
                const dxSvg = courant === 'TàD' ? -8 : 8;
                const dySvg = 2;
                const dxPx = (dxSvg / 32) * svgSize;
                const dyPx = (dySvg / 32) * svgSize;
                const rotRad = (arrow.rotation || 0) * Math.PI / 180;
                px += (dxPx * Math.cos(rotRad) - dyPx * Math.sin(rotRad)) / 750 * 100;
                py += (dxPx * Math.sin(rotRad) + dyPx * Math.cos(rotRad)) / 530 * 100;
            }
            if (!groupMap[arrow.groupId]) groupMap[arrow.groupId] = [];
            groupMap[arrow.groupId].push({ x: px, y: py });
        });

        // Use simulation time when playing, otherwise use hovered time
        const activeTime = (simulationEnabled && isPlayingSimulation)
            ? simulationCurrentTime
            : hoveredDiagramTime;

        floatingImagePopup.renderToPopup(
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '6px 12px', background: '#2a2a2a', borderBottom: '1px solid #444', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div className="floating-zoom-control">
                        <button className="floating-zoom-btn" onClick={() => setFloatingZoom(z => Math.max(0.3, z - 0.1))} title="Réduire">−</button>
                        <span className="floating-zoom-value">{Math.round(floatingZoom * 100)}%</span>
                        <button className="floating-zoom-btn" onClick={() => setFloatingZoom(z => Math.min(2, z + 0.1))} title="Agrandir">+</button>
                    </div>
                    <button
                        className={`floating-crop-btn ${showCropControls ? 'active' : ''}`}
                        onClick={() => setShowCropControls(!showCropControls)}
                        title="Rogner l'image"
                    >
                        ✂
                    </button>
                </div>
                {showCropControls && (
                    <div className="floating-crop-controls">
                        <div className="crop-control">
                            <label>Haut</label>
                            <input type="range" min="0" max="250" value={floatingCrop.top} onChange={(e) => setFloatingCrop(prev => ({ ...prev, top: parseInt(e.target.value) }))} />
                            <span>{floatingCrop.top}px</span>
                        </div>
                        <div className="crop-control">
                            <label>Bas</label>
                            <input type="range" min="0" max="250" value={floatingCrop.bottom} onChange={(e) => setFloatingCrop(prev => ({ ...prev, bottom: parseInt(e.target.value) }))} />
                            <span>{floatingCrop.bottom}px</span>
                        </div>
                        <div className="crop-control">
                            <label>Gauche</label>
                            <input type="range" min="0" max="350" value={floatingCrop.left} onChange={(e) => setFloatingCrop(prev => ({ ...prev, left: parseInt(e.target.value) }))} />
                            <span>{floatingCrop.left}px</span>
                        </div>
                        <div className="crop-control">
                            <label>Droite</label>
                            <input type="range" min="0" max="350" value={floatingCrop.right} onChange={(e) => setFloatingCrop(prev => ({ ...prev, right: parseInt(e.target.value) }))} />
                            <span>{floatingCrop.right}px</span>
                        </div>
                        <button className="crop-reset-btn" onClick={() => setFloatingCrop({ top: 0, bottom: 0, left: 0, right: 0 })}>Réinitialiser</button>
                    </div>
                )}
                <div className="floating-image-content" style={{ flex: 1, overflow: 'auto' }}>
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
                            <img src={intersectionImage} alt="Carrefour" style={{ filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%)` }} />
                            {showNums && Object.entries(groupMap).map(([gId, pts]) => {
                                const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
                                const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
                                const g = groups.find(gr => gr.id === Number(gId));
                                const isPieton = (g?.courant || '') === 'Piéton';
                                return isPieton ? (
                                    <div key={`fgnum-${gId}`} className="group-number-centroid pieton" style={{ left: `${cx}%`, top: `${cy}%` }}>
                                        <svg viewBox="0 0 20 18" width="20" height="18">
                                            <polygon points="10,1 1,17 19,17" fill="rgba(255,255,255,0.7)" stroke="#000" strokeWidth="1"/>
                                            <text x="10" y="15" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">{gId}</text>
                                        </svg>
                                    </div>
                                ) : (
                                    <div key={`fgnum-${gId}`} className="group-number-centroid" style={{ left: `${cx}%`, top: `${cy}%` }}>
                                        {gId}
                                    </div>
                                );
                            })}
                            {intersectionArrows.map(arrow => {
                                const group = groups.find(g => g.id === arrow.groupId);
                                const courant = group?.courant || '';
                                const rotation = arrow.rotation || 0;
                                const scale = arrow.scale || 1;
                                const arrowLength = arrow.length || 1;
                                const turnLength = arrow.turnLength || 1;
                                const isHovered = hoveredArrowGroupId === arrow.groupId;

                                let arrowColor = '#000000';
                                if (activeTime !== null && group) {
                                    const isSimPlaying = simulationEnabled && isPlayingSimulation;
                                    const simGroup = isSimPlaying ? simulationResult?.simulatedGroups?.find(g => g.id === arrow.groupId) : null;
                                    const offset = simGroup ? (simGroup.simulatedOffset ?? group.offset) : (group.offset || 0);
                                    const greenDuration = simGroup ? (simGroup.simulatedGreen ?? group.durations?.green ?? 0) : (group.durations?.green || 0);
                                    const orangeDuration = group.durations?.orange || 0;
                                    const cycle = isSimPlaying ? (simulationResult?.simulatedCycleLength || cycleLength || 100) : (cycleLength || 100);

                                    const secondeLucarneAction = actionData.find(action =>
                                        action.action === 'Seconde lucarne' &&
                                        action.gf === String(arrow.groupId) &&
                                        action.deb !== '' && action.fin !== ''
                                    );

                                    let isInSecondeLucarne = false;
                                    if (secondeLucarneAction) {
                                        const slDeb = parseInt(secondeLucarneAction.deb) || 0;
                                        const slFin = parseInt(secondeLucarneAction.fin) || 0;
                                        const normalizedTime = activeTime % cycle;
                                        if (slDeb <= slFin) {
                                            isInSecondeLucarne = normalizedTime >= slDeb && normalizedTime < slFin;
                                        } else {
                                            isInSecondeLucarne = normalizedTime >= slDeb || normalizedTime < slFin;
                                        }
                                    }

                                    if (isInSecondeLucarne) {
                                        arrowColor = '#00aa00';
                                    } else {
                                        let relativeTime = (activeTime - offset + cycle) % cycle;
                                        if (relativeTime < greenDuration) {
                                            arrowColor = '#00cc00';
                                        } else if (relativeTime < greenDuration + orangeDuration) {
                                            arrowColor = '#ffff00';
                                        } else {
                                            arrowColor = '#cc0000';
                                        }
                                    }
                                }

                                return (
                                    <div
                                        key={arrow.id}
                                        className={`floating-arrow-marker ${isHovered ? 'hovered' : ''}`}
                                        style={{ left: `${arrow.x}%`, top: `${arrow.y}%` }}
                                    >
                                        <div className="arrow-symbol" style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}>
                                            {renderFloatingArrowSVG(courant, arrowColor, arrowLength, turnLength)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [showFloatingImage, intersectionImage, floatingCrop, floatingZoom, showCropControls,
        intersectionArrows, groups, hoveredArrowGroupId, hoveredDiagramTime,
        simulationEnabled, isPlayingSimulation, simulationCurrentTime, simulationResult,
        actionData, cycleLength, imageBrightness, imageContrast, floatingImagePopup.renderToPopup]);

    // Render matrix into popup window
    useEffect(() => {
        if (!showFloatingMatrix) return;
        matrixPopup.renderToPopup(
            <div style={{ padding: '12px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
                <IntergreenMatrix
                    conflictMatrix={conflictMatrix}
                    setMatrixValue={setMatrixValue}
                    groups={groups}
                    cycleLength={cycleLength}
                    actionData={actionData}
                    activePFId={activePFId}
                    pfTabs={pfTabs}
                    biCarrefourSeparator={biCarrefourSeparator}
                    onCellHover={() => {}}
                    showGroupNames={showGroupNamesMatrix}
                />
            </div>
        );
    }, [showFloatingMatrix, conflictMatrix, groups, cycleLength, actionData, activePFId,
        pfTabs, biCarrefourSeparator, showGroupNamesMatrix, matrixPopup.renderToPopup]);

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
                    biCarrefourSeparator={biCarrefourSeparator}
                    layoutOptions={{ showParameters: sidebarVisible, showComments, showRemarks, darkMode, showGroupNamesForm, showGroupNamesMatrix, showGroupNamesDiagram, projectModified, showFloatingImage, hasIntersectionImage: !!intersectionImage, showFloatingMatrix }}
                    pixelsPerSecond={pixelsPerSecond}
                    onPixelsPerSecondChange={setPixelsPerSecond}
                />
            <header className="app-header" onMouseEnter={() => { helpZoneRef.current = 'interface'; }}>
                <div className="header-inputs">
                    <input
                        className="input-name"
                        type="text"
                        value={projectName || ''}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Nom du projet"
                        title="Nom du projet (utilisé pour la sauvegarde)"
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
                                    const msg = newCount < groups.length
                                        ? `Réduire de ${groups.length} à ${newCount} groupes de feu supprimera les paramètres des groupes supprimés sur l'ensemble des plans de feu.\n\nConfirmer ?`
                                        : `L'ajout de groupes de feux s'appliquera pour l'ensemble des plans de feu.\n\nConfirmer ?`;
                                    if (window.confirm(msg)) {
                                        setGroupCount(newCount);
                                    } else {
                                        setGroupCountInput(groups.length.toString());
                                    }
                                } else {
                                    setGroupCountInput(groups.length.toString());
                                }
                            }}
                            className="input-count"
                        />
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
                </div>

                <div className="status-bar">
                    {activeConflicts.length > 0 ? (
                        <div className="status-error">
                            {activeConflicts.length} CONFLITS !
                        </div>
                    ) : (
                        <button
                            className={`toggle-btn validate-btn ${pfTabs.find(pf => pf.id === activePFId)?.color === '#4CAF50' ? 'validated' : ''} ${pfTabs.find(pf => pf.id === activePFId)?.color === '#e74c3c' ? 'invalidated' : ''}`}
                            onClick={(e) => {
                                const activePF = pfTabs.find(pf => pf.id === activePFId);
                                if (e.ctrlKey && !activePF?.color) {
                                    // Ctrl+clic depuis neutre → invalidé (rouge)
                                    setPFColor(activePFId, '#e74c3c');
                                } else if (activePF?.color) {
                                    // Clic simple sur validé ou invalidé → neutre
                                    setPFColor(activePFId, null);
                                } else {
                                    // Clic simple sur neutre → validé (vert)
                                    setPFColor(activePFId, '#4CAF50');
                                }
                            }}
                            title="Clic: valider / Ctrl+clic: invalider"
                        >
                            {pfTabs.find(pf => pf.id === activePFId)?.color === '#e74c3c' ? 'Invalidé'
                            : pfTabs.find(pf => pf.id === activePFId)?.color === '#4CAF50' ? 'Validé'
                            : 'Valider'}
                        </button>
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
                    width: sidebarVisible ? `${phasageBulleEnabled ? Math.min(sidebarWidth, 350) : sidebarWidth}px` : '0px',
                    minWidth: sidebarVisible ? (phasageBulleEnabled ? '200px' : '300px') : '0px',
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
                                    className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('properties');
                                        setSidebarWidth(450);
                                    }}
                                >
                                    Propriétés
                                </button>
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

                            {activeTab === 'properties' && (
                                <div onMouseEnter={() => { helpZoneRef.current = 'properties'; }}>
                                    <PropertiesPanel
                                        intersectionName={intersectionName}
                                        setIntersectionName={setIntersectionName}
                                        projectProperties={projectProperties}
                                        updateProjectProperty={updateProjectProperty}
                                        appCommunes={appCommunes}
                                        appMoaLogos={appMoaLogos}
                                        appMoeLogos={appMoeLogos}
                                    />
                                </div>
                            )}

                            {activeTab === 'config' && (
                                <>
                                    <div onMouseEnter={() => { helpZoneRef.current = 'config-groupes'; }}>
                                    <GroupTable
                                        groups={groups}
                                        updateGroupParams={updateGroupParams}
                                        cycleLength={cycleLength}
                                        showGroupNames={showGroupNamesForm}
                                    />
                                    </div>
                                    <div style={{ marginTop: '2rem' }} onMouseEnter={() => { helpZoneRef.current = 'matrice'; }}>
                                        <IntergreenMatrix
                                            conflictMatrix={conflictMatrix}
                                            setMatrixValue={setMatrixValue}
                                            groups={groups}
                                            cycleLength={cycleLength}
                                            actionData={actionData}
                                            activePFId={activePFId}
                                            pfTabs={pfTabs}
                                            biCarrefourSeparator={biCarrefourSeparator}
                                            onCellHover={setHoveredConflict}
                                            showGroupNames={showGroupNamesMatrix}
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === 'matrix' && (
                                <div onMouseEnter={() => { helpZoneRef.current = 'matrice'; }}>
                                <IntergreenMatrix
                                    conflictMatrix={conflictMatrix}
                                    setMatrixValue={setMatrixValue}
                                    groups={groups}
                                    cycleLength={cycleLength}
                                    actionData={actionData}
                                    activePFId={activePFId}
                                    pfTabs={pfTabs}
                                    biCarrefourSeparator={biCarrefourSeparator}
                                    onCellHover={setHoveredConflict}
                                    showGroupNames={showGroupNamesMatrix}
                                    onDetach={() => setShowFloatingMatrix(v => !v)}
                                />
                                </div>
                            )}

                            {activeTab === 'traffic' && (
                                <div onMouseEnter={() => { helpZoneRef.current = 'trafic'; }}>
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
                                    setHoveredGroupSaturated={setHoveredArrowGroupSaturated}
                                    trafficDatasetNames={trafficDatasetNames}
                                    setHoveredVUtile={setHoveredVUtile}
                                    copyTrafficDataset={copyTrafficDataset}
                                    addCustomTrafficDataset={addCustomTrafficDataset}
                                    actionData={actionData}
                                    simulationSelectedActions={simulationSelectedActions}
                                />
                                </div>
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
                                className={`pf-tab ${activePFId === pf.id ? 'active' : ''} ${draggedTabIndex === index ? 'dragging' : ''} ${pf.color === '#4CAF50' ? 'pf-validated' : ''} ${pf.color === '#e74c3c' ? 'pf-invalidated' : ''}`}
                                style={{}}
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

                        <div className="pf-tabs-spacer"></div>
                    </div>

                    {!phasageBulleEnabled && (
                        <div
                            className="diagram-panel"
                            onMouseEnter={() => { helpZoneRef.current = 'diagramme'; }}
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
                                setIsPlayingSimulation={setIsPlayingSimulation}
                                setSimulationCurrentTime={setSimulationCurrentTime}
                                hoveredArrowGroupId={hoveredArrowGroupId}
                                hoveredArrowGroupSaturated={hoveredArrowGroupSaturated}
                                hoveredConflict={hoveredConflict}
                                setHoveredGroupId={setHoveredArrowGroupId}
                                setHoveredDiagramTime={setHoveredDiagramTime}
                                hoveredVUtile={hoveredVUtile}
                                planName={simulationEnabled ? (pfTabs.find(pf => pf.id === activePFId)?.name || '') : ''}
                                activePFName={pfTabs.find(pf => pf.id === activePFId)?.name || ''}
                                remarques={currentRemarques}
                                updateRemarques={updatePFRemarques}
                                biCarrefourSeparator={biCarrefourSeparator}
                                cycleLengthInput={cycleLengthInput}
                                setCycleLengthInput={setCycleLengthInput}
                                setCycleLength={setCycleLength}
                                showComments={simulationEnabled ? false : showComments}
                                showRemarks={simulationEnabled ? false : showRemarks}
                                showGroupNames={showGroupNamesDiagram}
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

                    <div className="action-panel" onMouseEnter={() => { helpZoneRef.current = 'actions'; }} style={{
                        borderTop: phasageBulleEnabled ? 'none' : 'none',
                        marginTop: phasageBulleEnabled ? 0 : 0,
                        flex: diagramHeight !== null ? '1' : '0 0 auto',
                        overflow: (phasageBulleEnabled || simulationEnabled) ? 'auto' : 'hidden'
                    }}>
                        <div style={{ display: phasageBulleEnabled ? 'block' : 'none', position: 'relative', height: '100%' }}>
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
                                imageBrightness={imageBrightness}
                                imageContrast={imageContrast}
                                initialBubbleScale={phasageBubbleScale}
                                initialEllipseScale={phasageEllipseScale}
                                initialBubbleRatio={phasageBubbleRatio}
                                onBubbleScaleChange={setPhasageBubbleScale}
                                onEllipseScaleChange={setPhasageEllipseScale}
                                onBubbleRatioChange={setPhasageBubbleRatio}
                            />
                            {/* Panneau de configuration flottant en haut à gauche */}
                            {phasageBulleModal && (
                                <div className="phasage-config-panel">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em' }}>
                                            Phases :
                                            <select
                                                value={phasageBulleCount}
                                                onChange={(e) => setPhasageBulleCount(parseInt(e.target.value))}
                                                style={{ padding: '3px' }}
                                            >
                                                {[2, 3, 4, 5, 6].map(n => (
                                                    <option key={n} value={n}>{n}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <span style={{ color: '#888', fontSize: '0.85em' }}>Cycle : {cycleLength}s</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '3px 6px', justifyContent: 'start' }}>
                                        {Array.from({ length: phasageBulleCount }, (_, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <span style={{ color: '#dc4edc', fontWeight: 'bold', fontSize: '0.85em' }}>P{i + 1}:</span>
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
                                                    style={{ width: '30px', padding: '2px', textAlign: 'center' }}
                                                />
                                                <span style={{ color: '#888', fontSize: '0.85em' }}>s</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                        <button className="modal-btn modal-btn-secondary" style={{ padding: '3px 10px', fontSize: '0.85em' }} onClick={() => {
                                            setPhasageBulleModal(false);
                                            setPhasageBulleEnabled(false);
                                        }}>
                                            Annuler
                                        </button>
                                        <button className="modal-btn modal-btn-primary" style={{ padding: '3px 10px', fontSize: '0.85em' }} onClick={() => {
                                            setPhasageBulleModal(false);
                                            setPhasageBulleEnabled(true);
                                            setSimulationEnabled(false);
                                            setPhasageBulleVersion(v => v + 1);
                                        }}>
                                            OK
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: simulationEnabled && !phasageBulleEnabled ? 'contents' : 'none' }}>
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
                                intersectionName={intersectionName}
                                imageBrightness={imageBrightness}
                                setImageBrightness={setImageBrightness}
                                imageContrast={imageContrast}
                                setImageContrast={setImageContrast}
                            />
                        </div>
                        <div style={{ display: !phasageBulleEnabled && !simulationEnabled ? 'contents' : 'none' }}>
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
                        </div>
                    </div>
                </section>
            </main>

            {/* Modal Ouvrir */}
            <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Ouvrir un projet" overlayClassName="modal-menu-overlay">
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
                                                const data = loadProject(project.name);
                                                setOpenModal(false);
                                                setSelectedProject(null);
                                                if (data && typeof data === 'object') {
                                                    const hasComments = data.groups?.some(g => g.comment && g.comment.trim() !== '') || (data.pfTabs || []).some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== ''));
                                                    setShowComments(!!hasComments);
                                                    const pfList = data.pfTabs || [];
                                                    const hasRemarks = pfList.some(pf => pf.remarques && pf.remarques.trim() !== '');
                                                    setShowRemarks(!!hasRemarks);
                                                }
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
            <Modal isOpen={slideModal} onClose={() => setSlideModal(false)} title="Glisser le diagramme" overlayClassName="modal-menu-overlay modal-compact-overlay">
                <div className="form-row">
                    <label>
                        Du groupe :
                        <select
                            value={slideFromGroup}
                            onChange={(e) => { setSlideFromGroup(parseInt(e.target.value)); setSlideTouched(true); }}
                            style={{ marginLeft: '10px', padding: '5px' }}
                            title="Premier groupe de la plage à décaler"
                        >
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name || `Groupe ${g.id}`}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="form-row">
                    <label>
                        Au groupe :
                        <select
                            value={slideToGroup}
                            onChange={(e) => { setSlideToGroup(parseInt(e.target.value)); setSlideTouched(true); }}
                            style={{ marginLeft: '10px', padding: '5px' }}
                            title="Dernier groupe de la plage à décaler"
                        >
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name || `Groupe ${g.id}`}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="form-row">
                    <label>
                        Décalage (secondes) :
                        <input
                            type="number"
                            value={slideValue}
                            onChange={(e) => { setSlideValue(parseInt(e.target.value) || 0); setSlideTouched(true); }}
                            title="Positif : décale vers la droite / Négatif : décale vers la gauche"
                        />
                    </label>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setSlideModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleSlide} disabled={!slideTouched}>
                        Appliquer
                    </button>
                </div>
            </Modal>

            {/* Modal Inserer */}
            <Modal isOpen={insertModal} onClose={() => setInsertModal(false)} title="Insérer une plage" overlayClassName="modal-menu-overlay modal-compact-overlay">
                <div className="form-row">
                    <label>
                        À partir de la seconde :
                        <input
                            type="number"
                            min="0"
                            max={cycleLength}
                            value={insertStart}
                            onChange={(e) => { setInsertStart(parseInt(e.target.value) || 0); setInsertTouched(true); }}
                            title={`Les groupes après cette seconde seront décalés. Cycle: ${cycleLength}s`}
                        />
                    </label>
                </div>
                <div className="form-row">
                    <label>
                        Durée à insérer (s) :
                        <input
                            type="number"
                            min="1"
                            value={insertDuration}
                            onChange={(e) => { setInsertDuration(parseInt(e.target.value) || 1); setInsertTouched(true); }}
                            title={`Le cycle passera de ${cycleLength}s à ${cycleLength + insertDuration}s`}
                        />
                    </label>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setInsertModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleInsert} disabled={!insertTouched}>
                        Insérer
                    </button>
                </div>
            </Modal>

            {/* Modal Réduire */}
            <Modal isOpen={reduceModal} onClose={() => setReduceModal(false)} title="Réduire une plage" overlayClassName="modal-menu-overlay modal-compact-overlay">
                <div className="form-row">
                    <label>
                        À partir de la seconde :
                        <input
                            type="number"
                            min="0"
                            max={cycleLength - 1}
                            value={reduceStart}
                            onChange={(e) => { setReduceStart(parseInt(e.target.value) || 0); setReduceTouched(true); }}
                            title={`Les groupes après cette position seront décalés. Cycle: ${cycleLength}s`}
                        />
                    </label>
                </div>
                <div className="form-row">
                    <label>
                        Durée à supprimer (s) :
                        <input
                            type="number"
                            min="1"
                            max={cycleLength - reduceStart}
                            value={reduceDuration}
                            onChange={(e) => { setReduceDuration(parseInt(e.target.value) || 1); setReduceTouched(true); }}
                            title={`Le cycle passera de ${cycleLength}s à ${Math.max(1, cycleLength - reduceDuration)}s`}
                        />
                    </label>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setReduceModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleReduce} disabled={!reduceTouched}>
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
                        <p>Elle permet de concevoir, visualiser et valider les plans de feux d'un carrefour à feux tricolores. L'application couvre l'ensemble du processus : définition des groupes de feux et de leurs paramètres temporels (vert, orange, rouge), saisie de la matrice des temps de dégagement entre groupes conflictuels, configuration des actions de micro-régulation (adaptatif, escamotage, fermeture anticipée, ouverture anticipée), gestion des données de trafic et de capacité, et coordination des feux sur un axe via l'outil onde verte. Elle génère un dossier imprimable complet incluant le formulaire, les matrices, les diagrammes, le phasage bulle et les conditions de micro-régulation pour chaque plan de feu.</p>
                        <p>Chaque modification se répercute instantanément sur l'ensemble de l'interface : ajustez un temps de vert dans le formulaire et le diagramme se redessine en temps réel ; déplacez une barre directement sur le diagramme et les valeurs du formulaire suivent ; modifiez la matrice des temps interverts et la détection des conflits se met à jour immédiatement. Cette interactivité permanente entre le formulaire, le diagramme, la matrice et le tableau des actions vous offre une vision globale et cohérente à chaque instant.</p>
                        <p>Le glisser-déposer des barres, la surbrillance croisée entre le tableau des actions et le diagramme, les flèches de dépendance, le calcul automatique des conflits et des données trafic : tout est pensé pour vous accompagner dans la mise au point de vos plans de feux, de la première esquisse jusqu'à la validation finale.</p>
                    </section>

                    <section id="help-interface" className="help-section">
                        <h4>Interface principale</h4>
                        <ul>
                            <li><strong>En-tête :</strong> Nom du carrefour, nombre de groupes, durée du cycle, zoom</li>
                            <li><strong>Panneau gauche :</strong> Onglets Projets, Configuration et Trafic</li>
                            <li><strong>Zone centrale :</strong> Diagramme temporel et tableau des conditions de micro-régulation</li>
                            <li><strong>Onglets PF :</strong> Gérez plusieurs plans de feux (PF1, PF2...) :
                                <ul>
                                    <li><em>Ajouter :</em> Cliquez sur le bouton "+" pour créer un nouveau plan de feux vierge.</li>
                                    <li><em>Dupliquer :</em> Via le menu Diagramme → Dupliquer, crée un nouvel onglet avec une copie du plan actuel.</li>
                                    <li><em>Renommer :</em> Double-cliquez sur un onglet PF pour modifier son nom.</li>
                                    <li><em>Réordonner :</em> Glissez-déposez un onglet PF pour modifier l'ordre des plans de feux.</li>
                                    <li><em>Supprimer :</em> Via le menu Diagramme → Supprimer, supprime l'onglet PF actif (impossible s'il n'en reste qu'un).</li>
                                </ul>
                            </li>
                            <li><strong>Indicateur Valider/Validé :</strong> Cliquez sur "Valider" (quand aucun conflit) pour marquer l'onglet PF en vert. Cliquez à nouveau pour annuler la validation.</li>
                            <li><strong>Séparateur ajustable :</strong> La position du séparateur entre le diagramme et les conditions de micro-régulation est sauvegardée avec le projet.</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Mise en page de l'interface et optimisation de l'écran</h4>
                        <ul>
                            <li><strong>Zoom du diagramme :</strong> Le curseur "Zoom" dans l'en-tête permet d'ajuster l'échelle horizontale du diagramme (de 4 à 20 px/s). Vous pouvez également utiliser <strong>Ctrl + molette de la souris</strong> pour zoomer ou dézoomer la page entière.</li>
                            <li><strong>Séparateur vertical :</strong> La barre de séparation entre le panneau de configuration (à gauche) et la zone du diagramme (à droite) est déplaçable par glisser-déposer. Sa position est sauvegardée automatiquement.</li>
                            <li><strong>Séparateur horizontal :</strong> La barre de séparation entre le diagramme (en haut) et le tableau des conditions de micro-régulation (en bas) est également déplaçable par glisser-déposer. Sa position est sauvegardée avec le projet.</li>
                            <li><strong>Masquer le panneau de configuration :</strong> Le bouton "Paramètre" dans l'en-tête permet de masquer ou d'afficher le panneau de configuration à gauche, libérant ainsi toute la largeur de l'écran pour le diagramme.</li>
                            <li><strong>Image du carrefour :</strong> Le menu Mise en page permet d'afficher ou masquer la fenêtre détachée de l'image du carrefour. L'option est grisée si aucune image n'est chargée.</li>
                        </ul>
                    </section>

                    <section id="help-config-groupes" className="help-section">
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

                    <section id="help-matrice" className="help-section">
                        <h4>Matrice des temps interverts</h4>
                        <p>Définit les temps de dégagement (intervert) entre groupes conflictuels.
                        Valeurs acceptées : 3 à 20 secondes.</p>
                        <p>Dans les différents plans de feux, les valeurs de la matrice sont affichées selon un code couleur :</p>
                        <ul>
                            <li><strong style={{ color: '#fff' }}>Blanc :</strong> Valeur de base, telle que définie dans le plan de feux de référence (PF1).</li>
                            <li><strong style={{ color: '#4caf50' }}>Vert :</strong> Valeur réévaluée à la baisse par rapport au PF1 pour tenir compte des temps de dégagement.</li>
                            <li><strong style={{ color: '#f44336' }}>Rouge :</strong> Valeur ajustée à la hausse par rapport au PF1.</li>
                            <li><strong style={{ color: '#fff', background: 'rgba(255,0,0,0.3)', padding: '0 4px', borderRadius: '2px' }}>Fond rouge :</strong> Conflit détecté — le temps de dégagement requis n'est pas respecté dans le diagramme.</li>
                            <li><strong style={{ color: '#fff', background: 'rgba(255,165,0,0.3)', padding: '0 4px', borderRadius: '2px' }}>Fond orange :</strong> Valeur manquante — une case symétrique (GFx→GFy / GFy→GFx) n'est pas renseignée, ce qui compromet la symétrie de la matrice.</li>
                        </ul>
                    </section>

                    <section id="help-diagramme" className="help-section">
                        <h4>Diagramme</h4>
                        <ul>
                            <li><strong>DA (Délai d'approche) :</strong> Temps nécessaire pour qu'un véhicule atteigne la ligne de feu depuis le détecteur d'approche</li>
                            <li><strong>Déb (Début de vert) :</strong> Position de départ du vert dans le cycle (en secondes depuis le début du cycle)</li>
                            <li><strong>Fin (Fin de vert) :</strong> Position de fin du vert dans le cycle (en secondes depuis le début du cycle)</li>
                            <li><strong>V (Vert) :</strong> Durée du feu vert, calculée automatiquement comme la différence entre Fin et Déb</li>
                            <li><strong>Indicateur aiguillage/escamotage :</strong> Cliquez sur un nom de groupe puis utilisez <em>Alt+A</em> (aiguillage) ou <em>Alt+E</em> (escamotage) pour marquer le groupe. Un petit "a" ou "e" apparaît à côté du nom. Les conflits où ce groupe est en première position (GFx dans "GFx ↔ GFy") sont alors grisés et non comptabilisés, ce qui peut permettre de valider le plan de feux.</li>
                            <li><strong>Mode simulation :</strong> En mode simulation (onglet Simulation actif), la durée du cycle est affichée en lecture seule ("Cycle nnn secondes") et ne peut pas être modifiée.</li>
                        </ul>
                    </section>

                    <section id="help-actions" className="help-section">
                        <h4>Colonnes du tableau des actions de micro-régulation</h4>
                        <ul>
                            <li><strong>GF :</strong> Groupe fonctionnel concerné par l'action</li>
                            <li><strong>Action :</strong> Type d'action (liste déroulante)</li>
                            <li><strong>Description :</strong> Description libre (30 caractères max)</li>
                            <li><strong>Déb/Fin :</strong> Temps de début et fin de l'action dans le cycle</li>
                            <li><strong>Abrv :</strong> Abréviation affichée sur le diagramme</li>
                            <li><strong>Action_Micro :</strong> Action de micro-régulation appliquée au diagramme (40 caractères)</li>
                            <li><strong>Plage 1/2 :</strong> Groupes délimitant la zone verticale (Adaptatif)</li>
                            <li><strong>Action GF 1-4 :</strong> Groupes liés à l'action (Fermeture anticipée, Escamotage)</li>
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
                            <li><strong>Fermeture anticipée :</strong> Anticipation du passage au rouge (accolade orange sous la barre). En ajoutant un ou plusieurs groupes de feux dans Action GF, on réalise de fait des glissements.</li>
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
                            <li><strong>Intégrer un bi-Carrefour :</strong> Permet de séparer visuellement le carrefour en deux zones en désignant un groupe de feu de séparation. Une ligne blanche horizontale et verticale apparaît dans la matrice des temps interverts (onglet Configuration et onglet Matrice), ainsi qu'une ligne blanche de séparation dans le diagramme du plan de feu. Le menu bascule ensuite en « Rétablir en uni-carrefour » pour supprimer la séparation. Cette option est sauvegardée avec le projet.</li>
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
                            <li><strong>Déplacement au clavier :</strong> Sélectionnez une flèche en cliquant dessus, puis utilisez les touches fléchées du clavier (gauche, droite, haut, bas) pour la déplacer point par point. Le focus doit être sur l'image du carrefour (ne fonctionne pas quand l'image est détachée).</li>
                            <li><strong>Glisser-déposer :</strong> Cliquez et maintenez sur une flèche pour la déplacer. La flèche suit le mouvement de la souris sans se recentrer sur le point de clic.</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Raccourcis clavier</h4>
                        <ul>
                            <li><strong>Ctrl+Z :</strong> Annuler la dernière action</li>
                            <li><strong>Ctrl+Y :</strong> Refaire la dernière action annulée</li>
                            <li><strong>F1 :</strong> Aide en ligne contextuelle (pointe sur la section correspondant à la zone survolée)</li>
                            <li><strong>Flèches directionnelles :</strong> Déplacent point par point la flèche sélectionnée sur l'image du carrefour (focus requis sur l'image)</li>
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

                    <section id="help-trafic" className="help-section">
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
                        <p><strong>Jeux de données personnalisés :</strong> Survolez le sélecteur "Associé à" et appuyez sur la touche <em>+</em> pour créer un nouveau jeu de données personnalisé (17 caractères max). Le nom est prérempli à partir du jeu actif. Les jeux personnalisés sont sauvegardés dans le projet et dans le stockage local.</p>
                        <p><strong>Association PF / jeu de données :</strong> Chaque onglet PF mémorise le jeu de données trafic sélectionné. Lorsque vous changez d'onglet PF, le jeu de données associé est automatiquement restauré. Cette association est sauvegardée dans le projet.</p>
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
                            <li><strong>Sauvegarde automatique :</strong> Les données sont sauvegardées automatiquement dans le navigateur (local storage)</li>
                            <li><strong>Nouveau projet :</strong> Menu Fichier → Nouveau projet réinitialise l'application (actif uniquement si le projet a été modifié)</li>
                            <li><strong>Ouvrir un projet :</strong> Menu Fichier → Ouvrir un projet permet de charger un fichier JSON depuis le disque. Les répertoires récents sont proposés en sous-menu.</li>
                            <li><strong>Ouvrir depuis le local storage :</strong> Menu Fichier → Ouvrir depuis le local storage permet de charger un projet précédemment sauvegardé dans le navigateur</li>
                            <li><strong>Sauvegarder :</strong> Menu Fichier → Sauvegarder exporte le projet au format JSON sur le disque. Les répertoires récents sont proposés en sous-menu.</li>
                            <li><strong>Importer Excel :</strong> Menu Fichier → Importer Excel charge les données depuis un fichier Excel (.xlsx). Les répertoires récents sont proposés en sous-menu.</li>
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
                        <h4>Impression du dossier</h4>
                        <p>Le menu Fichier → <strong>Imprimer le dossier...</strong> ouvre un dialog de sélection des sections à inclure dans le dossier imprimé (format A4 paysage).</p>
                        <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Sélection des sections</h5>
                        <p>Le dialog présente des cases à cocher organisées en deux niveaux :</p>
                        <ul>
                            <li><strong>Sections globales</strong> (niveau principal) :
                                <ul>
                                    <li><em>Image du carrefour :</em> Photo ou schéma du carrefour avec les flèches des groupes de feux</li>
                                    <li><em>Numéros de GF :</em> Affiche les numéros des groupes de feux sur l'image (option disponible si l'image contient des flèches)</li>
                                    <li><em>Formulaire :</em> Tableau des groupes avec leurs paramètres (type, courant, durées)</li>
                                    <li><em>Matrice de sécurité :</em> Matrice globale des temps de dégagement entre groupes de feux, tous plans de feux confondus</li>
                                    <li><em>Matrice des temps interverts :</em> Matrice de dégagement entre groupes conflictuels pour le plan de feu actif</li>
                                </ul>
                            </li>
                            <li><strong>Sections par plan de feu</strong> (une ligne par PF) :
                                <ul>
                                    <li>Chaque plan de feu dispose de sa propre case à cocher</li>
                                    <li>Les PF validés sont signalés en vert et cochés par défaut ; les autres sont décochés</li>
                                    <li>Cocher/décocher un PF active/désactive automatiquement ses sous-options</li>
                                </ul>
                            </li>
                            <li><strong>Sous-options par PF</strong> (indentées sous chaque PF) :
                                <ul>
                                    <li><em>Conditions de micro-régulation :</em> Tableau des actions de micro-régulation du PF</li>
                                    <li><em>Variables micro :</em> Variables personnalisées de micro-régulation du PF</li>
                                    <li><em>Phasage bulle :</em> Représentation graphique des phases du PF sous forme de bulles sur l'image du carrefour (disponible si l'image et les flèches existent)</li>
                                    <li><em>Données de trafic et capacité :</em> Tableau des données trafic associées au PF</li>
                                </ul>
                            </li>
                        </ul>
                        <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Organisation du document imprimé</h5>
                        <p>Le dossier est structuré comme suit :</p>
                        <ul>
                            <li><strong>Page de titre :</strong> Nom du carrefour</li>
                            <li><strong>Sections globales :</strong> Image du carrefour, formulaire, matrice de sécurité et matrice des temps interverts (si cochées)</li>
                            <li><strong>Pour chaque PF coché :</strong> Diagramme du plan de feu, suivi de ses conditions de micro-régulation, variables micro, phasage bulle et données de trafic/capacité (selon les sous-options cochées)</li>
                            <li><strong>Pied de page :</strong> Nom du fichier projet et date d'impression sur chaque page</li>
                        </ul>
                        <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Paramètres d'impression recommandés</h5>
                        <ul>
                            <li><strong>Couleur :</strong> Sélectionnez "Couleur" pour imprimer les barres du diagramme en couleur</li>
                            <li><strong>Marges :</strong> Sélectionnez "Minimum" ou "Aucune" pour maximiser l'espace</li>
                            <li><strong>Graphiques d'arrière-plan :</strong> Activez cette option pour imprimer les couleurs des barres de phase et le quadrillage</li>
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
                        <p>L'onde verte permet de coordonner les feux de signalisation le long d'un axe routier afin d'offrir aux usagers une progression fluide sans arrêt aux feux successifs.</p>
                        <p>Directement connectée aux plans de feux de vos carrefours, l'onde verte se construit et se met à jour en temps réel : modifiez un offset, changez de plan de feu ou ajustez une vitesse, et le diagramme espace-temps se redessine instantanément. Chaque carrefour ajouté récupère automatiquement ses données depuis le projet sauvegardé, garantissant une cohérence permanente entre vos diagrammes de feux et la coordination d'axe. La synchronisation bidirectionnelle, le changement de plan de feu global ou individuel, et la visualisation immédiate des bandes passantes font de cet outil un véritable assistant pour optimiser la fluidité de vos axes routiers.</p>
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
                            <li><strong>Carrefour :</strong> Nom du projet (lecture seule, issu du projet sauvegardé)</li>
                            <li><strong>PF :</strong> Sélection individuelle du plan de feu pour chaque carrefour</li>
                            <li><strong>Cycle :</strong> Durée du cycle (surligné en rouge si différent du cycle de référence, c'est-à-dire du cycle le plus fréquent)</li>
                            <li><strong>GF Montant :</strong> Groupe de feux et distance (en mètres) pour le sens montant</li>
                            <li><strong>GF Descendant :</strong> Groupe de feux et distance (en mètres) pour le sens descendant</li>
                            <li><strong>Ajouter :</strong> Le bouton "+" permet d'ajouter de nouveaux carrefours à la liste</li>
                        </ul>
                    </section>

                    <section className="help-section">
                        <h4>Barre d'outils</h4>
                        <ul>
                            <li><strong>V. mont / V. desc :</strong> Vitesses montante et descendante en km/h (de 10 à 130). Déterminent l'inclinaison des lignes directrices et le calcul de la bande passante.</li>
                            <li><strong>Zoom X :</strong> Échelle horizontale du diagramme (en px/s)</li>
                            <li><strong>Zoom Y :</strong> Échelle verticale du diagramme (en px/m)</li>
                            <li><strong>Cycles :</strong> Nombre de cycles affichés (2 ou 3)</li>
                            <li><strong>Lignes directrices :</strong> Affiche ou masque les lignes de vitesse diagonales sur le diagramme</li>
                            <li><strong>Synchroniser :</strong> Actualise les données (offset, durée de vert, cycle) depuis les projets sauvegardés pour le plan de feu sélectionné de chaque carrefour</li>
                            <li><strong>Enregistrer :</strong> Exporte l'onde verte dans un fichier JSON sur le disque</li>
                            <li><strong>Imprimer :</strong> Génère une version imprimable du diagramme en format A4 paysage avec légende, vitesses et bandes passantes</li>
                        </ul>
                    </section>
                    <section className="help-section">
                        <h4>Sauvegarde et chargement</h4>
                        <ul>
                            <li><strong>Création :</strong> Menu Onde verte → Créer une onde verte crée une nouvelle onde verte et l'ouvre dans un nouvel onglet</li>
                            <li><strong>Ouverture :</strong> Menu Onde verte → Ouvrir une onde verte charge une onde verte existante depuis le local storage</li>
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
            <Modal isOpen={moveGroupModal} onClose={() => setMoveGroupModal(false)} title="Déplacer un groupe de feu" overlayClassName="modal-menu-overlay modal-compact-overlay">
                <div className="form-row">
                    <label>
                        Groupe à déplacer :
                        <select
                            value={groupToMove}
                            onChange={(e) => { setGroupToMove(e.target.value); setMoveGroupTouched(true); }}
                            style={{ marginLeft: '10px', padding: '5px' }}
                            title="Sélectionnez le groupe à repositionner"
                        >
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name || `Groupe ${g.id}`}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="form-row">
                    <label>
                        Insérer après :
                        <select
                            value={moveAfterGroup}
                            onChange={(e) => { setMoveAfterGroup(e.target.value); setMoveGroupTouched(true); }}
                            style={{ marginLeft: '10px', padding: '5px' }}
                            title="Met à jour la matrice, le diagramme et le tableau des actions"
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
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setMoveGroupModal(false)}>
                        Annuler
                    </button>
                    <button
                        className="modal-btn modal-btn-primary"
                        disabled={!moveGroupTouched}
                        onClick={() => {
                            moveGroupToPosition(parseInt(groupToMove), parseInt(moveAfterGroup));
                            setMoveGroupTouched(false);
                        }}
                    >
                        Déplacer
                    </button>
                </div>
            </Modal>

            {/* Modal Bi-Carrefour */}
            <Modal isOpen={biCarrefourModal} onClose={() => setBiCarrefourModal(false)} title="Intégrer un bi-Carrefour" overlayClassName="modal-menu-overlay modal-compact-overlay">
                <div className="form-row">
                    <label>
                        Séparation après le groupe :
                        <select
                            value={biCarrefourGroupId}
                            onChange={(e) => { setBiCarrefourGroupId(e.target.value); setBiCarrefourTouched(true); }}
                            style={{ marginLeft: '10px', padding: '5px' }}
                            title="Une ligne de séparation sera affichée dans la matrice et le diagramme après ce groupe"
                        >
                            {groups.slice(0, -1).map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name || `Groupe ${g.id}`}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setBiCarrefourModal(false)}>
                        Annuler
                    </button>
                    <button
                        className="modal-btn modal-btn-primary"
                        disabled={!biCarrefourTouched}
                        onClick={() => {
                            setBiCarrefourSeparator(parseInt(biCarrefourGroupId));
                            setBiCarrefourModal(false);
                        }}
                    >
                        OK
                    </button>
                </div>
            </Modal>

            {/* Modal Phasage bulle supprimé - remplacé par panneau flottant dans la zone phasage bulle */}

            {/* Dialog sélection sections dossier */}
            {dossierDialog && (
                <div className="modal-overlay modal-menu-overlay" onClick={() => setDossierDialog(false)}>
                    <div className="modal-content dossier-dialog" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Imprimer le dossier</h3>
                            <button className="modal-close" onClick={() => setDossierDialog(false)}>&times;</button>
                        </div>
                        <div className="dossier-dialog-body">
                            <label>
                                <input type="checkbox" checked={dossierSections.image || false}
                                    onChange={e => setDossierSections(s => ({...s, image: e.target.checked}))} />
                                Image du carrefour
                            </label>
                            {dossierSections.image && intersectionArrows.length > 0 && (
                            <label className="dossier-checkbox-indent">
                                <input type="checkbox" checked={dossierSections.gfNumbers || false}
                                    onChange={e => setDossierSections(s => ({...s, gfNumbers: e.target.checked}))} />
                                Numéro des groupes de feu
                            </label>
                            )}
                            <label>
                                <input type="checkbox" checked={dossierSections.formulaire || false}
                                    onChange={e => setDossierSections(s => ({...s, formulaire: e.target.checked}))} />
                                Formulaire
                            </label>
                            <label>
                                <input type="checkbox" checked={dossierSections.securiteMatrix || false}
                                    onChange={e => setDossierSections(s => ({...s, securiteMatrix: e.target.checked}))} />
                                Matrice de sécurité
                            </label>
                            <label>
                                <input type="checkbox" checked={dossierSections.matrice || false}
                                    onChange={e => setDossierSections(s => ({...s, matrice: e.target.checked}))} />
                                Matrice des temps intervers
                            </label>
                            {pfTabs.map(pf => {
                                const isValidated = !!pf.color;
                                const pfChecked = dossierSections[`diagram_${pf.id}`] || false;
                                return (
                                <div key={pf.id} className="dossier-pf-group">
                                    <label className={isValidated ? 'dossier-pf-validated' : ''}>
                                        <input type="checkbox" checked={pfChecked}
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setDossierSections(s => ({
                                                    ...s,
                                                    [`diagram_${pf.id}`]: checked,
                                                    [`conditionsMicro_${pf.id}`]: checked,
                                                    [`variablesMicro_${pf.id}`]: checked,
                                                    [`phasageBulle_${pf.id}`]: checked,
                                                    [`traficCapacite_${pf.id}`]: checked,
                                                }));
                                            }} />
                                        Diagramme {pf.name}
                                    </label>
                                    {pfChecked && (
                                    <div className="dossier-pf-suboptions">
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`conditionsMicro_${pf.id}`] || false}
                                                onChange={e => setDossierSections(s => ({...s, [`conditionsMicro_${pf.id}`]: e.target.checked}))} />
                                            Conditions de micro-régulation
                                        </label>
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`variablesMicro_${pf.id}`] || false}
                                                onChange={e => setDossierSections(s => ({...s, [`variablesMicro_${pf.id}`]: e.target.checked}))} />
                                            Variables micro
                                        </label>
                                        {intersectionArrows.length > 0 && intersectionImage && (
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`phasageBulle_${pf.id}`] || false}
                                                onChange={e => setDossierSections(s => ({...s, [`phasageBulle_${pf.id}`]: e.target.checked}))} />
                                            Phasage bulle
                                        </label>
                                        )}
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`traficCapacite_${pf.id}`] || false}
                                                onChange={e => setDossierSections(s => ({...s, [`traficCapacite_${pf.id}`]: e.target.checked}))} />
                                            Données de trafic et calcul de capacité
                                        </label>
                                    </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setDossierDialog(false)}>Annuler</button>
                            <button className="btn-confirm" onClick={handleDossierConfirm}>Confirmer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Preview Modal */}
            {printPreviewModal && (
                <div className="modal-overlay print-preview-overlay" onClick={() => setPrintPreviewModal(false)}>
                    <div className="modal-content print-preview-modal-large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {printType === 'matrix' && 'Aperçu - Matrice de dégagement'}
                                {printType === 'form' && 'Aperçu - Formulaire'}
                                {printType === 'diagram' && 'Aperçu - Diagramme'}
                                {printType === 'dossier' && 'Aperçu - Dossier complet'}
                            </h3>
                            <button className="modal-close" onClick={() => setPrintPreviewModal(false)}>×</button>
                        </div>
                        <div className="print-preview-container">
                            <div className="print-preview-page">
                                {/* Header commun (sauf pour diagramme qui a son propre en-tête) */}
                                {printType !== 'diagram' && printType !== 'dossier' && (
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

                                {printType === 'dossier' && (() => {
                                    // A4 paysage marges 10mm: largeur utile réelle mesurée ~1200px
                                    // (277mm théorique = 1047px à 96dpi, mais le rendu navigateur est plus large)
                                    // Sidebar TimelineDiagram réelle = 325px (sans commentaires/remarques masqués)
                                    const dossierPrintWidth = 1200;
                                    const dossierSidebarReal = 325;
                                    const availableWidth = dossierPrintWidth - dossierSidebarReal; // 875px
                                    const refCycle = 120; // Cycle de référence pour l'échelle homogène
                                    // Cycle ≤ 120s: échelle fixe (homogénéité entre dossiers)
                                    // Cycle > 120s: ratio pour remplir la largeur de la page
                                    const basePPS = cycleLength <= refCycle
                                        ? availableWidth / refCycle
                                        : availableWidth / cycleLength;

                                    // Fonctions de calcul trafic (dupliquées de TrafficTable)
                                    const getTotalGreenTime = (groupId, mainGreenTime) => {
                                        if (!mainGreenTime) return 0;
                                        const lucarneActions = actionData.filter(
                                            action => action.action === 'Seconde lucarne' &&
                                                     parseInt(action.gf) === groupId &&
                                                     action.deb !== '' && action.deb !== null &&
                                                     action.fin !== '' && action.fin !== null
                                        );
                                        let lucarneDuration = 0;
                                        lucarneActions.forEach(lucarne => {
                                            const deb = parseFloat(lucarne.deb);
                                            const fin = parseFloat(lucarne.fin);
                                            if (!isNaN(deb) && !isNaN(fin)) {
                                                let duration = fin - deb;
                                                if (duration < 0) duration += cycleLength;
                                                lucarneDuration += duration;
                                            }
                                        });
                                        return mainGreenTime + lucarneDuration;
                                    };
                                    const calcVUtile = (trafficVol, laneCoef) => {
                                        if (!trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
                                        return Math.round(trafficVol / (1800 * laneCoef / cycleLength));
                                    };
                                    const calcCapacity = (greenTime, vUtile) => {
                                        if (!greenTime || !vUtile || greenTime === 0) return null;
                                        return Math.round((vUtile / greenTime) * 100);
                                    };
                                    const calcDelay = (greenTime, trafficVol, laneCoef, groupId, groupOffset) => {
                                        const bandeAction = actionData.find(
                                            action => action.action === 'Début de bande passante' &&
                                                     parseInt(action.actGf1) === groupId &&
                                                     action.fin !== '' && action.fin !== null && action.fin !== undefined
                                        );
                                        if (bandeAction) {
                                            const finValue = parseFloat(bandeAction.fin);
                                            if (!isNaN(finValue) && groupOffset !== undefined && groupOffset !== null) {
                                                return Math.max(0, Math.round(groupOffset - finValue));
                                            }
                                        }
                                        if (!greenTime || !trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
                                        const ratio = trafficVol / (1800 * laneCoef);
                                        if (ratio >= 1) return null;
                                        const denominator = 2 * cycleLength * (1 - ratio);
                                        if (denominator === 0) return null;
                                        const redTime = cycleLength - greenTime;
                                        return Math.round((redTime * redTime) / denominator);
                                    };
                                    const calcQueue = (greenTime, trafficVol, laneCoef, groupId, groupOffset) => {
                                        const bandeAction = actionData.find(
                                            action => action.action === 'Début de bande passante' &&
                                                     parseInt(action.actGf1) === groupId &&
                                                     action.fin !== '' && action.fin !== null && action.fin !== undefined
                                        );
                                        if (bandeAction) {
                                            const finValue = parseFloat(bandeAction.fin);
                                            if (!isNaN(finValue) && groupOffset !== undefined && groupOffset !== null) {
                                                return Math.max(0, Math.round(groupOffset - finValue));
                                            }
                                        }
                                        if (!greenTime || !trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
                                        const redTime = cycleLength - greenTime;
                                        const innerValue = trafficVol * redTime / 3600 / laneCoef;
                                        return (Math.floor(innerValue) + 1) * 6;
                                    };
                                    const parseTrafficVol = (val) => {
                                        if (!val) return 0;
                                        return parseInt(String(val).replace(/c$/i, '')) || 0;
                                    };

                                    const dossierSmallLogos = (projectProperties.logoMoa || projectProperties.logoMoe) ? (
                                        <span className="dossier-header-logos">
                                            {projectProperties.logoMoa && <img src={projectProperties.logoMoa} alt="" />}
                                            {projectProperties.logoMoe && <img src={projectProperties.logoMoe} alt="" />}
                                        </span>
                                    ) : null;

                                    return (
                                    <div className="print-preview-dossier">
                                        {/* 1. Titre du projet avec logos et informations */}
                                        <div className="print-dossier-section print-dossier-title">
                                            <div className="dossier-title-logos">
                                                <div className="dossier-title-logo-left">
                                                    {projectProperties.logoMoa && <img src={projectProperties.logoMoa} alt="" className="dossier-logo-large" />}
                                                </div>
                                                <div className="dossier-title-center">
                                                    <h2>Carrefour {intersectionName || 'Sans titre'}</h2>
                                                    <p className="dossier-title-commune">
                                                        {projectProperties.commune ? `Commune de ${projectProperties.commune}` : (projectName || '')}
                                                    </p>
                                                </div>
                                                <div className="dossier-title-logo-right">
                                                    {projectProperties.logoMoe && <img src={projectProperties.logoMoe} alt="" className="dossier-logo-large" />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Plan du carrefour + Propriétés du projet */}
                                        {dossierSections.image && (
                                        <div className="print-dossier-section print-dossier-image-props">
                                            <div className="dossier-image-props-headers">
                                                <h3 className="dossier-image-props-h3-left">Plan du carrefour</h3>
                                                <h3 className="dossier-image-props-h3-right">Propriétés du projet</h3>
                                            </div>
                                            <div className="dossier-image-props-row">
                                            <div className="dossier-image-col">
                                            {intersectionImage ? (
                                                <div className="dossier-image-container">
                                                    <img
                                                        src={intersectionImage}
                                                        alt="Carrefour"
                                                        className="dossier-carrefour-img"
                                                        style={{ filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%)` }}
                                                    />
                                                    {dossierSections.gfNumbers && (() => {
                                                        // Grouper les flèches par groupId (exclure celles hors image)
                                                        // Estimer la taille rendue de l'image pour le décalage TàD/TàG
                                                        const imgR = imageNaturalDims.width / imageNaturalDims.height;
                                                        const estH = Math.min(480, imageNaturalDims.height);
                                                        const estW = Math.min(estH * imgR, 1000);
                                                        const groupMap = {};
                                                        intersectionArrows.forEach(arrow => {
                                                            if (!arrow.groupId) return;
                                                            if (arrow.x < 0 || arrow.x > 100 || arrow.y < 0 || arrow.y > 100) return;
                                                            const courant = groups.find(g => String(g.id) === String(arrow.groupId))?.courant || '';
                                                            let px = arrow.x;
                                                            let py = arrow.y;
                                                            // Pour TàD/TàG, décaler vers le corps (ignorer le retour)
                                                            if (courant === 'TàD' || courant === 'TàG') {
                                                                const sc = arrow.scale || 1;
                                                                const svgSz = 96 * sc;
                                                                const dxSvg = courant === 'TàD' ? -8 : 8;
                                                                const dySvg = 2;
                                                                const dxPx = (dxSvg / 32) * svgSz;
                                                                const dyPx = (dySvg / 32) * svgSz;
                                                                const rotRad = (arrow.rotation || 0) * Math.PI / 180;
                                                                px += (dxPx * Math.cos(rotRad) - dyPx * Math.sin(rotRad)) / estW * 100;
                                                                py += (dxPx * Math.sin(rotRad) + dyPx * Math.cos(rotRad)) / estH * 100;
                                                            }
                                                            if (!groupMap[arrow.groupId]) groupMap[arrow.groupId] = [];
                                                            groupMap[arrow.groupId].push({ x: px, y: py });
                                                        });
                                                        return Object.entries(groupMap).map(([gId, pts]) => {
                                                            const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
                                                            const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
                                                            const grp = groups.find(g => String(g.id) === gId);
                                                            const isPieton = grp?.courant === 'Piéton';
                                                            return isPieton ? (
                                                                <div
                                                                    key={`gf-${gId}`}
                                                                    className="dossier-gf-label pieton"
                                                                    style={{ left: `${cx}%`, top: `${cy}%` }}
                                                                >
                                                                    <svg viewBox="0 0 26 24" width="26" height="24">
                                                                        <polygon points="13,1 1,23 25,23" fill="rgba(255,255,255,0.85)" stroke="#000" strokeWidth="1"/>
                                                                        <text x="13" y="20" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#000">{gId}</text>
                                                                    </svg>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    key={`gf-${gId}`}
                                                                    className="dossier-gf-label"
                                                                    style={{ left: `${cx}%`, top: `${cy}%` }}
                                                                >
                                                                    {gId}
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="dossier-no-image">(Pas d'image)</p>
                                            )}
                                            </div>
                                            <div className="dossier-props-col">
                                                <table className="dossier-props-table">
                                                    <tbody>
                                                        {projectProperties.idCommune && <tr><td>Id. commune</td><td>{projectProperties.idCommune}</td></tr>}
                                                        {projectProperties.idCarrefour && <tr><td>Id. carrefour</td><td>{projectProperties.idCarrefour}</td></tr>}
                                                        {projectProperties.numeroDossier && <tr><td>N° dossier</td><td>{projectProperties.numeroDossier}</td></tr>}
                                                        {projectProperties.phaseEtude && <tr><td>Phase d'étude</td><td>{
                                                            ({ESQ:'Esquisse',AVP:'Avant-projet',PRO:'Projet',DCE:'Consultation',ACT:'Assistance',EXE:'Exécution',DOE:'Dossier ouvrage'})[projectProperties.phaseEtude] || projectProperties.phaseEtude
                                                        }</td></tr>}
                                                        {projectProperties.moa && <tr><td>Maître d'ouvrage</td><td>{projectProperties.moa}</td></tr>}
                                                        {projectProperties.moe && <tr><td>Concepteur</td><td>{projectProperties.moe}</td></tr>}
                                                        {projectProperties.bureauEtudes && <tr><td>Entreprise</td><td>{projectProperties.bureauEtudes}</td></tr>}
                                                        {projectProperties.auteur && <tr><td>Auteur</td><td>{projectProperties.auteur}</td></tr>}
                                                        {projectProperties.dateCreation && <tr><td>Date de création</td><td>{new Date(projectProperties.dateCreation).toLocaleDateString('fr-FR')}</td></tr>}
                                                        {projectProperties.dateModification && <tr><td>Dernière modif.</td><td>{new Date(projectProperties.dateModification).toLocaleString('fr-FR')}</td></tr>}
                                                        {projectProperties.commentaires && <tr><td>Commentaires</td><td className="dossier-props-comment">{projectProperties.commentaires}</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                            </div>
                                        </div>
                                        )}

                                        {/* 3. Formulaire */}
                                        {dossierSections.formulaire && (
                                        <div className="print-dossier-section print-dossier-form">
                                            <h3>Formulaire</h3>
                                            <table className="preview-form-table">
                                                <thead>
                                                    <tr>
                                                        <th>GF</th>
                                                        <th>Nom</th>
                                                        <th>Type</th>
                                                        <th>Courant</th>
                                                        <th>Mini</th>
                                                        <th>Jaune</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groups.map(g => (
                                                        <tr key={g.id}>
                                                            <td>{g.id}</td>
                                                            <td>{g.name || ''}</td>
                                                            <td>{g.type || 'VL'}</td>
                                                            <td>{g.courant || ''}</td>
                                                            <td>{g.minGreen || 0}</td>
                                                            <td>{g.durations?.orange || 0}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        )}

                                        {/* 4a. Matrice de sécurité */}
                                        {dossierSections.securiteMatrix && (
                                        <div className="print-dossier-section print-dossier-matrix">
                                            <h3>Matrice de sécurité{dossierSmallLogos}</h3>
                                            <table className="preview-matrix-table">
                                                <thead>
                                                    <tr>
                                                        <th></th>
                                                        <th className="col-name-header">Nom</th>
                                                        {groups.map(g => (
                                                            <th key={g.id}>{g.id}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const pf1Matrix = pfTabs?.find(pf => pf.id === 1)?.conflictMatrix || null;
                                                        const isComparing = activePFId !== 1 && pf1Matrix && pf1Matrix.length > 0;
                                                        return groups.map((fromGroup, fromIdx) => (
                                                        <tr key={fromGroup.id}>
                                                            <td className="row-header">{fromGroup.id}</td>
                                                            <td className="row-name">{fromGroup.name || ''}</td>
                                                            {groups.map((toGroup, toIdx) => {
                                                                const rawVal = fromIdx !== toIdx ? (conflictMatrix[fromIdx]?.[toIdx] || '') : '';
                                                                let val = '';
                                                                if (rawVal !== '' && rawVal != null) {
                                                                    const numVal = parseInt(rawVal);
                                                                    if (!isNaN(numVal)) {
                                                                        const fromType = fromGroup.type;
                                                                        const isVehicle = (fromType === 'V' || fromType === 'VL' || fromType === 'B' || fromType === 'TC');
                                                                        val = isVehicle ? Math.max(0, numVal - (fromGroup.durations?.orange || 0)) : numVal;
                                                                    }
                                                                }
                                                                let color = null;
                                                                if (isComparing && fromIdx !== toIdx && val !== '') {
                                                                    const pf1RawVal = pf1Matrix[fromIdx]?.[toIdx];
                                                                    if (pf1RawVal !== '' && pf1RawVal != null) {
                                                                        const pf1Num = parseInt(pf1RawVal);
                                                                        if (!isNaN(pf1Num)) {
                                                                            const fromType = fromGroup.type;
                                                                            const isVehicle = (fromType === 'V' || fromType === 'VL' || fromType === 'B' || fromType === 'TC');
                                                                            const ref = isVehicle ? Math.max(0, pf1Num - (fromGroup.durations?.orange || 0)) : pf1Num;
                                                                            if (val > ref) color = '#f44336';
                                                                            else if (val < ref) color = '#4caf50';
                                                                        }
                                                                    }
                                                                }
                                                                return (
                                                                <td
                                                                    key={toGroup.id}
                                                                    className={fromIdx === toIdx ? 'diagonal' : ''}
                                                                    style={color ? { color, fontWeight: 'bold' } : undefined}
                                                                >
                                                                    {val}
                                                                </td>
                                                                );
                                                            })}
                                                        </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        )}

                                        {/* 4b. Matrice des temps interverts */}
                                        {dossierSections.matrice && (
                                        <div className="print-dossier-section print-dossier-matrix">
                                            <h3>Matrice des temps interverts{dossierSmallLogos}</h3>
                                            <table className="preview-matrix-table">
                                                <thead>
                                                    <tr>
                                                        <th></th>
                                                        <th className="col-name-header">Nom</th>
                                                        {groups.map(g => (
                                                            <th key={g.id}>{g.id}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const pf1Matrix = pfTabs?.find(pf => pf.id === 1)?.conflictMatrix || null;
                                                        const isComparing = activePFId !== 1 && pf1Matrix && pf1Matrix.length > 0;
                                                        return groups.map((fromGroup, fromIdx) => (
                                                        <tr key={fromGroup.id}>
                                                            <td className="row-header">{fromGroup.id}</td>
                                                            <td className="row-name">{fromGroup.name || ''}</td>
                                                            {groups.map((toGroup, toIdx) => {
                                                                const val = fromIdx !== toIdx ? (conflictMatrix[fromIdx]?.[toIdx] || '') : '';
                                                                let color = null;
                                                                if (isComparing && fromIdx !== toIdx && val !== '') {
                                                                    const pf1Val = pf1Matrix[fromIdx]?.[toIdx];
                                                                    const curr = parseInt(val) || 0;
                                                                    const ref = (pf1Val === '' || pf1Val == null) ? 0 : parseInt(pf1Val);
                                                                    if (curr > ref) color = '#f44336';
                                                                    else if (curr < ref) color = '#4caf50';
                                                                }
                                                                return (
                                                                <td
                                                                    key={toGroup.id}
                                                                    className={fromIdx === toIdx ? 'diagonal' : ''}
                                                                    style={color ? { color, fontWeight: 'bold' } : undefined}
                                                                >
                                                                    {val}
                                                                </td>
                                                                );
                                                            })}
                                                        </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        )}

                                        {/* 5-8. Pour chaque PF coché : diagramme + conditions micro + trafic/capacité + variables micro */}
                                        {pfTabs.filter(pf => dossierSections[`diagram_${pf.id}`]).map(pf => {
                                            // Durée de cycle propre au PF (ou globale si PF actif)
                                            const pfCycleLength = pf.id === activePFId ? cycleLength : (pf.cycleLength || cycleLength);
                                            // Appliquer les données diagramme du PF aux groupes
                                            const pfGroups = pf.id === activePFId
                                                ? groups
                                                : groups.map(g => {
                                                    const pfDiag = pf.diagram?.find(d => d.groupId === g.id);
                                                    return pfDiag ? {
                                                        ...g,
                                                        offset: pfDiag.offset !== undefined ? pfDiag.offset : g.offset,
                                                        durations: { ...g.durations, green: pfDiag.greenDuration !== undefined ? pfDiag.greenDuration : g.durations.green },
                                                        da: pfDiag.da !== undefined ? pfDiag.da : g.da,
                                                        phaseFlag: pfDiag.phaseFlag !== undefined ? pfDiag.phaseFlag : g.phaseFlag
                                                    } : g;
                                                });
                                            const pfActionData = pf.id === activePFId ? actionData : (pf.data || []);
                                            const pfMicroFields = pf.id === activePFId ? microCustomFields : (pf.microCustomFields || []);
                                            // PPS de base pour ce PF (basé sur son propre cycleLength)
                                            const pfBasePPS = pfCycleLength <= refCycle
                                                ? availableWidth / refCycle
                                                : availableWidth / pfCycleLength;
                                            // Calcul du scale optimisé pour remplir la page
                                            const diagramPageHeight = 648;
                                            // Sans le titre interne (display:none): RULER_HEIGHT(50) + 1px border + groups*31 + 30px grid-bottom + SVG labels/flèches en bas + marge
                                            const diagramRenderedHeight = 50 + 1 + pfGroups.length * 31 + 90;

                                            // Zoom 15% pour agrandir les lignes, limité par la hauteur de page
                                            const rowZoom = 1.15;
                                            const maxScale = diagramPageHeight / diagramRenderedHeight;
                                            const combinedScale = Math.min(rowZoom, maxScale);
                                            // Ajuster PPS pour maintenir la largeur visuelle prévue
                                            const targetWidth = pfCycleLength <= refCycle
                                                ? dossierSidebarReal + pfCycleLength * pfBasePPS // largeur prévue pour cycle court
                                                : dossierPrintWidth; // pleine largeur pour cycle long
                                            const pfPPS = (targetWidth / combinedScale - dossierSidebarReal) / pfCycleLength;
                                            return (
                                        <Fragment key={pf.id}>
                                        {/* Diagramme */}
                                        <div className="print-dossier-section print-dossier-diagram">
                                            <h3>Diagramme du plan de feu : {pf.name} — Cycle : {pfCycleLength}s{dossierSmallLogos}</h3>
                                            <div style={{
                                                height: `${Math.ceil(diagramRenderedHeight * combinedScale)}px`,
                                                overflow: 'hidden',
                                                background: '#fff'
                                            }}>
                                                <div className="print-diagram-content dossier-diagram-content" style={{
                                                    width: `${Math.ceil(dossierSidebarReal + pfCycleLength * pfPPS)}px`,
                                                    transform: combinedScale !== 1 ? `scale(${combinedScale.toFixed(3)})` : 'none',
                                                    transformOrigin: 'top left'
                                                }}>
                                                    <TimelineDiagram
                                                        groups={pfGroups}
                                                        globalTime={0}
                                                        onGroupClick={() => {}}
                                                        pixelsPerSecond={pfPPS}
                                                        conflicts={[]}
                                                        conflictMatrix={conflictMatrix}
                                                        updateGroupParams={() => {}}
                                                        cycleLength={pfCycleLength}
                                                        actionData={pfActionData}
                                                        updateActionRow={() => {}}
                                                        startDrag={() => {}}
                                                        endDrag={() => {}}
                                                        showDependencies={false}
                                                        dependencyGap={20}
                                                        hoveredActionId={null}
                                                        setHoveredActionId={() => {}}
                                                        planName={pf.name}
                                                        isPrintMode={true}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Remarques du PF (si non vides) */}
                                        {(() => {
                                            const pfRemarques = pf.remarques || '';
                                            const textOnly = pfRemarques.replace(/<[^>]*>/g, '').trim();
                                            return textOnly ? (
                                                <div className="print-dossier-remarques">
                                                    <strong>Remarques :</strong> <span dangerouslySetInnerHTML={{ __html: pfRemarques }} />
                                                </div>
                                            ) : null;
                                        })()}

                                        {/* Conditions micro pour ce PF */}
                                        {dossierSections[`conditionsMicro_${pf.id}`] && pfActionData.filter(row => row.gf || row.action || row.description || row.deb !== '' || row.fin !== '').length > 0 && (
                                            <div className="print-dossier-section print-dossier-actions">
                                                <h3>Conditions de micro-régulation - {pf.name}{dossierSmallLogos}</h3>
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
                                                            <th></th><th></th><th></th><th></th><th></th><th></th><th></th>
                                                            <th>1</th><th>2</th><th>1</th><th>2</th><th>3</th><th>4</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pfActionData
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

                                        {/* Variables micro pour ce PF */}
                                        {dossierSections[`variablesMicro_${pf.id}`] && pfMicroFields.some(f => f && f.trim()) && (
                                            <div className="print-dossier-section print-dossier-variables">
                                                <h3>Variables micro - {pf.name}{dossierSmallLogos}</h3>
                                                <div className="dossier-variables-list">
                                                    {pfMicroFields.map((field, index) => (
                                                        field && field.trim() ? (
                                                            <p key={index}>{field}</p>
                                                        ) : null
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Phasage bulle pour ce PF (si image + flèches existent) */}
                                        {dossierSections[`phasageBulle_${pf.id}`] && intersectionArrows.length > 0 && intersectionImage && (() => {
                                            const bulleCount = pf.phasageBulleCount || 4;
                                            const bulleCycleLength = pf.id === activePFId ? cycleLength : (pf.cycleLength || cycleLength);
                                            const userBubbleScale = pf.phasageBubbleScale ?? 100;
                                            const bsf = (bulleCount === 2 ? 1.2 : bulleCount === 5 ? 0.9 : bulleCount === 6 ? 0.8 : 1.0) * (userBubbleScale / 100);
                                            const bulleW = 570 * bsf;
                                            const bulleH = 456 * bsf;
                                            // Image ratio: hide ellipse if very elongated
                                            const imgRatio = imageNaturalDims.width / imageNaturalDims.height;
                                            const hideOvals = imgRatio > 1.5 || imgRatio < (1 / 1.5);
                                            // Visible image bounds within bubble (object-fit: contain)
                                            const bubbleAspect = bulleW / bulleH;
                                            let arrowXMin = 0, arrowXMax = 100, arrowYMin = 0, arrowYMax = 100;
                                            if (imgRatio > bubbleAspect) {
                                                const visH = (bubbleAspect / imgRatio) * 100;
                                                arrowYMin = (100 - visH) / 2;
                                                arrowYMax = 100 - arrowYMin;
                                            } else {
                                                const visW = (imgRatio / bubbleAspect) * 100;
                                                arrowXMin = (100 - visW) / 2;
                                                arrowXMax = 100 - arrowXMin;
                                            }
                                            return (
                                            <div className="print-dossier-section print-dossier-phasage dossier-phasage-centered">
                                                <h3>Phasage bulle - {pf.name}{dossierSmallLogos}</h3>
                                                <div className={`dossier-phasage-content ${hideOvals ? 'phasage-hide-ovals' : ''}`}>
                                                    <PhasageBulle
                                                        groups={pfGroups}
                                                        cycleLength={bulleCycleLength}
                                                        intersectionImage={intersectionImage}
                                                        intersectionArrows={intersectionArrows.filter(a => a.x >= arrowXMin && a.x <= arrowXMax && a.y >= arrowYMin && a.y <= arrowYMax)}
                                                        actionData={pfActionData}
                                                        selectedActions={[]}
                                                        intersectionName={intersectionName}
                                                        planName={pf.name}
                                                        initialTimes={pf.phasageBulleTimes || [0, 15, 30, 45, 60, 75]}
                                                        initialCount={bulleCount}
                                                        imageBrightness={imageBrightness}
                                                        imageContrast={imageContrast}
                                                        initialBubbleScale={userBubbleScale}
                                                        initialEllipseScale={pf.phasageEllipseScale ?? 100}
                                                        initialBubbleRatio={pf.phasageBubbleRatio ?? 100}
                                                    />
                                                </div>
                                            </div>
                                            );
                                        })()}

                                        {/* Données de trafic et calcul de capacité pour ce PF */}
                                        {dossierSections[`traficCapacite_${pf.id}`] && (
                                            <div className="print-dossier-section print-dossier-traffic">
                                                <h3>Données de trafic et calcul de capacité - {pf.name}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Données de trafic : {pfTrafficDatasetMap[pf.id] || (trafficDatasetNames.includes(pf.name) ? pf.name : activeTrafficDataset)}{dossierSmallLogos}</h3>
                                                <table className="dossier-traffic-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Grp</th>
                                                            <th>Nom</th>
                                                            <th>Coef</th>
                                                            <th>Trafic</th>
                                                            <th>V.Utile (s)</th>
                                                            <th>Cap.U</th>
                                                            <th>Retard (s)</th>
                                                            <th>File d'attente (m)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pfGroups.filter(g => {
                                                            // Comme dans TrafficTable : si "tous les groupes" n'est pas coché,
                                                            // n'afficher que les groupes VL/V ou ceux qui ont des données trafic
                                                            if (g.type === 'VL' || g.type === 'V') return true;
                                                            const td = getTrafficData(g.id);
                                                            return !!td.trafficVol;
                                                        }).map(g => {
                                                            const td = getTrafficData(g.id);
                                                            const trafficVol = parseTrafficVol(td.trafficVol);
                                                            const coef = g.laneCoef || 1;
                                                            const greenTime = getTotalGreenTime(g.id, g.durations?.green || 0);
                                                            const vUtile = calcVUtile(trafficVol, coef);
                                                            const capU = calcCapacity(greenTime, vUtile);
                                                            const delay = calcDelay(greenTime, trafficVol, coef, g.id, g.offset);
                                                            const queue = calcQueue(greenTime, trafficVol, coef, g.id, g.offset);
                                                            const capColor = capU === null ? undefined
                                                                : capU < 76 ? '#4caf50'
                                                                : capU <= 85 ? '#ff9800'
                                                                : capU <= 100 ? '#f44336'
                                                                : '#000';
                                                            const capBg = capU !== null && capU > 100 ? '#ff6b6b' : undefined;
                                                            return (
                                                                <tr key={g.id}>
                                                                    <td>{g.id}</td>
                                                                    <td>{g.name || ''}</td>
                                                                    <td>{coef}</td>
                                                                    <td>{td.trafficVol || ''}</td>
                                                                    <td>{vUtile !== null ? vUtile : ''}</td>
                                                                    <td style={capColor ? { color: capColor, fontWeight: 'bold', backgroundColor: capBg } : undefined}>{capU !== null ? capU + '%' : ''}</td>
                                                                    <td>{delay !== null ? delay : ''}</td>
                                                                    <td>{queue !== null ? queue : ''}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        </Fragment>
                                            );
                                        })}

                                        {/* Le pied de page est géré par @page margin boxes (injecté dynamiquement) */}
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
                                    // Injecter le footer dynamique si dossier
                                    const footerStyle = printType === 'dossier' ? injectDossierFooterStyle() : null;
                                    // Imprimer avec le modal ouvert
                                    window.print();
                                    // Retirer le footer dynamique et la classe après l'impression
                                    if (footerStyle) footerStyle.remove();
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
