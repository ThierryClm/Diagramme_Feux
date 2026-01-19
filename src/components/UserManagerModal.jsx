import { useState } from 'react';
import Modal from './Modal';
import { PERMISSIONS } from '../hooks/useAuth';
import './UserManagerModal.css';

const UserManagerModal = ({
    isOpen,
    onClose,
    currentUser,
    getUsersList,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    exportUsersToFile,
    importUsersFromFile
}) => {
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPermissions, setNewPermissions] = useState('lecture');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Password reset state
    const [resetPasswordUser, setResetPasswordUser] = useState(null);
    const [newResetPassword, setNewResetPassword] = useState('');

    const users = getUsersList();

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsSubmitting(true);

        const result = await createUser(newUsername, newPassword, newPermissions);

        if (result.success) {
            setSuccess(`Utilisateur "${newUsername}" créé avec succès`);
            setNewUsername('');
            setNewPassword('');
            setNewPermissions('lecture');
        } else {
            setError(result.error);
        }

        setIsSubmitting(false);
    };

    const handleDeleteUser = async (username) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${username}" ?`)) {
            return;
        }

        const result = deleteUser(username);
        if (result.success) {
            setSuccess(`Utilisateur "${username}" supprimé`);
        } else {
            setError(result.error);
        }
    };

    const handleUpdatePermissions = (username, newPerms) => {
        const result = updateUser(username, newPerms);
        if (!result.success) {
            setError(result.error);
        }
    };

    const handleResetPassword = async () => {
        if (!newResetPassword || newResetPassword.length < 4) {
            setError('Le mot de passe doit contenir au moins 4 caractères');
            return;
        }

        const result = await resetPassword(resetPasswordUser, newResetPassword);
        if (result.success) {
            setSuccess(`Mot de passe de "${resetPasswordUser}" réinitialisé`);
            setResetPasswordUser(null);
            setNewResetPassword('');
        } else {
            setError(result.error);
        }
    };

    const handleExport = async () => {
        setError('');
        const result = await exportUsersToFile();
        if (result.success) {
            setSuccess('Liste des utilisateurs exportée');
        } else if (result.error !== 'Annulé') {
            setError(result.error);
        }
    };

    const handleImport = async () => {
        setError('');
        const result = await importUsersFromFile();
        if (result.success) {
            setSuccess(`${result.count} utilisateur(s) importé(s)`);
        } else if (result.error !== 'Annulé') {
            setError(result.error);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestion des utilisateurs">
            <div className="user-manager">
                {error && <div className="user-manager-error">{error}</div>}
                {success && <div className="user-manager-success">{success}</div>}

                {/* Liste des utilisateurs */}
                <div className="user-manager-section">
                    <h3>Utilisateurs</h3>
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Permissions</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.username}>
                                    <td>
                                        {user.username}
                                        {user.isAdmin && <span className="admin-badge">Admin</span>}
                                        {user.username === currentUser?.username && <span className="current-badge">Vous</span>}
                                    </td>
                                    <td>
                                        <select
                                            value={user.permissions}
                                            onChange={(e) => handleUpdatePermissions(user.username, e.target.value)}
                                            disabled={user.username === currentUser?.username}
                                        >
                                            <option value="lecture">{PERMISSIONS.lecture.label}</option>
                                            <option value="partiel">{PERMISSIONS.partiel.label}</option>
                                            <option value="total">{PERMISSIONS.total.label}</option>
                                        </select>
                                    </td>
                                    <td className="user-actions">
                                        <button
                                            className="user-action-btn"
                                            onClick={() => setResetPasswordUser(user.username)}
                                            title="Réinitialiser le mot de passe"
                                        >
                                            🔑
                                        </button>
                                        <button
                                            className="user-action-btn delete"
                                            onClick={() => handleDeleteUser(user.username)}
                                            disabled={user.username === currentUser?.username}
                                            title="Supprimer l'utilisateur"
                                        >
                                            🗑
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Réinitialisation mot de passe */}
                {resetPasswordUser && (
                    <div className="user-manager-section reset-password-section">
                        <h3>Réinitialiser le mot de passe de "{resetPasswordUser}"</h3>
                        <div className="reset-password-form">
                            <input
                                type="password"
                                value={newResetPassword}
                                onChange={(e) => setNewResetPassword(e.target.value)}
                                placeholder="Nouveau mot de passe"
                            />
                            <button onClick={handleResetPassword}>Réinitialiser</button>
                            <button className="cancel-btn" onClick={() => {
                                setResetPasswordUser(null);
                                setNewResetPassword('');
                            }}>Annuler</button>
                        </div>
                    </div>
                )}

                {/* Formulaire de création */}
                <div className="user-manager-section">
                    <h3>Créer un utilisateur</h3>
                    <form onSubmit={handleCreateUser} className="create-user-form">
                        <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            placeholder="Nom d'utilisateur"
                            required
                        />
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mot de passe"
                            required
                        />
                        <select
                            value={newPermissions}
                            onChange={(e) => setNewPermissions(e.target.value)}
                        >
                            <option value="lecture">{PERMISSIONS.lecture.label}</option>
                            <option value="partiel">{PERMISSIONS.partiel.label}</option>
                            <option value="total">{PERMISSIONS.total.label}</option>
                        </select>
                        <button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Création...' : 'Créer'}
                        </button>
                    </form>
                </div>

                {/* Import/Export */}
                <div className="user-manager-section">
                    <h3>Import / Export</h3>
                    <div className="import-export-buttons">
                        <button onClick={handleExport}>Exporter vers fichier JSON</button>
                        <button onClick={handleImport}>Importer depuis fichier JSON</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default UserManagerModal;
