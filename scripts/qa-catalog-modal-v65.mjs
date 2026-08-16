import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');
const version = (await readFile('VERSION', 'utf8')).trim();
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const html = await readFile('public/index.html', 'utf8');

const versionNumber = Number(version);
const packagePatch = Number(String(pkg.version).split('.').at(-1));
assert.ok(Number.isFinite(versionNumber) && versionNumber >= 65, 'VERSION precisa ser 65 ou superior.');
assert.equal(packagePatch, versionNumber, 'Patch do package.json precisa acompanhar VERSION.');
assert.match(html, new RegExp(`ASTERYON Editor V${version}`), 'Título do editor precisa acompanhar VERSION.');

assert.match(bundle, /asteryon:catalog-open/, 'Evento de abertura do catálogo não existe.');
assert.match(bundle, /asteryon:product-open/, 'Evento de abertura do produto não existe.');
assert.match(bundle, /asteryon:catalog-menu/, 'Evento de abertura do menu não existe.');
assert.match(bundle, /catalog-modal","Abrir catálogo em pop-up/, 'Ação explícita de catálogo modal não está disponível no editor.');
assert.match(bundle, /catalog-menu","Abrir menu do catálogo/, 'Ação explícita do Menu não está disponível no editor.');

assert.doesNotMatch(bundle, /aria-label:"Abrir menu"/, 'Botão Menu hardcoded ainda existe fora do canvas editável.');
assert.doesNotMatch(bundle, /"data-editor-menu-preview":"true"/, 'Menu artificial V64 ainda está injetado no canvas.');
assert.match(bundle, /addEventListener\("asteryon:catalog-menu"/, 'Drawer do Menu não está controlado por elemento/evento.');

assert.match(bundle, /function gJ\(\{products:e,brands:t,hierarchy:a,settings:r,onProduct:n,theme:i,open:eO=!1,onClose:eC\}\)/, 'Catálogo não possui estado de modal.');
assert.match(bundle, /Fechar catálogo/, 'Modal de catálogo não possui botão fechar.');
assert.match(bundle, /open:eO,onClose:\(\)=>eC\(!1\)/, 'Site/editor não controlam abertura e fechamento do catálogo.');

assert.match(bundle, /function MJ\(\{product:e,products:p=\[\],brands:t,hierarchy:a,settings:r,onClose:n,onProduct:oP,theme:i\}\)/, 'Modal de produto não recebeu lista de produtos.');
assert.match(bundle, /title:"Produtos similares"/, 'Modal de produto não exibe produtos similares.');
assert.match(bundle, /onClick:\(\)=>oP\?oP\(o\):window\.location\.assign/, 'Produtos similares não permanecem em modal quando há callback.');
assert.match(bundle, /product:x,products:a/, 'Modal público não recebe o catálogo para calcular similares.');
assert.match(bundle, /product:eP,products:D\.products/, 'Modal no Preview do editor não recebe o catálogo real.');

console.log(`QA Catálogo V65+ OK na V${version}: catálogo em pop-up, produto com similares e Menu editável por ação.`);
