import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup des Remarques flottantes du plan de feu.
 * Cas d'usage typique : projection sur un second écran avec le diagramme
 * sur l'écran principal et les notes du présentateur sur l'écran annexe.
 */
const useFloatingRemarks = (activePFName = '') => {
    const [showFloatingRemarks, setShowFloatingRemarks] = useState(() => {
        return localStorage.getItem('floating_remarques_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_remarques_visible', showFloatingRemarks.toString());
    }, [showFloatingRemarks]);

    const pf = (activePFName || '').trim();
    const popupTitle = pf ? `Remarques du diagramme — ${pf}` : 'Remarques du diagramme';

    const remarquesPopup = usePopupWindow({
        isOpen: showFloatingRemarks,
        onClose: () => setShowFloatingRemarks(false),
        title: popupTitle,
        width: 600,
        height: 400
    });

    return {
        showFloatingRemarks,
        setShowFloatingRemarks,
        remarquesPopup
    };
};

export default useFloatingRemarks;
