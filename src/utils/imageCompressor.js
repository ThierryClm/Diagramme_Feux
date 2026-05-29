/**
 * Compression des images de fond de carrefour à l'import.
 *
 * Objectif : réduire le poids des projets (l'image est stockée en base64 dans
 * le JSON). On redimensionne à une définition raisonnable et on ré-encode en
 * WebP (supporté Chrome/Edge, bon pour photo ET trait). L'image source sur le
 * disque de l'utilisateur n'est pas modifiée : seule la copie embarquée l'est.
 *
 * Les seuils sont volontairement des constantes (paramétrage UI envisageable
 * plus tard).
 */

const MAX_DIMENSION = 600;          // px : plafond largeur/hauteur (préserve le ratio).
                                   // 600 px suffit pour un fond de plan sans perte de lecture.
const WEBP_QUALITY = 0.9;          // qualité élevée pour préserver la lisibilité (projection)
const SKIP_BELOW_BYTES = 200 * 1024;   // en dessous, on ne touche pas (inutile de dégrader)
export const ALERT_ABOVE_BYTES = 200 * 1024; // au-delà (après compression), on alerte

/** Estime la taille en octets d'un data URL base64. */
export function dataUrlBytes(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return Math.floor((b64.length * 3) / 4);
}

/** Formate un nombre d'octets en Ko ou Mo lisible. */
export function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    return `${Math.round(bytes / 1024)} Ko`;
}

/**
 * Redimensionne + ré-encode un data URL d'image.
 * Renvoie { dataUrl, compressed } — compressed=false si on a gardé l'original
 * (SVG vectoriel, image déjà petite, ou compression non bénéfique).
 */
export async function compressImageDataUrl(dataUrl) {
    // SVG : vectoriel, ne pas rasteriser (on perdrait la netteté ET le faible poids)
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/svg')) {
        return { dataUrl, compressed: false };
    }
    // Déjà léger : ne pas dégrader inutilement
    if (dataUrlBytes(dataUrl) < SKIP_BELOW_BYTES) {
        return { dataUrl, compressed: false };
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const maxSide = Math.max(img.width, img.height);
                // Déjà optimisée (WebP et pas sur-dimensionnée) : ne pas ré-encoder.
                // Évite la perte de génération si le projet est rouvert plusieurs fois.
                if (dataUrl.startsWith('data:image/webp') && maxSide <= MAX_DIMENSION) {
                    resolve({ dataUrl, compressed: false });
                    return;
                }
                const scale = Math.min(1, MAX_DIMENSION / maxSide);
                const width = Math.round(img.width * scale);
                const height = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                let out = canvas.toDataURL('image/webp', WEBP_QUALITY);
                // Si WebP non supporté, toDataURL retombe sur du PNG : on force JPEG
                if (!out.startsWith('data:image/webp')) {
                    out = canvas.toDataURL('image/jpeg', WEBP_QUALITY);
                }

                // Si la "compression" n'a rien gagné (rare), garder l'original
                if (dataUrlBytes(out) >= dataUrlBytes(dataUrl)) {
                    resolve({ dataUrl, compressed: false });
                } else {
                    resolve({ dataUrl: out, compressed: true });
                }
            } catch (e) {
                resolve({ dataUrl, compressed: false });
            }
        };
        img.onerror = () => resolve({ dataUrl, compressed: false });
        img.src = dataUrl;
    });
}
