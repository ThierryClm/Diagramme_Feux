/**
 * Helpers for exporting DOM elements as PNG or PDF.
 * Uses html2canvas + jsPDF — this module is intentionally loaded on-demand
 * (via dynamic import) so these heavy libs stay out of the initial bundle.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export { buildExportFilename } from './exportFilename';

/**
 * Render the given element onto a canvas with high resolution.
 * Extra options are passed through to html2canvas (e.g. onclone for DOM
 * tweaks on the cloned document used for rendering).
 */
const renderToCanvas = async (element, extraOptions = {}) => {
    return html2canvas(element, {
        backgroundColor: '#1e1e1e',
        scale: 2,              // retina quality
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        ...extraOptions
    });
};

/**
 * Export a DOM element as a PNG file (downloaded) AND copy it to the clipboard.
 *
 * @param {Element} element - DOM element to capture
 * @param {string} filename - filename without extension
 * @param {Object} [options] - extra html2canvas options (e.g. onclone)
 * @returns {Promise<{clipboardSuccess: boolean}>} indicates if the clipboard
 *   copy succeeded ; the file download is always attempted.
 */
export const exportElementAsPNG = async (element, filename, options = {}) => {
    if (!element) throw new Error('Élément introuvable');
    const canvas = await renderToCanvas(element, options);

    // toBlob is callback-based; promisify for sequential await
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Génération du PNG échouée');

    // 1. Download to disk
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 2. Copy to clipboard (best-effort — silently fails on browsers without
    // ClipboardItem support, on HTTP contexts, or if user denies permission).
    let clipboardSuccess = false;
    try {
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            clipboardSuccess = true;
        }
    } catch (e) {
        console.warn('Copie dans le presse-papiers échouée :', e);
    }

    return { clipboardSuccess };
};

/**
 * Export a DOM element as a PDF file (downloaded).
 * Automatically chooses orientation (landscape if wider than tall).
 * Splits into multiple A4 pages vertically if content is taller.
 */
export const exportElementAsPDF = async (element, filename, options = {}) => {
    if (!element) throw new Error('Élément introuvable');
    const canvas = await renderToCanvas(element);
    const imgData = canvas.toDataURL('image/png');

    // Determine orientation: landscape if canvas is wider than tall
    const orientation = options.orientation || (canvas.width > canvas.height ? 'landscape' : 'portrait');
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

    // A4 dimensions
    const pageWidth = orientation === 'landscape' ? 297 : 210;
    const pageHeight = orientation === 'landscape' ? 210 : 297;
    const margin = 8; // mm

    const usableWidth = pageWidth - 2 * margin;
    // Scale so canvas width fits usable width
    const imgWidthMm = usableWidth;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    if (imgHeightMm <= pageHeight - 2 * margin) {
        // Fits on one page
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidthMm, imgHeightMm);
    } else {
        // Split into multiple pages
        const usableHeight = pageHeight - 2 * margin;
        const pxPerMm = canvas.height / imgHeightMm;
        const slicePx = usableHeight * pxPerMm;
        let yOffset = 0;
        while (yOffset < canvas.height) {
            const sliceHeight = Math.min(slicePx, canvas.height - yOffset);
            // Create a temporary canvas containing just this slice
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeight;
            const ctx = sliceCanvas.getContext('2d');
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(canvas, 0, -yOffset);
            const sliceImgData = sliceCanvas.toDataURL('image/png');
            const sliceHeightMm = (sliceHeight * imgWidthMm) / canvas.width;
            if (yOffset > 0) pdf.addPage();
            pdf.addImage(sliceImgData, 'PNG', margin, margin, imgWidthMm, sliceHeightMm);
            yOffset += slicePx;
        }
    }

    pdf.save(`${filename}.pdf`);
};
