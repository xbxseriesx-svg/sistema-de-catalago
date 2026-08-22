import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const ORIGIN = process.env.ASTERYON_PRODUCTION_URL || 'https://sistema-de-catalago.xbxseriesx.workers.dev';
const EXPECTED_RUNTIME_MARKER = 'public-experience-v94.js?v=94.1';
const WAIT_MS = Number(process.env.ASTERYON_DEPLOY_WAIT_MS || 8 * 60 * 1000);
const POLL_MS = 10_000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchFresh(path, options = {}) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('_asteryon_live_qa', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    ...options,
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      ...(options.headers || {}),
    },
  });
}

async function waitForDeployment() {
  const deadline = Date.now() + WAIT_MS;
  let last = 'sem resposta';
  while (Date.now() < deadline) {
    try {
      const loader = await fetchFresh('/runtime-loader-v87.js?v=94&perf=88');
      const text = await loader.text();
      const experience = await fetchFresh('/public-experience-v94.js?v=94.1');
      if (loader.ok && experience.ok && text.includes(EXPECTED_RUNTIME_MARKER)) {
        console.log(`LIVE QA: deploy novo detectado em ${ORIGIN}`);
        return;
      }
      last = `loader=${loader.status}, experience=${experience.status}, marker=${text.includes(EXPECTED_RUNTIME_MARKER)}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    console.log(`LIVE QA: aguardando propagação (${last})`);
    await sleep(POLL_MS);
  }
  throw new Error(`Deploy não ficou observável no endereço real dentro de ${WAIT_MS}ms: ${last}`);
}

async function assertJson200(path, predicate, label) {
  const response = await fetchFresh(path, { headers: { accept: 'application/json' } });
  const text = await response.text();
  assert.equal(response.status, 200, `${label} deve responder 200; recebeu ${response.status}: ${text.slice(0, 500)}`);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    assert.fail(`${label} não retornou JSON válido: ${text.slice(0, 500)}`);
  }
  assert.ok(predicate(payload), `${label} retornou payload inesperado`);
  console.log(`LIVE QA OK: ${label} -> 200`);
  return payload;
}

await waitForDeployment();

await assertJson200('/api/health', payload => payload?.ok !== false && payload?.supabase?.connected === true, '/api/health');
await assertJson200('/api/public/catalog', payload => payload?.ok === true && Array.isArray(payload?.catalog?.products), '/api/public/catalog');
await assertJson200('/api/public/brands', payload => payload?.ok === true && Array.isArray(payload?.brands), '/api/public/brands');
await assertJson200('/api/public/marketing', payload => payload?.ok === true && payload?.marketing && typeof payload.marketing === 'object', '/api/public/marketing');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'pt-BR',
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
const runtimeErrors = [];
const failedResponses = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
});
page.on('response', response => {
  const url = response.url();
  if (url.startsWith(ORIGIN) && response.status() >= 400) failedResponses.push(`${response.status()} ${url}`);
});

const liveUrl = new URL('/', ORIGIN);
liveUrl.searchParams.set('_asteryon_live_qa', String(Date.now()));
await page.goto(liveUrl.toString(), { waitUntil: 'networkidle', timeout: 90_000 });
await page.locator('#root').waitFor({ state: 'visible', timeout: 30_000 });
assert.ok((await page.locator('#root').innerText()).trim().length > 0, 'raiz pública real ficou vazia');
assert.equal(await page.getByText(/Falha interna ao executar a operação/i).count(), 0, 'público real caiu no fallback de falha interna');

const zoomControl = page.locator('[data-asteryon-public-zoom-control="true"]');
await zoomControl.waitFor({ state: 'visible', timeout: 30_000 });
assert.equal(await zoomControl.locator('[data-zoom-value]').innerText(), '85%', 'zoom público padrão deve iniciar em 85%');
assert.equal(await page.locator('#root').evaluate(el => el.style.zoom), '0.85', 'root público real não recebeu zoom 85%');

await page.getByRole('button', { name: 'Aumentar zoom da página' }).click();
assert.equal(await zoomControl.locator('[data-zoom-value]').innerText(), '90%', 'controle + não atualizou zoom real');
await page.getByRole('button', { name: 'Diminuir zoom da página' }).click();
assert.equal(await zoomControl.locator('[data-zoom-value]').innerText(), '85%', 'controle − não atualizou zoom real');

const heading = page.getByText(/Marcas do portf[oó]lio/i).first();
await heading.waitFor({ state: 'visible', timeout: 30_000 });
const track = page.locator('[data-asteryon-brand-track="true"]').first();
await track.waitFor({ state: 'visible', timeout: 30_000 });

const carouselAudit = await track.evaluate(async element => {
  const viewport = element.parentElement;
  if (!(viewport instanceof HTMLElement)) throw new Error('viewport do carrossel ausente');
  const originalCount = Number(element.dataset.asteryonBrandOriginalCount || 0);
  const cloneCount = element.querySelectorAll(':scope > [data-asteryon-brand-clone="true"]').length;
  const animations = element.getAnimations();
  const animation = animations[0];
  const samples = [];

  if (!animation) throw new Error('animação contínua do carrossel ausente');
  animation.pause();
  const timing = animation.effect?.getComputedTiming();
  const duration = Number(timing?.duration || 0);
  if (!(duration > 0)) throw new Error('duração da animação inválida');

  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  for (const fraction of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 0.995]) {
    animation.currentTime = duration * fraction;
    await nextFrame();
    const viewportRect = viewport.getBoundingClientRect();
    const visible = [...element.children].filter(child => {
      const rect = child.getBoundingClientRect();
      return rect.right > viewportRect.left + 1 && rect.left < viewportRect.right - 1 && rect.bottom > viewportRect.top && rect.top < viewportRect.bottom;
    }).length;
    samples.push({ fraction, visible });
  }
  animation.play();
  return {
    originalCount,
    cloneCount,
    sampleVisibleCounts: samples,
    trackWidth: element.scrollWidth,
    viewportWidth: viewport.clientWidth,
  };
});

assert.ok(carouselAudit.originalCount >= 2, `carrossel real encontrou poucas marcas: ${carouselAudit.originalCount}`);
assert.ok(carouselAudit.cloneCount >= carouselAudit.originalCount, `carrossel real sem clones suficientes: ${carouselAudit.cloneCount}`);
assert.ok(carouselAudit.trackWidth > carouselAudit.viewportWidth * 1.5, 'faixa do carrossel não cobre a viewport com folga');
for (const sample of carouselAudit.sampleVisibleCounts) {
  assert.ok(sample.visible >= 2, `buraco detectado no carrossel em ${(sample.fraction * 100).toFixed(1)}% do ciclo: ${sample.visible} cards visíveis`);
}
console.log(`LIVE QA OK: Marcas do portfólio sem buraco em ${carouselAudit.sampleVisibleCounts.length} pontos do ciclo`);

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(250);
  const audit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    zoomVisible: !!document.querySelector('[data-asteryon-public-zoom-control="true"]')?.getClientRects().length,
  }));
  assert.ok(audit.overflow <= 2, `overflow horizontal em ${viewport.width}x${viewport.height}: ${audit.overflow}px`);
  assert.equal(audit.zoomVisible, true, `controle de zoom inacessível em ${viewport.width}x${viewport.height}`);
}

await page.goto(new URL('/admin', ORIGIN).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(1200);
assert.equal(await page.locator('[data-asteryon-public-zoom-control="true"]').count(), 0, 'controle público vazou para /admin');

const relevantFailures = failedResponses.filter(line => !/favicon|googleapis|gstatic/i.test(line));
assert.deepEqual(runtimeErrors, [], `erros de runtime no endereço real:\n${runtimeErrors.join('\n')}`);
assert.deepEqual(relevantFailures, [], `respostas HTTP quebradas no endereço real:\n${relevantFailures.join('\n')}`);

await browser.close();
console.log(`LIVE PRODUCTION QA APROVADO: ${ORIGIN} — APIs, zoom, responsividade, carrossel e isolamento do /admin validados.`);
