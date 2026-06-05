import React, { useRef } from 'react';
import CustomTooltip from './CustomTooltip';

/**
 * Champ Remarques du plan de feu actif, rendu à la fois en colonne du
 * diagramme et dans une fenêtre détachée. Mêmes interactions dans les deux
 * contextes : sélectionner du texte puis cliquer + (vert) / − (rouge) /
 * ▲ (agrandir) / ▼ (réduire), ou utiliser les raccourcis clavier + / −.
 *
 * Important pour le mode popup : tous les accès `window` / `document` doivent
 * passer par `ownerDocument` / `defaultView` du nœud concerné — sinon
 * getSelection() et createElement() ciblent la fenêtre principale alors que
 * l'éditable et sa sélection vivent dans la popup.
 *
 * Stratégie de sélection : on lit en priorité la sélection LIVE au moment du
 * clic (les boutons font `e.preventDefault()` sur mousedown pour la préserver),
 * avec repli sur la dernière sélection sauvegardée via onMouseUp/onKeyUp/onSelect.
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
        ? 'Remarques générales — Sélectionnez du texte puis + (vert), − (rouge), ▲ (agrandir), ▼ (réduire)'
        : `Remarques générales (${charsPerLine} car. x ${linesAvailable} lignes max) - Sélectionnez du texte puis + (vert), − (rouge), ▲ (agrandir), ▼ (réduire)`;

    const docOf = (node) => (node && node.ownerDocument) || document;
    const winOf = (node) => docOf(node).defaultView || window;

    const saveSelectionFrom = (editable) => {
        const sel = winOf(editable).getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            remarquesSelectionRef.current = sel.getRangeAt(0).cloneRange();
        }
    };

    // Résout une Range utilisable : sélection LIVE en priorité, repli sur la
    // dernière sauvegardée. Utilise la bonne window selon le contexte (popup
    // ou principal).
    const resolveActiveRange = (anchorNode) => {
        const sel = winOf(anchorNode).getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            return sel.getRangeAt(0).cloneRange();
        }
        const saved = remarquesSelectionRef.current;
        if (saved && !saved.collapsed) return saved;
        return null;
    };

    const findEditableFromRange = (range) => {
        const container = range.commonAncestorContainer;
        return container.nodeType === 1
            ? container.closest('.input-remarques')
            : container.parentElement?.closest('.input-remarques');
    };

    // Mémorise un range couvrant le span fraîchement inséré, et tente une
    // restauration best-effort de la surbrillance / focus. La surbrillance
    // visuelle ne survit pas toujours au cycle d'événements du clic — on
    // accepte cette limite : l'utilisateur peut ré-sélectionner si besoin.
    // Le range sauvegardé permet quand même d'enchaîner les actions sur le
    // même texte via le fallback de resolveActiveRange.
    const restoreSelectionOver = (editable, span) => {
        const doc = docOf(editable);
        const newRange = doc.createRange();
        newRange.selectNodeContents(span);
        remarquesSelectionRef.current = newRange.cloneRange();
        try {
            editable.focus({ preventScroll: true });
            const sel = winOf(editable).getSelection();
            sel.removeAllRanges();
            sel.addRange(newRange);
        } catch { /* ignore */ }
    };

    // delta = +2 (Agrandir) ou -2 (Réduire). Renvoie un handler React.
    const applyResize = (delta) => (e) => {
        e.preventDefault();
        const range = resolveActiveRange(e.currentTarget);
        if (!range) return;
        const editable = findEditableFromRange(range);
        if (!editable) return;
        const doc = docOf(editable);
        const win = winOf(editable);
        const container = range.commonAncestorContainer;
        const parentEl = container.nodeType === 1 ? container : container.parentElement;
        const current = parentEl ? parseFloat(win.getComputedStyle(parentEl).fontSize) : 14;
        const newSize = Math.max(8, current + delta);
        const span = doc.createElement('span');
        span.style.fontSize = newSize + 'px';
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        } catch { return; }
        restoreSelectionOver(editable, span);
        updateRemarques && updateRemarques(editable.innerHTML);
    };

    // Couleur : '#4CAF50' (vert) ou '#F44336' (rouge). Si la sélection est
    // déjà colorée, on bascule sur blanc (retour visuel à la couleur du fond).
    const applyColor = (color) => (e) => {
        e.preventDefault();
        const range = resolveActiveRange(e.currentTarget);
        if (!range) return;
        const editable = findEditableFromRange(range);
        if (!editable) return;
        const doc = docOf(editable);
        const parentSpan = range.commonAncestorContainer.parentElement;
        const isColored = parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.style.color;
        const span = doc.createElement('span');
        span.style.color = isColored ? 'white' : color;
        try {
            range.surroundContents(span);
        } catch {
            // surroundContents échoue sur les sélections partielles d'un span ;
            // on tombe sur extract/insert qui gère ces cas.
            try {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
            } catch { return; }
        }
        restoreSelectionOver(editable, span);
        updateRemarques && updateRemarques(editable.innerHTML);
    };

    return (
        <div className={`timeline-remarques no-print${popupMode ? ' remarques-popup-mode' : ''}`}>
            <div className="remarques-header">
                <span>Remarques</span>
                <CustomTooltip text="Couleur verte (+)"><span
                    className="comment-color-btn comment-color-plus"
                    role="button"
                    aria-label="Colorer le texte sélectionné en vert"
                    onMouseDown={applyColor('#4CAF50')}
                >+</span></CustomTooltip>
                <CustomTooltip text="Couleur rouge (-)"><span
                    className="comment-color-btn comment-color-minus"
                    role="button"
                    aria-label="Colorer le texte sélectionné en rouge"
                    onMouseDown={applyColor('#F44336')}
                >−</span></CustomTooltip>
                <CustomTooltip text="Agrandir le texte sélectionné"><span
                    className="comment-size-btn"
                    role="button"
                    aria-label="Agrandir la taille du texte sélectionné"
                    onMouseDown={applyResize(+2)}
                >▲</span></CustomTooltip>
                <CustomTooltip text="Réduire le texte sélectionné"><span
                    className="comment-size-btn"
                    role="button"
                    aria-label="Réduire la taille du texte sélectionné"
                    onMouseDown={applyResize(-2)}
                >▼</span></CustomTooltip>
            </div>
            <div
                className="input-remarques"
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: remarques || '' }}
                onMouseUp={(e) => saveSelectionFrom(e.currentTarget)}
                onKeyUp={(e) => saveSelectionFrom(e.currentTarget)}
                onSelect={(e) => saveSelectionFrom(e.currentTarget)}
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
                    // Raccourcis clavier : + / − colorent la sélection.
                    if (e.key === '+' || e.key === '-') {
                        const sel = winOf(e.currentTarget).getSelection();
                        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                            applyColor(e.key === '+' ? '#4CAF50' : '#F44336')(e);
                        }
                    }
                }}
                data-tooltip={tooltipText}
            />
        </div>
    );
};

export default RemarquesEditor;
