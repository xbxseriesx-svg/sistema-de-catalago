import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const version = fs.readFileSync('VERSION', 'utf8').trim();
const html = fs.readFileSync('public/index.html', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

assert.equal(pkg.version, '2.1.94', 'package.json precisa estar em 2.1.94.');
assert.equal(lock.version, '2.1.94', 'package-lock raiz precisa estar em 2.1.94.');
assert.equal(lock.packages?.['']?.version, '2.1.94', 'package-lock package raiz precisa estar em 2.1.94.');
assert.equal(version, '94', 'VERSION precisa estar em 94.');
assert.match(html, /ASTERYON Editor V94/, 'HTML precisa anunciar V94.');
assert.doesNotMatch(html, /\?v=93(?:["&])/, 'Assets do HTML não podem manter cache key V93.');
assert.match(readme, /ASTERYON Catálogo — V94/, 'README precisa anunciar V94.');
assert.match(readme, /Versão da aplicação:\s*`2\.1\.94`/, 'README precisa documentar 2.1.94.');

let worker = '';
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.ts')) worker += fs.readFileSync(file, 'utf8') + '\n';
  }
}
walk('worker');
assert.match(worker, /version\s*:\s*['"]V94['"]|release\s*:\s*['"]V94['"]/, 'Worker precisa expor V94 em campo explícito de versão/release.');

console.log('QA versão V94: pacote, lock, cache-busting, README, VERSION e Worker alinhados.');
