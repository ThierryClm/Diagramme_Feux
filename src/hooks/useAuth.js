import { useState, useCallback, useEffect } from 'react';
import { safeShowOpenFilePicker, safeShowSaveFilePicker } from '../utils/filePicker';
import { isExampleSession } from '../utils/exampleMode';

// Visiteur d'une session « projet exemple » : découvre l'outil sans créer de
// compte. Permissions de modification totale pour que rien ne soit grisé, mais
// pas administrateur — la gestion des comptes du poste reste hors de portée.
// Jamais écrit dans localStorage : la session meurt avec l'onglet.
export const EXAMPLE_VISITOR = { username: 'Visiteur', permissions: 'total', isAdmin: false };

// Niveaux de permissions
export const PERMISSIONS = {
    'lecture': {
        label: 'Lecture seule',
        // Menu Fichier
        canOpen: true,
        canSave: false,
        canImportExcel: false,
        canPrint: true,
        canClose: true,
        // Diagramme
        canDuplicate: false,
        canModifyDiagram: false,
        canModifyDuplicate: false,
        // Onde verte
        canOpenGreenWave: true,
        // Utilisateurs
        canManageUsers: false
    },
    'partiel': {
        label: 'Modification partielle',
        // Menu Fichier
        canOpen: true,
        canSave: true,
        canImportExcel: true,
        canPrint: true,
        canClose: true,
        // Diagramme
        canDuplicate: true,
        canModifyDiagram: false,
        canModifyDuplicate: true,
        // Onde verte
        canOpenGreenWave: true,
        // Utilisateurs
        canManageUsers: false
    },
    'total': {
        label: 'Modification totale',
        // Menu Fichier
        canOpen: true,
        canSave: true,
        canImportExcel: true,
        canPrint: true,
        canClose: true,
        // Diagramme
        canDuplicate: true,
        canModifyDiagram: true,
        canModifyDuplicate: true,
        // Onde verte
        canOpenGreenWave: true,
        // Utilisateurs
        canManageUsers: true
    }
};

// Fonction de hachage simple (SHA-256)
const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Vérifier si le hachage correspond
const verifyPassword = async (password, hash) => {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
};

export const useAuth = () => {
    // État d'authentification
    const [currentUser, setCurrentUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [users, setUsers] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // Charger les utilisateurs et la session au démarrage
    useEffect(() => {
        const loadData = async () => {
            try {
                // Charger les utilisateurs depuis localStorage
                const savedUsers = localStorage.getItem('auth_users');
                if (savedUsers) {
                    setUsers(JSON.parse(savedUsers));
                }

                // Vérifier s'il y a une session active
                let sessionRetablie = false;
                const savedSession = localStorage.getItem('auth_session');
                if (savedSession) {
                    const session = JSON.parse(savedSession);
                    const usersData = JSON.parse(savedUsers || '{}');

                    // Vérifier que l'utilisateur existe toujours
                    if (usersData[session.username]) {
                        setCurrentUser({
                            username: session.username,
                            permissions: usersData[session.username].permissions,
                            isAdmin: usersData[session.username].isAdmin
                        });
                        setIsAuthenticated(true);
                        sessionRetablie = true;
                    } else {
                        // Session invalide, la supprimer
                        localStorage.removeItem('auth_session');
                    }
                }

                // À défaut de session, un projet exemple entre sans compte :
                // il doit s'ouvrir d'un clic, sans formulaire préalable.
                if (!sessionRetablie && isExampleSession()) {
                    setCurrentUser(EXAMPLE_VISITOR);
                    setIsAuthenticated(true);
                }
            } catch (e) {
                console.error('Erreur chargement auth:', e);
            }
            setIsLoading(false);
        };

        loadData();
    }, []);

    // Sauvegarder les utilisateurs dans localStorage
    const saveUsers = useCallback((usersData) => {
        localStorage.setItem('auth_users', JSON.stringify(usersData));
        setUsers(usersData);
    }, []);

    // Vérifier s'il y a des utilisateurs (vérifie directement localStorage pour éviter les problèmes de timing)
    const hasUsers = useCallback(() => {
        // Vérifier d'abord l'état local
        if (Object.keys(users).length > 0) {
            return true;
        }
        // Sinon vérifier directement localStorage (au cas où l'état n'est pas encore synchronisé)
        try {
            const savedUsers = localStorage.getItem('auth_users');
            if (savedUsers) {
                const parsedUsers = JSON.parse(savedUsers);
                return Object.keys(parsedUsers).length > 0;
            }
        } catch (e) {
            console.error('Erreur vérification utilisateurs:', e);
        }
        return false;
    }, [users]);

    // Connexion
    const login = useCallback(async (username, password) => {
        const usersData = JSON.parse(localStorage.getItem('auth_users') || '{}');

        if (!usersData[username]) {
            return { success: false, error: 'Utilisateur inconnu' };
        }

        const isValid = await verifyPassword(password, usersData[username].password);
        if (!isValid) {
            return { success: false, error: 'Mot de passe incorrect' };
        }

        const user = {
            username,
            permissions: usersData[username].permissions,
            isAdmin: usersData[username].isAdmin
        };

        setCurrentUser(user);
        setIsAuthenticated(true);

        // Sauvegarder la session
        localStorage.setItem('auth_session', JSON.stringify({
            username,
            loginTime: Date.now()
        }));

        return { success: true };
    }, []);

    // Déconnexion
    const logout = useCallback(() => {
        setCurrentUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('auth_session');
    }, []);

    // Créer un utilisateur
    const createUser = useCallback(async (username, password, permissions = 'lecture') => {
        if (!username || !password) {
            return { success: false, error: 'Nom d\'utilisateur et mot de passe requis' };
        }

        const usersData = JSON.parse(localStorage.getItem('auth_users') || '{}');

        if (usersData[username]) {
            return { success: false, error: 'Cet utilisateur existe déjà' };
        }

        const isFirstUser = Object.keys(usersData).length === 0;
        const hashedPassword = await hashPassword(password);

        usersData[username] = {
            password: hashedPassword,
            permissions: isFirstUser ? 'total' : permissions,
            isAdmin: isFirstUser,
            createdAt: Date.now()
        };

        saveUsers(usersData);

        // Si c'est le premier utilisateur, le connecter automatiquement
        if (isFirstUser) {
            setCurrentUser({
                username,
                permissions: 'total',
                isAdmin: true
            });
            setIsAuthenticated(true);
            localStorage.setItem('auth_session', JSON.stringify({
                username,
                loginTime: Date.now()
            }));
        }

        return { success: true, isFirstUser };
    }, [saveUsers]);

    // Mettre à jour les permissions d'un utilisateur
    const updateUser = useCallback((username, newPermissions) => {
        const usersData = JSON.parse(localStorage.getItem('auth_users') || '{}');

        if (!usersData[username]) {
            return { success: false, error: 'Utilisateur non trouvé' };
        }

        usersData[username].permissions = newPermissions;
        saveUsers(usersData);

        // Si l'utilisateur modifié est l'utilisateur courant, mettre à jour
        if (currentUser && currentUser.username === username) {
            setCurrentUser(prev => ({ ...prev, permissions: newPermissions }));
        }

        return { success: true };
    }, [currentUser, saveUsers]);

    // Supprimer un utilisateur
    const deleteUser = useCallback((username) => {
        if (currentUser && currentUser.username === username) {
            return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' };
        }

        const usersData = JSON.parse(localStorage.getItem('auth_users') || '{}');

        if (!usersData[username]) {
            return { success: false, error: 'Utilisateur non trouvé' };
        }

        if (usersData[username].isAdmin) {
            // Vérifier qu'il reste au moins un admin
            const adminCount = Object.values(usersData).filter(u => u.isAdmin).length;
            if (adminCount <= 1) {
                return { success: false, error: 'Impossible de supprimer le dernier administrateur' };
            }
        }

        delete usersData[username];
        saveUsers(usersData);

        return { success: true };
    }, [currentUser, saveUsers]);

    // Changer le mot de passe
    const changePassword = useCallback(async (username, oldPassword, newPassword) => {
        const usersData = JSON.parse(localStorage.getItem('auth_users') || '{}');

        if (!usersData[username]) {
            return { success: false, error: 'Utilisateur non trouvé' };
        }

        const isValid = await verifyPassword(oldPassword, usersData[username].password);
        if (!isValid) {
            return { success: false, error: 'Ancien mot de passe incorrect' };
        }

        usersData[username].password = await hashPassword(newPassword);
        saveUsers(usersData);

        return { success: true };
    }, [saveUsers]);

    // Réinitialiser le mot de passe (admin)
    const resetPassword = useCallback(async (username, newPassword) => {
        const usersData = JSON.parse(localStorage.getItem('auth_users') || '{}');

        if (!usersData[username]) {
            return { success: false, error: 'Utilisateur non trouvé' };
        }

        usersData[username].password = await hashPassword(newPassword);
        saveUsers(usersData);

        return { success: true };
    }, [saveUsers]);

    // Vérifier une permission
    const hasPermission = useCallback((permission) => {
        if (!currentUser) return false;
        const perms = PERMISSIONS[currentUser.permissions];
        if (!perms) return false;

        // canManageUsers nécessite d'être admin
        if (permission === 'canManageUsers') {
            return currentUser.isAdmin && perms[permission];
        }

        return perms[permission] === true;
    }, [currentUser]);

    // Exporter les utilisateurs vers un fichier JSON
    const exportUsersToFile = useCallback(async () => {
        if (!window.showSaveFilePicker) {
            // Fallback: téléchargement classique
            const usersData = JSON.parse(localStorage.getItem('auth_users') || '{}');
            const blob = new Blob([JSON.stringify(usersData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'utilisateurs.json';
            a.click();
            URL.revokeObjectURL(url);
            return { success: true };
        }

        try {
            const fileHandle = await safeShowSaveFilePicker({
                suggestedName: 'utilisateurs.json',
                types: [{
                    description: 'Fichier JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            });

            const usersData = JSON.parse(localStorage.getItem('auth_users') || '{}');
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(usersData, null, 2));
            await writable.close();

            return { success: true };
        } catch (e) {
            if (e.name === 'AbortError') {
                return { success: false, error: 'Annulé' };
            }
            return { success: false, error: e.message };
        }
    }, []);

    // Importer les utilisateurs depuis un fichier JSON
    const importUsersFromFile = useCallback(async () => {
        if (!window.showOpenFilePicker) {
            return { success: false, error: 'API File System non supportée' };
        }

        try {
            const [fileHandle] = await safeShowOpenFilePicker({
                types: [{
                    description: 'Fichier JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            });

            const file = await fileHandle.getFile();
            const content = await file.text();
            const importedUsers = JSON.parse(content);

            // Valider la structure
            for (const [username, userData] of Object.entries(importedUsers)) {
                if (!userData.password || !userData.permissions) {
                    return { success: false, error: `Données invalides pour l'utilisateur ${username}` };
                }
                if (!PERMISSIONS[userData.permissions]) {
                    return { success: false, error: `Permission invalide pour ${username}: ${userData.permissions}` };
                }
            }

            // Vérifier qu'il y a au moins un admin
            const hasAdmin = Object.values(importedUsers).some(u => u.isAdmin);
            if (!hasAdmin) {
                return { success: false, error: 'Le fichier doit contenir au moins un administrateur' };
            }

            saveUsers(importedUsers);

            // Déconnecter l'utilisateur courant si son compte n'existe plus
            if (currentUser && !importedUsers[currentUser.username]) {
                logout();
            }

            return { success: true, count: Object.keys(importedUsers).length };
        } catch (e) {
            if (e.name === 'AbortError') {
                return { success: false, error: 'Annulé' };
            }
            return { success: false, error: e.message };
        }
    }, [currentUser, logout, saveUsers]);

    // Liste des utilisateurs (pour l'admin)
    const getUsersList = useCallback(() => {
        return Object.entries(users).map(([username, data]) => ({
            username,
            permissions: data.permissions,
            isAdmin: data.isAdmin,
            createdAt: data.createdAt
        }));
    }, [users]);

    return {
        // État
        currentUser,
        isAuthenticated,
        isLoading,
        users,

        // Méthodes
        hasUsers,
        login,
        logout,
        createUser,
        updateUser,
        deleteUser,
        changePassword,
        resetPassword,
        hasPermission,
        getUsersList,
        exportUsersToFile,
        importUsersFromFile,

        // Constantes
        PERMISSIONS
    };
};

export default useAuth;
