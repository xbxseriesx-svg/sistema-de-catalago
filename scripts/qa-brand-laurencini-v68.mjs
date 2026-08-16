import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildModeloOficial } from './modelo-oficial.mjs';

const [bundle, pkg, version] = await Promise.all([
  readFile('public/assets/index-V60Excel.js', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('VERSION', 'utf8').then((v) => v.trim()),
]);

assert.equal(version, '68', 'A identidade Laurencini exige VERSION 68.');
assert.equal(pkg.version, '2.1.68', 'package.json precisa estar em 2.1.68.');
assert.match(pkg.scripts['prepare:bundle'], /patch-brand-laurencini-v68\.mjs/);

for (const value of ['#214C8F', '#123F7D', '#D13130', '#A7252A', '#F4F8FC', '#DCE6F2']) {
  assert.ok(bundle.includes(value), `Cor Laurencini ausente do bundle: ${value}`);
}

for (const id of [
  'varejo-continuo',
  'atacado-b2b',
  'distribuidora-institucional',
  'catalogo-marcas-b2b',
  'distribuidora-uniao-figma',
  'catalogo-hierarquico-b2b',
  'vitrine-atacado-pro',
]) assert.ok(bundle.includes(`id:"${id}"`), `Template ausente: ${id}`);

assert.match(bundle, /const LAURENCINI_BRAND=Object\.freeze/);
assert.match(bundle, /function laurenciniNodes/);
assert.match(bundle, /function laurenciniTemplate/);
assert.match(bundle, /\.map\(S=>\(\{\.\.\.S,accent:LAURENCINI_BRAND\.blue,build:\(\)=>laurenciniNodes\(S\.build\(\)\)\}\)\)/);
assert.match(bundle, /S\.templates\.map\(laurenciniTemplate\)/, 'Modelos já salvos precisam ser normalizados.');
assert.match(bundle, /AR\(laurenciniNodes\(T\)\)/, 'Aplicação do modelo precisa passar pela paleta Laurencini.');
assert.match(bundle, /productbutton:\{[^}]+backgroundColor:"#D13130"/);
assert.match(bundle, /productprice:\{[^}]+color:"#214C8F"/);
assert.match(bundle, /linear-gradient\(135deg, #123F7D 0%, #214C8F 100%\)/);
assert.match(bundle, /linear-gradient\(135deg, #A7252A 0%, #D13130 100%\)/);

const official = buildModeloOficial();
const officialSource = JSON.stringify(official);
for (const value of ['#214C8F', '#123F7D', '#D13130', '#F4F8FC', '#DCE6F2']) {
  assert.ok(officialSource.includes(value), `Modelo Oficial não contém ${value}.`);
}
for (const oldColor of ['#183153', '#10253F', '#294D73', '#E27D33', '#FFF0E4', '#DDE5EE', '#EAF1F8']) {
  assert.ok(!officialSource.includes(oldColor), `Modelo Oficial ainda usa cor antiga ${oldColor}.`);
}

const productButtons = [];
const walk = (node) => {
  if (node.type === 'productbutton') productButtons.push(node);
  for (const child of node.children || []) walk(child);
};
for (const node of official.nodes) walk(node);
assert.ok(productButtons.length > 0, 'Modelo Oficial precisa manter botões de produto.');
assert.ok(productButtons.every((node) => ['#214C8F', '#D13130'].includes(node.styles?.backgroundColor)), 'Botões de produto do Modelo Oficial precisam usar a marca.');

console.log('QA Marca Laurencini V68 OK: 7 templates, biblioteca Supabase, Modelo Oficial e elementos novos padronizados.');
