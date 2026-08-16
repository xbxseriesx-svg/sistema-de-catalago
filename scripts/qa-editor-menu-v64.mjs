import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');

assert.match(bundle, /function mJ\(\{products:e,hierarchy:t,theme:a,editorMode:eM=!1\}\)/, 'Menu não possui modo específico para o editor.');
assert.match(bundle, /\$\{eM\?"absolute":"fixed"\} left-3 top-3/, 'Menu não alterna posição entre editor e site público.');
assert.match(bundle, /function NJ\(\{cloudUser:e\}\)\{const\{state:t,getNode:a\}=Pa\(\),D=cn\(\)/, 'Editor não recebe o catálogo vivo do Supabase.');
assert.equal((bundle.match(/"data-editor-menu-preview":"true"/g) || []).length, 2, 'Menu deve existir no canvas de edição e no Preview.');
assert.equal((bundle.match(/editorMode:!0/g) || []).length, 2, 'Os dois canvases do editor devem ativar editorMode.');
assert.match(bundle, /l\.jsx\(mJ,\{products:a,hierarchy:o,theme:A\}\)/, 'Menu público original foi alterado ou removido.');
assert.match(bundle, /href:eM\?"#":"\/#catalogo"/, 'Links do Menu não estão protegidos dentro do editor.');

console.log('QA Menu V64 OK: visível no editor e Preview, funcional no público e sem navegação acidental no canvas.');
