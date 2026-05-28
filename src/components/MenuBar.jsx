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
    hasActiveProject = true,
    onManageUsers,
    biCarrefourSeparator = null,
    layoutOptions = {},
    pixelsPerSecond = 10,
    onPixelsPerSecondChange,
    showMicroOnHover = true,
    initialOpenMenu = null
}) => {
    const [openMenu, setOpenMenu] = useState(initialOpenMenu);
    const [openSubmenu, setOpenSubmenu] = useState(null);
    const menuRef = useRef(null);
    // Timer pour l'ouverture différée au survol (filtre les passages rapides)
    const hoverTimerRef = useRef(null);

    // Drapeau « import Excel » : la fonctionnalité dépend du modèle de
    // fichier Excel (mises en page variables d'un éditeur à l'autre) et n'est
    // pas généralisée. Désactivée par défaut pour tous les utilisateurs.
    //
    // Débloquée automatiquement quand l'utilisateur connecté est « Colmonclm »
    // (compte de l'auteur, qui en a un usage actif sur ses propres projets).
    //
    // Secours : drapeau localStorage pour les besoins de développement /
    // test sans authentification :
    //   localStorage.setItem('excelImportEnabled', 'true');
    //
    // Note : le code étant publié sous AGPL v3, le nom de compte ci-dessous
    // est visible publiquement. C'est une convention de visibilité, pas une
    // sécurité — quiconque créerait un compte « Colmonclm » sur son
    // installation locale pourrait débloquer la fonctionnalité (cas d'usage
    // attendu pour un développeur qui contribue à améliorer l'import).
    const excelImportEnabled = (() => {
        if (currentUser?.username === 'Colmonclm') return true;
        try {
            return localStorage.getItem('excelImportEnabled') === 'true';
        } catch {
            return false;
        }
    })();

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

    // Nettoyage du timer de survol au démontage
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
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
                // Grisé seulement si un projet est ouvert et non modifié.
                // Sur l'écran d'accueil (aucun projet), l'entrée reste active
                // pour permettre de démarrer un projet.
                { label: 'Nouveau projet', action: 'new', disabled: hasActiveProject && !layoutOptions.projectModified },
                ...(recentOpenDirs.length > 0 ? [{
                    label: 'Ouvrir un projet...',
                    type: 'submenu',
                    submenuId: 'openRecent',
                    submenu: recentOpenDirsSubmenu
                }] : [{ label: 'Ouvrir un projet...', action: 'open' }]),
                { label: 'Restaurer un projet récent...', action: 'openLocalStorage' },
                ...(recentSaveDirs.length > 0 ? [{
                    label: 'Sauvegarder...',
                    type: 'submenu',
                    submenuId: 'saveRecent',
                    submenu: recentSaveDirsSubmenu,
                    disabled: !hasPermission('canSave') || !hasActiveProject || layoutOptions.isExampleProject,
                    title: layoutOptions.isExampleProject ? 'Projet exemple : non enregistrable' : (!hasActiveProject ? 'Aucun projet ouvert' : '')
                }] : [{
                    label: 'Sauvegarder',
                    action: 'save',
                    disabled: !hasPermission('canSave') || !hasActiveProject || layoutOptions.isExampleProject,
                    title: layoutOptions.isExampleProject ? 'Projet exemple : non enregistrable' : (!hasActiveProject ? 'Aucun projet ouvert' : '')
                }]),
                { type: 'separator' },
                { label: 'Interopérabilité...', disabled: true, title: 'Fonctionnalité envisageable : interopérabilité avec d\'autres systèmes (propriétaires ou ouverts) pour l\'échange de programmation de contrôleurs de carrefour. Évolutivité prévue — non opérationnelle dans cette version.' },
                ...(recentImportDirs.length > 0 ? [{
                    label: 'Importer Excel...',
                    type: 'submenu',
                    submenuId: 'importRecent',
                    submenu: recentImportDirsSubmenu,
                    disabled: !hasPermission('canImportExcel') || !excelImportEnabled,
                    title: !excelImportEnabled ? 'Fonctionnalité envisageable selon modèle — non opérationnelle dans cette version' : 'Importation sur mesure pour une collectivité.'
                }] : [{
                    label: 'Importer Excel...',
                    action: 'import',
                    disabled: !hasPermission('canImportExcel') || !excelImportEnabled,
                    title: !excelImportEnabled ? 'Fonctionnalité envisageable selon modèle — non opérationnelle dans cette version' : 'Importation sur mesure pour une collectivité.'
                }]),
                { label: 'Liens externes...', action: 'externalLinks', disabled: !hasActiveProject, title: !hasActiveProject ? 'Aucun projet ouvert' : '' },
                { type: 'separator' },
                { label: 'Imprimer le projet...', action: 'printDossier', disabled: !hasActiveProject, title: !hasActiveProject ? 'Aucun projet ouvert' : '' },
                {
                    label: 'Exporter en PNG...',
                    disabled: !hasActiveProject,
                    title: !hasActiveProject ? 'Aucun projet ouvert' : '',
                    type: 'submenu',
                    submenuId: 'exportPng',
                    submenu: (() => {
                        const inEditMode = !layoutOptions.phasageBulleEnabled && !layoutOptions.simulationEnabled;
                        return [
                            {
                                label: 'Formulaire',
                                action: 'exportPngFormulaire',
                                disabled: layoutOptions.activeTab !== 'config',
                                title: layoutOptions.activeTab !== 'config' ? 'Activez l\'onglet Configuration pour rendre cet export disponible' : ''
                            },
                            {
                                label: 'Diagramme',
                                action: 'exportPngDiagramme',
                                disabled: !inEditMode,
                                title: !inEditMode ? 'Désactivez le mode Phasage bulle / Simulation pour afficher le diagramme' : ''
                            },
                            {
                                label: 'Matrice interverts',
                                action: 'exportPngMatrice',
                                disabled: layoutOptions.activeTab !== 'matrix',
                                title: layoutOptions.activeTab !== 'matrix' ? 'Activez l\'onglet Matrice pour rendre cet export disponible' : ''
                            },
                            {
                                label: 'Conditions de micro-régulation',
                                action: 'exportPngMicroRegulation',
                                disabled: !inEditMode,
                                title: !inEditMode ? 'Désactivez le mode Phasage bulle / Simulation pour afficher la table' : ''
                            },
                            {
                                label: 'Image du carrefour',
                                action: 'exportPngImageCarrefour',
                                disabled: !layoutOptions.simulationEnabled,
                                title: !layoutOptions.simulationEnabled ? 'Activez le mode Simulation pour afficher l\'image' : ''
                            },
                            {
                                label: 'Capacité utilisée',
                                action: 'exportPngCapaciteUtilisee',
                                disabled: layoutOptions.activeTab !== 'traffic',
                                title: layoutOptions.activeTab !== 'traffic' ? 'Activez l\'onglet Trafic pour rendre cet export disponible' : ''
                            },
                            {
                                label: 'Phasage bulle',
                                action: 'exportPngPhasageBulle',
                                disabled: !layoutOptions.phasageBulleEnabled,
                                title: !layoutOptions.phasageBulleEnabled ? 'Activez le mode Phasage bulle pour rendre cet export disponible' : ''
                            }
                        ];
                    })()
                },
                { type: 'separator' },
                { label: 'Fermer', action: 'close' }
            ]
        },
        miseEnPage: {
            label: 'Mise en page',
            disabled: !hasActiveProject,
            items: [
                { label: 'Affichage des paramètres', action: 'toggleParameters', toggle: true, checked: layoutOptions.showParameters, keepSubmenuOpen: true },
                { label: 'Commentaires du diagramme', action: 'toggleComments', toggle: true, checked: layoutOptions.showComments, keepSubmenuOpen: true },
                { label: 'Remarques du diagramme', action: 'toggleRemarks', toggle: true, checked: layoutOptions.showRemarks, keepSubmenuOpen: true },
                { label: 'Description des conditions micro', action: 'toggleActionDescription', toggle: true, checked: layoutOptions.showActionDescription, keepSubmenuOpen: true },
                { type: 'separator' },
                {
                    label: 'Nom des groupes de feu dans...',
                    type: 'submenu',
                    submenuId: 'nomGF',
                    submenu: [
                        { label: 'le formulaire', action: 'toggleGroupNamesForm', checked: layoutOptions.showGroupNamesForm, keepSubmenuOpen: true },
                        { label: 'la matrice', action: 'toggleGroupNamesMatrix', checked: layoutOptions.showGroupNamesMatrix, keepSubmenuOpen: true },
                        { label: 'le diagramme', action: 'toggleGroupNamesDiagram', checked: layoutOptions.showGroupNamesDiagram, keepSubmenuOpen: true }
                    ]
                },
                {
                    label: 'Détachement...',
                    type: 'submenu',
                    submenuId: 'detachement',
                    submenu: [
                        { label: 'Formulaire', action: 'toggleFloatingForm', checked: layoutOptions.showFloatingForm, keepSubmenuOpen: true },
                        { label: 'Matrice interverts', action: 'toggleFloatingMatrix', checked: layoutOptions.showFloatingMatrix, keepSubmenuOpen: true },
                        { label: 'Données trafic', action: 'toggleFloatingTraffic', checked: layoutOptions.showFloatingTraffic, keepSubmenuOpen: true },
                        { label: 'Conditions de micro-régulation', action: 'toggleFloatingConditions', checked: layoutOptions.showFloatingConditions, keepSubmenuOpen: true },
                        { label: 'Variables micro', action: 'toggleFloatingVariables', checked: layoutOptions.showFloatingVariables, keepSubmenuOpen: true },
                        { label: 'Remarques du diagramme', action: 'toggleFloatingRemarks', checked: layoutOptions.showFloatingRemarks, disabled: !layoutOptions.showRemarks, keepSubmenuOpen: true },
                        { label: 'Image du carrefour', action: 'toggleFloatingImage', checked: layoutOptions.showFloatingImage, disabled: !layoutOptions.hasIntersectionImage, keepSubmenuOpen: true }
                    ]
                },
                {
                    label: 'Infobulles...',
                    type: 'submenu',
                    submenuId: 'tooltips',
                    submenu: [
                        { label: 'Page principale',                 action: 'toggleTooltipsMain',    checked: !!layoutOptions.tooltipPrefs?.main,    keepSubmenuOpen: true },
                        { label: 'Configuration',                   action: 'toggleTooltipsConfig',  checked: !!layoutOptions.tooltipPrefs?.config,  keepSubmenuOpen: true },
                        { label: 'Diagramme',                       action: 'toggleTooltipsDiagram', checked: !!layoutOptions.tooltipPrefs?.diagram, keepSubmenuOpen: true },
                        { label: 'Matrice',                         action: 'toggleTooltipsMatrix',  checked: !!layoutOptions.tooltipPrefs?.matrix,  keepSubmenuOpen: true },
                        { label: 'Trafic',                          action: 'toggleTooltipsTraffic', checked: !!layoutOptions.tooltipPrefs?.traffic, keepSubmenuOpen: true },
                        { label: 'Conditions de micro-régulation',  action: 'toggleTooltipsMicro',   checked: !!layoutOptions.tooltipPrefs?.micro,   keepSubmenuOpen: true }
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
            disabled: !hasActiveProject,
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
            // Action directe (sans sous-menu) : un clic lance le module Onde
            // verte dans un nouvel onglet, vide. La création/ouverture d'une
            // onde verte se fait depuis le menu Fichier de cette nouvelle fenêtre.
            action: 'launchGreenWave'
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
                    onClick={() => !item.disabled && handleItemClick(item.action, item.keepSubmenuOpen)}
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
            <button
                type="button"
                className="menu-bar-logo-btn"
                onClick={() => handleItemClick('credit')}
                title="À propos de TraCflux"
                aria-label="À propos"
            >
                <img src="./logo.svg" className="menu-bar-logo" alt="TraCflux" />
            </button>
            {Object.entries(menus).map(([key, menu]) => (
                <div key={key} className="menu-container">
                    <button
                        className={`menu-button ${openMenu === key ? 'active' : ''}`}
                        onClick={() => {
                            if (menu.disabled) return;
                            if (menu.action) handleItemClick(menu.action);
                            else handleMenuClick(key);
                        }}
                        onMouseEnter={() => {
                            // Si un menu est déjà ouvert : bascule immédiate (pas de délai).
                            if (openMenu) {
                                if (menu.items && !menu.disabled) {
                                    setOpenMenu(key);
                                } else {
                                    // Menu-action direct (ex. Onde verte) ou menu désactivé :
                                    // rien à montrer, on ferme les dropdowns ouverts.
                                    setOpenMenu(null);
                                    setOpenSubmenu(null);
                                }
                                return;
                            }
                            // Aucun menu ouvert : ouverture différée (150 ms) sur les menus
                            // avec dropdown disponible, pour filtrer les survols accidentels.
                            if (menu.items && !menu.disabled) {
                                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = setTimeout(() => {
                                    setOpenMenu(key);
                                    hoverTimerRef.current = null;
                                }, 150);
                            }
                        }}
                        onMouseLeave={() => {
                            // Annule l'ouverture différée si on quitte avant la fin du délai.
                            if (hoverTimerRef.current) {
                                clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = null;
                            }
                        }}
                        disabled={menu.disabled}
                        title={menu.disabled && !hasActiveProject ? 'Aucun projet ouvert' : ''}
                    >
                        {menu.label}
                    </button>
                    {openMenu === key && menu.items && !menu.disabled && (
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
