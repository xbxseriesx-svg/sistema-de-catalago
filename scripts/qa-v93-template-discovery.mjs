import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/preview-editor-v93-source.js', 'utf8');

for (const name of [
  'varejo continuo','atacado b2b','distribuidora institucional','catalogo de marcas b2b',
  'distribuidora uniao • figma b2b','catalogo hierarquico b2b','vitrine atacado pro','modelo oficial',
]) assert.ok(source.includes(`'${name}'`), `Template corrente normalizada ausente: ${name}`);

assert.match(source, /while \(root && root !== document\.body && root\.querySelectorAll\('article'\)\.length === 0\)/,
  'Descoberta das templates precisa subir até o contêiner real dos article.');
assert.match(source, /article\.dataset\.asteryonTemplateVersion = '93'/,
  'Cards correntes precisam ser identificados como V93.');
assert.match(source, /Aplicar modelo preenchido V93/,
  'Botão legado deve anunciar a fonte preenchida V93.');

console.log('QA V93 descoberta: oito templates normalizadas, contêiner real e identificação V93 protegidos.');