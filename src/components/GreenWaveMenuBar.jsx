import React, { useState, useRef, useEffect } from 'react';
import './MenuBar.css';

/**
 * Barre de menu de la fenêtre Onde verte.
 *
 * Reprend visuellement la barre de menu principale (Diagramme de feux)
 * pour homogénéiser l'ergonomie entre les deux fenêtres. Trois menus :
 * Fichier, Mise en page, À propos. Les contrôles continus (zoom X/Y,
 * cycles, lignes directrices) sont exposés en sous-menu.
 */
const GreenWaveMenuBar = ({
    onAction,
    pixelsPerSecond, onPixelsPerSecondChange,
    pixelsPerMeter, onPixelsPerMeterChange,
    displayCycles, onDisplayCyclesChange,
    showSpeedLines, onShowSpeedLinesChange
}) => {
    const [openMenu, setOpenMenu] = useState(null);
    const [openSubmenu, setOpenSubmenu] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenu(null);
                setOpenSubmenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMenuClick = (key) => {
        setOpenMenu(openMenu === key ? null : key);
        setOpenSubmenu(null);
    };

    const handleItemClick = (action, keepSubmenuOpen = false) => {
        if (!keepSubmenuOpen) {
            setOpenMenu(null);
            setOpenSubmenu(null);
        }
        if (action && onAction) onAction(action);
    };

    const handleSubmenuHover = (submenuId) => {
        setOpenSubmenu(submenuId);
    };

    const menus = {
        fichier: {
            label: 'Fichier',
            items: [
                { label: 'Nouveau...', action: 'new' },
                { label: 'Ouvrir...', action: 'open' },
                {
                    label: 'Enregistrer',
                    type: 'submenu',
                    submenuId: 'save',
                    submenu: [
                        { label: 'Dans le cache navigateur...', action: 'saveLocal' },
                        { label: 'Dans le réseau (fichier .json)...', action: 'saveFile' }
                    ]
                },
                { label: 'Imprimer (PDF)', action: 'print' },
                { type: 'separator' },
                { label: 'Fermer', action: 'close' }
            ]
        },
        miseEnPage: {
            label: 'Mise en page',
            items: [
                {
                    label: 'Zoom X (temps)',
                    type: 'submenu',
                    submenuId: 'zoomX',
                    submenu: [{
                        type: 'slider',
                        label: 'Zoom X',
                        min: 4, max: 20, step: 1,
                        value: pixelsPerSecond,
                        unit: ' px/s',
                        onChange: (v) => onPixelsPerSecondChange?.(v)
                    }]
                },
                {
                    label: 'Zoom Y (distance)',
                    type: 'submenu',
                    submenuId: 'zoomY',
                    submenu: [{
                        type: 'slider',
                        label: 'Zoom Y',
                        min: 0.2, max: 3, step: 0.1,
                        value: pixelsPerMeter,
                        unit: ' px/m',
                        onChange: (v) => onPixelsPerMeterChange?.(v)
                    }]
                },
                {
                    label: 'Cycles affichés',
                    type: 'submenu',
                    submenuId: 'cycles',
                    submenu: [
                        { label: '2 cycles', toggle: true, checked: displayCycles === 2, onSelect: () => onDisplayCyclesChange?.(2), keepSubmenuOpen: true },
                        { label: '3 cycles', toggle: true, checked: displayCycles === 3, onSelect: () => onDisplayCyclesChange?.(3), keepSubmenuOpen: true }
                    ]
                },
                {
                    label: 'Lignes directrices',
                    toggle: true,
                    checked: showSpeedLines,
                    onSelect: () => onShowSpeedLinesChange?.(!showSpeedLines),
                    keepSubmenuOpen: true
                },
                { type: 'separator' },
                { label: 'Synchroniser depuis projets', action: 'sync' }
            ]
        },
        apropos: {
            label: 'À propos',
            items: [
                { label: 'À propos', action: 'about' },
                { label: 'Aide en ligne', action: 'help' }
            ]
        }
    };

    const renderSubmenuItem = (subItem, subIdx) => {
        if (subItem.type === 'separator') {
            return <div key={subIdx} className="menu-separator" />;
        }
        if (subItem.type === 'header') {
            return <div key={subIdx} className="menu-header">{subItem.label}</div>;
        }
        if (subItem.type === 'slider') {
            return (
                <div key={subIdx} className="menu-slider-item" onClick={(e) => e.stopPropagation()}>
                    <span className="menu-slider-label">{subItem.label}</span>
                    <input
                        type="range"
                        min={subItem.min}
                        max={subItem.max}
                        step={subItem.step ?? 1}
                        value={subItem.value}
                        onChange={(e) => subItem.onChange?.(parseFloat(e.target.value))}
                        className="menu-slider-input"
                    />
                    <span className="menu-slider-value">
                        {typeof subItem.value === 'number' ? subItem.value.toFixed(subItem.step < 1 ? 1 : 0) : subItem.value}{subItem.unit}
                    </span>
                </div>
            );
        }
        if (subItem.toggle) {
            return (
                <button
                    key={subIdx}
                    className={`menu-item ${subItem.checked ? 'checked' : ''}`}
                    onClick={() => {
                        subItem.onSelect?.();
                        if (!subItem.keepSubmenuOpen) {
                            setOpenMenu(null);
                            setOpenSubmenu(null);
                        }
                    }}
                >
                    <span className="checkmark">{subItem.checked ? '✓' : '  '}</span>
                    {subItem.label}
                </button>
            );
        }
        return (
            <button
                key={subIdx}
                className={`menu-item ${subItem.disabled ? 'disabled' : ''}`}
                onClick={() => !subItem.disabled && handleItemClick(subItem.action, subItem.keepSubmenuOpen)}
                disabled={subItem.disabled}
            >
                {subItem.label}
            </button>
        );
    };

    const renderMenuItem = (item, idx) => {
        if (item.type === 'separator') {
            return <div key={idx} className="menu-separator" />;
        }
        if (item.type === 'submenu') {
            return (
                <div
                    key={idx}
                    className="menu-item-with-submenu"
                    onMouseEnter={() => handleSubmenuHover(item.submenuId)}
                    onMouseLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                            setOpenSubmenu(null);
                        }
                    }}
                >
                    <button className="menu-item has-submenu">
                        {item.label}
                        <span className="submenu-arrow">▶</span>
                    </button>
                    {openSubmenu === item.submenuId && (
                        <div className="submenu-dropdown">
                            {item.submenu.map((s, i) => renderSubmenuItem(s, i))}
                        </div>
                    )}
                </div>
            );
        }
        if (item.toggle) {
            return (
                <button
                    key={idx}
                    className={`menu-item ${item.checked ? 'checked' : ''}`}
                    onClick={() => {
                        item.onSelect?.();
                        if (!item.keepSubmenuOpen) {
                            setOpenMenu(null);
                            setOpenSubmenu(null);
                        }
                    }}
                    onMouseEnter={() => setOpenSubmenu(null)}
                >
                    <span className="checkmark">{item.checked ? '✓' : '  '}</span>
                    {item.label}
                </button>
            );
        }
        return (
            <button
                key={idx}
                className={`menu-item ${item.disabled ? 'disabled' : ''}`}
                onClick={() => !item.disabled && handleItemClick(item.action)}
                onMouseEnter={() => setOpenSubmenu(null)}
                disabled={item.disabled}
            >
                {item.label}
            </button>
        );
    };

    return (
        <div className="menu-bar" ref={menuRef}>
            <button
                type="button"
                className="menu-bar-logo-btn"
                onClick={() => handleItemClick('about')}
                title="À propos de TraCflux"
                aria-label="À propos"
            >
                <img src="./logo.svg" className="menu-bar-logo" alt="TraCflux" />
            </button>
            {Object.entries(menus).map(([key, menu]) => (
                <div key={key} className="menu-container">
                    <button
                        className={`menu-button ${openMenu === key ? 'active' : ''}`}
                        onClick={() => handleMenuClick(key)}
                        onMouseEnter={() => openMenu && setOpenMenu(key)}
                    >
                        {menu.label}
                    </button>
                    {openMenu === key && (
                        <div className="menu-dropdown">
                            {menu.items.map((item, idx) => renderMenuItem(item, idx))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default GreenWaveMenuBar;
