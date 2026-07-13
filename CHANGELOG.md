# Journal des versions

Toutes les évolutions notables de TraCflux sont consignées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet suit le [versionnage sémantique](VERSIONING.md).

---

## [1.0.0] — à paraître

**Première version publique.** Date fixée lors du `npm run release` de publication.

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

*L'historique détaillé antérieur à la première publication (plus de 500 commits
depuis décembre 2025) reste consultable dans l'historique git.*
