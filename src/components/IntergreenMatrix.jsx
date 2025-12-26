import React, { useState } from 'react';
import './IntergreenMatrix.css';

const IntergreenMatrix = ({ conflictMatrix, setMatrixValue, groups }) => {

    // Check if cell is 'asymmetric' (missing value where mirror has one)
    const isAsymmetric = (row, col) => {
        const val = conflictMatrix[row][col];
        const mirrorVal = conflictMatrix[col][row];
        // If mirror has value (>0) and current is 0 (or undefined/empty), it's potentially an error.
        if (row === col) return false;
        if (mirrorVal > 0 && (!val || val === 0)) return true;
        return false;
    };

    // 16x16 is big. Let's make it a scrollable grid.
    const size = conflictMatrix.length;
    const indices = Array.from({ length: size }, (_, i) => i + 1);

    return (
        <div className="matrix-container-inline">
            <h3>Matrice de Temps Intervert (Sécurité)</h3>

            <div className="matrix-scroll">
                <table className="matrix-grid">
                    <thead>
                        <tr>
                            <th>/</th>
                            <th className="col-name-header">Nom</th>
                            {indices.map(i => <th key={i}>G{i}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {conflictMatrix.map((row, fromIdx) => (
                            <tr key={fromIdx}>
                                <td className="row-header">G{fromIdx + 1}</td>
                                <td className="row-name">
                                    {groups && groups[fromIdx] ? groups[fromIdx].name : '-'}
                                </td>
                                {row.map((val, toIdx) => (
                                    <td key={toIdx}>
                                        {fromIdx === toIdx ? (
                                            <span className="diagonal">-</span>
                                        ) : (
                                            <input
                                                type="number"
                                                className={isAsymmetric(fromIdx, toIdx) ? 'matrix-error-input' : ''}
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
    );
};

export default IntergreenMatrix;
