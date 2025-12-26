import React, { useState } from 'react';
import './IntergreenMatrix.css';

const IntergreenMatrix = ({ conflictMatrix, setMatrixValue }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Check if cell is 'asymmetric' (missing value where mirror has one)
    const isAsymmetric = (row, col) => {
        const val = conflictMatrix[row][col];
        const mirrorVal = conflictMatrix[col][row];
        // If mirror has value (>0) and current is 0 (or undefined/empty), it's potentially an error.
        if (row === col) return false;
        if (mirrorVal > 0 && (!val || val === 0)) return true;
        return false;
    };

    if (!isOpen) {
        return (
            <button className="btn-matrix-toggle" onClick={() => setIsOpen(true)}>
                Ouvrir Matrice de Temps Intervert
            </button>
        );
    }

    // 16x16 is big. Let's make it a scrollable grid.
    const size = conflictMatrix.length;
    const indices = Array.from({ length: size }, (_, i) => i + 1);

    return (
        <div className="matrix-modal-overlay">
            <div className="matrix-modal">
                <header>
                    <h3>Matrice de Temps Intervert (Sécurité)</h3>
                    <button className="btn-close" onClick={() => setIsOpen(false)}>Fermer</button>
                </header>
                <div className="matrix-scroll">
                    <table className="matrix-grid">
                        <thead>
                            <tr>
                                <th>/</th>
                                {indices.map(i => <th key={i}>G{i}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {conflictMatrix.map((row, fromIdx) => (
                                <tr key={fromIdx}>
                                    <td className="row-header">G{fromIdx + 1}</td>
                                    {row.map((val, toIdx) => (
                                        <td key={toIdx}>
                                            {fromIdx === toIdx ? (
                                                <span className="diagonal">-</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={val}
                                                    onChange={(e) => setMatrixValue(fromIdx + 1, toIdx + 1, e.target.value)}
                                                    min="0"
                                                />
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default IntergreenMatrix;
