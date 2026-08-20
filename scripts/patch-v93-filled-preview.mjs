import fs from 'node:fs';
import path from 'node:path';

const RELEASE = 'V93';
const VERSION = '2.1.93';
const MARKER = 'ASTER_V93_FILLED_PREVIEW_SOURCE';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content); }
function replaceRequired(file, find, replacement, label) {
  let source = read(file);
  if (source.includes(replacement)) return false;
  if (!source.includes(find)) throw new Error(`V93: ${label} não encontrado em ${file}.`);
  source = source.replace(find, replacement);
  write(file, source);
  return true;
}
function replaceAllFile(file, find, replacement) {
  let source = read(file);
  if (!source.includes(find)) return 0;
  const count = source.split(find).length - 1;
  source = source.split(find).join(replacement);
  write(file, source);
  return count;
}
function walk(dir, predicate, action) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, predicate, action);
    else if (predicate(file)) action(file);
  }
}

// 1) HTML da release corrente: V93 entra antes da captura V91 para assumir a fonte oficial.
let html = read('public/index.html');
html = html.replaceAll('ASTERYON Editor V92', 'ASTERYON Editor V93');
html = html.replaceAll('?v=92', '?v=93');
if (!html.includes('/preview-editor-v93-source.js')) {
  html = html.replace(
    '<script src="/preview-editor-v91-core.js?v=93"></script>',
    '<script src="/preview-editor-v91-core.js?v=93"></script>\n    <script src="/preview-editor-v93-source.js?v=93"></script>',
  );
}
if (!html.includes('/preview-editor-v93-visual-gate.js')) {
  html = html.replace(
    '<script src="/preview-editor-v92-team4.js?v=93"></script>',
    '<script src="/preview-editor-v92-team4.js?v=93"></script>\n    <script src="/preview-editor-v93-visual-gate.js?v=93"></script>\n    <script src="/preview-editor-v93-team4.js?v=93"></script>',
  );
}
if (!html.includes('/preview-editor-v93-source.js?v=93') || !html.includes('/preview-editor-v93-team4.js?v=93')) {
  throw new Error('V93: scripts correntes não foram inseridos no index.html.');
}
html = html.replace('<!-- V90/V91 preservam a ponte de cópia; V92 adiciona auditoria independente da Equipe 4. -->', '<!-- V93: Preview preenchido é a fonte oficial; V91/V92 permanecem como compatibilidade e pré-gates. -->');
write('public/index.html', html);

// 2) O capturador legado não pode executar depois do V93 no mesmo clique.
let capture = read('public/preview-editor-v91-capture.js');
if (!capture.includes('event.__asteryonV93Captured')) {
  capture = capture.replace(
    '  function handleApply(event) {\n    if (!(event.target instanceof Element) || !event.target.closest(\'[data-ltp-apply]\')) return;',
    '  function handleApply(event) {\n    if (event.__asteryonV93Captured) return;\n    if (!(event.target instanceof Element) || !event.target.closest(\'[data-ltp-apply]\')) return;',
  );
}
if (!capture.includes('event.__asteryonV93Captured')) throw new Error('V93: bypass do capturador legado não foi materializado.');
write('public/preview-editor-v91-capture.js', capture);

// 3) Cache-busting de recursos contextuais; sem renomear eventos internos V91/V92.
for (const file of ['public/runtime-loader-v87.js']) {
  if (fs.existsSync(file)) replaceAllFile(file, '?v=92', '?v=93');
}

// 4) Versão corrente do pacote e lock.
const pkg = JSON.parse(read('package.json'));
pkg.version = VERSION;
pkg.scripts.test = pkg.scripts.test
  .replace('node scripts/qa-preview-editor-v92-team4.mjs', 'node scripts/qa-preview-editor-v92-team4.mjs && node scripts/qa-preview-editor-v93.mjs')
  .replace('node scripts/qa-version-v92.mjs', 'node scripts/qa-version-v93.mjs');
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
replaceAllFile('package-lock.json', '"version": "2.1.92"', '"version": "2.1.93"');
write('VERSION', '93\n');

// 5) Health/release do Worker: altera apenas campos explícitos de versão/release.
let workerVersionHits = 0;
walk('worker', file => file.endsWith('.ts'), file => {
  let source = read(file);
  const before = source;
  source = source.replace(/version\s*:\s*['"]V92['"]/g, "version: 'V93'");
  source = source.replace(/release\s*:\s*['"]V92['"]/g, "release: 'V93'");
  if (source !== before) {
    workerVersionHits += 1;
    write(file, source);
  }
});
console.log(`V93: campos de versão explícitos atualizados em ${workerVersionHits} arquivo(s) do Worker.`);

// 6) Marcador estático no arquivo fonte V93 para QA e rastreabilidade.
let v93 = read('public/preview-editor-v93-source.js');
if (!v93.includes(MARKER)) v93 = v93.replace("  'use strict';", `  'use strict';\n  const ${MARKER}=true;`);
write('public/preview-editor-v93-source.js', v93);

console.log('V93 materializada: templates antigas bloqueadas para aplicação direta; Preview preenchido é a fonte corrente.');