import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Gère la mise en page de l'interface :
 * - Sidebar (largeur, visibilité, redimensionnement horizontal)
 * - Zone diagramme (hauteur, redimensionnement vertical)
 * - Onglet actif et zoom du diagramme
 */
const useUILayout = () => {
    const [pixelsPerSecond, setPixelsPerSecond] = useState(10);
    const [activeTab, setActiveTab] = useState('config');

    // Sidebar
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('sidebar_width');
        return saved ? parseInt(saved) : 450;
    });
    const [isResizing, setIsResizing] = useState(false);
    const splitViewRef = useRef(null);

    const [sidebarVisible, setSidebarVisible] = useState(() => {
        const saved = localStorage.getItem('sidebar_visible');
        return saved !== null ? saved === 'true' : true;
    });

    useEffect(() => {
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
    }, [sidebarWidth]);

    useEffect(() => {
        localStorage.setItem('sidebar_visible', sidebarVisible.toString());
    }, [sidebarVisible]);

    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleResizeMove = useCallback((e) => {
        if (!isResizing || !splitViewRef.current) return;
        const containerRect = splitViewRef.current.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        setSidebarWidth(Math.min(1200, Math.max(300, newWidth)));
    }, [isResizing]);

    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    // Diagram height
    const [diagramHeight, setDiagramHeight] = useState(() => {
        const saved = localStorage.getItem('diagram_height');
        return saved ? parseInt(saved) : null;
    });
    const [isResizingDiagram, setIsResizingDiagram] = useState(false);
    const diagramAreaRef = useRef(null);

    useEffect(() => {
        if (diagramHeight !== null) {
            localStorage.setItem('diagram_height', diagramHeight.toString());
        }
    }, [diagramHeight]);

    const handleDiagramResizeStart = useCallback((e) => {
        e.preventDefault();
        setIsResizingDiagram(true);
    }, []);

    const handleDiagramResizeMove = useCallback((e) => {
        if (!isResizingDiagram || !diagramAreaRef.current) return;
        const containerRect = diagramAreaRef.current.getBoundingClientRect();
        const newHeight = e.clientY - containerRect.top - 40;
        const maxHeight = containerRect.height - 150;
        setDiagramHeight(Math.min(maxHeight, Math.max(100, newHeight)));
    }, [isResizingDiagram]);

    const handleDiagramResizeEnd = useCallback(() => {
        setIsResizingDiagram(false);
    }, []);

    useEffect(() => {
        if (diagramHeight === null && diagramAreaRef.current) {
            const panel = diagramAreaRef.current.querySelector('.diagram-panel');
            if (panel) {
                const h = panel.offsetHeight;
                if (h > 200) setDiagramHeight(h - 120);
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const resetDiagramHeight = useCallback(() => {
        setDiagramHeight(null);
        localStorage.removeItem('diagram_height');
    }, []);

    const handleActionPanelResize = useCallback((deltaY) => {
        if (!diagramAreaRef.current) return;
        const containerRect = diagramAreaRef.current.getBoundingClientRect();
        const maxHeight = containerRect.height - 150;
        setDiagramHeight(prev => {
            const currentHeight = prev !== null ? prev : containerRect.height - 200;
            const newHeight = currentHeight + deltaY;
            return Math.min(maxHeight, Math.max(100, newHeight));
        });
    }, []);

    useEffect(() => {
        if (isResizingDiagram) {
            document.addEventListener('mousemove', handleDiagramResizeMove);
            document.addEventListener('mouseup', handleDiagramResizeEnd);
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleDiagramResizeMove);
            document.removeEventListener('mouseup', handleDiagramResizeEnd);
            if (!isResizing) {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
    }, [isResizingDiagram, handleDiagramResizeMove, handleDiagramResizeEnd, isResizing]);

    return {
        pixelsPerSecond, setPixelsPerSecond,
        activeTab, setActiveTab,
        sidebarWidth, setSidebarWidth,
        isResizing,
        splitViewRef,
        sidebarVisible, setSidebarVisible,
        handleResizeStart,
        diagramHeight, setDiagramHeight,
        isResizingDiagram,
        diagramAreaRef,
        resetDiagramHeight,
        handleDiagramResizeStart,
        handleActionPanelResize
    };
};

export default useUILayout;
