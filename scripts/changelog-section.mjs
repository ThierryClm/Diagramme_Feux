/**
 * Extrait d'un CHANGELOG « Keep a Changelog » la section d'une version donnée,
 * pour servir de corps à la release GitHub.
 *
 *   node scripts/changelog-section.mjs 1.2.0
 *
 * Écrit la section sur la sortie standard. Sort en erreur si la version est
 * absente : mieux vaut une release qui échoue qu'une release au corps vide.
 */
import { readFileSync } from 'node:fs';

const version = (process.argv[2] || '').replace(/^v/, '');
if (!version) { console.error('Usage : node scripts/changelog-section.mjs <version>'); process.exit(1); }

const lignes = readFileSync('CHANGELOG.md', 'utf8').replace(/\r\n/g, '\n').split('\n');
const debut = lignes.findIndex(l => l.startsWith(`## [${version}]`));
if (debut < 0) { console.error(`Version ${version} absente du CHANGELOG.`); process.exit(1); }

let fin = lignes.length;
for (let i = debut + 1; i < lignes.length; i++) {
    if (lignes[i].startsWith('## [')) { fin = i; break; }
}

const corps = lignes.slice(debut + 1, fin).join('\n')
    .replace(/^\s*---\s*$/gm, '')   // séparateurs de section
    .trim();

if (!corps) { console.error(`Section ${version} vide.`); process.exit(1); }
console.log(corps);
