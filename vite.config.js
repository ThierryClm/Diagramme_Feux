import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' (et non 'autoUpdate') : la nouvelle version reste en attente
      // et l'app affiche un bandeau « Recharger » (cf. ReloadPrompt.jsx) au
      // lieu de recharger silencieusement — on ne coupe jamais une édition en
      // cours ni ne ferme les fenêtres détachées.
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'TraCflux',
        short_name: 'TraCflux',
        description: 'Outil de conception et d\'optimisation de diagrammes de feux tricolores',
        theme_color: '#1e1e1e',
        background_color: '#1e1e1e',
        // 'minimal-ui' (au lieu de 'standalone') : conserve une barre URL
        // minimale en mode PWA installé. Indispensable pour que window.open()
        // des fenêtres détachées (usePopupWindow.js) respecte les paramètres
        // de taille/position — en 'standalone' les popups héritent du mode
        // app et s'ouvrent plein écran ou sont bloquées (cf. memory
        // vbs-app-mode-breaks-popups : même classe de problème).
        display: 'minimal-ui',
        orientation: 'landscape',
        lang: 'fr',
        scope: './',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Augmente la limite par défaut de 2 Mo : excelImporter et exportHelpers
        // dépassent ce seuil et doivent être pré-cachés pour l'usage hors-ligne.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  base: './',
  define: {
    // Horodatage du build, affiché par le rapport de diagnostic : c'est le seul
    // moyen fiable de repérer un bundle périmé servi par le service worker.
    // APP_VERSION ne bouge qu'aux releases et ne discrimine donc pas.
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  },
  server: {
    port: 3000
  },
  // Port de l'aperçu figé explicitement. C'est la valeur par défaut de
  // Vite, mais elle est codée en dur dans les lanceurs VBS et dans
  // loading-preview.html : si Vite la changeait un jour, comme il l'a fait
  // pour le serveur de développement en passant à la version 3, ces pages
  // pointeraient dans le vide sans rien signaler.
  preview: {
    port: 4173,
    // strictPort : sans lui, Vite bascule silencieusement sur 4174 quand 4173
    // est occupé — cas courant ici, les processus node.exe s'accumulant après
    // plusieurs aperçus (voir la section Dépannage du README). La page d'attente
    // des lanceurs sonderait alors le 4173 et se connecterait au serveur
    // périmé. Mieux vaut un échec franc qu'un aperçu qui montre l'ancien build.
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    // Scope explicite : sinon vitest ramasse les fichiers *.test.js / *.spec.js
    // potentiellement presents dans les profils navigateurs preview (Edge,
    // Chrome) ou ailleurs dans le workspace.
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)']
  }
})
