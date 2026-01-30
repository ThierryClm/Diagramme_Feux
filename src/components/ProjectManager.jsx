import React, { useState, useEffect } from 'react';
import './ProjectManager.css';

const ProjectManager = ({
    loadProject,
    getAllSaves,
    deleteSave,
    currentName
}) => {
    const [savedProjects, setSavedProjects] = useState([]);
    const [message, setMessage] = useState('');

    const refreshList = () => {
        setSavedProjects(getAllSaves());
    };

    useEffect(() => {
        refreshList();
    }, []);

    const handleLoad = (name) => {
        if (confirm(`Charger "${name}" ? La configuration actuelle sera perdue.`)) {
            const success = loadProject(name);
            if (success) {
                setMessage(`Chargé: ${name}`);
                setTimeout(() => setMessage(''), 2000);
            } else {
                setMessage('Erreur chargement');
            }
        }
    };

    const handleDelete = (name) => {
        if (confirm(`Supprimer "${name}" du cache local ?`)) {
            deleteSave(name);
            refreshList();
        }
    };

    return (
        <div className="project-manager">
            <h3>Projets Récents</h3>

            <p className="cache-info">
                Cache local (5 derniers projets travaillés)
            </p>

            {message && <div className="pm-message">{message}</div>}

            <div className="files-list">
                {savedProjects.length === 0 ? (
                    <p className="no-saves">Aucun projet récent</p>
                ) : (
                    <ul>
                        {savedProjects.map(name => (
                            <li key={name} className={name === currentName ? 'current' : ''}>
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
