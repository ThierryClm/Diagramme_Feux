import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { useMicroVariables } from './MicroVariablesProvider';
import { DEFAULT_MICRO_VARIABLES } from '../utils/microVariables';
import './MicroVariablesDialog.css';

/**
 * Fenêtre de référence évolutive des variables prédéfinies de micro-régulation
 * (Priorité Bus). Liste éditable : ces noms sont ceux colorés en violet dans les
 * conditions micro. L'édition se fait sur un brouillon local, validé par
 * « Enregistrer » (persistance dans les réglages de l'application).
 */
const MicroVariablesDialog = ({ isOpen, onClose, tooltipsEnabled = true }) => {
    const tip = (text) => (tooltipsEnabled ? text : undefined);
    const { variables, setVariables } = useMicroVariables();
    const [rows, setRows] = useState([]);

    // Recharge le brouillon depuis la liste courante à chaque ouverture.
    useEffect(() => {
        if (isOpen) setRows(variables.map(v => ({ ...v })));
    }, [isOpen, variables]);

    const updateRow = (index, field, value) =>
        setRows(rs => rs.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

    const removeRow = (index) => setRows(rs => rs.filter((_, i) => i !== index));

    const addRow = () => setRows(rs => [...rs, { name: '', description: '' }]);

    const resetDefaults = () => setRows(DEFAULT_MICRO_VARIABLES.map(v => ({ ...v })));

    const handleSave = () => {
        setVariables(rows); // le provider nettoie (noms vides / doublons) et persiste
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Variables Priorité Bus"
            className="micro-variables-modal"
        >
            <p className="micro-variables-intro">
                Ces variables sont reconnues dans les conditions de micro-régulation et
                s'y affichent en <span className="micro-keyword">violet</span> (avec leur
                suffixe : <span className="micro-keyword">DA2</span>,{' '}
                <span className="micro-keyword">TMAB0</span>…). La liste est enregistrée
                dans les réglages de l'application.
            </p>

            <div className="micro-variables-table" role="table">
                <div className="micro-variables-head" role="row">
                    <span role="columnheader">Variable</span>
                    <span role="columnheader">Signification</span>
                    <span role="columnheader" aria-label="Actions" />
                </div>
                {rows.length === 0 && (
                    <div className="micro-variables-empty">Aucune variable — ajoutez-en une ci-dessous.</div>
                )}
                {rows.map((row, i) => (
                    <div className="micro-variables-row" role="row" key={i}>
                        <input
                            className="micro-variables-name"
                            value={row.name}
                            placeholder="Nom"
                            onChange={(e) => updateRow(i, 'name', e.target.value)}
                        />
                        <textarea
                            className="micro-variables-desc"
                            value={row.description}
                            placeholder="Signification (facultatif)"
                            rows={2}
                            onChange={(e) => updateRow(i, 'description', e.target.value)}
                        />
                        <button
                            className="micro-variables-remove"
                            onClick={() => removeRow(i)}
                            title={tip('Supprimer cette variable')}
                            aria-label="Supprimer cette variable"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            <button className="micro-variables-add" onClick={addRow}>
                + Ajouter une variable
            </button>

            <div className="modal-actions">
                <button
                    className="modal-btn modal-btn-secondary"
                    onClick={resetDefaults}
                    title={tip('Rétablir la liste fournie par défaut')}
                >
                    Réinitialiser
                </button>
                <span className="micro-variables-spacer" />
                <button className="modal-btn modal-btn-secondary" onClick={onClose}>
                    Annuler
                </button>
                <button className="modal-btn modal-btn-primary" onClick={handleSave}>
                    Enregistrer
                </button>
            </div>
        </Modal>
    );
};

export default MicroVariablesDialog;
