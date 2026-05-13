import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import Modal from './Modal';

/**
 * Système de dialogs unifié, en remplacement de window.confirm() et
 * window.alert() qui affichent un dialog natif marqué « localhost dit : »
 * (ou même chose avec le nom de domaine en production). Les modales React
 * respectent les thèmes de l'app et permettent des libellés explicites.
 *
 * Usage confirm (deux boutons, choix utilisateur) :
 *   const confirm = useConfirm();
 *   if (await confirm({
 *       title: 'Supprimer',
 *       message: 'Confirmer la suppression ?',
 *       confirmLabel: 'Supprimer',
 *       danger: true,
 *   })) { ... }
 *
 * Usage alert (un seul bouton OK, information bloquante) :
 *   const alert = useAlert();
 *   await alert({
 *       title: 'Erreur',
 *       message: 'Le fichier est invalide.',
 *   });
 *
 * Les deux hooks retournent une fonction qui prend des options et retourne
 * une Promise. confirm résout vers boolean ; alert résout vers undefined
 * mais permet d'attendre la fermeture si besoin.
 */

const DialogContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
    const [state, setState] = useState(null);
    // Ref pour résoudre la promesse même si le composant est démonté entre temps
    const resolverRef = useRef(null);

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setState({
                kind: 'confirm',
                title: options.title || 'Confirmation',
                message: options.message || '',
                confirmLabel: options.confirmLabel || 'Confirmer',
                cancelLabel: options.cancelLabel || 'Annuler',
                danger: options.danger === true,
            });
        });
    }, []);

    const alert = useCallback((options) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setState({
                kind: 'alert',
                title: options.title || 'Information',
                message: options.message || '',
                confirmLabel: options.confirmLabel || 'OK',
                danger: options.danger === true,
            });
        });
    }, []);

    const handleConfirm = () => {
        if (resolverRef.current) {
            // confirm résout true, alert résout undefined
            resolverRef.current(state?.kind === 'alert' ? undefined : true);
            resolverRef.current = null;
        }
        setState(null);
    };

    const handleCancel = () => {
        if (resolverRef.current) {
            // confirm résout false, alert résout undefined (clic Échap ou X)
            resolverRef.current(state?.kind === 'alert' ? undefined : false);
            resolverRef.current = null;
        }
        setState(null);
    };

    // Touche Échap = Annuler/Fermer, touche Entrée = Confirmer/OK
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

    const isAlert = state?.kind === 'alert';

    return (
        <DialogContext.Provider value={{ confirm, alert }}>
            {children}
            <Modal isOpen={!!state} onClose={handleCancel} title={state?.title || ''}>
                <div style={{ padding: '4px 0' }}>
                    <div style={{ whiteSpace: 'pre-wrap', color: '#e0e0e0', lineHeight: 1.5, marginBottom: '20px' }}>
                        {state?.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {!isAlert && (
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
                        )}
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
        </DialogContext.Provider>
    );
};

export const useConfirm = () => {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        // Fallback : si le composant n'est pas dans un ConfirmProvider, on retombe
        // sur window.confirm() pour ne rien casser. Devrait jamais arriver en prod.
        console.warn('useConfirm called outside ConfirmProvider, falling back to window.confirm');
        return ({ message }) => Promise.resolve(window.confirm(message));
    }
    return ctx.confirm;
};

export const useAlert = () => {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        console.warn('useAlert called outside ConfirmProvider, falling back to window.alert');
        return ({ message }) => { window.alert(message); return Promise.resolve(); };
    }
    return ctx.alert;
};

export default ConfirmProvider;
