import React, { useState, useEffect } from 'react';
import './ExternalLinksModal.css';

const ExternalLinksModal = ({ isOpen, onClose, links = [], onLinksChange }) => {
    const [localLinks, setLocalLinks] = useState([]);
    const [newLinkName, setNewLinkName] = useState('');
    const [newLinkPath, setNewLinkPath] = useState('');
    const [editingId, setEditingId] = useState(null);

    // Sync local state with props when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalLinks(links);
        }
    }, [isOpen, links]);

    // Save links via callback
    const saveLinks = (newLinks) => {
        setLocalLinks(newLinks);
        if (onLinksChange) {
            onLinksChange(newLinks);
        }
    };

    // Add a new link
    const handleAddLink = () => {
        if (!newLinkName.trim() || !newLinkPath.trim()) {
            alert('Veuillez remplir le nom et le chemin du lien.');
            return;
        }

        const newLink = {
            id: Date.now(),
            name: newLinkName.trim(),
            path: newLinkPath.trim()
        };

        saveLinks([...localLinks, newLink]);
        setNewLinkName('');
        setNewLinkPath('');
    };

    // Delete a link
    const handleDeleteLink = (id) => {
        if (confirm('Supprimer ce lien ?')) {
            saveLinks(localLinks.filter(l => l.id !== id));
        }
    };

    // Start editing a link
    const handleEditLink = (link) => {
        setEditingId(link.id);
        setNewLinkName(link.name);
        setNewLinkPath(link.path);
    };

    // Save edited link
    const handleSaveEdit = () => {
        if (!newLinkName.trim() || !newLinkPath.trim()) {
            alert('Veuillez remplir le nom et le chemin du lien.');
            return;
        }

        saveLinks(localLinks.map(l =>
            l.id === editingId
                ? { ...l, name: newLinkName.trim(), path: newLinkPath.trim() }
                : l
        ));
        setEditingId(null);
        setNewLinkName('');
        setNewLinkPath('');
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setEditingId(null);
        setNewLinkName('');
        setNewLinkPath('');
    };

    // Open a link (file or URL)
    const handleOpenLink = (link) => {
        try {
            // Try to open as URL or file path
            const path = link.path;

            // Check if it's a URL
            if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
                window.open(path, '_blank');
            } else {
                // For local files, use file:// protocol
                // Note: This may have limitations in browsers due to security restrictions
                const fileUrl = path.startsWith('/') || path.match(/^[A-Za-z]:/)
                    ? `file:///${path.replace(/\\/g, '/')}`
                    : path;
                window.open(fileUrl, '_blank');
            }
        } catch (e) {
            console.error('Error opening link:', e);
            alert(`Impossible d'ouvrir le lien: ${e.message}`);
        }
    };

    // Browse for a file
    const handleBrowseFile = async () => {
        if (!window.showOpenFilePicker) {
            alert('La sélection de fichiers n\'est pas supportée par ce navigateur.');
            return;
        }

        try {
            const [fileHandle] = await window.showOpenFilePicker({
                multiple: false
            });

            // We can only get the file name, not the full path for security reasons
            const file = await fileHandle.getFile();
            setNewLinkPath(file.name);
            if (!newLinkName) {
                setNewLinkName(file.name.replace(/\.[^/.]+$/, '')); // Remove extension for name
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Error selecting file:', e);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="external-links-overlay">
            <div className="external-links-modal">
                <div className="external-links-header">
                    <h2>Liens externes</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="external-links-content">
                    {/* List of existing links */}
                    <div className="links-list">
                        {localLinks.length === 0 ? (
                            <p className="no-links">Aucun lien externe configuré.</p>
                        ) : (
                            localLinks.map(link => (
                                <div key={link.id} className="link-item">
                                    <div className="link-info" onDoubleClick={() => handleOpenLink(link)}>
                                        <span className="link-name">{link.name}</span>
                                        <span className="link-path" title={link.path}>{link.path}</span>
                                    </div>
                                    <div className="link-actions">
                                        <button
                                            className="btn-copy"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(link.path);
                                                alert('Chemin copié dans le presse-papiers');
                                            }}
                                            title="Copier le chemin"
                                        >
                                            📋
                                        </button>
                                        <button
                                            className="btn-edit"
                                            onClick={(e) => { e.stopPropagation(); handleEditLink(link); }}
                                            title="Modifier"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            className="btn-delete"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id); }}
                                            title="Supprimer"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add/Edit form */}
                    <div className="link-form">
                        <h4>{editingId ? 'Modifier le lien' : 'Ajouter un lien'}</h4>
                        <div className="form-row">
                            <label>Nom :</label>
                            <input
                                type="text"
                                value={newLinkName}
                                onChange={(e) => setNewLinkName(e.target.value)}
                                placeholder="Nom du raccourci"
                            />
                        </div>
                        <div className="form-row">
                            <label>Chemin :</label>
                            <div className="path-input-group">
                                <input
                                    type="text"
                                    value={newLinkPath}
                                    onChange={(e) => setNewLinkPath(e.target.value)}
                                    placeholder="Chemin du fichier ou URL"
                                />
                                <button className="btn-browse" onClick={handleBrowseFile} title="Parcourir...">
                                    ...
                                </button>
                            </div>
                        </div>
                        <div className="form-actions">
                            {editingId ? (
                                <>
                                    <button className="btn-save" onClick={handleSaveEdit}>Enregistrer</button>
                                    <button className="btn-cancel" onClick={handleCancelEdit}>Annuler</button>
                                </>
                            ) : (
                                <button className="btn-add" onClick={handleAddLink}>Ajouter</button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="external-links-footer">
                    <p className="hint">Double-cliquez sur un lien pour l'ouvrir dans une nouvelle fenêtre.</p>
                    <button className="btn-close" onClick={onClose}>Fermer</button>
                </div>
            </div>
        </div>
    );
};

export default ExternalLinksModal;
