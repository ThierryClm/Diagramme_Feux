import { useState, useRef, useEffect } from 'react';

/**
 * Suit les modifications du projet et avertit avant fermeture si non sauvegardé.
 *
 * @param {Array} deps - Dépendances qui déclenchent le marquage "modifié"
 *   (groups, actionData, cycleLength, conflictMatrix, projectProperties, intersectionName)
 */
const useProjectModification = (deps) => {
    const [projectModified, setProjectModified] = useState(false);
    // True when user has modified the project since last save — used to display
    // the "unsaved changes" indicator (asterisk) in the UI. Also drives beforeunload.
    const [isDirty, setIsDirty] = useState(false);
    const projectModifiedSkip = useRef(true);
    // Ref mirror of isDirty for use inside beforeunload handler (avoids stale closures)
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
            setIsDirty(true);
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
        setIsDirty(false);
    };

    // Wrap the ref setter so external callers (loaders/savers) also clear isDirty
    const setHasUnsavedChanges = (val) => {
        hasUnsavedChanges.current = val;
        setIsDirty(val);
    };

    return { projectModified, setProjectModified, resetModified, projectModifiedSkip, hasUnsavedChanges, isDirty, setHasUnsavedChanges };
};

export default useProjectModification;
