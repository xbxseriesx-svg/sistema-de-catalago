import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [index, editorRuntime, loader] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/editor-runtime-v87.js', 'utf8'),
  readFile('public/runtime-loader-v87.js', 'utf8'),
]);

assert.match(index, /editor-runtime-v87\.js\?v=87/, 'Runtime V87 precisa carregar antes do bundle do editor.');
assert.match(index, /runtime-loader-v87\.js\?v=87/, 'Loader contextual V87 precisa estar habilitado.');
const earlyRuntimeIndex = index.indexOf('/editor-runtime-v87.js?v=87');
const bundleIndex = index.indexOf('/assets/index-V60Excel.js');
assert.ok(earlyRuntimeIndex >= 0 && bundleIndex > earlyRuntimeIndex, 'Barreira de publicação V87 precisa carregar antes do bundle principal.');

for (const heavy of [
  'marketing-canvas-hotfix.js',
  'brand-image-search-v70.js',
  'brand-image-search-v72.js',
  'import-progress-v62.js',
  'import-progress-fetch-v62.js',
  'template-preview-v69.js',
  'public-global-search-v78.js',
  'public-entity-popups-v81.js',
  'public-brand-popup-fix-v83.js',
]) {
  const directTag = new RegExp(`<script[^>]+src=["'][^"']*${heavy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  assert.doesNotMatch(index, directTag, `${heavy} não deve voltar a bloquear a abertura inicial; deve ser carregado pelo V87.`);
  assert.ok(loader.includes(`/${heavy}`), `Loader V87 perdeu ${heavy}.`);
}

assert.match(editorRuntime, /AUTOSAVE_MS = 850/, 'Barreira V87 deve respeitar o debounce real de 850 ms.');
assert.match(editorRuntime, /flushBeforePublish/, 'Publicar precisa aguardar a preparação do rascunho.');
assert.match(editorRuntime, /findExplicitSaveButton/, 'V87 deve acionar Salvar antes de publicar quando o controle existir.');
assert.match(editorRuntime, /event\.stopImmediatePropagation\(\)/, 'Primeiro clique em Publicar deve ser retido até o rascunho estar pronto.');
assert.match(editorRuntime, /releasedPublish\.add\(button\)/, 'Clique de publicação precisa ser liberado exatamente após a barreira.');
assert.match(editorRuntime, /label\.includes\('salvando'\)/, 'V87 precisa respeitar o estado visual de gravação ativa.');

assert.match(editorRuntime, /normalize\(raw\) !== 'brand'/, 'Correção visual precisa reconhecer o texto técnico brand.');
assert.match(editorRuntime, /replace\(\/brand\/i, 'Marca'\)/, 'Editor deve exibir Marca sem alterar o identificador interno brand.');
assert.match(editorRuntime, /NodeFilter\.SHOW_TEXT/, 'Normalização de Marca deve atuar somente em texto visível.');

assert.match(loader, /location\.pathname\.startsWith\('\/admin'\)/, 'Loader V87 deve separar editor e catálogo público.');
assert.match(loader, /requestIdleCallback/, 'Recursos secundários do editor devem esperar ocioso do navegador.');
assert.match(loader, /ADMIN_BRANDS/, 'Busca de logos deve ser carregada somente sob intenção de Marcas.');
assert.match(loader, /ADMIN_IMPORT/, 'Scripts de importação devem ser carregados sob intenção de Importar.');
assert.match(loader, /pointerover/, 'Pré-aquecimento contextual deve iniciar antes do clique quando possível.');

execFileSync(process.execPath, ['--check', 'public/editor-runtime-v87.js'], { stdio: 'pipe' });
execFileSync(process.execPath, ['--check', 'public/runtime-loader-v87.js'], { stdio: 'pipe' });
console.log('QA Editor V87: OK — Marca, publicação após autosave e carregamento contextual validados.');
