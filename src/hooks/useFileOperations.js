import { useCallback } from 'react';
import { safeShowOpenFilePicker, safeShowSaveFilePicker } from '../utils/filePicker';
import { toast } from '../utils/toast';
import { validateProject } from '../utils/projectValidator';
import { bringAllPopupsToFront } from './usePopupWindow';

/**
 * Gère les opérations d'ouverture et de sauvegarde de fichiers projet
 * via la File System Access API (avec fallback localStorage).
 */
const useFileOperations = ({
    projectName, diagramHeight, floatingCrop, floatingZoom,
    setSelectedProject, setOpenModal, setCurrentProjectPath, setProjectModified,
    projectModifiedSkip, hasUnsavedChanges, setHasUnsavedChanges,
    setDiagramHeight, setFloatingCrop, setFloatingZoom,
    setShowComments, setShowRemarks, setIntersectionName,
    // Options de mise en page sauvegardées dans le projet
    showComments, showRemarks, showActionDescription, sidebarVisible,
    setShowActionDescription, setSidebarVisible,
    // Flags de détachement de fenêtres (niveau projet)
    showFloatingForm, setShowFloatingForm,
    showFloatingMatrix, setShowFloatingMatrix,
    showFloatingTraffic, setShowFloatingTraffic,
    showFloatingImage, setShowFloatingImage,
    showFloatingConditions, setShowFloatingConditions,
    showFloatingVariables, setShowFloatingVariables,
    loadFullState, getFullState, saveProject,
    dossierSections, setDossierSections,
    lastOpenDirectoryRef, lastSaveDirectoryRef, lastImportDirectoryRef,
    lastImageDirectoryRef, lastGreenWaveDirectoryRef,
    saveDirectoryHandle, loadDirectoryHandle,
    recentOpenDirs, recentSaveDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs,
    addRecentDirectory
}) => {
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

            const [fileHandle] = await safeShowOpenFilePicker(options);
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

            const validation = validateProject(data);
            if (!validation.ok) {
                toast.error(validation.error);
                return;
            }
            if (validation.warnings.length > 0) {
                console.warn('Avertissements validation projet :', validation.warnings);
                toast.info(`Projet chargé avec ${validation.warnings.length} avertissement(s) — voir console`);
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
            setProjectModified(true); // active "Nouveau projet" dans le menu
            projectModifiedSkip.current = true; // absorbe le prochain changement de deps
            setHasUnsavedChanges(false); // pas de modifications non sauvegardées

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

            // Restaurer les options de mise en page sauvegardées dans le projet :
            // - Format moderne : data.layoutOptions = { showParameters, showComments, showRemarks, showActionDescription, showFloating* }
            // - Format ancien (rétrocompatibilité) : auto-détection des coches
            //   commentaires/remarques selon la présence de contenu
            if (data.layoutOptions && typeof data.layoutOptions === 'object') {
                const lo = data.layoutOptions;
                if (typeof lo.showParameters === 'boolean') setSidebarVisible(lo.showParameters);
                if (typeof lo.showComments === 'boolean') setShowComments(lo.showComments);
                if (typeof lo.showRemarks === 'boolean') setShowRemarks(lo.showRemarks);
                if (typeof lo.showActionDescription === 'boolean') setShowActionDescription(lo.showActionDescription);

                // Détachements de fenêtres : on applique directement les
                // valeurs du projet. Pas de close-then-reopen : le setTimeout
                // casserait la chaîne « geste utilisateur » du clic d'origine
                // et déclencherait le bloqueur de popups du navigateur.
                if (typeof lo.showFloatingForm === 'boolean') setShowFloatingForm(lo.showFloatingForm);
                if (typeof lo.showFloatingMatrix === 'boolean') setShowFloatingMatrix(lo.showFloatingMatrix);
                if (typeof lo.showFloatingTraffic === 'boolean') setShowFloatingTraffic(lo.showFloatingTraffic);
                if (typeof lo.showFloatingImage === 'boolean') setShowFloatingImage(lo.showFloatingImage);
                if (typeof lo.showFloatingConditions === 'boolean') setShowFloatingConditions(lo.showFloatingConditions);
                if (typeof lo.showFloatingVariables === 'boolean') setShowFloatingVariables(lo.showFloatingVariables);
            } else {
                const hasComments = data.groups?.some(g => g.comment && g.comment.trim() !== '') || (data.pfTabs || []).some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== ''));
                setShowComments(!!hasComments);
                const pfList = data.pfTabs || [];
                const hasRemarks = pfList.some(pf => pf.remarques && pf.remarques.trim() !== '');
                setShowRemarks(!!hasRemarks);

                // Projet ancien sans layoutOptions : on décoche tous les
                // détachements pour repartir d'un espace de travail propre.
                // L'utilisateur détachera ce dont il a besoin pour ce projet.
                setShowFloatingForm(false);
                setShowFloatingMatrix(false);
                setShowFloatingTraffic(false);
                setShowFloatingImage(false);
                setShowFloatingConditions(false);
                setShowFloatingVariables(false);
            }

            // Restaurer les options du dossier d'impression
            if (data.dossierSections && Object.keys(data.dossierSections).length > 0) {
                setDossierSections(data.dossierSections);
            }

            // Ramène les popups détachées au premier plan : après l'ouverture
            // d'un projet, le focus est revenu sur la fenêtre principale et
            // les popups peuvent passer derrière. Sans ça, l'utilisateur doit
            // cliquer sur la fenêtre principale pour les voir réapparaître.
            setTimeout(() => bringAllPopupsToFront(null), 100);

            toast.success(`Projet ouvert : ${projName}`);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur ouverture fichier:', e);
                toast.error('Échec de l\'ouverture : ' + e.message);
            }
        }
    }, [loadFullState, saveDirectoryHandle, addRecentDirectory, setDiagramHeight]); // eslint-disable-line react-hooks/exhaustive-deps

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

            const [fileHandle] = await safeShowOpenFilePicker(options);
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

            const validation = validateProject(data);
            if (!validation.ok) {
                toast.error(validation.error);
                return;
            }
            if (validation.warnings.length > 0) {
                console.warn('Avertissements validation projet :', validation.warnings);
                toast.info(`Projet chargé avec ${validation.warnings.length} avertissement(s) — voir console`);
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
            setProjectModified(true); // active "Nouveau projet" dans le menu
            projectModifiedSkip.current = true; // absorbe le prochain changement de deps
            setHasUnsavedChanges(false); // pas de modifications non sauvegardées

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

            // Restaurer les options de mise en page sauvegardées dans le projet :
            // - Format moderne : data.layoutOptions = { showParameters, showComments, showRemarks, showActionDescription, showFloating* }
            // - Format ancien (rétrocompatibilité) : auto-détection des coches
            //   commentaires/remarques selon la présence de contenu
            if (data.layoutOptions && typeof data.layoutOptions === 'object') {
                const lo = data.layoutOptions;
                if (typeof lo.showParameters === 'boolean') setSidebarVisible(lo.showParameters);
                if (typeof lo.showComments === 'boolean') setShowComments(lo.showComments);
                if (typeof lo.showRemarks === 'boolean') setShowRemarks(lo.showRemarks);
                if (typeof lo.showActionDescription === 'boolean') setShowActionDescription(lo.showActionDescription);

                // Détachements de fenêtres : on applique directement les
                // valeurs du projet. Pas de close-then-reopen : le setTimeout
                // casserait la chaîne « geste utilisateur » du clic d'origine
                // et déclencherait le bloqueur de popups du navigateur.
                if (typeof lo.showFloatingForm === 'boolean') setShowFloatingForm(lo.showFloatingForm);
                if (typeof lo.showFloatingMatrix === 'boolean') setShowFloatingMatrix(lo.showFloatingMatrix);
                if (typeof lo.showFloatingTraffic === 'boolean') setShowFloatingTraffic(lo.showFloatingTraffic);
                if (typeof lo.showFloatingImage === 'boolean') setShowFloatingImage(lo.showFloatingImage);
                if (typeof lo.showFloatingConditions === 'boolean') setShowFloatingConditions(lo.showFloatingConditions);
                if (typeof lo.showFloatingVariables === 'boolean') setShowFloatingVariables(lo.showFloatingVariables);
            } else {
                const hasComments = data.groups?.some(g => g.comment && g.comment.trim() !== '') || (data.pfTabs || []).some(pf => pf.diagram?.some(d => d.comment && d.comment.trim() !== ''));
                setShowComments(!!hasComments);
                const pfList = data.pfTabs || [];
                const hasRemarks = pfList.some(pf => pf.remarques && pf.remarques.trim() !== '');
                setShowRemarks(!!hasRemarks);

                // Projet ancien sans layoutOptions : on décoche tous les
                // détachements pour repartir d'un espace de travail propre.
                // L'utilisateur détachera ce dont il a besoin pour ce projet.
                setShowFloatingForm(false);
                setShowFloatingMatrix(false);
                setShowFloatingTraffic(false);
                setShowFloatingImage(false);
                setShowFloatingConditions(false);
                setShowFloatingVariables(false);
            }

            // Restaurer les options du dossier d'impression
            if (data.dossierSections && Object.keys(data.dossierSections).length > 0) {
                setDossierSections(data.dossierSections);
            }

            // Ramène les popups détachées au premier plan : après l'ouverture
            // d'un projet, le focus est revenu sur la fenêtre principale et
            // les popups peuvent passer derrière. Sans ça, l'utilisateur doit
            // cliquer sur la fenêtre principale pour les voir réapparaître.
            setTimeout(() => bringAllPopupsToFront(null), 100);

            toast.success(`Projet ouvert : ${projName}`);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur ouverture fichier:', e);
                toast.error('Échec de l\'ouverture : ' + e.message);
            }
        }
    }, [recentOpenDirs, loadDirectoryHandle, saveDirectoryHandle, addRecentDirectory, loadFullState, setDiagramHeight]); // eslint-disable-line react-hooks/exhaustive-deps

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

            const fileHandle = await safeShowSaveFilePicker(options);

            // Préparer les données du projet
            const fullState = getFullState();
            const projectData = {
                ...fullState,
                diagramHeight: diagramHeight,
                floatingCrop: floatingCrop,
                floatingZoom: floatingZoom,
                dossierSections: dossierSections,
                // Options de mise en page sauvegardées avec le projet
                layoutOptions: {
                    showParameters: sidebarVisible,
                    showComments,
                    showRemarks,
                    showActionDescription,
                    // Flags de détachement (les dimensions des popups
                    // dépendent du nombre de groupes du projet)
                    showFloatingForm,
                    showFloatingMatrix,
                    showFloatingTraffic,
                    showFloatingImage,
                    showFloatingConditions,
                    showFloatingVariables
                },
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
            setProjectModified(true); // active "Nouveau projet" dans le menu
            projectModifiedSkip.current = true; // absorbe setIntersectionName(savedName)
            setHasUnsavedChanges(false); // projet sauvegardé, pas de modifications

            // Sauvegarder aussi dans localStorage pour cohérence
            saveProject(savedName);

            toast.success(`Projet sauvegardé : ${savedName}`);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                toast.error('Échec de la sauvegarde : ' + e.message);
            }
        }
    }, [projectName, getFullState, setIntersectionName, saveProject, saveDirectoryHandle, addRecentDirectory, recentOpenDirs, recentSaveDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs,
        // Layout options sauvegardées dans le projet — sans ces deps, le
        // callback memoisé garde les valeurs périmées du premier rendu.
        sidebarVisible, showComments, showRemarks, showActionDescription,
        showFloatingForm, showFloatingMatrix, showFloatingTraffic, showFloatingImage,
        showFloatingConditions, showFloatingVariables]); // eslint-disable-line react-hooks/exhaustive-deps

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

            const fileHandle = await safeShowSaveFilePicker(options);

            // Préparer les données du projet
            const fullState = getFullState();
            const projectData = {
                ...fullState,
                diagramHeight: diagramHeight,
                floatingCrop: floatingCrop,
                floatingZoom: floatingZoom,
                dossierSections: dossierSections,
                // Options de mise en page sauvegardées avec le projet
                layoutOptions: {
                    showParameters: sidebarVisible,
                    showComments,
                    showRemarks,
                    showActionDescription,
                    // Flags de détachement (les dimensions des popups
                    // dépendent du nombre de groupes du projet)
                    showFloatingForm,
                    showFloatingMatrix,
                    showFloatingTraffic,
                    showFloatingImage,
                    showFloatingConditions,
                    showFloatingVariables
                },
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
            setProjectModified(true); // active "Nouveau projet" dans le menu
            projectModifiedSkip.current = true; // absorbe setIntersectionName(savedName)
            setHasUnsavedChanges(false); // projet sauvegardé, pas de modifications

            // Sauvegarder aussi dans localStorage pour cohérence
            saveProject(savedName);

            toast.success(`Projet sauvegardé : ${savedName}`);

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                toast.error('Échec de la sauvegarde : ' + e.message);
            }
        }
    }, [recentSaveDirs, projectName, loadDirectoryHandle, saveDirectoryHandle, addRecentDirectory, getFullState, setIntersectionName, saveProject, recentOpenDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs,
        sidebarVisible, showComments, showRemarks, showActionDescription,
        showFloatingForm, showFloatingMatrix, showFloatingTraffic, showFloatingImage,
        showFloatingConditions, showFloatingVariables]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        handleOpenFileWithPicker,
        handleOpenFileFromRecentDir,
        handleSaveFileWithPicker,
        handleSaveFileToRecentDir
    };
};

export default useFileOperations;
