// Script de release interactif (npm run release).
//
// - Affiche l'aide-mémoire de versionnage (cf. VERSIONING.md)
// - Lit la version courante dans src/version.js (source de vérité)
// - Demande le type de bump : patch / minor / major
// - Met à jour src/version.js ET package.json de façon cohérente
// - Crée le commit « Release vX.Y.Z » + le tag annoté vX.Y.Z
// - Rappelle de pousser avec git push --follow-tags
//
// Sécurité : exige un arbre git propre avant de commencer, pour ne pas
// mélanger le bump de version avec d'autres modifications en cours.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const VERSION_FILE = 'src/version.js';
const PKG_FILE = 'package.json';

function fail(msg) {
    console.error(`\n❌ ${msg}\n`);
    process.exit(1);
}

// 1. Arbre git propre ?
let status;
try {
    status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
} catch {
    fail("Impossible de lire l'état git (es-tu dans le dépôt ?).");
}
if (status) {
    fail("L'arbre git n'est pas propre. Committe ou stash tes modifications\n" +
         "avant de lancer une release (le bump de version doit être un commit\n" +
         "isolé). git status :\n\n" + status);
}

// 2. Version courante depuis src/version.js
const versionSrc = readFileSync(VERSION_FILE, 'utf8');
const m = versionSrc.match(/APP_VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/);
if (!m) fail(`Impossible de lire APP_VERSION dans ${VERSION_FILE}.`);
const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
const current = `${major}.${minor}.${patch}`;

// 3. Aide-mémoire + choix
console.log(`
────────────────────────────────────────────────────────────
  Release TraCflux — version actuelle : ${current}
────────────────────────────────────────────────────────────

  patch  (${major}.${minor}.${patch} → ${major}.${minor}.${patch + 1})
         Correction de bug, ajustement visuel, perf.
         Rien de neuf pour l'utilisateur, rien ne casse.

  minor  (${major}.${minor}.${patch} → ${major}.${minor + 1}.0)
         Nouvelle capacité utilisateur, rétrocompatible.

  major  (${major}.${minor}.${patch} → ${major + 1}.0.0)
         Rupture : anciens .json illisibles, fonction retirée,
         refonte fondamentale.

  (Détails : voir VERSIONING.md)
────────────────────────────────────────────────────────────
`);

const rl = createInterface({ input, output });
const answer = (await rl.question('Type de release [patch/minor/major/annuler] : '))
    .trim().toLowerCase();
rl.close();

let next;
if (answer === 'patch') next = `${major}.${minor}.${patch + 1}`;
else if (answer === 'minor') next = `${major}.${minor + 1}.0`;
else if (answer === 'major') next = `${major + 1}.0.0`;
else {
    console.log('\nAnnulé. Aucune modification.\n');
    process.exit(0);
}

// 4. Mise à jour des deux fichiers
const newVersionSrc = versionSrc.replace(
    /(APP_VERSION\s*=\s*')\d+\.\d+\.\d+(')/,
    `$1${next}$2`
);
if (newVersionSrc === versionSrc) fail('Le remplacement dans src/version.js a échoué.');
writeFileSync(VERSION_FILE, newVersionSrc);

const pkg = JSON.parse(readFileSync(PKG_FILE, 'utf8'));
pkg.version = next;
writeFileSync(PKG_FILE, JSON.stringify(pkg, null, 4) + '\n');

// 5. Commit + tag
try {
    execSync(`git add ${VERSION_FILE} ${PKG_FILE}`, { stdio: 'inherit' });
    execSync(`git commit -m "Release v${next}"`, { stdio: 'inherit' });
    execSync(`git tag -a v${next} -m "Release v${next}"`, { stdio: 'inherit' });
} catch {
    fail('Échec du commit/tag git. Les fichiers ont été modifiés mais non commités —\n' +
         'vérifie avec git status.');
}

console.log(`
✅ Version ${current} → ${next}
   Commit « Release v${next} » + tag v${next} créés.

   Pour publier : git push --follow-tags
`);
