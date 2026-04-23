/**
 * Intercepts console errors/warnings and uncaught runtime errors.
 * Keeps the last N entries in a circular buffer for diagnostic reports.
 *
 * Important: no network, no external storage. Purely in-memory.
 * The original console behavior is preserved (we wrap, we don't hijack).
 */

const MAX_ENTRIES = 50;
const buffer = [];
let installed = false;

const pushEntry = (entry) => {
    buffer.push(entry);
    if (buffer.length > MAX_ENTRIES) {
        buffer.splice(0, buffer.length - MAX_ENTRIES);
    }
};

const formatArg = (arg) => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (arg instanceof Error) return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
    if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return String(arg); }
    }
    return String(arg);
};

const formatArgs = (args) => Array.from(args).map(formatArg).join(' ');

/**
 * Install the interception once. Idempotent.
 */
export const installErrorInterceptor = () => {
    if (installed) return;
    installed = true;

    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);

    console.error = (...args) => {
        pushEntry({
            ts: new Date().toISOString(),
            type: 'error',
            message: formatArgs(args)
        });
        originalError(...args);
    };

    console.warn = (...args) => {
        pushEntry({
            ts: new Date().toISOString(),
            type: 'warn',
            message: formatArgs(args)
        });
        originalWarn(...args);
    };

    // Uncaught runtime errors
    window.addEventListener('error', (e) => {
        pushEntry({
            ts: new Date().toISOString(),
            type: 'runtime',
            message: `${e.message || 'Uncaught error'}${e.filename ? ` at ${e.filename}:${e.lineno}:${e.colno}` : ''}`
        });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason;
        const msg = reason instanceof Error
            ? `${reason.name}: ${reason.message}${reason.stack ? '\n' + reason.stack : ''}`
            : formatArg(reason);
        pushEntry({
            ts: new Date().toISOString(),
            type: 'promise',
            message: msg
        });
    });
};

/**
 * Snapshot of intercepted entries (newest last).
 */
export const getInterceptedEntries = () => buffer.slice();

/**
 * Clear the buffer (useful after a diagnostic export, if desired).
 */
export const clearInterceptedEntries = () => {
    buffer.length = 0;
};
