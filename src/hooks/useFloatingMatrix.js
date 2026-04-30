import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup de la matrice flottante.
 */
const useFloatingMatrix = (groupCount) => {
    const [showFloatingMatrix, setShowFloatingMatrix] = useState(() => {
        return localStorage.getItem('floating_matrix_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_matrix_visible', showFloatingMatrix.toString());
    }, [showFloatingMatrix]);

    const matrixPopup = usePopupWindow({
        isOpen: showFloatingMatrix,
        onClose: () => setShowFloatingMatrix(false),
        title: 'Matrice',
        width: Math.min(740, 110 + groupCount * 42),
        height: Math.min(640, 110 + groupCount * 42)
    });

    return {
        showFloatingMatrix,
        setShowFloatingMatrix,
        matrixPopup
    };
};

export default useFloatingMatrix;
