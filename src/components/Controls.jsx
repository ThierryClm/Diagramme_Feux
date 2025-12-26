import React from 'react';
import './Controls.css';

const Controls = ({ durations, setDurations, isPlaying, setIsPlaying, reset }) => {

    const handleChange = (e) => {
        const { name, value } = e.target;
        setDurations(prev => ({
            ...prev,
            [name]: Math.max(0, parseInt(value, 10) || 0)
        }));
    };

    return (
        <div className="controls-panel">
            <div className="durations-config">
                <div className="input-group">
                    <label className="label-red">Rouge (s)</label>
                    <input
                        type="number"
                        name="red"
                        value={durations.red}
                        onChange={handleChange}
                        min="1"
                    />
                </div>
                <div className="input-group">
                    <label className="label-orange">Orange (s)</label>
                    <input
                        type="number"
                        name="orange"
                        value={durations.orange}
                        onChange={handleChange}
                        min="1"
                    />
                </div>
                <div className="input-group">
                    <label className="label-green">Vert (s)</label>
                    <input
                        type="number"
                        name="green"
                        value={durations.green}
                        onChange={handleChange}
                        min="1"
                    />
                </div>
            </div>

            <div className="actions">
                <button
                    className={`btn-play ${isPlaying ? 'pause' : 'play'}`}
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    {isPlaying ? 'PAUSE' : 'DÉMARRER'}
                </button>
                <button className="btn-reset" onClick={reset}>
                    RÉINITIALISER
                </button>
            </div>
        </div>
    );
};

export default Controls;
