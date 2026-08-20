<p align="center">
  <img src="docs/logo.svg" alt="Logo TraCflux" width="140" height="140">
</p>

# TraCflux

Solution open source pour la conception et l'optimisation de plans de feux tricolores, destinée aux traficiens et ingénieurs de la circulation.

### Module Diagramme de Feux

![Aperçu de l'application : matrice des temps intervert à gauche, diagramme temporel d'un carrefour à 13 groupes au centre, conditions de micro-régulation en bas](docs/screenshots/diagramme-principal.png)

### Module Onde verte

![Aperçu du module Onde verte : diagramme espace-temps de 5 carrefours coordonnés sur un axe, avec bandes passantes en sens montant et descendant et tableau des données saisies](docs/screenshots/Onde-verte.png)

TraCflux s'organise en **deux modules complémentaires** :

- **Diagramme de Feux** *(module principal)* — conception et analyse des plans de feux d'un carrefour : groupes, matrice intervert, diagramme temporel, micro-régulation, multiprogrammation (plans de feux multiples).
- **Onde verte** *(module complémentaire)* — coordination espace-temps de plusieurs carrefours sur un axe routier, avec visualisation des bandes passantes. S'appuie sur les projets de carrefours préalablement créés dans le module principal.

Conçue pour être utilisée **localement**, sans serveur ni télémétrie : toutes les données restent dans le navigateur (localStorage) et sur votre poste.

## Essayer TraCflux

**[Ouvrir l'application](https://thierryclm.github.io/Diagramme_Feux/?example=carrefour)** — un carrefour d'exemple s'ouvre directement, sans compte à créer et sans rien installer.

Pour l'avoir sous la main : le bouton **« Installer cette app »** de la barre d'adresse (Chrome ou Edge) en fait un raccourci sur le bureau, et l'application fonctionne ensuite hors connexion.

## Pourquoi TraCflux

### Un outil pérenne, sans installation

TraCflux s'exécute **dans le navigateur**. Ce choix engage directement sa **longévité** : aucune dépendance à une version de système d'exploitation, aucune bibliothèque système à maintenir, aucun composant propriétaire. Il fonctionne sur n'importe quel poste et n'importe quel système — Windows, macOS, Linux — et continuera de le faire.

Deux verrous en découlent, levés d'un coup :

- **Déploiement** — rien à installer, donc rien à faire valider par une DSI : on ouvre une page. L'application est par ailleurs **installable (PWA)** et fonctionne **hors ligne**.
- **Confidentialité** — tout s'exécute **en local, sans serveur ni télémétrie** : les données ne quittent jamais le poste.

L'**import des formats existants** procède du même principe : un plan de feux doit pouvoir **survivre à l'outil qui l'a créé**.

### Un modèle qui combine phases et groupes de feux

Les outils historiques de conception de plans de feux reposent généralement sur une **organisation par phases** : les feux d'une même phase s'ouvrent et se ferment ensemble. C'est simple et lisible pour l'usager, mais cela contraint le concepteur sur l'enchainement des groupes de feux.

TraCflux repose sur un **modèle qui combine gestion par phases et gestion par groupes de feux**. Le phasage reste disponible — pour raisonner comme pour agir (escamotage de phase, phasage bulle) — mais **chaque groupe de feux demeure indépendant** : il n'est pas verrouillé dans une phase, et conserve ses propres instants d'ouverture et de fermeture.

C'est cette combinaison qui permet d'exprimer directement les **chevauchements partiels**, la **micro-régulation fine** (escamotage, seconde lucarne, fermeture anticipée…), la **coordination sur un axe** et le **diagnostic de capacité courant par courant** — là où un modèle strictement par phases les rend malaisés, voire impossibles à décrire.

### Priorité bus

La prise en compte des transports en commun est pensée comme une **orientation de fond** de TraCflux : les variables et actions de micro-régulation propres à la priorité bus (délai d'approche, temps maxi d'attente bus, allongement de vert, escamotage de phase, point de repos…) sont intégrées au cœur de l'outil. L'objectif est de rendre une stratégie de priorité **explicite, visualisable et vérifiable** — sans boîte noire, hors ligne et interopérable — tout en laissant la décision d'ingénierie à l'utilisateur. TraCflux ne décide pas du niveau de priorité accordé : il en offre le langage et la lecture, en préservant les contraintes de sécurité et la cohérence du plan de feux.

### Reprendre les études DiagFeux

> ⚠️ **Fonctionnalité en cours de développement.** L'importateur est construit à partir du schéma XML officiel et de la documentation de DiagFeux, et testé sur des jeux d'essai construits pour cela. Il **n'a pas encore été confronté à un fichier `.dfe` réel**. Si vous disposez d'un projet DiagFeux (même anonymisé) que vous pouvez partager, [ouvrez une issue](https://github.com/ThierryClm/Diagramme_Feux/issues) — cela accélérera directement la mise au point.

**DiagFeux**, le logiciel de conception de diagrammes de feux du CERTU (aujourd'hui Cerema), **n'est plus maintenu**. TraCflux permet d'importer ses projets (`.dfe`) — groupes, décalages, verts, matrice d'interverts, propriétés.

Les bureaux d'études et collectivités disposant d'anciennes études DiagFeux peuvent ainsi **les reprendre plutôt que de les ressaisir** : **Fichier → Importer → Projet DiagFeux (.dfe)**.

La méthode de calcul reste celle du *Guide des carrefours à feux* du CERTU (débit de saturation 1800 uvp/h par voie, méthode de Webster), commune aux deux outils.

## Mode présentation

L'application est conçue pour s'adapter aux contextes de **présentation devant un auditoire** — comités techniques, formations internes, validations devant un client ou échanges pédagogiques avec des élus.

En réunion comme en visio, détachez la fenêtre **Image du carrefour** : c'est elle seule que vous partagez ou posez sur un second écran. Pendant la simulation, les flèches changent de couleur (vert / orange / rouge) seconde par seconde, en suivant le cycle et l'effet des actions de micro-régulation activées.

L'auditoire ne voit que l'essentiel — le carrefour qui « vit » au rythme du cycle — pendant que vous gardez le contrôle complet sur votre écran de travail (diagramme, matrice, panneau de simulation, micro-régulation) et commentez en direct les actions que vous activez et leur effet sur la dynamique du carrefour.

## Fonctionnalités principales

### Module Diagramme de Feux

- Définition des groupes de feux (VL, TC, Cycliste, Piéton) avec durées vert/orange/rouge
- Matrice d'intervert avec détection automatique des conflits
- Diagramme temporel horizontal avec tête de lecture
- **Multiprogrammation** — plans de feux multiples (PF) gérés par onglets : un même carrefour décliné en plusieurs programmes (pointe du matin, pointe du soir, heure creuse, nuit, événementiel…), chacun avec son cycle, ses durées de vert, ses offsets, sa matrice intervert et sa micro-régulation propres
- Table d'actions de micro-régulation par plan (escamotage, ouverture/fermeture anticipée, etc.)
- Fond de plan personnalisable (photo aérienne, plan CAO, schéma au trait) avec flèches d'animation des groupes — optimisé automatiquement à l'import (redimensionnement + WebP) pour alléger le projet

### Capacité et diagnostic

- **Réserve de capacité** — panneau détachable : capacité offerte (uvp/h), degré de saturation, réserve, **temps d'attente moyen (Webster)** et file d'attente, courant par courant
- Synthèse « diagnostic carrefour » : courant dimensionnant et réserve globale
- **Comparateur de capacité** entre plans de feux
- Méthode conforme au *Guide des carrefours à feux* (débit de saturation 1800 uvp/h par voie)

### Interopérabilité

- **Import de projets DiagFeux (`.dfe`)** *(en cours de développement)* — reprise des études réalisées avec le logiciel du CERTU/Cerema (voir [Reprendre les études DiagFeux](#reprendre-les-études-diagfeux))
- Import Excel / CSV, export JSON
- Export PDF et PNG du diagramme, dossier d'impression complet

### Module Onde verte

- Coordination de plusieurs carrefours sur un axe routier
- Visualisation espace-temps avec bandes passantes (sens montant et descendant)
- Réglage interactif des décalages, vitesses et plans de feux
- Synchronisation unidirectionnelle : rafraîchissement des données depuis les projets du module principal vers l'onde verte

### Transverse

- Thèmes (sombre, clair, haut contraste, ambre, daltonien, sépia, bleu nuit)
- **Détachement de fenêtres** — à partager en visio ou à poser sur un second écran : matrice, formulaire, propriétés, données trafic, conflits, réserve de capacité, conditions et variables de micro-régulation, remarques, image du carrefour, et **miroir du diagramme en lecture seule**
- Application installable (PWA), fonctionne hors ligne, avec bandeau « nouvelle version disponible »
- Rapport de diagnostic pour signalement de bug (local, sans envoi réseau)

## Développement

Pour travailler sur le code. L'usage courant ne demande rien de tout cela — voir [Essayer TraCflux](#essayer-tracflux).

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
| `npm run clean` | Nettoyage local : supprime `dist/` et arrête les processus `node.exe` (Windows — voir [Dépannage](#dépannage)) |
| `npm test` | Lancer les tests (Vitest) |
| `npm run test:ui` | Les mêmes tests dans l'interface graphique de Vitest |
| `npm run check` | Rapport de santé des dépendances : vulnérabilités et versions obsolètes, celles qui atteignent le navigateur étant séparées de celles confinées à la chaîne de compilation |
| `npm run release` | Incrémente la version, met à jour `src/version.js` et `package.json`, crée le commit et le tag (voir [VERSIONING.md](VERSIONING.md)) |

Le projet passant parfois plusieurs semaines sans modification, `npm run check` est la commande à lancer en reprenant : de nouvelles alertes de sécurité peuvent être apparues sans qu'une seule ligne de code ait bougé.

Les quelques fichiers `.vbs` à la racine sont des lanceurs Windows personnels — un double-clic enchaîne `npm run build` puis `npm run preview`. Ils ne sont nécessaires ni à l'usage de l'application, ni pour développer.

### Dépannage

Après plusieurs `npm run preview` consécutifs dans une même session de développement, deux désagréments peuvent apparaître :

- des processus `node.exe` s'accumulent en arrière-plan ;
- le service worker sert encore un build précédent : le bandeau **« Nouvelle version disponible »** s'affiche à chaque rebuild, ou les fenêtres détachées gardent l'ancien cache (thème ou contenu figé).

**Solution** :
1. `npm run clean` (supprime `dist/` et arrête tous les `node.exe`)
2. Fermer toutes les fenêtres du navigateur ouvertes sur `localhost:4173`
3. Optionnel : `edge://settings/cookies/detail?site=localhost%3A4173` → **Supprimer** (vide le service worker et le cache pour ce site uniquement)
4. Relancer normalement (`npm run preview` ou via le lanceur VBS)

Ces symptômes ne concernent **que le workflow développeur** (rebuilds successifs). Les utilisateurs finaux (PWA hébergée ou installation depuis une release) ne sont pas concernés : pour eux, le bandeau « Nouvelle version disponible » est le comportement **normal** de mise à jour (il n'apparaît qu'après un vrai déploiement).

## Exemple

Un projet d'exemple est fourni dans le dossier [`examples/`](examples/). Ouvrez l'application, puis utilisez **Fichier → Ouvrir un projet** et sélectionnez `examples/Carrefour_exemple.json`.

## Architecture

Application React + Vite, état centralisé dans [`src/hooks/useTrafficLight.js`](src/hooks/useTrafficLight.js). Voir [`CLAUDE.md`](CLAUDE.md) pour les détails d'implémentation (structures de données, rendu du timeline, détection de conflits).

## Comptes utilisateurs

L'application embarque un système de comptes à 3 niveaux de permissions (lecture seule, modification partielle, modification totale), avec mots de passe hachés en SHA-256.

**Il est désactivé par défaut** : à l'ouverture, on entre directement dans l'application, sans écran de connexion. Il s'adresse aux postes partagés et s'active depuis **À propos → Utilisateurs → Activer les comptes**. Une fois activé, l'application demande une connexion à chaque ouverture ; on peut le désactiver au même endroit, les comptes créés étant conservés.

**Important — ce que ce système est, et n'est pas :**

- **Ce que c'est** : une convention de travail pour organiser le partage d'un poste entre plusieurs utilisateurs (par exemple un PC partagé en agence). Empêche les manipulations involontaires (un visiteur en mode lecture ne peut pas accidentellement écraser un projet).
- **Ce que ce n'est pas** : une protection cryptographiquement forte. L'application étant 100 % côté navigateur, sans serveur, n'importe qui ayant accès au poste peut techniquement contourner les comptes (DevTools, modification du code livré, etc.). Le code source étant publié sous licence AGPL v3, le mécanisme est de toute façon visible publiquement.

**Sécurité réelle des fichiers projet** : à assurer au niveau du système d'exploitation et du réseau local — droits NTFS / ACL sur le partage réseau, comptes Windows / Active Directory, permissions de dossier sur le serveur de fichiers. C'est ce niveau qui décide qui peut lire, écrire ou supprimer les `.json` exportés par l'application.

## Sécurité et limites connues

### Import Excel — fichiers d'origine externe

La bibliothèque utilisée pour lire les fichiers Excel (`xlsx` / SheetJS, version `0.18.5`) comporte deux vulnérabilités connues, sans correctif diffusé sur le registre npm officiel :

- **Prototype Pollution** ([GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)) — CVSS 7.8
- **ReDoS** (Regular Expression Denial of Service, [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)) — CVSS 7.5

Les versions corrigées existent uniquement sur `cdn.sheetjs.com` (SheetJS a retiré son édition communautaire du registre npm en 2023).

**Recommandation utilisateur :** n'importer que des fichiers `.xls` / `.xlsx` d'**origine connue** (feuilles produites par vous ou par des collègues identifiés). Un fichier malveillant ouvert via l'import pourrait perturber l'onglet du navigateur.

**Note sur les macros :** la lecture se fait via une bibliothèque JavaScript côté navigateur, qui n'extrait que les **valeurs des cellules** et **n'exécute aucune macro (VBA)**. Le risque d'exécution de macro à l'ouverture (propre à Excel bureautique) n'existe pas ici. La vigilance porte donc sur l'**origine du fichier** (contenu potentiellement malformé), indépendamment de la présence ou non de macros.

**Évaluation du risque dans l'usage prévu :** faible. TraCflux est un outil **local mono-utilisateur** ; `xlsx` n'est sollicité qu'au moment où l'utilisateur sélectionne manuellement un fichier ([`src/utils/excelImporter.js`](src/utils/excelImporter.js)). Aucun risque pour le système d'exploitation, aucun risque pour les autres projets enregistrés. Seul vecteur résiduel : phishing ciblé.

**Décision actuelle :** statu quo tant que l'usage reste local. Une migration vers `xlsx-js-style`, `exceljs` ou la version corrigée hors-npm de SheetJS sera envisagée si l'app évolue vers un déploiement multi-utilisateurs.

## Questions fréquentes

Une [FAQ](FAQ.md) répond aux questions courantes (confidentialité des données, formats d'import/export, licence, partage de projets, etc.).

## Services & accompagnement

Un service d'accompagnement à la conception de diagrammes de feux est **envisagé pour une étape ultérieure** du projet. L'idée : proposer, pour les carrefours complexes, une aide tirant parti des capacités combinées de gestion par phase et par groupe de feux qu'offre l'outil.

Deux modes de prestation sont pressentis — **assistance technique à la carte** ou **prise en charge complète du projet** à partir des données fournies par l'utilisateur — mais **cette offre n'est pas encore opérationnelle**.

*(Les modalités et coordonnées de contact seront précisées lorsque le service sera disponible.)*

## Journal des versions

Les évolutions notables sont consignées dans le [CHANGELOG](CHANGELOG.md). Le projet suit le [versionnage sémantique](VERSIONING.md).

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
