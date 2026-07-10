import React, { useMemo } from 'react';
import {
    calculateOfferedCapacity,
    calculateDegreeOfSaturation,
    calculateReserveCapacity,
    calculateAverageDelay,
    calculateAverageQueueLength,
    getCapacityColorClass
} from '../utils/capacityCalc';
import { getTotalGreenTime, parseTrafficVol, isCoordinated } from '../utils/trafficHelpers';
import './DiagnosticPanel.css';

/**
 * Panneau « Diagnostic » : indicateurs de dimensionnement par courant
 * (méthode du Guide des carrefours à feux) + synthèse carrefour. Détachable.
 *
 * Toutes les valeurs proviennent du module partagé capacityCalc et du même
 * « vert total » que le tableau Données Trafic (trafficHelpers) : aucune
 * divergence possible avec les colonnes déjà affichées.
 */
const DiagnosticPanel = ({
    groups = [],
    cycleLength,
    getTrafficData,
    actionData = [],
    activeTrafficDataset,
    onDetach = null,
    detached = false,
    tip = (t) => t
}) => {
    const rows = useMemo(() => {
        return groups
            .filter(g => g.type === 'VL' || g.type === 'V')
            .map(g => {
                const green = getTotalGreenTime(g.id, g.durations?.green, actionData, cycleLength);
                const raw = getTrafficData ? getTrafficData(g.id).trafficVol : 0;
                const trafic = parseTrafficVol(raw);
                const coord = isCoordinated(raw);
                const coef = g.laneCoef;
                const capacity = calculateOfferedCapacity(coef, green, cycleLength);
                const x = calculateDegreeOfSaturation(trafic, coef, green, cycleLength);
                const reserve = calculateReserveCapacity(trafic, coef, green, cycleLength);
                const delay = coord && trafic ? 0 : calculateAverageDelay(trafic, coef, green, cycleLength);
                const queue = coord && trafic ? 0 : calculateAverageQueueLength(trafic, coef, green, cycleLength);
                const capU = x === null ? null : Math.round(x * 100);
                return { g, trafic, coord, capacity, x, reserve, delay, queue, capU };
            })
            .filter(r => r.trafic); // uniquement les courants avec trafic renseigné
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups, cycleLength, getTrafficData, actionData, activeTrafficDataset]);

    const dim = useMemo(() => {
        let best = null;
        rows.forEach(r => { if (r.capU !== null && (!best || r.capU > best.capU)) best = r; });
        return best;
    }, [rows]);

    const fmt = (v, suffix = '') => (v === null || v === undefined) ? '—' : `${v}${suffix}`;

    return (
        <div className={`diagnostic-panel${detached ? ' diagnostic-panel-detached' : ''}`}>
            <h3 className="diagnostic-title">
                Réserve de capacité
                {onDetach && !detached && (
                    <button
                        className="detach-btn"
                        onClick={onDetach}
                        title={tip("Détacher dans une fenêtre séparée (2e écran)")}
                    >
                        Détacher
                    </button>
                )}
            </h3>

            {rows.length === 0 ? (
                <p className="diagnostic-empty">
                    Renseignez les volumes de trafic (jeu « {activeTrafficDataset} ») pour obtenir le diagnostic.
                </p>
            ) : (
                <>
                    <table className="diagnostic-table">
                        <thead>
                            <tr>
                                <th title={tip("Groupe de feux")}>GF</th>
                                <th title={tip("Capacité offerte : 1800 × coef × vert/cycle")}>Cap.<br/>uvp/h</th>
                                <th title={tip("Degré de saturation = trafic / capacité offerte")}>Degré<br/>sat.</th>
                                <th title={tip("Réserve de capacité = capacité − trafic")}>Réserve<br/>uvp/h</th>
                                <th title={tip("Attente moyenne par véhicule, surcharge aléatoire comprise (Webster, 2 termes).")}>Attente</th>
                                <th title={tip("File d'attente moyenne, déduite de l'attente (loi de Little).")}>File</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.g.id}>
                                    <td className="dg-id">GF{r.g.id}</td>
                                    <td>{fmt(r.capacity)}</td>
                                    <td className={getCapacityColorClass(r.capU)}>
                                        {r.x === null ? '—' : r.x.toFixed(2)}
                                    </td>
                                    <td className={r.reserve && r.reserve.veh < 0 ? 'capacity-black' : ''}>
                                        {r.reserve ? fmt(r.reserve.veh) : '—'}
                                    </td>
                                    <td>{r.delay === null ? 'saturé' : fmt(Math.round(r.delay), ' s')}</td>
                                    <td>{r.queue === null ? 'saturé' : fmt(r.queue, ' m')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {dim && (
                        <div className="diagnostic-carrefour">
                            <span className="dg-label">Carrefour :</span>{' '}
                            courant dimensionnant <strong>GF{dim.g.id}</strong> —{' '}
                            degré de saturation{' '}
                            <strong className={getCapacityColorClass(dim.capU)}>{dim.x.toFixed(2)}</strong>{' '}
                            {(100 - dim.capU) >= 0
                                ? <>· réserve <strong>{100 - dim.capU}%</strong></>
                                : <>· <strong className="capacity-black">dépassement {dim.capU - 100}%</strong></>}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DiagnosticPanel;
