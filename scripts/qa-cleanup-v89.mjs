import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const [html, icon] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/asteryon.svg', 'utf8'),
]);

assert.match(html, /href="\/asteryon\.svg"/, 'HTML deve usar o favicon ASTERYON local.');
assert.doesNotMatch(html, /vite\.svg/i, 'HTML não pode voltar a referenciar o favicon legado do Vite.');
assert.doesNotMatch(html, /bolt\.new/i, 'HTML não pode expor metadados padrão do Bolt.');
assert.match(icon, /^<svg[\s>]/, 'Favicon ASTERYON precisa ser SVG real.');
assert.match(icon, /aria-label="ASTERYON"/, 'Favicon precisa identificar ASTERYON.');

let staleExists = true;
try { await access('public/vite.svg'); } catch { staleExists = false; }
assert.equal(staleExists, false, 'Arquivo legado public/vite.svg deve permanecer removido.');

console.log('QA V89 cleanup: favicon ASTERYON válido e resíduos Vite/Bolt ausentes.');
