import { describe, it, expect } from 'vitest';
import { parseDiagfeux } from './diagfeuxImporter';

// Échantillon DiagFeux minimal mais représentatif (namespace inclus).
// 2 lignes de feux, 1 plan à 2 phases : cycle 60 s.
//  - Phase 1 (40 s) : ligne "1" verte
//  - Phase 2 (20 s) : ligne "2" verte
// Rouges de dégagement croisés (5 s et 6 s). Carrefour en agglo -> jaune 3 s.
const SAMPLE = `<?xml version="1.0" standalone="yes"?>
<DataSetDiagfeux xmlns="http://cete.fr/namespace">
  <Carrefour>
    <Propriétés>
      <Nom>Place du Test</Nom>
      <Commune>Testville</Commune>
      <EnAgglo>true</EnAgglo>
      <TypeControleur>ControleurX</TypeControleur>
      <Fabricant>FabricantY</Fabricant>
    </Propriétés>
    <Variante PlanFeuxCourant="P1">
      <LigneDeFeux>
        <ID>1</ID>
        <NumBranche>1</NumBranche>
        <RougeDégagement IDAdverse="2">5</RougeDégagement>
      </LigneDeFeux>
      <LigneDeFeux>
        <ID>2</ID>
        <NumBranche>2</NumBranche>
        <RougeDégagement IDAdverse="1">6</RougeDégagement>
      </LigneDeFeux>
      <PlanFeux ID="P1">
        <Phase>
          <Durée>40</Durée>
          <IDLigneFeux>1</IDLigneFeux>
        </Phase>
        <Phase>
          <Durée>20</Durée>
          <IDLigneFeux>2</IDLigneFeux>
        </Phase>
      </PlanFeux>
    </Variante>
  </Carrefour>
</DataSetDiagfeux>`;

describe('diagfeuxImporter — import valide', () => {
    const { state, warnings, error } = parseDiagfeux(SAMPLE);

    it('parse sans erreur', () => {
        expect(error).toBeUndefined();
        expect(state).not.toBeNull();
    });

    it('récupère le nom et les propriétés', () => {
        expect(state.projectName).toBe('Place du Test');
        expect(state.intersectionName).toBe('Place du Test');
        expect(state.projectProperties.commune).toBe('Testville');
        expect(state.projectProperties.controleurType).toBe('ControleurX');
        expect(state.projectProperties.controleurFabricant).toBe('FabricantY');
    });

    it('crée un groupe par ligne de feux (nom = ID DiagFeux)', () => {
        expect(state.groups).toHaveLength(2);
        expect(state.groups[0].name).toBe('1');
        expect(state.groups[1].name).toBe('2');
    });

    it('déduit cycle, décalages et verts des phases', () => {
        expect(state.cycleLength).toBe(60);
        // Ligne 1 : verte phase 1 -> offset 0, vert 40, jaune 3, rouge 17
        expect(state.groups[0].offset).toBe(0);
        expect(state.groups[0].durations).toEqual({ green: 40, orange: 3, red: 17 });
        // Ligne 2 : verte phase 2 (démarre à 40) -> offset 40, vert 20, rouge 37
        expect(state.groups[1].offset).toBe(40);
        expect(state.groups[1].durations).toEqual({ green: 20, orange: 3, red: 37 });
    });

    it('construit la matrice d\'interverts depuis les rouges de dégagement', () => {
        expect(state.conflictMatrix).toHaveLength(2);
        expect(state.conflictMatrix[0][1]).toBe(5); // ligne 1 -> ligne 2
        expect(state.conflictMatrix[1][0]).toBe(6); // ligne 2 -> ligne 1
    });

    it('signale les limites connues (type VL, etc.)', () => {
        expect(warnings.some(w => /VL/.test(w))).toBe(true);
    });
});

describe('diagfeuxImporter — décalage ouverture/fermeture', () => {
    it('DécalageOuvre avance l\'offset et allonge le vert', () => {
        const xml = SAMPLE.replace(
            '<IDLigneFeux>2</IDLigneFeux>',
            '<IDLigneFeux DécalageOuvre="2" DécalageFerme="1">2</IDLigneFeux>'
        );
        const { state } = parseDiagfeux(xml);
        // offset = 40 - 2 = 38 ; vert = 20 + 2 + 1 = 23
        expect(state.groups[1].offset).toBe(38);
        expect(state.groups[1].durations.green).toBe(23);
    });
});

describe('diagfeuxImporter — erreurs', () => {
    it('rejette un XML invalide', () => {
        const { state, error } = parseDiagfeux('<pas-du xml');
        expect(state).toBeNull();
        expect(error).toBeTruthy();
    });
    it('rejette un fichier sans carrefour (ex. Diagfeux.par)', () => {
        const { error } = parseDiagfeux('<?xml version="1.0"?><DataSetDiagfeux xmlns="http://cete.fr/namespace"><Paramétrage/></DataSetDiagfeux>');
        expect(error).toMatch(/carrefour/i);
    });
    it('rejette une entrée vide', () => {
        expect(parseDiagfeux('').error).toBeTruthy();
    });
});
