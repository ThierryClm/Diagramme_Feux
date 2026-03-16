import { useState, useRef } from 'react';

/**
 * Gère tous les états de modales et dialogues de l'application,
 * ainsi que les états de formulaire associés (slide, insert, reduce, etc.).
 */
const useDialogState = () => {
    // Modales principales
    const [openModal, setOpenModal] = useState(false);
    const [slideModal, setSlideModal] = useState(false);
    const [insertModal, setInsertModal] = useState(false);
    const [reduceModal, setReduceModal] = useState(false);
    const [optionsModal, setOptionsModal] = useState(false);
    const [helpModal, setHelpModal] = useState(false);
    const helpZoneRef = useRef(null);
    const [importModal, setImportModal] = useState(false);

    // Formulaire glissement
    const [slideValue, setSlideValue] = useState(0);
    const [slideFromGroup, setSlideFromGroup] = useState(1);
    const [slideToGroup, setSlideToGroup] = useState(1);
    const [slideTouched, setSlideTouched] = useState(false);

    // Formulaire insertion de temps
    const [insertStart, setInsertStart] = useState(0);
    const [insertDuration, setInsertDuration] = useState(5);
    const [insertTouched, setInsertTouched] = useState(false);

    // Formulaire réduction de temps
    const [reduceStart, setReduceStart] = useState(0);
    const [reduceDuration, setReduceDuration] = useState(5);
    const [reduceTouched, setReduceTouched] = useState(false);

    // Bi-carrefour
    const [biCarrefourModal, setBiCarrefourModal] = useState(false);
    const [biCarrefourGroupId, setBiCarrefourGroupId] = useState('');
    const [biCarrefourTouched, setBiCarrefourTouched] = useState(false);

    // Déplacement de groupe
    const [moveGroupModal, setMoveGroupModal] = useState(false);
    const [groupToMove, setGroupToMove] = useState('');
    const [moveAfterGroup, setMoveAfterGroup] = useState('0');
    const [moveGroupTouched, setMoveGroupTouched] = useState(false);

    // Import HTM
    const [importHTMModal, setImportHTMModal] = useState(false);
    const [htmFile, setHtmFile] = useState(null);
    const [htmImportError, setHtmImportError] = useState('');
    const [importedHTMFiles, setImportedHTMFiles] = useState(() => {
        try {
            const saved = localStorage.getItem('importedHTMFiles');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    // Liens externes
    const [showExternalLinksModal, setShowExternalLinksModal] = useState(false);

    // Impression / dossier
    const [printPreviewModal, setPrintPreviewModal] = useState(false);
    const [printType, setPrintType] = useState(null);
    const [dossierDialog, setDossierDialog] = useState(false);
    const [dossierSections, setDossierSections] = useState({});

    // Onde verte (modales)
    const [createGreenWaveModal, setCreateGreenWaveModal] = useState(false);
    const [openGreenWaveModal, setOpenGreenWaveModal] = useState(false);
    const [greenWaveViewer, setGreenWaveViewer] = useState(false);

    // Drag & drop onglets PF
    const [draggedTabIndex, setDraggedTabIndex] = useState(null);

    return {
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
    };
};

export default useDialogState;
