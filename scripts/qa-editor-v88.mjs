import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [index, loader, responsive, marketing] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/runtime-loader-v87.js', 'utf8'),
  readFile('public/responsive-v67.js', 'utf8'),
  readFile('public/marketing-canvas-hotfix.js', 'utf8'),
]);

assert.match(index, /index-V60Excel\.js\?v=81&perf=88/, 'Bundle precisa renovar cache na V88.');
assert.match(index, /runtime-loader-v87\.js\?v=87&perf=88/, 'Loader contextual precisa renovar cache na V88.');
assert.match(index, /responsive-v67\.js\?v=81&perf=88/, 'Manifesto precisa expor a camada responsiva V88.');
assert.match(index, /marketing-canvas-hotfix\.js\?v=81&perf=88/, 'Manifesto precisa expor Marketing V88.');

assert.match(responsive, /ASTER_V88_RESPONSIVE_PERFORMANCE/, 'Camada responsiva V88 não foi materializada.');
assert.match(responsive, /ResizeObserver/, 'Editor deve usar ResizeObserver para geometria do shell em vez de medir em toda mutação.');
assert.match(responsive, /record\.addedNodes/, 'Observer responsivo deve avaliar somente nós adicionados.');
assert.match(responsive, /addedNodeNeedsWork/, 'Observer responsivo precisa filtrar mutações relevantes.');
assert.doesNotMatch(responsive, /new MutationObserver\(schedule\)/, 'Não pode voltar a executar apply em toda mutação do body.');
assert.doesNotMatch(responsive, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/, 'Observer V67 antigo não pode voltar sem filtro.');

assert.match(marketing, /ASTER_V88_MARKETING_PERFORMANCE/, 'Marketing V88 não foi materializado.');
assert.match(marketing, /loadConfigOnce/, 'Marketing deve carregar configuração apenas uma vez enquanto inativo.');
assert.match(marketing, /configLoaded && !active\(config\)/, 'Observer deve ignorar mutações quando Marketing está inativo.');
assert.match(marketing, /requestAnimationFrame/, 'Drag/resize de Marketing deve ser agrupado por frame.');
assert.doesNotMatch(marketing, /new MutationObserver\(\(\) => mount\(\)\)/, 'Marketing não pode chamar mount/API a cada mutação do documento.');

assert.match(loader, /ASTER_V88_CONTEXT_LOADER/, 'Loader contextual V88 não foi materializado.');
assert.match(loader, /ADMIN_MANAGEMENT/, 'Gestão/Vínculos precisa carregar sob demanda.');
assert.match(loader, /warmVisibleManagementOnce/, 'Loader deve fazer no máximo uma inspeção tardia da Gestão visível.');
assert.match(loader, /loadMarketing/, 'Marketing deve continuar disponível sob demanda.');
assert.match(loader, /ADMIN_BRANDS/, 'Marcas continuam sob carregamento contextual.');
assert.match(loader, /ADMIN_IMPORT/, 'Importação continua sob carregamento contextual.');
assert.doesNotMatch(loader, /const ADMIN_IDLE =/, 'Runtimes pesados não podem voltar a ser injetados em bloco após abrir o editor.');
assert.doesNotMatch(loader, /loadAll\(ADMIN_IDLE\)/, 'Editor não pode reativar lote pesado em idle.');

for (const file of [
  'public/responsive-v67.js',
  'public/marketing-canvas-hotfix.js',
  'public/runtime-loader-v87.js',
]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

console.log('QA Editor V88: OK — mutações filtradas, Marketing sem polling por DOM e runtimes administrativos contextuais.');
