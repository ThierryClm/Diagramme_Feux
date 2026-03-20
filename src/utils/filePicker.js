/**
 * Wrapper around showOpenFilePicker / showSaveFilePicker
 * that prevents "File picker already active" errors
 * and exposes state so popup focus can be suppressed.
 */
let filePickerActive = false;

export function isFilePickerActive() {
    return filePickerActive;
}

export async function safeShowOpenFilePicker(options) {
    if (filePickerActive) {
        throw new DOMException('File picker already active.', 'AbortError');
    }
    filePickerActive = true;
    try {
        return await window.showOpenFilePicker(options);
    } finally {
        filePickerActive = false;
    }
}

export async function safeShowSaveFilePicker(options) {
    if (filePickerActive) {
        throw new DOMException('File picker already active.', 'AbortError');
    }
    filePickerActive = true;
    try {
        return await window.showSaveFilePicker(options);
    } finally {
        filePickerActive = false;
    }
}
