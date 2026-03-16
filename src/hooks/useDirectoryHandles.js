import { useRef, useEffect, useCallback } from 'react';

/**
 * Gère les handles de répertoires via IndexedDB (File System Access API).
 * Mémorise les 5 derniers répertoires utilisés (ouverture, sauvegarde, import, image, onde verte)
 * et les restaure au démarrage.
 */
const useDirectoryHandles = () => {
    const lastOpenDirectoryRef = useRef(null);
    const lastSaveDirectoryRef = useRef(null);
    const lastImportDirectoryRef = useRef(null);
    const lastImageDirectoryRef = useRef(null);
    const lastGreenWaveDirectoryRef = useRef(null);

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

    return {
        lastOpenDirectoryRef,
        lastSaveDirectoryRef,
        lastImportDirectoryRef,
        lastImageDirectoryRef,
        lastGreenWaveDirectoryRef,
        saveDirectoryHandle,
        loadDirectoryHandle
    };
};

export default useDirectoryHandles;
