import { useState } from 'react';

/**
 * Gère les états UI de la simulation (lecture, temps courant, survol du diagramme).
 */
const useSimulationUI = () => {
    const [isPlayingSimulation, setIsPlayingSimulation] = useState(false);
    const [simulationCurrentTime, setSimulationCurrentTime] = useState(0);
    const [hoveredDiagramTime, setHoveredDiagramTime] = useState(null);

    return {
        isPlayingSimulation, setIsPlayingSimulation,
        simulationCurrentTime, setSimulationCurrentTime,
        hoveredDiagramTime, setHoveredDiagramTime
    };
};

export default useSimulationUI;
