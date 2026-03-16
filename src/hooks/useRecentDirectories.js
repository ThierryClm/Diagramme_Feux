import { useState, useCallback } from 'react';

const loadFromStorage = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
};

/**
 * Gère les listes de répertoires récents (ouverture, sauvegarde, import, image, onde verte).
 */
const useRecentDirectories = () => {
    const [recentOpenDirs, setRecentOpenDirs] = useState(() => loadFromStorage('recentOpenDirs'));
    const [recentImportDirs, setRecentImportDirs] = useState(() => loadFromStorage('recentImportDirs'));
    const [recentImageDirs, setRecentImageDirs] = useState(() => loadFromStorage('recentImageDirs'));
    const [recentSaveDirs, setRecentSaveDirs] = useState(() => loadFromStorage('recentSaveDirs'));
    const [recentGreenWaveDirs, setRecentGreenWaveDirs] = useState(() => loadFromStorage('recentGreenWaveDirs'));

    const addRecentDirectory = useCallback((type, dirName) => {
        const updateList = (currentList, setList, storageKey) => {
            const newEntry = { name: dirName, timestamp: Date.now() };
            const filtered = currentList.filter(d => d.name !== dirName);
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

    return {
        recentOpenDirs,
        recentImportDirs,
        recentImageDirs,
        recentSaveDirs,
        recentGreenWaveDirs,
        addRecentDirectory
    };
};

export default useRecentDirectories;
