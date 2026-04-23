# Diagramme de Feux

Outil web de conception et d'optimisation de diagrammes de feux tricolores, destiné aux traficiens et ingénieurs de la circulation.

Conçu pour être utilisé **localement**, sans serveur ni télémétrie : toutes les données restent dans le navigateur (localStorage) et sur votre poste.

## Fonctionnalités principales

- Définition des groupes de feux (VL, TC, Cycliste, Piéton) avec durées vert/orange/rouge
- Matrice d'intergreens avec détection automatique des conflits
- Diagramme temporel horizontal avec tête de lecture
- Plans de feux multiples (PF) gérés par onglets
- Table d'actions par plan
- Onde verte sur page dédiée
- Import/export (JSON, CSV, Excel)
- Export PDF et PNG du diagramme
- Thèmes (sombre, clair, haut contraste, ambre)
- Rapport de diagnostic pour signalement de bug (local, sans envoi réseau)

## Installation

Prérequis : [Node.js](https://nodejs.org/) 18 ou plus.

```bash
git clone https://github.com/ThierryClm/Diagramme_Feux.git
cd Diagramme_Feux
npm install
npm run dev
```

L'application s'ouvre à `http://localhost:3000`.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (rechargement à chaud) |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Aperçu local du build de production |
| `npm test` | Lancer les tests (Vitest) |

## Exemple

Un projet d'exemple est fourni dans le dossier [`examples/`](examples/). Ouvrez l'application, puis utilisez **Fichier → Ouvrir un projet** et sélectionnez `examples/carrefour-exemple.json`.

## Architecture

Application React + Vite, état centralisé dans [`src/hooks/useTrafficLight.js`](src/hooks/useTrafficLight.js). Voir [`CLAUDE.md`](CLAUDE.md) pour les détails d'implémentation (structures de données, rendu du timeline, détection de conflits).

## Contribuer

Les contributions sont les bienvenues. Pour un bug ou une suggestion, ouvrez une [issue GitHub](https://github.com/ThierryClm/Diagramme_Feux/issues). Pour proposer un patch, forkez puis ouvrez une pull request.

Un rapport de diagnostic peut être généré depuis l'app (**À propos → Rapport de diagnostic**) et joint à une issue pour faciliter le débogage.

## Licence

Ce projet est distribué sous licence **GNU Affero General Public License v3.0 ou ultérieure** (AGPL-3.0-or-later). Voir le fichier [`LICENSE`](LICENSE) pour le texte complet.

En résumé :
- Vous pouvez utiliser, modifier et redistribuer le logiciel.
- Si vous distribuez une version modifiée (y compris en la rendant accessible sur un réseau), vous devez publier le code source correspondant sous la même licence.
- Aucune garantie n'est fournie.

© 2026 Thierry Colmon
