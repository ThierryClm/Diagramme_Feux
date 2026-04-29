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
    onManageUsers,
    biCarrefourSeparator = null,
    layoutOptions = {},
    pixelsPerSecond = 10,
    onPixelsPerSecondChange,
    showMicroOnHover = true
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

    const handleItemClick = (action, keepSubmenuOpen = false) => {
        if (!keepSubmenuOpen) {
            setOpenMenu(null);
            setOpenSubmenu(null);
        }

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
                { label: 'Nouveau projet', action: 'new', disabled: !layoutOptions.projectModified },
                ...(recentOpenDirs.length > 0 ? [{
                    label: 'Ouvrir un projet...',
                    type: 'submenu',
                    submenuId: 'openRecent',
                    submenu: recentOpenDirsSubmenu
                }] : [{ label: 'Ouvrir un projet...', action: 'open' }]),
                { label: 'Ouvrir depuis le local storage...', action: 'openLocalStorage' },
                ...(recentSaveDirs.length > 0 ? [{
                    label: 'Sauvegarder...',
                    type: 'submenu',
                    submenuId: 'saveRecent',
                    submenu: recentSaveDirsSubmenu,
                    disabled: !hasPermission('canSave')
                }] : [{ label: 'Sauvegarder', action: 'save', disabled: !hasPermission('canSave') }]),
                { type: 'separator' },
                {
                    label: 'Importer programmation contrôleur',
                    type: 'submenu',
                    submenuId: 'importController',
                    submenu: [
                        { label: '[redacted] ([redacted])...', action: 'import[redacted]', title: 'Import partiel — fonctionnalité en cours de développement' },
                        { label: 'Traffy', disabled: true, title: 'Fonctionnalité envisageable — non opérationnelle dans cette version' },
                        { label: 'Swarco', disabled: true, title: 'Fonctionnalité envisageable — non opérationnelle dans cette version' },
                        { label: 'Fareco', disabled: true, title: 'Fonctionnalité envisageable — non opérationnelle dans cette version' },
                        { label: 'SEA', disabled: true, title: 'Fonctionnalité envisageable — non opérationnelle dans cette version' }
                    ]
                },
                ...(recentImportDirs.length > 0 ? [{
                    label: 'Importer Excel...',
                    type: 'submenu',
                    submenuId: 'importRecent',
                    submenu: recentImportDirsSubmenu,
                    disabled: !hasPermission('canImportExcel')
                }] : [{ label: 'Importer Excel...', action: 'import', disabled: !hasPermission('canImportExcel') }]),
                { label: 'Lire une boîte noire (.bn)...', action: 'openBlackBox', disabled: true, title: 'Fonctionnalité envisageable — non opérationnelle dans cette version' },
                { label: 'Liens externes...', action: 'externalLinks' },
                { type: 'separator' },
                { label: 'Imprimer le projet...', action: 'printDossier' },
                {
                    label: 'Exporter en PNG...',
                    type: 'submenu',
                    submenuId: 'exportPng',
                    submenu: [
                        { label: 'Diagramme', action: 'exportPngDiagramme' },
                        { label: 'Matrice interverts', action: 'exportPngMatrice' },
                        {
                            label: 'Conditions de micro-régulation',
                            action: 'exportPngMicroRegulation',
                            disabled: !!layoutOptions.phasageBulleEnabled || !!layoutOptions.simulationEnabled || !layoutOptions.hasActionData,
                            title: (!!layoutOptions.phasageBulleEnabled || !!layoutOptions.simulationEnabled)
                                ? 'Désactivez le mode Phasage bulle ou Simulation pour exporter ce tableau'
                                : (!layoutOptions.hasActionData ? 'Aucune action saisie dans le tableau' : '')
                        },
                        {
                            label: 'Image du carrefour',
                            action: 'exportPngImageCarrefour',
                            disabled: !layoutOptions.hasIntersectionImage,
                            title: !layoutOptions.hasIntersectionImage ? 'Aucune image de carrefour chargée' : ''
                        },
                        {
                            label: 'Capacité utilisée',
                            action: 'exportPngCapaciteUtilisee',
                            disabled: layoutOptions.activeTab !== 'traffic',
                            title: layoutOptions.activeTab !== 'traffic' ? 'Activez l\'onglet Trafic pour exporter cette vue' : ''
                        },
                        {
                            label: 'Phasage bulle',
                            action: 'exportPngPhasageBulle',
                            disabled: !layoutOptions.phasageBulleEnabled,
                            title: !layoutOptions.phasageBulleEnabled ? 'Activez le mode Phasage bulle pour exporter cette vue' : ''
                        }
                    ]
                },
                { type: 'separator' },
                { label: 'Fermer', action: 'close' }
            ]
        },
        miseEnPage: {
            label: 'Mise en page',
            items: [
                { label: 'Affichage des paramètres', action: 'toggleParameters', toggle: true, checked: layoutOptions.showParameters },
                { label: 'Commentaires du diagramme', action: 'toggleComments', toggle: true, checked: layoutOptions.showComments },
                { label: 'Remarques du diagramme', action: 'toggleRemarks', toggle: true, checked: layoutOptions.showRemarks },
                { type: 'separator' },
                { label: 'Noms GF dans le formulaire', action: 'toggleGroupNamesForm', toggle: true, checked: layoutOptions.showGroupNamesForm },
                { label: 'Noms GF dans la matrice', action: 'toggleGroupNamesMatrix', toggle: true, checked: layoutOptions.showGroupNamesMatrix },
                { label: 'Noms GF dans les diagrammes', action: 'toggleGroupNamesDiagram', toggle: true, checked: layoutOptions.showGroupNamesDiagram },
                {
                    label: 'Détachement...',
                    type: 'submenu',
                    submenuId: 'detachement',
                    submenu: [
                        { label: 'Formulaire', action: 'toggleFloatingForm', checked: layoutOptions.showFloatingForm },
                        { label: 'Matrice interverts', action: 'toggleFloatingMatrix', checked: layoutOptions.showFloatingMatrix },
                        { label: 'Données trafic', action: 'toggleFloatingTraffic', checked: layoutOptions.showFloatingTraffic },
                        { label: 'Conditions de micro-régulation', action: 'toggleFloatingConditions', checked: layoutOptions.showFloatingConditions },
                        { label: 'Variables micro', action: 'toggleFloatingVariables', checked: layoutOptions.showFloatingVariables },
                        { label: 'Image du carrefour', action: 'toggleFloatingImage', checked: layoutOptions.showFloatingImage, disabled: !layoutOptions.hasIntersectionImage }
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Dilatation du diagramme',
                    type: 'submenu',
                    submenuId: 'dilatation',
                    submenu: [
                        { type: 'slider', label: 'Zoom', min: 4, max: 20, value: pixelsPerSecond, unit: 'px/s', sliderId: 'pixelsPerSecond' }
                    ]
                },
                {
                    label: 'Options de contraste',
                    type: 'submenu',
                    submenuId: 'contraste',
                    submenu: [
                        { label: 'Blanc sur fond noir', action: 'themeDark', themeId: 'dark', keepSubmenuOpen: true },
                        { label: 'Noir sur fond blanc', action: 'themeLight', themeId: 'light', keepSubmenuOpen: true },
                        { label: 'Haut contraste', action: 'themeHighContrast', themeId: 'high-contrast', keepSubmenuOpen: true },
                        { label: 'Contraste ambre', action: 'themeAmber', themeId: 'amber', keepSubmenuOpen: true },
                        { label: 'Daltonien', action: 'themeDaltonian', themeId: 'daltonian', keepSubmenuOpen: true },
                        { label: 'Sépia', action: 'themeSepia', themeId: 'sepia', keepSubmenuOpen: true },
                        { label: 'Bleu nuit', action: 'themeBlueNight', themeId: 'blue-night', keepSubmenuOpen: true }
                    ]
                },
                {
                    label: 'Notifications',
                    type: 'submenu',
                    submenuId: 'notifications',
                    submenu: [
                        { label: 'Messages de succès', action: 'toggleToastSuccess', checked: !!layoutOptions.toastPrefs?.success, keepSubmenuOpen: true },
                        { label: 'Messages d\'erreur', action: 'toggleToastError', checked: !!layoutOptions.toastPrefs?.error, keepSubmenuOpen: true },
                        { label: 'Messages d\'info', action: 'toggleToastInfo', checked: !!layoutOptions.toastPrefs?.info, keepSubmenuOpen: true },
                        { label: 'Nouveau projet', action: 'toggleOpenPropertiesOnNewProject', checked: !!layoutOptions.openPropertiesOnNewProject, keepSubmenuOpen: true },
                        { label: 'Valeur hors cycle dans le diagramme', action: 'toggleShowWrapFlash', checked: !!layoutOptions.showWrapFlash, keepSubmenuOpen: true },
                        { label: 'Rappel de sauvegarde', action: 'toggleSaveReminder', checked: !!layoutOptions.showSaveReminder, keepSubmenuOpen: true }
                    ]
                }
            ]
        },
        diagramme: {
            label: 'Diagramme',
            items: [
                { label: 'Dupliquer le diagramme actif', action: 'duplicate', disabled: !hasPermission('canDuplicate') },
                { label: 'Supprimer le diagramme actif', action: 'deleteActiveDiagram', disabled: !hasPermission('canModifyDiagram') },
                { label: 'Déplacer un groupe de feu...', action: 'moveGroup', disabled: !hasPermission('canModifyDiagram') },
                biCarrefourSeparator
                    ? { label: 'Rétablir en uni-carrefour', action: 'uniCarrefour', disabled: !hasPermission('canModifyDiagram') }
                    : { label: 'Intégrer un bi-Carrefour...', action: 'biCarrefour', disabled: !hasPermission('canModifyDiagram') },
                { label: 'Verrouiller les matrices', action: 'lockMatrices', toggle: true, checked: layoutOptions.matricesLocked },
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
                        { label: 'Légende', action: 'legend' },
                        { type: 'separator' },
                        { label: 'Condition micro au survol', action: 'toggleMicroOnHover', checked: showMicroOnHover }
                    ]
                }
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
                { label: 'Rapport de diagnostic...', action: 'diagnosticReport' },
                { label: 'À propos', action: 'credit' },
                ...(currentUser?.isAdmin ? [
                    { type: 'separator' },
                    { label: 'Utilisateurs', type: 'submenu', submenuId: 'utilisateurs', submenu: [
                        { label: 'Gérer les utilisateurs...', action: 'manageUsers' }
                    ]}
                ] : [])
            ]
        }
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

        if (subItem.type === 'slider') {
            return (
                <div key={subIdx} className="menu-slider-item" onClick={(e) => e.stopPropagation()}>
                    <span className="menu-slider-label">{subItem.label}</span>
                    <input
                        type="range"
                        min={subItem.min}
                        max={subItem.max}
                        value={subItem.value}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (subItem.sliderId === 'pixelsPerSecond' && onPixelsPerSecondChange) {
                                onPixelsPerSecondChange(val);
                            }
                        }}
                        className="menu-slider-input"
                    />
                    <span className="menu-slider-value">{subItem.value}{subItem.unit}</span>
                </div>
            );
        }

        // Check if this is a theme item
        if (subItem.themeId) {
            const isActive = layoutOptions.colorTheme === subItem.themeId;
            return (
                <button
                    key={subIdx}
                    className={`menu-item ${isActive ? 'checked' : ''}`}
                    onClick={() => handleItemClick(subItem.action, subItem.keepSubmenuOpen)}
                >
                    {isActive && <span className="checkmark">✓</span>}
                    {subItem.label}
                </button>
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
                className={`menu-item ${subItem.checked ? 'checked' : ''} ${subItem.disabled ? 'disabled' : ''}`}
                onClick={() => !subItem.disabled && handleItemClick(subItem.action, subItem.keepSubmenuOpen)}
                disabled={subItem.disabled}
                title={subItem.title}
            >
                {subItem.checked !== undefined && subItem.checked && <span className="checkmark" style={{ color: '#2ecc71' }}>✓</span>}
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

        if (item.toggle) {
            return (
                <button
                    key={idx}
                    className={`menu-item ${item.checked ? 'checked' : ''} ${item.disabled ? 'disabled' : ''}`}
                    onClick={() => !item.disabled && handleItemClick(item.action)}
                    onMouseEnter={() => setOpenSubmenu(null)}
                    disabled={item.disabled}
                >
                    <span className="checkmark">{item.checked ? '✓' : '\u00A0\u00A0'}</span>
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
                title={item.title}
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
