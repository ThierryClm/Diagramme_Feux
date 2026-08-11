import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

import ConflictList from './ConflictList';

// Le partage majeur/potentiel repose entièrement sur isConflictGrayed, que App
// dérive du phaseFlag du groupe amont. On le simule ici de la même façon.
const groups = [
    { id: 1, name: 'GF1' },
    { id: 2, name: 'GF2' },
    { id: 3, name: 'GF3', phaseFlag: 'a' },   // aiguillage
    { id: 4, name: 'GF4', phaseFlag: 'e' },   // escamotage
];

const isConflictGrayed = (c) => {
    const from = groups.find(g => g.id === c.from);
    return !!from?.phaseFlag;
};

const intergreen = (from, to, actual, required) => ({
    type: 'intergreen', from, to, actual, required
});

const renderList = (conflicts, props = {}) =>
    render(
        <ConflictList
            conflicts={conflicts}
            groups={groups}
            isConflictGrayed={isConflictGrayed}
            {...props}
        />
    );

const sectionDe = (titre) =>
    screen.getByRole('heading', { name: new RegExp(titre, 'i') }).parentElement;

describe('ConflictList — majeurs vs potentiels', () => {
    it('range chaque conflit dans la bonne section', () => {
        renderList([
            intergreen(1, 2, 3.2, 5),   // majeur
            intergreen(3, 2, 1.0, 4),   // potentiel (aiguillage)
            intergreen(4, 1, 2.0, 4),   // potentiel (escamotage)
        ]);

        const majeurs = sectionDe('Conflits majeurs');
        expect(within(majeurs).getAllByRole('listitem')).toHaveLength(1);
        expect(within(majeurs).getByText(/GF1 → GF2/)).toBeInTheDocument();

        const potentiels = sectionDe('Conflits potentiels');
        expect(within(potentiels).getAllByRole('listitem')).toHaveLength(2);
    });

    it("annonce l'origine micro-régulation de chaque conflit potentiel", () => {
        renderList([intergreen(3, 2, 1.0, 4), intergreen(4, 1, 2.0, 4)]);

        const potentiels = sectionDe('Conflits potentiels');
        expect(within(potentiels).getByText(/\(aiguillage\)/)).toBeInTheDocument();
        expect(within(potentiels).getByText(/\(escamotage\)/)).toBeInTheDocument();
    });

    it('porte le compte dans le titre de chaque section', () => {
        renderList([
            intergreen(1, 2, 3.2, 5),
            intergreen(2, 1, 3.2, 5),
            intergreen(3, 2, 1.0, 4),
        ]);

        expect(screen.getByRole('heading', { name: /Conflits majeurs — 2/ })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Conflits potentiels — 1/ })).toBeInTheDocument();
        // Plus de titre global « Conflits » : il ferait doublon.
        expect(screen.queryByRole('heading', { name: /^Conflits$|^Conflits\s*[:(]/ })).toBeNull();
    });

    it("n'affiche pas de section majeurs quand il n'y en a aucun", () => {
        const { container } = renderList([intergreen(3, 2, 1.0, 4)]);

        expect(screen.queryByRole('heading', { name: /Conflits majeurs/ })).toBeNull();
        expect(screen.queryByText(/Aucun conflit majeur/)).toBeNull();
        // Cadre en ambre : plus aucun conflit à traiter.
        expect(container.querySelector('.conflict-list-sans-majeur')).toBeTruthy();
    });

    it('pose le bouton Détacher sur la première section visible', () => {
        const onDetach = vi.fn();

        // Avec des majeurs : le bouton est sur leur titre.
        const { unmount } = renderList(
            [intergreen(1, 2, 3.2, 5), intergreen(3, 2, 1.0, 4)], { onDetach }
        );
        expect(within(sectionDe('Conflits majeurs')).getByRole('button', { name: 'Détacher' }))
            .toBeInTheDocument();
        expect(within(sectionDe('Conflits potentiels')).queryByRole('button')).toBeNull();
        unmount();

        // Sans majeurs : il bascule sur les potentiels, et reste unique.
        renderList([intergreen(3, 2, 1.0, 4)], { onDetach });
        expect(screen.getAllByRole('button', { name: 'Détacher' })).toHaveLength(1);
        expect(within(sectionDe('Conflits potentiels')).getByRole('button', { name: 'Détacher' }))
            .toBeInTheDocument();
    });

    it('garde le cadre rouge dès qu\'un conflit majeur subsiste', () => {
        const { container } = renderList([intergreen(1, 2, 3.2, 5), intergreen(3, 2, 1.0, 4)]);
        expect(container.querySelector('.conflict-list-sans-majeur')).toBeNull();
    });

    it("n'affiche pas de section potentiels quand il n'y en a aucun", () => {
        renderList([intergreen(1, 2, 3.2, 5)]);
        expect(screen.queryByRole('heading', { name: /Conflits potentiels/ })).toBeNull();
    });

    it('conserve la liste vide et le survol croisé', () => {
        const setHoveredConflict = vi.fn();
        const { rerender } = renderList([intergreen(1, 2, 3.2, 5)], { setHoveredConflict });

        fireEvent.mouseEnter(screen.getByText(/GF1 → GF2/));
        expect(setHoveredConflict).toHaveBeenCalledWith({ from: 1, to: 2 });

        rerender(
            <ConflictList conflicts={[]} groups={groups} isConflictGrayed={isConflictGrayed} />
        );
        expect(screen.getByText('Aucun conflit détecté.')).toBeInTheDocument();
    });
});
