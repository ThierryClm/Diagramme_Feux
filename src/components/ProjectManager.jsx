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

    const formatDate = (isoString) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatSize = (bytes) => {
        if (!bytes) return '-';
        const kb = bytes / 1024;
        return `${kb.toFixed(1)} Ko`;
    };

    return (
        <div className="project-manager">
            <h3>Projets Récents</h3>

            <p className="cache-info">
                Cache local (3 derniers projets travaillés)
            </p>

            {message && <div className="pm-message">{message}</div>}

            <div className="files-list">
                {savedProjects.length === 0 ? (
                    <p className="no-saves">Aucun projet récent</p>
                ) : (
                    <ul>
                        {savedProjects.map(project => (
                            <li key={project.name} className={project.name === currentName ? 'current' : ''}>
                                <div className="project-info">
                                    <span className="project-name">{project.name}</span>
                                    <span className="project-details">
                                        {formatDate(project.savedAt)} - {formatSize(project.size)}
                                    </span>
                                </div>
                                <div className="actions">
                                    <button onClick={() => handleLoad(project.name)} className="btn-load">Charger</button>
                                    <button onClick={() => handleDelete(project.name)} className="btn-del">X</button>
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
