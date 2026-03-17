import { useState, useRef, useEffect } from 'react';

/**
 * Suit les modifications du projet et avertit avant fermeture si non sauvegardé.
 *
 * @param {Array} deps - Dépendances qui déclenchent le marquage "modifié"
 *   (groups, actionData, cycleLength, conflictMatrix, projectProperties, intersectionName)
 */
const useProjectModification = (deps) => {
    const [projectModified, setProjectModified] = useState(false);
    const projectModifiedSkip = useRef(true);
    // Tracks actual user edits (distinct from "project is loaded") for beforeunload
    const hasUnsavedChanges = useRef(false);
    // Only track changes after all startup effects have settled
    const isReady = useRef(false);

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            isReady.current = true;
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        if (projectModifiedSkip.current) {
            projectModifiedSkip.current = false;
            return;
        }
        setProjectModified(true);
        if (isReady.current) {
            hasUnsavedChanges.current = true;
        }
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const resetModified = () => {
        setProjectModified(false);
        projectModifiedSkip.current = true;
        hasUnsavedChanges.current = false;
    };

    return { projectModified, setProjectModified, resetModified, projectModifiedSkip, hasUnsavedChanges };
};

export default useProjectModification;
