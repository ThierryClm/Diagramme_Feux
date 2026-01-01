import React, { useState, useRef, useEffect } from 'react';
import './MenuBar.css';

const MenuBar = ({ onAction }) => {
    const [openMenu, setOpenMenu] = useState(null);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMenuClick = (menuName) => {
        setOpenMenu(openMenu === menuName ? null : menuName);
    };

    const handleItemClick = (action) => {
        setOpenMenu(null);
        if (onAction) {
            onAction(action);
        }
    };

    const menus = {
        fichier: {
            label: 'Fichier',
            items: [
                { label: 'Nouveau', action: 'new' },
                { label: 'Ouvrir...', action: 'open' },
                { label: 'Enregistrer', action: 'save' },
                { type: 'separator' },
                { label: 'Importer...', action: 'import' },
                { label: 'Exporter...', action: 'export' },
                { type: 'separator' },
                { label: 'Imprimer la matrice...', action: 'printMatrix' },
                { label: 'Imprimer le formulaire...', action: 'printForm' },
                { label: 'Imprimer le diagramme...', action: 'printDiagram' },
                { type: 'separator' },
                { label: 'Fermer', action: 'close' }
            ]
        },
        diagramme: {
            label: 'Diagramme',
            items: [
                { label: 'Dupliquer le diagramme', action: 'duplicate' },
                { label: 'Déplacer un groupe de feu...', action: 'moveGroup' },
                { type: 'separator' },
                { label: 'Glisser...', action: 'slide' },
                { label: 'Inserer...', action: 'insert' },
                { label: 'Réduire...', action: 'reduce' },
                { type: 'separator' },
                { label: 'Options...', action: 'options' }
            ]
        },
        ondeVerte: {
            label: 'Onde verte',
            items: [
                { label: 'Ouvrir une onde verte...', action: 'openGreenWave' },
                { label: 'Créer une onde verte...', action: 'createGreenWave' }
            ]
        },
        apropos: {
            label: 'A propos',
            items: [
                { label: 'Aide', action: 'help' },
                { label: 'Crédit', action: 'credit' }
            ]
        }
    };

    return (
        <div className="menu-bar" ref={menuRef}>
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
                            {menu.items.map((item, idx) => (
                                item.type === 'separator' ? (
                                    <div key={idx} className="menu-separator" />
                                ) : (
                                    <button
                                        key={idx}
                                        className="menu-item"
                                        onClick={() => handleItemClick(item.action)}
                                    >
                                        {item.label}
                                    </button>
                                )
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default MenuBar;
