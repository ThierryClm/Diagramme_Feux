/**
 * Source de vérité unique pour les calculs de capacité d'un groupe de feu.
 * Partagé entre le panneau Simulation et le tableau comparatif des plans de feu,
 * afin que les deux vues ne divergent jamais.
 *
 * - V.Utile : temps de vert « utile » = trafic / (1800 × coef_voie / cycle).
 * - Capacité utilisée (Cap.U) : (V.Utile / temps de vert) × 100, en %.
 * - Classe couleur : seuils métier (vert < 76, orange ≤ 85, rouge ≤ 100, noir > 100).
 */

/** Vert utile (secondes) ou null si données insuffisantes. */
export const calculateVUtile = (trafficVol, laneCoef, cycleLength) => {
    if (!trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
    return Math.round(trafficVol / (1800 * laneCoef / cycleLength));
};

/** Capacité utilisée : { value: number|null, display: string }. */
export const calculateCapacity = (greenTime, vUtile) => {
    if (!greenTime || !vUtile || greenTime === 0) return { value: null, display: '' };
    const result = Math.round((vUtile / greenTime) * 100);
    return { value: result, display: result + '%' };
};

/** Classe CSS de couleur selon le niveau de capacité utilisée. */
export const getCapacityColorClass = (value) => {
    if (value === null || value === undefined) return '';
    if (value < 76) return 'capacity-green';
    if (value <= 85) return 'capacity-orange';
    if (value <= 100) return 'capacity-red';
    return 'capacity-black';
};
