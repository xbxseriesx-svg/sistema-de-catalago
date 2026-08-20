import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [html, bridge, preview] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/resolved-template-v90.js', 'utf8'),
  readFile('public/template-preview-v69.js', 'utf8'),
]);

assert.match(html, /resolved-template-v90\.js\?v=89/,
  'A ponte V90 precisa carregar antes do bundle na release V89.');
assert.ok(
  html.indexOf('/resolved-template-v90.js') < html.indexOf('/assets/index-V60Excel.js'),
  'A ponte V90 precisa ser instalada antes do bundle principal para interceptar a carga dos modelos.',
);

assert.match(bridge, /\/api\/admin\/templates/,
  'A ponte V90 precisa enriquecer os templates antes da aplicação.');
assert.match(bridge, /locked:\s*false/,
  'Nós aplicados precisam chegar destravados ao editor.');
assert.match(bridge, /editableStyleProperties:\s*EDITABLE_STYLE_KEYS/,
  'Elementos precisam declarar propriedades visuais editáveis.');
assert.match(bridge, /headerEditable:\s*true/,
  'Cabeçalho precisa ser explicitamente editável.');
assert.match(bridge, /colorsEditable:\s*true/,
  'Cores do cabeçalho precisam permanecer editáveis.');
assert.match(bridge, /input\[type=\\"color\\"\]/,
  'Controles nativos de cor precisam ser liberados no editor.');

assert.match(bridge, /asteryonBrandsMarqueeV90/,
  'Marcas precisam usar animação contínua de carrossel.');
assert.match(bridge, /carouselAnimated:\s*true/,
  'O estado aplicado precisa registrar carrossel de marcas animado.');
assert.match(bridge, /carouselLoop:\s*true/,
  'O carrossel de marcas precisa manter loop.');
assert.match(bridge, /carouselPauseOnHover:\s*true/,
  'O carrossel precisa preservar pausa no hover como configuração.');

assert.match(bridge, /persistPreviewSnapshot\(\)/,
  'O Preview Final preenchido precisa gerar snapshot de transição.');
assert.match(bridge, /asteryon_resolved_template_v90/,
  'O snapshot resolvido precisa ter chave de persistência estável.');
assert.match(bridge, /modelo aplicado com sucesso\./,
  'A navegação ao editor só deve ocorrer após confirmação da aplicação.');
assert.match(bridge, /normalize\(button\.textContent\) === 'editar'/,
  'Após aplicar, o fluxo precisa entrar no editor do modelo aplicado.');
assert.match(preview, /data-ltp-apply/,
  'O preview V69 deve continuar expondo o gatilho usado pela ponte V90.');

execFileSync(process.execPath, ['--check', 'public/resolved-template-v90.js'], { stdio: 'pipe' });

console.log('QA V90 Preview Final -> Editor editável + carrossel de marcas: OK');
