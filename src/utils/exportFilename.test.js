import { describe, it, expect } from 'vitest';
import { buildExportFilename } from './exportFilename';

describe('buildExportFilename', () => {
    const today = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    it('concatène project + pf + date', () => {
        const name = buildExportFilename('MonProjet', 'PF-Jour');
        expect(name).toBe(`MonProjet_PF-Jour_${today()}`);
    });

    it('retire les caractères interdits dans un nom de fichier', () => {
        // \ / : * ? " < > |
        const name = buildExportFilename('Pro/jet:*?', 'a|b<c>d');
        expect(name).not.toMatch(/[\\/:*?"<>|]/);
    });

    it('remplace les espaces par des tirets', () => {
        const name = buildExportFilename('Mon Projet', 'PF Jour Normal');
        expect(name).toContain('Mon-Projet');
        expect(name).toContain('PF-Jour-Normal');
    });

    it('ignore les parties vides', () => {
        const name = buildExportFilename('', 'PF');
        expect(name.startsWith('PF_')).toBe(true);
    });

    it('retourne la date seule quand project et pf sont vides', () => {
        const name = buildExportFilename('', '');
        expect(name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('horodate avec la date du jour au format ISO court', () => {
        const name = buildExportFilename('X', 'Y');
        expect(name).toMatch(/_\d{4}-\d{2}-\d{2}$/);
    });
});
