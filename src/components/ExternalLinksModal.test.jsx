import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ExternalLinksModal from './ExternalLinksModal';

const links = [
    { id: 1, name: 'Dossier de carrefour', path: 'C:\\Etudes\\510\\dossier.pdf' },
    { id: 2, name: 'Portail exploitant', path: 'https://exemple.fr/portail' },
];

const renderModal = (props = {}) =>
    render(
        <ExternalLinksModal
            isOpen
            onClose={() => {}}
            links={links}
            onLinksChange={() => {}}
            {...props}
        />
    );

describe('ExternalLinksModal', () => {
    // Le point du refactor : la fenêtre s'appuie sur la coquille Modal partagée,
    // d'où elle hérite l'habillage des sept thèmes défini dans index.css.
    // Sans ces classes, elle redevient muette aux thèmes.
    it('se rend dans la coquille Modal partagée, ancrée sous le menu', () => {
        const { container } = renderModal();

        expect(container.querySelector('.modal-overlay.modal-menu-overlay')).toBeTruthy();
        expect(container.querySelector('.modal-content.external-links-modal')).toBeTruthy();
        expect(container.querySelector('.modal-body')).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Liens externes' })).toBeInTheDocument();
    });

    it('ne rend rien quand elle est fermée', () => {
        const { container } = renderModal({ isOpen: false });
        expect(container.querySelector('.modal-overlay')).toBeNull();
    });

    it('liste les liens avec leur nom et leur chemin', () => {
        renderModal();

        expect(screen.getByText('Dossier de carrefour')).toBeInTheDocument();
        expect(screen.getByText('C:\\Etudes\\510\\dossier.pdf')).toBeInTheDocument();
        expect(screen.getByText('Portail exploitant')).toBeInTheDocument();
    });

    it('annonce la liste vide', () => {
        renderModal({ links: [] });
        expect(screen.getByText('Aucun lien externe configuré.')).toBeInTheDocument();
    });

    it('ajoute un lien et le remonte au parent', () => {
        const onLinksChange = vi.fn();
        renderModal({ links: [], onLinksChange });

        fireEvent.change(screen.getByPlaceholderText('Nom du raccourci'), {
            target: { value: 'Plan de feux' },
        });
        fireEvent.change(screen.getByPlaceholderText('Chemin du fichier ou URL'), {
            target: { value: 'C:\\Etudes\\pf.pdf' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

        expect(onLinksChange).toHaveBeenCalledTimes(1);
        const [ajoutes] = onLinksChange.mock.calls[0];
        expect(ajoutes).toHaveLength(1);
        expect(ajoutes[0]).toMatchObject({ name: 'Plan de feux', path: 'C:\\Etudes\\pf.pdf' });
    });

    it('bascule le formulaire en édition puis annule sans rien modifier', () => {
        const onLinksChange = vi.fn();
        renderModal({ onLinksChange });

        fireEvent.click(screen.getAllByTitle('Modifier')[0]);
        expect(screen.getByRole('heading', { name: 'Modifier le lien' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Nom du raccourci')).toHaveValue('Dossier de carrefour');

        fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
        expect(screen.getByRole('heading', { name: 'Ajouter un lien' })).toBeInTheDocument();
        expect(onLinksChange).not.toHaveBeenCalled();
    });

    it('ferme par le bouton du pied de fenêtre comme par la croix de l\'en-tête', () => {
        const onClose = vi.fn();
        const { container } = renderModal({ onClose });

        fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
        fireEvent.click(container.querySelector('.modal-close'));

        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
