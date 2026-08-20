# Journal des versions

Toutes les évolutions notables de TraCflux sont consignées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet suit le [versionnage sémantique](VERSIONING.md).

---

## [1.2.0] — 2026-08-20

### Ajouté

- **Masquage des noms dans le rapport de diagnostic**, actif par défaut. Un rapport est
  destiné à être joint à une issue publique ; les noms de projet, de carrefour et de plan
  de feux désignent une commune et des rues réelles, et n'ont aucune valeur de débogage.
  Une case permet de les rétablir pour un échange privé.
- **Réserve affichée avant tout import DiagFeux**, y compris sur une application vide —
  la confirmation n'apparaissait jusqu'ici que si un projet était déjà ouvert, c'est-à-dire
  jamais dans le cas où l'on vient précisément essayer un fichier `.dfe`.

### Corrigé

- **La capacité utilisée divergeait du degré de saturation** : le V.Utile était arrondi à
  la seconde entière avant de servir au calcul du pourcentage, si bien que le tableau
  Trafic et le panneau Réserve de capacité annonçaient des réserves différentes pour le
  même courant — 18 % contre 17 % sur le projet exemple. L'arrondi ne concerne plus que
  l'affichage.
- **Port de l'aperçu figé** (`strictPort`) : Vite basculait silencieusement sur un autre
  port quand 4173 était occupé, et la page d'attente des lanceurs se connectait alors au
  build précédent.

### Modifié

- **En-têtes des tableaux de capacité** : *Retard unif.* et *File max* côté Trafic,
  *Attente moy.* et *File moy.* côté Réserve de capacité. Les deux panneaux calculent des
  grandeurs différentes — terme uniforme de Webster contre attente moyenne, file maximale
  contre file moyenne — ce que les anciens intitulés ne disaient pas.
- La ligne de synthèse du tableau Trafic devient **« Synthèse trafic »**, et la colonne
  du trafic **« Trafic UVP »**.
- **Glossaire de l'aide** revu : entrée *Aiguillage de phase* ajoutée, définitions de
  l'adaptatif vertical, de l'escamotage de phase, de l'instant CO, du point de repos et de
  la priorité piétons reprises ; les bandes passantes ne sont plus présentées comme des
  actions de micro-régulation mais comme des repères de tracé.
- **Importateur DiagFeux** annoncé pour ce qu'il est : en cours de développement, jamais
  confronté à un fichier réel.

---

## [1.1.0] — 2026-08-19

Première série publique, centrée sur l'accès à l'outil.

### Ajouté

- **Déploiement continu sur GitHub Pages** : l'application est en ligne et se met à jour à
  chaque publication.
- **Balises de partage** sur la page de l'application : un lien relayé dans une messagerie
  ou un fil de discussion s'affiche désormais avec titre, description et visuel.

### Modifié

- **Les comptes utilisateurs deviennent facultatifs**, désactivés par défaut. On entre
  directement dans l'application ; le dispositif s'active depuis *À propos → Utilisateurs*
  pour les postes partagés. Un poste ayant déjà créé des comptes les conserve.
- **Un projet exemple s'ouvre sans créer de compte** — le lien de découverte mène
  directement au carrefour.
- README réorganisé autour de l'usage : section *Essayer TraCflux* en tête, chapitre
  *Développement* pour le montage d'un poste.

### Corrigé

- **Le menu s'ouvrait et se refermait au premier clic** : le survol et le clic se
  disputaient le même geste, et le menu Fichier restait ouvert indéfiniment après le
  chargement d'un projet.
- **Les noms des groupes n'apparaissaient pas** dans la fenêtre carrefour détachée.
- **Fond de plan du projet exemple** remplacé par le tracé au trait, plus lisible en
  présentation.

---

## [1.0.0] — 2026-08-18

**Première version publique.** Passage du dépôt en public et première mise en ligne de
l'application sur GitHub Pages.

TraCflux est né fin 2025 d'un besoin de terrain : concevoir des plans de feux
sans être enfermé dans le modèle **strictement par phases** des outils existants.
Il combine **gestion par phases et gestion par groupes de feux** — le phasage
reste disponible, mais chaque groupe demeure **indépendant**. C'est cette
combinaison qui permet d'exprimer directement les chevauchements partiels, la
micro-régulation fine, la coordination sur un axe et le diagnostic de capacité
courant par courant.

### Module Diagramme de feux

- Groupes de feux (VL, TC, cycliste, piéton) avec durées vert / orange / rouge et décalages.
- **Matrice des temps d'intervert** avec détection automatique des conflits.
- **Diagramme temporel** horizontal, tête de lecture, édition directe des verts à la souris.
- **Multiprogrammation** : plusieurs plans de feux (PF) par carrefour, gérés par onglets — chacun avec son cycle, ses verts, ses décalages, sa matrice et sa micro-régulation.
- **Micro-régulation** : escamotage de phase, ouverture / fermeture anticipée, seconde lucarne, point de repos, adaptatif, synchro BTS, priorité bus, variables et conditions.
- **Simulation** du cycle avec lecture animée, et **phasage bulle**.
- **Image du carrefour** (photo aérienne, plan CAO ou schéma) avec flèches animées par groupe, suivant le cycle seconde par seconde.

### Module Onde verte

- Coordination espace-temps de plusieurs carrefours sur un axe.
- Visualisation des **bandes passantes** dans les deux sens.
- Réglage interactif des décalages, vitesses et plans de feux.
- Synchronisation depuis les projets du module principal.

### Capacité et diagnostic

- **Réserve de capacité** (panneau détachable) : capacité offerte, degré de saturation, réserve, temps d'attente moyen (Webster) et file d'attente, courant par courant.
- Synthèse « diagnostic carrefour » : courant dimensionnant et réserve globale.
- **Comparateur de capacité** entre plans de feux.
- Méthode conforme au *Guide des carrefours à feux* (débit de saturation 1800 uvp/h par voie, Webster).

### Interopérabilité

- **Import de projets DiagFeux (`.dfe`)** — logiciel du CERTU/Cerema, aujourd'hui abandonné. Reprend le plan de feux logique (groupes, décalages, verts, interverts, propriétés) en convertissant le phasage vers le modèle à groupes indépendants. Permet aux bureaux d'études et collectivités de récupérer leurs anciennes études plutôt que de les ressaisir.
  *Fonctionnalité **en cours de finalisation** : construite sur le schéma XML officiel et la documentation du format, sa validation sur des fichiers `.dfe` réels reste à mener. La géométrie (branches, voies, fond de plan) n'est pas encore reprise.*
- Import Excel / CSV, export JSON, PDF et PNG, dossier d'impression complet.

### Ergonomie

- **Fenêtres détachables** sur un second écran ou un vidéoprojecteur : matrice, formulaire, propriétés, données trafic, conflits, réserve de capacité, conditions et variables de micro-régulation, remarques, image du carrefour, et **miroir du diagramme en lecture seule** — pensé pour les présentations en comité.
- 7 thèmes (sombre, clair, haut contraste, ambre, daltonien, sépia, bleu nuit).
- Application installable (PWA), fonctionne hors ligne, avec bandeau « nouvelle version disponible ».
- Infobulles réglables par section, comptes utilisateurs optionnels, rapport de diagnostic local.

### Confidentialité

- **Aucun serveur, aucune télémétrie.** Toutes les données restent dans le navigateur et sur le poste de l'utilisateur.

### Qualité

- 370 tests automatisés (Vitest), intégration continue GitHub Actions.

---

*L'historique détaillé antérieur à la première publication reste consultable
dans l'historique git.*
