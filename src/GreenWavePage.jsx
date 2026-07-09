import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { safeShowSaveFilePicker, safeShowOpenFilePicker } from './utils/filePicker';
import usePopupWindow, { setMainModalActive } from './hooks/usePopupWindow';
import GreenWaveMenuBar from './components/GreenWaveMenuBar';
import CreateGreenWaveDialog from './components/CreateGreenWaveDialog';
import HelpContent from './components/HelpContent';
import Modal from './components/Modal';
import { useConfirm, useAlert } from './components/ConfirmProvider';
import { toast } from './utils/toast';
import { isInviteVisible, noteWelcomeView, noteProjectSeen } from './utils/welcomeInvite';
import { isExampleSession, exitExampleSession } from './utils/exampleMode';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from './version';
import './components/GreenWaveViewer.css';

// Synchronisation du thème de couleur avec l'application principale.
// Le thème est partagé via localStorage (clé 'colorTheme') ; on applique
// la classe correspondante au body au montage, et on écoute l'événement
// 'storage' pour suivre en direct les changements faits dans la fenêtre
// principale pendant que l'onglet onde verte est ouvert.
const THEME_CLASS_MAP = {
    light: 'light-mode',
    'high-contrast': 'high-contrast-mode',
    amber: 'amber-mode',
    daltonian: 'daltonian-mode',
    sepia: 'sepia-mode',
    'blue-night': 'blue-night-mode'
};
const ALL_THEME_CLASSES = Object.values(THEME_CLASS_MAP);

const applyThemeFromStorage = () => {
    const colorTheme = localStorage.getItem('colorTheme') || 'dark';
    document.body.classList.remove(...ALL_THEME_CLASSES);
    const cls = THEME_CLASS_MAP[colorTheme];
    if (cls) document.body.classList.add(cls);
};

const GreenWavePage = () => {
    const askConfirm = useConfirm();
    const showAlert = useAlert();
    useEffect(() => {
        applyThemeFromStorage();
        const onStorage = (e) => {
            if (e.key === 'colorTheme') applyThemeFromStorage();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const [intersections, setIntersections] = useState(null);
    // Sélecteur de projet pour le « + Ajouter un carrefour » du tableau des
    // données saisies. Modale React (l'ancien window.prompt natif était
    // invisible dans la popup détachée et bloqué en mode PWA installé).
    const [addCarrefourModalOpen, setAddCarrefourModalOpen] = useState(false);
    const [addCarrefourCandidates, setAddCarrefourCandidates] = useState([]);
    const [addCarrefourSelected, setAddCarrefourSelected] = useState(null);

    // Réclame le premier plan tant que la modale est ouverte : ramène la
    // fenêtre principale devant et suspend le retour-au-premier-plan des
    // fenêtres détachées, sinon la modale est masquée derrière la popup.
    useEffect(() => {
        setMainModalActive(addCarrefourModalOpen);
        return () => setMainModalActive(false);
    }, [addCarrefourModalOpen]);
    // Invitation « onde verte exemple » (cf. utils/welcomeInvite) — figée
    // au montage. Compteurs propres au module Onde verte.
    const [showExampleInvite] = useState(() => isInviteVisible('greenwave'));
    // Onde verte exemple : modifiable mais non enregistrable.
    const [gwIsExample, setGwIsExample] = useState(() => isExampleSession());
    const gwLeaveExample = useCallback(() => {
        if (isExampleSession()) { exitExampleSession(); setGwIsExample(false); }
    }, []);
    const gwWelcomeViewNoted = useRef(false);
    const gwProjectSeenNoted = useRef(false);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(8);
    const [pixelsPerMeter, setPixelsPerMeter] = useState(1);
    const [speedUp, setSpeedUp] = useState(50); // km/h - vitesse montante
    const [speedDown, setSpeedDown] = useState(50); // km/h - vitesse descendante
    const [greenWaveName, setGreenWaveName] = useState('');
    const [speedLineOffsetUp, setSpeedLineOffsetUp] = useState(0); // Offset horizontal ligne montante (en secondes)
    const [speedLineOffsetDown, setSpeedLineOffsetDown] = useState(0); // Offset horizontal ligne descendante (en secondes)
    const [dragging, setDragging] = useState(null); // 'up' ou 'down' ou null
    const [displayCycles, setDisplayCycles] = useState(2); // Number of cycles to display (2 or 3)
    const [showSpeedLines, setShowSpeedLines] = useState(true); // Affichage des lignes directrices
    // Parameters per PF (indexed by PF name): { pfName: { speedUp, speedDown, offsetUp, offsetDown } }
    const [pfParams, setPfParams] = useState({});
    // Nom du fichier d'origine sur disque (sans .json) — propagé depuis
    // l'app principale via sessionStorage, sert à pré-remplir la boîte de
    // dialogue « Enregistrer dans le réseau » avec le bon nom de fichier
    // (au cas où le greenWaveName interne diffère, ex. ancien fichier dont
    // le champ JSON name n'incluait pas le préfixe « Onde verte »).
    const [loadedFileName, setLoadedFileName] = useState('');
    // Modale « À propos » de la fenêtre Onde verte (équivalent simplifié
    // de la modale de l'app principale).
    const [showAboutModal, setShowAboutModal] = useState(false);
    // Modale de création d'une nouvelle onde verte directement dans la
    // fenêtre courante (réutilise CreateGreenWaveDialog de l'app principale).
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    // Modale « Restaurer un projet récent... » : liste des ondes vertes
    // présentes dans localStorage (alimenté par l'auto-save).
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoreList, setRestoreList] = useState([]);
    const [selectedRestoreName, setSelectedRestoreName] = useState(null);
    // Modale d'aide : on affiche le même composant HelpContent que l'app
    // principale, focalisé sur le chapitre Onde verte. Pas de nouvel onglet.
    const [showHelpModal, setShowHelpModal] = useState(false);
    // Suivi des modifications non sauvegardées (équivalent isDirty de l'app
    // principale). Devient true au premier changement utilisateur, repasse à
    // false sur sauvegarde, ouverture, création. Sert à demander confirmation
    // avant d'écraser le travail en cours.
    const [gwIsDirty, setGwIsDirty] = useState(false);
    // Garde-fou pour ignorer les changements de state pendant le chargement
    // (qui ne sont pas des modifications utilisateur).
    const isApplyingSettingsRef = useRef(false);

    // Détachement du tableau des données saisies dans une fenêtre popup
    // pour libérer l'espace écran sous le diagramme. Persisté en localStorage.
    const [showFloatingDataTable, setShowFloatingDataTable] = useState(() => {
        return localStorage.getItem('greenwave_floating_datatable') === 'true';
    });
    useEffect(() => {
        localStorage.setItem('greenwave_floating_datatable', String(showFloatingDataTable));
    }, [showFloatingDataTable]);
    const dataTablePopup = usePopupWindow({
        isOpen: showFloatingDataTable,
        onClose: () => setShowFloatingDataTable(false),
        title: 'Tableau des données saisies — Onde verte',
        width: 1260,
        height: 500
    });

    // Référence pour le dernier répertoire utilisé
    const lastGreenWaveDirectoryRef = useRef(null);

    // Fonctions IndexedDB pour sauvegarder/restaurer les handles de répertoire
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

    // Charger le dernier répertoire au démarrage
    useEffect(() => {
        const loadHandle = async () => {
            try {
                const greenWaveHandle = await loadDirectoryHandle('lastGreenWaveDirectory');
                if (greenWaveHandle) lastGreenWaveDirectoryRef.current = greenWaveHandle;
            } catch (e) {
                console.error('Erreur chargement handle:', e);
            }
        };
        loadHandle();
    }, [loadDirectoryHandle]);

    // Get current PF name from first intersection
    const getCurrentPfName = useCallback(() => {
        if (!intersections || intersections.length === 0) return 'PF1';
        const firstIntersection = intersections[0];
        const selectedPfId = firstIntersection.selectedPfId || 1;
        const selectedPf = firstIntersection.pfTabs?.find(pf => pf.id === selectedPfId);
        return selectedPf?.name || 'PF1';
    }, [intersections]);

    // Save current parameters to pfParams for current PF
    const saveCurrentPfParams = useCallback(() => {
        const pfName = getCurrentPfName();
        setPfParams(prev => ({
            ...prev,
            [pfName]: {
                speedUp,
                speedDown,
                offsetUp: speedLineOffsetUp,
                offsetDown: speedLineOffsetDown,
                showSpeedLines
            }
        }));
    }, [getCurrentPfName, speedUp, speedDown, speedLineOffsetUp, speedLineOffsetDown, showSpeedLines]);

    // Auto-save de l'onde verte dans localStorage (clé `savedGreenWaves[name]`).
    // Comportement aligné sur l'auto-save du module Diagramme de Feux :
    // - Ne déclenche pas tant qu'aucun nom n'est défini (pas de "Sans titre"
    //   qui pollue la liste « Restaurer un projet récent »).
    // - Skip si un chargement est en cours (isApplyingSettingsRef true).
    // - Debounce de 1,5 s : on n'écrit pas en localStorage à chaque keystroke.
    const autoSaveTimerRef = useRef(null);
    useEffect(() => {
        if (!intersections || intersections.length === 0) return;
        if (!greenWaveName) return;
        if (isApplyingSettingsRef.current) return;
        // Onde verte exemple : aucune persistance localStorage.
        if (isExampleSession()) return;

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            try {
                const greenWaveData = {
                    name: greenWaveName,
                    intersections,
                    speedUp,
                    speedDown,
                    speedLineOffsetUp,
                    speedLineOffsetDown,
                    showSpeedLines,
                    pfParams,
                    pixelsPerSecond,
                    pixelsPerMeter,
                    displayCycles,
                    savedAt: new Date().toISOString()
                };
                const savedGreenWaves = JSON.parse(localStorage.getItem('savedGreenWaves') || '{}');
                savedGreenWaves[greenWaveName] = greenWaveData;
                localStorage.setItem('savedGreenWaves', JSON.stringify(savedGreenWaves));
            } catch (e) {
                console.error('Auto-save onde verte a échoué', e);
            }
        }, 1500);

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [intersections, greenWaveName, speedUp, speedDown, speedLineOffsetUp, speedLineOffsetDown, showSpeedLines, pfParams, pixelsPerSecond, pixelsPerMeter, displayCycles]);

    // Ouverture de la modale « Restaurer un projet récent ». Lit les ondes
    // vertes présentes dans `localStorage.savedGreenWaves`, filtre celles
    // qui n'ont pas la signature attendue (champ intersections), trie par
    // date de sauvegarde décroissante.
    const openRestoreModal = () => {
        try {
            const raw = localStorage.getItem('savedGreenWaves');
            const all = raw ? JSON.parse(raw) : {};
            const validEntries = Object.entries(all)
                .filter(([, data]) => data && Array.isArray(data.intersections))
                .map(([name, data]) => ({ name, savedAt: data.savedAt, count: data.intersections.length }))
                .sort((a, b) => {
                    const dA = a.savedAt ? new Date(a.savedAt) : new Date(0);
                    const dB = b.savedAt ? new Date(b.savedAt) : new Date(0);
                    return dB - dA;
                });
            setRestoreList(validEntries);
            setSelectedRestoreName(null);
            setShowRestoreModal(true);
        } catch (e) {
            console.error('Failed to read savedGreenWaves', e);
            showAlert({ title: 'Erreur', message: "Impossible de lire la liste des ondes vertes récentes." });
        }
    };

    // Chargement d'une onde verte depuis la liste « Restaurer un projet récent ».
    // Demande confirmation si la session courante a des modifications non
    // sauvegardées, puis applique les settings et restaure les intersections.
    const handleRestoreSelected = async (name) => {
        try {
            const raw = localStorage.getItem('savedGreenWaves');
            const all = raw ? JSON.parse(raw) : {};
            const data = all[name];
            if (!data || !Array.isArray(data.intersections)) {
                showAlert({ title: 'Entrée invalide', message: "Cet enregistrement n'est pas une onde verte exploitable." });
                return;
            }
            if (gwIsDirty) {
                const ok = await askConfirm({
                    title: 'Modifications non enregistrées',
                    message: "L'onde verte courante a des modifications non enregistrées qui seront perdues.\n\nContinuer et restaurer le projet sélectionné ?",
                    confirmLabel: 'Continuer',
                    danger: true,
                });
                if (!ok) return;
            }
            setShowRestoreModal(false);
            gwLeaveExample(); // restaurer un projet : on quitte l'exemple
            isApplyingSettingsRef.current = true;
            setIntersections(data.intersections);
            applySettings(data);
        } catch (e) {
            console.error('Restore failed', e);
            showAlert({ title: 'Erreur de restauration', message: `Erreur lors de la restauration : ${e.message}` });
        }
    };

    // JSX de la modale « Restaurer un projet récent » (réutilisée dans
    // l'écran d'accueil et la fenêtre principale Onde verte).
    const renderRestoreModal = () => {
        if (!showRestoreModal) return null;
        const formatDate = (iso) => {
            if (!iso) return '—';
            try {
                return new Date(iso).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } catch {
                return '—';
            }
        };
        return (
            <div className="gw-about-overlay" onClick={() => setShowRestoreModal(false)}>
                <div className="gw-about-modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: '500px', maxWidth: '700px' }}>
                    <h3 style={{ margin: '0 0 12px 0', color: '#4ecdc4' }}>Restaurer un projet récent</h3>
                    {restoreList.length === 0 ? (
                        <div style={{ color: '#aaa', padding: '20px', textAlign: 'center' }}>
                            Aucune onde verte sauvegardée dans le cache navigateur.
                        </div>
                    ) : (
                        <div style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid #555', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                                <thead>
                                    <tr style={{ background: '#444', color: '#eee' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Nom</th>
                                        <th style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Carrefours</th>
                                        <th style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Modifié le</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {restoreList.map((entry) => (
                                        <tr
                                            key={entry.name}
                                            onClick={() => setSelectedRestoreName(entry.name)}
                                            onDoubleClick={() => handleRestoreSelected(entry.name)}
                                            style={{
                                                background: selectedRestoreName === entry.name ? '#3a5d6a' : 'transparent',
                                                color: '#e0e0e0',
                                                cursor: 'pointer',
                                                borderTop: '1px solid #444'
                                            }}
                                        >
                                            <td style={{ padding: '6px 8px' }}>{entry.name}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{entry.count}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: '#aaa' }}>{formatDate(entry.savedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                        <button
                            onClick={() => setShowRestoreModal(false)}
                            style={{ background: '#555', color: '#fff', border: '1px solid #666', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => selectedRestoreName && handleRestoreSelected(selectedRestoreName)}
                            disabled={!selectedRestoreName}
                            style={{
                                background: selectedRestoreName ? '#4ecdc4' : '#3a3a3a',
                                color: selectedRestoreName ? '#1e1e1e' : '#666',
                                border: '1px solid ' + (selectedRestoreName ? '#3aaca4' : '#444'),
                                padding: '6px 16px',
                                borderRadius: '4px',
                                cursor: selectedRestoreName ? 'pointer' : 'not-allowed',
                                fontWeight: 'bold'
                            }}
                        >
                            Restaurer
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Save green wave data to file system (network)
    const handleSaveGreenWaveToFile = async () => {
        if (!intersections) return;
        // Onde verte exemple : non enregistrable (l'entrée de menu est
        // déjà grisée — filet de sécurité pour les autres déclencheurs).
        if (isExampleSession()) {
            toast.info('Onde verte exemple : non enregistrable. Faites « Fichier → Nouveau » pour démarrer la vôtre.');
            return;
        }

        if (!window.showSaveFilePicker) {
            showAlert({ title: 'Navigateur non compatible', message: 'Votre navigateur ne supporte pas la sauvegarde de fichiers (File System Access API). Le cache navigateur est mis à jour automatiquement, mais l\'export en fichier .json n\'est pas disponible sur ce navigateur.' });
            return;
        }

        // Save current PF params before saving
        const currentPfName = getCurrentPfName();
        const updatedPfParams = {
            ...pfParams,
            [currentPfName]: {
                speedUp,
                speedDown,
                offsetUp: speedLineOffsetUp,
                offsetDown: speedLineOffsetDown,
                showSpeedLines
            }
        };
        setPfParams(updatedPfParams);

        // Allège l'export : retire les matrices d'intervert (jamais lues par
        // l'onde verte, cf. handleSyncGreenWave) et les lignes d'action
        // entièrement vides. On transforme une COPIE — les données en mémoire
        // restent complètes, seul le fichier exporté est réduit.
        const isEmptyActionRow = (r) => !r || (
            !r.gf && !r.action && !r.description && !r.deb && !r.fin &&
            !r.abrv && !r.micro && !r.plage1 && !r.plage2 &&
            !r.actGf1 && !r.actGf1Gf2 && !r.actGf1Gf3 && !r.actGf1Gf4
        );
        const slimActions = (arr) => Array.isArray(arr) ? arr.filter(r => !isEmptyActionRow(r)) : arr;
        const slimIntersections = intersections.map(it => {
            const copy = { ...it, actionData: slimActions(it.actionData) };
            if (Array.isArray(it.pfTabs)) {
                copy.pfTabs = it.pfTabs.map(pf => {
                    const pfCopy = { ...pf, data: slimActions(pf.data) };
                    delete pfCopy.conflictMatrix;
                    return pfCopy;
                });
            }
            return copy;
        });

        const greenWaveData = {
            name: greenWaveName || 'Onde verte',
            intersections: slimIntersections,
            speedUp,
            speedDown,
            speedLineOffsetUp,
            speedLineOffsetDown,
            showSpeedLines,
            pfParams: updatedPfParams,
            pixelsPerSecond,
            pixelsPerMeter,
            displayCycles,
            savedAt: new Date().toISOString()
        };

        try {
            // Priorité au nom du fichier d'origine pour préserver le
            // préfixe « Onde verte - » qui peut différer du greenWaveName
            // interne (cas des anciens fichiers où JSON.name était stocké
            // sans le préfixe alors que le fichier sur disque le contenait).
            const suggestedFileName = loadedFileName || greenWaveName || 'onde_verte';
            const options = {
                suggestedName: `${suggestedFileName}.json`,
                types: [{
                    description: 'Fichier Onde Verte JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            };

            // Utiliser le dernier répertoire si disponible
            if (lastGreenWaveDirectoryRef.current) {
                options.startIn = lastGreenWaveDirectoryRef.current;
            }

            const fileHandle = await safeShowSaveFilePicker(options);

            // Write the file
            const jsonContent = JSON.stringify(greenWaveData, null, 2);
            const writable = await fileHandle.createWritable();
            await writable.write(jsonContent);
            await writable.close();

            // Vérifier que le fichier n'est pas vide après sauvegarde
            try {
                const savedFile = await fileHandle.getFile();
                const savedContent = await savedFile.text();
                if (!savedContent || savedContent.trim() === '') {
                    showAlert({ title: 'Sauvegarde vide', message: 'Attention : le fichier semble vide après la sauvegarde.\n\nVeuillez réessayer.' });
                    return;
                }
            } catch (verifyError) {
                console.warn('Impossible de vérifier le fichier sauvegardé:', verifyError);
            }

            // Mémoriser le répertoire parent
            try {
                const dirHandle = await fileHandle.getParent?.();
                if (dirHandle) {
                    lastGreenWaveDirectoryRef.current = dirHandle;
                    await saveDirectoryHandle('lastGreenWaveDirectory', dirHandle);
                }
            } catch (e) {
                // getParent n'est pas toujours disponible
            }

            // Synchronise le titre affiché sur le nom du fichier sauvegardé :
            // c'est le comportement attendu après un « Enregistrer sous » avec
            // renommage. Au passage, on purge l'éventuelle entrée localStorage
            // de l'ancien nom pour éviter d'avoir un doublon (ancien + nouveau)
            // dans la liste des ondes vertes sauvegardées.
            const savedName = fileHandle.name.replace(/\.json$/i, '');
            const previousName = greenWaveName;
            setGreenWaveName(savedName);
            if (previousName && previousName !== savedName) {
                try {
                    const cache = JSON.parse(localStorage.getItem('savedGreenWaves') || '{}');
                    if (cache[previousName]) {
                        delete cache[previousName];
                        localStorage.setItem('savedGreenWaves', JSON.stringify(cache));
                    }
                } catch { /* ignore */ }
            }
            // Mémorise le nouveau nom de fichier (au cas où l'utilisateur
            // l'a modifié dans la boîte de dialogue) pour que la prochaine
            // sauvegarde le re-suggère.
            setLoadedFileName(savedName);
            setGwIsDirty(false);

            toast.success(`Onde verte enregistrée dans « ${fileHandle.name} »`);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                showAlert({ title: 'Erreur de sauvegarde', message: 'Erreur lors de la sauvegarde du fichier : ' + e.message });
            }
        }
    };

    // Synchronise les données de l'onde verte depuis les projets sauvegardés.
    // Unidirectionnel : projets -> onde verte. Seuls les projets encore présents
    // dans le cache localStorage peuvent être rafraîchis (cf. MAX_CACHED_PROJECTS).
    const handleSyncGreenWave = () => {
        if (!intersections) return;

        const synced = [];
        const notSynced = [];
        const updatedIntersections = intersections.map(intersection => {
            // Try to load project data from localStorage
            const projectKey = `traffic_project_${intersection.projectName}`;
            const projectRaw = localStorage.getItem(projectKey);

            if (projectRaw) {
                try {
                    const projectData = JSON.parse(projectRaw);
                    if (projectData.groups) {
                        // Get pfTabs and actionData from the selected plan de feu
                        const pfTabs = projectData.pfTabs || [{ id: 1, name: 'PF1', data: [] }];
                        const selectedPfId = intersection.selectedPfId || pfTabs[0]?.id || 1;
                        const selectedPf = pfTabs.find(pf => pf.id === selectedPfId);

                        // Use PF-specific cycleLength if available
                        const pfCycleLength = selectedPf?.cycleLength || projectData.cycleLength || intersection.cycleLength;

                        // Update groups with PF-specific diagram data (offset and green durations)
                        let updatedGroups = projectData.groups;
                        if (selectedPf?.diagram && Array.isArray(selectedPf.diagram)) {
                            updatedGroups = projectData.groups.map(group => {
                                const diagramEntry = selectedPf.diagram.find(d => d.groupId === group.id);
                                if (diagramEntry) {
                                    return {
                                        ...group,
                                        offset: diagramEntry.offset ?? group.offset,
                                        durations: {
                                            ...group.durations,
                                            green: diagramEntry.greenDuration ?? group.durations?.green
                                        }
                                    };
                                }
                                return group;
                            });
                        }

                        synced.push(intersection.projectName);
                        return {
                            ...intersection,
                            groups: updatedGroups,
                            cycleLength: pfCycleLength,
                            pfTabs: pfTabs,
                            actionData: selectedPf?.data || []
                        };
                    }
                } catch (e) {
                    console.error(`Failed to sync project ${intersection.projectName}`, e);
                }
            }
            notSynced.push(intersection.projectName);
            return intersection;
        });

        setIntersections(updatedIntersections);

        // Fenêtre récapitulative : carrefours synchronisés / non synchronisés + limite
        const lines = [];
        if (synced.length > 0) {
            lines.push(`${synced.length} carrefour(s) synchronisé(s) :`);
            synced.forEach(name => lines.push(`  - ${name}`));
        }
        if (notSynced.length > 0) {
            if (lines.length) lines.push('');
            lines.push(`${notSynced.length} carrefour(s) non synchronisé(s) :`);
            notSynced.forEach(name => lines.push(`  - ${name}`));
            lines.push('');
            lines.push("Ces carrefours n'ont pas de projet disponible dans le cache du navigateur : seuls les projets récemment ouverts ou enregistrés y sont conservés. Pour les rafraîchir, ouvrez puis enregistrez leur projet dans le module principal, puis relancez la synchronisation.");
        }
        if (lines.length === 0) {
            lines.push('Aucun carrefour à synchroniser.');
        }

        showAlert({ title: "Synchronisation de l'onde verte", message: lines.join('\n') });
    };

    // Appliquer les settings chargés. Pendant l'application, le flag
    // isApplyingSettingsRef neutralise la détection de modifications pour
    // éviter que le chargement ne fasse passer gwIsDirty à true.
    const applySettings = useCallback((settings) => {
        if (!settings) return;
        isApplyingSettingsRef.current = true;
        if (settings.name) setGreenWaveName(settings.name);
        if (settings.speedUp) setSpeedUp(settings.speedUp);
        else if (settings.speed) setSpeedUp(settings.speed);
        if (settings.speedDown) setSpeedDown(settings.speedDown);
        else if (settings.speed) setSpeedDown(settings.speed);
        if (settings.pixelsPerSecond) setPixelsPerSecond(settings.pixelsPerSecond);
        if (settings.pixelsPerMeter) setPixelsPerMeter(settings.pixelsPerMeter);
        if (settings.speedLineOffsetUp !== undefined) setSpeedLineOffsetUp(settings.speedLineOffsetUp);
        if (settings.speedLineOffsetDown !== undefined) setSpeedLineOffsetDown(settings.speedLineOffsetDown);
        if (settings.showSpeedLines !== undefined) setShowSpeedLines(settings.showSpeedLines);
        if (settings.pfParams) setPfParams(settings.pfParams);
        if (settings.displayCycles) setDisplayCycles(settings.displayCycles);
        if (settings.loadedFileName) setLoadedFileName(settings.loadedFileName);
        if (settings.name) {
            // Évite le double préfixe « Onde Verte » dans le titre de l'onglet :
            // si le nom enregistré commence déjà par « onde verte » (insensible
            // à la casse, espaces et tirets initiaux), on l'affiche tel quel ;
            // sinon on ajoute le préfixe pour le contexte.
            const nameLower = settings.name.toLowerCase().trimStart();
            const startsWithPrefix = /^ondes?\s*vertes?\b/.test(nameLower);
            document.title = startsWithPrefix
                ? settings.name
                : `Onde Verte - ${settings.name}`;
        }
        // À la fin de l'application des settings, relâche le garde-fou et
        // marque le projet comme propre. setTimeout 0 pour laisser React
        // batcher les setState et le useEffect dépendant s'exécuter avant.
        setTimeout(() => {
            isApplyingSettingsRef.current = false;
            setGwIsDirty(false);
        }, 0);
    }, []);

    // Détection des modifications non sauvegardées : à chaque changement d'un
    // état surveillé (et hors période de chargement applySettings), on bascule
    // gwIsDirty à true. La remise à false se fait dans handleSaveGreenWaveToFile,
    // applySettings, handleCreateGreenWaveLocal.
    useEffect(() => {
        if (isApplyingSettingsRef.current) return;
        if (intersections === null) return; // pas encore de projet chargé
        setGwIsDirty(true);
    }, [intersections, speedUp, speedDown, speedLineOffsetUp, speedLineOffsetDown,
        pixelsPerSecond, pixelsPerMeter, displayCycles, showSpeedLines, pfParams]);

    // Load data on mount — sessionStorage par défaut, IndexedDB si &idb=1
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const greenWaveId = urlParams.get('id');
        if (!greenWaveId) {
            // Lancement du module sans projet pré-chargé : titre minimal
            // pour l'écran d'accueil. Sera remplacé par « Onde Verte - <nom> »
            // dès qu'un projet est chargé via Fichier > Nouveau ou Ouvrir.
            document.title = 'Onde verte';
            return;
        }

        const useIDB = urlParams.has('idb');

        if (!useIDB) {
            // Lecture depuis sessionStorage
            const savedData = sessionStorage.getItem(`greenwave_${greenWaveId}`);
            if (savedData) {
                try {
                    const data = JSON.parse(savedData);
                    setIntersections(data);
                    document.title = `Onde Verte - ${data.length} carrefours`;
                } catch (e) {
                    console.error('Failed to load green wave data', e);
                }
            }
            const savedSettings = sessionStorage.getItem(`greenwave_settings_${greenWaveId}`);
            if (savedSettings) {
                try {
                    applySettings(JSON.parse(savedSettings));
                } catch (e) {
                    console.error('Failed to load green wave settings', e);
                }
            }
        } else {
            // Lecture depuis IndexedDB (fallback gros fichiers)
            const loadFromIDB = async () => {
                try {
                    const db = await new Promise((resolve, reject) => {
                        const request = indexedDB.open('DiagrammeFeux_GreenWave', 1);
                        request.onerror = () => reject(request.error);
                        request.onsuccess = () => resolve(request.result);
                        request.onupgradeneeded = (event) => {
                            const db2 = event.target.result;
                            if (!db2.objectStoreNames.contains('data')) {
                                db2.createObjectStore('data');
                            }
                        };
                    });

                    const getData = (key) => new Promise((resolve, reject) => {
                        const tx = db.transaction(['data'], 'readonly');
                        const store = tx.objectStore('data');
                        const req = store.get(key);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });

                    const deleteData = (key) => new Promise((resolve, reject) => {
                        const tx = db.transaction(['data'], 'readwrite');
                        const store = tx.objectStore('data');
                        const req = store.delete(key);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                    });

                    const data = await getData(`greenwave_${greenWaveId}`);
                    if (data) {
                        setIntersections(data);
                        document.title = `Onde Verte - ${data.length} carrefours`;
                    }

                    const settings = await getData(`greenwave_settings_${greenWaveId}`);
                    if (settings) applySettings(settings);

                    await deleteData(`greenwave_${greenWaveId}`);
                    await deleteData(`greenwave_settings_${greenWaveId}`);
                } catch (e) {
                    console.error('Failed to load green wave data from IndexedDB', e);
                }
            };
            loadFromIDB();
        }
    }, [applySettings]);

    // Calculate the maximum values for axes
    const { maxTime, minDistance, maxDistance, cycleLength } = useMemo(() => {
        if (!intersections || intersections.length === 0) {
            return { maxTime: 100, minDistance: 0, maxDistance: 500, cycleLength: 100 };
        }

        // On considère les deux colonnes (distance + distanceG2 pour le bi-carrefour).
        // 0 reste toujours dans la fenêtre d'affichage (repère central pour l'axe),
        // et on ajoute 50 m de respiration en haut comme en bas si négatif.
        const allDistances = intersections.flatMap(i => [i.distance, i.distanceG2 ?? i.distance]);
        const minDist = Math.min(0, ...allDistances);
        const maxDist = Math.max(...allDistances);
        const cycle = intersections[0]?.cycleLength || 100;

        return {
            maxTime: cycle * displayCycles, // Show 2 or 3 cycles
            minDistance: minDist < 0 ? minDist - 50 : 0,
            maxDistance: maxDist + 50,
            cycleLength: cycle
        };
    }, [intersections, displayCycles]);


    // Bornes des distances de carrefour : [-9999 ; +9999] m. Les valeurs
    // négatives permettent de placer des carrefours au sud d'un point 0
    // (carrefour central par ex.) sans devoir décaler tous les existants.
    const DISTANCE_MIN = -9999;
    const DISTANCE_MAX = 9999;
    const clampDistance = (value) => {
        const n = parseInt(value);
        if (isNaN(n)) return 0;
        return Math.max(DISTANCE_MIN, Math.min(DISTANCE_MAX, n));
    };

    // Brouillons de saisie des champs distance : permet à l'utilisateur de
    // taper "-" puis les chiffres sans que la chaîne intermédiaire (invalide
    // côté nombre) écrase la valeur du modèle à 0. Clé : `${idx}.g1|g2`.
    // L'entrée est vidée au blur (commit) ; à ce moment, l'input réaffiche la
    // valeur clampée du modèle.
    const [distanceDrafts, setDistanceDrafts] = useState({});

    // Surbrillance dirigée tableau → barre uniquement : hover sur les cellules
    // GF montant / GF descendant du tableau met en valeur la barre correspondante
    // (toutes ses répétitions de cycle) dans le diagramme. Le sens inverse
    // (hover barre → cellules) n'est pas géré car la zone de drag transparente
    // des bandes passantes intercepte le hover des barres quand elles se croisent.
    // Shape : { idx, direction: 'M' | 'D' } ou null.
    const [hoveredOndeVerteCell, setHoveredOndeVerteCell] = useState(null);
    const isOndeVerteHovered = (idx, direction) =>
        hoveredOndeVerteCell?.idx === idx && hoveredOndeVerteCell?.direction === direction;

    // Update intersection distance for group 1
    const updateDistance = (intersectionIdx, value) => {
        setDistanceDrafts(prev => ({ ...prev, [`${intersectionIdx}.g1`]: value }));
        const n = parseInt(value);
        if (!isNaN(n)) {
            setIntersections(prev => {
                const updated = [...prev];
                updated[intersectionIdx] = { ...updated[intersectionIdx], distance: clampDistance(value) };
                return updated;
            });
        }
    };

    // Update intersection distance for group 2
    const updateDistanceG2 = (intersectionIdx, value) => {
        setDistanceDrafts(prev => ({ ...prev, [`${intersectionIdx}.g2`]: value }));
        const n = parseInt(value);
        if (!isNaN(n)) {
            setIntersections(prev => {
                const updated = [...prev];
                updated[intersectionIdx] = { ...updated[intersectionIdx], distanceG2: clampDistance(value) };
                return updated;
            });
        }
    };

    // Au blur, retire le brouillon : l'input réaffiche alors la valeur clampée
    // du modèle (les valeurs invalides — "-" seul, "" — laissent le modèle inchangé).
    const commitDistanceDraft = (intersectionIdx, which) => {
        setDistanceDrafts(prev => {
            const next = { ...prev };
            delete next[`${intersectionIdx}.${which}`];
            return next;
        });
    };

    // Update selected plan de feu for an intersection
    // Also reloads groups, cycleLength and green durations from the saved project
    const updateSelectedPf = (intersectionIdx, pfId) => {
        setIntersections(prev => {
            const updated = [...prev];
            const intersection = updated[intersectionIdx];

            // Try to load fresh data from the saved project
            const projectKey = `traffic_project_${intersection.projectName}`;
            const projectRaw = localStorage.getItem(projectKey);

            let newGroups = intersection.groups;
            let newCycleLength = intersection.cycleLength;
            let newPfTabs = intersection.pfTabs;

            if (projectRaw) {
                try {
                    const projectData = JSON.parse(projectRaw);
                    if (projectData.groups) {
                        newGroups = projectData.groups;
                    }
                    if (projectData.cycleLength) {
                        newCycleLength = projectData.cycleLength;
                    }
                    if (projectData.pfTabs) {
                        newPfTabs = projectData.pfTabs;
                    }
                } catch (e) {
                    console.error(`Failed to load project data for ${intersection.projectName}`, e);
                }
            }

            const selectedPf = newPfTabs?.find(pf => pf.id === pfId);

            // Use PF-specific cycleLength if available, otherwise fallback to project cycleLength
            const pfCycleLength = selectedPf?.cycleLength || newCycleLength;

            // Update groups with PF-specific diagram data (offset and green durations)
            let updatedGroups = newGroups;
            if (selectedPf?.diagram && Array.isArray(selectedPf.diagram)) {
                updatedGroups = newGroups.map(group => {
                    const diagramEntry = selectedPf.diagram.find(d => d.groupId === group.id);
                    if (diagramEntry) {
                        return {
                            ...group,
                            offset: diagramEntry.offset ?? group.offset,
                            durations: {
                                ...group.durations,
                                green: diagramEntry.greenDuration ?? group.durations?.green
                            }
                        };
                    }
                    return group;
                });
            }

            updated[intersectionIdx] = {
                ...intersection,
                selectedPfId: pfId,
                groups: updatedGroups,
                cycleLength: pfCycleLength,
                pfTabs: newPfTabs,
                actionData: selectedPf?.data || []
            };
            return updated;
        });
    };

    // Update selected group 1 (descendant) for an intersection
    const updateSelectedGroup1 = (intersectionIdx, groupId) => {
        setIntersections(prev => {
            const updated = [...prev];
            updated[intersectionIdx] = { ...updated[intersectionIdx], selectedGroup1: groupId };
            return updated;
        });
    };

    // Update selected group 2 (montant) for an intersection
    const updateSelectedGroup2 = (intersectionIdx, groupId) => {
        setIntersections(prev => {
            const updated = [...prev];
            updated[intersectionIdx] = { ...updated[intersectionIdx], selectedGroup2: groupId };
            return updated;
        });
    };

    // Change PF for all intersections based on a reference PF
    // Tries to match by name first, then by cycle length
    const handleGlobalPfChange = (referencePfId) => {
        if (!intersections || intersections.length === 0) return;

        const firstIntersection = intersections[0];
        const referencePf = firstIntersection.pfTabs?.find(pf => pf.id === referencePfId);
        if (!referencePf) return;

        // Save current PF params before switching
        const currentPfName = getCurrentPfName();
        const updatedPfParams = {
            ...pfParams,
            [currentPfName]: {
                speedUp,
                speedDown,
                offsetUp: speedLineOffsetUp,
                offsetDown: speedLineOffsetDown,
                showSpeedLines
            }
        };
        setPfParams(updatedPfParams);

        const referencePfName = referencePf.name;
        const referenceCycleLength = referencePf.cycleLength || firstIntersection.cycleLength;

        // Load params for the new PF (if they exist)
        const newPfParamsData = updatedPfParams[referencePfName];
        if (newPfParamsData) {
            setSpeedUp(newPfParamsData.speedUp ?? 50);
            setSpeedDown(newPfParamsData.speedDown ?? 50);
            setSpeedLineOffsetUp(newPfParamsData.offsetUp ?? 0);
            setSpeedLineOffsetDown(newPfParamsData.offsetDown ?? 0);
            setShowSpeedLines(newPfParamsData.showSpeedLines ?? true);
        } else {
            // Reset to defaults if no saved params for this PF
            setSpeedLineOffsetUp(0);
            setSpeedLineOffsetDown(0);
            setShowSpeedLines(true);
        }

        setIntersections(prev => {
            return prev.map((intersection, idx) => {
                // Load fresh data from localStorage for this intersection
                const projectKey = `traffic_project_${intersection.projectName}`;
                const projectRaw = localStorage.getItem(projectKey);

                let newGroups = intersection.groups;
                let newCycleLength = intersection.cycleLength;
                let newPfTabs = intersection.pfTabs;

                if (projectRaw) {
                    try {
                        const projectData = JSON.parse(projectRaw);
                        if (projectData.groups) {
                            newGroups = projectData.groups;
                        }
                        if (projectData.cycleLength) {
                            newCycleLength = projectData.cycleLength;
                        }
                        if (projectData.pfTabs) {
                            newPfTabs = projectData.pfTabs;
                        }
                    } catch (e) {
                        console.error(`Failed to load project data for ${intersection.projectName}`, e);
                    }
                }

                // Find matching PF: first by name, then by cycle length
                let matchingPf = newPfTabs?.find(pf => pf.name === referencePfName);

                if (!matchingPf) {
                    // Try to find first PF with matching cycle length
                    matchingPf = newPfTabs?.find(pf => {
                        const pfCycle = pf.cycleLength || newCycleLength;
                        return pfCycle === referenceCycleLength;
                    });
                }

                // Fallback to first PF if no match found
                if (!matchingPf && newPfTabs?.length > 0) {
                    matchingPf = newPfTabs[0];
                }

                const selectedPfId = matchingPf?.id || 1;
                const selectedPf = newPfTabs?.find(pf => pf.id === selectedPfId);

                // Use PF-specific cycleLength if available
                const pfCycleLength = selectedPf?.cycleLength || newCycleLength;

                // Update groups with PF-specific diagram data
                let updatedGroups = newGroups;
                if (selectedPf?.diagram && Array.isArray(selectedPf.diagram)) {
                    updatedGroups = newGroups.map(group => {
                        const diagramEntry = selectedPf.diagram.find(d => d.groupId === group.id);
                        if (diagramEntry) {
                            return {
                                ...group,
                                offset: diagramEntry.offset ?? group.offset,
                                durations: {
                                    ...group.durations,
                                    green: diagramEntry.greenDuration ?? group.durations?.green
                                }
                            };
                        }
                        return group;
                    });
                }

                return {
                    ...intersection,
                    selectedPfId: selectedPfId,
                    groups: updatedGroups,
                    cycleLength: pfCycleLength,
                    pfTabs: newPfTabs,
                    actionData: selectedPf?.data || []
                };
            });
        });
    };

    // Charge un projet par son nom et l'ajoute comme nouveau carrefour à
    // l'onde verte. Sortie : appelé soit depuis la modale de sélection, soit
    // (futur) depuis tout autre déclencheur.
    const addIntersectionFromProject = (selectedProject) => {
        if (!selectedProject) return;
        const projectKey = `traffic_project_${selectedProject}`;
        const projectRaw = localStorage.getItem(projectKey);
        if (!projectRaw) {
            showAlert({ title: 'Chargement impossible', message: `Impossible de charger le projet « ${selectedProject} ».` });
            return;
        }

        try {
            const projectData = JSON.parse(projectRaw);
            const pfTabs = projectData.pfTabs || [{ id: 1, name: 'PF1', data: [] }];
            const selectedPfId = pfTabs[0]?.id || 1;
            const selectedPf = pfTabs.find(pf => pf.id === selectedPfId);
            const pfCycleLength = selectedPf?.cycleLength || projectData.cycleLength || 90;

            // Get groups with PF-specific data if available
            let groups = projectData.groups || [];
            if (selectedPf?.diagram && Array.isArray(selectedPf.diagram)) {
                groups = groups.map(group => {
                    const diagramEntry = selectedPf.diagram.find(d => d.groupId === group.id);
                    if (diagramEntry) {
                        return {
                            ...group,
                            offset: diagramEntry.offset ?? group.offset,
                            durations: {
                                ...group.durations,
                                green: diagramEntry.greenDuration ?? group.durations?.green
                            }
                        };
                    }
                    return group;
                });
            }

            // Calculate default distance (last intersection distance + 100m or 0)
            const lastDistance = intersections?.length > 0
                ? Math.max(...intersections.map(i => i.distance))
                : 0;
            const newDistance = lastDistance + 100;

            // Create new intersection object
            const newIntersection = {
                projectName: selectedProject,
                groups: groups,
                cycleLength: pfCycleLength,
                pfTabs: pfTabs,
                selectedPfId: selectedPfId,
                selectedGroup1: groups[0]?.id || 1,
                selectedGroup2: groups[0]?.id || 1,
                distance: newDistance,
                distanceG2: newDistance,
                actionData: selectedPf?.data || []
            };

            setIntersections(prev => [...(prev || []), newIntersection]);
        } catch (e) {
            console.error('Failed to load project data', e);
            showAlert({ title: 'Erreur de chargement', message: `Erreur lors du chargement du projet « ${selectedProject} ».` });
        }
    };

    // Add a new intersection from saved projects — ouvre la modale de
    // sélection. Filtre proprement les clés localStorage (exclusion des
    // _backup et de la clé d'ordre).
    const addIntersection = () => {
        const availableProjects = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('traffic_project_')) continue;
            if (key.endsWith('_backup') || key === 'traffic_project_order') continue;
            availableProjects.push(key.replace('traffic_project_', ''));
        }

        // Sort by saved order if available
        const orderRaw = localStorage.getItem('traffic_project_order');
        if (orderRaw) {
            try {
                const order = JSON.parse(orderRaw);
                availableProjects.sort((a, b) => {
                    const idxA = order.indexOf(a);
                    const idxB = order.indexOf(b);
                    if (idxA === -1 && idxB === -1) return 0;
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            } catch (e) {
                // ignore
            }
        }

        if (availableProjects.length === 0) {
            showAlert({ title: 'Aucun projet', message: 'Aucun projet sauvegardé disponible.' });
            return;
        }

        setAddCarrefourCandidates(availableProjects);
        setAddCarrefourSelected(availableProjects[0]);
        setAddCarrefourModalOpen(true);
    };

    // Confirme la sélection depuis la modale.
    const confirmAddCarrefour = (name) => {
        const target = name || addCarrefourSelected;
        setAddCarrefourModalOpen(false);
        setAddCarrefourSelected(null);
        addIntersectionFromProject(target);
    };

    // Move intersection up or down in the list
    const moveIntersection = (index, direction) => {
        setIntersections(prev => {
            if (!prev) return prev;
            const newList = [...prev].map(item => ({ ...item }));
            const targetIndex = direction === 'up' ? index - 1 : index + 1;

            if (targetIndex < 0 || targetIndex >= newList.length) return prev;

            // Swap intersections (each keeps its own distance)
            [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
            return newList;
        });
    };

    // Calculate speed line slope (meters per second)
    const speedUpMps = (speedUp * 1000) / 3600; // Convert km/h to m/s - ascending
    const speedDownMps = (speedDown * 1000) / 3600; // Convert km/h to m/s - descending

    const PADDING_LEFT = 260;
    const PADDING_BOTTOM = 50;
    const PADDING_TOP = 20;
    const PADDING_RIGHT = 20;

    const diagramWidth = maxTime * pixelsPerSecond + PADDING_LEFT + PADDING_RIGHT;
    const diagramHeight = (maxDistance - minDistance) * pixelsPerMeter + PADDING_TOP + PADDING_BOTTOM;

    // Convert coordinates : Y est mesuré depuis le bas du diagramme, où se
    // trouve la distance minimale (négative possible).
    const timeToX = (time) => PADDING_LEFT + time * pixelsPerSecond;
    const distanceToY = (distance) => diagramHeight - PADDING_BOTTOM - (distance - minDistance) * pixelsPerMeter;

    // Generate axis ticks
    const timeTicks = [];
    const timeStep = cycleLength >= 60 ? 10 : 5;
    for (let t = 0; t <= maxTime; t += timeStep) {
        timeTicks.push(t);
    }

    const distanceTicks = [];
    const distanceSpan = maxDistance - minDistance;
    const distanceStep = distanceSpan > 500 ? 100 : 50;
    // Graduation arrondie au pas inférieur pour démarrer proprement (ex. -180 → -200).
    const firstTick = Math.floor(minDistance / distanceStep) * distanceStep;
    for (let d = firstTick; d <= maxDistance; d += distanceStep) {
        distanceTicks.push(d);
    }

    // Calculate bandwidth corridors (ascending and descending)
    const bandwidthData = useMemo(() => {
        if (!intersections || intersections.length === 0) return null;

        // Sort intersections by distance for G1 (descending) and distanceG2 for G2 (ascending)
        const sortedByDistG1 = [...intersections].sort((a, b) => a.distance - b.distance);
        const sortedByDistG2 = [...intersections].sort((a, b) =>
            (a.distanceG2 ?? a.distance) - (b.distanceG2 ?? b.distance)
        );

        if (sortedByDistG1.length === 0) return null;

        // Reference = bottom intersection (min distance) for each group
        const bottomIntersectionG2 = sortedByDistG2[0];
        const topIntersectionG1 = sortedByDistG1[sortedByDistG1.length - 1];

        // Helper function to normalize a time value to [0, cycleLength) range
        const normalizeTime = (t) => {
            const mod = t % cycleLength;
            return mod < 0 ? mod + cycleLength : mod;
        };

        // Helper function to compute intersection of two green windows with cycle wrap-around
        // Returns the intersection window [start, end] relative to the reference
        // Windows are represented as [start, start + width] where width is the green duration
        const intersectWindows = (refStart, refWidth, windowStart, windowWidth) => {
            // Both windows are expressed in the same time reference
            // We need to find the overlap considering cycle wrap-around

            // Normalize windowStart relative to refStart to handle cycle boundaries
            // We want to find where windowStart is relative to refStart in the cycle
            let relativeStart = normalizeTime(windowStart - refStart);

            // If the relative start is more than half a cycle away, it's actually before us
            // This handles the wrap-around case
            if (relativeStart > cycleLength / 2) {
                relativeStart -= cycleLength;
            }

            // Now compute intersection
            // Reference window is [0, refWidth] in relative coordinates
            // Other window is [relativeStart, relativeStart + windowWidth]
            const overlapStart = Math.max(0, relativeStart);
            const overlapEnd = Math.min(refWidth, relativeStart + windowWidth);

            if (overlapEnd <= overlapStart) {
                return null; // No intersection
            }

            return {
                start: overlapStart,
                width: overlapEnd - overlapStart
            };
        };

        // ASCENDING bandwidth (bottom to top, positive slope) - uses Group 2 with distanceG2
        // Calculate bandwidth successively: from 1st to last, 2nd to last, 3rd to last, etc.
        // Then create segments that can widen when starting from a later intersection gives more bandwidth
        let ascSegments = [];
        const bottomDistG2 = bottomIntersectionG2.distanceG2 ?? bottomIntersectionG2.distance;

        if (sortedByDistG2.length > 0) {
            // Calculate bandwidth from each starting intersection to the top
            const bandwidthFromEachStart = [];

            for (let startIdx = 0; startIdx < sortedByDistG2.length; startIdx++) {
                const startIntersection = sortedByDistG2[startIdx];
                const startGroup = startIntersection.groups.find(g => g.id === startIntersection.selectedGroup2);
                if (!startGroup) {
                    bandwidthFromEachStart.push({ width: 0, start: 0 });
                    continue;
                }

                const startDistG2 = startIntersection.distanceG2 ?? startIntersection.distance;
                const startRefStart = startGroup.offset;
                const startRefWidth = startGroup.durations?.green || 0;

                let calcStart = 0;
                let calcWidth = startRefWidth;

                // Calculate intersection of windows from startIdx to the end
                for (let i = startIdx; i < sortedByDistG2.length; i++) {
                    if (calcWidth <= 0) break;

                    const intersection = sortedByDistG2[i];
                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                    if (!group) continue;

                    const distG2 = intersection.distanceG2 ?? intersection.distance;
                    const travelTime = (distG2 - startDistG2) / speedUpMps;
                    const greenStart = group.offset;
                    const greenWidth = group.durations?.green || 0;
                    const greenStartAtStart = greenStart - travelTime;

                    const intersection2 = intersectWindows(
                        startRefStart + calcStart,
                        calcWidth,
                        greenStartAtStart,
                        greenWidth
                    );

                    if (intersection2) {
                        calcStart += intersection2.start;
                        calcWidth = intersection2.width;
                    } else {
                        calcWidth = 0;
                    }
                }

                // Convert start time to bottom reference for consistent rendering
                const travelTimeFromBottom = (startDistG2 - bottomDistG2) / speedUpMps;
                const startAtBottom = normalizeTime(startRefStart + calcStart - travelTimeFromBottom);

                bandwidthFromEachStart.push({
                    width: calcWidth,
                    start: startAtBottom,
                    startDist: startDistG2
                });
            }

            // Build segments: find where bandwidth can widen
            // Each segment covers from its startIdx to the end, but only extends visually to
            // where the next wider segment begins
            let segmentStartIdx = 0;
            let currentWidth = bandwidthFromEachStart[0]?.width || 0;
            let currentStart = bandwidthFromEachStart[0]?.start || 0;

            // Collect widening points
            const wideningPoints = [{ idx: 0, width: currentWidth, start: currentStart }];

            for (let i = 1; i < sortedByDistG2.length; i++) {
                const maxFromHere = bandwidthFromEachStart[i]?.width || 0;

                // If starting from this intersection gives a wider bandwidth
                if (maxFromHere > currentWidth) {
                    wideningPoints.push({
                        idx: i,
                        width: maxFromHere,
                        start: bandwidthFromEachStart[i].start
                    });
                    currentWidth = maxFromHere;
                }
            }

            // Create segments between widening points
            for (let w = 0; w < wideningPoints.length; w++) {
                const point = wideningPoints[w];
                // Each segment goes from this widening point to the next one (or to the end)
                const nextIdx = w + 1 < wideningPoints.length
                    ? wideningPoints[w + 1].idx
                    : sortedByDistG2.length;

                if (point.width > 0) {
                    ascSegments.push({
                        startIdx: point.idx,
                        endIdx: nextIdx - 1,
                        width: point.width,
                        start: point.start,
                        refDistance: bottomDistG2
                    });
                }
            }
        }

        // For backwards compatibility
        let ascResult = null;
        if (ascSegments.length > 0) {
            const firstSegment = ascSegments[0];
            ascResult = {
                start: firstSegment.start,
                width: firstSegment.width,
                refDistance: firstSegment.refDistance,
                segments: ascSegments
            };
        }

        // DESCENDING bandwidth (top to bottom, negative slope) - uses Group 1 with distance
        // Calculate bandwidth successively: from 1st (top) to last (bottom), 2nd to last, 3rd to last, etc.
        // Then create segments that can widen when starting from a later intersection gives more bandwidth
        let descSegments = [];
        const topDist = topIntersectionG1.distance;

        // sortedByDistG1 is sorted ascending (bottom to top), so we need to process from top to bottom
        const sortedTopToBottom = [...sortedByDistG1].reverse();

        if (sortedTopToBottom.length > 0) {
            // Calculate bandwidth from each starting intersection (top to bottom) to the bottom
            const bandwidthFromEachStart = [];

            for (let startIdx = 0; startIdx < sortedTopToBottom.length; startIdx++) {
                const startIntersection = sortedTopToBottom[startIdx];
                const startGroup = startIntersection.groups.find(g => g.id === startIntersection.selectedGroup1);
                if (!startGroup) {
                    bandwidthFromEachStart.push({ width: 0, start: 0 });
                    continue;
                }

                const startDist = startIntersection.distance;
                const startRefStart = startGroup.offset;
                const startRefWidth = startGroup.durations?.green || 0;

                let calcStart = 0;
                let calcWidth = startRefWidth;

                // Calculate intersection of windows from startIdx to the end (bottom)
                for (let i = startIdx; i < sortedTopToBottom.length; i++) {
                    if (calcWidth <= 0) break;

                    const intersection = sortedTopToBottom[i];
                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                    if (!group) continue;

                    const dist = intersection.distance;
                    const travelTime = (startDist - dist) / speedDownMps;
                    const greenStart = group.offset;
                    const greenWidth = group.durations?.green || 0;
                    const greenStartAtStart = greenStart - travelTime;

                    const intersection2 = intersectWindows(
                        startRefStart + calcStart,
                        calcWidth,
                        greenStartAtStart,
                        greenWidth
                    );

                    if (intersection2) {
                        calcStart += intersection2.start;
                        calcWidth = intersection2.width;
                    } else {
                        calcWidth = 0;
                    }
                }

                // Convert start time to top reference for consistent rendering
                const travelTimeFromTop = (topDist - startDist) / speedDownMps;
                const startAtTop = normalizeTime(startRefStart + calcStart - travelTimeFromTop);

                bandwidthFromEachStart.push({
                    width: calcWidth,
                    start: startAtTop,
                    startDist: startDist
                });
            }

            // Build segments: find where bandwidth can widen
            // Each segment covers from its startIdx to the end, but only extends visually to
            // where the next wider segment begins
            let currentWidth = bandwidthFromEachStart[0]?.width || 0;
            let currentStart = bandwidthFromEachStart[0]?.start || 0;

            // Collect widening points
            const wideningPoints = [{ idx: 0, width: currentWidth, start: currentStart }];

            for (let i = 1; i < sortedTopToBottom.length; i++) {
                const maxFromHere = bandwidthFromEachStart[i]?.width || 0;

                // If starting from this intersection gives a wider bandwidth
                if (maxFromHere > currentWidth) {
                    wideningPoints.push({
                        idx: i,
                        width: maxFromHere,
                        start: bandwidthFromEachStart[i].start
                    });
                    currentWidth = maxFromHere;
                }
            }

            // Create segments between widening points
            for (let w = 0; w < wideningPoints.length; w++) {
                const point = wideningPoints[w];
                // Each segment goes from this widening point to the next one (or to the end)
                const nextIdx = w + 1 < wideningPoints.length
                    ? wideningPoints[w + 1].idx
                    : sortedTopToBottom.length;

                if (point.width > 0) {
                    descSegments.push({
                        startIdx: point.idx,
                        endIdx: nextIdx - 1,
                        width: point.width,
                        start: point.start,
                        refDistance: topDist
                    });
                }
            }
        }

        // For backwards compatibility
        let descResult = null;
        if (descSegments.length > 0) {
            const firstSegment = descSegments[0];
            descResult = {
                start: firstSegment.start,
                width: firstSegment.width,
                refDistance: firstSegment.refDistance,
                segments: descSegments
            };
        }

        return {
            ascending: ascResult,
            descending: descResult
        };
    }, [intersections, speedUpMps, speedDownMps, cycleLength]);

    // Generate speed lines (green wave corridors) - ascending and descending
    // Apply offsets (in seconds) to shift lines horizontally
    const speedLinesUp = [];
    const speedLinesDown = [];
    // Les lignes de vitesse balaient la pleine amplitude [minDistance ; maxDistance].
    const speedSpanMeters = maxDistance - minDistance;
    for (let startTime = 0; startTime < maxTime; startTime += cycleLength) {
        // Ascending lines (bottom to top) - apply speedLineOffsetUp
        const startTimeUp = startTime + speedLineOffsetUp;
        speedLinesUp.push({
            x1: timeToX(startTimeUp),
            y1: distanceToY(minDistance),
            x2: timeToX(startTimeUp + speedSpanMeters / speedUpMps),
            y2: distanceToY(maxDistance)
        });
        // Descending lines (top to bottom) - apply speedLineOffsetDown
        const startTimeDown = startTime + speedLineOffsetDown;
        speedLinesDown.push({
            x1: timeToX(startTimeDown),
            y1: distanceToY(maxDistance),
            x2: timeToX(startTimeDown + speedSpanMeters / speedDownMps),
            y2: distanceToY(minDistance)
        });
    }

    // Drag handlers for speed lines
    const [dragStartX, setDragStartX] = useState(0);
    const [initialOffset, setInitialOffset] = useState(0);

    const handleMouseDownUp = (e) => {
        e.preventDefault();
        setDragging('up');
        setDragStartX(e.clientX);
        setInitialOffset(speedLineOffsetUp);
    };

    const handleMouseDownDown = (e) => {
        e.preventDefault();
        setDragging('down');
        setDragStartX(e.clientX);
        setInitialOffset(speedLineOffsetDown);
    };

    const handleMouseMove = (e) => {
        if (!dragging) return;
        const deltaX = e.clientX - dragStartX;
        const deltaSeconds = deltaX / pixelsPerSecond;
        if (dragging === 'up') {
            setSpeedLineOffsetUp(initialOffset + deltaSeconds);
        } else if (dragging === 'down') {
            setSpeedLineOffsetDown(initialOffset + deltaSeconds);
        }
    };

    const handleMouseUp = () => {
        setDragging(null);
    };

    // Tableau des données saisies — JSX partagé entre le rendu inline
    // (sous le diagramme) et la fenêtre popup détachée. Le bouton Détacher
    // n'apparaît que dans le rendu inline (pas dans la popup déjà détachée).
    // Le JSX utilise du chaînage optionnel sur intersections : il s'évalue
    // proprement même quand les données ne sont pas encore chargées.
    const dataPanelJSX = (
        <div className="green-wave-params-panel">
            <h3>
                Tableau des données saisies
                <button
                    className="btn-add-intersection"
                    onClick={addIntersection}
                    title="Ajouter un carrefour"
                >+</button>
                {!showFloatingDataTable && (
                    <button
                        className="btn-detach-datatable"
                        onClick={() => setShowFloatingDataTable(true)}
                        title="Ouvrir le tableau dans une fenêtre séparée pour libérer l'espace"
                    >Détacher</button>
                )}
            </h3>
            <table className="green-wave-data-table">
                <thead>
                    <tr>
                        <th rowSpan="2">Ordre</th>
                        <th rowSpan="2">Carrefour</th>
                        <th rowSpan="2">PF</th>
                        <th rowSpan="2">Cycle</th>
                        <th colSpan="2" className="gf-montant-header">GF Montant</th>
                        <th colSpan="2" className="gf-descendant-header">GF Descendant</th>
                    </tr>
                    <tr className="sub-header">
                        <th style={{ color: '#4CAF50' }}>Groupe</th>
                        <th style={{ color: '#4CAF50' }}>Dist</th>
                        <th style={{ color: '#FF9800' }}>Groupe</th>
                        <th style={{ color: '#FF9800' }}>Dist</th>
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        const cycleCounts = {};
                        intersections?.forEach(i => {
                            const c = i.cycleLength || 0;
                            cycleCounts[c] = (cycleCounts[c] || 0) + 1;
                        });
                        const mostCommonCycle = Object.entries(cycleCounts)
                            .sort((a, b) => b[1] - a[1])[0]?.[0];
                        const referenceCycle = parseInt(mostCommonCycle) || 0;

                        return intersections?.map((intersection, idx) => {
                            const hasCycleConflict = intersection.cycleLength !== referenceCycle;

                            return (
                                <tr key={idx} className={hasCycleConflict ? 'row-cycle-conflict' : ''}>
                                    <td className="col-order">
                                        <div className="order-controls">
                                            <button
                                                className="btn-move"
                                                onClick={() => moveIntersection(idx, 'up')}
                                                disabled={idx === 0}
                                                title="Monter"
                                            >↑</button>
                                            <span>{idx + 1}</span>
                                            <button
                                                className="btn-move"
                                                onClick={() => moveIntersection(idx, 'down')}
                                                disabled={idx === intersections.length - 1}
                                                title="Descendre"
                                            >↓</button>
                                        </div>
                                    </td>
                                    <td className="col-name">{intersection.projectName}</td>
                                    <td className="col-pf">
                                        <select
                                            value={intersection.selectedPfId || ''}
                                            onChange={(e) => updateSelectedPf(idx, parseInt(e.target.value))}
                                        >
                                            {intersection.pfTabs?.map(pf => (
                                                <option key={pf.id} value={pf.id}>
                                                    {pf.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className={`col-cycle ${hasCycleConflict ? 'cycle-conflict' : ''}`} title={hasCycleConflict ? `Cycle différent du cycle de référence (${referenceCycle}s)` : ''}>
                                        {intersection.cycleLength}
                                    </td>
                                    <td
                                        className={`col-group-select ${isOndeVerteHovered(idx, 'M') ? 'ov-cell-hover' : ''}`}
                                        onMouseEnter={() => setHoveredOndeVerteCell({ idx, direction: 'M' })}
                                        onMouseLeave={() => setHoveredOndeVerteCell(null)}
                                    >
                                        <select
                                            value={intersection.selectedGroup2 || ''}
                                            onChange={(e) => updateSelectedGroup2(idx, parseInt(e.target.value))}
                                            style={{ color: '#4CAF50' }}
                                        >
                                            {intersection.groups.map(g => (
                                                <option key={g.id} value={g.id}>
                                                    G{g.id} - {g.name || 'Sans nom'}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td
                                        className={`col-distance ${isOndeVerteHovered(idx, 'M') ? 'ov-cell-hover' : ''}`}
                                        onMouseEnter={() => setHoveredOndeVerteCell({ idx, direction: 'M' })}
                                        onMouseLeave={() => setHoveredOndeVerteCell(null)}
                                    >
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="-?\d*"
                                            value={distanceDrafts[`${idx}.g2`] ?? (intersection.distanceG2 ?? intersection.distance)}
                                            onChange={(e) => updateDistanceG2(idx, e.target.value)}
                                            onBlur={() => commitDistanceDraft(idx, 'g2')}
                                        />
                                    </td>
                                    <td
                                        className={`col-group-select ${isOndeVerteHovered(idx, 'D') ? 'ov-cell-hover' : ''}`}
                                        onMouseEnter={() => setHoveredOndeVerteCell({ idx, direction: 'D' })}
                                        onMouseLeave={() => setHoveredOndeVerteCell(null)}
                                    >
                                        <select
                                            value={intersection.selectedGroup1 || ''}
                                            onChange={(e) => updateSelectedGroup1(idx, parseInt(e.target.value))}
                                            style={{ color: '#FF9800' }}
                                        >
                                            {intersection.groups.map(g => (
                                                <option key={g.id} value={g.id}>
                                                    G{g.id} - {g.name || 'Sans nom'}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td
                                        className={`col-distance ${isOndeVerteHovered(idx, 'D') ? 'ov-cell-hover' : ''}`}
                                        onMouseEnter={() => setHoveredOndeVerteCell({ idx, direction: 'D' })}
                                        onMouseLeave={() => setHoveredOndeVerteCell(null)}
                                    >
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="-?\d*"
                                            value={distanceDrafts[`${idx}.g1`] ?? intersection.distance}
                                            onChange={(e) => updateDistance(idx, e.target.value)}
                                            onBlur={() => commitDistanceDraft(idx, 'g1')}
                                        />
                                    </td>
                                </tr>
                            );
                        });
                    })()}
                </tbody>
            </table>
        </div>
    );

    // Synchronise la popup détachée avec le contenu du tableau : re-rendu
    // à chaque update pour rester en phase avec l'inline.
    useEffect(() => {
        if (showFloatingDataTable) {
            dataTablePopup.renderToPopup(dataPanelJSX);
        }
    });

    // Impression de l'onde verte (PDF via window.print). Extrait de
    // l'ancien onClick du bouton « Imprimer » pour pouvoir être déclenché
    // depuis le menu Fichier → Imprimer.
    const handlePrintGreenWave = () => {
        const svgEl = document.querySelector('.green-wave-svg');
        if (!svgEl) return;

        const clone = svgEl.cloneNode(true);
        clone.querySelectorAll('rect.green-wave-svg-bg').forEach(el => el.setAttribute('fill', '#ffffff'));
        clone.querySelectorAll('line.green-wave-grid').forEach(el => el.setAttribute('stroke', '#ddd'));
        clone.querySelectorAll('line.green-wave-grid-cycle').forEach(el => el.setAttribute('stroke', '#bbb'));
        clone.querySelectorAll('line.green-wave-axis').forEach(el => el.setAttribute('stroke', '#333'));
        clone.querySelectorAll('text.green-wave-axis-tick').forEach(el => el.setAttribute('fill', '#333'));
        clone.querySelectorAll('text.green-wave-axis-label').forEach(el => el.setAttribute('fill', '#333'));
        clone.querySelectorAll('text[fill="#fff"]').forEach(el => el.setAttribute('fill', '#000'));
        clone.querySelectorAll('line[stroke="transparent"]').forEach(el => el.remove());
        clone.querySelectorAll('line[stroke="#4CAF50"][stroke-dasharray="8,4"]').forEach(el => {
            const g = el.parentElement;
            if (g && g.tagName === 'g' && g.children.length <= 2) g.remove();
            else el.remove();
        });
        clone.querySelectorAll('line[stroke="#FF9800"][stroke-dasharray="8,4"]').forEach(el => {
            const g = el.parentElement;
            if (g && g.tagName === 'g' && g.children.length <= 2) g.remove();
            else el.remove();
        });
        clone.querySelectorAll('polygon[opacity]').forEach(el => el.setAttribute('opacity', '0.35'));
        const clipEl = clone.querySelector('#bandwidth-clip');
        if (clipEl) {
            clipEl.setAttribute('id', 'bandwidth-clip-print');
            const clipG = clone.querySelector('g[clip-path="url(#bandwidth-clip)"]');
            if (clipG) clipG.setAttribute('clip-path', 'url(#bandwidth-clip-print)');
        }

        const pageW = 1048;
        const headerH = 76;
        const pageH = 756 - headerH;
        const scaleX = pageW / diagramWidth;
        const scaleY = pageH / diagramHeight;
        const scale = Math.min(scaleX, scaleY, 1);
        clone.setAttribute('width', Math.round(diagramWidth * scale));
        clone.setAttribute('height', Math.round(diagramHeight * scale));

        const legendItems = [];
        const li = (iconHtml, text) => legendItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;color:#000">${iconHtml} ${text}</span>`);
        li('<span style="width:20px;border-top:2px dashed #4CAF50;display:inline-block"></span>', `V. montante : ${speedUp} km/h`);
        li('<span style="width:20px;border-top:2px dashed #FF9800;display:inline-block"></span>', `V. descendante : ${speedDown} km/h`);
        if (bandwidthData?.ascending) li('<span style="width:14px;height:9px;background:rgba(76,175,80,0.3);border:1px solid #4CAF50;border-radius:2px;display:inline-block"></span>', `BP montante : ${bandwidthData.ascending.width.toFixed(1)}s`);
        if (bandwidthData?.descending) li('<span style="width:14px;height:9px;background:rgba(255,152,0,0.3);border:1px solid #FF9800;border-radius:2px;display:inline-block"></span>', `BP descendante : ${bandwidthData.descending.width.toFixed(1)}s`);
        li('<span style="width:14px;height:9px;background:#2E7D32;border:1px solid #4CAF50;border-radius:2px;display:inline-block"></span>', '2nde lucarne');
        li('<span style="width:14px;height:9px;background:repeating-linear-gradient(45deg,transparent,transparent 2px,#4CAF50 2px,#4CAF50 4px);border:1px solid #4CAF50;border-radius:2px;display:inline-block"></span>', 'Ouv. anticipée');

        const printDiv = document.createElement('div');
        printDiv.id = 'gw-print-area';
        printDiv.innerHTML = `<h1 style="font-size:14pt;margin:0 0 4px 0;font-family:Arial,sans-serif;color:#000;">Onde Verte${greenWaveName ? ' - ' + greenWaveName : ''}</h1>` +
            `<div style="display:flex;flex-wrap:nowrap;gap:12px;font-size:7.5pt;margin-bottom:6px;font-family:Arial,sans-serif;white-space:nowrap;">${legendItems.join('')}</div>`;
        printDiv.appendChild(clone);
        document.body.appendChild(printDiv);

        const pageStyle = document.createElement('style');
        pageStyle.textContent = '@page { size: A4 landscape; margin: 5mm 10mm; }';
        document.head.appendChild(pageStyle);

        document.body.classList.add('print-greenwave');
        setTimeout(() => {
            window.print();
            document.body.classList.remove('print-greenwave');
            document.head.removeChild(pageStyle);
            document.body.removeChild(printDiv);
        }, 500);
    };

    // Lecture locale des projets sauvegardés en localStorage (équivalent du
    // getAllSaves de useTrafficLight). Permet de réutiliser CreateGreenWaveDialog
    // sans dépendre de l'app principale.
    const getAllSavesLocal = () => {
        const saves = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                if (key.startsWith('traffic_project_') && !key.endsWith('_backup') && key !== 'traffic_project_order') {
                    const name = key.replace('traffic_project_', '');
                    if (!name) continue;
                    const raw = localStorage.getItem(key);
                    let savedAt = null;
                    let size = 0;
                    if (raw) {
                        size = raw.length;
                        try {
                            const data = JSON.parse(raw);
                            savedAt = data.savedAt || null;
                        } catch {}
                    }
                    saves.push({ name, savedAt, size });
                }
            }
        } catch {}
        saves.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
        return saves;
    };

    const getProjectDataLocal = (name) => {
        try {
            const raw = localStorage.getItem(`traffic_project_${name}`);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

    // Création d'une nouvelle onde verte : remplace le contenu de la fenêtre
    // courante (philosophie « une seule session Onde verte à la fois »,
    // cohérente avec le module Diagramme). Si le projet courant a des
    // modifications non sauvegardées, on demande confirmation avant
    // d'écraser.
    const handleCreateGreenWaveLocal = async (newIntersections) => {
        gwLeaveExample(); // créer une onde verte : on quitte l'exemple
        if (gwIsDirty) {
            const ok = await askConfirm({
                title: 'Modifications non enregistrées',
                message: "L'onde verte courante a des modifications non enregistrées qui seront perdues.\n\nContinuer et créer une nouvelle onde verte ?",
                confirmLabel: 'Continuer',
                danger: true,
            });
            // L'utilisateur annule : ne ferme pas le dialogue, lui laisse
            // l'opportunité d'annuler complètement la création.
            if (!ok) return;
        }
        isApplyingSettingsRef.current = true;
        setIntersections(newIntersections);
        setGreenWaveName('');
        setLoadedFileName('');
        setSpeedLineOffsetUp(0);
        setSpeedLineOffsetDown(0);
        setPfParams({});
        setShowCreateDialog(false);
        document.title = 'Onde Verte';
        setTimeout(() => {
            isApplyingSettingsRef.current = false;
            setGwIsDirty(false);
        }, 0);
    };

    // Chargement de l'onde verte exemple fournie (?example=ondeverte).
    // Fenêtre neuve (écran d'accueil ou FAQ) : aucune session à écraser.
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('example') !== 'ondeverte') return;
        (async () => {
            try {
                const res = await fetch('./Onde%20verte_Exemple.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!data || !Array.isArray(data.intersections)) {
                    throw new Error("Données d'onde verte invalides");
                }
                const settings = {
                    name: data.name || 'Onde verte exemple',
                    loadedFileName: 'Onde verte_Exemple',
                    speedUp: data.speedUp,
                    speedDown: data.speedDown,
                    speedLineOffsetUp: data.speedLineOffsetUp,
                    speedLineOffsetDown: data.speedLineOffsetDown,
                    showSpeedLines: data.showSpeedLines,
                    pfParams: data.pfParams,
                    pixelsPerSecond: data.pixelsPerSecond,
                    pixelsPerMeter: data.pixelsPerMeter,
                    displayCycles: data.displayCycles
                };
                gwLeaveExample(); // ouvrir un fichier : on quitte l'exemple
                isApplyingSettingsRef.current = true;
                setIntersections(data.intersections);
                applySettings(settings);
                document.title = `Onde Verte - ${data.name || 'exemple'}`;
                window.history.replaceState({}, '', `${window.location.pathname}?greenwave`);
            } catch (e) {
                console.error("Échec du chargement de l'onde verte exemple", e);
                showAlert({ title: 'Erreur', message: "Impossible de charger l'onde verte exemple." });
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-effacement de l'invitation « onde verte exemple ».
    // Vue d'accueil : seulement si rien n'est auto-chargé (ni ?id ni
    // ?example=ondeverte).
    useEffect(() => {
        if (gwWelcomeViewNoted.current) return;
        const p = new URLSearchParams(window.location.search);
        if (p.has('id') || p.get('example') === 'ondeverte') return;
        gwWelcomeViewNoted.current = true;
        noteWelcomeView('greenwave');
    }, []);

    // Onde verte vue : à la première fois où des intersections sont chargées
    // dans ce montage (Nouveau, Ouvrir, exemple…). L'exemple compte.
    useEffect(() => {
        if (intersections && !gwProjectSeenNoted.current) {
            gwProjectSeenNoted.current = true;
            noteProjectSeen('greenwave');
        }
    }, [intersections]);

    // Ouverture d'un fichier .json d'onde verte : remplace le contenu de la
    // fenêtre courante (philosophie « une seule session Onde verte à la
    // fois »). Si le projet courant a des modifications non sauvegardées,
    // on demande confirmation avant d'écraser.
    const handleOpenGreenWaveFile = async () => {
        if (!window.showOpenFilePicker) {
            showAlert({ title: 'Navigateur non compatible', message: "Votre navigateur ne supporte pas l'ouverture de fichiers. Utilisez l'application principale." });
            return;
        }
        try {
            const [fileHandle] = await safeShowOpenFilePicker({
                types: [{ description: 'Fichier Onde Verte JSON', accept: { 'application/json': ['.json'] } }],
                multiple: false
            });
            const file = await fileHandle.getFile();
            const content = await file.text();
            if (!content || !content.trim()) {
                showAlert({ title: 'Fichier vide', message: 'Le fichier est vide.' });
                return;
            }
            const data = JSON.parse(content);
            if (!data || typeof data !== 'object') {
                showAlert({ title: 'Fichier invalide', message: 'Le fichier ne contient pas un objet JSON valide.' });
                return;
            }
            // Détection croisée : un fichier projet de carrefour (champs
            // groups / pfTabs / conflictMatrix) ne peut pas être ouvert ici.
            const looksLikeCarrefour = Array.isArray(data.groups) || Array.isArray(data.pfTabs) || Array.isArray(data.conflictMatrix);
            if (!Array.isArray(data.intersections)) {
                if (looksLikeCarrefour) {
                    showAlert({
                        title: 'Fichier incompatible',
                        message: "Ce fichier est un projet de carrefour, pas une onde verte. Pour l'ouvrir, utilisez le module Diagramme de Feux (fenêtre principale, Fichier → Ouvrir un projet)."
                    });
                } else {
                    showAlert({ title: 'Fichier invalide', message: "Le fichier ne contient pas de données d'onde verte valides." });
                }
                return;
            }
            // Confirmation si la fenêtre courante a des modifs non sauvées.
            // (Check fait après validation pour éviter une question inutile
            // si le fichier choisi n'est pas exploitable.)
            if (gwIsDirty) {
                const ok = await askConfirm({
                    title: 'Modifications non enregistrées',
                    message: "L'onde verte courante a des modifications non enregistrées qui seront perdues.\n\nContinuer et ouvrir le fichier sélectionné ?",
                    confirmLabel: 'Continuer',
                    danger: true,
                });
                if (!ok) return;
            }
            const settings = {
                name: data.name || file.name.replace(/\.json$/i, ''),
                loadedFileName: file.name.replace(/\.json$/i, ''),
                speedUp: data.speedUp,
                speedDown: data.speedDown,
                speedLineOffsetUp: data.speedLineOffsetUp,
                speedLineOffsetDown: data.speedLineOffsetDown,
                showSpeedLines: data.showSpeedLines,
                pfParams: data.pfParams,
                pixelsPerSecond: data.pixelsPerSecond,
                pixelsPerMeter: data.pixelsPerMeter,
                displayCycles: data.displayCycles
            };
            // Toujours charger dans la fenêtre courante (une session à la fois).
            isApplyingSettingsRef.current = true;
            setIntersections(data.intersections);
            applySettings(settings);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur ouverture fichier onde verte:', e);
                showAlert({ title: "Erreur d'ouverture", message: "Erreur lors de l'ouverture du fichier : " + e.message });
            }
        }
    };

    // Aiguillage des actions du menu : Nouveau et Ouvrir restent dans la
    // fenêtre courante (création/ouverture sans nouvel onglet). Aide en ligne
    // ouvre l'app principale avec un paramètre URL pour pointer sur le
    // chapitre Onde verte.
    const handleMenuAction = (action) => {
        const mainAppUrl = `${window.location.origin}${window.location.pathname}`;
        switch (action) {
            case 'new':
                setShowCreateDialog(true);
                break;
            case 'open':
                handleOpenGreenWaveFile();
                break;
            case 'restoreRecent':
                openRestoreModal();
                break;
            case 'saveFile':
                handleSaveGreenWaveToFile();
                break;
            case 'print':
                handlePrintGreenWave();
                break;
            case 'close':
                window.close();
                break;
            case 'sync':
                handleSyncGreenWave();
                break;
            case 'about':
                setShowAboutModal(true);
                break;
            case 'help':
                setShowHelpModal(true);
                break;
            default:
                break;
        }
    };

    if (!intersections) {
        // Distinction entre « chargement en cours » (URL contient ?id=...) et
        // « aucune onde verte ouverte » (URL sans id). Dans le second cas,
        // on affiche un écran d'accueil avec la barre de menu accessible
        // pour que l'utilisateur déclenche Fichier > Nouveau ou Ouvrir.
        const gwParams = new URLSearchParams(window.location.search);
        const hasUrlId = gwParams.has('id') || gwParams.get('example') === 'ondeverte';
        if (hasUrlId) {
            return (
                <div className="green-wave-page">
                    <div className="green-wave-loading">
                        Chargement des données...
                    </div>
                </div>
            );
        }
        return (
            <div className="green-wave-page">
                <GreenWaveMenuBar
                    onAction={handleMenuAction}
                    pixelsPerSecond={pixelsPerSecond}
                    onPixelsPerSecondChange={setPixelsPerSecond}
                    pixelsPerMeter={pixelsPerMeter}
                    onPixelsPerMeterChange={setPixelsPerMeter}
                    displayCycles={displayCycles}
                    onDisplayCyclesChange={setDisplayCycles}
                    showSpeedLines={showSpeedLines}
                    onShowSpeedLinesChange={setShowSpeedLines}
                    hasActiveProject={false}
                />
                <div className="gw-welcome-screen">
                    <p className="gw-welcome-hint">
                        Aucune onde verte ouverte.<br/>
                        Choisissez <strong>Fichier → Nouveau</strong> pour en créer une à partir de vos projets sauvegardés,
                        ou <strong>Fichier → Ouvrir</strong> pour charger un fichier <code>.json</code> existant.
                    </p>
                    {showExampleInvite && (
                    <p className="gw-welcome-hint">
                        Première visite ?{' '}
                        <button
                            type="button"
                            className="welcome-example-link"
                            onClick={() => window.open(`${window.location.pathname}?greenwave&example=ondeverte`, '_blank')}
                        >
                            Découvrir avec une onde verte exemple
                        </button>
                        {' '}(s'ouvre dans une nouvelle fenêtre).
                    </p>
                    )}
                </div>

                {/* Modales nécessaires sur l'écran d'accueil pour pouvoir
                    déclencher Nouveau / Aide en ligne / À propos. */}
                <CreateGreenWaveDialog
                    isOpen={showCreateDialog}
                    onClose={() => setShowCreateDialog(false)}
                    onConfirm={handleCreateGreenWaveLocal}
                    getAllSaves={getAllSavesLocal}
                    loadProjectData={getProjectDataLocal}
                />
                <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="Aide - TraCflux" className="modal-wide">
                    <HelpContent initialAnchor="help-onde-verte" />
                </Modal>
                {showAboutModal && (
                    <div className="gw-about-overlay" onClick={() => setShowAboutModal(false)}>
                        <div className="gw-about-modal" onClick={(e) => e.stopPropagation()}>
                            <div style={{ textAlign: 'center', position: 'relative' }}>
                                <img
                                    src="./logo.svg"
                                    alt=""
                                    style={{ position: 'absolute', top: '0', right: '0', width: '80px', height: '80px', userSelect: 'none', pointerEvents: 'none' }}
                                />
                                <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#4ecdc4', marginBottom: '8px' }}>{APP_NAME}</div>
                                <div style={{ fontSize: '1.1em', color: '#aaa', marginBottom: '4px' }}>Version {APP_VERSION}</div>
                                <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '20px', maxWidth: '420px', margin: '0 auto 20px' }}>{APP_DESCRIPTION}</div>
                                <div style={{ fontSize: '0.95em', marginBottom: '16px' }}>
                                    <div>Module <strong>Onde verte</strong></div>
                                    <div style={{ marginTop: '4px', color: '#aaa' }}>Conception d'ondes vertes bidirectionnelles modérantes</div>
                                </div>
                                <button className="gw-about-close" onClick={() => setShowAboutModal(false)} style={{ marginTop: '12px' }}>Fermer</button>
                            </div>
                        </div>
                    </div>
                )}
                {renderRestoreModal()}
            </div>
        );
    }

    return (
        <div className="green-wave-page">
            <GreenWaveMenuBar
                onAction={handleMenuAction}
                pixelsPerSecond={pixelsPerSecond}
                onPixelsPerSecondChange={setPixelsPerSecond}
                pixelsPerMeter={pixelsPerMeter}
                onPixelsPerMeterChange={setPixelsPerMeter}
                displayCycles={displayCycles}
                onDisplayCyclesChange={setDisplayCycles}
                showSpeedLines={showSpeedLines}
                onShowSpeedLinesChange={setShowSpeedLines}
                hasActiveProject={!!intersections && intersections.length > 0}
                isExampleProject={gwIsExample}
            />
            {gwIsExample && (
                <div className="example-banner" role="status">
                    🧪 Onde verte exemple — librement modifiable, mais <strong>non enregistrable</strong> (sauvegarde et stockage désactivés). Faites <strong>Fichier → Nouveau</strong> pour démarrer la vôtre.
                </div>
            )}
            <div className="green-wave-page-header">
                <h1>
                    Onde Verte
                    {greenWaveName && <span className="folder-name">- {greenWaveName}</span>}
                </h1>
                {intersections?.[0]?.pfTabs && intersections[0].pfTabs.length > 0 && (
                    <select
                        className="green-wave-pf-select"
                        value={intersections[0].selectedPfId || 1}
                        onChange={(e) => handleGlobalPfChange(parseInt(e.target.value))}
                        title="Changer le plan de feu pour tous les carrefours (par nom ou durée de cycle)"
                    >
                        {intersections[0].pfTabs.map(pf => (
                            <option key={pf.id} value={pf.id}>
                                {pf.name}{pf.cycleLength ? ` (${pf.cycleLength}s)` : ''}
                            </option>
                        ))}
                    </select>
                )}
                <div className="green-wave-controls">
                    <label style={{ color: '#8BC34A' }}>
                        V. mont :
                        <input
                            type="number"
                            value={speedUp}
                            onChange={(e) => setSpeedUp(parseInt(e.target.value) || 50)}
                            min="10"
                            max="130"
                            style={{ width: '40px' }}
                        />
                        km/h
                    </label>
                    <label style={{ color: '#FF9800' }}>
                        V. desc :
                        <input
                            type="number"
                            value={speedDown}
                            onChange={(e) => setSpeedDown(parseInt(e.target.value) || 50)}
                            min="10"
                            max="130"
                            style={{ width: '40px' }}
                        />
                        km/h
                    </label>
                </div>
            </div>

            <div className="green-wave-diagram-scroll">
                <svg
                    className="green-wave-svg"
                    width={diagramWidth}
                    height={diagramHeight}
                    viewBox={`0 0 ${diagramWidth} ${diagramHeight}`}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: dragging ? 'ew-resize' : 'default' }}
                >
                    {/* Background — fill géré par CSS pour suivre le thème */}
                    <rect
                        x={PADDING_LEFT}
                        y={PADDING_TOP}
                        width={diagramWidth - PADDING_LEFT - PADDING_RIGHT}
                        height={diagramHeight - PADDING_TOP - PADDING_BOTTOM}
                        className="green-wave-svg-bg"
                    />

                    {/* Grid lines - vertical (time) — pointillés pour alléger.
                        Limites de cycle plus marquées via une classe distincte. */}
                    {timeTicks.map(t => (
                        <line
                            key={`grid-t-${t}`}
                            x1={timeToX(t)}
                            y1={PADDING_TOP}
                            x2={timeToX(t)}
                            y2={diagramHeight - PADDING_BOTTOM}
                            className={t % cycleLength === 0 ? 'green-wave-grid-cycle' : 'green-wave-grid'}
                            strokeDasharray="2,3"
                        />
                    ))}

                    {/* Grid lines - horizontal (distance) — pointillés pour alléger */}
                    {distanceTicks.map(d => (
                        <line
                            key={`grid-d-${d}`}
                            x1={PADDING_LEFT}
                            y1={distanceToY(d)}
                            x2={diagramWidth - PADDING_RIGHT}
                            y2={distanceToY(d)}
                            className="green-wave-grid"
                            strokeDasharray="2,3"
                        />
                    ))}

                    {/* Speed lines ascending (green wave corridor) - draggable */}
                    {showSpeedLines && speedLinesUp.map((line, idx) => (
                        <g key={`speed-up-${idx}`}>
                            {/* Invisible wider hit area for easier dragging */}
                            <line
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="transparent"
                                strokeWidth={16}
                                style={{ cursor: 'ew-resize' }}
                                onMouseDown={handleMouseDownUp}
                            />
                            {/* Visible line */}
                            <line
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="#4CAF50"
                                strokeWidth={dragging === 'up' ? 4 : 2}
                                strokeDasharray="8,4"
                                opacity={dragging === 'up' ? 0.9 : 0.6}
                                style={{ cursor: 'ew-resize', pointerEvents: 'none' }}
                            />
                        </g>
                    ))}
                    {/* Speed lines descending (green wave corridor) - draggable */}
                    {showSpeedLines && speedLinesDown.map((line, idx) => (
                        <g key={`speed-down-${idx}`}>
                            {/* Invisible wider hit area for easier dragging */}
                            <line
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="transparent"
                                strokeWidth={16}
                                style={{ cursor: 'ew-resize' }}
                                onMouseDown={handleMouseDownDown}
                            />
                            {/* Visible line */}
                            <line
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="#FF9800"
                                strokeWidth={dragging === 'down' ? 4 : 2}
                                strokeDasharray="8,4"
                                opacity={dragging === 'down' ? 0.9 : 0.6}
                                style={{ cursor: 'ew-resize', pointerEvents: 'none' }}
                            />
                        </g>
                    ))}

                    {/* Intersection bars */}
                    {intersections?.map((intersection, idx) => {
                        const yG1 = distanceToY(intersection.distance);
                        const yG2 = distanceToY(intersection.distanceG2 ?? intersection.distance);
                        const barHeight = 12;

                        // Get the two selected groups
                        const group1 = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                        const group2 = intersection.groups.find(g => g.id === intersection.selectedGroup2);

                        const bars = [];

                        // Render bars for multiple cycles. Cycle -1 dessine la
                        // queue du cycle précédent qui rentre dans le 1er cycle
                        // visible (cas des verts qui wrap autour du cycle).
                        // Le clipping SVG (bars-clip) coupe ensuite ce qui
                        // dépasse à gauche (avant t=0) ou à droite (après le
                        // dernier cycle visible). On utilise displayCycles
                        // pour suivre le choix utilisateur (2 ou 3 cycles).
                        for (let cycle = -1; cycle < displayCycles; cycle++) {
                            const cycleOffset = cycle * intersection.cycleLength;

                            // Group 1 bar (Descendant - Orange) at distance
                            if (group1) {
                                const start1 = group1.offset + cycleOffset;
                                const duration1 = group1.durations?.green || 0;
                                const end1 = start1 + duration1;
                                const hoveredD = isOndeVerteHovered(idx, 'D');
                                bars.push(
                                    <g key={`bar-${idx}-g1-c${cycle}`}>
                                        <rect
                                            x={timeToX(start1)}
                                            y={yG1 - barHeight / 2}
                                            width={duration1 * pixelsPerSecond}
                                            height={barHeight}
                                            fill="#FF9800"
                                            opacity={hoveredD ? 1 : 0.9}
                                            stroke={hoveredD ? '#fff' : 'none'}
                                            strokeWidth={hoveredD ? 1 : 0}
                                        />
                                        {/* Deb value at start - above bar */}
                                        <text
                                            x={timeToX(start1) + 2}
                                            y={yG1 - barHeight / 2 - 3}
                                            fill="#FF9800"
                                            fontSize="14"
                                        >
                                            {Math.round(start1 % intersection.cycleLength)}
                                        </text>
                                        {/* Fin value at end - above bar */}
                                        <text
                                            x={timeToX(end1) - 2}
                                            y={yG1 - barHeight / 2 - 3}
                                            fill="#FF9800"
                                            fontSize="14"
                                            textAnchor="end"
                                        >
                                            {Math.round(end1 % intersection.cycleLength)}
                                        </text>
                                    </g>
                                );
                            }

                            // Group 2 bar (Montant - Vert) at distanceG2
                            if (group2) {
                                const start2 = group2.offset + cycleOffset;
                                const duration2 = group2.durations?.green || 0;
                                const end2 = start2 + duration2;
                                const hoveredM = isOndeVerteHovered(idx, 'M');
                                bars.push(
                                    <g key={`bar-${idx}-g2-c${cycle}`}>
                                        <rect
                                            x={timeToX(start2)}
                                            y={yG2 - barHeight / 2}
                                            width={duration2 * pixelsPerSecond}
                                            height={barHeight}
                                            fill="#4CAF50"
                                            opacity={hoveredM ? 1 : 0.9}
                                            stroke={hoveredM ? '#fff' : 'none'}
                                            strokeWidth={hoveredM ? 1 : 0}
                                        />
                                        {/* Deb value at start - above bar */}
                                        <text
                                            x={timeToX(start2) + 2}
                                            y={yG2 - barHeight / 2 - 3}
                                            fill="#4CAF50"
                                            fontSize="14"
                                        >
                                            {Math.round(start2 % intersection.cycleLength)}
                                        </text>
                                        {/* Fin value at end - above bar */}
                                        <text
                                            x={timeToX(end2) - 2}
                                            y={yG2 - barHeight / 2 - 3}
                                            fill="#4CAF50"
                                            fontSize="14"
                                            textAnchor="end"
                                        >
                                            {Math.round(end2 % intersection.cycleLength)}
                                        </text>
                                    </g>
                                );
                            }

                            // Render actions (Seconde lucarne, Ouverture anticipée) for selected groups
                            const actions = intersection.actionData || [];
                            // Debug: log actions data
                            if (cycle === 0) {
                                const relevantActions = actions.filter(a => a.action === 'Seconde lucarne' || a.action === 'Ouverture anticipée');
                                console.log('=== Debug Actions ===');
                                console.log('Intersection:', intersection.projectName);
                                console.log('Selected Group1:', intersection.selectedGroup1, 'Group2:', intersection.selectedGroup2);
                                console.log('Total actions in actionData:', actions.length);
                                console.log('Relevant actions (Seconde lucarne / Ouverture anticipée):', relevantActions);
                                if (relevantActions.length > 0) {
                                    relevantActions.forEach(a => console.log('  - GF:', a.gf, 'Action:', a.action, 'Deb:', a.deb, 'Fin:', a.fin));
                                }
                            }
                            actions.forEach((action, actionIdx) => {
                                // Skip if no group, or no start/end time
                                if (!action.gf || action.deb === '' || action.deb === undefined ||
                                    action.fin === '' || action.fin === undefined) return;
                                // Skip if not the right action type
                                if (action.action !== 'Seconde lucarne' && action.action !== 'Ouverture anticipée') return;

                                const actionGroupId = parseInt(action.gf);
                                const isGroup1 = actionGroupId === intersection.selectedGroup1;
                                const isGroup2 = actionGroupId === intersection.selectedGroup2;
                                if (!isGroup1 && !isGroup2) return;

                                const yAction = isGroup1 ? yG1 : yG2;
                                const actionStart = parseInt(action.deb) + cycleOffset;
                                const actionEnd = parseInt(action.fin) + cycleOffset;
                                const actionDuration = actionEnd - actionStart;

                                if (action.action === 'Seconde lucarne') {
                                    // Seconde lucarne - darker green bar
                                    bars.push(
                                        <rect
                                            key={`lucarne-${idx}-${actionIdx}-c${cycle}`}
                                            x={timeToX(actionStart)}
                                            y={yAction - barHeight / 2 - 2}
                                            width={actionDuration * pixelsPerSecond}
                                            height={barHeight}
                                            fill={isGroup1 ? '#E65100' : '#2E7D32'}
                                            opacity={0.9}
                                            stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                            strokeWidth={1}
                                        />
                                    );
                                } else if (action.action === 'Ouverture anticipée') {
                                    // Ouverture anticipée - hatched rectangle
                                    const patternId = `hatch-${idx}-${actionIdx}-${cycle}`;
                                    bars.push(
                                        <g key={`oa-${idx}-${actionIdx}-c${cycle}`}>
                                            <defs>
                                                <pattern id={patternId} patternUnits="userSpaceOnUse" width="4" height="4">
                                                    <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
                                                          stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                                          strokeWidth="1" />
                                                </pattern>
                                            </defs>
                                            <rect
                                                x={timeToX(actionStart)}
                                                y={yAction - barHeight / 2}
                                                width={actionDuration * pixelsPerSecond}
                                                height={barHeight}
                                                fill={`url(#${patternId})`}
                                                stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                                strokeWidth={1}
                                            />
                                        </g>
                                    );
                                }
                            });
                        }

                        // Helper to truncate names to 40 characters
                        const truncateName = (name, maxLen = 40) => {
                            if (!name) return '';
                            return name.length > maxLen ? name.substring(0, maxLen) + '…' : name;
                        };

                        return (
                            <g key={`intersection-${idx}`}>
                                {/* Group 1 name (Descendant) */}
                                {group1 && (
                                    <text
                                        x={PADDING_LEFT - 5}
                                        y={yG1 + 4}
                                        textAnchor="end"
                                        fill="#FF9800"
                                        fontSize="13"
                                        fontWeight="bold"
                                    >
                                        {`G${group1.id} - ${truncateName(group1.name) || 'Sans nom'}`}
                                    </text>
                                )}

                                {/* Project name - 16px above group 1 (Descendant) */}
                                <text
                                    x={PADDING_LEFT - 5}
                                    y={yG1 - 12}
                                    textAnchor="end"
                                    fill="#fff"
                                    fontSize="13"
                                    fontWeight="bold"
                                >
                                    {truncateName(intersection.projectName)}
                                </text>

                                {/* Group 2 name (Montant) */}
                                {group2 && (
                                    <text
                                        x={PADDING_LEFT - 5}
                                        y={yG2 + 4}
                                        textAnchor="end"
                                        fill="#8BC34A"
                                        fontSize="13"
                                        fontWeight="bold"
                                    >
                                        {`G${group2.id} - ${truncateName(group2.name) || 'Sans nom'}`}
                                    </text>
                                )}

                                {/* Horizontal lines at each group position */}
                                <line
                                    x1={PADDING_LEFT}
                                    y1={yG1}
                                    x2={diagramWidth - PADDING_RIGHT}
                                    y2={yG1}
                                    stroke="#FF9800"
                                    strokeWidth={0.5}
                                    strokeDasharray="2,2"
                                    opacity={0.3}
                                />
                                <line
                                    x1={PADDING_LEFT}
                                    y1={yG2}
                                    x2={diagramWidth - PADDING_RIGHT}
                                    y2={yG2}
                                    stroke="#8BC34A"
                                    strokeWidth={0.5}
                                    strokeDasharray="2,2"
                                    opacity={0.3}
                                />

                                <g clipPath="url(#bars-clip)">
                                    {bars}
                                </g>
                            </g>
                        );
                    })}

                    {/* Clip path pour tronquer les bandes passantes à gauche de l'axe Y */}
                    <defs>
                        <clipPath id="bandwidth-clip">
                            <rect x={PADDING_LEFT} y={0} width={diagramWidth - PADDING_LEFT} height={diagramHeight} />
                        </clipPath>
                        {/* Clip path pour les barres de vert : coupe à gauche
                            (t=0) ET à droite (fin du dernier cycle visible).
                            Les portions qui wrap au-delà sont masquées. */}
                        <clipPath id="bars-clip">
                            <rect x={PADDING_LEFT} y={0}
                                  width={diagramWidth - PADDING_LEFT - PADDING_RIGHT}
                                  height={diagramHeight} />
                        </clipPath>
                    </defs>

                    <g clipPath="url(#bandwidth-clip)">
                    {/* Ascending bandwidth corridor (bottom to top) - as polygon surface with segments */}
                    {bandwidthData?.ascending?.segments && intersections && (() => {
                        // Sort by distanceG2 for ascending (Group 2)
                        const sortedByDistG2 = [...intersections].sort((a, b) =>
                            (a.distanceG2 ?? a.distance) - (b.distanceG2 ?? b.distance)
                        );
                        const segments = bandwidthData.ascending.segments;

                        const elements = [];

                        // Draw each segment as a separate polygon
                        segments.forEach((segment, segIdx) => {
                            const { startIdx, endIdx, width, start, refDistance } = segment;

                            for (let cycle = -1; cycle < displayCycles; cycle++) {
                                const cycleOffset = cycle * cycleLength;
                                const bandStartAtRef = start + cycleOffset;
                                const bandEndAtRef = bandStartAtRef + width;

                                const leftPoints = [];
                                const rightPoints = [];

                                // Process intersections in this segment
                                // Include endIdx + 1 if it exists to ensure we have at least 2 points for polygon
                                const actualEndIdx = Math.min(
                                    endIdx < sortedByDistG2.length - 1 ? endIdx + 1 : endIdx,
                                    sortedByDistG2.length - 1
                                );

                                for (let i = startIdx; i <= actualEndIdx; i++) {
                                    const intersection = sortedByDistG2[i];
                                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                                    if (!group) continue;

                                    const distG2 = intersection.distanceG2 ?? intersection.distance;
                                    const y = distanceToY(distG2);

                                    // Time to travel from segment's reference distance
                                    const travelTime = (distG2 - refDistance) / speedUpMps;

                                    const bandStart = bandStartAtRef + travelTime;
                                    const bandEnd = bandEndAtRef + travelTime;

                                    leftPoints.push({ x: timeToX(bandStart), y });
                                    rightPoints.push({ x: timeToX(bandEnd), y });
                                }

                                if (leftPoints.length >= 2) {
                                    const polygonPoints = [
                                        ...leftPoints.map(p => `${p.x},${p.y}`),
                                        ...[...rightPoints].reverse().map(p => `${p.x},${p.y}`)
                                    ].join(' ');

                                    elements.push(
                                        <polygon
                                            key={`asc-polygon-seg${segIdx}-c${cycle}`}
                                            points={polygonPoints}
                                            fill="#4CAF50"
                                            opacity={0.2}
                                            stroke="#81C784"
                                            strokeWidth={2}
                                        />
                                    );
                                }
                            }
                        });

                        return elements;
                    })()}

                    {/* Descending bandwidth corridor (top to bottom) - as polygon surface with segments */}
                    {bandwidthData?.descending?.segments && intersections && (() => {
                        // Sort by distance for descending (Group 1) - top to bottom
                        const sortedByDistG1 = [...intersections].sort((a, b) => a.distance - b.distance);
                        const sortedTopToBottom = [...sortedByDistG1].reverse();
                        const segments = bandwidthData.descending.segments;

                        const elements = [];

                        // Draw each segment as a separate polygon
                        segments.forEach((segment, segIdx) => {
                            const { startIdx, endIdx, width, start, refDistance } = segment;

                            for (let cycle = -1; cycle < displayCycles; cycle++) {
                                const cycleOffset = cycle * cycleLength;
                                const bandStartAtRef = start + cycleOffset;
                                const bandEndAtRef = bandStartAtRef + width;

                                const leftPoints = [];
                                const rightPoints = [];

                                // Process intersections in this segment
                                // Include endIdx + 1 if it exists to ensure we have at least 2 points for polygon
                                const actualEndIdx = Math.min(
                                    endIdx < sortedTopToBottom.length - 1 ? endIdx + 1 : endIdx,
                                    sortedTopToBottom.length - 1
                                );

                                for (let i = startIdx; i <= actualEndIdx; i++) {
                                    const intersection = sortedTopToBottom[i];
                                    const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                                    if (!group) continue;

                                    const dist = intersection.distance;
                                    const y = distanceToY(dist);

                                    // Time to travel from segment's reference distance (going down)
                                    const travelTime = (refDistance - dist) / speedDownMps;

                                    const bandStart = bandStartAtRef + travelTime;
                                    const bandEnd = bandEndAtRef + travelTime;

                                    leftPoints.push({ x: timeToX(bandStart), y });
                                    rightPoints.push({ x: timeToX(bandEnd), y });
                                }

                                if (leftPoints.length >= 2) {
                                    const polygonPoints = [
                                        ...leftPoints.map(p => `${p.x},${p.y}`),
                                        ...[...rightPoints].reverse().map(p => `${p.x},${p.y}`)
                                    ].join(' ');

                                    elements.push(
                                        <polygon
                                            key={`desc-polygon-seg${segIdx}-c${cycle}`}
                                            points={polygonPoints}
                                            fill="#FF9800"
                                            opacity={0.2}
                                            stroke="#FFAB91"
                                            strokeWidth={2}
                                        />
                                    );
                                }
                            }
                        });

                        return elements;
                    })()}
                    </g>

                    {/* X Axis (Time) */}
                    <line
                        x1={PADDING_LEFT}
                        y1={diagramHeight - PADDING_BOTTOM}
                        x2={diagramWidth - PADDING_RIGHT}
                        y2={diagramHeight - PADDING_BOTTOM}
                        className="green-wave-axis"
                        strokeWidth={1}
                    />

                    {/* X Axis ticks and labels */}
                    {timeTicks.map(t => (
                        <g key={`tick-t-${t}`}>
                            <line
                                x1={timeToX(t)}
                                y1={diagramHeight - PADDING_BOTTOM}
                                x2={timeToX(t)}
                                y2={diagramHeight - PADDING_BOTTOM + 5}
                                className="green-wave-axis"
                            />
                            <text
                                x={timeToX(t)}
                                y={diagramHeight - PADDING_BOTTOM + 18}
                                textAnchor="middle"
                                className="green-wave-axis-tick"
                                fontSize="10"
                            >
                                {t}
                            </text>
                        </g>
                    ))}

                    {/* X Axis label */}
                    <text
                        x={diagramWidth / 2}
                        y={diagramHeight - 8}
                        textAnchor="middle"
                        className="green-wave-axis-label"
                        fontSize="12"
                    >
                        Temps (s)
                    </text>

                    {/* Y Axis (Distance) */}
                    <line
                        x1={PADDING_LEFT}
                        y1={PADDING_TOP}
                        x2={PADDING_LEFT}
                        y2={diagramHeight - PADDING_BOTTOM}
                        className="green-wave-axis"
                        strokeWidth={1}
                    />

                    {/* Y Axis ticks and labels */}
                    {distanceTicks.map(d => (
                        <g key={`tick-d-${d}`}>
                            <line
                                x1={PADDING_LEFT - 5}
                                y1={distanceToY(d)}
                                x2={PADDING_LEFT}
                                y2={distanceToY(d)}
                                className="green-wave-axis"
                            />
                            <text
                                x={PADDING_LEFT - 8}
                                y={distanceToY(d) + 4}
                                textAnchor="end"
                                className="green-wave-axis-tick"
                                fontSize="10"
                            >
                                {d}
                            </text>
                        </g>
                    ))}

                    {/* Y Axis label */}
                    <text
                        x={15}
                        y={diagramHeight / 2}
                        textAnchor="middle"
                        className="green-wave-axis-label"
                        fontSize="12"
                        transform={`rotate(-90, 15, ${diagramHeight / 2})`}
                    >
                        Distance (m)
                    </text>
                </svg>
            </div>

            <div className="green-wave-legend">
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#FF9800' }}></div>
                    <span>Groupe 1 (descendant)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#8BC34A' }}></div>
                    <span>Groupe 2 (montant)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-line" style={{ borderColor: '#4CAF50' }}></div>
                    <span>V. montante: {speedUp} km/h</span>
                </div>
                <div className="legend-item">
                    <div className="legend-line" style={{ borderColor: '#FF9800' }}></div>
                    <span>V. descendante: {speedDown} km/h</span>
                </div>
                {bandwidthData?.ascending && (
                    <div className="legend-item">
                        <div className="legend-bandwidth" style={{ background: 'rgba(76, 175, 80, 0.3)', borderColor: '#4CAF50' }}></div>
                        <span>Montant: {bandwidthData.ascending.width.toFixed(1)}s</span>
                    </div>
                )}
                {bandwidthData?.descending && (
                    <div className="legend-item">
                        <div className="legend-bandwidth" style={{ background: 'rgba(255, 152, 0, 0.3)', borderColor: '#FF9800' }}></div>
                        <span>Descendant: {bandwidthData.descending.width.toFixed(1)}s</span>
                    </div>
                )}
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#2E7D32', border: '1px solid #4CAF50' }}></div>
                    <span>Seconde lucarne</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{
                        background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #4CAF50 2px, #4CAF50 4px)',
                        border: '1px solid #4CAF50'
                    }}></div>
                    <span>Ouverture anticipée</span>
                </div>
            </div>

            {/* Parameters panel — rendu inline ou en popup détachée */}
            {!showFloatingDataTable && dataPanelJSX}

            {/* Modale « À propos » de la fenêtre Onde verte */}
            {showAboutModal && (
                <div
                    className="gw-about-overlay"
                    onClick={() => setShowAboutModal(false)}
                >
                    <div className="gw-about-modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', position: 'relative' }}>
                            <img
                                src="./logo.svg"
                                alt=""
                                style={{ position: 'absolute', top: '0', right: '0', width: '80px', height: '80px', userSelect: 'none', pointerEvents: 'none' }}
                            />
                            <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#4ecdc4', marginBottom: '8px' }}>
                                {APP_NAME}
                            </div>
                            <div style={{ fontSize: '1.1em', color: '#aaa', marginBottom: '4px' }}>
                                Version {APP_VERSION}
                            </div>
                            <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '20px', maxWidth: '420px', margin: '0 auto 20px' }}>
                                {APP_DESCRIPTION}
                            </div>
                            <div style={{ fontSize: '0.95em', marginBottom: '16px' }}>
                                <div>Module <strong>Onde verte</strong></div>
                                <div style={{ marginTop: '4px', color: '#aaa' }}>Conception d'ondes vertes bidirectionnelles modérantes</div>
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
                            <button
                                className="gw-about-close"
                                onClick={() => setShowAboutModal(false)}
                                style={{ marginTop: '20px' }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Création d'une nouvelle onde verte dans la fenêtre courante */}
            <CreateGreenWaveDialog
                isOpen={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                onConfirm={handleCreateGreenWaveLocal}
                getAllSaves={getAllSavesLocal}
                loadProjectData={getProjectDataLocal}
            />

            {/* Aide : modale locale qui réutilise le composant HelpContent
                partagé avec l'app principale, focalisée sur le chapitre Onde
                verte au moment de l'ouverture. */}
            <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="Aide - TraCflux" className="modal-wide">
                <HelpContent initialAnchor="help-onde-verte" />
            </Modal>

            {/* Sélecteur de projet pour le « + Ajouter un carrefour ».
                Remplace l'ancien window.prompt natif (invisible en mode popup
                détachée et bloqué dans certains contextes PWA). */}
            <Modal
                isOpen={addCarrefourModalOpen}
                onClose={() => { setAddCarrefourModalOpen(false); setAddCarrefourSelected(null); }}
                title="Ajouter un carrefour à l'onde verte"
            >
                {addCarrefourCandidates.length > 0 ? (
                    <>
                        <div className="project-list-container">
                            <ul className="project-list">
                                {addCarrefourCandidates.map(name => (
                                    <li
                                        key={name}
                                        className={addCarrefourSelected === name ? 'selected' : ''}
                                        onClick={() => setAddCarrefourSelected(name)}
                                        onDoubleClick={() => confirmAddCarrefour(name)}
                                    >
                                        <span className="project-icon"></span>
                                        <div className="project-info-modal">
                                            <span className="project-name">{name}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="modal-actions">
                            <button
                                className="modal-btn modal-btn-secondary"
                                onClick={() => { setAddCarrefourModalOpen(false); setAddCarrefourSelected(null); }}
                            >
                                Annuler
                            </button>
                            <button
                                className="modal-btn modal-btn-primary"
                                onClick={() => confirmAddCarrefour()}
                                disabled={!addCarrefourSelected}
                            >
                                Ajouter
                            </button>
                        </div>
                    </>
                ) : null}
            </Modal>

            {renderRestoreModal()}
        </div>
    );
};

export default GreenWavePage;
