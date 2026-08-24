import { test, expect } from '@playwright/test';

const baseProps = (className, sourceRect, tag = 'div') => ({
  previewFinalSource: true,
  previewFinalVersion: '93',
  templateCurrentVersion: 'V93',
  previewLayoutGroup: true,
  previewClassName: className,
  previewDomTag: tag,
  previewSourceRect: sourceRect,
});

function segment(id, x, sourceY = 200) {
  return {
    id,
    type: 'group', name: id, x, y: 0, width: 200, height: 130,
    responsive: { desktop: { x, y: 0, width: 200, height: 130 }, tablet: { x: x * .58, y: 0, width: 116, height: 75 }, mobile: { x: x * .27, y: 0, width: 54, height: 35 } },
    props: baseProps('ltp-segment', { x: 88 + x, y: sourceY, width: 200, height: 130 }),
    styles: {}, children: [],
  };
}

function product(id, x, y, absoluteX, absoluteY) {
  return {
    id,
    type: 'group', name: id, x, y, width: 240.8, height: 352.5,
    responsive: { desktop: { x, y, width: 240.8, height: 352.5 }, tablet: { x: x * .58, y: y * .58, width: 139.5, height: 204 }, mobile: { x: x * .27, y: y * .27, width: 65.2, height: 95.5 } },
    props: baseProps('ltp-product', { x: absoluteX, y: absoluteY, width: 240.8, height: 352.5 }),
    styles: {},
    children: [
      {
        id: `${id}-media`, type: 'group', name: 'media', x: 0, y: 0, width: 240.8, height: 185,
        responsive: { desktop: { x: 0, y: 0, width: 240.8, height: 185 }, tablet: { x: 0, y: 0, width: 139.5, height: 107 }, mobile: { x: 0, y: 0, width: 65.2, height: 50 } },
        props: baseProps('ltp-product-media', { x: absoluteX, y: absoluteY, width: 240.8, height: 185 }),
        styles: {}, children: [],
      },
      {
        id: `${id}-body`, type: 'group', name: 'body', x: 0, y: 185, width: 240.8, height: 167.5,
        responsive: { desktop: { x: 0, y: 185, width: 240.8, height: 167.5 }, tablet: { x: 0, y: 107, width: 139.5, height: 97 }, mobile: { x: 0, y: 50, width: 65.2, height: 45.5 } },
        props: baseProps('ltp-product-body', { x: absoluteX, y: absoluteY + 185, width: 240.8, height: 167.5 }),
        styles: {},
        children: [
          {
            id: `${id}-title`, type: 'text', name: 'Produto QA', x: 0, y: 25, width: 210, height: 40,
            responsive: { desktop: { x: 0, y: 25, width: 210, height: 40 }, tablet: { x: 0, y: 14, width: 122, height: 23 }, mobile: { x: 0, y: 7, width: 57, height: 11 } },
            props: { ...baseProps('', { x: absoluteX + 15, y: absoluteY + 210, width: 210, height: 40 }, 'h3'), text: `Produto ${id}` },
            styles: {}, children: [],
          },
        ],
      },
    ],
  };
}

function fixture() {
  const segmentSection = {
    id: 'segment-section', type: 'group', name: 'Segmentos', x: 0, y: 0, width: 1440, height: 394,
    responsive: { desktop: { x: 0, y: 0, width: 1440, height: 394 }, tablet: { x: 0, y: 0, width: 834, height: 228 }, mobile: { x: 0, y: 0, width: 390, height: 107 } },
    props: baseProps('ltp-section', { x: 0, y: 0, width: 1440, height: 394 }, 'section'), styles: {},
    children: [{
      id: 'segments-grid', type: 'group', name: 'Grid segmentos', x: 88, y: 196, width: 1264, height: 130,
      responsive: { desktop: { x: 88, y: 196, width: 1264, height: 130 }, tablet: { x: 51, y: 113, width: 732, height: 75 }, mobile: { x: 24, y: 53, width: 342, height: 35 } },
      props: baseProps('ltp-segments', { x: 88, y: 196, width: 1264, height: 130 }), styles: {},
      children: [segment('s1', 0), segment('s2', 219), segment('s3', 430), segment('s4', 640), segment('s5', 850), segment('s6', 1063)],
    }],
  };

  const productSectionY = 394;
  const productGridY = productSectionY + 196;
  const products = [];
  const xs = [0, 255.8, 511.6, 767.4, 1023.2];
  for (let i = 0; i < 5; i += 1) products.push(product(`p${i + 1}`, xs[i], 0, 88 + xs[i], productGridY));

  const productSection = {
    id: 'product-section', type: 'group', name: 'Produtos', x: 0, y: productSectionY, width: 1440, height: 620,
    responsive: { desktop: { x: 0, y: productSectionY, width: 1440, height: 620 }, tablet: { x: 0, y: 228, width: 834, height: 359 }, mobile: { x: 0, y: 107, width: 390, height: 168 } },
    props: baseProps('ltp-section alt', { x: 0, y: productSectionY, width: 1440, height: 620 }, 'section'), styles: {},
    children: [{
      id: 'products-grid', type: 'group', name: 'Grid produtos', x: 88, y: 196, width: 1264, height: 352.5,
      responsive: { desktop: { x: 88, y: 196, width: 1264, height: 352.5 }, tablet: { x: 51, y: 113, width: 732, height: 204 }, mobile: { x: 24, y: 53, width: 342, height: 95.5 } },
      props: baseProps('ltp-products', { x: 88, y: productGridY, width: 1264, height: 352.5 }), styles: {}, children: products,
    }],
  };

  return [{
    id: 'page', type: 'page', name: 'Modelo Oficial', x: 0, y: 0, width: 1440, height: 1014,
    responsive: { desktop: { x: 0, y: 0, width: 1440, height: 1014 }, tablet: { x: 0, y: 0, width: 834, height: 587 }, mobile: { x: 0, y: 0, width: 390, height: 1200 } },
    props: { previewFinalSource: true, templateName: 'Modelo Oficial', sourceOfTruth: 'preview-final-filled-v93' }, styles: {},
    children: [segmentSection, productSection, {
      id: 'free-image', type: 'image', name: 'Imagem livre', x: 1210, y: 760, width: 60, height: 120,
      responsive: { desktop: { x: 1210, y: 760, width: 60, height: 120 }, tablet: { x: 1210, y: 760, width: 60, height: 120 }, mobile: { x: 1210, y: 760, width: 60, height: 120 } },
      props: { src: '' }, styles: {}, children: [],
    }],
  }];
}

test('motor V95.3 faz reflow real e automático em tablet/mobile, sem miniaturizar desktop', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => Boolean(window.AsteryonResponsiveAuto))).toBe(true);

  const result = await page.evaluate((nodes) => {
    const before = structuredClone(nodes);
    const changed = window.AsteryonResponsiveAuto.reflowNodes(nodes, true);
    const root = nodes[0];
    const segments = root.children[0].children[0].children;
    const products = root.children[1].children[0].children;
    const free = root.children[2];
    return {
      changed,
      version: window.AsteryonResponsiveAuto.version,
      before,
      root: root.responsive,
      segments: segments.map((item) => item.responsive),
      products: products.map((item) => item.responsive),
      free: free.responsive,
      props: root.props,
    };
  }, fixture());

  expect(result.changed).toBe(true);
  expect(result.version).toBe('95.3');
  expect(result.props.autoResponsive).toBe(true);
  expect(result.props.autoResponsiveMode).toBe('css-reflow');

  // Tablet: segmentos em 3 colunas. O quarto item precisa começar uma nova linha.
  expect(Math.abs(result.segments[0].tablet.y - result.segments[2].tablet.y)).toBeLessThan(2);
  expect(result.segments[3].tablet.y).toBeGreaterThan(result.segments[0].tablet.y + 80);

  // Mobile 390 px: segmentos em 2 colunas e produtos em UMA coluna (regra <= 430px).
  expect(Math.abs(result.segments[0].mobile.y - result.segments[1].mobile.y)).toBeLessThan(2);
  expect(result.segments[2].mobile.y).toBeGreaterThan(result.segments[0].mobile.y + 100);
  expect(Math.abs(result.products[0].mobile.x - result.products[1].mobile.x)).toBeLessThan(2);
  expect(result.products[1].mobile.y).toBeGreaterThan(result.products[0].mobile.y + 300);

  // Tablet: produtos em 3 colunas, então o quarto cai para a segunda linha.
  expect(Math.abs(result.products[0].tablet.y - result.products[2].tablet.y)).toBeLessThan(2);
  expect(result.products[3].tablet.y).toBeGreaterThan(result.products[0].tablet.y + 300);

  // A página cresce para acomodar o reflow; não pode ser a antiga escala 390/1440.
  expect(result.root.mobile.width).toBe(390);
  expect(result.root.mobile.height).toBeGreaterThan(1800);

  // Elementos livres também são trazidos automaticamente para dentro do viewport.
  expect(result.free.mobile.x).toBeGreaterThanOrEqual(0);
  expect(result.free.mobile.x + result.free.mobile.width).toBeLessThanOrEqual(390.01);
  expect(result.free.tablet.x + result.free.tablet.width).toBeLessThanOrEqual(834.01);
});
