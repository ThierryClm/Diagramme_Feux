import React, { useState, useRef, useEffect } from 'react';
import './MenuBar.css';

const MenuBar = ({
    onAction,
    arrowStyle,
    onArrowStyleChange,
    importedFiles = [],
    recentDirectories = [],
    recentOpenDirs = [],
    recentImportDirs = [],
    recentSaveDirs = [],
    currentUser = null,
    hasPermission = () => true,
    onManageUsers
}) => {
    const [openMenu, setOpenMenu] = useState(null);
    const [openSubmenu, setOpenSubmenu] = useState(null);
    const menuRef = useRef(null);

    // Available arrow styles
    const arrowStyles = [
        { id: 'solid', label: 'Trait plein' },
        { id: 'dashed', label: 'Trait pointillé' },
        { id: 'dotted', label: 'Points' },
        { id: 'double', label: 'Double trait' }
    ];

    // Close menu when clicking outside
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

    const handleMenuClick = (menuName) => {
        setOpenMenu(openMenu === menuName ? null : menuName);
        setOpenSubmenu(null);
    };

    const handleItemClick = (action) => {
        setOpenMenu(null);
        setOpenSubmenu(null);

        // Handle special actions
        if (action === 'manageUsers' && onManageUsers) {
            onManageUsers();
            return;
        }

        if (onAction) {
            onAction(action);
        }
    };

    const handleSubmenuHover = (submenuId) => {
        setOpenSubmenu(submenuId);
    };

    const handleArrowStyleSelect = (styleId) => {
        if (onArrowStyleChange) {
            onArrowStyleChange(styleId);
        }
        setOpenMenu(null);
        setOpenSubmenu(null);
    };

    // Build imported files submenu dynamically
    const importedFilesSubmenu = importedFiles.length > 0
        ? [
            { label: 'Fichiers HTM disponibles', type: 'header' },
            ...importedFiles.map(file => ({
                label: file.name,
                action: `openImportedFile:${file.id}`
            }))
        ]
        : [{ label: '(Aucun fichier)', type: 'header' }];

    // Build recent directories submenu dynamically
    const recentDirsSubmenu = [
        { label: 'Parcourir...', action: 'browseImport' },
        { type: 'separator' },
        ...(recentDirectories.length > 0
            ? [
                { label: 'Répertoires récents', type: 'header' },
                ...recentDirectories.map((dir, idx) => ({
                    label: dir.name || dir.path,
                    action: `importFromDir:${idx}`
                }))
            ]
            : [{ label: '(Aucun répertoire récent)', type: 'header', disabled: true }]
        )
    ];

    // Build recent open directories submenu
    const recentOpenDirsSubmenu = [
        { label: 'Parcourir...', action: 'open' },
        ...(recentOpenDirs.length > 0 ? [
            { type: 'separator' },
            { label: 'Répertoires récents', type: 'header' },
            ...recentOpenDirs.map((dir, idx) => ({
                label: dir.name,
                action: `openFromRecentDir:${idx}`
            }))
        ] : [])
    ];

    // Build recent import directories submenu
    const recentImportDirsSubmenu = [
        { label: 'Parcourir...', action: 'import' },
        ...(recentImportDirs.length > 0 ? [
            { type: 'separator' },
            { label: 'Répertoires récents', type: 'header' },
            ...recentImportDirs.map((dir, idx) => ({
                label: dir.name,
                action: `importFromRecentDir:${idx}`
            }))
        ] : [])
    ];

    // Build recent save directories submenu
    const recentSaveDirsSubmenu = [
        { label: 'Parcourir...', action: 'save' },
        ...(recentSaveDirs.length > 0 ? [
            { type: 'separator' },
            { label: 'Répertoires récents', type: 'header' },
            ...recentSaveDirs.map((dir, idx) => ({
                label: dir.name,
                action: `saveToRecentDir:${idx}`
            }))
        ] : [])
    ];

    const menus = {
        fichier: {
            label: 'Fichier',
            items: [
                { label: 'Nouveau', action: 'new', disabled: !hasPermission('canModifyDiagram') },
                ...(recentOpenDirs.length > 0 ? [{
                    label: 'Ouvrir...',
                    type: 'submenu',
                    submenuId: 'openRecent',
                    submenu: recentOpenDirsSubmenu
                }] : [{ label: 'Ouvrir...', action: 'open' }]),
                { label: 'Ouvrir depuis le local storage...', action: 'openLocalStorage' },
                ...(recentSaveDirs.length > 0 ? [{
                    label: 'Sauvegarder...',
                    type: 'submenu',
                    submenuId: 'saveRecent',
                    submenu: recentSaveDirsSubmenu,
                    disabled: !hasPermission('canSave')
                }] : [{ label: 'Sauvegarder', action: 'save', disabled: !hasPermission('canSave') }]),
                { type: 'separator' },
                ...(recentImportDirs.length > 0 ? [{
                    label: 'Importer Excel...',
                    type: 'submenu',
                    submenuId: 'importRecent',
                    submenu: recentImportDirsSubmenu,
                    disabled: !hasPermission('canImportExcel')
                }] : [{ label: 'Importer Excel...', action: 'import', disabled: !hasPermission('canImportExcel') }]),
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
                { label: 'Dupliquer le diagramme', action: 'duplicate', disabled: !hasPermission('canDuplicate') },
                { label: 'Supprimer le diagramme actif', action: 'deleteActiveDiagram', disabled: !hasPermission('canModifyDiagram') },
                { label: 'Déplacer un groupe de feu...', action: 'moveGroup', disabled: !hasPermission('canModifyDiagram') },
                { type: 'separator' },
                { label: 'Glisser...', action: 'slide', disabled: !hasPermission('canModifyDiagram') },
                { label: 'Inserer...', action: 'insert', disabled: !hasPermission('canModifyDiagram') },
                { label: 'Réduire...', action: 'reduce', disabled: !hasPermission('canModifyDiagram') },
                { type: 'separator' },
                {
                    label: 'Options...',
                    type: 'submenu',
                    submenuId: 'options',
                    submenu: [
                        { label: 'Style de flèche', type: 'header' },
                        { label: 'Trait plein', action: 'arrowStyle:solid', styleId: 'solid' },
                        { label: 'Trait pointillé', action: 'arrowStyle:dashed', styleId: 'dashed' },
                        { label: 'Points', action: 'arrowStyle:dotted', styleId: 'dotted' },
                        { label: 'Double trait', action: 'arrowStyle:double', styleId: 'double' },
                        { type: 'separator' },
                        { label: 'Légende', action: 'legend' }
                    ]
                }
            ]
        },
        ondeVerte: {
            label: 'Onde verte',
            items: [
                { label: 'Ouvrir une onde verte...', action: 'openGreenWave' },
                { label: 'Ouvrir depuis le réseau...', action: 'openGreenWaveFromFile' },
                { label: 'Créer une onde verte...', action: 'createGreenWave' }
            ]
        },
        apropos: {
            label: 'A propos',
            items: [
                { label: 'Aide', action: 'help' },
                { label: 'Crédit', action: 'credit' }
            ]
        },
        ...(currentUser?.isAdmin ? {
            utilisateurs: {
                label: 'Utilisateurs',
                items: [
                    { label: 'Gérer les utilisateurs...', action: 'manageUsers' }
                ]
            }
        } : {})
    };

    // Render submenu item (for Options submenu)
    const renderSubmenuItem = (subItem, subIdx, parentSubmenuId) => {
        if (subItem.type === 'separator') {
            return <div key={subIdx} className="menu-separator" />;
        }

        if (subItem.type === 'header') {
            return (
                <div key={subIdx} className="menu-header">
                    {subItem.label}
                </div>
            );
        }

        // Check if this is an arrow style item
        if (subItem.styleId) {
            return (
                <button
                    key={subIdx}
                    className={`menu-item ${arrowStyle === subItem.styleId ? 'checked' : ''}`}
                    onClick={() => handleArrowStyleSelect(subItem.styleId)}
                >
                    {arrowStyle === subItem.styleId && <span className="checkmark">✓</span>}
                    {subItem.label}
                </button>
            );
        }

        return (
            <button
                key={subIdx}
                className="menu-item"
                onClick={() => handleItemClick(subItem.action)}
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
                    className={`menu-item-with-submenu ${item.disabled ? 'disabled' : ''}`}
                    onMouseEnter={() => !item.disabled && handleSubmenuHover(item.submenuId)}
                    onMouseLeave={(e) => {
                        // Only close if not moving to submenu
                        const relatedTarget = e.relatedTarget;
                        if (!e.currentTarget.contains(relatedTarget)) {
                            setOpenSubmenu(null);
                        }
                    }}
                >
                    <button className={`menu-item has-submenu ${item.disabled ? 'disabled' : ''}`} disabled={item.disabled}>
                        {item.label}
                        <span className="submenu-arrow">▶</span>
                    </button>
                    {openSubmenu === item.submenuId && !item.disabled && (
                        <div className="submenu-dropdown">
                            {item.submenu.map((subItem, subIdx) =>
                                renderSubmenuItem(subItem, subIdx, item.submenuId)
                            )}
                        </div>
                    )}
                </div>
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

export default MenuBar;
