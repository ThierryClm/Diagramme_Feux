import { useState, useEffect } from 'react';
import './LoginModal.css';

const LoginModal = ({ onLogin, onCreateUser, hasUsers, isLoading }) => {
    const [mode, setMode] = useState(hasUsers ? 'login' : 'register');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mettre à jour le mode si hasUsers change après le chargement
    useEffect(() => {
        if (hasUsers && mode === 'register') {
            setMode('login');
        } else if (!hasUsers && mode === 'login') {
            setMode('register');
        }
    }, [hasUsers]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            if (mode === 'login') {
                const result = await onLogin(username, password);
                if (!result.success) {
                    setError(result.error);
                }
            } else {
                // Mode création de compte
                if (password !== confirmPassword) {
                    setError('Les mots de passe ne correspondent pas');
                    setIsSubmitting(false);
                    return;
                }

                if (password.length < 4) {
                    setError('Le mot de passe doit contenir au moins 4 caractères');
                    setIsSubmitting(false);
                    return;
                }

                const result = await onCreateUser(username, password);
                if (!result.success) {
                    setError(result.error);
                }
            }
        } catch (err) {
            setError('Une erreur est survenue');
        }

        setIsSubmitting(false);
    };

    if (isLoading) {
        return (
            <div className="login-overlay">
                <div className="login-modal">
                    <div className="login-loading">Chargement...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-overlay">
            <div className="login-modal">
                <div className="login-header">
                    <h2>TraCflux</h2>
                    <p className="login-subtitle">
                        {mode === 'login' ? 'Connexion' : 'Création du compte administrateur'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-field">
                        <label htmlFor="username">Nom d'utilisateur</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Entrez votre nom d'utilisateur"
                            autoComplete="username"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="password">Mot de passe</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Entrez votre mot de passe"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            required
                        />
                    </div>

                    {mode === 'register' && (
                        <div className="login-field">
                            <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirmez votre mot de passe"
                                autoComplete="new-password"
                                required
                            />
                        </div>
                    )}

                    {error && <div className="login-error">{error}</div>}

                    <button
                        type="submit"
                        className="login-button"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Veuillez patienter...' : (mode === 'login' ? 'Se connecter' : 'Créer le compte')}
                    </button>
                </form>

                {mode === 'register' && (
                    <p className="login-info">
                        Ce compte sera l'administrateur principal de l'application.
                    </p>
                )}
            </div>
        </div>
    );
};

export default LoginModal;
