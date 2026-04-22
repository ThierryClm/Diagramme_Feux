import React, { useState, useEffect, useRef } from 'react';
import './NumericInput.css';

/**
 * Numeric input with:
 *  - local state (commits only on blur / Enter)
 *  - at-the-fly filtering of non-digit characters
 *  - optional min / max bounds validation (visual feedback only, non-blocking)
 *  - red border + tooltip if out of bounds
 *
 * Props:
 *  - value: current committed value (number or string)
 *  - onCommit: (stringValue) => void — called on blur/Enter if value changed
 *  - min, max: optional bounds (numbers). If out of bounds, a red border shows.
 *  - allowEmpty: if true, empty value is accepted (and treated as valid)
 *  - className, style, title, placeholder, selectOnFocus, disabled, readOnly, maxLength, onClick
 */
const NumericInput = ({
    value,
    onCommit,
    min,
    max,
    wrapAt,
    showWrapFlash = false,
    allowEmpty = true,
    className = '',
    style,
    title,
    placeholder = '',
    selectOnFocus = false,
    disabled = false,
    readOnly = false,
    maxLength,
    onClick
}) => {
    const [localValue, setLocalValue] = useState(value === undefined || value === null ? '' : String(value));
    const [isEditing, setIsEditing] = useState(false);
    const [rejected, setRejected] = useState(false);
    const [wrapped, setWrapped] = useState(false);
    const rejectTimerRef = useRef(null);
    const wrapTimerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value === undefined || value === null ? '' : String(value));
        }
    }, [value, isEditing]);

    const handleChange = (e) => {
        if (readOnly) return;
        // Filter: keep only digits
        const raw = e.target.value;
        const filtered = raw.replace(/[^0-9]/g, '');
        // If something was filtered out, flash a visual rejection feedback
        if (raw !== filtered) {
            setRejected(true);
            if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
            rejectTimerRef.current = setTimeout(() => setRejected(false), 350);
        }
        // If the field had a value and the user's keystroke would wipe it (only non-digits typed),
        // keep the previous value intact — don't show an empty state.
        if (filtered === '' && raw !== '' && localValue !== '') {
            return;
        }
        setLocalValue(filtered);
    };

    const handleFocus = (e) => {
        setIsEditing(true);
        if (selectOnFocus) e.target.select();
    };

    const commit = () => {
        setIsEditing(false);
        const originalStr = value === undefined || value === null ? '' : String(value);
        // If the user has emptied the field and empty is not allowed, restore the previous value
        if (localValue.trim() === '' && !allowEmpty) {
            setLocalValue(originalStr);
            return;
        }
        // Flash wrap feedback if committed value exceeds wrapAt
        if (showWrapFlash && wrapAt !== undefined && localValue.trim() !== '') {
            const n = parseInt(localValue);
            if (!isNaN(n) && n >= wrapAt) {
                setWrapped(true);
                if (wrapTimerRef.current) clearTimeout(wrapTimerRef.current);
                wrapTimerRef.current = setTimeout(() => setWrapped(false), 600);
            }
        }
        if (localValue !== originalStr) {
            onCommit(localValue);
        }
    };

    const handleBlur = () => commit();
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            commit();
            inputRef.current?.blur();
        }
    };

    // Compute validation state
    const trimmed = localValue.trim();
    const isEmpty = trimmed === '';
    const numValue = isEmpty ? null : parseInt(trimmed);
    let errorMsg = null;
    if (!isEmpty && !isNaN(numValue)) {
        if (min !== undefined && numValue < min) errorMsg = `Valeur minimum : ${min}`;
        else if (max !== undefined && numValue > max) errorMsg = `Valeur maximum : ${max}`;
    } else if (isEmpty && !allowEmpty) {
        errorMsg = 'Valeur requise';
    }

    const cls = `${className} ${errorMsg ? 'numeric-input-error' : ''} ${rejected ? 'numeric-input-rejected' : ''} ${wrapped ? 'numeric-input-wrapped' : ''}`.trim();

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className={cls}
            style={style}
            value={localValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={onClick}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            maxLength={maxLength}
            title={errorMsg || title}
        />
    );
};

export default NumericInput;
