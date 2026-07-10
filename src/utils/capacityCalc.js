/**
 * Source de vérité unique pour les calculs de capacité d'un groupe de feu.
 * Partagé entre le panneau Simulation, le tableau comparatif des plans de feu
 * et le panneau Diagnostic, afin que les vues ne divergent jamais.
 *
 * - V.Utile : temps de vert « utile » = trafic / (1800 × coef_voie / cycle).
 * - Capacité utilisée (Cap.U) : (V.Utile / temps de vert) × 100, en %.
 * - Classe couleur : seuils métier (vert < 76, orange ≤ 85, rouge ≤ 100, noir > 100).
 *
 * Indicateurs de diagnostic (méthode du Guide des carrefours à feux) :
 * - Capacité offerte C = débit_sat × coef × vert/cycle (uvp/h).
 * - Degré de saturation x = trafic / C (sans unité ; x·100 ≈ Cap.U).
 * - Réserve de capacité = C − trafic (uvp/h) et 1 − x (part libre).
 */

/**
 * Débit de saturation de référence, en uvp/h et par unité de coefficient de
 * voie. Valeur unique retenue (cf. décision projet), cohérente avec le calcul
 * historique de V.Utile.
 */
export const SATURATION_FLOW = 1800;

/** Vert utile (secondes) ou null si données insuffisantes. */
export const calculateVUtile = (trafficVol, laneCoef, cycleLength) => {
    if (!trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
    return Math.round(trafficVol / (SATURATION_FLOW * laneCoef / cycleLength));
};

/**
 * Capacité offerte C (uvp/h) : nombre de véhicules que le courant peut écouler
 * avec le vert dont il dispose. C = débit_sat × coef × (vert / cycle).
 * Renvoie null si données insuffisantes.
 */
export const calculateOfferedCapacity = (laneCoef, greenTime, cycleLength) => {
    if (!laneCoef || !greenTime || !cycleLength || cycleLength === 0) return null;
    return Math.round(SATURATION_FLOW * laneCoef * (greenTime / cycleLength));
};

/**
 * Degré de saturation x = trafic / capacité offerte (sans unité). C'est la même
 * grandeur que Cap.U mais en ratio (x·100 ≈ Cap.U). x > 1 = courant saturé.
 * Renvoie null si données insuffisantes.
 */
export const calculateDegreeOfSaturation = (trafficVol, laneCoef, greenTime, cycleLength) => {
    const capacity = calculateOfferedCapacity(laneCoef, greenTime, cycleLength);
    if (!capacity || !trafficVol) return null;
    return trafficVol / capacity;
};

/**
 * Réserve de capacité d'un courant :
 * { veh: uvp/h restants (C − trafic), ratio: part libre (1 − x) }.
 * ratio < 0 et veh < 0 signalent un courant en dépassement de capacité.
 * Renvoie null si données insuffisantes.
 */
export const calculateReserveCapacity = (trafficVol, laneCoef, greenTime, cycleLength) => {
    const capacity = calculateOfferedCapacity(laneCoef, greenTime, cycleLength);
    if (capacity === null || trafficVol === undefined || trafficVol === null) return null;
    return {
        veh: Math.round(capacity - trafficVol),
        ratio: capacity === 0 ? null : 1 - (trafficVol / capacity)
    };
};

/** Capacité utilisée : { value: number|null, display: string }. */
export const calculateCapacity = (greenTime, vUtile) => {
    if (!greenTime || !vUtile || greenTime === 0) return { value: null, display: '' };
    const result = Math.round((vUtile / greenTime) * 100);
    return { value: result, display: result + '%' };
};

/**
 * Attente uniforme de Webster (terme 1), en secondes :
 *   d1 = c(1−λ)² / [2(1−λx)],  λ = vert/cycle,  λx = trafic/(1800·coef).
 * C'est la formule historique de la colonne « Retard ». Renvoie null si le
 * courant est saturé (λx ≥ 1) ou si les données sont insuffisantes.
 */
export const calculateUniformDelay = (trafficVol, laneCoef, greenTime, cycleLength) => {
    if (!trafficVol || !laneCoef || !greenTime || !cycleLength || laneCoef === 0) return null;
    const ratio = trafficVol / (SATURATION_FLOW * laneCoef); // = λx
    if (ratio >= 1) return null;
    const redTime = cycleLength - greenTime;
    return (redTime * redTime) / (2 * cycleLength * (1 - ratio));
};

/**
 * Attente aléatoire de Webster (terme 2), en secondes :
 *   d2 = x² / [2q(1−x)],  q = trafic/3600 (véh/s),  x = degré de saturation.
 * Renvoie null si x ≥ 1 (sur-saturation) ou données insuffisantes.
 */
export const calculateRandomDelay = (trafficVol, laneCoef, greenTime, cycleLength) => {
    const x = calculateDegreeOfSaturation(trafficVol, laneCoef, greenTime, cycleLength);
    if (x === null || x >= 1) return null;
    const q = trafficVol / 3600; // véh/s
    return (x * x) / (2 * q * (1 - x));
};

/**
 * Temps d'attente moyen (Webster simplifié à 2 termes), en secondes : d1 + d2.
 * Renvoie null si l'un des termes est indéterminé (sur-saturation).
 */
export const calculateAverageDelay = (trafficVol, laneCoef, greenTime, cycleLength) => {
    const d1 = calculateUniformDelay(trafficVol, laneCoef, greenTime, cycleLength);
    const d2 = calculateRandomDelay(trafficVol, laneCoef, greenTime, cycleLength);
    if (d1 === null || d2 === null) return null;
    return d1 + d2;
};

/**
 * Longueur de file d'attente maximale hors saturation, en mètres :
 *   (⌊trafic·(cycle−vert)/3600/coef⌋ + 1) × 6.
 * Formule historique de la colonne « File d'attente ». null si insuffisant.
 */
export const calculateQueueLength = (trafficVol, laneCoef, greenTime, cycleLength) => {
    if (!trafficVol || !laneCoef || !greenTime || !cycleLength || laneCoef === 0) return null;
    const redTime = cycleLength - greenTime;
    return (Math.floor(trafficVol * redTime / 3600 / laneCoef) + 1) * 6;
};

/** Classe CSS de couleur selon le niveau de capacité utilisée. */
export const getCapacityColorClass = (value) => {
    if (value === null || value === undefined) return '';
    if (value < 76) return 'capacity-green';
    if (value <= 85) return 'capacity-orange';
    if (value <= 100) return 'capacity-red';
    return 'capacity-black';
};
