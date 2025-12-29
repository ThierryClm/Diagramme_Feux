import { useState, useEffect } from 'react';
import { useTrafficLight } from './hooks/useTrafficLight';
import TimelineDiagram from './components/TimelineDiagram';
import GroupTable from './components/GroupTable';
import TrafficTable from './components/TrafficTable';
import IntergreenMatrix from './components/IntergreenMatrix';
import ActionTable from './components/ActionTable';
import ProjectManager from './components/ProjectManager';
import MenuBar from './components/MenuBar';
import Modal from './components/Modal';

import './components/GroupTable.css';
import './components/IntergreenMatrix.css';
import './App.css';

function App() {
    const {
        intersectionName,
        setIntersectionName,
        groups,
        setGroupCount,
        cycleLength,
        setCycleLength,
        setMatrixValue,
        conflictMatrix,
        conflicts,
        globalTime,
        getGroupState,
        updateGroupParams,
        moveGroup,
        saveProject,
        loadProject,
        getAllSaves,
        deleteSave,
        getFullState,
        loadFullState,
        actionData,
        updateActionRow,
        undo,
        canUndo,
        startDrag,
        endDrag,
        slideAllGroups,
        insertTime
    } = useTrafficLight();

    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(10);
    const [activeTab, setActiveTab] = useState('config'); // 'config', 'traffic', 'projects'
    const [showDependencies, setShowDependencies] = useState(false);

    // Modal states
    const [openModal, setOpenModal] = useState(false);
    const [slideModal, setSlideModal] = useState(false);
    const [insertModal, setInsertModal] = useState(false);
    const [optionsModal, setOptionsModal] = useState(false);
    const [slideValue, setSlideValue] = useState(0);
    const [insertStart, setInsertStart] = useState(0);
    const [insertDuration, setInsertDuration] = useState(5);

    // Check for duplicated state on load
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const duplicateId = urlParams.get('duplicate');
        if (duplicateId) {
            const savedState = sessionStorage.getItem(`duplicate_${duplicateId}`);
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    loadFullState(state);
                    // Clean up
                    sessionStorage.removeItem(`duplicate_${duplicateId}`);
                    // Remove the URL parameter
                    window.history.replaceState({}, '', window.location.pathname);
                } catch (e) {
                    console.error('Failed to load duplicated state', e);
                }
            }
        }
    }, []);

    // Menu action handler
    const handleMenuAction = (action) => {
        switch (action) {
            case 'new':
                if (confirm('Créer un nouveau projet ? Les modifications non enregistrées seront perdues.')) {
                    window.location.reload();
                }
                break;
            case 'open':
                setOpenModal(true);
                break;
            case 'save':
                const name = prompt('Nom du projet:', intersectionName || 'Mon projet');
                if (name) {
                    saveProject(name);
                }
                break;
            case 'print':
                window.print();
                break;
            case 'close':
                window.close();
                break;
            case 'duplicate':
                {
                    // Get current state and save to sessionStorage
                    const currentState = getFullState();
                    const duplicateId = Date.now().toString();
                    sessionStorage.setItem(`duplicate_${duplicateId}`, JSON.stringify(currentState));
                    // Open new tab with duplicate parameter
                    const newUrl = `${window.location.pathname}?duplicate=${duplicateId}`;
                    window.open(newUrl, '_blank');
                }
                break;
            case 'slide':
                setSlideValue(0);
                setSlideModal(true);
                break;
            case 'insert':
                setInsertStart(0);
                setInsertDuration(5);
                setInsertModal(true);
                break;
            case 'options':
                setOptionsModal(true);
                break;
            case 'help':
                alert('Aide - Diagramme de Feux\n\nApplication de conception de diagrammes de feux de signalisation.');
                break;
            case 'credit':
                alert('Diagramme de Feux\n\nDéveloppé avec React + Vite\n2024');
                break;
            default:
                console.log('Action non implémentée:', action);
        }
    };

    // Handle project selection from open modal
    const handleOpenProject = (projectName) => {
        loadProject(projectName);
        setOpenModal(false);
    };

    // Handle slide confirmation
    const handleSlide = () => {
        if (slideValue !== 0) {
            slideAllGroups(slideValue);
        }
        setSlideModal(false);
    };

    // Handle insert confirmation
    const handleInsert = () => {
        if (insertDuration > 0) {
            insertTime(insertStart, insertDuration);
        }
        setInsertModal(false);
    };

    // Keyboard shortcut for undo (Ctrl+Z)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo]);

    return (
        <div className="app-container">
            <MenuBar onAction={handleMenuAction} />
            <header className="app-header">
                <div className="header-inputs">
                    <input
                        className="input-name"
                        type="text"
                        value={intersectionName}
                        onChange={(e) => setIntersectionName(e.target.value)}
                        placeholder="Nom du Carrefour"
                    />
                    <label>
                        Groupes:
                        <input
                            type="number"
                            min="1" max="32"
                            value={groups.length}
                            onChange={(e) => setGroupCount(e.target.value)}
                            className="input-count"
                        />
                    </label>
                    <label>
                        Cycle:
                        <input
                            type="number"
                            min="10"
                            value={cycleLength}
                            onChange={(e) => setCycleLength(parseInt(e.target.value) || 100)}
                            className="input-count"
                        />
                    </label>
                    <label style={{ marginLeft: '1rem', color: '#aaa', fontSize: '0.9em' }}>
                        Zoom:
                        <input
                            type="range"
                            min="3" max="50"
                            value={pixelsPerSecond}
                            onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))}
                            style={{ verticalAlign: 'middle', margin: '0 5px' }}
                        />
                        {pixelsPerSecond}px/s
                    </label>
                </div>

                <div className="header-actions">
                    <button
                        className="undo-btn"
                        onClick={undo}
                        disabled={!canUndo}
                        title="Annuler (Ctrl+Z)"
                    >
                        ↶ Annuler
                    </button>
                    <button
                        className={`toggle-btn ${showDependencies ? 'active' : ''}`}
                        onClick={() => setShowDependencies(!showDependencies)}
                        title="Afficher/masquer les temps de dégagement"
                    >
                        ⟷ Dépendance
                    </button>
                </div>

                <div className="status-bar">
                    {conflicts.length > 0 ? (
                        <div className="status-error">
                            {conflicts.length} CONFLITS !
                        </div>
                    ) : (
                        <div className="status-ok">Valide</div>
                    )}
                </div>
            </header>

            <main className="split-view">
                <aside className="sidebar">
                    <div className="sidebar-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
                            onClick={() => setActiveTab('projects')}
                        >
                            Projets
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
                            onClick={() => setActiveTab('config')}
                        >
                            Configuration
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'traffic' ? 'active' : ''}`}
                            onClick={() => setActiveTab('traffic')}
                        >
                            Trafic
                        </button>
                    </div>

                    {activeTab === 'config' && (
                        <>
                            <GroupTable
                                groups={groups}
                                updateGroupParams={updateGroupParams}
                                cycleLength={cycleLength}
                                moveGroup={moveGroup}
                            />
                            <div style={{ marginTop: '2rem' }}>
                                <IntergreenMatrix
                                    conflictMatrix={conflictMatrix}
                                    setMatrixValue={setMatrixValue}
                                    groups={groups}
                                    cycleLength={cycleLength}
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'traffic' && (
                        <TrafficTable
                            groups={groups}
                            updateGroupParams={updateGroupParams}
                            cycleLength={cycleLength}
                        />
                    )}

                    {activeTab === 'projects' && (
                        <ProjectManager
                            saveProject={saveProject}
                            loadProject={loadProject}
                            getAllSaves={getAllSaves}
                            deleteSave={deleteSave}
                            currentName={intersectionName}
                        />
                    )}

                    {conflicts.length > 0 && (
                        <div className="conflict-list">
                            <h4>Conflits:</h4>
                            <ul>
                                {conflicts.map((c, i) => (
                                    <li key={i}>G{c.from} &#8594; G{c.to}: Req {c.required}s, Act {c.actual.toFixed(1)}s</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>

                <section className="diagram-area" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <TimelineDiagram
                            groups={groups}
                            globalTime={globalTime}
                            getGroupState={getGroupState}
                            onGroupClick={(g) => setSelectedGroupId(g.id)}
                            pixelsPerSecond={pixelsPerSecond}
                            conflicts={conflicts}
                            conflictMatrix={conflictMatrix}
                            updateGroupParams={updateGroupParams}
                            cycleLength={cycleLength}
                            actionData={actionData}
                            updateActionRow={updateActionRow}
                            startDrag={startDrag}
                            endDrag={endDrag}
                            showDependencies={showDependencies}
                        />
                    </div>

                    <div style={{ borderTop: '1px solid #333', marginTop: '1rem' }}>
                        <ActionTable
                            actionData={actionData}
                            updateActionRow={updateActionRow}
                            cycleLength={cycleLength}
                            startDrag={startDrag}
                            endDrag={endDrag}
                            maxGroup={groups.length}
                        />
                    </div>
                </section>
            </main>

            {/* Modal Ouvrir */}
            <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Ouvrir un projet">
                {getAllSaves().length > 0 ? (
                    <ul className="project-list">
                        {getAllSaves().map((save) => (
                            <li key={save.name} onClick={() => handleOpenProject(save.name)}>
                                {save.name}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="no-projects">Aucun projet sauvegardé</p>
                )}
            </Modal>

            {/* Modal Glisser */}
            <Modal isOpen={slideModal} onClose={() => setSlideModal(false)} title="Glisser le diagramme">
                <div className="form-row">
                    <label>
                        Décalage (secondes) :
                        <input
                            type="number"
                            value={slideValue}
                            onChange={(e) => setSlideValue(parseInt(e.target.value) || 0)}
                        />
                    </label>
                    <p style={{ color: '#888', fontSize: '0.85em', marginTop: '8px' }}>
                        Valeur positive : décale vers la droite<br />
                        Valeur négative : décale vers la gauche
                    </p>
                </div>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setSlideModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleSlide}>
                        Appliquer
                    </button>
                </div>
            </Modal>

            {/* Modal Inserer */}
            <Modal isOpen={insertModal} onClose={() => setInsertModal(false)} title="Insérer une plage">
                <div className="form-row">
                    <label>
                        À partir de la seconde :
                        <input
                            type="number"
                            min="0"
                            max={cycleLength}
                            value={insertStart}
                            onChange={(e) => setInsertStart(parseInt(e.target.value) || 0)}
                        />
                    </label>
                </div>
                <div className="form-row">
                    <label>
                        Durée à insérer (secondes) :
                        <input
                            type="number"
                            min="1"
                            value={insertDuration}
                            onChange={(e) => setInsertDuration(parseInt(e.target.value) || 1)}
                        />
                    </label>
                </div>
                <p style={{ color: '#888', fontSize: '0.85em', marginTop: '8px' }}>
                    Tous les groupes commençant après la seconde {insertStart} seront décalés de {insertDuration}s.<br />
                    La durée du cycle passera de {cycleLength}s à {cycleLength + insertDuration}s.
                </p>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-secondary" onClick={() => setInsertModal(false)}>
                        Annuler
                    </button>
                    <button className="modal-btn modal-btn-primary" onClick={handleInsert}>
                        Insérer
                    </button>
                </div>
            </Modal>

            {/* Modal Options - Légende des actions */}
            <Modal isOpen={optionsModal} onClose={() => setOptionsModal(false)} title="Options - Légende des actions">
                <div className="legend-container">
                    <div className="legend-item">
                        <div className="legend-preview legend-adaptatif"></div>
                        <span>Adaptatif vertical</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-escamotage"></div>
                        <span>Escamotage de phase</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-ouverture"></div>
                        <span>Ouverture anticipée</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-fermeture"></div>
                        <span>Fermeture anticipée</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-signa">
                            <div className="legend-signa-orange"></div>
                            <div className="legend-signa-blue"></div>
                        </div>
                        <span>Signa d'aide à la conduite</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-bande-debut"></div>
                        <span>Début de bande passante</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-bande-fin"></div>
                        <span>Fin de bande passante</span>
                    </div>
                </div>
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button className="modal-btn modal-btn-primary" onClick={() => setOptionsModal(false)}>
                        Fermer
                    </button>
                </div>
            </Modal>
        </div>
    )
}

export default App
