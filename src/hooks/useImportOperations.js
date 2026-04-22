import { importExcelFile } from '../utils/excelImporter';
import parseHTMFile from '../utils/parseHTMFile';
import { safeShowOpenFilePicker } from '../utils/filePicker';
import { toast } from '../utils/toast';

/**
 * Gère les opérations d'import de fichiers :
 * Excel (direct et depuis répertoire récent), CSV, et HTM.
 */
const useImportOperations = ({
    importFile, setImportFile, setImportError, setImportModal, setImportHintDir,
    htmFile, setHtmFile, setHtmImportError, importedHTMFiles, setImportedHTMFiles, setImportHTMModal,
    cycleLength, loadFullState, updateGroupParams,
    lastImportDirectoryRef,
    saveDirectoryHandle, loadDirectoryHandle,
    recentImportDirs, addRecentDirectory,
    addToRecentFiles
}) => {
    // Handle file selection (fallback modal)
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

            const [fileHandle] = await safeShowOpenFilePicker(options);
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

            toast.success(`Import réussi : ${importedData.groups.length} groupes, ${importedData.actionData.length} actions`);
            if (importedData.warnings && importedData.warnings.length > 0) {
                toast.info(`${importedData.warnings.length} avertissement(s) — voir console`);
                console.warn('Avertissements import :', importedData.warnings);
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur import Excel:', e);
                toast.error('Échec de l\'import : ' + e.message);
            }
        }
    };

    // Import Excel depuis un répertoire récent
    const handleImportExcelFromRecentDir = async (dirIndex) => {
        if (!window.showOpenFilePicker) {
            toast.error('API File System non supportée par ce navigateur');
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

            const [fileHandle] = await safeShowOpenFilePicker(options);
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

            toast.success(`Import réussi : ${importedData.groups.length} groupes, ${importedData.actionData.length} actions`);
            if (importedData.warnings && importedData.warnings.length > 0) {
                toast.info(`${importedData.warnings.length} avertissement(s) — voir console`);
                console.warn('Avertissements import :', importedData.warnings);
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur import Excel:', e);
                toast.error('Échec de l\'import : ' + e.message);
            }
        }
    };

    // Handle CSV/Excel import (fallback modal)
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
                toast.success(`Import réussi : ${importedData.groups.length} groupes, ${importedData.actionData.length} actions`);
                if (importedData.warnings && importedData.warnings.length > 0) {
                    toast.info(`${importedData.warnings.length} avertissement(s) — voir console`);
                    console.warn('Avertissements import :', importedData.warnings);
                }
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

    return {
        handleFileSelect,
        handleImportExcelDirect,
        handleImportExcelFromRecentDir,
        handleImport,
        handleHTMFileSelect,
        handleHTMImport
    };
};

export default useImportOperations;
