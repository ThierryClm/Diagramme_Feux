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
    // When true, ALL dep changes are absorbed (vs projectModifiedSkip which only
    // absorbs one). Set automatically par setHasUnsavedChanges(false) pour couvrir
    // les chargements / nouveaux projets où plusieurs setters successifs déclenchent
    // plusieurs runs de l'effet deps.
    const isLoading = useRef(false);

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            isReady.current = true;
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        if (isLoading.current) return; // bypass complet pendant un chargement
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
        // Bypass des changements de deps pendant le tick courant : couvre les
        // cas où resetToNewProject() ou loadFullState() déclenchent plusieurs
        // batches successifs.
        isLoading.current = true;
        // 300 ms : couvre la cascade de useEffects dérivés qui peuvent réécrire
        // groups / cycleLength / conflictMatrix après le batch initial (notamment
        // la reverse-sync PF qui se déclenche sur changement d'activePFId).
        setTimeout(() => { isLoading.current = false; }, 300);
    };

    // Wrap the ref setter so external callers (loaders/savers) also clear isDirty.
    // Quand on passe à false (chargement / sauvegarde réussie), on enclenche le
    // bypass pour absorber les effets dérivés qui s'enchaînent.
    const setHasUnsavedChanges = (val) => {
        hasUnsavedChanges.current = val;
        setIsDirty(val);
        if (!val) {
            isLoading.current = true;
            setTimeout(() => { isLoading.current = false; }, 300);
        }
    };

    return { projectModified, setProjectModified, resetModified, projectModifiedSkip, hasUnsavedChanges, isDirty, setHasUnsavedChanges };
};

export default useProjectModification;
