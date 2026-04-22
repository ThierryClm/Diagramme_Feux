import React, { useState, useRef } from 'react';
import './CustomTooltip.css';

/**
 * Wrapper component that shows a custom tooltip (instead of the native `title`)
 * with theme-aware styling and a small delay before appearing.
 *
 * Usage:
 *   <CustomTooltip text="My tooltip">
 *     <button>Click me</button>
 *   </CustomTooltip>
 *
 *   <CustomTooltip text={`Line 1\nLine 2`}>...</CustomTooltip>
 *
 * Props:
 *   - text: string | null — tooltip content (supports \n for new lines)
 *   - delay: number (ms) — how long to wait before showing (default: 400ms)
 *   - children: single React element — the element to attach the tooltip to
 */
const CustomTooltip = ({ text, delay = 400, children }) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const timerRef = useRef(null);

    if (!text) {
        // No tooltip text: render children directly
        return children;
    }

    const handleMouseEnter = (e) => {
        const x = e.clientX;
        const y = e.clientY;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setPos({ x, y });
            setVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setVisible(false);
    };

    const handleMouseMove = (e) => {
        if (visible) setPos({ x: e.clientX, y: e.clientY });
    };

    // Clone the child to attach the mouse handlers
    const child = React.Children.only(children);
    const wrappedChild = React.cloneElement(child, {
        onMouseEnter: (e) => {
            handleMouseEnter(e);
            if (child.props.onMouseEnter) child.props.onMouseEnter(e);
        },
        onMouseLeave: (e) => {
            handleMouseLeave();
            if (child.props.onMouseLeave) child.props.onMouseLeave(e);
        },
        onMouseMove: (e) => {
            handleMouseMove(e);
            if (child.props.onMouseMove) child.props.onMouseMove(e);
        }
    });

    return (
        <>
            {wrappedChild}
            {visible && (
                <div
                    className="custom-tooltip"
                    style={{
                        position: 'fixed',
                        left: pos.x + 12,
                        top: pos.y + 16,
                        pointerEvents: 'none',
                        zIndex: 9999
                    }}
                >
                    {text.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            )}
        </>
    );
};

export default CustomTooltip;
