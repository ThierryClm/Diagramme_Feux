# Diagramme Feux - Outil de Conception de Feux de Carrefour

Une application web interactive développée avec **React** et **Vite** pour concevoir, visualiser et valider les cycles de feux de signalisation d'un carrefour.

## 📋 Fonctionnalités

*   **Configuration du Carrefour** : Définition du nom, nombre de groupes de feux et longueur du cycle.
*   **Gestion des Groupes** : Ajout et paramétrage des groupes de feux.
*   **Matrice de Conflits (Intergreen)** : Saisie des temps de dégagement (jaune + rouge de dégagement) entre les groupes incompatibles pour assurer la sécurité.
*   **Visualisation Temporelle** : Diagramme temporel interactif (Timeline) montrant l'état de chaque groupe sur la durée du cycle.
*   **Validation en Temps Réel** : Détection automatique des conflits basée sur la matrice de temps de dégagement. Les conflits sont signalés visuellement.
*   **Modes** :
    *   *Configuration* : Pour le paramétrage des cycles et des temps de sécurité.
    *   *Trafic* : Pour la saisie de données de trafic (débit, saturation).

## 🚀 Installation

Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé sur votre machine.

1.  Clonez ce dépôt (ou téléchargez les fichiers).
2.  Installez les dépendances :

```bash
npm install
```

## 🛠️ Démarrage

Pour lancer l'application en mode développement :

```bash
npm run dev
```

Ou si vous utilisez un terminal compatible Bash (comme Git Bash sur Windows) :

```bash
./start.sh
```

L'application sera accessible généralement à l'adresse `http://localhost:3000`.

## 🏗️ Technologies

*   **Frontend** : [React](https://reactjs.org/)
*   **Build Tool** : [Vite](https://vitejs.dev/)
*   **Langage** : JavaScript / JSX
*   **Styles** : CSS3

## 📁 Structure du Projet

*   `src/components` : Composants React (Tableaux, Diagrammes, Matrice).
*   `src/hooks` : Logique métier (ex: `useTrafficLight` pour la gestion d'état).
*   `src/App.jsx` : Composant principal orchestrant l'interface.
