import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
    DEFAULT_MICRO_VARIABLES,
    loadMicroVariables,
    saveMicroVariables,
} from '../utils/microVariables';

/**
 * Fournit la liste des variables prédéfinies de micro-régulation (Priorité Bus)
 * à toute l'application : coloration violette des conditions micro et fenêtre de
 * référence. Toute modification est persistée dans les réglages (localStorage).
 */
const MicroVariablesContext = createContext(null);

export const MicroVariablesProvider = ({ children }) => {
    const [variables, setVariablesState] = useState(() => loadMicroVariables());

    const setVariables = useCallback((next) => {
        setVariablesState(prev => {
            const value = typeof next === 'function' ? next(prev) : next;
            saveMicroVariables(value);
            return value;
        });
    }, []);

    // Recomposé seulement quand la liste change : évite de faire churner les
    // dépendances côté consommateurs (tokenizeMicroText).
    const names = useMemo(() => variables.map(v => v.name), [variables]);

    const value = useMemo(() => ({ variables, setVariables, names }), [variables, setVariables, names]);

    return (
        <MicroVariablesContext.Provider value={value}>
            {children}
        </MicroVariablesContext.Provider>
    );
};

/**
 * Repli sur les valeurs par défaut hors provider (tests unitaires de composants
 * isolés) : la coloration reste correcte, seule l'édition est neutralisée.
 */
const FALLBACK = {
    variables: DEFAULT_MICRO_VARIABLES,
    names: DEFAULT_MICRO_VARIABLES.map(v => v.name),
    setVariables: () => {},
};

export const useMicroVariables = () => useContext(MicroVariablesContext) || FALLBACK;
