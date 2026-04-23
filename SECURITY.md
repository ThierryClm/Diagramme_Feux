# Politique de sécurité

## Signaler une vulnérabilité

Si vous identifiez une vulnérabilité de sécurité dans Diagramme de Feux, merci de **ne pas ouvrir d'issue publique**. Contactez-moi directement via :

- **GitHub Security Advisory** : [ouvrir un rapport privé](https://github.com/ThierryClm/Diagramme_Feux/security/advisories/new)

Incluez autant de détails que possible :
- Description de la vulnérabilité
- Étapes pour reproduire
- Impact estimé (confidentialité, intégrité, disponibilité)
- Version concernée

Je m'engage à accuser réception sous **7 jours** et à vous tenir informé de l'avancement.

## Périmètre

Diagramme de Feux est une application **100 % locale** : pas de serveur, pas de télémétrie, pas d'appel réseau sortant. Toutes les données utilisateur restent dans le navigateur (localStorage) ou sur le disque (fichiers .json exportés).

Les vecteurs d'attaque réalistes à considérer :
- **Injection via fichiers .json importés** — valeurs malicieuses dans un projet chargé
- **XSS via noms de groupes, commentaires, remarques** — chaînes injectées dans le DOM
- **Tampering localStorage** — clés modifiées pour provoquer un état incohérent
- **Dépendances tierces vulnérables** — `npm audit` doit remonter propre

Hors périmètre :
- Attaques sur le poste de l'utilisateur (malware local, compromission OS)
- Attaques sur les plateformes d'hébergement (GitHub Pages, etc.) — relève de leurs opérateurs

## Versions supportées

Seule la dernière version publiée sur `master` reçoit des correctifs de sécurité. Il n'y a pas de branches de maintenance à ce jour.

## Divulgation

Après correction, le correctif est publié et crédité à l'auteur du rapport (sauf demande d'anonymat). Un CVE peut être attribué si la sévérité le justifie.
