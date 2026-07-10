import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup du panneau Diagnostic détaché.
 */
const useFloatingDiagnostic = (activePFName = '') => {
    const [showFloatingDiagnostic, setShowFloatingDiagnostic] = useState(() => {
        return localStorage.getItem('floating_diagnostic_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_diagnostic_visible', showFloatingDiagnostic.toString());
    }, [showFloatingDiagnostic]);

    const pf = (activePFName || '').trim();
    const popupTitle = pf ? `Réserve de capacité — ${pf}` : 'Réserve de capacité';

    const diagnosticPopup = usePopupWindow({
        isOpen: showFloatingDiagnostic,
        onClose: () => setShowFloatingDiagnostic(false),
        title: popupTitle,
        width: 560,
        height: 460
    });

    return {
        showFloatingDiagnostic,
        setShowFloatingDiagnostic,
        diagnosticPopup
    };
};

export default useFloatingDiagnostic;
