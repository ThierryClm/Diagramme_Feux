# Questions fréquentes

Cette FAQ répond aux questions courantes sur **Diagramme de Feux**. Si la réponse à votre question ne s'y trouve pas, ouvrez une [issue GitHub](https://github.com/ThierryClm/Diagramme_Feux/issues).

---

## À propos du projet

### À qui s'adresse cet outil ?

Aux **traficiens, ingénieurs trafic, bureaux d'études et techniciens de collectivité** qui conçoivent ou analysent des plans de feux tricolores. Aussi utile aux étudiants en génie urbain ou exploitation routière qui apprennent à dimensionner des cycles.

### Que peut-on faire avec ?

Définir des groupes de feux (VL, TC, Cycliste, Piéton), construire la matrice intervert, visualiser le diagramme temporel de chaque plan de feux, détecter automatiquement les conflits, simuler des actions (escamotage, ouverture anticipée, point de repos…), gérer plusieurs plans de feux par carrefour, calculer une onde verte, exporter en PDF/PNG/Excel.

### Quelles sont ses limites actuelles ?

L'application est conçue pour la **conception et l'optimisation** de plans de feux, pas pour piloter des installations réelles. Elle ne fait pas de simulation microscopique de trafic (type AIMSUN, VISSIM), ne se connecte pas à des contrôleurs sur le terrain, et ne gère qu'une coordination simple (onde verte) — pas de réseau multi-carrefours complet.

### Quelles fonctionnalités sont envisageables à terme ?

Une option **« Lire une boîte noire (.bn) »** apparaît grisée dans le menu Fichier. Elle vise à exploiter les enregistrements bruts de contrôleurs de carrefour (durées de vert, états système, détections ITTN) pour aider à analyser un comportement réel sur une heure d'exploitation. Le décodage du format binaire reste à finaliser — fonctionnalité envisageable si le besoin est confirmé par plusieurs utilisateurs.

### Est-ce vraiment gratuit ?

Oui, totalement. Le code est publié sous licence libre [GNU AGPL v3](LICENSE) — vous pouvez l'utiliser, le modifier et le redistribuer sans frais ni condition d'usage personnel ou professionnel.

---

## Données et confidentialité

### Mes données sont-elles envoyées sur internet ?

**Non, jamais.** L'application fonctionne intégralement dans votre navigateur, sans serveur ni télémétrie. Aucune donnée de projet ne quitte votre poste — pas même un fichier de log d'erreur (le rapport de diagnostic est téléchargé en local, jamais transmis).

### Puis-je l'utiliser sans connexion internet ?

Oui. Une fois la page chargée, l'application fonctionne sans connexion. Vous pouvez la télécharger localement (zip livré dans les Releases) et l'utiliser indéfiniment hors-ligne.

### Où sont stockés mes projets ?

Les projets actifs sont conservés dans le **localStorage** du navigateur (≈ 5 Mo disponibles). Pour un stockage durable, exportez en `.json` via **Fichier → Sauvegarder le projet** — le fichier est enregistré sur votre disque ou dans un partage réseau de votre choix.

### Comment partager un projet avec un collègue ?

Exportez le projet en `.json` et transmettez le fichier (mail, partage réseau, clé USB). Votre collègue ouvre l'application puis charge le fichier via **Fichier → Ouvrir un projet**. Aucun compte ni service distant n'est nécessaire.

---

## Utilisation pratique

### Quels navigateurs et systèmes sont supportés ?

**Chrome, Firefox, Edge, Safari** dans une version récente (2 ans max). L'application étant une page web, elle fonctionne sur **Windows, macOS et Linux** indifféremment, ainsi qu'en environnement Citrix ou bureau distant.

### Quels formats d'import/export sont supportés ?

| Format | Import | Export |
|---|---|---|
| JSON (format natif) | ✓ | ✓ |
| Excel `.xlsx` | ✓ | ✓ |
| CSV | ✓ | — |
| HTM | ✓ | — |
| PDF (impression dossier) | — | ✓ |
| PNG (capture diagramme) | — | ✓ |

### Y a-t-il une limite au nombre de groupes ou de plans de feux ?

Pas de limite stricte. L'application a été testée avec une trentaine de groupes et plusieurs plans de feux par projet. Les performances restent fluides ; pour des intersections très complexes, surveillez l'usage du localStorage (un avertissement apparaît dans le rapport de diagnostic au-delà de 4 Mo).

### À quoi sert le mode simulation ?

À **tester l'effet d'actions** (escamotage, ouverture anticipée, point de repos, adaptatif vertical…) sur un cycle existant **sans modifier le projet original**. Vous cochez les actions que vous voulez activer, le diagramme se redessine en montrant le cycle simulé, et vous pouvez visualiser conflits et décalages. Désactiver les cases revient instantanément à l'état initial.

---

## Comptes et sécurité

### Faut-il créer un compte pour utiliser l'application ?

Non, c'est optionnel. Par défaut, l'application s'ouvre sans login. Le système de comptes intégré (3 niveaux : lecture, partiel, total) sert uniquement à organiser le partage d'un poste entre plusieurs utilisateurs.

### Comment protéger réellement mes fichiers projet ?

Les comptes intégrés sont une **convention de travail**, pas une protection cryptographique (voir [SECURITY.md](SECURITY.md)). Pour une vraie protection, utilisez les **droits du système d'exploitation** : ACL Windows / NTFS, comptes Active Directory, permissions sur les partages réseau ou serveurs de fichiers. C'est ce niveau qui décide qui peut lire, écrire ou supprimer les `.json`.

---

## Licence et conditions d'utilisation

### Pourquoi cette licence AGPL v3 ?

Pour garantir que **toute amélioration apportée au code reste accessible à tous**. Si quelqu'un fork ou héberge une version modifiée, il est tenu de publier son code source sous la même licence. Cela protège l'écosystème de la communauté traficiens contre les enclosures privatives.

### Puis-je l'utiliser dans ma collectivité ou mon entreprise ?

Oui, sans condition. La licence AGPL v3 autorise tout usage interne, public ou privé, gratuit ou facturé. Vous pouvez installer l'application sur autant de postes que nécessaire, sans déclaration à faire.

### Puis-je modifier le code pour mes besoins ?

Oui. Vous pouvez adapter le code à vos besoins internes sans rien publier. La seule contrainte AGPL est que **si vous distribuez votre version modifiée** (à des tiers, ou en l'hébergeant en SaaS pour des utilisateurs externes), vous devez publier le code source de cette version sous AGPL v3 elle aussi.

### Puis-je facturer du conseil basé sur cet outil ?

Oui, sans aucune restriction. La licence AGPL couvre le **logiciel**, pas les **services** que vous bâtissez autour : formation, paramétrage, audit de carrefour, accompagnement à la migration… restent libres et facturables comme bon vous semble.

---

## Bugs et contributions

### Comment signaler un bug ou demander une fonctionnalité ?

Ouvrez une [issue GitHub](https://github.com/ThierryClm/Diagramme_Feux/issues). Pour un bug, joignez le **rapport de diagnostic** (menu **À propos → Rapport de diagnostic**) qui contient le contexte technique nécessaire — sans aucune donnée envoyée sur le réseau, c'est vous qui le copiez ou le téléchargez.

### Comment contribuer au code ?

Voir [CONTRIBUTING.md](CONTRIBUTING.md). En résumé : forkez le repo, créez une branche, codez, ajoutez des tests, ouvrez une pull request. Toute contribution est acceptée sous la licence AGPL v3 du projet.
