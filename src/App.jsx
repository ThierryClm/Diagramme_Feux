import { useState } from 'react';
import { useTrafficLight } from './hooks/useTrafficLight';
import TimelineDiagram from './components/TimelineDiagram';
import GroupTable from './components/GroupTable';
import TrafficTable from './components/TrafficTable';
import IntergreenMatrix from './components/IntergreenMatrix';

import './components/TimelineDiagram.css';
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
        moveGroup
    } = useTrafficLight();

    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(10);
    const [activeTab, setActiveTab] = useState('config'); // 'config' or 'traffic'

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
                            className={`tab - btn ${activeTab === 'config' ? 'active' : ''} `}
                            onClick={() => setActiveTab('config')}
                        >
                            Configuration
                        </button>
                        <button
                            className={`tab - btn ${activeTab === 'traffic' ? 'active' : ''} `}
                            onClick={() => setActiveTab('traffic')}
                        >
                            Trafic
                        </button>
                    </div>

                    {activeTab === 'config' ? (
                        <>
                            <GroupTable
                                groups={groups}
                                updateGroupParams={updateGroupParams}
                                cycleLength={cycleLength}
                            />
                            <IntergreenMatrix
                                conflictMatrix={conflictMatrix}
                                setMatrixValue={setMatrixValue}
                            />
                        </>
                    ) : (
                        <TrafficTable
                            groups={groups}
                            updateGroupParams={updateGroupParams}
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

                <section className="diagram-area">
                    <TimelineDiagram
                        groups={groups}
                        globalTime={globalTime}
                        getGroupState={getGroupState}
                        onGroupClick={(g) => setSelectedGroupId(g.id)}
                        pixelsPerSecond={pixelsPerSecond}
                    />
                </section>
            </main>
        </div>
    )
}

export default App
