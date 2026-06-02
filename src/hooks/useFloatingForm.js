import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup du formulaire flottant.
 */
const useFloatingForm = (groupCount, activePFName = '') => {
    const [showFloatingForm, setShowFloatingForm] = useState(() => {
        return localStorage.getItem('floating_form_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_form_visible', showFloatingForm.toString());
    }, [showFloatingForm]);

    const pf = (activePFName || '').trim();
    const popupTitle = pf ? `Formulaire — ${pf}` : 'Formulaire';

    const formPopup = usePopupWindow({
        isOpen: showFloatingForm,
        onClose: () => setShowFloatingForm(false),
        title: popupTitle,
        width: 470,
        height: Math.min(520, 110 + groupCount * 32)
    });

    return {
        showFloatingForm,
        setShowFloatingForm,
        formPopup
    };
};

export default useFloatingForm;
