import { test, expect } from '@playwright/test';

async function installFixture(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.asteryonSurface = 'public';
    document.querySelector('#asteryon-public-b2b-v96-fixture')?.remove();
    const fixture = document.createElement('div');
    fixture.id = 'asteryon-public-b2b-v96-fixture';
    fixture.innerHTML = `
      <div class="ltp-shell">
        <header class="ltp-site-header">
          <div class="ltp-topline">Catálogo institucional para clientes e parceiros</div>
          <div class="ltp-mainnav">
            <div><img alt="ASTERYON" /></div>
            <nav class="ltp-navlinks">
              <span>INÍCIO</span><span>CATÁLOGO</span><span>DEPARTAMENTOS</span>
              <span>MARCAS</span><span>QUEM SOMOS</span><span>CONTATO</span>
            </nav>
            <div class="ltp-navbadge">ATACADO B2B</div>
          </div>
          <div class="ltp-searchrow"><input placeholder="Buscar"/><button>Buscar</button></div>
          <div class="ltp-deptbar"><span>Atacado</span><span>Distribuição</span><span>Parceiros</span></div>
        </header>
        <section class="ltp-hero">
          <div class="ltp-hero-copy">
            <div class="ltp-kicker">MODELO OFICIAL</div>
            <h1>Um catálogo completo para apresentar a força da distribuidora.</h1>
            <p>Estrutura B2B responsiva com enquadramento convencional e zoom nativo do navegador.</p>
            <div class="ltp-hero-actions"><span class="ltp-btn ltp-btn-primary">Explorar catálogo</span></div>
          </div>
          <div class="ltp-hero-visual"><div class="ltp-hero-card"></div></div>
        </section>
      </div>`;
    document.body.appendChild(fixture);
  });
}

async function metrics(page) {
  return page.evaluate(() => {
    const fixture = document.querySelector('#asteryon-public-b2b-v96-fixture');
    const shell = fixture?.querySelector('.ltp-shell');
    const hero = fixture?.querySelector('.ltp-hero');
    const title = fixture?.querySelector('.ltp-hero h1');
    if (!(fixture instanceof HTMLElement) || !(shell instanceof HTMLElement) || !(hero instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      throw new Error('Fixture B2B V96 ausente.');
    }
    const heroStyle = getComputedStyle(hero);
    const titleStyle = getComputedStyle(title);
    const paddingLeft = Number.parseFloat(heroStyle.paddingLeft || '0');
    const paddingRight = Number.parseFloat(heroStyle.paddingRight || '0');
    return {
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      shellWidth: shell.getBoundingClientRect().width,
      heroInnerWidth: hero.getBoundingClientRect().width - paddingLeft - paddingRight,
      columns: heroStyle.gridTemplateColumns,
      titleFont: Number.parseFloat(titleStyle.fontSize || '0'),
      transform: getComputedStyle(shell).transform,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ ok: true }),
  }));
});

test('site público V96 usa enquadramento B2B contido em 100% e não cresce junto com a viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await installFixture(page);

  const at1440 = await metrics(page);
  expect(at1440.scrollWidth).toBeLessThanOrEqual(at1440.viewport + 1);
  expect(at1440.heroInnerWidth).toBeLessThanOrEqual(1320);
  expect(at1440.titleFont).toBeLessThanOrEqual(56.1);
  expect(at1440.transform).toBe('none');

  await page.setViewportSize({ width: 1920, height: 1080 });
  const at1920 = await metrics(page);
  expect(at1920.scrollWidth).toBeLessThanOrEqual(at1920.viewport + 1);
  expect(at1920.heroInnerWidth).toBeLessThanOrEqual(1320);
  // O conteúdo central não deve esticar para acompanhar toda a tela/zoom-out.
  expect(Math.abs(at1920.heroInnerWidth - at1440.heroInnerWidth)).toBeLessThan(30);
  expect(at1920.transform).toBe('none');
});

test('site público V96 faz reflow real em tablet e celular sem miniaturização por scale', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await installFixture(page);
  const tablet = await metrics(page);
  expect(tablet.scrollWidth).toBeLessThanOrEqual(tablet.viewport + 1);
  expect(tablet.columns.trim().split(/\s+/)).toHaveLength(1);
  expect(tablet.transform).toBe('none');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await metrics(page);
  expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.viewport + 1);
  expect(mobile.columns.trim().split(/\s+/)).toHaveLength(1);
  expect(mobile.titleFont).toBeLessThanOrEqual(40.1);
  expect(mobile.transform).toBe('none');
});

test('zoom nativo continua sob controle do Chromium sem contra-escala pública', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await installFixture(page);

  const session = await page.context().newCDPSession(page);
  const before = await page.evaluate(() => ({
    scale: window.visualViewport?.scale || 1,
    width: window.visualViewport?.width || window.innerWidth,
    transform: getComputedStyle(document.querySelector('#asteryon-public-b2b-v96-fixture .ltp-shell')).transform,
  }));

  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 });
  await expect.poll(() => page.evaluate(() => window.visualViewport?.scale || 1)).toBeGreaterThan(1.4);

  const after = await page.evaluate(() => ({
    scale: window.visualViewport?.scale || 1,
    width: window.visualViewport?.width || window.innerWidth,
    transform: getComputedStyle(document.querySelector('#asteryon-public-b2b-v96-fixture .ltp-shell')).transform,
    meta: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
  }));

  expect(after.scale).toBeGreaterThan(before.scale);
  expect(after.width).toBeLessThan(before.width);
  expect(before.transform).toBe('none');
  expect(after.transform).toBe('none');
  expect(after.meta).toContain('user-scalable=yes');

  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
});
