import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup de la matrice flottante.
 */
const useFloatingMatrix = (groupCount, activePFName = '') => {
    const [showFloatingMatrix, setShowFloatingMatrix] = useState(() => {
        return localStorage.getItem('floating_matrix_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_matrix_visible', showFloatingMatrix.toString());
    }, [showFloatingMatrix]);

    const pf = (activePFName || '').trim();
    const popupTitle = pf ? `Matrice — ${pf}` : 'Matrice';

    const matrixPopup = usePopupWindow({
        isOpen: showFloatingMatrix,
        onClose: () => setShowFloatingMatrix(false),
        title: popupTitle,
        width: Math.min(620, -10 + groupCount * 42),
        height: Math.min(520, -10 + groupCount * 42)
    });

    return {
        showFloatingMatrix,
        setShowFloatingMatrix,
        matrixPopup
    };
};

export default useFloatingMatrix;
