import React, { useState } from 'react';
import Modal from './Modal';
import './ExportPfModal.css';

/**
 * Modale « Copier la matrice depuis… » : choisir le plan de feux SOURCE dont la
 * matrice d'interverts sera copiée dans le plan de feux actif. Le PF actif est
 * exclu de la liste (copier depuis soi-même n'a pas de sens).
 *
 * - pfTabs : plans de feux du projet ({ id, name, readOnly }).
 * - activePFId : PF actif (destination), exclu des sources.
 * - onCopy(sourceId) : lance la copie.
 * - onClose() : annule.
 */
const CopyMatrixModal = ({ pfTabs = [], activePFId, onCopy, onClose }) => {
    const sources = pfTabs.filter(p => p.id !== activePFId);
    const [sourceId, setSourceId] = useState(sources[0]?.id ?? null);
    const activeName = pfTabs.find(p => p.id === activePFId)?.name || 'actif';

    return (
        <Modal isOpen onClose={onClose} title="Copier la matrice depuis…" className="export-pf-modal">
            <p className="export-pf-hint">
                Copier la <strong>matrice d'interverts</strong> d'un autre plan de feux dans «&nbsp;{activeName}&nbsp;» (plan actif). Sa matrice actuelle sera remplacée.
            </p>

            <ul className="export-pf-list">
                {sources.map(p => (
                    <li key={p.id}>
                        <label>
                            <input
                                type="radio"
                                name="copy-matrix-source"
                                checked={sourceId === p.id}
                                onChange={() => setSourceId(p.id)}
                            />
                            <span>{p.name || `PF${p.id}`}</span>
                            {p.readOnly && <span className="pf-tab-lock" title="Plan importé, en lecture seule">🔒</span>}
                        </label>
                    </li>
                ))}
            </ul>

            <div className="modal-actions">
                <button className="modal-btn modal-btn-secondary" onClick={onClose}>Annuler</button>
                <button
                    className="modal-btn modal-btn-primary"
                    disabled={sourceId == null}
                    onClick={() => onCopy(sourceId)}
                >
                    Copier
                </button>
            </div>
        </Modal>
    );
};

export default CopyMatrixModal;
