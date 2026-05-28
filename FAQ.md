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

L'import natif est aujourd'hui limité (Excel partiel, HTM, JSON pour le format propre à l'application). L'**interopérabilité** avec d'autres systèmes de programmation de contrôleurs de carrefour — propriétaires ou ouverts — est identifiée comme un axe d'évolution majeur de l'outil, mais n'est pas encore opérationnelle — voir [Quelles fonctionnalités sont envisageables à terme ?](#quelles-fonctionnalités-sont-envisageables-à-terme-).

L'application étant **libre et open source**, l'ajout d'un parseur pour un format donné reste tout à fait envisageable :

- **Faites remonter le besoin :** ouvrez une [issue GitHub](https://github.com/ThierryClm/Diagramme_Feux/issues) en précisant l'outil source, le format de sortie et un exemple de fichier (anonymisé si nécessaire). Plus le besoin est partagé, plus l'effort de développement peut être priorisé.
- **Contribuez ou faites contribuer :** un développeur tiers peut proposer un parseur via une *pull request*. Le format `.json` natif sert de structure cible.

**En pratique, en attendant qu'un parseur existe :** l'approche pragmatique consiste à démarrer par **un ou deux carrefours pilotes** que vous ressaisissez intégralement. Cela vous permet de valider concrètement l'apport de l'outil sur votre activité avant d'engager une migration plus large. Une fois la valeur ajoutée confirmée, vous pouvez soit demander le développement d'un parseur (issue GitHub avec un échantillon de votre format), soit organiser la ressaisie progressive du parc.

### Puis-je importer mes carrefours depuis un fichier Excel ?

Oui, mais avec une réserve importante : l'import Excel intégré à TraCflux est conçu pour **une structure de fichier précise** — celle utilisée historiquement par l'auteur pour ses propres projets. Il n'est pas exploitable tel quel sur des fichiers Excel issus d'autres pratiques, chaque organisation ayant ses propres conventions de feuilles, de colonnes et de nommage.

Un **import sur mesure reste possible**, à condition de réaliser un **développement spécifique** fondé sur la connaissance exacte de la structure du fichier source. Cette piste devient pertinente lors d'un **basculement de parc** vers TraCflux, lorsque le volume de projets à reprendre rend la ressaisie manuelle peu réaliste.

Si vous êtes dans cette situation, le canal recommandé est le dépôt GitHub du projet : ouvrez une [issue](https://github.com/ThierryClm/Diagramme_Feux/issues) décrivant le besoin (volume de projets concernés, exemple de fichier anonymisé, format de vos feuilles) afin qu'un développement *open source* puisse être discuté ou contribué. Le format `.json` natif de TraCflux sert de structure cible — la valeur ajoutée d'un parseur consiste uniquement à bien lire votre format Excel source.

### L'import Excel est-il sûr ?

**N'importer que des fichiers `.xlsx` d'origine connue** (vos propres feuilles, ou celles de collègues identifiés). La bibliothèque utilisée pour lire les fichiers Excel (`xlsx` / SheetJS) contient deux vulnérabilités connues — *prototype pollution* et *déni de service par expression régulière* — sans correctif diffusé sur le registre npm officiel. Un fichier `.xlsx` malveillant, ouvert via l'import, pourrait perturber l'onglet du navigateur.

Dans l'usage normal de TraCflux (outil local, mono-utilisateur, fichiers produits par vous), le risque est faible : il faudrait qu'un attaquant vous transmette spécifiquement un fichier piégé (phishing). Aucun risque pour le système d'exploitation ni pour les autres projets enregistrés. La situation est documentée et acceptée en l'état tant que l'usage reste local — voir le [README](README.md#sécurité-et-limites-connues) pour le détail.

### À qui s'adresse cet outil ?

Aux **traficiens, ingénieurs trafic, bureaux d'études et techniciens de collectivité** qui conçoivent ou analysent des plans de feux tricolores. Aussi utile aux étudiants en génie urbain ou exploitation routière qui apprennent à dimensionner des diagrammes de feux.

### L'application est-elle adaptée à mon niveau d'expertise ?

Elle s'adresse à deux profils, qui y trouvent des bénéfices différents :

- **Praticien expérimenté en régulation** — l'application joue le rôle d'**outil de vérification et d'aide à l'analyse** : la détection automatique des conflits, l'écart visuel des matrices entre plans de feux, l'identification des recouvrements et asymétries vous évitent des erreurs qu'aucun œil ne tient durablement sur un parc de plusieurs dizaines de carrefours. Vous gardez la main sur les choix de conception ; l'application sécurise leur cohérence.

- **Profil moins aguerri ou usage ponctuel** — l'application joue le rôle de **support guidé** : la matrice et les champs sont documentés par infobulles, le diagramme rend visibles les enchaînements, et un projet exemple permet d'explorer un cas concret avant de saisir le vôtre. Vous progressez en construisant, sans avoir besoin de maîtriser toute la terminologie d'emblée.

Dans les deux cas, la plus-value est la même : **rendre visible ce qu'un raisonnement mental ne tient plus à grande échelle** — conflits, écarts entre PF, ruptures de symétrie. C'est précisément là où l'erreur se loge le plus souvent.

### De quels modules est composée l'application ?

L'application est une **solution organisée en deux modules complémentaires** :

- **Diagramme de Feux** *(module principal)* — fenêtre par défaut au lancement. Vous y concevez et analysez les plans de feux d'un carrefour : groupes, matrice intervert, diagramme temporel, micro-régulation, plans multiples, simulation, etc. Ce module fonctionne **en autonomie**.
- **Onde verte** *(module complémentaire)* — fenêtre dédiée, accessible depuis le menu **Onde verte** du module principal. Permet de coordonner plusieurs carrefours sur un axe routier (visualisation espace-temps, bandes passantes, ondes vertes montante/descendante). Ce module **s'appuie obligatoirement** sur des projets de carrefours préalablement créés et sauvegardés dans le module principal — il ne peut pas être utilisé seul.

Les deux modules partagent les mêmes données (stockage local, thèmes, paramètres) et bénéficient du même format `.json` portable. Vous pouvez ouvrir plusieurs fenêtres en parallèle pour comparer ou jongler entre projets.

### Que peut-on faire avec ?

Définir des groupes de feux (VL, TC, Cycliste, Piéton), construire la matrice intervert, visualiser le diagramme temporel de chaque plan de feux, détecter automatiquement les conflits, simuler des actions (escamotage, ouverture anticipée, point de repos…), gérer plusieurs plans de feux par carrefour, calculer une onde verte, exporter en PDF/PNG/Excel.

### Quels sont les pièges classiques que l'application aide à éviter ?

Quelques situations que l'application **détecte ou rend visible immédiatement**, et qui passent souvent inaperçues à la lecture ou au calcul manuel :

- **Intervert insuffisant masqué par un offset** — un délai de dégagement requis dans la matrice se retrouve plus court dans le diagramme à cause d'un offset ajusté ailleurs. La case bascule en fond rouge ; l'infobulle au survol donne la valeur réelle vs la valeur requise.
- **Matrice asymétrique non détectée** — une valeur posée pour GF*x* → GF*y* sans contrepartie GF*y* → GF*x* (ou inversement). La case manquante est signalée en fond orange, et la liste des paires asymétriques s'affiche sous la matrice.
- **Écart involontaire entre un PF et le plan de référence** — en passant de PF1 à un autre plan, une valeur de matrice modifiée par mégarde se voit aussitôt (texte rouge ou vert selon le sens de la variation, infobulle qui précise « Augmentée / Réduite de X s vs PF de base »).
- **Recouvrement de verts** entre deux groupes conflictuels — impossible à voir d'un coup d'œil sur un diagramme dense ; l'application le repère et le décrit (« Conflit : les verts de GF*x* et GF*y* se recouvrent »).
- **Conflit de seconde lucarne** avec le vert principal d'un autre groupe — la liste apparaît automatiquement sous la matrice.

Ces vérifications ne remplacent pas le jugement du concepteur — elles libèrent du temps de raisonnement en éliminant les erreurs mécaniques, pour se concentrer sur les choix qui méritent réflexion.

### Quelles sont ses limites actuelles ?

L'application est conçue pour la **conception et l'optimisation** de plans de feux, pas pour piloter des installations réelles. Elle ne fait pas de simulation microscopique de trafic (type AIMSUN, VISSIM), ne se connecte pas à des contrôleurs sur le terrain, et ne gère qu'une coordination simple (onde verte) — pas de réseau multi-carrefours complet.

### Proposez-vous un accompagnement pour les carrefours complexes ?

Un service d'accompagnement est **envisagé pour une étape ultérieure** du projet, mais **n'est pas encore opérationnel**. L'idée : proposer, pour les carrefours complexes, une aide à la conception du diagramme tirant parti des capacités combinées de gestion par phase et par groupe de feux qu'offre l'outil. Deux modes de prestation sont pressentis — **assistance technique à la carte** ou **prise en charge complète du projet** à partir des données fournies par l'utilisateur — dont les modalités et le contact seront précisés lorsque le service sera disponible. Voir la section [Services & accompagnement](README.md#services--accompagnement) du README.

### Quelles fonctionnalités sont envisageables à terme ?

Plusieurs options apparaissent grisées dans le menu Fichier — elles correspondent à des pistes d'évolution non encore opérationnelles :

- **Interopérabilité** — échange de données de programmation de carrefours à feux avec d'autres systèmes du marché, propriétaires ou ouverts. C'est un axe d'ouverture important de l'outil : permettre la reprise et la restitution de plans de feux sans ressaisie, en s'intégrant à l'écosystème existant des traficiens. Le potentiel est significatif et constitue une direction d'évolution privilégiée.
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

### Je débute sur le sujet et le nombre de paramètres à saisir m'impressionne — comment être guidé pendant la saisie ?

Chaque champ du formulaire, de la matrice et du tableau des conditions de micro-régulation est documenté par une **infobulle** qui s'affiche au survol et explique ce qu'il attend (signification, format, ordre de grandeur typique). Cela vous permet de vous familiariser progressivement avec l'outil, sans devoir tout retenir d'emblée.

Une fois à l'aise avec une partie de l'interface, vous pouvez **désactiver les infobulles section par section** (Page principale, Configuration, Diagramme, Matrice, Trafic, Conditions de micro-régulation) depuis le menu **Mise en page → Infobulles...** : l'interface s'épure à mesure que votre maîtrise progresse. Préférence enregistrée au niveau de l'application.

En complément, l'écran d'accueil propose **« Découvrir avec un projet exemple »** : un carrefour déjà renseigné, librement modifiable et non enregistrable — idéal pour comprendre concrètement à quoi servent les différents champs sans risque d'abîmer votre propre travail.

### Comment découvrir l'application sans saisir un projet de zéro ?

Deux projets exemple anonymisés sont fournis. Au lancement, sur l'écran d'accueil, cliquez sur **« Découvrir avec un projet exemple »** (module Diagramme) ou **« Découvrir avec une onde verte exemple »** (module Onde verte) : l'exemple s'ouvre dans une **nouvelle fenêtre**, sans toucher à un éventuel travail en cours. Il est librement modifiable pour explorer, mais **non enregistrable** — pour démarrer votre propre projet, faites **Fichier → Nouveau projet**.

Vous pouvez aussi télécharger les fichiers directement pour les ouvrir via **Fichier → Ouvrir** : [Carrefour_Exemple.json](public/Carrefour_Exemple.json) (carrefour) et [Onde verte_Exemple.json](public/Onde%20verte_Exemple.json) (onde verte).

### Par où commencer sur un nouveau carrefour ?

L'application est structurée pour suivre une démarche progressive — voici une séquence qui fonctionne bien :

1. **Décrire les groupes de feux** dans le formulaire (onglet *Configuration*) : nom, type (véhicules, piéton, cycle, anticipation…), durée de vert minimale. Vous posez ainsi ce qui circule dans le carrefour.
2. **Renseigner la matrice des temps interverts** : les temps de dégagement requis entre groupes conflictuels. Une matrice non symétrique ou des cases manquantes sont signalées (fond orange).
3. **Construire le PF1**, le plan de feux de référence (fonctionnement nominal en heure creuse, par exemple) : ajustez offsets et durées de vert dans le diagramme. L'application contrôle en temps réel que les interverts sont respectés (fond rouge en cas de conflit).
4. **Vérifier les conflits restants** : la liste sous la matrice indique les paires en violation. Au survol d'une case rouge, une infobulle décrit le problème (recouvrement de verts ou délai insuffisant).
5. **Décliner les autres PF** (HPM, HPS, HC, HN, variantes priorité bus…) à partir de PF1 : les différences sont colorées (rouge = augmenté, vert = réduit) et explicitées par infobulle au survol — ce qui rend immédiatement visible ce qui change d'un plan à l'autre.
6. **Affiner** : conditions de micro-régulation, données trafic, onde verte si plusieurs carrefours sont coordonnés.

Vous pouvez à tout moment ouvrir le **projet exemple** depuis l'écran d'accueil pour comparer avec un carrefour déjà entièrement renseigné.

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

Pendant la simulation, cette popup s'anime en synchronisation avec votre fenêtre de travail : les flèches changent de couleur (vert / orange / rouge) seconde par seconde, en suivant le cycle du plan de feu courant et l'effet des actions de micro-régulation activées à la demande.

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

### Quels formats d'image puis-je utiliser comme fond de plan ?

Le fond de plan du carrefour (« Image du carrefour ») accepte tous les formats image courants que votre navigateur sait afficher :

- **JPEG** (`.jpg`, `.jpeg`) — adapté aux **photos aériennes** issues de Géoportail, Google Maps, du cadastre, de l'IGN, de drones ou de captures de logiciels SIG/CAO.
- **PNG** (`.png`) — adapté aux **plans au trait** et **schémas** avec aplats nets, fond blanc ou transparent.
- **SVG** (`.svg`) — vectoriel, idéal pour des **schémas exportés depuis AutoCAD, Illustrator** ou tout outil produisant du vectoriel. Reste net à tout niveau de zoom.
- **WebP, GIF, BMP, AVIF** — également acceptés.

Les formats spécialisés **TIFF / GeoTIFF** (`.tif`), **HEIC** (photos iPhone) et formats propriétaires SIG ne sont pas pris en charge directement (les navigateurs ne les affichent pas nativement). Convertissez-les en JPEG ou PNG via votre visionneuse d'images, votre SIG ou un outil en ligne.

L'image chargée est **embarquée en base64 dans le fichier `.json` du projet** : elle voyage avec le projet, mais alourdit le fichier. Pour un partage léger, compressez le fond de plan (JPEG qualité 70-85 %, ou PNG sur fond uni) avant import.

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
