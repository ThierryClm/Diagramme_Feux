import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Le drapeau exampleMode est calculé SYNCHRONEMENT au premier import,
// à partir de window.location.search. Pour tester les deux branches
// (URL avec / sans ?example), on modifie l'URL via history.replaceState
// puis on force un ré-import via vi.resetModules() entre chaque test.

describe('exampleMode', () => {
    const originalSearch = window.location.search;

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        // Restaure l'URL de départ pour ne pas polluer les autres tests.
        window.history.replaceState(null, '', window.location.pathname + originalSearch);
    });

    it('isExampleSession() est false par défaut (URL sans ?example)', async () => {
        window.history.replaceState(null, '', window.location.pathname);
        const { isExampleSession } = await import('./exampleMode');
        expect(isExampleSession()).toBe(false);
    });

    it("isExampleSession() est true avec ?example=carrefour", async () => {
        window.history.replaceState(null, '', window.location.pathname + '?example=carrefour');
        const { isExampleSession } = await import('./exampleMode');
        expect(isExampleSession()).toBe(true);
    });

    it("isExampleSession() est true avec ?example=ondeverte", async () => {
        window.history.replaceState(null, '', window.location.pathname + '?example=ondeverte');
        const { isExampleSession } = await import('./exampleMode');
        expect(isExampleSession()).toBe(true);
    });

    it("isExampleSession() est true même avec ?example seul (sans valeur)", async () => {
        // .has('example') accepte la clé sans valeur — un projet exemple
        // reste un projet exemple même si le mode n'est pas précisé.
        window.history.replaceState(null, '', window.location.pathname + '?example');
        const { isExampleSession } = await import('./exampleMode');
        expect(isExampleSession()).toBe(true);
    });

    it("exitExampleSession() rebascule isExampleSession() à false", async () => {
        window.history.replaceState(null, '', window.location.pathname + '?example=carrefour');
        const { isExampleSession, exitExampleSession } = await import('./exampleMode');
        expect(isExampleSession()).toBe(true);
        exitExampleSession();
        expect(isExampleSession()).toBe(false);
    });

    it("exitExampleSession() est idempotent (false reste false)", async () => {
        window.history.replaceState(null, '', window.location.pathname);
        const { isExampleSession, exitExampleSession } = await import('./exampleMode');
        exitExampleSession();
        exitExampleSession();
        expect(isExampleSession()).toBe(false);
    });
});
