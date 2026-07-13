import { describe, it, expect } from 'vitest';
import { parseDiagfeux } from './diagfeuxImporter';

// Échantillon DiagFeux minimal (racine et namespace réels).
// 2 lignes véhicules, 1 plan à 2 phases -> cycle 60 s.
//   Phase 1 (40 s) : ligne "1" au vert   |   Phase 2 (20 s) : ligne "2" au vert
// Rouges de dégagement croisés : 5 s et 6 s. En agglo -> jaune 3 s.
// => Interverts (= rouge + jaune) : 1->2 = 8 s ; 2->1 = 9 s.
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
    <Variante PlanFeuxCourant="PF1">
      <LigneDeFeux>
        <ID>1</ID>
        <RougeDégagement IDAdverse="2">5</RougeDégagement>
      </LigneDeFeux>
      <LigneDeFeux>
        <ID>2</ID>
        <RougeDégagement IDAdverse="1">6</RougeDégagement>
      </LigneDeFeux>
      <PlanFeux ID="PF1">
        <Phase><Durée>40</Durée><IDLigneFeux>1</IDLigneFeux></Phase>
        <Phase><Durée>20</Durée><IDLigneFeux>2</IDLigneFeux></Phase>
      </PlanFeux>
    </Variante>
  </Carrefour>
</DataSetDiagfeux>`;

// Carrefour avec une ligne véhicule (F1) et une ligne piéton (P1).
const SAMPLE_PIETON = `<?xml version="1.0" standalone="yes"?>
<DataSetDiagfeux xmlns="http://cete.fr/namespace">
  <Carrefour>
    <Propriétés><Nom>Croisement</Nom><EnAgglo>true</EnAgglo></Propriétés>
    <Variante PlanFeuxCourant="PF1">
      <LigneDeFeux><ID>F1</ID><RougeDégagement IDAdverse="P1">5</RougeDégagement></LigneDeFeux>
      <LigneDeFeux><ID>P1</ID><RougeDégagement IDAdverse="F1">6</RougeDégagement></LigneDeFeux>
      <PlanFeux ID="PF1">
        <Phase><Durée>40</Durée><IDLigneFeux>F1</IDLigneFeux></Phase>
        <Phase><Durée>20</Durée><IDLigneFeux>P1</IDLigneFeux></Phase>
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
        expect(state.projectProperties.commune).toBe('Testville');
    });

    // Garde-fou : les clés DOIVENT correspondre au schéma réel de TraCflux
    // (DEFAULT_PROJECT_PROPERTIES). Toute autre clé serait perdue en silence.
    it('mappe les propriétés sur les VRAIES clés de TraCflux', () => {
        const p = state.projectProperties;
        const schema = [
            'commune', 'idCommune', 'idCarrefour', 'controleur', 'programme',
            'horsAgglomeration', 'moa', 'moe', 'bureauEtudes', 'auteur',
            'logoMoa', 'logoMoe', 'dateCreation', 'dateModification',
            'numeroDossier', 'phaseEtude', 'commentaires'
        ];
        Object.keys(p).forEach(k => expect(schema).toContain(k));
        // Fabricant + TypeControleur -> champ « controleur » unique
        expect(p.controleur).toBe('FabricantY ControleurX');
        // EnAgglo=true -> horsAgglomeration=false (booléen inverse)
        expect(p.horsAgglomeration).toBe(false);
    });

    it('hors agglomération : jaune de 5 s et horsAgglomeration=true', () => {
        const xml = SAMPLE.replace('<EnAgglo>true</EnAgglo>', '<EnAgglo>false</EnAgglo>');
        const { state: s } = parseDiagfeux(xml);
        expect(s.projectProperties.horsAgglomeration).toBe(true);
        expect(s.groups[0].durations.orange).toBe(5);
        expect(s.conflictMatrix[0][1]).toBe(10); // 5 (rouge) + 5 (jaune hors agglo)
    });

    it('crée un groupe par ligne de feux (nom = ID DiagFeux)', () => {
        expect(state.groups.map(g => g.name)).toEqual(['1', '2']);
        expect(state.groups.every(g => g.type === 'VL')).toBe(true);
    });

    it('cycle = somme des durées de phases', () => {
        expect(state.cycleLength).toBe(60);
    });

    it('matrice = INTERVERTS (rouge de dégagement + jaune), pas le rouge seul', () => {
        expect(state.conflictMatrix[0][1]).toBe(8); // 5 + 3
        expect(state.conflictMatrix[1][0]).toBe(9); // 6 + 3
    });

    it('le vert se ferme avant la fin de phase, borné par les contraintes de sécurité', () => {
        // Ligne 1 : ouvre à 0, doit fermer 8 s avant l'ouverture de la ligne 2 (40) -> vert 32
        expect(state.groups[0].offset).toBe(0);
        expect(state.groups[0].durations).toEqual({ green: 32, orange: 3, red: 25 });
        // Ligne 2 : ouvre à 40, doit fermer 9 s avant la réouverture de la ligne 1 (60) -> vert 11
        expect(state.groups[1].offset).toBe(40);
        expect(state.groups[1].durations).toEqual({ green: 11, orange: 3, red: 46 });
    });

    it('INVARIANT : le plan importé respecte tous les interverts (aucun conflit)', () => {
        const { groups, cycleLength, conflictMatrix } = state;
        groups.forEach((from, i) => {
            groups.forEach((to, j) => {
                const iv = conflictMatrix[i][j];
                if (i === j || iv === '' || iv === null) return;
                const endGreen = from.offset + from.durations.green;
                let gap = to.offset - endGreen;
                while (gap < 0) gap += cycleLength;
                expect(gap).toBeGreaterThanOrEqual(iv);
            });
        });
    });
});

describe('diagfeuxImporter — décalages ouverture/fermeture', () => {
    it('DécalageOuvre avance l\'ouverture (et resserre le vert de l\'antagoniste)', () => {
        const xml = SAMPLE.replace(
            '<IDLigneFeux>2</IDLigneFeux>',
            '<IDLigneFeux DécalageOuvre="2" DécalageFerme="1">2</IDLigneFeux>'
        );
        const { state } = parseDiagfeux(xml);
        // Ligne 2 ouvre 2 s plus tôt : offset 38
        expect(state.groups[1].offset).toBe(38);
        // Ligne 1 doit donc fermer 8 s avant 38 -> vert 30 (au lieu de 32)
        expect(state.groups[0].durations.green).toBe(30);
    });
});

describe('diagfeuxImporter — lignes piétonnes', () => {
    const { state, warnings } = parseDiagfeux(SAMPLE_PIETON);

    it('détecte le piéton par le préfixe « P » (guide : Fx véhicule, Px piéton)', () => {
        expect(state.groups[0].type).toBe('VL');
        expect(state.groups[1].type).toBe('P');
        expect(state.groups[1].courant).toBe('Piéton');
    });

    it('les feux piétons n\'ont PAS de jaune', () => {
        expect(state.groups[0].durations.orange).toBe(3); // véhicule
        expect(state.groups[1].durations.orange).toBe(0); // piéton
    });

    it('l\'intervert n\'ajoute le jaune que pour la ligne véhicule', () => {
        expect(state.conflictMatrix[0][1]).toBe(8); // F1 : 5 + 3
        expect(state.conflictMatrix[1][0]).toBe(6); // P1 : 6 + 0
    });

    it('signale la détection des lignes piétonnes', () => {
        expect(warnings.some(w => /piéton/i.test(w))).toBe(true);
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
