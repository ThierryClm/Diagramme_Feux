# Diagramme de Feux

![Aperçu de l'application : matrice des temps intervert à gauche, diagramme temporel d'un carrefour à 13 groupes au centre, conditions de micro-régulation en bas](docs/screenshots/diagramme-principal.png)

Solution open source pour la conception et l'optimisation de plans de feux tricolores, destinée aux traficiens et ingénieurs de la circulation.

L'application s'organise en **deux modules complémentaires** :

- **Diagramme de Feux** *(module principal)* — conception et analyse des plans de feux d'un carrefour : groupes, matrice intervert, diagramme temporel, micro-régulation, plans multiples.
- **Onde verte** *(module complémentaire)* — coordination espace-temps de plusieurs carrefours sur un axe routier, avec visualisation des bandes passantes. S'appuie sur les projets de carrefours préalablement créés dans le module principal.

Conçue pour être utilisée **localement**, sans serveur ni télémétrie : toutes les données restent dans le navigateur (localStorage) et sur votre poste.

## Fonctionnalités principales

### Module Diagramme de Feux

- Définition des groupes de feux (VL, TC, Cycliste, Piéton) avec durées vert/orange/rouge
- Matrice d'intervert avec détection automatique des conflits
- Diagramme temporel horizontal avec tête de lecture
- Plans de feux multiples (PF) gérés par onglets
- Table d'actions de micro-régulation par plan (escamotage, ouverture/fermeture anticipée, etc.)
- Import/export (JSON, CSV, Excel)
- Export PDF et PNG du diagramme

### Module Onde verte

- Coordination de plusieurs carrefours sur un axe routier
- Visualisation espace-temps avec bandes passantes (sens montant et descendant)
- Réglage interactif des décalages, vitesses et plans de feux
- Synchronisation bidirectionnelle avec les projets du module principal

### Transverse

- Thèmes (sombre, clair, haut contraste, ambre, daltonien, sépia, bleu nuit)
- Détachement de fenêtres (matrice, formulaire, données trafic, etc.) sur un second écran
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

## Comptes utilisateurs

L'application embarque un système de comptes optionnel à 3 niveaux de permissions (lecture seule, modification partielle, modification totale) avec mots de passe hachés en SHA-256.

**Important — ce que ce système est, et n'est pas :**

- **Ce que c'est** : une convention de travail pour organiser le partage d'un poste entre plusieurs utilisateurs (par exemple un PC partagé en agence). Empêche les manipulations involontaires (un visiteur en mode lecture ne peut pas accidentellement écraser un projet).
- **Ce que ce n'est pas** : une protection cryptographiquement forte. L'application étant 100 % côté navigateur, sans serveur, n'importe qui ayant accès au poste peut techniquement contourner les comptes (DevTools, modification du code livré, etc.). Le code source étant publié sous licence AGPL v3, le mécanisme est de toute façon visible publiquement.

**Sécurité réelle des fichiers projet** : à assurer au niveau du système d'exploitation et du réseau local — droits NTFS / ACL sur le partage réseau, comptes Windows / Active Directory, permissions de dossier sur le serveur de fichiers. C'est ce niveau qui décide qui peut lire, écrire ou supprimer les `.json` exportés par l'application.

## Questions fréquentes

Une [FAQ](FAQ.md) répond aux questions courantes (confidentialité des données, formats d'import/export, licence, partage de projets, etc.).

## Services & accompagnement

Pour les carrefours complexes, l'auteur peut assurer un accompagnement à la conception du diagramme, en tirant parti des capacités combinées de gestion par phase et par groupe de feux qu'offre l'outil.

Moyennant une contribution adaptée à la complexité du sujet, deux modes de prestation sont possibles : **assistance technique à la carte** ou **prise en charge complète du projet** à partir des données fournies par l'utilisateur.

*(Coordonnées de contact à venir.)*

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
