import { useState, useEffect } from 'react';
import { useTrafficLight } from './hooks/useTrafficLight';
import TimelineDiagram from './components/TimelineDiagram';
import GroupTable from './components/GroupTable';
import TrafficTable from './components/TrafficTable';
import IntergreenMatrix from './components/IntergreenMatrix';
import ActionTable from './components/ActionTable';
import ProjectManager from './components/ProjectManager';

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
        actionData,
        updateActionRow,
        undo,
        canUndo,
        startDrag,
        endDrag
    } = useTrafficLight();

    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(10);
    const [activeTab, setActiveTab] = useState('config'); // 'config', 'traffic', 'projects'

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
        </div>
    )
}

export default App
