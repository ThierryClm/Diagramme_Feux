import { useState, useEffect } from 'react';

/**
 * Gère le thème de couleur et les options d'affichage.
 *
 * Thèmes :
 * - 'dark' : blanc sur fond noir (défaut)
 * - 'light' : noir sur fond blanc
 * - 'high-contrast' : couleurs vives sur fond bleu foncé, meilleure lisibilité
 * - 'amber' : contraste ambre/or sur fond anthracite, chaleureux et lisible
 * - 'daltonian' : palette sans axe rouge/vert (bleu/orange) pour daltoniens
 * - 'sepia' : tons sépia chauds, anti-fatigue pour longues sessions
 * - 'blue-night' : palette « Solarized Dark », bleu-vert profond
 */
const useDarkMode = () => {
    const [colorTheme, setColorTheme] = useState(() => {
        return localStorage.getItem('colorTheme') || 'dark';
    });
    // Backward compatibility: darkMode derived from colorTheme
    const darkMode = colorTheme !== 'light' && colorTheme !== 'sepia';
    const setDarkMode = (val) => setColorTheme(val ? 'dark' : 'light');

    const [showComments, setShowComments] = useState(true);
    const [showRemarks, setShowRemarks] = useState(true);
    // Les noms de GF sont persistés au niveau application (localStorage) :
    // c'est une préférence de lecture qui voyage entre projets, pas une
    // configuration spécifique à un projet précis.
    const readBoolLS = (key, fallback) => {
        try {
            const v = localStorage.getItem(key);
            return v === null ? fallback : v === 'true';
        } catch {
            return fallback;
        }
    };
    const [showGroupNamesForm, setShowGroupNamesForm] = useState(() => readBoolLS('showGroupNamesForm', true));
    const [showGroupNamesMatrix, setShowGroupNamesMatrix] = useState(() => readBoolLS('showGroupNamesMatrix', true));
    const [showGroupNamesDiagram, setShowGroupNamesDiagram] = useState(() => readBoolLS('showGroupNamesDiagram', true));
    const [showActionDescription, setShowActionDescription] = useState(true);

    useEffect(() => {
        try { localStorage.setItem('showGroupNamesForm', String(showGroupNamesForm)); } catch {}
    }, [showGroupNamesForm]);
    useEffect(() => {
        try { localStorage.setItem('showGroupNamesMatrix', String(showGroupNamesMatrix)); } catch {}
    }, [showGroupNamesMatrix]);
    useEffect(() => {
        try { localStorage.setItem('showGroupNamesDiagram', String(showGroupNamesDiagram)); } catch {}
    }, [showGroupNamesDiagram]);

    useEffect(() => {
        localStorage.setItem('colorTheme', colorTheme);
        document.body.classList.remove(
            'light-mode', 'high-contrast-mode', 'amber-mode',
            'daltonian-mode', 'sepia-mode', 'blue-night-mode'
        );
        if (colorTheme === 'light') {
            document.body.classList.add('light-mode');
        } else if (colorTheme === 'high-contrast') {
            document.body.classList.add('high-contrast-mode');
        } else if (colorTheme === 'amber') {
            document.body.classList.add('amber-mode');
        } else if (colorTheme === 'daltonian') {
            document.body.classList.add('daltonian-mode');
        } else if (colorTheme === 'sepia') {
            document.body.classList.add('sepia-mode');
        } else if (colorTheme === 'blue-night') {
            document.body.classList.add('blue-night-mode');
        }
    }, [colorTheme]);

    return {
        darkMode, setDarkMode,
        colorTheme, setColorTheme,
        showComments, setShowComments,
        showRemarks, setShowRemarks,
        showGroupNamesForm, setShowGroupNamesForm,
        showGroupNamesMatrix, setShowGroupNamesMatrix,
        showGroupNamesDiagram, setShowGroupNamesDiagram,
        showActionDescription, setShowActionDescription
    };
};

export default useDarkMode;
