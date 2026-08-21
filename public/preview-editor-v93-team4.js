(() => {
  'use strict';

  if (window.__ASTERYON_PREVIEW_EDITOR_V93_TEAM4_RUNTIME__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V93_TEAM4_RUNTIME__ = true;

  const S = window.__ASTERYON_V91_STATE__;
  if (!S) return;

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

  function independentAudit() {
    const nodes = Array.isArray(S.capturedNodes) ? S.capturedNodes : window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__;
    const group3 = window.__ASTERYON_PREVIEW_EDITOR_VISUAL_V93__;
    if (!Array.isArray(nodes) || !nodes.length || !group3) return null;
    const page = nodes[0];
    const pageWrapper = document.querySelector(`[data-node-id="${CSS.escape(page.id)}"]`);
    if (!(pageWrapper instanceof HTMLElement) || pageWrapper.getBoundingClientRect().width < 20) {
      return { version: '93', ok: false, reason: 'Equipe 4 não encontrou a página V93 renderizada.' };
    }

    const pageRect = pageWrapper.getBoundingClientRect();
    const scale = pageRect.width / Math.max(1, Number(page.width || 1440));
    const entries = visualItems(nodes).filter(({ item }) => item.type !== 'page' && item.props?.previewSourceRect && !item.props?.duplicateForLoop);
    const missing = [];
    const drift = [];
    const texts = [];
    const products = [];
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
      const expected = item.props.previewSourceRect;
      const carouselTrack = movingCarousel && item.props?.carousel === true && item.props?.carouselAnimated === true;
      const expectedWidth = carouselTrack ? Number(item.width || expected.width) : Number(expected.width || 0);
      const expectedHeight = carouselTrack ? Number(item.height || expected.height) : Number(expected.height || 0);
      const limitW = Math.max(14, Number(expected.width || expectedWidth) * .06);
      const limitH = Math.max(14, Number(expected.height || expectedHeight) * .06);
      if (movingCarousel) animatedCarouselNodesAudited += 1;
      const bad = (!movingCarousel && Math.abs(actual.x - Number(expected.x || 0)) > limitW)
        || Math.abs(actual.y - Number(expected.y || 0)) > limitH
        || Math.abs(actual.width - expectedWidth) > limitW
        || Math.abs(actual.height - expectedHeight) > limitH;
      if (bad) drift.push({ id: item.id, name: item.name, type: item.type, movingCarousel, expected, expectedWidth, expectedHeight, actual });
      if (['text','button'].includes(item.type) && item.props?.text) texts.push(S.normalize(item.props.text));
      if (item.props?.previewProductCard) products.push(item.id);
    }

    const items = entries.map(({ item }) => item);
    const canvasText = S.normalize([...document.querySelectorAll('[data-node-id]')].map(item => item.textContent || '').join(' | '));
    const missingTexts = [...new Set(texts.filter(Boolean))].filter(text => !canvasText.includes(text));
    const productDrift = drift.filter(item => products.includes(item.id));
    const group3Ok = group3.ok === true && document.documentElement.dataset.asteryonV93VisualParity === 'approved';
    const allowed = Math.max(2, Math.floor(items.length * .035));
    const ok = group3Ok && missing.length === 0 && missingTexts.length === 0 && drift.length <= allowed && productDrift.length === 0;

    return {
      version: '93', ok, approved: ok, checkedAt: new Date().toISOString(),
      group3Ok, expectedVisualNodes: items.length, missingNodes: missing,
      missingTexts, geometryDriftCount: drift.length, allowedGeometryDrift: allowed,
      productGeometryDriftCount: productDrift.length, animatedCarouselNodesAudited,
      animatedCarouselRule: 'Equipe 4 permite deslocamento X apenas dentro da faixa animada; dimensões, Y, textos e loop continuam auditados.',
      geometryDrift: drift.slice(0, 25),
      rule: 'Equipe 4 audita independentemente tamanho, posição, proporção, textos e produtos do Editor V93.',
    };
  }

  function publishState(report) {
    window.__ASTERYON_PREVIEW_EDITOR_TEAM4_V93__ = report;
    document.documentElement.dataset.asteryonTeam4V93 = report?.ok ? 'approved' : 'failed';
    window.dispatchEvent(new CustomEvent('asteryon:team4-v93-result', { detail: report }));
  }

  window.addEventListener('asteryon:preview-editor-visual-parity-v93', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const report = independentAudit();
      if (report) publishState(report);
    }));
  });

  function blockPublish(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button,[role="button"]');
    if (!button || S.normalize(button.textContent) !== 'publicar') return;
    if (!Array.isArray(S.capturedNodes) || !S.capturedNodes.length) return;
    if (document.documentElement.dataset.asteryonTeam4V93 === 'approved') return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    alert('Publicação bloqueada pela Equipe 4 V93: a template preenchida ainda não foi aprovada visualmente no Editor.');
  }

  document.addEventListener('click', blockPublish, true);
  window.__ASTERYON_V93_GROUPS__ = Object.freeze({
    group1: 'diagnostica vídeo e captura hierárquica da Prévia preenchida',
    group2: 'revisa tipografia, geometria, árvore corrente e bloqueio das templates antigas',
    group3: 'valida conteúdo + geometria real do Editor em desktop/mobile',
    group4: 'repete auditoria visual de forma independente e libera produção somente se aprovar',
    releaseRule: 'V93 só vai para produção com 4/4 grupos aprovados.',
  });
})();