import { useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { isFilePickerActive } from '../utils/filePicker';
import { toast } from '../utils/toast';

/**
 * Shared registry of all open popup windows.
 * Allows coordinated focus management across multiple popups.
 */
const openPopups = new Set();
let isBringingToFront = false;
let lastBringTime = 0;

// Toast « popups bloquées » : on n'avertit qu'une fois par session.
// Quand un projet rouvre 3 fenêtres détachées, le navigateur n'autorise
// qu'un seul window.open() par geste utilisateur — sans dédoublonnage,
// l'utilisateur recevrait 2 alertes consécutives pour le même problème.
let popupBlockedNotified = false;

export function bringAllPopupsToFront(except) {
    if (isBringingToFront || openPopups.size === 0 || isFilePickerActive()) return;
    const now = Date.now();
    if (now - lastBringTime < 200) return;
    isBringingToFront = true;
    lastBringTime = now;
    openPopups.forEach(p => {
        if (p !== except && !p.closed) p.focus();
    });
    if (except && !except.closed) except.focus();
    setTimeout(() => { isBringingToFront = false; }, 200);
}

// Install shared listeners on the main window (once)
let mainListenerInstalled = false;
let bringPopupsTimer = null;
function installMainListener() {
    if (mainListenerInstalled) return;
    mainListenerInstalled = true;

    const bringPopupsIfAllowed = () => {
        if (openPopups.size === 0 || isBringingToFront || isFilePickerActive()) return;
        if (bringPopupsTimer) clearTimeout(bringPopupsTimer);
        bringPopupsTimer = setTimeout(() => {
            bringPopupsTimer = null;
            if (isFilePickerActive()) return;
            bringAllPopupsToFront(null);
        }, 1000);
    };

    // When main window regains focus from outside (alt-tab, taskbar)
    window.addEventListener('focus', bringPopupsIfAllowed);

    // When user clicks inside the main window (covers tab switches, buttons, etc.)
    document.addEventListener('mousedown', bringPopupsIfAllowed);

    // Close all popups when the main window is closed
    window.addEventListener('beforeunload', () => {
        openPopups.forEach(p => { if (!p.closed) p.close(); });
    });
}

/**
 * Custom hook to manage a window.open() popup that renders React content.
 * - Copies all stylesheets from the parent window
 * - Handles popup close detection
 * - Syncs light/dark mode
 * - Keeps all popups on top via shared registry
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
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,menubar=no,toolbar=yes,location=yes,status=no`
            );

            if (!popup) {
                if (!popupBlockedNotified) {
                    popupBlockedNotified = true;
                    toast.error("Fenêtre détachée bloquée par le navigateur. Cliquez sur l'icône popup bloqué dans la barre d'adresse et choisissez « Toujours autoriser » pour ce site (voir l'aide F1).");
                }
                onClose();
                return;
            }

            popupRef.current = popup;
            openPopups.add(popup);
            installMainListener();

            // Set title
            popup.document.title = title;

            // Copy all stylesheets from parent window
            const parentStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
            parentStyles.forEach(node => {
                const clone = node.cloneNode(true);
                popup.document.head.appendChild(clone);
            });

            // Sync theme class on popup body
            ['light-mode', 'high-contrast-mode', 'amber-mode', 'daltonian-mode', 'sepia-mode', 'blue-night-mode'].forEach(cls => {
                if (document.body.classList.contains(cls)) {
                    popup.document.body.classList.add(cls);
                }
            });

            // Add base styles for popup body (all themes)
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
                body.high-contrast-mode {
                    background: #0a0e2a;
                }
                body.amber-mode {
                    background: #1a1a1a;
                }
                body.daltonian-mode {
                    background: #0d1b2a;
                }
                body.sepia-mode {
                    background: #f4ecd8;
                }
                body.blue-night-mode {
                    background: #002b36;
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

            // When this popup gains focus, bring all other popups to front too
            popup.addEventListener('focus', () => {
                if (!isFilePickerActive()) {
                    setTimeout(() => bringAllPopupsToFront(popup), 150);
                }
            });

            // Detect popup close
            intervalRef.current = setInterval(() => {
                if (popup.closed) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    rootRef.current = null;
                    popupRef.current = null;
                    openPopups.delete(popup);
                    onClose();
                }
            }, 300);

        } else {
            // Close popup if open
            if (popupRef.current) {
                openPopups.delete(popupRef.current);
                if (!popupRef.current.closed) {
                    popupRef.current.close();
                }
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

    // Sync theme changes to popup via MutationObserver (instead of every render)
    useEffect(() => {
        if (!popupRef.current || popupRef.current.closed) return;
        const popup = popupRef.current;
        const themeClasses = ['light-mode', 'high-contrast-mode', 'amber-mode', 'daltonian-mode', 'sepia-mode', 'blue-night-mode'];

        const syncTheme = () => {
            if (popup.closed) return;
            themeClasses.forEach(cls => {
                popup.document.body.classList.toggle(cls, document.body.classList.contains(cls));
            });
        };

        // Sync immediately
        syncTheme();

        // Observe changes on main body class
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, [isOpen]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (popupRef.current) {
                openPopups.delete(popupRef.current);
                if (!popupRef.current.closed) {
                    popupRef.current.close();
                }
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return { renderToPopup, popupWindow: popupRef };
};

export default usePopupWindow;
