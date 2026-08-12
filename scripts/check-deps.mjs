// Bilan de santé des dépendances (npm run check).
//
// Agrège `npm audit` et `npm outdated` en un résumé lisible, en séparant ce qui
// compte vraiment de ce qui est du bruit :
//
// - Vulnérabilités : celles qui touchent le code livré au navigateur (prod)
//   sont distinguées de celles qui ne concernent que la chaîne de build et les
//   tests (dev). Une DoS dans un outil de build n'a pas la même portée qu'une
//   XSS dans une lib embarquée.
// - Retards de version : les mises à jour sûres (dans les bornes semver du
//   package.json, donc `npm update` suffit) sont distinguées des majeures, qui
//   demandent une vraie migration.
//
// Ne modifie rien et sort toujours en code 0 : c'est un rapport, pas un test.

import { execSync } from 'node:child_process';

// npm audit et npm outdated sortent en code 1 dès qu'ils ont quelque chose à
// signaler — ce n'est pas une erreur ici, on récupère le stdout dans les deux cas.
function npmJSON(cmd) {
    let out;
    try {
        out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
        out = e.stdout || '';
    }
    try {
        return JSON.parse(out);
    } catch {
        return null;
    }
}

const SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];
const bySeverity = (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);

function vulns(report) {
    if (!report?.vulnerabilities) return [];
    return Object.values(report.vulnerabilities)
        .filter(v => v.severity !== 'info')
        .map(v => ({
            name: v.name,
            severity: v.severity,
            fixable: v.fixAvailable === true || Boolean(v.fixAvailable && !v.fixAvailable.isSemVerMajor),
            major: Boolean(v.fixAvailable?.isSemVerMajor),
            cible: v.fixAvailable?.version ?? null,
        }))
        .sort(bySeverity);
}

/**
 * « Pas de correctif » au sens de npm audit signifie « rien de corrigé sur le
 * registre npm » — ce qui ne veut pas dire qu'aucun correctif n'existe. Cette
 * table porte les exceptions connues, pour ne pas laisser croire à une impasse
 * là où il n'y a qu'un canal de distribution différent.
 */
const CORRECTIFS_HORS_NPM = {
    xlsx: 'correctif HORS npm — tarball cdn.sheetjs.com >= 0.20.2 (voir la note projet)',
};

function ligneVuln(v) {
    const suite = v.fixable ? 'corrigeable par npm audit fix'
        : v.major ? `correctif en version majeure (${v.cible ?? '?'})`
        : CORRECTIFS_HORS_NPM[v.name] || 'pas de correctif amont';
    return `    - ${v.name} (${v.severity}) — ${suite}`;
}

console.log('\n────────────────────────────────────────────────────────────');
console.log('  TraCflux — bilan des dépendances');
console.log('────────────────────────────────────────────────────────────\n');

// 1. Vulnérabilités, prod d'abord
const toutes = vulns(npmJSON('npm audit --json'));
const prod = vulns(npmJSON('npm audit --omit=dev --json'));
const nomsProd = new Set(prod.map(v => v.name));
const dev = toutes.filter(v => !nomsProd.has(v.name));

console.log('  VULNÉRABILITÉS');
if (toutes.length === 0) {
    console.log('    ✅ Aucune.\n');
} else {
    console.log(`\n  Code livré au navigateur — ${prod.length} :`);
    console.log(prod.length ? prod.map(ligneVuln).join('\n') : '    ✅ Aucune.');
    console.log(`\n  Build et tests uniquement — ${dev.length} :`);
    console.log(dev.length ? dev.map(ligneVuln).join('\n') : '    ✅ Aucune.');
    const corrigeables = toutes.filter(v => v.fixable).length;
    if (corrigeables) {
        console.log(`\n    → ${corrigeables} corrigeable(s) sans changement majeur : npm audit fix`);
    }
    console.log('');
}

// 2. Retards de version
const outdated = npmJSON('npm outdated --json') || {};
const entrees = Object.entries(outdated).map(([name, i]) => ({ name, ...i }));
const sures = entrees.filter(e => e.current !== e.wanted);
const majeures = entrees.filter(e => e.current === e.wanted && e.wanted !== e.latest);

console.log('  VERSIONS');
if (entrees.length === 0) {
    console.log('    ✅ Tout est à jour.\n');
} else {
    console.log(`\n  Mises à jour sûres (npm update) — ${sures.length} :`);
    console.log(sures.length
        ? sures.map(e => `    - ${e.name} : ${e.current} → ${e.wanted}`).join('\n')
        : '    ✅ Aucune en attente.');
    console.log(`\n  Versions majeures disponibles — ${majeures.length} :`);
    console.log(majeures.length
        ? majeures.map(e => `    - ${e.name} : ${e.current} → ${e.latest}  (migration à planifier)`).join('\n')
        : '    ✅ Aucune.');
    console.log('');
}

console.log('────────────────────────────────────────────────────────────\n');
