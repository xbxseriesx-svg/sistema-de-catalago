import { test, expect } from '@playwright/test';

const props = (className, rect, tag = 'div') => ({
  previewFinalSource: true,
  previewFinalVersion: '93',
  templateCurrentVersion: 'V93',
  previewLayoutGroup: true,
  previewClassName: className,
  previewDomTag: tag,
  previewSourceRect: rect,
});

const responsive = (x, y, width, height) => ({
  desktop: { x, y, width, height },
  tablet: { x: x * .58, y: y * .58, width: width * .58, height: height * .58 },
  mobile: { x: x * .27, y: y * .27, width: width * .27, height: height * .27 },
});

function segment(id, x) {
  return {
    id, type: 'group', name: id, x, y: 0, width: 200, height: 130,
    responsive: responsive(x, 0, 200, 130),
    props: props('ltp-segment', { x: 88 + x, y: 196, width: 200, height: 130 }),
    styles: {}, children: [],
  };
}

function product(id, x, absoluteY) {
  return {
    id, type: 'group', name: id, x, y: 0, width: 240.8, height: 185,
    responsive: responsive(x, 0, 240.8, 185),
    props: props('ltp-product', { x: 88 + x, y: absoluteY, width: 240.8, height: 185 }),
    styles: {},
    children: [{
      id: `${id}-media`, type: 'group', name: 'media', x: 0, y: 0, width: 240.8, height: 185,
      responsive: responsive(0, 0, 240.8, 185),
      props: props('ltp-product-media', { x: 88 + x, y: absoluteY, width: 240.8, height: 185 }),
      styles: {}, children: [],
    }],
  };
}

function fixture() {
  const segmentSection = {
    id: 'segment-section', type: 'group', name: 'Segmentos', x: 0, y: 0, width: 1440, height: 394,
    responsive: responsive(0, 0, 1440, 394),
    props: props('ltp-section', { x: 0, y: 0, width: 1440, height: 394 }, 'section'), styles: {},
    children: [{
      id: 'segments-grid', type: 'group', name: 'Grid segmentos', x: 88, y: 196, width: 1264, height: 130,
      responsive: responsive(88, 196, 1264, 130),
      props: props('ltp-segments', { x: 88, y: 196, width: 1264, height: 130 }), styles: {},
      children: [segment('s1', 0), segment('s2', 219), segment('s3', 430), segment('s4', 640), segment('s5', 850), segment('s6', 1063)],
    }],
  };

  const productSectionY = 394;
  const productGridY = productSectionY + 196;
  const xs = [0, 255.8, 511.6, 767.4, 1023.2];
  const productSection = {
    id: 'product-section', type: 'group', name: 'Produtos', x: 0, y: productSectionY, width: 1440, height: 520,
    responsive: responsive(0, productSectionY, 1440, 520),
    props: props('ltp-section alt', { x: 0, y: productSectionY, width: 1440, height: 520 }, 'section'), styles: {},
    children: [{
      id: 'products-grid', type: 'group', name: 'Grid produtos', x: 88, y: 196, width: 1264, height: 185,
      responsive: responsive(88, 196, 1264, 185),
      props: props('ltp-products', { x: 88, y: productGridY, width: 1264, height: 185 }), styles: {},
      children: xs.map((x, index) => product(`p${index + 1}`, x, productGridY)),
    }],
  };

  return [{
    id: 'page', type: 'page', name: 'Modelo Oficial', x: 0, y: 0, width: 1440, height: 914,
    responsive: responsive(0, 0, 1440, 914),
    props: { previewFinalSource: true, templateName: 'Modelo Oficial', sourceOfTruth: 'preview-final-filled-v93' }, styles: {},
    children: [segmentSection, productSection, {
      id: 'free-image', type: 'image', name: 'Imagem livre', x: 1210, y: 760, width: 60, height: 120,
      responsive: responsive(1210, 760, 60, 120), props: { src: '' }, styles: {}, children: [],
    }],
  }];
}

test('motor V95.3 faz reflow real e automático em tablet/mobile, sem miniaturizar desktop', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ ok: true }),
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.AsteryonResponsiveAuto))).toBe(true);

  const result = await page.evaluate((nodes) => {
    const changed = window.AsteryonResponsiveAuto.reflowNodes(nodes, true);
    const root = nodes[0];
    return {
      changed,
      version: window.AsteryonResponsiveAuto.version,
      root: root.responsive,
      segments: root.children[0].children[0].children.map((item) => item.responsive),
      products: root.children[1].children[0].children.map((item) => item.responsive),
      free: root.children[2].responsive,
      props: root.props,
    };
  }, fixture());

  expect(result.changed).toBe(true);
  expect(result.version).toBe('95.3');
  expect(result.props.autoResponsive).toBe(true);
  expect(result.props.autoResponsiveMode).toBe('css-reflow');

  // Tablet: segmentos em 3 colunas e produtos em 3 colunas.
  expect(Math.abs(result.segments[0].tablet.y - result.segments[2].tablet.y)).toBeLessThan(2);
  expect(result.segments[3].tablet.y).toBeGreaterThan(result.segments[0].tablet.y + 100);
  expect(Math.abs(result.products[0].tablet.y - result.products[2].tablet.y)).toBeLessThan(2);
  expect(result.products[3].tablet.y).toBeGreaterThan(result.products[0].tablet.y + 180);

  // Mobile 390 px: segmentos em 2 colunas e produtos em uma coluna pela regra <= 430px.
  expect(Math.abs(result.segments[0].mobile.y - result.segments[1].mobile.y)).toBeLessThan(2);
  expect(result.segments[2].mobile.y).toBeGreaterThan(result.segments[0].mobile.y + 100);
  expect(Math.abs(result.products[0].mobile.x - result.products[1].mobile.x)).toBeLessThan(2);
  expect(result.products[1].mobile.y).toBeGreaterThan(result.products[0].mobile.y + 150);

  // O conteúdo cresce verticalmente; não pode voltar à escala matemática 390/1440.
  expect(result.root.mobile.width).toBe(390);
  expect(result.root.mobile.height).toBeGreaterThan(1300);

  // Elementos livres também são ancorados automaticamente dentro de cada viewport.
  expect(result.free.mobile.x).toBeGreaterThanOrEqual(0);
  expect(result.free.mobile.x + result.free.mobile.width).toBeLessThanOrEqual(390.01);
  expect(result.free.tablet.x + result.free.tablet.width).toBeLessThanOrEqual(834.01);
});
