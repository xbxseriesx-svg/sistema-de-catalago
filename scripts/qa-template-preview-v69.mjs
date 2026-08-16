import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [preview, css, index, logoWrapper, logoFile, worker, pkg, version] = await Promise.all([
  readFile('public/template-preview-v69.js', 'utf8'),
  readFile('public/template-preview-v69.css', 'utf8'),
  readFile('public/index.html', 'utf8'),
  readFile('public/laurencini-logo-v69.svg', 'utf8'),
  stat('public/laurencini-logo-v69.webp'),
  readFile('worker/index.ts', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('VERSION', 'utf8').then((value) => value.trim()),
]);

assert.equal(version, '70', 'O preview completo precisa estar na release V70.');
assert.equal(pkg.version, '2.1.70', 'package.json precisa estar em 2.1.70.');
assert.match(index, /template-preview-v69\.css\?v=70/);
assert.match(index, /template-preview-v69\.js\?v=70/);
assert.match(index, /ASTERYON Editor V70/);
assert.match(preview, /\/api\/public\/catalog/);
assert.match(worker, /path === '\/api\/public\/catalog'/, 'O preview precisa usar o catálogo público real do Supabase.');
assert.match(preview, /MutationObserver/, 'Os botões de preview precisam acompanhar a renderização dinâmica dos cards.');
assert.match(preview, /Pré-visualizar modelo completo/);
assert.match(preview, /Aplicar este modelo/);
assert.match(preview, /aplicar modelo/, 'Aplicar a partir do preview precisa reutilizar o fluxo existente do card.');
assert.match(preview, /laurencini-logo-v69\.svg/);
assert.match(logoWrapper, /Distribuidora Laurencini/);
assert.match(logoWrapper, /laurencini-logo-v69\.webp/);
assert.ok(logoFile.size > 5000, 'A logo original compactada precisa existir como arquivo de imagem real.');

for (const name of [
  'Varejo Contínuo',
  'Atacado B2B',
  'Distribuidora Institucional',
  'Catálogo de Marcas B2B',
  'Distribuidora União • Figma B2B',
  'Catálogo Hierárquico B2B',
  'Vitrine Atacado Pro',
  'Modelo Oficial',
]) assert.ok(preview.includes(name), `Template sem suporte de preview: ${name}`);

for (const marker of ['products', 'brands', 'hierarchy', 'departamento', 'secao', 'categoria']) {
  assert.match(preview, new RegExp(marker, 'i'), `Preview precisa consumir ${marker}.`);
}

assert.doesNotMatch(preview, /carrinho|checkout|finalizar compra|comprar agora|adicionar ao carrinho/i, 'Preview não pode introduzir recursos de e-commerce.');
assert.doesNotMatch(preview, /\/api\/admin\//, 'Preview visual deve depender apenas do catálogo público.');
assert.match(preview, /modal atual do ASTERYON/);
assert.match(preview, /comportamento atual de abertura do catálogo é preservado integralmente/);
assert.match(css, /@media \(max-width:1100px\)/);
assert.match(css, /@media \(max-width:720px\)/);
assert.match(css, /grid-template-columns/);
assert.match(css, /100vh/);
assert.match(css, /overflow:auto/);

execFileSync(process.execPath, ['--check', 'public/template-preview-v69.js'], { stdio: 'pipe' });

console.log('QA Preview V69 na release V70 OK: 8 templates, logo original Laurencini, catálogo real Supabase e fluxo existente preservado.');
