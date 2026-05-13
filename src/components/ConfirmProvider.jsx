import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import Modal from './Modal';

/**
 * Système de confirmation unifié, en remplacement de window.confirm() qui
 * affiche un dialog natif marqué « localhost dit : » (ou la même chose avec
 * le nom de domaine en production). La modale React respecte les thèmes de
 * l'app et permet des libellés de boutons explicites.
 *
 * Usage :
 *   const confirm = useConfirm();
 *   if (await confirm({
 *       title: 'Supprimer',
 *       message: 'Confirmer la suppression ?',
 *       confirmLabel: 'Supprimer',
 *       danger: true,
 *   })) {
 *       // action confirmée
 *   }
 *
 * Le hook retourne une fonction qui prend des options et retourne une
 * Promise<boolean>. L'appelant doit être async (ou utiliser .then).
 */

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
    const [state, setState] = useState(null);
    // Ref pour résoudre la promesse même si le composant est démonté entre temps
    const resolverRef = useRef(null);

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setState({
                title: options.title || 'Confirmation',
                message: options.message || '',
                confirmLabel: options.confirmLabel || 'Confirmer',
                cancelLabel: options.cancelLabel || 'Annuler',
                danger: options.danger === true,
            });
        });
    }, []);

    const handleConfirm = () => {
        if (resolverRef.current) {
            resolverRef.current(true);
            resolverRef.current = null;
        }
        setState(null);
    };

    const handleCancel = () => {
        if (resolverRef.current) {
            resolverRef.current(false);
            resolverRef.current = null;
        }
        setState(null);
    };

    // Touche Échap = Annuler, touche Entrée = Confirmer
    useEffect(() => {
        if (!state) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [state]);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Modal isOpen={!!state} onClose={handleCancel} title={state?.title || ''}>
                <div style={{ padding: '4px 0' }}>
                    <div style={{ whiteSpace: 'pre-wrap', color: '#e0e0e0', lineHeight: 1.5, marginBottom: '20px' }}>
                        {state?.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={handleCancel}
                            style={{
                                background: '#555',
                                color: '#fff',
                                border: '1px solid #666',
                                padding: '6px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9em',
                            }}
                        >
                            {state?.cancelLabel}
                        </button>
                        <button
                            onClick={handleConfirm}
                            autoFocus
                            style={{
                                background: state?.danger ? '#c62828' : '#4ecdc4',
                                color: state?.danger ? '#fff' : '#1e1e1e',
                                border: '1px solid ' + (state?.danger ? '#a01818' : '#3aaca4'),
                                padding: '6px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9em',
                                fontWeight: 'bold',
                            }}
                        >
                            {state?.confirmLabel}
                        </button>
                    </div>
                </div>
            </Modal>
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        // Fallback : si le composant n'est pas dans un ConfirmProvider, on retombe
        // sur window.confirm() pour ne rien casser. Devrait jamais arriver en prod.
        console.warn('useConfirm called outside ConfirmProvider, falling back to window.confirm');
        return ({ message }) => Promise.resolve(window.confirm(message));
    }
    return ctx;
};

export default ConfirmProvider;
