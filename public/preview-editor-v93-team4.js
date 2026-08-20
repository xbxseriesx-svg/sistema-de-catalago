(() => {
  'use strict';

  if (window.__ASTERYON_PREVIEW_EDITOR_V93_TEAM4_RUNTIME__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V93_TEAM4_RUNTIME__ = true;

  const S = window.__ASTERYON_V91_STATE__;
  if (!S) return;

  function flatten(nodes) {
    const list = [];
    const walk = item => { if (!item) return; list.push(item); (item.children || []).forEach(walk); };
    (nodes || []).forEach(walk);
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
    const items = flatten(nodes).filter(item => item.type !== 'page' && item.props?.previewSourceRect && !item.props?.duplicateForLoop);
    const missing = [];
    const drift = [];
    const texts = [];
    const products = [];

    for (const item of items) {
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
      const limitW = Math.max(14, Number(expected.width || 0) * .06);
      const limitH = Math.max(14, Number(expected.height || 0) * .06);
      const bad = Math.abs(actual.x - expected.x) > limitW || Math.abs(actual.y - expected.y) > limitH
        || Math.abs(actual.width - expected.width) > limitW || Math.abs(actual.height - expected.height) > limitH;
      if (bad) drift.push({ id: item.id, name: item.name, type: item.type, expected, actual });
      if (['text','button'].includes(item.type) && item.props?.text) texts.push(S.normalize(item.props.text));
      if (item.props?.previewProductCard) products.push(item.id);
    }

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
      productGeometryDriftCount: productDrift.length, geometryDrift: drift.slice(0, 25),
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