import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Gère l'état et le drag de la légende flottante.
 */
const useFloatingLegend = () => {
    const [showFloatingLegend, setShowFloatingLegend] = useState(false);
    const [floatingLegendPosition, setFloatingLegendPosition] = useState({ x: 200, y: 150 });
    const [isLegendDragging, setIsLegendDragging] = useState(false);
    const legendDragOffset = useRef({ x: 0, y: 0 });

    const handleLegendMouseDown = useCallback((e) => {
        if (e.target.classList.contains('floating-close-btn')) return;
        setIsLegendDragging(true);
        legendDragOffset.current = {
            x: e.clientX - floatingLegendPosition.x,
            y: e.clientY - floatingLegendPosition.y
        };
    }, [floatingLegendPosition]);

    useEffect(() => {
        if (!isLegendDragging) return;

        const handleMouseMove = (e) => {
            setFloatingLegendPosition({
                x: e.clientX - legendDragOffset.current.x,
                y: e.clientY - legendDragOffset.current.y
            });
        };

        const handleMouseUp = () => {
            setIsLegendDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isLegendDragging]);

    return {
        showFloatingLegend,
        setShowFloatingLegend,
        floatingLegendPosition,
        isLegendDragging,
        handleLegendMouseDown
    };
};

export default useFloatingLegend;
