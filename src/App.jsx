import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { useTrafficLight } from './hooks/useTrafficLight';
import { useAuth, PERMISSIONS } from './hooks/useAuth';
import TimelineDiagram from './components/TimelineDiagram';
import ToastContainer from './components/ToastContainer';
import { toast, getToastPrefs, setToastPref } from './utils/toast';
import GroupTable from './components/GroupTable';
import TrafficTable from './components/TrafficTable';
import IntergreenMatrix from './components/IntergreenMatrix';
import ActionTable from './components/ActionTable';
import IntersectionImage from './components/IntersectionImage';
import MenuBar from './components/MenuBar';
import Modal from './components/Modal';
import { useConfirm, useAlert } from './components/ConfirmProvider';
import { APP_VERSION, APP_NAME, APP_DESCRIPTION } from './version';
import { buildExportFilename } from './utils/exportFilename';
import { buildDiagnosticReport, downloadDiagnosticReport, buildErrorJournal, buildDiagnosticJSON, downloadDiagnosticJSON } from './utils/diagnostics';
import { getInterceptedEntries, clearInterceptedEntries } from './utils/errorInterceptor';
import CreateGreenWaveDialog from './components/CreateGreenWaveDialog';
import GreenWaveViewer from './components/GreenWaveViewer';
import SimulationPanel from './components/SimulationPanel';
import PhasageBulle from './components/PhasageBulle';
import { safeShowOpenFilePicker } from './utils/filePicker';
import LoginModal from './components/LoginModal';
import UserManagerModal from './components/UserManagerModal';
import ExternalLinksModal from './components/ExternalLinksModal';
import PropertiesPanel from './components/PropertiesPanel';
import { calculateSimulatedDiagram } from './utils/simulationCalculator';
import { import[redacted]File } from './utils/[redacted]Importer';
import usePopupWindow from './hooks/usePopupWindow';
import useFloatingLegend from './hooks/useFloatingLegend';
import useFloatingMatrix from './hooks/useFloatingMatrix';
import useDarkMode from './hooks/useDarkMode';
import useRecentDirectories from './hooks/useRecentDirectories';
import useUILayout from './hooks/useUILayout';
import useProjectModification from './hooks/useProjectModification';
import usePhasageBulleUI from './hooks/usePhasageBulleUI';
import useRecentFiles from './hooks/useRecentFiles';
import useSimulationUI from './hooks/useSimulationUI';
import useDialogState from './hooks/useDialogState';
import useFloatingImage from './hooks/useFloatingImage';
import useDirectoryHandles from './hooks/useDirectoryHandles';
import useFloatingImageRenderer from './hooks/useFloatingImageRenderer';
import useFloatingForm from './hooks/useFloatingForm';
import useFloatingTraffic from './hooks/useFloatingTraffic';
import useFloatingRemarks from './hooks/useFloatingRemarks';
import RemarquesEditor from './components/RemarquesEditor';
import HelpContent from './components/HelpContent';
import useFileOperations from './hooks/useFileOperations';
import useImportOperations from './hooks/useImportOperations';
import renderFloatingArrowSVG from './utils/renderArrowSVG';

import './components/GroupTable.css';
import './components/IntergreenMatrix.css';
import './App.css';

function App() {
    const askConfirm = useConfirm();
    const showAlert = useAlert();
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
        matricesLocked,
        setMatricesLocked,
        externalLinks,
        setExternalLinks,
        projectProperties,
        updateProjectProperty,
        projectName,
        setProjectName,
        appCommunes,
        appMoaLogos,
        appMoeLogos
    } = useTrafficLight({ askConfirm, showAlert });

    // Update yellow/orange duration for VL and B groups when horsAgglomeration changes
    useEffect(() => {
        const orangeValue = projectProperties.horsAgglomeration ? 5 : 3;
        groups.forEach(g => {
            if ((g.type === 'V' || g.type === 'VL' || g.type === 'B' || g.type === 'TC') && g.durations.orange !== orangeValue) {
                updateGroupParams(g.id, { durations: { orange: orangeValue } });
            }
        });
    }, [projectProperties.horsAgglomeration]); // eslint-disable-line react-hooks/exhaustive-deps

    const [dragConflictsFromDiagram, setDragConflictsFromDiagram] = useState(null);

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

    // During drag, use drag conflicts from TimelineDiagram; otherwise use normal conflicts
    const displayConflicts = dragConflictsFromDiagram || filteredConflicts;
    const displayActiveConflicts = useMemo(() => {
        return (dragConflictsFromDiagram || activeConflicts).filter ?
            (dragConflictsFromDiagram || filteredConflicts).filter(c => {
                const fromGroup = groups.find(g => g.id === c.from);
                return !fromGroup?.phaseFlag;
            }) : activeConflicts;
    }, [dragConflictsFromDiagram, filteredConflicts, activeConflicts, groups]);

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
    const {
        pixelsPerSecond, setPixelsPerSecond,
        activeTab, setActiveTab,
        sidebarWidth, setSidebarWidth,
        isResizing,
        splitViewRef,
        sidebarVisible, setSidebarVisible,
        handleResizeStart,
        diagramHeight, setDiagramHeight,
        isResizingDiagram,
        diagramAreaRef,
        resetDiagramHeight,
        handleDiagramResizeStart,
        handleActionPanelResize
    } = useUILayout();
    const [showDependencies, setShowDependencies] = useState(false);
    const [hoveredActionId, setHoveredActionId] = useState(null);
    const [showMicroOnHover, setShowMicroOnHover] = useState(true);
    const [toastPrefs, setToastPrefsState] = useState(getToastPrefs());
    const [openPropertiesOnNewProject, setOpenPropertiesOnNewProject] = useState(() => {
        const saved = localStorage.getItem('openPropertiesOnNewProject');
        return saved === null ? true : saved === 'true';
    });
    const [showWrapFlash, setShowWrapFlash] = useState(() => {
        const saved = localStorage.getItem('showWrapFlash');
        return saved === null ? true : saved === 'true';
    });
    const [showSaveReminder, setShowSaveReminder] = useState(() => {
        const saved = localStorage.getItem('showSaveReminder');
        return saved === null ? true : saved === 'true';
    });
    // Au lancement, l'app est « vide » : pas de projet chargé, l'interface
    // principale est masquée et seul le menu reste accessible. Devient true
    // dès que l'utilisateur déclenche « Nouveau projet » ou ouvre un projet.
    const [hasActiveProject, setHasActiveProject] = useState(false);
    const projectNameInputRef = useRef(null);
    // Référence vers la fenêtre Onde verte ouverte (single instance).
    // Permet de ré-utiliser la même fenêtre au lieu d'en ouvrir une nouvelle
    // à chaque clic. Si la fenêtre est fermée par l'utilisateur, .closed
    // passe à true et on ouvre une nouvelle.
    const greenWaveWindowRef = useRef(null);

    // Ouvre la fenêtre Onde verte à l'URL fournie, ou y bascule le focus si
    // elle est déjà ouverte. Si l'URL diffère, navigue dedans (l'auto-save
    // ayant déjà persisté l'état courant).
    const openOrFocusGreenWave = (url) => {
        try {
            if (greenWaveWindowRef.current && !greenWaveWindowRef.current.closed) {
                // Fenêtre déjà ouverte : focus + navigation si URL différente
                try {
                    if (greenWaveWindowRef.current.location.href !== url) {
                        greenWaveWindowRef.current.location.href = url;
                    }
                } catch {
                    // Cross-origin (improbable, même origine) : on tente la nav directe
                    greenWaveWindowRef.current.location = url;
                }
                greenWaveWindowRef.current.focus();
                return;
            }
        } catch {
            // ref invalide, on rouvre
        }
        const w = window.open(url, 'tracflux-onde-verte');
        if (w) greenWaveWindowRef.current = w;
    };
    // Anchor à atteindre dans la modale d'aide (alimenté par l'URL ?openHelp=…).
    // Passé à <HelpContent /> via la prop initialAnchor.
    const [helpAnchor, setHelpAnchor] = useState(null);
    const [aboutModal, setAboutModal] = useState(false);
    const [diagnosticModal, setDiagnosticModal] = useState(false);
    const [diagnosticIncludeProject, setDiagnosticIncludeProject] = useState(false);
    const [diagnosticRefresh, setDiagnosticRefresh] = useState(0);
    const printPreviewPageRef = useRef(null);

    // Intersection image animation state
    const {
        isPlayingSimulation, setIsPlayingSimulation,
        simulationCurrentTime, setSimulationCurrentTime,
        hoveredDiagramTime, setHoveredDiagramTime
    } = useSimulationUI();
    const [hoveredArrowGroupId, setHoveredArrowGroupId] = useState(null);
    const [hoveredArrowGroupSaturated, setHoveredArrowGroupSaturated] = useState(false);
    const [hoveredConflict, setHoveredConflict] = useState(null); // {from, to} for conflict hover
    const [isSaving, setIsSaving] = useState(false);

    // Track whether project has been modified (for "Nouveau projet" menu)
    const { projectModified, setProjectModified, resetModified: resetProjectModified, projectModifiedSkip, hasUnsavedChanges, isDirty, setHasUnsavedChanges } =
        useProjectModification([groups, actionData, cycleLength, conflictMatrix, projectProperties, intersectionName]);

    // Update document title (browser tab) to reflect project name and unsaved status.
    // Sur l'écran d'accueil (aucun projet ouvert), on affiche juste
    // « Diagramme de Feux » sans le nom de carrefour par défaut. C'est
    // hasActiveProject qui fait foi : intersectionName reste à
    // « Nouveau Carrefour » par défaut, ce qui ne reflète pas l'absence
    // de projet ouvert.
    useEffect(() => {
        if (!hasActiveProject) {
            document.title = 'Diagramme de Feux';
            return;
        }
        const prefix = isDirty ? '* ' : '';
        const name = projectName || intersectionName;
        document.title = `${prefix}${name} — Diagramme de Feux`;
    }, [hasActiveProject, projectName, intersectionName, isDirty]);

    // Deep link vers une section de l'aide F1 : si l'URL contient
    // ?openHelp=ondeVerte (ouvert depuis la fenêtre Onde verte), on ouvre
    // automatiquement la modale d'aide et on délègue le scroll vers le
    // chapitre Onde verte à <HelpContent /> via la prop initialAnchor.
    // L'anchor ciblé est <h3 id="help-onde-verte">.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const target = params.get('openHelp');
        if (!target) return;
        const anchorId = target === 'ondeVerte' ? 'help-onde-verte' : null;
        setHelpAnchor(anchorId);
        setHelpModal(true);
    }, []);

    // Save reminder: when isDirty becomes true, start a 10-minute inactivity timer.
    // Any new modification resets the timer. On timeout, show a discreet toast.
    useEffect(() => {
        if (!showSaveReminder || !isDirty) return;
        const timer = setTimeout(() => {
            toast.info('Pensez à sauvegarder vos modifications');
        }, 10 * 60 * 1000); // 10 minutes
        return () => clearTimeout(timer);
    }, [isDirty, projectName, intersectionName, groups, actionData, cycleLength, conflictMatrix, projectProperties, showSaveReminder]);

    // Floating matrix state
    const {
        showFloatingMatrix,
        setShowFloatingMatrix,
        matrixPopup
    } = useFloatingMatrix(groups.length);

    // Floating form state
    const {
        showFloatingForm,
        setShowFloatingForm,
        formPopup
    } = useFloatingForm(groups.length);

    // Floating traffic state
    const {
        showFloatingTraffic,
        setShowFloatingTraffic,
        trafficPopup
    } = useFloatingTraffic(groups.length);

    // Floating remarques state (notes du PF actif, projection sur 2e écran)
    const {
        showFloatingRemarks,
        setShowFloatingRemarks,
        remarquesPopup
    } = useFloatingRemarks();

    // Floating legend state
    const {
        showFloatingLegend,
        setShowFloatingLegend,
        floatingLegendPosition,
        isLegendDragging,
        handleLegendMouseDown
    } = useFloatingLegend();

    // Floating conditions & variables states (lifted from ActionTable for menu control)
    // Persistés au niveau application (localStorage) — préférence d'espace de
    // travail qui ne voyage pas avec le projet.
    const [showFloatingConditions, setShowFloatingConditions] = useState(() => {
        try { return localStorage.getItem('floating_conditions_visible') === 'true'; } catch { return false; }
    });
    const [showFloatingVariables, setShowFloatingVariables] = useState(() => {
        try { return localStorage.getItem('floating_variables_visible') === 'true'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem('floating_conditions_visible', String(showFloatingConditions)); } catch {}
    }, [showFloatingConditions]);
    useEffect(() => {
        try { localStorage.setItem('floating_variables_visible', String(showFloatingVariables)); } catch {}
    }, [showFloatingVariables]);

    // V.Utile hover state: { groupId, vUtile } when hovering V.Utile cell
    const [hoveredVUtile, setHoveredVUtile] = useState(null);

    // Phasage bulle state (phasageBulleCount and phasageBulleTimes come from useTrafficLight hook - saved per PF)
    const {
        phasageBulleEnabled, setPhasageBulleEnabled,
        phasageBulleModal, setPhasageBulleModal,
        phasageBulleVisibleGroups, setPhasageBulleVisibleGroups,
        phasageBulleVersion, setPhasageBulleVersion,
        hoveredPhasageGroupId, setHoveredPhasageGroupId,
        togglePhasageBulleGroup
    } = usePhasageBulleUI(intersectionArrows);

    // Floating image state (visibilité, recadrage, zoom, popup)
    const {
        showFloatingImage, setShowFloatingImage,
        floatingCrop, setFloatingCrop,
        showCropControls, setShowCropControls,
        floatingZoom, setFloatingZoom,
        imageNaturalDims,
        floatingImagePopup
    } = useFloatingImage(intersectionImage);

    // Diagram arrow style
    const [diagramArrowStyle, setDiagramArrowStyle] = useState('solid');





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

    // Sync local inputs when actual values change (e.g., after undo/redo or project load)
    useEffect(() => {
        setGroupCountInput(groups.length.toString());
    }, [groups.length]);

    useEffect(() => {
        setCycleLengthInput(cycleLength.toString());
    }, [cycleLength]);

    const {
        darkMode, setDarkMode,
        colorTheme, setColorTheme,
        showComments, setShowComments,
        showRemarks, setShowRemarks,
        showGroupNamesForm, setShowGroupNamesForm,
        showGroupNamesMatrix, setShowGroupNamesMatrix,
        showGroupNamesDiagram, setShowGroupNamesDiagram,
        showActionDescription, setShowActionDescription
    } = useDarkMode();
    const { recentFiles, setRecentFiles, addToRecentFiles, getRecentDirectories, getRecentDirectoriesForMenu } = useRecentFiles();
    const [selectedProject, setSelectedProject] = useState(null);
    const [importFile, setImportFile] = useState(null);
    const [importError, setImportError] = useState('');
    const [importHintDir, setImportHintDir] = useState('');

    // Green wave data states
    const [selectedGreenWave, setSelectedGreenWave] = useState(null);
    const [greenWaveData, setGreenWaveData] = useState(null);
    const [greenWaveListKey, setGreenWaveListKey] = useState(0);

    // Project path
    const [currentProjectPath, setCurrentProjectPath] = useState('');

    // Modal and dialog states
    const {
        openModal, setOpenModal,
        slideModal, setSlideModal,
        insertModal, setInsertModal,
        reduceModal, setReduceModal,
        optionsModal, setOptionsModal,
        helpModal, setHelpModal,
        helpZoneRef,
        importModal, setImportModal,
        slideValue, setSlideValue,
        slideFromGroup, setSlideFromGroup,
        slideToGroup, setSlideToGroup,
        slideTouched, setSlideTouched,
        insertStart, setInsertStart,
        insertDuration, setInsertDuration,
        insertTouched, setInsertTouched,
        reduceStart, setReduceStart,
        reduceDuration, setReduceDuration,
        reduceTouched, setReduceTouched,
        biCarrefourModal, setBiCarrefourModal,
        biCarrefourGroupId, setBiCarrefourGroupId,
        biCarrefourTouched, setBiCarrefourTouched,
        moveGroupModal, setMoveGroupModal,
        groupToMove, setGroupToMove,
        moveAfterGroup, setMoveAfterGroup,
        moveGroupTouched, setMoveGroupTouched,
        importHTMModal, setImportHTMModal,
        htmFile, setHtmFile,
        htmImportError, setHtmImportError,
        importedHTMFiles, setImportedHTMFiles,
        showExternalLinksModal, setShowExternalLinksModal,
        printPreviewModal, setPrintPreviewModal,
        printType, setPrintType,
        dossierDialog, setDossierDialog,
        dossierSections, setDossierSections,
        createGreenWaveModal, setCreateGreenWaveModal,
        openGreenWaveModal, setOpenGreenWaveModal,
        greenWaveViewer, setGreenWaveViewer,
        draggedTabIndex, setDraggedTabIndex
    } = useDialogState();

    // File System Access API - handles de répertoires via IndexedDB
    const {
        lastOpenDirectoryRef,
        lastSaveDirectoryRef,
        lastImportDirectoryRef,
        lastImageDirectoryRef,
        lastGreenWaveDirectoryRef,
        saveDirectoryHandle,
        loadDirectoryHandle
    } = useDirectoryHandles();

    // Liste des 5 derniers répertoires par type (pour affichage dans les menus)
    const {
        recentOpenDirs,
        recentImportDirs,
        recentImageDirs,
        recentSaveDirs,
        recentGreenWaveDirs,
        addRecentDirectory
    } = useRecentDirectories();

    const {
        handleOpenFileWithPicker,
        handleOpenFileFromRecentDir,
        handleSaveFileWithPicker,
        handleSaveFileToRecentDir
    } = useFileOperations({
        projectName, diagramHeight, floatingCrop, floatingZoom,
        setSelectedProject, setOpenModal, setCurrentProjectPath, setProjectModified,
        projectModifiedSkip, hasUnsavedChanges, setHasUnsavedChanges,
        isDirty,
        setDiagramHeight, setFloatingCrop, setFloatingZoom,
        setShowComments, setShowRemarks, setIntersectionName,
        // Layout options sauvegardées au niveau projet
        showComments, showRemarks, showActionDescription, sidebarVisible,
        setShowActionDescription, setSidebarVisible,
        // Flags de détachement (niveau projet : dimensions des popups
        // dépendent du nombre de groupes, donc liées au projet)
        showFloatingForm, setShowFloatingForm,
        showFloatingMatrix, setShowFloatingMatrix,
        showFloatingTraffic, setShowFloatingTraffic,
        showFloatingImage, setShowFloatingImage,
        showFloatingConditions, setShowFloatingConditions,
        showFloatingVariables, setShowFloatingVariables,
        showFloatingRemarks, setShowFloatingRemarks,
        setHasActiveProject,
        loadFullState, getFullState, saveProject,
        dossierSections, setDossierSections,
        lastOpenDirectoryRef, lastSaveDirectoryRef, lastImportDirectoryRef,
        lastImageDirectoryRef, lastGreenWaveDirectoryRef,
        saveDirectoryHandle, loadDirectoryHandle,
        recentOpenDirs, recentSaveDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs,
        addRecentDirectory,
        askConfirm, showAlert
    });

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
    const deleteGreenWave = async (name) => {
        const ok = await askConfirm({
            title: 'Supprimer l\'onde verte',
            message: `Êtes-vous sûr de vouloir supprimer l'onde verte « ${name} » ?`,
            confirmLabel: 'Supprimer',
            danger: true,
        });
        if (!ok) return;
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

    // Handler confirmation impression dossier (Imprimer)
    // Ouvre la modale d'aperçu (hors écran) puis déclenche window.print()
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

    // Handler export PDF : même flow que Imprimer, avec un message invitant à
    // choisir « Enregistrer au format PDF » comme imprimante. Garantit un rendu
    // identique à l'impression.
    const handleDossierExportPDF = () => {
        setDossierDialog(false);
        setPrintType('dossier');
        setPrintPreviewModal(true);
        toast.info('Dans la boîte d\'impression, sélectionnez « Enregistrer au format PDF »');
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

    // Capture la première occurrence du sélecteur en PNG. Le suffixe sert à
    // construire un nom de fichier explicite ; errorLabel s'affiche dans le
    // toast si l'élément n'est pas dans le DOM (typiquement parce que la vue
    // correspondante n'est pas active à l'écran).
    //
    // Le rendu force toujours :
    //   - le thème CLAIR (noir sur fond blanc), pour économiser l'encre à
    //     l'impression et homogénéiser les exports indépendamment du thème
    //     actif dans l'app
    //   - la classe png-export-clean qui retire les overflows scroll
    //     (matrice, action-table) et masque les fenêtres latérales du
    //     diagramme (commentaires, remarques) — voir TimelineDiagram.css
    // Les modifications sont appliquées sur le DOM cloné (via html2canvas
    // onclone), donc invisibles à l'écran de l'utilisateur.
    // Helper : attend qu'un élément existe dans le DOM (utile après setState
    // qui change la vue rendue). Poll toutes les 50ms jusqu'à timeout.
    const waitForElement = async (selector, timeoutMs = 1000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const el = document.querySelector(selector);
            if (el) return el;
            await new Promise(r => setTimeout(r, 50));
        }
        return null;
    };

    // opts.beforeCapture : callback synchrone qui prépare la vue (par exemple
    // setActiveTab('traffic')) et retourne une fonction de restauration appelée
    // après la capture. On attend que le sélecteur cible soit présent dans le
    // DOM avant de capturer.
    const exportSectionAsPng = async (selector, suffix, errorLabel, opts = {}) => {
        let restore = null;
        if (opts.beforeCapture) {
            restore = opts.beforeCapture();
        }

        try {
            const el = opts.beforeCapture
                ? await waitForElement(selector, 1500)
                : document.querySelector(selector);
            if (!el) {
                toast.error(`${errorLabel} introuvable — vérifiez que la vue correspondante est affichée`);
                return;
            }
            const pfName = pfTabs.find(pf => pf.id === activePFId)?.name || '';
            const filename = buildExportFilename(intersectionName, `${pfName}_${suffix}`);
            toast.info('Export PNG en cours...');
            const { exportElementAsPNG } = await import('./utils/exportHelpers');

            const onclone = (clonedDoc) => {
                const themeClasses = ['high-contrast-mode', 'amber-mode',
                                       'daltonian-mode', 'sepia-mode', 'blue-night-mode'];
                themeClasses.forEach(c => clonedDoc.body.classList.remove(c));
                clonedDoc.body.classList.add('light-mode');
                clonedDoc.body.classList.add('png-export-clean');
                // Hook personnalisé fourni par l'appelant : permet par exemple
                // de remplacer un en-tête par un titre formaté avant capture.
                if (opts.onCloneExtra) opts.onCloneExtra(clonedDoc);
            };

            const result = await exportElementAsPNG(el, filename, { onclone, backgroundColor: '#ffffff' });
            if (result?.clipboardSuccess) {
                toast.success(`📥 Téléchargé : ${filename}.png  •  📋 Copié dans le presse-papiers (Ctrl+V)`);
            } else {
                toast.success(`📥 Téléchargé : ${filename}.png  •  Presse-papiers non disponible`);
            }
        } catch (e) {
            console.error('Erreur export PNG:', e);
            toast.error('Échec de l\'export PNG : ' + e.message);
        } finally {
            if (restore) restore();
        }
    };

    // Menu action handler
    const handleMenuAction = async (action) => {
        switch (action) {
            case 'new': {
                // Confirmation uniquement s'il y a des modifications à perdre.
                // Pas de confirmation sur écran d'accueil ou projet inchangé.
                const okNew = !isDirty || await askConfirm({
                    title: 'Nouveau projet',
                    message: 'Créer un nouveau projet ? Les modifications non enregistrées seront perdues.',
                    confirmLabel: 'Créer',
                    danger: true,
                });
                if (okNew) {
                    resetToNewProject();
                    setActiveTab(openPropertiesOnNewProject ? 'properties' : 'config');
                    setDiagramHeight(null);
                    setGroupCountInput('8');
                    setCycleLengthInput('60');
                    setCurrentProjectPath('');
                    setProjectModified(false);
                    projectModifiedSkip.current = true;
                    setHasUnsavedChanges(false); // nettoie l'astérisque + enclenche le bypass d'isLoading
                    // Décoche tous les détachements (un nouveau projet repart
                    // d'un espace de travail propre — l'utilisateur détache à
                    // la demande selon ses besoins).
                    setShowFloatingForm(false);
                    setShowFloatingMatrix(false);
                    setShowFloatingTraffic(false);
                    setShowFloatingImage(false);
                    setShowFloatingConditions(false);
                    setShowFloatingVariables(false);
                    setShowFloatingRemarks(false);
                    // Active l'interface principale : on quitte l'écran d'accueil.
                    setHasActiveProject(true);
                    toast.success('Nouveau projet créé');
                    // Place focus on project name input after render
                    setTimeout(() => {
                        if (projectNameInputRef.current) {
                            projectNameInputRef.current.focus();
                            projectNameInputRef.current.select();
                        }
                    }, 100);
                }
                break;
            }
            case 'open':
                handleOpenFileWithPicker();
                break;
            case 'openLocalStorage':
                setSelectedProject(null);
                setOpenModal(true);
                break;
            case 'save':
                (async () => {
                    setIsSaving(true);
                    try { await handleSaveFileWithPicker(); }
                    finally { setIsSaving(false); }
                })();
                break;
            case 'exportPngFormulaire':
                exportSectionAsPng('.group-table-container', 'Formulaire', 'Formulaire des groupes');
                break;
            case 'exportPngDiagramme':
                exportSectionAsPng('.timeline-container', 'Diagramme', 'Diagramme');
                break;
            case 'exportPngMatrice':
                exportSectionAsPng('.matrix-container-inline', 'Matrice', 'Matrice interverts');
                break;
            case 'exportPngMicroRegulation':
                exportSectionAsPng('.action-table', 'MicroRegulation', 'Tableau des conditions de micro-régulation');
                break;
            case 'exportPngImageCarrefour':
                // Cible la zone d'image elle-même (sans le header avec titre/boutons)
                exportSectionAsPng('.intersection-image-area', 'Carrefour', 'Image du carrefour');
                break;
            case 'exportPngCapaciteUtilisee': {
                // Titre principal sur la première ligne ; mention du trafic
                // sur une seconde ligne en plus petit. Si le jeu de trafic
                // n'a pas de nom (« Associé à » vide), seule la première
                // ligne est affichée.
                const pfName = pfTabs.find(pf => pf.id === activePFId)?.name || '';
                const datasetName = (trafficDatasetNames && trafficDatasetNames[activeTrafficDataset]) || '';
                const titleLine1 = `Capacité utilisée par groupe de feu — Diagramme ${pfName}`;
                const titleLine2 = datasetName ? `avec le trafic ${datasetName}` : '';
                exportSectionAsPng('.traffic-table-container', 'Capacite', 'Tableau de capacité utilisée', {
                    onCloneExtra: (clonedDoc) => {
                        const header = clonedDoc.querySelector('.traffic-header');
                        if (header) {
                            header.innerHTML = '';
                            // .traffic-header est un flex en ligne : on force
                            // l'empilement vertical pour que le sous-titre
                            // apparaisse SOUS le titre, pas à côté.
                            header.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; padding: 8px 0;';
                            const title = clonedDoc.createElement('h3');
                            title.textContent = titleLine1;
                            title.style.cssText = 'margin: 0; font-size: 1.1em; font-weight: bold; color: #000;';
                            header.appendChild(title);
                            if (titleLine2) {
                                const subtitle = clonedDoc.createElement('div');
                                subtitle.textContent = titleLine2;
                                subtitle.style.cssText = 'margin: 4px 0 8px 0; font-size: 0.9em; color: #333;';
                                header.appendChild(subtitle);
                            }
                        }
                    }
                });
                break;
            }
            case 'exportPngPhasageBulle':
                exportSectionAsPng('.phasage-bulle-container', 'PhasageBulle', 'Phasage bulle');
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
            case 'duplicate': {
                const newId = duplicatePF();
                if (newId) toast.success(`PF dupliqué en PF${newId}`);
                break;
            }
            case 'deleteActiveDiagram':
                if (pfTabs.length > 1) {
                    const activePF = pfTabs.find(pf => pf.id === activePFId);
                    const tabName = activePF?.name || `PF${activePFId}`;
                    if (await askConfirm({
                        title: 'Supprimer le plan de feu',
                        message: `Êtes-vous sûr de vouloir supprimer l'onglet « ${tabName} » ?\n\nCette action est irréversible.`,
                        confirmLabel: 'Supprimer',
                        danger: true,
                    })) {
                        deletePF(activePFId);
                        toast.success(`${tabName} supprimé`);
                    }
                } else {
                    toast.error('Impossible de supprimer le dernier onglet.');
                }
                break;
            case 'moveGroup':
                if (groups.length > 1) {
                    setGroupToMove(groups[0]?.id?.toString() || '');
                    setMoveAfterGroup('0');
                    setMoveGroupTouched(false);
                    setMoveGroupModal(true);
                } else {
                    showAlert({ title: 'Action impossible', message: 'Il faut au moins 2 groupes pour effectuer un déplacement.' });
                }
                break;
            case 'biCarrefour':
                if (groups.length > 1) {
                    setBiCarrefourGroupId(groups[0]?.id?.toString() || '');
                    setBiCarrefourTouched(false);
                    setBiCarrefourModal(true);
                } else {
                    showAlert({ title: 'Action impossible', message: 'Il faut au moins 2 groupes pour intégrer un bi-carrefour.' });
                }
                break;
            case 'uniCarrefour':
                setBiCarrefourSeparator(null);
                break;
            case 'lockMatrices':
                setMatricesLocked(prev => !prev);
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
            case 'toggleMicroOnHover':
                setShowMicroOnHover(v => !v);
                break;
            case 'toggleToastSuccess':
            case 'toggleToastError':
            case 'toggleToastInfo': {
                const type = action === 'toggleToastSuccess' ? 'success' : action === 'toggleToastError' ? 'error' : 'info';
                const newVal = !toastPrefs[type];
                setToastPref(type, newVal);
                setToastPrefsState({ ...toastPrefs, [type]: newVal });
                break;
            }
            case 'toggleOpenPropertiesOnNewProject': {
                const newVal = !openPropertiesOnNewProject;
                setOpenPropertiesOnNewProject(newVal);
                localStorage.setItem('openPropertiesOnNewProject', String(newVal));
                break;
            }
            case 'toggleShowWrapFlash': {
                const newVal = !showWrapFlash;
                setShowWrapFlash(newVal);
                localStorage.setItem('showWrapFlash', String(newVal));
                break;
            }
            case 'toggleSaveReminder': {
                const newVal = !showSaveReminder;
                setShowSaveReminder(newVal);
                localStorage.setItem('showSaveReminder', String(newVal));
                break;
            }
            case 'help':
                setHelpModal(true);
                break;
            case 'import':
                handleImportExcelDirect();
                break;
            case 'import[redacted]':
                handleImport[redacted]();
                break;
            case 'openBlackBox':
                handleOpenBlackBox();
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
                setAboutModal(true);
                break;
            case 'diagnosticReport':
                setDiagnosticIncludeProject(false);
                setDiagnosticModal(true);
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
            case 'themeDark':
                setColorTheme('dark');
                break;
            case 'themeLight':
                setColorTheme('light');
                break;
            case 'themeHighContrast':
                setColorTheme('high-contrast');
                break;
            case 'themeAmber':
                setColorTheme('amber');
                break;
            case 'themeDaltonian':
                setColorTheme('daltonian');
                break;
            case 'themeSepia':
                setColorTheme('sepia');
                break;
            case 'themeBlueNight':
                setColorTheme('blue-night');
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
            case 'toggleActionDescription':
                setShowActionDescription(v => !v);
                break;
            case 'toggleFloatingImage':
                setShowFloatingImage(v => !v);
                break;
            case 'toggleFloatingMatrix':
                setShowFloatingMatrix(v => !v);
                break;
            case 'toggleFloatingForm':
                setShowFloatingForm(v => !v);
                break;
            case 'toggleFloatingConditions':
                setShowFloatingConditions(v => !v);
                break;
            case 'toggleFloatingVariables':
                setShowFloatingVariables(v => !v);
                break;
            case 'toggleFloatingTraffic':
                setShowFloatingTraffic(v => !v);
                break;
            case 'toggleFloatingRemarks':
                setShowFloatingRemarks(v => !v);
                break;
            case 'externalLinks':
                setShowExternalLinksModal(true);
                break;
            // Green wave actions
            // Lance le module Onde verte dans un nouvel onglet, sans projet
            // chargé. La création / ouverture se fait depuis le menu Fichier
            // de la fenêtre Onde verte qui prend le relais.
            case 'launchGreenWave':
                openOrFocusGreenWave(`${window.location.origin}${window.location.pathname}?greenwave`);
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
                        (async () => {
                            setIsSaving(true);
                            try { await handleSaveFileToRecentDir(dirIndex); }
                            finally { setIsSaving(false); }
                        })();
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

        openOrFocusGreenWave(`${window.location.origin}${window.location.pathname}?greenwave&id=${greenWaveId}${useIDB ? '&idb=1' : ''}`);
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

                    openOrFocusGreenWave(`${window.location.origin}${window.location.pathname}?greenwave&id=${greenWaveId}${useIDB ? '&idb=1' : ''}`);
                    setOpenGreenWaveModal(false);
                    setSelectedGreenWave(null);
                }
            }
        } catch (e) {
            console.error('Failed to open green wave', e);
            showAlert({ title: 'Erreur', message: "Erreur lors de l'ouverture de l'onde verte." });
        }
    };

    // Handle opening green wave from file system
    const handleOpenGreenWaveFromFile = async () => {
        if (!window.showOpenFilePicker) {
            showAlert({ title: 'Navigateur non compatible', message: 'Votre navigateur ne supporte pas l\'ouverture de fichiers. Utilisez « Ouvrir une onde verte... » pour charger depuis le cache navigateur.' });
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

            const [fileHandle] = await safeShowOpenFilePicker(options);
            const file = await fileHandle.getFile();
            const content = await file.text();

            // Validation du contenu avant parsing
            if (!content || content.trim() === '') {
                showAlert({ title: 'Fichier vide', message: 'Le fichier est vide.' });
                return;
            }

            let greenWaveData;
            try {
                greenWaveData = JSON.parse(content);
            } catch (parseError) {
                console.error('Erreur parsing JSON:', parseError);
                showAlert({
                    title: 'Fichier JSON invalide',
                    message: 'Le fichier JSON est invalide ou corrompu.\n\nDétails : ' + parseError.message + '\n\nEssayez d\'ouvrir le fichier dans un éditeur de texte pour vérifier sa structure.'
                });
                return;
            }

            if (greenWaveData && greenWaveData.intersections) {
                const greenWaveId = Date.now().toString();
                let useIDB = false;

                try {
                    sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(greenWaveData.intersections));
                    sessionStorage.setItem(`greenwave_settings_${greenWaveId}`, JSON.stringify({
                        name: greenWaveData.name || file.name.replace(/\.json$/i, ''),
                        // Nom du fichier d'origine sur disque, conservé pour
                        // que la sauvegarde re-suggère exactement le même nom
                        // (préserve le préfixe « Onde verte - » s'il y était).
                        loadedFileName: file.name.replace(/\.json$/i, ''),
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
                        // Nom du fichier d'origine sur disque, conservé pour
                        // que la sauvegarde re-suggère exactement le même nom
                        // (préserve le préfixe « Onde verte - » s'il y était).
                        loadedFileName: file.name.replace(/\.json$/i, ''),
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

                openOrFocusGreenWave(`${window.location.origin}${window.location.pathname}?greenwave&id=${greenWaveId}${useIDB ? '&idb=1' : ''}`);
            } else {
                showAlert({ title: 'Fichier invalide', message: "Le fichier ne contient pas de données d'onde verte valides." });
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur ouverture fichier onde verte:', e);
                showAlert({ title: 'Erreur', message: "Erreur lors de l'ouverture du fichier : " + e.message });
            }
        }
    };

    // Handle project selection from open modal
    const handleOpenProject = async () => {
        if (selectedProject) {
            // Garde-fou : si le projet courant a des modifications non
            // sauvegardées, demander confirmation avant de l'écraser.
            if (isDirty) {
                const ok = await askConfirm({
                    title: 'Modifications non enregistrées',
                    message: 'Le projet courant a des modifications non enregistrées qui seront perdues.\n\nContinuer et ouvrir le projet sélectionné ?',
                    confirmLabel: 'Continuer',
                    danger: true,
                });
                if (!ok) return;
            }
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
            setHasActiveProject(true);
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
    const {
        handleFileSelect,
        handleImportExcelDirect,
        handleImportExcelFromRecentDir,
        handleImport,
        handleHTMFileSelect,
        handleHTMImport
    } = useImportOperations({
        importFile, setImportFile, setImportError, setImportModal, setImportHintDir,
        htmFile, setHtmFile, setHtmImportError, importedHTMFiles, setImportedHTMFiles, setImportHTMModal,
        cycleLength, loadFullState, updateGroupParams,
        lastImportDirectoryRef,
        saveDirectoryHandle, loadDirectoryHandle,
        recentImportDirs, addRecentDirectory,
        addToRecentFiles
    });

    // Import [redacted] [redacted]
    const handleImport[redacted] = async () => {
        try {
            let file;
            if (window.showOpenFilePicker) {
                const [fileHandle] = await safeShowOpenFilePicker({
                    types: [{
                        description: 'Fichiers [redacted] ([redacted])',
                        accept: { '*/*': ['[redacted]'] }
                    }],
                    multiple: false
                });
                file = await fileHandle.getFile();
            } else {
                // Fallback: input file classique
                file = await new Promise((resolve, reject) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '[redacted]';
                    input.onchange = () => {
                        if (input.files[0]) resolve(input.files[0]);
                        else reject(new Error('Aucun fichier sélectionné'));
                    };
                    input.click();
                });
            }

            const importedData = await import[redacted]File(file);

            // Construire les pfTabs avec les variables micro et actions
            const pfData = importedData.actionData || Array.from({ length: 30 }, (_, i) => ({
                id: i + 1, gf: '', action: '', description: '', deb: '', fin: '',
                abrv: '', micro: '', plage1: '', plage2: '',
                actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: ''
            }));
            const microFields = importedData.microVariables || [];
            const actionsCount = pfData.filter(a => a.gf || a.action).length;

            loadFullState({
                projectName: importedData.intersectionName,
                intersectionName: importedData.intersectionName,
                groups: importedData.groups,
                cycleLength: importedData.cycleLength,
                conflictMatrix: importedData.conflictMatrix,
                pfTabs: [{
                    id: 1,
                    name: 'PF1',
                    data: pfData,
                    microCustomFields: microFields
                }],
                projectProperties: importedData.projectProperties || {}
            });

            let message = `Import [redacted] réussi !\n\n${importedData.groups.length} groupes importés\nDurée de cycle : ${importedData.cycleLength}s`;
            if (actionsCount > 0) message += `\n${actionsCount} conditions micro importées`;
            if (microFields.length > 0) message += `\n${microFields.length} variables micro importées`;
            // Séparer les infos des vrais avertissements
            const infos = (importedData.warnings || []).filter(w => w.startsWith('Matrice :'));
            const realWarnings = (importedData.warnings || []).filter(w => !w.startsWith('Matrice :'));
            if (infos.length > 0) message += `\n${infos.join('\n')}`;
            if (realWarnings.length > 0) {
                message += `\n\n⚠️ Avertissements (${realWarnings.length}) :\n${realWarnings.join('\n')}`;
            }
            showAlert({ title: 'Import [redacted]', message });
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur import [redacted]:', e);
                showAlert({ title: 'Erreur [redacted]', message: "Erreur lors de l'import [redacted] : " + e.message });
            }
        }
    };

    // Lire une boîte noire (.bn)
    const handleOpenBlackBox = async () => {
        try {
            let file;
            if (window.showOpenFilePicker) {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{ description: 'Boîte noire', accept: { 'application/octet-stream': ['.bn'] } }]
                });
                file = await fileHandle.getFile();
            } else {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.bn';
                await new Promise(resolve => { input.onchange = resolve; input.click(); });
                file = input.files[0];
            }
            if (!file) return;

            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            if (data.length < 0x5C + 100) { showAlert({ title: 'Erreur', message: 'Fichier trop petit.' }); return; }

            const carrefour = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
            const year = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
            const month = data[8] | (data[9] << 8) | (data[10] << 16) | (data[11] << 24);
            const day = data[12] | (data[13] << 8) | (data[14] << 16) | (data[15] << 24);

            // Heure / minute lues depuis le nom de fichier (format bn{n}_{ddmmyyyy}_{hhmm}.bn)
            // — le fichier d'en-tête contient un autre timestamp dont la sémantique reste à clarifier.
            const timeMatch = file.name.match(/_(\d{2})(\d{2})\.bn$/i);
            const hour = timeMatch ? timeMatch[1] : '??';
            const minute = timeMatch ? timeMatch[2] : '??';

            const dataStart = 0x5C;
            const totalData = data.length - dataStart;
            const numSeconds = 3600;
            const numVarsFile = Math.floor(totalData / numSeconds);
            const dispCount = numVarsFile - 1;  // afficher TOUTES les variables (hors row 0 = BTS)

            // Taille du contrôleur (mémorisée par n° de carrefour, défaut 16)
            const sizeKey = `bn_controller_size_${carrefour}`;
            const savedSize = parseInt(localStorage.getItem(sizeKey)) || 16;

            // Pour chaque ligne, on calcule à la fois l'interprétation toggle (utilisée pour
            // les GF, où chaque 0x01 inverse l'état) et l'interprétation raw (0x01 = haut).
            // Le popup choisira la bonne représentation selon la taille du contrôleur sélectionnée.
            const varToggle = [];
            const varRaw = [];
            for (let v = 1; v <= dispCount; v++) {
                let toggleStr = '';
                let rawStr = '';
                let state = 0;
                for (let t = 0; t < numSeconds; t++) {
                    const byte = data[dataStart + v * numSeconds + t];
                    if (byte === 1) state = 1 - state;
                    toggleStr += state ? '1' : '0';
                    rawStr += byte === 1 ? '1' : '0';
                }
                varToggle.push(toggleStr);
                varRaw.push(rawStr);
            }

            // Ouvrir dans une popup
            const popup = window.open('', '_blank', 'width=1200,height=800');
            if (!popup) { showAlert({ title: 'Popup bloquée', message: 'Le navigateur a bloqué l\'ouverture de la fenêtre. Autorisez les popups pour ce site puis réessayez.' }); return; }

            popup.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>BN${carrefour}</title>
<style>*{box-sizing:border-box}body{background:#1a1a1a;color:#fff;font-family:monospace;margin:0;padding:10px;overflow:hidden;height:100vh;display:flex;flex-direction:column}h2{color:#4ecdc4;margin:5px 0;font-size:15px;flex-shrink:0}.info{color:#aaa;margin-bottom:5px;font-size:11px;flex-shrink:0}.controls{margin:4px 0;display:flex;gap:8px;align-items:center;font-size:11px;flex-shrink:0;flex-wrap:wrap}.legend{margin-left:8px}button,select{background:#333;color:#fff;border:1px solid #555;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px}button:hover,select:hover{background:#555}.viewer{flex:1;position:relative;overflow:hidden;border:1px solid #444}.scrollbar-h{position:absolute;bottom:0;left:160px;right:14px;height:14px;background:#222}.scrollbar-h input{width:100%;height:14px;margin:0;padding:0}.scrollbar-v{position:absolute;top:28px;right:0;bottom:14px;width:14px;background:#222}.scrollbar-v input{width:100%;height:100%;margin:0;padding:0;writing-mode:bt-lr;-webkit-appearance:slider-vertical}input[type=range]{-webkit-appearance:auto;cursor:pointer;background:#333}canvas{position:absolute;top:0;left:0}</style></head><body>
<h2>Carrefour ${carrefour} — Boîte noire</h2>
<div class="info">${day}/${month}/${year} ${hour}:${minute} — ${numSeconds}s (1h) — ${dispCount} variables</div>
<div class="controls"><button id="zoomIn">Zoom +</button><button id="zoomOut">Zoom -</button><span>Zoom: <strong id="zoomLabel">1x</strong></span><span style="margin-left:10px">Taille contrôleur: <select id="ctrlSize"><option value="8">8</option><option value="16">16</option><option value="32">32</option></select></span><span style="margin-left:10px">Sec: <strong id="secLabel">0</strong></span><span>Var: <strong id="rowLabel">0</strong></span><span class="legend" style="color:#00aa00">█ GF</span><span class="legend" style="color:#996600">█ Variable</span></div>
<div class="viewer" id="viewer"><canvas id="c"></canvas><div class="scrollbar-h"><input type="range" id="hScroll" min="0" max="${numSeconds-120}" value="0" step="1"></div><div class="scrollbar-v"><input type="range" id="vScroll" min="0" max="${dispCount-1}" value="0" step="1" orient="vertical"></div></div>
<script>
var DTOG=${JSON.stringify(varToggle)};
var DRAW=${JSON.stringify(varRaw)};
var TS=${numSeconds};var TV=${dispCount};var zoom=1;
var SIZE_KEY=${JSON.stringify(sizeKey)};
var sel=document.getElementById("ctrlSize");
sel.value=${JSON.stringify(String(savedSize))};
var NG=parseInt(sel.value);
sel.addEventListener("change",function(){NG=parseInt(sel.value);try{localStorage.setItem(SIZE_KEY,sel.value)}catch(e){}draw()});
function getLabel(i){return i<NG?"GF"+(i+1):"Var "+(i+2)}
function getData(i){return i<NG?DTOG[i]:DRAW[i]}
var hs=document.getElementById("hScroll");var vs=document.getElementById("vScroll");
document.getElementById("zoomIn").addEventListener("click",function(){zoom=Math.min(zoom+1,8);draw()});
document.getElementById("zoomOut").addEventListener("click",function(){zoom=Math.max(zoom-1,1);draw()});
function draw(){var vr=document.getElementById("viewer");var vw=vr.clientWidth-14,vh=vr.clientHeight-14;var lw=160,hh=28;var baseCW=Math.max(2,Math.floor((vw-lw)/120));var cw=baseCW*zoom;var ss=parseInt(hs.value)||0;var sg=parseInt(vs.value)||0;var ch=Math.max(10,Math.floor((vh-hh)/TV));var barH=Math.max(4,Math.floor(ch*0.35));var showS=Math.min(Math.floor((vw-lw)/cw),TS-ss);var showG=Math.min(TV-sg,Math.floor((vh-hh)/ch));var cv=document.getElementById("c");cv.width=vw;cv.height=vh;var cx=cv.getContext("2d");cx.fillStyle="#1a1a1a";cx.fillRect(0,0,vw,vh);for(var s=0;s<showS;s++){var sec=ss+s,x=lw+s*cw;if(sec%10===0){cx.strokeStyle="#666";cx.lineWidth=1.5;cx.beginPath();cx.moveTo(x,hh);cx.lineTo(x,vh);cx.stroke();cx.fillStyle="#eee";cx.font="bold 11px monospace";cx.textAlign="center";cx.fillText(String(sec),x+cw/2,hh-4);cx.lineWidth=1}else if(sec%5===0){cx.strokeStyle="#444";cx.lineWidth=1;cx.beginPath();cx.moveTo(x,hh);cx.lineTo(x,vh);cx.stroke();if(cw>=8){cx.fillStyle="#999";cx.font="9px monospace";cx.textAlign="center";cx.fillText(String(sec),x+cw/2,hh-4)}}else{cx.strokeStyle="#2a2a2a";cx.lineWidth=0.5;cx.beginPath();cx.moveTo(x,hh);cx.lineTo(x,vh);cx.stroke()}}for(var g=0;g<showG;g++){var gi=sg+g;var y=hh+g*ch;var isGF=gi<NG;cx.textAlign="right";if(isGF){var fs2=Math.min(13,9+zoom);cx.font="bold "+fs2+"px monospace";cx.fillStyle="#fff"}else{cx.font="8px monospace";cx.fillStyle="#7799bb"}cx.fillText(getLabel(gi),lw-4,y+barH/2+4);cx.strokeStyle="#252525";cx.beginPath();cx.moveTo(lw,y+ch-1);cx.lineTo(vw,y+ch-1);cx.stroke();var rowData=getData(gi);if(!rowData)continue;for(var s2=0;s2<showS;s2++){var sc=ss+s2;if(sc>=TS)break;if(rowData[sc]==="1"){cx.fillStyle=isGF?"#00aa00":"#996600";cx.fillRect(lw+s2*cw,y,cw,barH)}}}cx.strokeStyle="#555";cx.beginPath();cx.moveTo(lw,0);cx.lineTo(lw,vh);cx.stroke();cx.beginPath();cx.moveTo(0,hh);cx.lineTo(vw,hh);cx.stroke();document.getElementById("secLabel").textContent=ss+" - "+(ss+showS);document.getElementById("rowLabel").textContent=(sg+1)+" - "+(sg+showG);document.getElementById("zoomLabel").textContent=zoom+"x"}
hs.addEventListener("input",draw);vs.addEventListener("input",draw);window.addEventListener("resize",draw);
document.getElementById("viewer").addEventListener("wheel",function(e){e.preventDefault();if(e.ctrlKey){if(e.deltaY<0)zoom=Math.min(zoom+1,8);else zoom=Math.max(zoom-1,1);draw();return}if(e.shiftKey){vs.value=Math.max(0,Math.min(TV-1,parseInt(vs.value)+(e.deltaY>0?3:-3)))}else{hs.value=Math.max(0,Math.min(TS-120,parseInt(hs.value)+(e.deltaY>0?10:-10)))}draw()});
draw();
</script></body></html>`);
            popup.document.close();
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur boîte noire:', e);
                showAlert({ title: 'Erreur de lecture', message: 'Erreur lors de la lecture : ' + e.message });
            }
        }
    };

    // Keyboard shortcuts (Ctrl+Z/Y, Ctrl+N/O/S)
    const handleMenuActionRef = useRef(handleMenuAction);
    handleMenuActionRef.current = handleMenuAction;
    useEffect(() => {
        const handleKeyDown = (e) => {
            const tag = e.target.tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (undo() !== false) toast.info('Action annulée');
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                if (redo() !== false) toast.info('Action rétablie');
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !isInput) {
                e.preventDefault();
                handleMenuActionRef.current('new');
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                handleMenuActionRef.current('open');
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleMenuActionRef.current('save');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);


    // Render floating image content into popup window
    useFloatingImageRenderer({
        showFloatingImage, intersectionImage,
        floatingCrop, setFloatingCrop,
        floatingZoom, setFloatingZoom,
        showCropControls, setShowCropControls,
        intersectionArrows, groups,
        hoveredArrowGroupId, hoveredDiagramTime,
        simulationEnabled, isPlayingSimulation,
        simulationCurrentTime, simulationResult,
        actionData, cycleLength,
        imageBrightness, imageContrast,
        floatingImagePopup
    });

    // Render matrix into popup window
    useEffect(() => {
        if (!showFloatingMatrix) return;
        matrixPopup.renderToPopup(
            <div style={{ padding: '12px', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
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
                    locked={matricesLocked}
                    hoveredGroupId={hoveredArrowGroupId}
                />
            </div>
        );
    }, [showFloatingMatrix, conflictMatrix, groups, cycleLength, actionData, activePFId,
        pfTabs, biCarrefourSeparator, showGroupNamesMatrix, matricesLocked, hoveredArrowGroupId, matrixPopup.renderToPopup]);

    // Render form into popup window
    useEffect(() => {
        if (!showFloatingForm) return;
        formPopup.renderToPopup(
            <div style={{ padding: '12px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
                <GroupTable
                    groups={groups}
                    updateGroupParams={updateGroupParams}
                    cycleLength={cycleLength}
                    showGroupNames={showGroupNamesForm}
                    hoveredGroupId={hoveredArrowGroupId}
                    startDrag={startDrag}
                    endDrag={endDrag}
                />
            </div>
        );
    }, [showFloatingForm, groups, cycleLength, showGroupNamesForm, hoveredArrowGroupId, startDrag, endDrag, formPopup.renderToPopup, updateGroupParams]);

    // Render remarques (notes du PF actif) into popup window
    useEffect(() => {
        if (!showFloatingRemarks) return;
        remarquesPopup.renderToPopup(
            <RemarquesEditor
                remarques={currentRemarques}
                updateRemarques={updatePFRemarques}
                groupCount={groups.length}
                popupMode={true}
            />
        );
    }, [showFloatingRemarks, currentRemarques, updatePFRemarques, groups.length, remarquesPopup.renderToPopup]);

    // Render traffic table into popup window
    useEffect(() => {
        if (!showFloatingTraffic) return;
        trafficPopup.renderToPopup(
            <div style={{ padding: '12px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
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
        );
    }, [showFloatingTraffic, groups, cycleLength, activeTrafficDataset, actionData,
        simulationSelectedActions, trafficPopup.renderToPopup, updateTrafficData,
        getTrafficData, updateGroupParams, trafficDatasetNames, copyTrafficDataset, addCustomTrafficDataset]);

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
                    hasActiveProject={hasActiveProject}
                    onManageUsers={() => setShowUserManager(true)}
                    biCarrefourSeparator={biCarrefourSeparator}
                    layoutOptions={{ showParameters: sidebarVisible, showComments, showRemarks, darkMode, colorTheme, showGroupNamesForm, showGroupNamesMatrix, showGroupNamesDiagram, showActionDescription, projectModified, showFloatingImage, hasIntersectionImage: !!intersectionImage, showFloatingMatrix, showFloatingForm, showFloatingTraffic, showFloatingConditions, showFloatingVariables, showFloatingRemarks, matricesLocked, toastPrefs, openPropertiesOnNewProject, showWrapFlash, showSaveReminder, phasageBulleEnabled, simulationEnabled, activeTab }}
                    pixelsPerSecond={pixelsPerSecond}
                    onPixelsPerSecondChange={setPixelsPerSecond}
                    showMicroOnHover={showMicroOnHover}
                    initialOpenMenu={!hasActiveProject ? 'fichier' : null}
                />
            {!hasActiveProject && (
                <div className="welcome-screen">
                    <p className="welcome-hint">
                        Commencez par <strong>Fichier → Nouveau projet</strong> ou <strong>Ouvrir un projet</strong>.
                    </p>
                </div>
            )}
            {hasActiveProject && (<>
            <header className="app-header" onMouseEnter={() => { helpZoneRef.current = 'interface'; }}>
                <div className="header-inputs">
                    <input
                        ref={projectNameInputRef}
                        className="input-name"
                        type="text"
                        value={projectName || ''}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Nom du projet"
                        title="Nom du projet (utilisé pour la sauvegarde)"
                    />
                    {isDirty && (
                        <span
                            className="unsaved-indicator"
                            title="Modifications non sauvegardées"
                            aria-label="Modifications non sauvegardées"
                        >*</span>
                    )}
                    <label className="gfx-label">
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
                            onBlur={async () => {
                                const newCount = parseInt(groupCountInput);
                                if (!isNaN(newCount) && newCount >= 1 && newCount <= 32 && newCount !== groups.length) {
                                    const isReduce = newCount < groups.length;
                                    const ok = await askConfirm({
                                        title: isReduce ? 'Réduire le nombre de groupes' : 'Ajouter des groupes',
                                        message: isReduce
                                            ? `Réduire de ${groups.length} à ${newCount} groupes de feu supprimera les paramètres des groupes supprimés sur l'ensemble des plans de feu.\n\nConfirmer ?`
                                            : `L'ajout de groupes de feux s'appliquera pour l'ensemble des plans de feu.\n\nConfirmer ?`,
                                        confirmLabel: 'Confirmer',
                                        danger: isReduce,
                                    });
                                    if (ok) {
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
                        onClick={() => { if (undo() !== false) toast.info('Action annulée'); }}
                        disabled={!canUndo}
                        title="Annuler (Ctrl+Z)"
                    >
                        ↶ Annuler
                    </button>
                    <button
                        className="undo-btn"
                        onClick={() => { if (redo() !== false) toast.info('Action rétablie'); }}
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
                    {displayActiveConflicts.length > 0 ? (
                        <div className="status-error">
                            {displayActiveConflicts.length} CONFLITS !
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
                            setHoveredConflict={setHoveredConflict}
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
                                    {groups.length > 0 && groups.every(g => !g.type || g.type === '') && (
                                        <span className="tab-warning-icon" title="Formulaire non renseigné" role="img" aria-label="Formulaire non renseigné"> ⚠</span>
                                    )}
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
                                        onDetach={() => setShowFloatingForm(v => !v)}
                                        hoveredGroupId={hoveredArrowGroupId}
                                        startDrag={startDrag}
                                        endDrag={endDrag}
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
                                            locked={matricesLocked}
                                            onDetach={() => setShowFloatingMatrix(v => !v)}
                                            hoveredGroupId={hoveredArrowGroupId}
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
                                    locked={matricesLocked}
                                    onDetach={() => setShowFloatingMatrix(v => !v)}
                                    hoveredGroupId={hoveredArrowGroupId}
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
                                    onDetach={() => setShowFloatingTraffic(v => !v)}
                                />
                                </div>
                            )}

                            {displayConflicts.length > 0 && (
                                <div className="conflict-list">
                                    <h4>Conflits:</h4>
                                    <ul>
                                        {displayConflicts.map((c, i) => {
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
                                conflicts={displayConflicts}
                                onDragConflicts={setDragConflictsFromDiagram}
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
                                remarquesDetached={showFloatingRemarks}
                                showGroupNames={showGroupNamesDiagram}
                                showMicroOnHover={showMicroOnHover}
                                showWrapFlash={showWrapFlash}
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
                                showFloatingConditions={showFloatingConditions}
                                setShowFloatingConditions={setShowFloatingConditions}
                                showFloatingVariables={showFloatingVariables}
                                setShowFloatingVariables={setShowFloatingVariables}
                                showWrapFlash={showWrapFlash}
                                showDescription={showActionDescription}
                            />
                        </div>
                    </div>
                </section>
            </main>
            </>)}

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
                                            onDoubleClick={async () => {
                                                // Garde-fou : modifications non sauvegardées
                                                if (isDirty) {
                                                    const ok = await askConfirm({
                                                        title: 'Modifications non enregistrées',
                                                        message: `Le projet courant a des modifications non enregistrées qui seront perdues.\n\nContinuer et ouvrir « ${project.name} » ?`,
                                                        confirmLabel: 'Continuer',
                                                        danger: true,
                                                    });
                                                    if (!ok) return;
                                                }
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
                                                setHasActiveProject(true);
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
            <Modal isOpen={helpModal} onClose={() => setHelpModal(false)} title="Aide - TraCflux" className="modal-wide">
                <HelpContent initialAnchor={helpAnchor} />
            </Modal>

            {/* Modal À propos */}
            <Modal isOpen={aboutModal} onClose={() => setAboutModal(false)} title={`À propos — ${APP_NAME}`}>
                <div style={{ padding: '10px 4px', textAlign: 'center', position: 'relative' }}>
                    <img
                        src="./logo.svg"
                        alt=""
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '8px',
                            width: '80px',
                            height: '80px',
                            userSelect: 'none',
                            pointerEvents: 'none'
                        }}
                    />
                    <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#4ecdc4', marginBottom: '8px' }}>
                        {APP_NAME}
                    </div>
                    <div style={{ fontSize: '1.1em', color: '#aaa', marginBottom: '4px' }}>
                        Version {APP_VERSION}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
                        {APP_DESCRIPTION}
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '16px 0' }} />
                    <div style={{ fontSize: '0.85em', color: '#888', lineHeight: '1.6' }}>
                        <div>Développée avec <strong>React</strong> + <strong>Vite</strong></div>
                        <div style={{ marginTop: '8px' }}>© 2026 Thierry Colmon</div>
                        <div style={{ marginTop: '12px' }}>
                            Licence{' '}
                            <a
                                href="https://www.gnu.org/licenses/agpl-3.0.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#4ecdc4' }}
                            >
                                GNU AGPL v3
                            </a>
                        </div>
                        <div style={{ marginTop: '4px' }}>
                            Code source :{' '}
                            <a
                                href="https://github.com/ThierryClm/Diagramme_Feux"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#4ecdc4' }}
                            >
                                github.com/ThierryClm/Diagramme_Feux
                            </a>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal Rapport de diagnostic */}
            <Modal isOpen={diagnosticModal} onClose={() => setDiagnosticModal(false)} title="Rapport de diagnostic" className="modal-wide">
                {(() => {
                    // diagnosticRefresh is read here so the modal re-renders when the journal is cleared
                    void diagnosticRefresh;
                    const report = buildDiagnosticReport({
                        intersectionName,
                        projectName,
                        groups,
                        pfTabs,
                        activePFId,
                        cycleLength,
                        actionData,
                        conflictMatrix,
                        intersectionImage,
                        includeProject: diagnosticIncludeProject
                    });
                    const journalEntries = getInterceptedEntries();
                    const journalCount = journalEntries.length;
                    const hasErrors = journalEntries.some(e => e.type === 'error' || e.type === 'runtime' || e.type === 'promise');
                    return (
                        <div style={{ padding: '8px 4px' }}>
                            <div style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '12px' }}>
                                Ce rapport contient des informations techniques utiles pour signaler un bug.
                                Aucune donnée n'est envoyée — le contenu reste sur votre poste. Vous pouvez le
                                copier dans le presse-papiers ou le télécharger comme fichier texte.
                            </div>
                            <div style={{
                                fontSize: '0.85em',
                                marginBottom: '10px',
                                padding: '6px 10px',
                                background: hasErrors ? '#3a2020' : journalCount > 0 ? '#3a3320' : '#203a20',
                                border: `1px solid ${hasErrors ? '#8a4a4a' : journalCount > 0 ? '#8a8a4a' : '#4a8a4a'}`,
                                borderRadius: '4px',
                                color: '#e0e0e0'
                            }}>
                                Journal d'erreurs : <strong>{journalCount}</strong> entrée(s) interceptée(s) depuis l'ouverture de l'application.
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={diagnosticIncludeProject}
                                    onChange={(e) => setDiagnosticIncludeProject(e.target.checked)}
                                />
                                Inclure le projet en cours (données détaillées — ne pas partager si sensibles)
                            </label>
                            <textarea
                                readOnly
                                value={report}
                                style={{
                                    width: '100%',
                                    height: '360px',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    background: '#1a1a2e',
                                    color: '#e0e0e0',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    resize: 'vertical'
                                }}
                            />
                            <div className="modal-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                    className="modal-btn modal-btn-secondary"
                                    onClick={() => setDiagnosticModal(false)}
                                >
                                    Fermer
                                </button>
                                <button
                                    className="modal-btn modal-btn-secondary"
                                    disabled={journalCount === 0}
                                    title={journalCount === 0 ? 'Aucune entrée à copier' : 'Copier uniquement le journal d\'erreurs'}
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(buildErrorJournal());
                                            toast.success(`Journal copié (${journalCount} entrée${journalCount > 1 ? 's' : ''})`);
                                        } catch (e) {
                                            toast.error('Copie impossible : ' + e.message);
                                        }
                                    }}
                                >
                                    Copier le journal ({journalCount})
                                </button>
                                <button
                                    className="modal-btn modal-btn-secondary"
                                    disabled={journalCount === 0}
                                    title={journalCount === 0 ? 'Journal déjà vide' : 'Vider le journal — utile pour repartir propre avant de reproduire un bug'}
                                    onClick={() => {
                                        const n = journalCount;
                                        clearInterceptedEntries();
                                        setDiagnosticRefresh(v => v + 1);
                                        toast.success(`Journal vidé (${n} entrée${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''})`);
                                    }}
                                >
                                    Vider le journal
                                </button>
                                <button
                                    className="modal-btn modal-btn-primary"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(report);
                                            toast.success('Rapport copié dans le presse-papiers');
                                        } catch (e) {
                                            toast.error('Copie impossible : ' + e.message);
                                        }
                                    }}
                                >
                                    Copier le rapport
                                </button>
                                <button
                                    className="modal-btn modal-btn-primary"
                                    onClick={() => {
                                        downloadDiagnosticReport(report, 'diagnostic');
                                        toast.success('Rapport téléchargé (.txt)');
                                    }}
                                >
                                    Télécharger .txt
                                </button>
                                <button
                                    className="modal-btn modal-btn-primary"
                                    title="Version structurée (JSON) — plus facile à parser ou analyser"
                                    onClick={() => {
                                        const obj = buildDiagnosticJSON({
                                            intersectionName,
                                            projectName,
                                            groups,
                                            pfTabs,
                                            activePFId,
                                            cycleLength,
                                            actionData,
                                            conflictMatrix,
                                            intersectionImage,
                                            includeProject: diagnosticIncludeProject
                                        });
                                        downloadDiagnosticJSON(obj, 'diagnostic');
                                        toast.success('Rapport téléchargé (.json)');
                                    }}
                                >
                                    Télécharger .json
                                </button>
                            </div>
                        </div>
                    );
                })()}
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
                                        showAlert({
                                            title: 'Re-sélection du fichier nécessaire',
                                            message: `Pour réimporter « ${file.name} », veuillez le sélectionner à nouveau via le bouton ci-dessus.\n\nPour des raisons de sécurité, le navigateur ne permet pas d'accéder directement aux fichiers précédemment sélectionnés.`
                                        });
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
                            <button className="modal-close" onClick={() => setOpenGreenWaveModal(false)} aria-label="Fermer la fenêtre">×</button>
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
                            <button className="modal-close" onClick={() => setDossierDialog(false)} aria-label="Fermer la fenêtre">&times;</button>
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
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`conditionsMicro_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`conditionsMicro_${p.id}`] = false; }); return u;
                                                }); }} />
                                            Conditions de micro-régulation
                                        </label>
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`variablesMicro_${pf.id}`] || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`variablesMicro_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`variablesMicro_${p.id}`] = false; }); return u;
                                                }); }} />
                                            Variables micro
                                        </label>
                                        {intersectionArrows.length > 0 && intersectionImage && (
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`phasageBulle_${pf.id}`] || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`phasageBulle_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`phasageBulle_${p.id}`] = false; }); return u;
                                                }); }} />
                                            Phasage bulle
                                        </label>
                                        )}
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`traficCapacite_${pf.id}`] || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`traficCapacite_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`traficCapacite_${p.id}`] = false; }); return u;
                                                }); }} />
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
                            <button className="btn-confirm" onClick={handleDossierExportPDF}>Exporter PDF</button>
                            <button className="btn-confirm" onClick={handleDossierConfirm}>Imprimer</button>
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
                            <button className="modal-close" onClick={() => setPrintPreviewModal(false)} aria-label="Fermer la fenêtre">×</button>
                        </div>
                        <div className="print-preview-container">
                            <div className="print-preview-page" ref={printPreviewPageRef}>
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
                                    // A4 paysage marges 10mm: ~277mm = ~1047px à 96dpi
                                    // Marge de sécurité pour variations navigateur
                                    const printPageWidth = 960; // A4 paysage avec marges navigateur
                                    // Sidebar: ~325px fixe en CSS (commentaires/remarques masquées)
                                    const printSidebarWidth = 325;
                                    const printTimelineWidth = printPageWidth - printSidebarWidth; // ~635px

                                    // Référence : 100s = pleine largeur timeline
                                    // Cycles <= 100s : même PPS (1 seconde = même largeur)
                                    // Cycles > 100s : PPS réduit pour tenir dans la page
                                    const referenceCycle = 100;
                                    const referencePPS = (printTimelineWidth / referenceCycle) * 0.95;
                                    const optimalPPS = cycleLength <= referenceCycle
                                        ? referencePPS
                                        : printTimelineWidth / cycleLength;

                                    // Scale de sécurité si le diagramme dépasse la page
                                    const estimatedWidth = printSidebarWidth + (cycleLength * optimalPPS);
                                    const printScale = estimatedWidth > printPageWidth
                                        ? printPageWidth / estimatedWidth : 1;

                                    return (
                                    <div className="print-preview-diagram print-preview-landscape" style={
                                        printScale < 1 ? {
                                            transform: `scale(${printScale.toFixed(3)})`,
                                            transformOrigin: 'top left',
                                            width: `${Math.ceil(100 / printScale)}%`
                                        } : {}
                                    }>
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
            {isSaving && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999
                }}>
                    <div style={{
                        background: '#222',
                        color: '#4ecdc4',
                        border: '1px solid #4ecdc4',
                        borderRadius: '8px',
                        padding: '20px 40px',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}>
                        Sauvegarde en cours...
                    </div>
                </div>
            )}
            <ToastContainer />
        </div>
    )
}

export default App
