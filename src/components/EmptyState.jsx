import React from 'react';
import './EmptyState.css';

/**
 * Didactic empty-state overlay with a pictogram and a guiding message.
 *
 * Props:
 *   - icon: 'diagram' | 'matrix' | 'traffic' (chooses the pictogram)
 *   - title: main message (bold)
 *   - hint: secondary guiding message (optional)
 */
const ICONS = {
    diagram: (
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="12" x2="60" y2="12" strokeDasharray="2 3" opacity="0.4" />
            <rect x="8" y="20" width="18" height="8" rx="1" />
            <rect x="30" y="32" width="14" height="8" rx="1" />
            <rect x="48" y="44" width="12" height="8" rx="1" />
            <line x1="4" y1="58" x2="60" y2="58" strokeDasharray="2 3" opacity="0.4" />
        </svg>
    ),
    matrix: (
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="8" width="48" height="48" rx="2" />
            <line x1="8" y1="24" x2="56" y2="24" />
            <line x1="8" y1="40" x2="56" y2="40" />
            <line x1="24" y1="8" x2="24" y2="56" />
            <line x1="40" y1="8" x2="40" y2="56" />
        </svg>
    ),
    traffic: (
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="54" x2="56" y2="54" />
            <rect x="12" y="38" width="8" height="16" rx="1" />
            <rect x="26" y="28" width="8" height="26" rx="1" />
            <rect x="40" y="18" width="8" height="36" rx="1" />
        </svg>
    )
};

const EmptyState = ({ icon, title, hint }) => {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">{ICONS[icon] || null}</div>
            <div className="empty-state-title">{title}</div>
            {hint && <div className="empty-state-hint">{hint}</div>}
        </div>
    );
};

export default EmptyState;
