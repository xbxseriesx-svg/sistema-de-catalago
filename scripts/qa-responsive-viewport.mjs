import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const published = read('frontend/src/editor/components/PublishedDocument.tsx');
const runtime = read('public/responsive-v67.js');
const html = read('public/index.html');
const e2e = read('tests/e2e/auto-responsive.spec.mjs');

for (const token of [
  'const MOBILE_MAX = 767',
  'const TABLET_MAX = 1100',
  'document.documentElement?.clientWidth',
  'horizontalScale',
  'window.visualViewport?.addEventListener("resize"',
  'overflowX: "clip"',
  'data-asteryon-published-device',
]) {
  assert.ok(published.includes(token), `PublishedDocument sem contrato responsivo obrigatório: ${token}`);
}

assert.equal(published.includes('window.innerWidth <= 640'), false, 'Breakpoint legado de 640 px não pode voltar');
assert.equal(published.includes('window.innerWidth <= 1024'), false, 'Breakpoint legado de 1024 px não pode voltar');
assert.equal(published.includes('transform: `scale('), false, 'Documento público não pode escalar tipografia inteira para compensar viewport/zoom');

for (const token of [
  'const MOBILE_MAX = 767',
  'const TABLET_MAX = 1100',
  "window.addEventListener('resize'",
  "window.addEventListener('orientationchange'",
  "window.visualViewport?.addEventListener('resize'",
  "window.dispatchEvent(new CustomEvent('asteryon:viewport-change'",
]) {
  assert.ok(runtime.includes(token), `Runtime público sem adaptação obrigatória: ${token}`);
}

assert.ok(html.includes('width=device-width, initial-scale=1.0, viewport-fit=cover'), 'Viewport precisa respeitar a largura CSS real do navegador');
assert.equal(/user-scalable\s*=\s*no/i.test(html), false, 'Zoom do navegador não pode ser bloqueado');
assert.equal(/maximum-scale\s*=\s*1/i.test(html), false, 'Pinch/browser zoom não pode ser limitado');

for (const width of ['1920', '1440', '1152', '960', '834', '768', '720', '430', '390', '360']) {
  assert.ok(e2e.includes(`width: ${width}`), `Matriz E2E não cobre viewport ${width}px`);
}
assert.ok(e2e.includes("device: 'desktop'"));
assert.ok(e2e.includes("device: 'tablet'"));
assert.ok(e2e.includes("device: 'mobile'"));
assert.ok(e2e.includes('scrollWidth'), 'E2E precisa bloquear regressão de overflow horizontal');

console.log('QA Responsivo: OK — desktop/tablet/mobile alinhados, zoom nativo preservado e matriz 360–1920 px coberta.');
