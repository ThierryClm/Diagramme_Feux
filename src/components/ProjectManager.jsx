import React, { useState, useEffect } from 'react';
import './ProjectManager.css';

const ProjectManager = ({
    saveProject,
    loadProject,
    getAllSaves,
    deleteSave,
    currentName
}) => {
    const [saveName, setSaveName] = useState(currentName || '');
    const [savedProjects, setSavedProjects] = useState([]);
    const [message, setMessage] = useState('');

    const refreshList = () => {
        setSavedProjects(getAllSaves());
    };

    useEffect(() => {
        refreshList();
    }, []);

    // Also update saveName if currentName changes from parent (optional)
    useEffect(() => {
        if (currentName) setSaveName(currentName);
    }, [currentName]);

    const handleSave = () => {
        if (!saveName.trim()) {
            setMessage('Nom requis !');
            return;
        }
        const success = saveProject(saveName);
        if (success) {
            setMessage('Sauvegardé !');
            refreshList();
            setTimeout(() => setMessage(''), 2000);
        } else {
            setMessage('Erreur sauvegarde');
        }
    };

    const handleLoad = (name) => {
        if (confirm(`Charger "${name}" ? La configuration actuelle sera perdue.`)) {
            const success = loadProject(name);
            if (success) {
                setMessage(`Chargé: ${name}`);
                setSaveName(name);
                setTimeout(() => setMessage(''), 2000);
            } else {
                setMessage('Erreur chargement');
            }
        }
    };

    const handleDelete = (name) => {
        if (confirm(`Supprimer la sauvegarde "${name}" ?`)) {
            deleteSave(name);
            refreshList();
        }
    };

    return (
        <div className="project-manager">
            <h3>Gestion de Projets</h3>

            <div className="save-section">
                <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Nom de la sauvegarde"
                />
                <button onClick={handleSave} className="btn-save">
                    Sauvegarder
                </button>
            </div>

            {message && <div className="pm-message">{message}</div>}

            <div className="files-list">
                <h4>Projets Enregistrés:</h4>
                {savedProjects.length === 0 ? (
                    <p className="no-saves">Aucune sauvegarde</p>
                ) : (
                    <ul>
                        {savedProjects.map(name => (
                            <li key={name}>
                                <span className="project-name">{name}</span>
                                <div className="actions">
                                    <button onClick={() => handleLoad(name)} className="btn-load">Charger</button>
                                    <button onClick={() => handleDelete(name)} className="btn-del">X</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default ProjectManager;
