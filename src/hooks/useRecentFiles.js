import { useState, useEffect } from 'react';

/**
 * Gère la liste des fichiers récents (ouverture) avec persistance localStorage.
 */
const useRecentFiles = () => {
    const [recentFiles, setRecentFiles] = useState([]);

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

    return {
        recentFiles,
        setRecentFiles,
        addToRecentFiles,
        getRecentDirectories,
        getRecentDirectoriesForMenu
    };
};

export default useRecentFiles;
