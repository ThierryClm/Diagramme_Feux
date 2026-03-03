import { useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Custom hook to manage a window.open() popup that renders React content.
 * - Copies all stylesheets from the parent window
 * - Handles popup close detection
 * - Syncs light/dark mode
 */
const usePopupWindow = ({ isOpen, onClose, title, width, height }) => {
    const popupRef = useRef(null);
    const rootRef = useRef(null);
    const intervalRef = useRef(null);

    // Open/close popup based on isOpen
    useEffect(() => {
        if (isOpen) {
            // Center the popup on screen
            const left = window.screenX + Math.round((window.outerWidth - width) / 2);
            const top = window.screenY + Math.round((window.outerHeight - height) / 2);

            const popup = window.open(
                '',
                title.replace(/\s+/g, '_'),
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
            );

            if (!popup) {
                alert('Le popup a été bloqué par le navigateur. Veuillez autoriser les popups pour cette page.');
                onClose();
                return;
            }

            popupRef.current = popup;

            // Set title
            popup.document.title = title;

            // Copy all stylesheets from parent window
            const parentStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
            parentStyles.forEach(node => {
                const clone = node.cloneNode(true);
                popup.document.head.appendChild(clone);
            });

            // Sync light/dark mode class on body
            const isLightMode = document.body.classList.contains('light-mode');
            if (isLightMode) {
                popup.document.body.classList.add('light-mode');
            }

            // Add base styles for popup body
            const popupStyle = popup.document.createElement('style');
            popupStyle.textContent = `
                body {
                    margin: 0;
                    padding: 0;
                    background: #1e1e1e;
                    overflow: auto;
                }
                body.light-mode {
                    background: #f5f5f5;
                }
                #popup-root {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
            `;
            popup.document.head.appendChild(popupStyle);

            // Create root container
            const container = popup.document.createElement('div');
            container.id = 'popup-root';
            popup.document.body.appendChild(container);

            // Create React root
            rootRef.current = createRoot(container);

            // Detect popup close
            intervalRef.current = setInterval(() => {
                if (popup.closed) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    rootRef.current = null;
                    popupRef.current = null;
                    onClose();
                }
            }, 300);

        } else {
            // Close popup if open
            if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.close();
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (rootRef.current) {
                rootRef.current = null;
            }
            popupRef.current = null;
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isOpen]);

    // Render content to popup
    const renderToPopup = useCallback((content) => {
        if (rootRef.current && popupRef.current && !popupRef.current.closed) {
            rootRef.current.render(content);
        }
    }, []);

    // Sync light/dark mode changes
    useEffect(() => {
        if (popupRef.current && !popupRef.current.closed) {
            const isLightMode = document.body.classList.contains('light-mode');
            popupRef.current.document.body.classList.toggle('light-mode', isLightMode);
        }
    });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.close();
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return { renderToPopup, popupWindow: popupRef };
};

export default usePopupWindow;
