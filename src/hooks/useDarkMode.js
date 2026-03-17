import { useState, useEffect } from 'react';

/**
 * Gère le thème de couleur (dark/light/high-contrast) et les options d'affichage.
 *
 * Thèmes :
 * - 'dark' : blanc sur fond noir (défaut)
 * - 'light' : noir sur fond blanc
 * - 'high-contrast' : couleurs vives sur fond bleu foncé, meilleure lisibilité
 * - 'amber' : contraste ambre/or sur fond anthracite, chaleureux et lisible
 */
const useDarkMode = () => {
    const [colorTheme, setColorTheme] = useState(() => {
        return localStorage.getItem('colorTheme') || 'dark';
    });
    // Backward compatibility: darkMode derived from colorTheme
    const darkMode = colorTheme !== 'light';
    const setDarkMode = (val) => setColorTheme(val ? 'dark' : 'light');

    const [showComments, setShowComments] = useState(true);
    const [showRemarks, setShowRemarks] = useState(true);
    const [showGroupNamesForm, setShowGroupNamesForm] = useState(true);
    const [showGroupNamesMatrix, setShowGroupNamesMatrix] = useState(true);
    const [showGroupNamesDiagram, setShowGroupNamesDiagram] = useState(true);

    useEffect(() => {
        localStorage.setItem('colorTheme', colorTheme);
        document.body.classList.remove('light-mode', 'high-contrast-mode', 'amber-mode');
        if (colorTheme === 'light') {
            document.body.classList.add('light-mode');
        } else if (colorTheme === 'high-contrast') {
            document.body.classList.add('high-contrast-mode');
        } else if (colorTheme === 'amber') {
            document.body.classList.add('amber-mode');
        }
    }, [colorTheme]);

    return {
        darkMode, setDarkMode,
        colorTheme, setColorTheme,
        showComments, setShowComments,
        showRemarks, setShowRemarks,
        showGroupNamesForm, setShowGroupNamesForm,
        showGroupNamesMatrix, setShowGroupNamesMatrix,
        showGroupNamesDiagram, setShowGroupNamesDiagram
    };
};

export default useDarkMode;
