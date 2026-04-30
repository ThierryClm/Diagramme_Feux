import { useState, useEffect } from 'react';
import usePopupWindow from './usePopupWindow';

/**
 * Gère l'état et la fenêtre popup du formulaire flottant.
 */
const useFloatingForm = (groupCount) => {
    const [showFloatingForm, setShowFloatingForm] = useState(() => {
        return localStorage.getItem('floating_form_visible') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('floating_form_visible', showFloatingForm.toString());
    }, [showFloatingForm]);

    const formPopup = usePopupWindow({
        isOpen: showFloatingForm,
        onClose: () => setShowFloatingForm(false),
        title: 'Formulaire',
        width: Math.min(640, 200 + groupCount * 35),
        height: Math.min(520, 110 + groupCount * 32)
    });

    return {
        showFloatingForm,
        setShowFloatingForm,
        formPopup
    };
};

export default useFloatingForm;
