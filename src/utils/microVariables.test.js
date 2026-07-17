import { describe, it, expect, beforeEach } from 'vitest';
import {
    DEFAULT_MICRO_VARIABLES,
    loadMicroVariables,
    saveMicroVariables,
    tokenizeMicroText,
} from './microVariables';

const names = DEFAULT_MICRO_VARIABLES.map(v => v.name);
const kw = (toks) => toks.filter(t => t.type === 'keyword').map(t => t.text);

beforeEach(() => localStorage.clear());

describe('tokenizeMicroText — coloration', () => {
    it('colore les variables connues avec leur suffixe', () => {
        const toks = tokenizeMicroText('si DA2 > TMAB2', names);
        expect(kw(toks)).toEqual(['DA2', 'TMAB2']);
    });

    it('colore AVer (sans le T) comme AVert', () => {
        // Le cœur de la demande : AVer doit être reconnu au même titre que AVert.
        expect(kw(tokenizeMicroText('si AVer1 < 5', names))).toEqual(['AVer1']);
        expect(kw(tokenizeMicroText('si AVert1 < 5', names))).toEqual(['AVert1']);
    });

    it('met en gras la syntaxe {}[]() et les connecteurs et/ou', () => {
        const toks = tokenizeMicroText('( DA1 ) et TMAB1', names);
        expect(toks.filter(t => t.type === 'bold').map(t => t.text)).toEqual(['(', ')', 'et']);
    });

    it('laisse le texte ordinaire en type text', () => {
        const toks = tokenizeMicroText('Attente quittée si', names);
        expect(toks.every(t => t.type === 'text')).toBe(true);
    });

    it('reflète une liste personnalisée : un nom retiré n\'est plus coloré', () => {
        const toks = tokenizeMicroText('si DA2 > TMAB2', ['TMAB']);
        expect(kw(toks)).toEqual(['TMAB2']); // DA2 n'est plus une variable connue
    });

    it('liste vide → aucune coloration, sans planter', () => {
        const toks = tokenizeMicroText('si DA2 > TMAB2', []);
        expect(kw(toks)).toEqual([]);
    });
});

describe('persistance des variables', () => {
    it('repli sur les valeurs par défaut sans réglage stocké', () => {
        expect(loadMicroVariables()).toEqual(DEFAULT_MICRO_VARIABLES);
    });

    it('sauvegarde puis relit une liste personnalisée', () => {
        const custom = [{ name: 'DA', description: 'x' }, { name: 'IC', description: 'îlot' }];
        saveMicroVariables(custom);
        expect(loadMicroVariables()).toEqual(custom);
    });

    it('nettoie les entrées invalides et les doublons à la sauvegarde', () => {
        saveMicroVariables([
            { name: '  DA  ', description: 'espaces' },
            { name: 'DA', description: 'doublon ignoré' },
            { name: '', description: 'vide ignoré' },
            { description: 'sans nom ignoré' },
        ]);
        expect(loadMicroVariables()).toEqual([{ name: 'DA', description: 'espaces' }]);
    });

    it('repli sur les défauts si le JSON stocké est corrompu', () => {
        localStorage.setItem('tracflux.microVariables', '{pas du json');
        expect(loadMicroVariables()).toEqual(DEFAULT_MICRO_VARIABLES);
    });
});
