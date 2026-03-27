import React, { useState, useEffect, useRef } from 'react';

/**
 * Input with local state during editing.
 * Commits value to parent only on blur or Enter.
 * This prevents undo from capturing every keystroke.
 */
const LocalInput = ({ value, onCommit, type = 'text', className, style, readOnly, onClick, placeholder, maxLength, title, selectOnFocus = false }) => {
    const [localValue, setLocalValue] = useState(value === undefined || value === null ? '' : String(value));
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    // Sync local value with prop when not editing
    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value === undefined || value === null ? '' : String(value));
        }
    }, [value, isEditing]);

    const handleChange = (e) => {
        if (readOnly) return;
        setLocalValue(e.target.value);
    };

    const handleFocus = (e) => {
        setIsEditing(true);
        if (selectOnFocus) {
            e.target.select();
        }
    };

    const commit = () => {
        setIsEditing(false);
        if (localValue !== (value === undefined || value === null ? '' : String(value))) {
            onCommit(localValue);
        }
    };

    const handleBlur = () => {
        commit();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            commit();
            inputRef.current?.blur();
        }
    };

    return (
        <input
            ref={inputRef}
            type={type}
            className={className}
            style={style}
            value={localValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={onClick}
            readOnly={readOnly}
            placeholder={placeholder}
            maxLength={maxLength}
            title={title}
        />
    );
};

export default LocalInput;
