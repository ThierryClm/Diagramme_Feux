import { useState, useEffect } from 'react';

/**
 * Gère le mode sombre/clair et les options d'affichage des noms et commentaires.
 */
const useDarkMode = () => {
    const [darkMode, setDarkMode] = useState(true);
    const [showComments, setShowComments] = useState(true);
    const [showRemarks, setShowRemarks] = useState(true);
    const [showGroupNamesForm, setShowGroupNamesForm] = useState(true);
    const [showGroupNamesMatrix, setShowGroupNamesMatrix] = useState(true);
    const [showGroupNamesDiagram, setShowGroupNamesDiagram] = useState(true);

    useEffect(() => {
        document.body.classList.toggle('light-mode', !darkMode);
    }, [darkMode]);

    return {
        darkMode, setDarkMode,
        showComments, setShowComments,
        showRemarks, setShowRemarks,
        showGroupNamesForm, setShowGroupNamesForm,
        showGroupNamesMatrix, setShowGroupNamesMatrix,
        showGroupNamesDiagram, setShowGroupNamesDiagram
    };
};

export default useDarkMode;
