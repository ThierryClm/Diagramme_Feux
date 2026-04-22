/**
 * Simple toast bus (singleton). No provider needed.
 *
 * Usage:
 *   import { toast } from './utils/toast';
 *   toast.success('Projet sauvegardé');
 *   toast.error('Échec de l\'import');
 *   toast.info('Action annulée');
 *
 * Mount <ToastContainer /> once in the root to display toasts.
 */

const listeners = new Set();
let nextId = 1;

// Per-type enable/disable flags (persisted to localStorage)
const STORAGE_KEY = 'toastPreferences';
const defaultPrefs = { success: true, error: true, info: true };

function loadPrefs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...defaultPrefs };
        const parsed = JSON.parse(raw);
        return { ...defaultPrefs, ...parsed };
    } catch {
        return { ...defaultPrefs };
    }
}

let prefs = loadPrefs();

export function getToastPrefs() {
    return { ...prefs };
}

export function setToastPref(type, enabled) {
    if (!(type in prefs)) return;
    prefs = { ...prefs, [type]: !!enabled };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

function emit(type, message) {
    if (!prefs[type]) return null; // silenced by user preference
    const t = { id: nextId++, type, message, createdAt: Date.now() };
    listeners.forEach(l => l(t));
    return t.id;
}

export const toast = {
    success: (message) => emit('success', message),
    error: (message) => emit('error', message),
    info: (message) => emit('info', message)
};

export function subscribeToasts(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
