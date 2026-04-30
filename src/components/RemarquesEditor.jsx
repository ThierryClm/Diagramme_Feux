import React, { useRef } from 'react';
import CustomTooltip from './CustomTooltip';

/**
 * Champ Remarques du plan de feu actif, extrait de TimelineDiagram pour
 * pouvoir être rendu à la fois en colonne du diagramme et dans une fenêtre
 * détachée. La logique d'édition (colorisation, tailles, sauvegarde sur blur)
 * est identique dans les deux contextes.
 *
 * - groupCount : nombre de groupes (pour calculer la limite de caractères en
 *   mode colonne du diagramme, où la hauteur dépend du nombre de groupes).
 * - popupMode : si true, le champ remplit son conteneur (popup détachée) et
 *   la limite de caractères est virtuellement levée — le popup est
 *   redimensionnable, plus de contrainte d'alignement avec le diagramme.
 */
const RemarquesEditor = ({ remarques, updateRemarques, groupCount, popupMode = false }) => {
    const remarquesSelectionRef = useRef(null);

    const linesAvailable = popupMode ? 9999 : Math.max(1, Math.floor((groupCount * 30 - 16) / 17));
    const charsPerLine = 35;
    const calculatedMaxLength = popupMode ? Number.MAX_SAFE_INTEGER : linesAvailable * charsPerLine;
    const tooltipText = popupMode
        ? 'Remarques générales — Sélectionnez du texte puis + pour vert, − pour rouge'
        : `Remarques générales (${charsPerLine} car. x ${linesAvailable} lignes max) - Sélectionnez du texte puis + pour vert, - pour rouge`;

    return (
        <div className={`timeline-remarques no-print${popupMode ? ' remarques-popup-mode' : ''}`}>
            <div className="remarques-header">
                <span>Remarques</span>
                <CustomTooltip text="Couleur verte (+)"><span className="comment-color-btn comment-color-plus" role="button" aria-label="Colorer le texte sélectionné en vert">+</span></CustomTooltip>
                <CustomTooltip text="Couleur rouge (-)"><span className="comment-color-btn comment-color-minus" role="button" aria-label="Colorer le texte sélectionné en rouge">−</span></CustomTooltip>
                <CustomTooltip text="Agrandir le texte sélectionné"><span
                    className="comment-size-btn"
                    role="button"
                    aria-label="Agrandir la taille du texte sélectionné"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const range = remarquesSelectionRef.current;
                        if (!range || range.collapsed) return;
                        const container = range.commonAncestorContainer;
                        const editable = container.nodeType === 1 ? container.closest('.input-remarques') : container.parentElement?.closest('.input-remarques');
                        if (!editable) return;
                        const parentEl = container.nodeType === 1 ? container : container.parentElement;
                        const current = parentEl ? parseFloat(window.getComputedStyle(parentEl).fontSize) : 14;
                        const span = document.createElement('span');
                        span.style.fontSize = (current + 2) + 'px';
                        try {
                            const contents = range.extractContents();
                            span.appendChild(contents);
                            range.insertNode(span);
                        } catch { return; }
                        const newRange = document.createRange();
                        newRange.selectNodeContents(span);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        remarquesSelectionRef.current = newRange.cloneRange();
                        editable.focus();
                    }}
                >▲</span></CustomTooltip>
                <CustomTooltip text="Réduire le texte sélectionné"><span
                    className="comment-size-btn"
                    role="button"
                    aria-label="Réduire la taille du texte sélectionné"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const range = remarquesSelectionRef.current;
                        if (!range || range.collapsed) return;
                        const container = range.commonAncestorContainer;
                        const editable = container.nodeType === 1 ? container.closest('.input-remarques') : container.parentElement?.closest('.input-remarques');
                        if (!editable) return;
                        const parentEl = container.nodeType === 1 ? container : container.parentElement;
                        const current = parentEl ? parseFloat(window.getComputedStyle(parentEl).fontSize) : 14;
                        const newSize = Math.max(8, current - 2);
                        const span = document.createElement('span');
                        span.style.fontSize = newSize + 'px';
                        try {
                            const contents = range.extractContents();
                            span.appendChild(contents);
                            range.insertNode(span);
                        } catch { return; }
                        const newRange = document.createRange();
                        newRange.selectNodeContents(span);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        remarquesSelectionRef.current = newRange.cloneRange();
                        editable.focus();
                    }}
                >▼</span></CustomTooltip>
            </div>
            <div
                className="input-remarques"
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: remarques || '' }}
                onMouseUp={() => {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                        remarquesSelectionRef.current = sel.getRangeAt(0).cloneRange();
                    }
                }}
                onKeyUp={() => {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                        remarquesSelectionRef.current = sel.getRangeAt(0).cloneRange();
                    }
                }}
                onSelect={() => {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                        remarquesSelectionRef.current = sel.getRangeAt(0).cloneRange();
                    }
                }}
                onBlur={(e) => {
                    const html = e.currentTarget.innerHTML;
                    const text = e.currentTarget.textContent || '';
                    if (text.length <= calculatedMaxLength) {
                        updateRemarques && updateRemarques(html);
                    } else {
                        e.currentTarget.textContent = text.slice(0, calculatedMaxLength);
                        updateRemarques && updateRemarques(e.currentTarget.innerHTML);
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === '+' || e.key === '-') {
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                            e.preventDefault();
                            const color = e.key === '+' ? '#4CAF50' : '#F44336';
                            const range = selection.getRangeAt(0);
                            const selectedText = range.toString();
                            if (selectedText) {
                                const parentSpan = range.commonAncestorContainer.parentElement;
                                const isColored = parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.style.color;
                                if (isColored) {
                                    const span = document.createElement('span');
                                    span.style.color = 'white';
                                    range.surroundContents(span);
                                } else {
                                    const span = document.createElement('span');
                                    span.style.color = color;
                                    range.surroundContents(span);
                                }
                                updateRemarques && updateRemarques(e.currentTarget.innerHTML);
                            }
                        }
                    }
                }}
                data-tooltip={tooltipText}
            />
        </div>
    );
};

export default RemarquesEditor;
