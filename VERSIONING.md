# Versionnage de TraCflux

TraCflux suit le **versionnage sémantique** : `MAJEUR.MINEUR.CORRECTIF`
(ex. `1.2.5`). Ce document est l'aide-mémoire pour décider *quel* chiffre
incrémenter et *quand*.

## La règle

| Niveau | Quand l'incrémenter | Effet sur le numéro |
|---|---|---|
| **CORRECTIF** (`1.0.0` → `1.0.1`) | Correction de bug, ajustement visuel, reformulation, performance. **Rien de neuf pour l'utilisateur, rien ne casse.** | +1 au 3ᵉ chiffre |
| **MINEUR** (`1.0.x` → `1.1.0`) | **Nouvelle capacité** : l'utilisateur peut faire quelque chose qu'il ne pouvait pas avant, et tout l'ancien continue de fonctionner. | +1 au 2ᵉ chiffre, 3ᵉ remis à 0 |
| **MAJEUR** (`1.x.x` → `2.0.0`) | **Rupture** : un projet `.json` ancien ne se charge plus, une fonctionnalité disparaît, refonte fondamentale du fonctionnement. | +1 au 1ᵉʳ chiffre, les deux autres à 0 |

## La règle mentale simple

- *« Un utilisateur peut faire quelque chose de nouveau ? »* → **MINEUR**
- *« J'ai juste réparé ou peaufiné ? »* → **CORRECTIF**
- *« Les anciens fichiers `.json` cassent, ou une fonction disparaît ? »* → **MAJEUR**

Le passage `1.0.47 → 1.1.0` n'est **pas mécanique** : il arrive le jour
où un lot de travail apporte une fonctionnalité que les utilisateurs
n'avaient pas. Tant que tu corriges et peaufines, tu restes en `1.0.x`.

## Exemples concrets (historique du projet)

| Type de changement | Niveau |
|---|---|
| Contraste de la barre de menu, bug isDirty, confirm→modale, indicateur (Verrouillé) | **CORRECTIF** |
| Onde verte : auto-save + restaurer un projet récent, logo cliquable + modale À propos | **MINEUR** |
| (hypothétique) Changement du schéma `.json` rendant illisibles les anciens projets | **MAJEUR** |

## Comment publier une version

Ne pas éditer les numéros à la main. Lancer :

```bash
npm run release
```

Le script affiche ce guide, demande le type de bump (patch / mineur /
majeur), met à jour **`src/version.js`** *et* **`package.json`** de façon
cohérente, crée le commit et le tag git `vX.Y.Z`. Ensuite :

```bash
git push --follow-tags
```

## Rythme recommandé

- **Jusqu'à la bascule publique** : rester en `1.0.0` (version de lancement, rien à faire).
- **Au moment de publier** : `npm run release` → `1.0.0` officiel + tag `v1.0.0`, à associer à la première GitHub Release.
- **Ensuite** : `patch` pour les corrections, `mineur` pour les nouvelles fonctions, `majeur` pour les ruptures.
