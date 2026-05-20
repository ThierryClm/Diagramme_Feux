import { describe, it, expect, beforeEach } from 'vitest';
import { isInviteVisible, noteWelcomeView, noteProjectSeen } from './welcomeInvite';

// jsdom fournit un vrai localStorage, on le nettoie entre chaque test.
beforeEach(() => {
    localStorage.clear();
});

describe('isInviteVisible', () => {
    it('est vrai au premier passage (compteurs à 0)', () => {
        expect(isInviteVisible('carrefour')).toBe(true);
        expect(isInviteVisible('ondeverte')).toBe(true);
    });

    it("ne consomme rien (lecture seule)", () => {
        isInviteVisible('carrefour');
        isInviteVisible('carrefour');
        // Toujours visible après plusieurs lectures
        expect(isInviteVisible('carrefour')).toBe(true);
    });

    it('reste visible juste en dessous du seuil de welcomeViews (4/5)', () => {
        for (let i = 0; i < 4; i++) noteWelcomeView('carrefour');
        expect(isInviteVisible('carrefour')).toBe(true);
    });

    it('se masque à partir de MAX_WELCOME_VIEWS (5)', () => {
        for (let i = 0; i < 5; i++) noteWelcomeView('carrefour');
        expect(isInviteVisible('carrefour')).toBe(false);
    });

    it('reste visible après 1 projet vu (1 < 2)', () => {
        noteProjectSeen('carrefour');
        expect(isInviteVisible('carrefour')).toBe(true);
    });

    it('se masque à partir de MAX_PROJECTS_SEEN (2)', () => {
        noteProjectSeen('carrefour');
        noteProjectSeen('carrefour');
        expect(isInviteVisible('carrefour')).toBe(false);
    });

    it("le 1er seuil atteint l'emporte (projects avant views)", () => {
        noteProjectSeen('carrefour');
        noteProjectSeen('carrefour');
        // 2 projects atteint le seuil, même si 0 view
        expect(isInviteVisible('carrefour')).toBe(false);
    });
});

describe('cloisonnement par scope', () => {
    it('les compteurs sont indépendants entre scopes', () => {
        for (let i = 0; i < 5; i++) noteWelcomeView('carrefour');
        expect(isInviteVisible('carrefour')).toBe(false);
        expect(isInviteVisible('ondeverte')).toBe(true);
    });

    it("projects vus d'un scope ne masque pas l'autre", () => {
        noteProjectSeen('ondeverte');
        noteProjectSeen('ondeverte');
        expect(isInviteVisible('ondeverte')).toBe(false);
        expect(isInviteVisible('carrefour')).toBe(true);
    });
});

describe('persistance localStorage', () => {
    it('utilise des clés préfixées tracflux.welcomeInvite.<scope>.<name>', () => {
        noteWelcomeView('carrefour');
        noteProjectSeen('carrefour');
        expect(localStorage.getItem('tracflux.welcomeInvite.carrefour.welcomeViews')).toBe('1');
        expect(localStorage.getItem('tracflux.welcomeInvite.carrefour.projectsSeen')).toBe('1');
    });

    it('tolère une valeur corrompue (NaN -> compte 0)', () => {
        localStorage.setItem('tracflux.welcomeInvite.carrefour.welcomeViews', 'banane');
        expect(isInviteVisible('carrefour')).toBe(true);
        // bump remet à 1 après la lecture NaN→0
        noteWelcomeView('carrefour');
        expect(localStorage.getItem('tracflux.welcomeInvite.carrefour.welcomeViews')).toBe('1');
    });
});
