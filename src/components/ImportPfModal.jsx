import React, { useState } from 'react';
import Modal from './Modal';
import './ExportPfModal.css';

/**
 * Modale d'import d'un projet TraCflux externe : choix des plans de feux à
 * ajouter (tous cochés par défaut) et option lecture seule. Montée uniquement
 * lorsqu'elle est ouverte.
 *
 * - name : nom du fichier importé.
 * - pfTabs : plans de feux du projet importé ({ id, name }).
 * - onImport(selectedIds, readOnly) : lance la fusion.
 * - onClose() : annule.
 */
const ImportPfModal = ({ name, pfTabs = [], onImport, onClose }) => {
    const [selected, setSelected] = useState(() => new Set(pfTabs.map(p => p.id)));
    const [readOnly, setReadOnly] = useState(true); // coché par défaut

    const toggle = (id) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const allSelected = pfTabs.length > 0 && selected.size === pfTabs.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pfTabs.map(p => p.id)));

    return (
        <Modal isOpen onClose={onClose} title="Importer un projet TraCflux" className="export-pf-modal">
            <p className="export-pf-hint">
                Depuis «&nbsp;{name}&nbsp;». Les plans cochés sont ajoutés à la suite des vôtres, suffixés <code>_ext</code>. Même carrefour requis (mêmes groupes).
            </p>

            <label className="export-pf-all">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <span>Tout sélectionner</span>
            </label>

            <ul className="export-pf-list">
                {pfTabs.map(p => (
                    <li key={p.id}>
                        <label>
                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                            <span>{p.name || `PF${p.id}`}</span>
                        </label>
                    </li>
                ))}
            </ul>

            <label className="export-pf-readonly">
                <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
                <span>
                    Importer en <strong>lecture seule</strong>
                    <small>Plans importés verrouillés (référence) ; les vôtres restent éditables.</small>
                </span>
            </label>

            <div className="modal-actions">
                <button className="modal-btn modal-btn-secondary" onClick={onClose}>Annuler</button>
                <button
                    className="modal-btn modal-btn-primary"
                    disabled={selected.size === 0}
                    onClick={() => onImport(Array.from(selected), readOnly)}
                >
                    Importer{selected.size > 0 ? ` (${selected.size})` : ''}
                </button>
            </div>
        </Modal>
    );
};

export default ImportPfModal;
