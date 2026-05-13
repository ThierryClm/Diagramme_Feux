import React, { useState, useEffect } from 'react';
import { useAlert } from './ConfirmProvider';
import './CreateGreenWaveDialog.css';

const CreateGreenWaveDialog = ({ isOpen, onClose, onConfirm, getAllSaves, loadProjectData }) => {
    const showAlert = useAlert();
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
        // Note: pfTabs stores actions under the key 'data', not 'actions'
        const pfTabs = projectData.pfTabs || [{ id: 1, name: 'PF1', data: projectData.actionData || [] }];
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
            actionData: selectedPf?.data || []
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

    // Auto-fill Distance D when Distance M is validated (onBlur)
    const handleDistanceMBlur = (id) => {
        setIntersections(intersections.map(i => {
            if (i.id !== id) return i;

            // If Distance D is empty, set it to Distance M + 20
            if (i.distanceD === undefined || i.distanceD === '' || i.distanceD === 0) {
                return { ...i, distanceD: i.distance + 20 };
            }

            return i;
        }));
    };

    const updateSelectedPf = (id, pfId) => {
        setIntersections(intersections.map(i => {
            if (i.id === id) {
                const selectedPf = i.pfTabs.find(pf => pf.id === pfId);
                return {
                    ...i,
                    selectedPfId: pfId,
                    actionData: selectedPf?.data || []
                };
            }
            return i;
        }));
    };

    const handleConfirm = () => {
        if (intersections.length < 2) {
            showAlert({ title: 'Carrefours insuffisants', message: 'Veuillez ajouter au moins 2 carrefours.' });
            return;
        }
        // Map and sort intersections by distance (descending)
        // In CreateGreenWaveDialog: selectedGroup1 = GF montant, selectedGroup2 = GF descendant
        // In GreenWavePage: selectedGroup2 = GF montant (distanceG2), selectedGroup1 = GF descendant (distance)
        const mappedIntersections = intersections.map(i => ({
            ...i,
            // Swap group selections for GreenWavePage compatibility
            selectedGroup2: i.selectedGroup1, // GF montant -> selectedGroup2
            selectedGroup1: i.selectedGroup2, // GF descendant -> selectedGroup1
            // Map distances
            distanceG2: i.distance,           // Distance M -> distanceG2 (for GF montant)
            distance: i.distanceD || i.distance // Distance D -> distance (for GF descendant)
        }));
        const sortedIntersections = mappedIntersections.sort((a, b) => b.distance - a.distance);
        onConfirm(sortedIntersections);
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
                        <label>Ajouter un carrefour : (en commençant par le carrefour sud, origine 0)</label>
                        <div className="add-project-row">
                            <select
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                            >
                                <option value="">-- Sélectionner un projet --</option>
                                {availableProjects.map(project => (
                                    <option key={project.name} value={project.name}>{project.name}</option>
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
                                <span className="col-distance" title="en mètres">Distance M</span>
                                <span className="col-group">GF montant</span>
                                <span className="col-distance-d" title="en mètres">Distance D</span>
                                <span className="col-group">GF descendant</span>
                                <span className="col-actions">Actions</span>
                            </div>
                            {[...intersections].sort((a, b) => b.distance - a.distance).map((intersection, index) => (
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
                                        onBlur={() => handleDistanceMBlur(intersection.id)}
                                        min="0"
                                        title="en mètres"
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
                                    <input
                                        type="number"
                                        className="col-distance-d"
                                        value={intersection.distanceD || ''}
                                        onChange={(e) => updateIntersection(
                                            intersection.id,
                                            'distanceD',
                                            parseInt(e.target.value) || 0
                                        )}
                                        min="0"
                                        title="en mètres"
                                    />
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
