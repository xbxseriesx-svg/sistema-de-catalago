(() => {
  'use strict';

  if (window.__ASTERYON_PREVIEW_EDITOR_V93_VISUAL_GATE__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V93_VISUAL_GATE__ = true;

  const S = window.__ASTERYON_V91_STATE__;
  if (!S) return;
  let startedAt = 0;
  let timer = 0;

  function visualItems(nodes) {
    const list = [];
    const walk = (item, movingCarousel = false) => {
      if (!item) return;
      const moving = movingCarousel || (item.props?.carousel === true && item.props?.carouselAnimated === true);
      list.push({ item, movingCarousel: moving });
      (item.children || []).forEach(child => walk(child, moving));
    };
    (nodes || []).forEach(item => walk(item, false));
    return list;
  }

  function expectedNodes() {
    return Array.isArray(S.capturedNodes) ? S.capturedNodes : window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__;
  }

  function rectError(expected, actual, item, movingCarousel = false) {
    const carouselTrack = movingCarousel && item.props?.carousel === true && item.props?.carouselAnimated === true;
    const expectedWidth = carouselTrack ? Number(item.width || expected.width) : Number(expected.width || 0);
    const expectedHeight = carouselTrack ? Number(item.height || expected.height) : Number(expected.height || 0);
    const limitX = Math.max(10, Number(expected.width || expectedWidth) * .045);
    const limitY = Math.max(10, Number(expected.height || expectedHeight) * .045);
    const dx = Math.abs(actual.x - Number(expected.x || 0));
    const dy = Math.abs(actual.y - Number(expected.y || 0));
    const dw = Math.abs(actual.width - expectedWidth);
    const dh = Math.abs(actual.height - expectedHeight);
    return {
      dx, dy, dw, dh,
      movingCarousel,
      expectedWidth,
      expectedHeight,
      ok: (movingCarousel || dx <= limitX) && dy <= limitY && dw <= limitX && dh <= limitY,
    };
  }

  function verify() {
    if (!S.isEditor()) return;
    const nodes = expectedNodes();
    if (!Array.isArray(nodes) || !nodes.length) return;
    if (!startedAt) startedAt = Date.now();

    const page = nodes[0];
    const pageWrapper = document.querySelector(`[data-node-id="${CSS.escape(page.id)}"]`);
    if (!(pageWrapper instanceof HTMLElement)) {
      if (Date.now() - startedAt < 4000) return;
      fail('página V93 não renderizada', { pageId: page.id });
      return;
    }

    const pageRect = pageWrapper.getBoundingClientRect();
    if (pageRect.width < 20) return;
    const scale = pageRect.width / Math.max(1, Number(page.width || 1440));
    const entries = visualItems(nodes).filter(({ item }) => item.type !== 'page' && item.props?.previewSourceRect && !item.props?.duplicateForLoop);
    if (entries.length < 10) return;

    const missing = [];
    const drift = [];
    let animatedCarouselNodesAudited = 0;
    for (const { item, movingCarousel } of entries) {
      const wrapper = document.querySelector(`[data-node-id="${CSS.escape(item.id)}"]`);
      if (!(wrapper instanceof HTMLElement)) { missing.push(item.id); continue; }
      const rect = wrapper.getBoundingClientRect();
      const actual = {
        x: (rect.left - pageRect.left) / scale,
        y: (rect.top - pageRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      };
      if (movingCarousel) animatedCarouselNodesAudited += 1;
      const check = rectError(item.props.previewSourceRect, actual, item, movingCarousel);
      if (!check.ok) drift.push({ id: item.id, name: item.name, type: item.type, expected: item.props.previewSourceRect, actual, ...check });
    }

    const items = entries.map(({ item }) => item);
    const textNodes = items.filter(item => ['text','button'].includes(item.type) && item.props?.text);
    const canvasText = S.normalize([...document.querySelectorAll('[data-node-id]')].map(item => item.textContent || '').join(' | '));
    const missingTexts = [...new Set(textNodes.map(item => S.normalize(item.props.text)).filter(Boolean))].filter(text => !canvasText.includes(text));
    const products = items.filter(item => item.props?.previewProductCard);
    const productDrift = drift.filter(item => products.some(product => product.id === item.id));
    const heroTexts = textNodes.filter(item => /hero|ltp-hero/i.test(item.name || item.props?.previewClassName || ''));
    const missingHeroTexts = heroTexts.filter(item => !canvasText.includes(S.normalize(item.props.text))).map(item => item.props.text);

    const allowedDrift = Math.max(2, Math.floor(items.length * .03));
    const ok = missing.length === 0 && missingTexts.length === 0 && missingHeroTexts.length === 0
      && drift.length <= allowedDrift && productDrift.length === 0;

    const report = {
      version: '93', checkedAt: new Date().toISOString(), ok,
      expectedVisualNodes: items.length, renderedVisualNodes: items.length - missing.length,
      missingNodes: missing, missingTexts, missingHeroTexts,
      geometryDriftCount: drift.length, allowedGeometryDrift: allowedDrift,
      productGeometryDriftCount: productDrift.length,
      animatedCarouselNodesAudited,
      animatedCarouselRule: 'faixa animada pode variar em X; Y, largura, altura, conteúdo e largura 2x do loop permanecem obrigatórios',
      geometryDrift: drift.slice(0, 25),
      rule: 'Editor V93 deve manter posição, tamanho, proporção, textos e produtos da Prévia preenchida.',
    };

    document.documentElement.dataset.asteryonV93VisualParity = ok ? 'approved' : 'failed';
    window.__ASTERYON_PREVIEW_EDITOR_VISUAL_V93__ = report;
    if (S.report) {
      Object.assign(S.report, {
        visualGeometryOk: ok, visualGeometryReport: report,
        ok: S.report.ok !== false && ok,
      });
      window.__ASTERYON_PREVIEW_EDITOR_PARITY_V91__ = S.report;
    }
    window.dispatchEvent(new CustomEvent('asteryon:preview-editor-visual-parity-v93', { detail: report }));
    if (!ok) {
      console.error('ASTERYON V93 — divergência visual', report);
      showBanner(report);
    } else document.getElementById('asteryon-v93-visual-error')?.remove();
    clearInterval(timer);
  }

  function showBanner(report) {
    let banner = document.getElementById('asteryon-v93-visual-error');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'asteryon-v93-visual-error';
      Object.assign(banner.style, {
        position: 'fixed', left: '16px', right: '16px', bottom: '16px', zIndex: 2147483300,
        padding: '12px 16px', borderRadius: '10px', background: '#7f1d1d', color: '#fff',
        font: '700 12px/1.45 Inter,Arial,sans-serif', boxShadow: '0 12px 36px rgba(0,0,0,.28)',
      });
      document.body.appendChild(banner);
    }
    banner.textContent = `Grupo 3 V93: REPROVADO — ${report.geometryDriftCount} divergências geométricas, ${report.missingTexts.length} textos ausentes e ${report.productGeometryDriftCount} cards de produto fora de proporção.`;
  }

  function fail(message, details) {
    const report = { version: '93', ok: false, message, details, checkedAt: new Date().toISOString() };
    document.documentElement.dataset.asteryonV93VisualParity = 'failed';
    window.__ASTERYON_PREVIEW_EDITOR_VISUAL_V93__ = report;
    window.dispatchEvent(new CustomEvent('asteryon:preview-editor-visual-parity-v93', { detail: report }));
    showBanner({ geometryDriftCount: 1, missingTexts: [], productGeometryDriftCount: 0 });
    clearInterval(timer);
  }

  function blockPublish(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button,[role="button"]');
    if (!button || S.normalize(button.textContent) !== 'publicar') return;
    if (!expectedNodes()?.length) return;
    if (document.documentElement.dataset.asteryonV93VisualParity === 'approved') return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    alert('Publicação bloqueada pelo Grupo 3 V93: a geometria e os textos do Editor ainda não correspondem à Prévia preenchida.');
  }

  window.addEventListener('asteryon:preview-final-copied-v93', () => {
    startedAt = 0;
    document.documentElement.dataset.asteryonV93VisualParity = 'pending';
    clearInterval(timer);
    timer = setInterval(verify, 350);
  });
  document.addEventListener('click', blockPublish, true);
  if (expectedNodes()?.length) timer = setInterval(verify, 350);
})();