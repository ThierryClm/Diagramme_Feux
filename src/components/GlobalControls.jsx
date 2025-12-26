import React from 'react';
import './Controls.css';

const GlobalControls = ({ isPlaying, setIsPlaying, reset, onEditGroup, selectedGroup, updateGroupDuration, updateGroupOffset }) => {
    return (
        <div className="controls-panel">

            {/* Simulation Controls */}
            <div className="main-actions">
                <button
                    className={`btn-play ${isPlaying ? 'pause' : 'play'}`}
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    {isPlaying ? 'PAUSE' : 'DÉMARRER TOUT'}
                </button>
                <button className="btn-reset" onClick={reset}>
                    RÉINITIALISER
                </button>
            </div>

            {/* Selected Group Editor */}
            {selectedGroup ? (
                <div className="group-editor">
                    <h3>Édition Groupe {selectedGroup.id}</h3>
                    <div className="durations-config">
                        <div className="input-group">
                            <label className="label-green">Vert (s)</label>
                            <input
                                type="number"
                                value={selectedGroup.durations.green}
                                onChange={(e) => updateGroupDuration(selectedGroup.id, 'green', e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label className="label-orange">Orange (s)</label>
                            <input
                                type="number"
                                value={selectedGroup.durations.orange}
                                onChange={(e) => updateGroupDuration(selectedGroup.id, 'orange', e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label className="label-red">Rouge (s)</label>
                            <input
                                type="number"
                                value={selectedGroup.durations.red}
                                onChange={(e) => updateGroupDuration(selectedGroup.id, 'red', e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label className="label-offset">Décalage (s)</label>
                            <input
                                type="number"
                                value={selectedGroup.offset}
                                onChange={(e) => updateGroupOffset(selectedGroup.id, e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="select-hint">Cliquez sur une ligne pour éditer un groupe</div>
            )}
        </div>
    );
};

export default GlobalControls;
