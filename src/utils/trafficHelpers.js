/**
 * Aides trafic partagées entre le tableau Données Trafic et le panneau
 * Diagnostic, pour qu'ils calculent toujours à partir des mêmes bases
 * (aucune divergence de « vert total » ou de lecture du trafic).
 */

/**
 * Vert total d'un groupe = vert principal + durées des « Secondes lucarnes »
 * (actions de micro-régulation) du groupe. Gère le passage minuit (fin < deb).
 */
export const getTotalGreenTime = (groupId, mainGreenTime, actionData = [], cycleLength = 0) => {
    if (!mainGreenTime) return 0;
    const lucarneActions = actionData.filter(
        action => action.action === 'Seconde lucarne' &&
            parseInt(action.gf) === groupId &&
            action.deb !== '' && action.deb !== null &&
            action.fin !== '' && action.fin !== null
    );
    let lucarneDuration = 0;
    lucarneActions.forEach(lucarne => {
        const deb = parseFloat(lucarne.deb);
        const fin = parseFloat(lucarne.fin);
        if (!isNaN(deb) && !isNaN(fin)) {
            let duration = fin - deb;
            if (duration < 0) duration += cycleLength;
            lucarneDuration += duration;
        }
    });
    return mainGreenTime + lucarneDuration;
};

/** Valeur numérique du trafic (ignore le suffixe « c » de coordination). */
export const parseTrafficVol = (val) => {
    if (!val) return 0;
    const str = String(val).replace(/c$/i, '');
    return parseInt(str) || 0;
};

/** Vrai si le trafic est marqué coordonné (suffixe « c »). */
export const isCoordinated = (val) => String(val || '').endsWith('c');
