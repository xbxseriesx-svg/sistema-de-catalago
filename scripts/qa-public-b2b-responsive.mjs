import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const html = read('public/index.html');
const css = read('public/public-b2b-responsive-v96.css');
const executableCss = css.replace(/\/\*[\s\S]*?\*\//g, '');

assert.ok(
  html.includes('/public-b2b-responsive-v96.css?v=96'),
  'A camada pública V96 precisa estar carregada depois dos estilos base.',
);
assert.ok(
  /width=device-width,\s*initial-scale=1(?:\.0)?/i.test(html),
  'Viewport público precisa iniciar em 100% sem escala artificial.',
);
assert.ok(/user-scalable\s*=\s*yes/i.test(html), 'Zoom nativo precisa permanecer explicitamente permitido.');
assert.equal(/user-scalable\s*=\s*no/i.test(html), false, 'Zoom nativo não pode ser bloqueado.');
assert.equal(/maximum-scale\s*=\s*1(?:\.0+)?(?:[,"\s])/i.test(html), false, 'Zoom não pode ser travado em 100%.');

for (const token of [
  'html[data-asteryon-surface="public"]',
  '--asteryon-public-content: 1360px',
  '.ltp-shell',
  '.ltp-mainnav',
  '.ltp-searchrow',
  '.ltp-deptbar',
  '.ltp-hero',
  '.ltp-products',
  '@media (min-width: 768px) and (max-width: 1199px)',
  '@media (max-width: 767px)',
]) {
  assert.ok(executableCss.includes(token), `Contrato B2B público ausente: ${token}`);
}

// O visitante deve funcionar como um site B2B convencional: o navegador é o
// único responsável por magnificação. Nenhuma contra-escala pode voltar.
for (const forbidden of [
  /transform\s*:\s*scale\s*\(/i,
  /\bzoom\s*:/i,
  /devicePixelRatio/i,
  /visualViewport\s*\.\s*scale/i,
  /outerWidth/i,
  /innerWidth/i,
  /pageScaleFactor/i,
  /horizontalScale/i,
  /fitScale/i,
]) {
  assert.equal(forbidden.test(executableCss), false, `CSS público V96 contém compensação de zoom proibida: ${forbidden}`);
}

// Não permitir que o stylesheet público invada explicitamente o editor/admin.
assert.equal(executableCss.includes('data-asteryon-surface="editor"'), false, 'V96 público não pode estilizar o editor.');
assert.equal(/(?:^|[,{]\s*)[^{}]*(?:\/admin|data-asteryon-admin)[^{}]*\{/im.test(executableCss), false, 'V96 público não pode conter seletor administrativo.');

// 100% deve ser mais contido que a prévia histórica de 1440px/72px de hero.
assert.ok(executableCss.includes('min-height: 440px'), 'Hero público deve ter enquadramento B2B contido em 100%.');
assert.ok(executableCss.includes('font-size: clamp(36px, 3.6vw, 56px)'), 'Título do hero precisa ter escala visual confortável em desktop 100%.');
assert.ok(executableCss.includes('padding: 48px var(--asteryon-public-inline)'), 'Hero precisa usar gutters B2B centrais em desktop.');

console.log('QA Público B2B V96: OK — zoom nativo preservado, 100% contido e breakpoints CSS isolados do editor.');
