import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
    installErrorInterceptor,
    getInterceptedEntries,
    clearInterceptedEntries
} from './errorInterceptor';

// Install once; note this wraps console.error/warn so the wrapper sits
// permanently above the native methods. We intentionally do NOT spy on
// console afterwards — that would replace the wrapper and break interception.
// The underlying console output still prints during tests (acceptable bruit).
beforeAll(() => {
    installErrorInterceptor();
});

describe('errorInterceptor', () => {
    beforeEach(() => {
        clearInterceptedEntries();
    });

    it('capture console.error', () => {
        console.error('boom', { detail: 42 });
        const entries = getInterceptedEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0].type).toBe('error');
        expect(entries[0].message).toContain('boom');
        expect(entries[0].ts).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('capture console.warn', () => {
        console.warn('attention');
        const entries = getInterceptedEntries();
        expect(entries.some(e => e.type === 'warn' && e.message.includes('attention'))).toBe(true);
    });

    it('formate un Error avec son stack', () => {
        const err = new Error('oups');
        console.error(err);
        const entries = getInterceptedEntries();
        const last = entries[entries.length - 1];
        expect(last.message).toContain('Error: oups');
    });

    it('clearInterceptedEntries vide le buffer', () => {
        console.error('un');
        console.error('deux');
        expect(getInterceptedEntries().length).toBeGreaterThanOrEqual(2);
        clearInterceptedEntries();
        expect(getInterceptedEntries()).toHaveLength(0);
    });

    it('buffer circulaire — ne dépasse pas 50 entrées', () => {
        for (let i = 0; i < 80; i++) {
            console.warn(`msg ${i}`);
        }
        const entries = getInterceptedEntries();
        expect(entries).toHaveLength(50);
        expect(entries[entries.length - 1].message).toContain('msg 79');
        expect(entries[0].message).toContain('msg 30');
    });

    it('getInterceptedEntries retourne une copie (pas la ref interne)', () => {
        console.warn('x');
        const snapshot = getInterceptedEntries();
        snapshot.push({ ts: 'fake', type: 'error', message: 'injection' });
        const real = getInterceptedEntries();
        expect(real.some(e => e.message === 'injection')).toBe(false);
    });

    it('installErrorInterceptor est idempotent', () => {
        installErrorInterceptor();
        installErrorInterceptor();
        clearInterceptedEntries();
        console.error('once');
        expect(getInterceptedEntries()).toHaveLength(1);
    });
});
