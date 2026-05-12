# Questions fréquentes

Cette FAQ répond aux questions courantes sur **TraCflux**. Si la réponse à votre question ne s'y trouve pas, ouvrez une [issue GitHub](https://github.com/ThierryClm/Diagramme_Feux/issues).

---

## À propos du projet

### Je voudrais améliorer le fonctionnement des carrefours à feu sur mon territoire, mais le sujet m'est totalement étranger. Cette application va-t-elle m'aider à traiter mon problème ?

Cette application est un **facilitateur de conception**, pas une boîte à outils clé en main. Elle rend visibles les interactions entre les contraintes de sécurité, la réglementation et le phasage d'un carrefour à feux, mais elle suppose une lecture initiée du sujet (cycles, temps interverts, types d'usagers, conflits).

Si ces notions vous sont étrangères, le chemin le plus pratique passe par votre bureau d'études ou votre traficien : invitez-le à utiliser l'outil. Il pourra concevoir vos plans de feux et vous restituer des diagrammes lisibles (exportables en PDF), supports clairs pour vos comités, vos décisions d'investissement ou vos échanges avec un exploitant.

Dans tous les cas, l'application donne à voir ce qui se passe « sous le capot » d'un carrefour à feux et facilite la compréhension des choix de réglage avec votre interlocuteur technique.

### Comment optimiser la collaboration avec mes partenaires autour de l'outil ?

Le principal levier est l'**interopérabilité**. Encouragez l'ensemble de vos partenaires — bureau d'études, exploitant, équipementier, services techniques d'autres collectivités — à adopter l'application. Vous disposerez alors d'un **format d'échange unique** (`.json`) et d'un **langage visuel partagé** (le diagramme), indépendants des outils propriétaires de chacun.

Concrètement, cette interopérabilité permet de :

- **échanger des projets** `.json` plutôt que des livrables figés — chaque partenaire les ouvre, les modifie ou les commente depuis son poste, sans dépendre d'une suite logicielle particulière ;
- **itérer rapidement** sur les variantes de phasage ou de cycle, en vérifiant en direct l'absence de conflits ;
- **préparer les arbitrages** avant les comités techniques : les diagrammes deviennent des supports de décision plutôt que des livrables intermédiaires ;
- **garantir la continuité** de l'information entre acteurs et tout au long de la vie du projet (conception, validation, exploitation, mise à jour).

L'application étant gratuite et libre, son adoption par vos partenaires n'a aucune barrière économique ou contractuelle.

### J'utilise déjà un autre outil qui ne me satisfait pas pleinement, mais je ne souhaite pas ressaisir l'intégralité de mes plans de feux. Comment migrer mes données existantes ?

L'import natif est aujourd'hui limité (Excel partiel, HTM, JSON pour le format propre à l'application). Les imports des formats propriétaires ([redacted], Traffy, Swarco, Fareco, SEA, lecture de boîtes noires...) sont identifiés comme pistes d'évolution mais ne sont pas encore opérationnels — voir [Quelles fonctionnalités sont envisageables à terme ?](#quelles-fonctionnalités-sont-envisageables-à-terme-).

L'application étant **libre et open source**, l'ajout d'un parseur pour un format donné reste tout à fait envisageable :

- **Faites remonter le besoin :** ouvrez une [issue GitHub](https://github.com/ThierryClm/Diagramme_Feux/issues) en précisant l'outil source, le format de sortie et un exemple de fichier (anonymisé si nécessaire). Plus le besoin est partagé, plus l'effort de développement peut être priorisé.
- **Contribuez ou faites contribuer :** un développeur tiers peut proposer un parseur via une *pull request*. Le format `.json` natif sert de structure cible.

**En pratique, en attendant qu'un parseur existe :** l'approche pragmatique consiste à démarrer par **un ou deux carrefours pilotes** que vous ressaisissez intégralement. Cela vous permet de valider concrètement l'apport de l'outil sur votre activité avant d'engager une migration plus large. Une fois la valeur ajoutée confirmée, vous pouvez soit demander le développement d'un parseur (issue GitHub avec un échantillon de votre format), soit organiser la ressaisie progressive du parc.

### À qui s'adresse cet outil ?

Aux **traficiens, ingénieurs trafic, bureaux d'études et techniciens de collectivité** qui conçoivent ou analysent des plans de feux tricolores. Aussi utile aux étudiants en génie urbain ou exploitation routière qui apprennent à dimensionner des diagrammes de feux.

### De quels modules est composée l'application ?

L'application est une **solution organisée en deux modules complémentaires** :

- **Diagramme de Feux** *(module principal)* — fenêtre par défaut au lancement. Vous y concevez et analysez les plans de feux d'un carrefour : groupes, matrice intervert, diagramme temporel, micro-régulation, plans multiples, simulation, etc. Ce module fonctionne **en autonomie**.
- **Onde verte** *(module complémentaire)* — fenêtre dédiée, accessible depuis le menu **Onde verte** du module principal. Permet de coordonner plusieurs carrefours sur un axe routier (visualisation espace-temps, bandes passantes, ondes vertes montante/descendante). Ce module **s'appuie obligatoirement** sur des projets de carrefours préalablement créés et sauvegardés dans le module principal — il ne peut pas être utilisé seul.

Les deux modules partagent les mêmes données (stockage local, thèmes, paramètres) et bénéficient du même format `.json` portable. Vous pouvez ouvrir plusieurs fenêtres en parallèle pour comparer ou jongler entre projets.

### Que peut-on faire avec ?

Définir des groupes de feux (VL, TC, Cycliste, Piéton), construire la matrice intervert, visualiser le diagramme temporel de chaque plan de feux, détecter automatiquement les conflits, simuler des actions (escamotage, ouverture anticipée, point de repos…), gérer plusieurs plans de feux par carrefour, calculer une onde verte, exporter en PDF/PNG/Excel.

### Quelles sont ses limites actuelles ?

L'application est conçue pour la **conception et l'optimisation** de plans de feux, pas pour piloter des installations réelles. Elle ne fait pas de simulation microscopique de trafic (type AIMSUN, VISSIM), ne se connecte pas à des contrôleurs sur le terrain, et ne gère qu'une coordination simple (onde verte) — pas de réseau multi-carrefours complet.

### Proposez-vous un accompagnement pour les carrefours complexes ?

Oui, c'est possible selon certaines conditions. Pour les carrefours complexes, l'auteur peut assurer un accompagnement à la conception du diagramme, en tirant parti des capacités combinées de gestion par phase et par groupe de feux qu'offre l'outil. Moyennant une contribution adaptée à la complexité du sujet, deux modes de prestation sont possibles : **assistance technique à la carte** ou **prise en charge complète du projet** à partir des données fournies par l'utilisateur. Voir la section [Services & accompagnement](README.md#services--accompagnement) du README.

### Quelles fonctionnalités sont envisageables à terme ?

Plusieurs options apparaissent grisées dans le menu Fichier — elles correspondent à des pistes d'évolution non encore opérationnelles :

- **Lire une boîte noire (.bn)** — exploitation des enregistrements bruts de contrôleurs (durées de vert, états système, détections ITTN) pour analyser un comportement réel sur une heure d'exploitation. Le décodage du format binaire reste à finaliser.
- **Import des programmations contrôleur** Traffy, Swarco, Fareco, SEA... — chaque constructeur utilise un format propriétaire qui demanderait un parseur dédié.
- **Import [redacted] ([redacted])** est partiellement disponible (cliquable) mais reste en cours de développement.
- **Import Excel** dépend du modèle de fichier Excel (mises en page variables d'un éditeur à l'autre, structures de feuilles différentes selon les agences) — non généralisé dans cette version. L'export Excel reste opérationnel.

Ces fonctionnalités seront travaillées si le besoin est confirmé par plusieurs utilisateurs.

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

### Comment l'application se met-elle à jour ?

Aucune action n'est requise de votre part. L'application est conçue comme une **PWA** (Progressive Web App) : elle se met à jour automatiquement à la prochaine ouverture après chaque nouvelle publication.

Concrètement :

- Une nouvelle version est détectée en arrière-plan, sans interruption ni notification.
- Elle est téléchargée pendant que vous continuez à travailler.
- À la prochaine ouverture (ou au prochain rafraîchissement), la nouvelle version est activée silencieusement.

Vous n'avez **ni à réinstaller**, **ni à vider de cache**, **ni à cliquer sur un bouton « Mettre à jour »**. C'est l'un des avantages du format PWA par rapport à un logiciel classique : la maintenance est entièrement transparente.

### Puis-je utiliser l'application en présentation devant un auditoire ?

Oui, l'application est conçue pour s'adapter à ce contexte. Détachez la fenêtre **Image du carrefour** depuis le menu **Mise en page → Détachements**, puis glissez la popup ainsi obtenue sur un second écran ou un vidéoprojecteur.

Pendant la simulation, cette popup s'anime en synchronisation avec votre fenêtre de travail : les flèches changent de couleur (vert / orange / rouge) seconde par seconde, en suivant le cycle du plan de feu courant et l'effet des actions de micro-régulation activées.

**Le résultat pour l'auditoire** : un visuel épuré et lisible, focalisé sur l'essentiel — le carrefour qui « vit » au rythme du cycle.

**Pour vous, présentateur** : vous gardez sur votre écran de travail le contrôle complet (diagramme, matrice, panneau de simulation, tableau d'actions), ce qui vous permet de commenter en direct les actions de micro-régulation que vous activez (escamotage, ouverture anticipée, seconde lucarne, etc.) et d'observer immédiatement leur effet sur la dynamique du carrefour projetée à l'écran.

C'est particulièrement adapté aux comités techniques, formations internes, validations devant un client ou aux échanges pédagogiques avec des élus.

### Quels formats d'import/export sont supportés ?

| Format | Import | Export |
|---|---|---|
| JSON (format natif) | ✓ | ✓ |
| Excel `.xlsx` | (envisageable selon modèle) | ✓ |
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
