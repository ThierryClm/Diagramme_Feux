# Contribuer à Diagramme de Feux

Merci de l'intérêt que vous portez au projet. Ce document décrit comment proposer une amélioration, signaler un bug, ou ouvrir une pull request.

## Signaler un bug

1. Vérifiez que le bug n'est pas déjà signalé dans les [issues GitHub](https://github.com/ThierryClm/Diagramme_Feux/issues).
2. Dans l'application, ouvrez **À propos → Rapport de diagnostic** et joignez le contenu (copier ou télécharger .json) à votre issue. Ce rapport contient le contexte technique nécessaire (version, navigateur, état du projet, journal d'erreurs), sans aucune donnée envoyée sur le réseau.
3. Décrivez les étapes pour reproduire le bug, le résultat attendu, et le résultat observé.

## Proposer une amélioration

Ouvrez une issue GitHub décrivant :
- Le besoin ou le cas d'usage
- Une proposition de solution (si vous en avez une)
- Les alternatives envisagées

Pour les changements significatifs, il est préférable de discuter dans une issue avant d'ouvrir une pull request.

## Pull requests

1. **Forkez** le dépôt et créez une branche depuis `master` : `git checkout -b ma-modification`.
2. **Respectez le style du code existant** — pas de reformatage massif sans raison.
3. **Ajoutez des tests** pour toute nouvelle logique ou correction de bug (`src/utils/*.test.js`, exécutables via `npm test`).
4. **Vérifiez que le build passe** : `npm run build` doit terminer sans erreur.
5. **Vérifiez que tous les tests passent** : `npm test`.
6. **Commit** avec un message concis en français, décrivant le *pourquoi* plus que le *quoi*.
7. Ouvrez la pull request en décrivant le changement, les cas de test, et les éventuelles captures d'écran si l'UI change.

## Environnement de développement

```bash
npm install
npm run dev      # serveur à http://localhost:3000
npm test         # lance les tests
npm run build    # build de production
```

Prérequis : [Node.js](https://nodejs.org/) 18+.

## Licence des contributions

Toute contribution est acceptée sous la licence **GNU AGPL v3 ou ultérieure** (voir [`LICENSE`](LICENSE)). En ouvrant une pull request, vous certifiez que vous êtes l'auteur de votre contribution ou que vous avez le droit de la soumettre sous cette licence, et vous acceptez qu'elle soit distribuée sous AGPL v3.
