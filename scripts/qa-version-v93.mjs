import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const version = fs.readFileSync('VERSION', 'utf8').trim();
const html = fs.readFileSync('public/index.html', 'utf8');

assert.equal(pkg.version, '2.1.93', 'package.json precisa estar em 2.1.93.');
assert.equal(lock.version, '2.1.93', 'package-lock raiz precisa estar em 2.1.93.');
assert.equal(lock.packages?.['']?.version, '2.1.93', 'package-lock package raiz precisa estar em 2.1.93.');
assert.equal(version, '93', 'VERSION precisa estar em 93.');
assert.match(html, /ASTERYON Editor V93/, 'HTML precisa anunciar V93.');
assert.doesNotMatch(html, /\?v=92(?:["&])/, 'Assets do HTML não podem manter cache key V92.');

let worker = '';
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.ts')) worker += fs.readFileSync(file, 'utf8') + '\n';
  }
}
walk('worker');
assert.match(worker, /version\s*:\s*['"]V93['"]|release\s*:\s*['"]V93['"]/, 'Worker precisa expor V93 em campo explícito de versão/release.');

console.log('QA versão V93: pacote, lock, cache-busting, VERSION e Worker alinhados.');