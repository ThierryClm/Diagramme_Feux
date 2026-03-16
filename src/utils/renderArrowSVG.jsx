/**
 * Renders an SVG arrow for a given traffic movement type.
 *
 * @param {string} courant - Movement type ('TD', 'TàD', 'TàG', 'TDTàD', 'TDTàG', 'TD_G_D', 'Piéton', 'Cycle')
 * @param {string} color - SVG stroke color
 * @param {number} arrowLength - Length multiplier (default 1)
 * @param {number} turnLength - Turn length multiplier (default 1)
 * @returns {JSX.Element} SVG element
 */
const renderFloatingArrowSVG = (courant, color, arrowLength = 1, turnLength = 1) => {
    const strokeWidth = 3;
    const thinStrokeWidth = 2;
    const size = 32;

    switch (courant) {
        case 'TD':
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case 'TàD': {
            const tadEndX = 14 + (12 * turnLength);
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <path d={`M8,24 L8,12 Q8,8 12,8 L${tadEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={`${tadEndX - 6},2 ${tadEndX},8 ${tadEndX - 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        case 'TàG': {
            const tagEndX = 18 - (12 * turnLength);
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <path d={`M24,24 L24,12 Q24,8 20,8 L${tagEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={`${tagEndX + 6},2 ${tagEndX},8 ${tagEndX + 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        case 'TDTàD':
        case 'TD-TàD':
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <line x1="12" y1="28" x2="12" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <polyline points="6,14 12,8 18,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12,20 Q20,20 20,12 L20,8" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="16,12 20,8 24,12" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case 'TDTàG':
        case 'TD-TàG':
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <line x1="20" y1="28" x2="20" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <polyline points="14,14 20,8 26,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20,20 Q12,20 12,12 L12,8" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="8,12 12,8 16,12" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case 'TD_G_D':
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <line x1="16" y1="28" x2="16" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <polyline points="10,14 16,8 22,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16,20 Q8,20 8,12 L8,10" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="4,14 8,10 12,14" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16,20 Q24,20 24,12 L24,10" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="20,14 24,10 28,14" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case 'Piéton':
        case 'Cycle': {
            const extendedHeight = size + (arrowLength - 1) * 24;
            const viewBoxHeight = 32 + (arrowLength - 1) * 24;
            const topY = 6;
            const bottomY = 26 + (arrowLength - 1) * 24;
            const centerY = (topY + bottomY) / 2;
            return (
                <svg width={size} height={extendedHeight} viewBox={`0 0 32 ${viewBoxHeight}`}>
                    <line x1="16" y1={centerY} x2="16" y2={topY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                    <polyline points={`11,${topY + 5} 16,${topY} 21,${topY + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="16" y1={centerY} x2="16" y2={bottomY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                    <polyline points={`11,${bottomY - 5} 16,${bottomY} 21,${bottomY - 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        default:
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
    }
};

export default renderFloatingArrowSVG;
