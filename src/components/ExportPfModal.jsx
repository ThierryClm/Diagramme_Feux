import React, { useState } from 'react';
import Modal from './Modal';
import './ExportPfModal.css';

/**
 * Modale d'export sélectif : choix des plans de feux à inclure dans le fichier
 * exporté. N'est montée que lorsqu'elle est ouverte (pas de prop isOpen).
 *
 * - pfTabs : plans de feux du projet ({ id, name }).
 * - activePFId : PF actif (signalé « actif »).
 * - onExport(selectedIds) : lance l'export avec les ids cochés.
 * - onClose() : ferme sans exporter.
 */
const ExportPfModal = ({ pfTabs = [], activePFId, onExport, onClose }) => {
    const [selected, setSelected] = useState(() => new Set(pfTabs.map(p => p.id)));
    const [readOnly, setReadOnly] = useState(false);

    const toggle = (id) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const allSelected = pfTabs.length > 0 && selected.size === pfTabs.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pfTabs.map(p => p.id)));

    return (
        <Modal isOpen onClose={onClose} title="Exporter des plans de feux" className="export-pf-modal">
            <p className="export-pf-hint">
                Choisissez les plans de feux à inclure dans le fichier exporté. Les
                données communes (groupes, matrice, trafic, image, propriétés) sont
                conservées. Votre projet courant n'est pas modifié.
            </p>

            <label className="export-pf-all">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <span>Tout sélectionner</span>
            </label>

            <ul className="export-pf-list">
                {pfTabs.map(p => (
                    <li key={p.id}>
                        <label>
                            <input
                                type="checkbox"
                                checked={selected.has(p.id)}
                                onChange={() => toggle(p.id)}
                            />
                            <span>{p.name || `PF${p.id}`}</span>
                            {p.id === activePFId && <span className="export-pf-active">actif</span>}
                        </label>
                    </li>
                ))}
            </ul>

            <label className="export-pf-readonly">
                <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
                <span>
                    Dossier en <strong>lecture seule</strong>
                    <small>À l'ouverture, les données d'entrée seront verrouillées (pour transmettre le dossier en visualisation). Verrou de convention, pas une protection forte.</small>
                </span>
            </label>

            <div className="modal-actions">
                <button className="modal-btn modal-btn-secondary" onClick={onClose}>Annuler</button>
                <button
                    className="modal-btn modal-btn-primary"
                    disabled={selected.size === 0}
                    onClick={() => onExport(Array.from(selected), readOnly)}
                >
                    Exporter{selected.size > 0 ? ` (${selected.size})` : ''}
                </button>
            </div>
        </Modal>
    );
};

export default ExportPfModal;
