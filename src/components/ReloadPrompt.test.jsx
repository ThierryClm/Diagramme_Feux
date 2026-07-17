import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Le module virtuel de vite-plugin-pwa n'existe pas hors bundle : on le simule
// pour piloter needRefresh et observer ce que fait réellement le bouton.
const hook = {
    needRefresh: true,
    updateServiceWorker: vi.fn(),
    options: null
};

vi.mock('virtual:pwa-register/react', () => ({
    useRegisterSW: (options) => {
        hook.options = options;
        return {
            needRefresh: [hook.needRefresh, vi.fn()],
            offlineReady: [false, vi.fn()],
            updateServiceWorker: hook.updateServiceWorker
        };
    }
}));

import ReloadPrompt from './ReloadPrompt';
import { getSwStatus, resetSwStatus } from '../utils/swStatus';

describe('ReloadPrompt', () => {
    let reloadSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        resetSwStatus();
        hook.needRefresh = true;
        hook.updateServiceWorker = vi.fn().mockResolvedValue(undefined);
        reloadSpy = vi.fn();
        // jsdom n'implémente pas la navigation : on remplace reload par un espion.
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...window.location, reload: reloadSpy }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('recharge la page même quand le plugin ne le fait pas (page non contrôlée)', async () => {
        // LA régression : après un Ctrl+Shift+R, workbox fixe isUpdate=false, donc
        // l'écouteur « controlling » de vite-plugin-pwa ne recharge jamais — et
        // updateServiceWorker() ignore son argument reloadPage. Le bouton restait
        // sans effet visible. C'est à nous de recharger.
        render(<ReloadPrompt />);
        fireEvent.click(screen.getByText('Recharger'));

        await act(async () => { await vi.advanceTimersByTimeAsync(300); });

        expect(hook.updateServiceWorker).toHaveBeenCalled();
        expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('recharge quand même si l\'envoi de SKIP_WAITING échoue', async () => {
        hook.updateServiceWorker = vi.fn().mockRejectedValue(new Error('SW injoignable'));
        render(<ReloadPrompt />);
        fireEvent.click(screen.getByText('Recharger'));

        await act(async () => { await vi.advanceTimersByTimeAsync(300); });

        expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('ne recharge qu\'une fois si le plugin déclenche aussi le rechargement', async () => {
        render(<ReloadPrompt />);
        // Page contrôlée : le plugin appelle onNeedReload dès que le nouveau SW
        // prend la main. Notre filet à 300 ms ne doit pas provoquer un second tour.
        act(() => { hook.options.onNeedReload(); });
        expect(reloadSpy).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText('Recharger'));
        await act(async () => { await vi.advanceTimersByTimeAsync(300); });

        expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('publie « mise à jour en attente » pour le rapport de diagnostic', () => {
        render(<ReloadPrompt />);
        expect(getSwStatus().updatePending).toBe(true);
    });

    it('ne rend rien tant qu\'aucune mise à jour n\'attend', () => {
        hook.needRefresh = false;
        const { container } = render(<ReloadPrompt />);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByText('Recharger')).toBeNull();
    });
});
