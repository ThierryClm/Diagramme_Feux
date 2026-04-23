import { describe, it, expect } from 'vitest';
import parseHTMFile from './parseHTMFile';

// ---------------- Parsing via tableau HTML ----------------

describe('parseHTMFile — parsing via table HTML', () => {
    it('extrait des groupes depuis une table avec 4+ cellules', () => {
        const html = `
            <table>
                <tr><th>Nom</th><th>Vert</th><th>Orange</th><th>Rouge</th></tr>
                <tr><td>GF1</td><td>30</td><td>3</td><td>57</td></tr>
                <tr><td>GF2</td><td>25</td><td>3</td><td>62</td></tr>
            </table>
        `;
        const groups = parseHTMFile(html);
        expect(groups.length).toBeGreaterThanOrEqual(2);
        expect(groups[0].name).toBe('GF1');
        expect(groups[0].durations.green).toBe(30);
    });

    it('attribue un id séquentiel à partir de 1', () => {
        const html = `
            <table>
                <tr><td>A</td><td>10</td><td>3</td><td>0</td></tr>
                <tr><td>B</td><td>20</td><td>3</td><td>0</td></tr>
                <tr><td>C</td><td>15</td><td>3</td><td>0</td></tr>
            </table>
        `;
        const groups = parseHTMFile(html);
        expect(groups.map(g => g.id)).toEqual([1, 2, 3]);
    });

    it('détecte le type "Piéton" quand le nom contient "pieton"', () => {
        const html = `
            <table>
                <tr><td>Traversée Pieton Nord</td><td>15</td><td>3</td><td>0</td></tr>
            </table>
        `;
        const groups = parseHTMFile(html);
        expect(groups[0].type).toBe('Piéton');
    });

    it('détecte le type "Cycliste" quand le nom contient "cycle"', () => {
        const html = `
            <table>
                <tr><td>Piste cycle</td><td>12</td><td>3</td><td>0</td></tr>
            </table>
        `;
        const groups = parseHTMFile(html);
        expect(groups[0].type).toBe('Cycliste');
    });

    it('type par défaut "VL" sinon', () => {
        const html = `
            <table>
                <tr><td>GF1</td><td>30</td><td>3</td><td>0</td></tr>
            </table>
        `;
        const groups = parseHTMFile(html);
        expect(groups[0].type).toBe('VL');
    });

    it('ignore les lignes avec moins de 4 cellules', () => {
        const html = `
            <table>
                <tr><td>Entête</td><td>incomplet</td></tr>
                <tr><td>GF1</td><td>30</td><td>3</td><td>0</td></tr>
            </table>
        `;
        const groups = parseHTMFile(html);
        expect(groups).toHaveLength(1);
        expect(groups[0].name).toBe('GF1');
    });

    it('ignore les lignes avec un nom vide', () => {
        const html = `
            <table>
                <tr><td></td><td>30</td><td>3</td><td>0</td></tr>
                <tr><td>GF1</td><td>25</td><td>3</td><td>0</td></tr>
            </table>
        `;
        const groups = parseHTMFile(html);
        expect(groups).toHaveLength(1);
        expect(groups[0].name).toBe('GF1');
    });

    it('remplit les champs par défaut (minGreen, offset)', () => {
        const html = `
            <table>
                <tr><td>GF1</td><td>30</td><td>3</td><td>0</td></tr>
            </table>
        `;
        const groups = parseHTMFile(html);
        expect(groups[0].minGreen).toBe(6);
        expect(groups[0].offset).toBe(0);
    });
});

// ---------------- Parsing via texte structuré (fallback) ----------------

describe('parseHTMFile — fallback texte structuré', () => {
    it('extrait depuis un texte "GF1 : 30s vert, 3s orange"', () => {
        const content = `
            GF1 : 30s vert, 3s orange
            GF2 : 25s vert, 3s orange
        `;
        const groups = parseHTMFile(content);
        expect(groups).toHaveLength(2);
        expect(groups[0].name).toBe('GF1');
        expect(groups[0].durations.green).toBe(30);
        expect(groups[0].durations.orange).toBe(3);
    });

    it('accepte "green" comme alias de "vert"', () => {
        const content = `GF1 : 30s green, 3s orange`;
        const groups = parseHTMFile(content);
        expect(groups[0].durations.green).toBe(30);
    });

    it('utilise 3 comme orange par défaut si absent du texte', () => {
        const content = `GF1 : 30s vert`;
        const groups = parseHTMFile(content);
        expect(groups[0].durations.orange).toBe(3);
    });
});

// ---------------- Cas limites ----------------

describe('parseHTMFile — cas limites', () => {
    it('retourne un tableau vide pour une chaîne vide', () => {
        expect(parseHTMFile('')).toEqual([]);
    });

    it('retourne un tableau vide pour du HTML sans données', () => {
        const groups = parseHTMFile('<html><body><p>Rien ici</p></body></html>');
        expect(groups).toEqual([]);
    });

    it('retourne un tableau vide pour du texte non structuré', () => {
        const groups = parseHTMFile('ceci est juste du texte aléatoire');
        expect(groups).toEqual([]);
    });
});
