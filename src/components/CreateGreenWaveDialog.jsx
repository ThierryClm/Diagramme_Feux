import React, { useState, useEffect } from 'react';
import './CreateGreenWaveDialog.css';

const CreateGreenWaveDialog = ({ isOpen, onClose, onConfirm, getAllSaves, loadProjectData }) => {
    const [intersections, setIntersections] = useState([]);
    const [availableProjects, setAvailableProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');

    useEffect(() => {
        if (isOpen) {
            setIntersections([]);
            setSelectedProject('');
            setAvailableProjects(getAllSaves());
        }
    }, [isOpen, getAllSaves]);

    const addIntersection = () => {
        if (!selectedProject) return;

        // Load project data to get groups
        const projectData = loadProjectData(selectedProject);
        if (!projectData) return;

        // Get pfTabs (plans de feu) from project
        const pfTabs = projectData.pfTabs || [{ id: 1, name: 'PF1', actions: projectData.actionData || [] }];
        const selectedPfId = pfTabs[0]?.id || 1;
        const selectedPf = pfTabs.find(pf => pf.id === selectedPfId);

        const newIntersection = {
            id: Date.now(),
            projectName: selectedProject,
            distance: intersections.length > 0
                ? intersections[intersections.length - 1].distance + 100
                : 0,
            groups: projectData.groups || [],
            cycleLength: projectData.cycleLength || 100,
            selectedGroup1: projectData.groups?.[0]?.id || 1,
            selectedGroup2: projectData.groups?.[1]?.id || 2,
            pfTabs: pfTabs,
            selectedPfId: selectedPfId,
            actionData: selectedPf?.actions || []
        };

        setIntersections([...intersections, newIntersection]);
        setSelectedProject('');
    };

    const removeIntersection = (id) => {
        setIntersections(intersections.filter(i => i.id !== id));
    };

    const updateIntersection = (id, field, value) => {
        setIntersections(intersections.map(i =>
            i.id === id ? { ...i, [field]: value } : i
        ));
    };

    const updateSelectedPf = (id, pfId) => {
        setIntersections(intersections.map(i => {
            if (i.id === id) {
                const selectedPf = i.pfTabs.find(pf => pf.id === pfId);
                return {
                    ...i,
                    selectedPfId: pfId,
                    actionData: selectedPf?.actions || []
                };
            }
            return i;
        }));
    };

    const moveIntersection = (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === intersections.length - 1) return;

        const newIntersections = [...intersections];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newIntersections[index], newIntersections[targetIndex]] =
            [newIntersections[targetIndex], newIntersections[index]];
        setIntersections(newIntersections);
    };

    const handleConfirm = () => {
        if (intersections.length < 2) {
            alert('Veuillez ajouter au moins 2 carrefours');
            return;
        }
        onConfirm(intersections);
    };

    if (!isOpen) return null;

    return (
        <div className="dialog-overlay">
            <div className="dialog-container green-wave-dialog">
                <div className="dialog-header">
                    <h2>Créer une onde verte</h2>
                    <button className="dialog-close" onClick={onClose}>×</button>
                </div>

                <div className="dialog-content">
                    <div className="add-project-section">
                        <label>Ajouter un carrefour :</label>
                        <div className="add-project-row">
                            <select
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                            >
                                <option value="">-- Sélectionner un projet --</option>
                                {availableProjects.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <button
                                className="btn-add"
                                onClick={addIntersection}
                                disabled={!selectedProject}
                            >
                                + Ajouter
                            </button>
                        </div>
                    </div>

                    {intersections.length > 0 && (
                        <div className="intersections-list">
                            <div className="intersections-header">
                                <span className="col-order">#</span>
                                <span className="col-name">Carrefour</span>
                                <span className="col-pf">Plan de feu</span>
                                <span className="col-distance">Distance (m)</span>
                                <span className="col-group">Groupe 1</span>
                                <span className="col-group">Groupe 2</span>
                                <span className="col-actions">Actions</span>
                            </div>
                            {intersections.map((intersection, index) => (
                                <div key={intersection.id} className="intersection-row">
                                    <span className="col-order">{index + 1}</span>
                                    <span className="col-name">{intersection.projectName}</span>
                                    <select
                                        className="col-pf"
                                        value={intersection.selectedPfId}
                                        onChange={(e) => updateSelectedPf(
                                            intersection.id,
                                            parseInt(e.target.value)
                                        )}
                                    >
                                        {intersection.pfTabs?.map(pf => (
                                            <option key={pf.id} value={pf.id}>
                                                {pf.name}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        className="col-distance"
                                        value={intersection.distance}
                                        onChange={(e) => updateIntersection(
                                            intersection.id,
                                            'distance',
                                            parseInt(e.target.value) || 0
                                        )}
                                        min="0"
                                    />
                                    <select
                                        className="col-group"
                                        value={intersection.selectedGroup1}
                                        onChange={(e) => updateIntersection(
                                            intersection.id,
                                            'selectedGroup1',
                                            parseInt(e.target.value)
                                        )}
                                    >
                                        {intersection.groups.map(g => (
                                            <option key={g.id} value={g.id}>
                                                G{g.id} - {g.name}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        className="col-group"
                                        value={intersection.selectedGroup2}
                                        onChange={(e) => updateIntersection(
                                            intersection.id,
                                            'selectedGroup2',
                                            parseInt(e.target.value)
                                        )}
                                    >
                                        {intersection.groups.map(g => (
                                            <option key={g.id} value={g.id}>
                                                G{g.id} - {g.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="col-actions">
                                        <button
                                            className="btn-move"
                                            onClick={() => moveIntersection(index, 'up')}
                                            disabled={index === 0}
                                            title="Monter"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            className="btn-move"
                                            onClick={() => moveIntersection(index, 'down')}
                                            disabled={index === intersections.length - 1}
                                            title="Descendre"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            className="btn-remove"
                                            onClick={() => removeIntersection(intersection.id)}
                                            title="Supprimer"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {intersections.length === 0 && (
                        <p className="empty-message">
                            Aucun carrefour ajouté. Sélectionnez des projets pour créer l'onde verte.
                        </p>
                    )}
                </div>

                <div className="dialog-footer">
                    <button className="btn-cancel" onClick={onClose}>
                        Annuler
                    </button>
                    <button
                        className="btn-confirm"
                        onClick={handleConfirm}
                        disabled={intersections.length < 2}
                    >
                        Créer l'onde verte
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateGreenWaveDialog;
