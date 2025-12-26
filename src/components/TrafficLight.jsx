import React from 'react';
import './TrafficLight.css';

const TrafficLight = ({ currentPhase }) => {
    return (
        <div className="traffic-light">
            <div className={`light red ${currentPhase === 'red' ? 'active' : ''}`}></div>
            <div className={`light orange ${currentPhase === 'orange' ? 'active' : ''}`}></div>
            <div className={`light green ${currentPhase === 'green' ? 'active' : ''}`}></div>
        </div>
    );
};

export default TrafficLight;
