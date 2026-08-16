import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const read = (path) => readFile(path, 'utf8');
const [css, js, index, importer, versionText, pkg, bundle] = await Promise.all([
  read('public/responsive-v67.css'),
  read('public/responsive-v67.js'),
  read('public/index.html'),
  read('public/importar-imagens.html'),
  read('VERSION'),
  read('package.json').then(JSON.parse),
  read('public/assets/index-V60Excel.js'),
]);

const version = Number(versionText.trim());
const packagePatch = Number(String(pkg.version).split('.').at(-1));
assert.ok(Number.isFinite(version) && version >= 67, 'VERSION precisa ser 67 ou superior.');
assert.equal(packagePatch, version, 'package.json precisa acompanhar VERSION.');

// Um único layout, com adaptação por CSS/JS.
assert.equal((index.match(/assets\/index-[^"']+\.js/g) || []).length, 1, 'Não pode haver bundles duplicados por dispositivo.');
assert.doesNotMatch(index, /mobile\.html|tablet\.html|desktop\.html/i, 'Não deve existir página duplicada por dispositivo.');
assert.match(index, /viewport-fit=cover/, 'Viewport precisa suportar safe areas em celulares modernos.');
assert.doesNotMatch(index, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i, 'Zoom do usuário não pode ser bloqueado.');

// Monitoramento de viewport e orientação, sincronizado ao renderer legado.
assert.match(js, /const MOBILE_MAX = 767/);
assert.match(js, /const TABLET_MAX = 1100/);
assert.match(js, /visualViewport/);
assert.match(js, /addEventListener\('resize'/);
assert.match(js, /addEventListener\('orientationchange'/);
assert.match(js, /asteryon:viewport-change/);
assert.match(js, /requestAnimationFrame/);
assert.match(js, /data-asteryon-mobile-toolbar/);
assert.match(js, /asteryonEditorSidebar/);
assert.match(js, /Fechar catálogo/);
assert.match(js, /Fechar produto/);
assert.match(js, /pointer: coarse/);
assert.match(js, /navigator\.maxTouchPoints/);
assert.match(bundle, /e<=767\?"mobile":e<=1100\?"tablet":"desktop"/, 'Renderer público perdeu os breakpoints reais.');
assert.match(bundle, /orientationchange/, 'Renderer público não reage à orientação.');
assert.match(bundle, /visualViewport/, 'Renderer público não reage ao visualViewport.');

// CSS moderno e unidades responsivas.
assert.match(css, /display:\s*flex/);
assert.match(css, /grid-template-columns/);
assert.match(css, /@media/);
assert.match(css, /clamp\(/);
assert.match(css, /\d+vw/);
assert.match(css, /\d+d?vh/);
assert.match(css, /\d+(?:\.\d+)?rem/);
assert.match(css, /max-width:\s*100%/);
assert.match(css, /overflow-x:\s*hidden/);
assert.match(css, /img,\s*\npicture,\s*\nvideo,\s*\ncanvas/);
assert.match(css, /font-size:\s*16px\s*!important/, 'Campos mobile precisam evitar zoom automático do Safari.');
assert.match(css, /min-height:\s*2\.75rem/, 'Controles touch precisam ter alvo mínimo adequado.');
assert.match(css, /data-asteryon-device="desktop"/);
assert.match(css, /data-asteryon-device="tablet"/);
assert.match(css, /data-asteryon-device="mobile"/);
assert.match(css, /data-asteryon-orientation="landscape"/);
assert.match(css, /data-asteryon-editor-sidebar/);
assert.match(css, /data-asteryon-catalog-modal-root/);
assert.match(css, /data-asteryon-product-modal-root/);
assert.match(css, /prefers-reduced-motion/);

// Importador isolado também usa a mesma camada responsiva.
assert.match(importer, /viewport-fit=cover/);
assert.match(importer, /responsive-v67\.css/);
assert.match(importer, /responsive-v67\.js/);
assert.doesNotMatch(importer, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);

// Auditoria de todos os arquivos de produção textuais relevantes.
const extensions = new Set(['.html', '.css', '.js', '.mjs', '.ts', '.json', '.jsonc', '.md']);
const roots = ['public', 'scripts', 'worker'];
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (/\.bak(?:\.|$)/i.test(entry.name)) continue;
    if (extensions.has(extname(entry.name))) files.push(path);
  }
}
for (const dir of roots) await walk(dir);

let fixedViewportMarkers = 0;
let horizontalOverflowMarkers = 0;
for (const file of files) {
  const source = await read(file);
  fixedViewportMarkers += (source.match(/\b(?:100vh|100vw)\b/g) || []).length;
  horizontalOverflowMarkers += (source.match(/overflow-x/g) || []).length;
}

assert.ok(files.length >= 20, `Auditoria deveria percorrer os arquivos de produção; encontrados ${files.length}.`);
assert.ok(fixedViewportMarkers > 0, 'Auditoria precisa detectar os tamanhos fixos legados tratados pela camada V67.');
assert.ok(horizontalOverflowMarkers > 0, 'Auditoria precisa incluir pontos de overflow horizontal.');

console.log(`QA Responsividade V67+ OK na V${version}: ${files.length} arquivos de produção auditados; renderer, viewport, orientação, toque, grids, modais e drawers validados.`);
