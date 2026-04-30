import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup des données trafic flottantes.
 */
const useFloatingTraffic = (groupCount) => {
    const [showFloatingTraffic, setShowFloatingTraffic] = useState(() => {
        return localStorage.getItem('floating_traffic_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_traffic_visible', showFloatingTraffic.toString());
    }, [showFloatingTraffic]);

    const trafficPopup = usePopupWindow({
        isOpen: showFloatingTraffic,
        onClose: () => setShowFloatingTraffic(false),
        title: 'Données trafic',
        width: 540,
        height: Math.min(580, 180 + groupCount * 32)
    });

    return {
        showFloatingTraffic,
        setShowFloatingTraffic,
        trafficPopup
    };
};

export default useFloatingTraffic;
