import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup des Propriétés du projet détachées.
 */
const useFloatingProperties = (activePFName = '') => {
    const [showFloatingProperties, setShowFloatingProperties] = useState(() => {
        return localStorage.getItem('floating_properties_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_properties_visible', showFloatingProperties.toString());
    }, [showFloatingProperties]);

    const pf = (activePFName || '').trim();
    const popupTitle = pf ? `Propriétés — ${pf}` : 'Propriétés du projet';

    const propertiesPopup = usePopupWindow({
        isOpen: showFloatingProperties,
        onClose: () => setShowFloatingProperties(false),
        title: popupTitle,
        width: 470,
        height: 620
    });

    return {
        showFloatingProperties,
        setShowFloatingProperties,
        propertiesPopup
    };
};

export default useFloatingProperties;
