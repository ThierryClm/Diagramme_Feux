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
        width: Math.min(700, 200 + groupCount * 40),
        height: Math.min(600, 120 + groupCount * 35)
    });

    return {
        showFloatingForm,
        setShowFloatingForm,
        formPopup
    };
};

export default useFloatingForm;
