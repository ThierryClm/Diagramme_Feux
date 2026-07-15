import { describe, it, expect } from 'vitest';
import { stampReadOnly, isReadOnlyStamped } from './dossierLock';

describe('dossierLock', () => {
    it('marque un projet et le détecte', () => {
        const stamped = stampReadOnly({ projectName: 'X', groups: [] });
        expect(isReadOnlyStamped(stamped)).toBe(true);
    });

    it('n\'altère pas les données du projet (immuable)', () => {
        const src = { projectName: 'X', groups: [1, 2] };
        const stamped = stampReadOnly(src);
        expect(src.stamp).toBeUndefined();       // source inchangée
        expect(stamped.projectName).toBe('X');
        expect(stamped.groups).toBe(src.groups); // données conservées
    });

    it('le marqueur n\'est pas parlant en clair', () => {
        const stamped = stampReadOnly({});
        expect(stamped.stamp).not.toMatch(/lecture|readonly|ro|true/i);
    });

    it('un projet normal n\'est pas détecté lecture seule', () => {
        expect(isReadOnlyStamped({ projectName: 'X' })).toBe(false);
        expect(isReadOnlyStamped({})).toBe(false);
        expect(isReadOnlyStamped(null)).toBe(false);
    });

    it('résiste à un marqueur corrompu ou non conforme', () => {
        expect(isReadOnlyStamped({ stamp: 'pas-du-base64!!' })).toBe(false);
        expect(isReadOnlyStamped({ stamp: btoa('{"ro":0}') })).toBe(false);
        expect(isReadOnlyStamped({ stamp: btoa('pas du json') })).toBe(false);
        expect(isReadOnlyStamped({ stamp: 42 })).toBe(false);
    });
});
