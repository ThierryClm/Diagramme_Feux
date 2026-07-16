import React from 'react';

/**
 * Légende du diagramme (actions de micro-régulation). Markup statique extrait de
 * la fenêtre flottante « Légende du diagramme » pour être réutilisé aussi dans
 * le dossier d'impression. Les styles viennent des classes .legend-* existantes.
 */
const DiagramLegend = () => (
    <div className="legend-section">
        <div className="legend-section-title">Actions de micro-régulation</div>
        <div className="legend-item">
            <div className="legend-preview legend-adaptatif"></div>
            <span>Adaptatif vertical</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-controle-flot">
                <div className="legend-cf-intermittent"></div>
                <div className="legend-cf-orange"></div>
                <div className="legend-cf-red"></div>
            </div>
            <span>Contrôle de flot</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-bande-debut">
                <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                    <line x1="5" y1="2" x2="58" y2="16" stroke="#00cc00" strokeWidth="0.8" strokeDasharray="4,3" />
                    <path d="M58,16 L68,18 L62,10 Z" fill="#00cc00" />
                </svg>
            </div>
            <span>Début de bande passante</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-escamotage-group">
                <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                    <defs>
                        <pattern id="legend-escam-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(-45)">
                            <line x1="0" y1="0" x2="0" y2="4" stroke="#1565C0" strokeWidth="2" />
                        </pattern>
                    </defs>
                    <rect x="20" y="5" width="40" height="10" fill="url(#legend-escam-hatch)" stroke="#1565C0" strokeWidth="0.5" strokeDasharray="2,2" />
                    <line x1="5" y1="3" x2="20" y2="10" stroke="#1565C0" strokeWidth="0.8" strokeDasharray="3,2" />
                    <line x1="75" y1="3" x2="60" y2="10" stroke="#1565C0" strokeWidth="0.8" strokeDasharray="3,2" />
                </svg>
            </div>
            <span>Escamotage</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-escamotage"></div>
            <span>Escamotage de phase</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-fermeture">
                <span className="brace-point"></span>
            </div>
            <span>Fermeture anticipée</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-bande-fin">
                <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                    <line x1="5" y1="2" x2="58" y2="16" stroke="#00cc00" strokeWidth="0.8" strokeDasharray="4,3" />
                    <path d="M58,16 L68,18 L62,10 Z" fill="#00cc00" />
                </svg>
            </div>
            <span>Fin de bande passante</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-instant-co"></div>
            <span>Instant Co</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-ouverture"></div>
            <span>Ouverture anticipée</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-point-repos"></div>
            <span>Point de repos</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-priorite-pietons"></div>
            <span>Priorité piétons</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-lucarne"></div>
            <span>Seconde lucarne</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-signa">
                <div className="legend-signa-orange"></div>
                <div className="legend-signa-blue"></div>
            </div>
            <span>Signal aide conduite</span>
        </div>
        <div className="legend-item">
            <div className="legend-preview legend-synchro-bts"></div>
            <span>Synchro BTS</span>
        </div>
    </div>
);

export default DiagramLegend;
