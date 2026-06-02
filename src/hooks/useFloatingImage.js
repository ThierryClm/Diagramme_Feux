import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état de l'image du carrefour flottante :
 * visibilité, recadrage, zoom, dimensions naturelles et popup détachée.
 *
 * @param {string|null} intersectionImage - Data URL de l'image courante
 * @param {string} [intersectionName] - Nom du carrefour, repris dans le titre du popup
 * @param {string} [activePFName] - Nom du PF actif, repris dans le titre du popup
 */
const useFloatingImage = (intersectionImage, intersectionName = '', activePFName = '') => {
    const [showFloatingImage, setShowFloatingImage] = useState(() => {
        const saved = localStorage.getItem('floating_image_visible');
        return saved === 'true';
    });

    const [floatingCrop, setFloatingCrop] = useState(() => {
        try {
            const saved = localStorage.getItem('floating_image_crop');
            return saved ? JSON.parse(saved) : { top: 0, bottom: 0, left: 0, right: 0 };
        } catch {
            return { top: 0, bottom: 0, left: 0, right: 0 };
        }
    });

    const [showCropControls, setShowCropControls] = useState(false);

    const [floatingZoom, setFloatingZoom] = useState(() => {
        try {
            const saved = localStorage.getItem('floating_image_zoom');
            return saved ? parseFloat(saved) : 1;
        } catch {
            return 1;
        }
    });

    const [imageNaturalDims, setImageNaturalDims] = useState({ width: 1, height: 1 });

    // Compute natural dimensions of intersection image (for print scaling)
    useEffect(() => {
        if (intersectionImage) {
            const img = new Image();
            img.onload = () => setImageNaturalDims({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
            img.src = intersectionImage;
        }
    }, [intersectionImage]);

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem('floating_image_visible', showFloatingImage.toString());
    }, [showFloatingImage]);

    useEffect(() => {
        localStorage.setItem('floating_image_crop', JSON.stringify(floatingCrop));
    }, [floatingCrop]);

    useEffect(() => {
        localStorage.setItem('floating_image_zoom', floatingZoom.toString());
    }, [floatingZoom]);

    // Titre dynamique : « <Carrefour> — <PF> » selon ce qui est disponible.
    const trimmedName = (intersectionName || '').trim();
    const trimmedPF = (activePFName || '').trim();
    const popupTitle = trimmedName && trimmedPF
        ? `${trimmedName} — ${trimmedPF}`
        : (trimmedName || 'Carrefour');

    // Popup window for floating image
    const floatingImagePopup = usePopupWindow({
        isOpen: showFloatingImage && !!intersectionImage,
        onClose: () => setShowFloatingImage(false),
        title: popupTitle,
        width: Math.round((750 - floatingCrop.left - floatingCrop.right) * floatingZoom) + 40,
        height: Math.round((530 - floatingCrop.top - floatingCrop.bottom) * floatingZoom) + 120
    });

    return {
        showFloatingImage, setShowFloatingImage,
        floatingCrop, setFloatingCrop,
        showCropControls, setShowCropControls,
        floatingZoom, setFloatingZoom,
        imageNaturalDims,
        floatingImagePopup
    };
};

export default useFloatingImage;
