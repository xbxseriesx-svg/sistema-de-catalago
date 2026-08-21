(() => {
  'use strict';
  const ASTER_V94_EDITOR_PERFORMANCE = true;

  if (window.__ASTERYON_PREVIEW_EDITOR_V91_RUNTIME__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V91_RUNTIME__ = true;
  const S = window.__ASTERYON_V91_STATE__;
  if (!S) return;

  const REPORT_KEY = 'asteryon_preview_editor_parity_v91';
  const NODES_KEY = 'asteryon_preview_editor_nodes_v91';
  const perf = window.__ASTERYON_EDITOR_PERF_V94__ ||= {
    version: '94', runtimeRuns: 0, observerSchedules: 0, parityPolls: 0,
    interactionSchedules: 0, lastRunAt: 0,
  };
  let editorSeenAt = 0;
  let saveTimer = 0;
  let frame = 0;
  let parityTimer = 0;

  function installStyles() {
    if (document.getElementById('asteryon-preview-editor-v91-styles')) return;
    const style = document.createElement('style');
    style.id = 'asteryon-preview-editor-v91-styles';
    style.textContent = `
      @keyframes asteryonBrandsMarqueeV91 { from { transform:translate3d(0,0,0); } to { transform:translate3d(-50%,0,0); } }
      [data-node-id^="asteryon-brands-carousel-track-v91"],[data-element-id^="asteryon-brands-carousel-track-v91"] { animation:asteryonBrandsMarqueeV91 24s linear infinite!important; will-change:transform; }
      [data-node-id^="asteryon-brands-carousel-track-v91"]:hover,[data-element-id^="asteryon-brands-carousel-track-v91"]:hover { animation-play-state:paused!important; }
      #asteryon-v91-parity-error { position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;padding:12px 16px;border-radius:10px;background:#7f1d1d;color:#fff;font:700 12px/1.45 Inter,Arial,sans-serif;box-shadow:0 12px 36px rgba(0,0,0,.28); }
      #asteryon-v91-background-editor { position:fixed;right:18px;bottom:18px;z-index:2147482000;width:min(350px,calc(100vw - 36px));padding:10px;border:1px solid #DCE6F2;border-radius:12px;background:#fff;color:#172033;box-shadow:0 14px 40px rgba(18,63,125,.18);font:600 11px/1.35 Inter,Arial,sans-serif; }
      #asteryon-v91-background-editor input[type="text"] { width:100%;margin-top:7px;border:1px solid #DCE6F2;border-radius:7px;padding:7px 8px;font:500 10px Inter,Arial,sans-serif; }
      #asteryon-v91-background-editor .v91-row { display:flex;align-items:center;gap:8px;margin-top:7px; }
    `;
    document.head.appendChild(style);
  }

  function expectedNodes() {
    if (Array.isArray(S.capturedNodes)) return S.capturedNodes;
    if (Array.isArray(window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__)) return window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__;
    try {
      const payload = JSON.parse(sessionStorage.getItem(NODES_KEY) || 'null');
      if (Array.isArray(payload?.nodes)) {
        S.capturedNodes = payload.nodes;
        return payload.nodes;
      }
    } catch { /* noop */ }
    return null;
  }

  function flatten(nodes) {
    const list = [];
    function walk(item) {
      if (!item) return;
      list.push(item);
      if (item.id && !S.capturedNodeIndex.has(item.id)) S.capturedNodeIndex.set(item.id, item);
      (item.children || []).forEach(walk);
    }
    (nodes || []).forEach(walk);
    return list;
  }

  function showError(message) {
    let banner = document.getElementById('asteryon-v91-parity-error');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'asteryon-v91-parity-error';
      document.body.appendChild(banner);
    }
    banner.textContent = `Grupo 3: NÃO APROVADO — ${message} A regra manda retornar ao Grupo 1.`;
  }

  function verifyInitialParity() {
    if (S.initialParityChecked || !S.isEditor()) return;
    if (!editorSeenAt) editorSeenAt = Date.now();
    const nodes = expectedNodes();
    if (!nodes?.length) return;
    const expected = flatten(nodes);
    const wrappers = [...document.querySelectorAll('[data-node-id]')];
    const enoughTime = Date.now() - editorSeenAt >= 2500;
    if (!enoughTime && wrappers.length < Math.max(5, Math.floor(expected.length * .8))) return;

    const expectedImages = [...new Set(expected.filter((item) => item.type === 'image' && item.props?.src).map((item) => S.absoluteUrl(item.props.src)))];
    const expectedBrands = [...new Set(expected.filter((item) => item.props?.brandLogoAuto && item.props?.src).map((item) => S.absoluteUrl(item.props.src)))];
    const expectedTexts = [...new Set(expected.filter((item) => ['text','button'].includes(item.type) && item.props?.text).map((item) => S.normalize(item.props.text)).filter(Boolean))];
    const actualImages = [...new Set([...document.querySelectorAll('[data-node-id] img[src]')].map((item) => S.absoluteUrl(item.getAttribute('src'))))];
    const canvasText = S.normalize(wrappers.map((item) => item.textContent || '').join(' | '));
    const missingImages = expectedImages.filter((item) => !actualImages.includes(item));
    const missingBrands = expectedBrands.filter((item) => !actualImages.includes(item));
    const missingTexts = expectedTexts.filter((item) => !canvasText.includes(item));
    const nodeCountOk = wrappers.length >= Math.floor(expected.length * .95);
    const ok = nodeCountOk && missingImages.length === 0 && missingBrands.length === 0 && missingTexts.length === 0;

    S.initialParityChecked = true;
    document.documentElement.dataset.asteryonPreviewEditorParity = ok ? 'ok' : 'failed';
    const report = {
      ...(S.report || {}),
      version: '91',
      editorCheckedAt: new Date().toISOString(),
      expectedNodes: expected.length,
      editorRenderedNodes: wrappers.length,
      missingEditorImages: missingImages,
      missingEditorBrandLogos: missingBrands,
      missingEditorTexts: missingTexts,
      editorInitialParityOk: ok,
      ok,
      group3: ok ? 'APROVADO' : 'REPROVADO — retornar ao Grupo 1',
    };
    S.report = report;
    window.__ASTERYON_PREVIEW_EDITOR_PARITY_V91__ = report;
    try { sessionStorage.setItem(REPORT_KEY, JSON.stringify(report)); } catch { /* noop */ }
    if (ok) document.getElementById('asteryon-v91-parity-error')?.remove();
    else showError('o Editor inicial ainda não é uma cópia completa do Preview Final preenchido.');
    window.dispatchEvent(new CustomEvent('asteryon:preview-editor-parity-v91', { detail: report }));
  }

  function selectedWrapper() {
    const handle = document.querySelector('[style*="nwse-resize"],[style*="nesw-resize"],[style*="ns-resize"],[style*="ew-resize"]');
    return handle?.closest?.('[data-node-id]') || null;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const button = [...document.querySelectorAll('button')].find((item) => {
        const text = S.normalize(item.textContent);
        return text === 'salvar' || text === 'salvar alteracoes';
      });
      if (button && !button.disabled) button.click();
    }, 180);
  }

  function handleBrandChange(event) {
    if (!S.isEditor() || !(event.target instanceof HTMLSelectElement)) return;
    const select = event.target;
    const label = S.normalize(select.parentElement?.querySelector('span,label')?.textContent || select.parentElement?.textContent || '');
    if (!label.startsWith('marca')) return;
    const brand = S.findBrand(select.value);
    const logo = S.brandLogo(brand);
    if (!brand || !logo) return;
    const wrapper = selectedWrapper();
    const nodeId = wrapper?.getAttribute('data-node-id');
    const image = wrapper?.querySelector('img');
    if (!nodeId || !image) return;

    const override = { brandId: S.brandId(brand), src: logo, name: S.clean(brand.name) };
    S.brandOverrides.set(nodeId, override);
    image.setAttribute('src', logo);
    image.setAttribute('alt', override.name);
    const indexed = S.capturedNodeIndex.get(nodeId);
    if (indexed?.props) Object.assign(indexed.props, {
      brandId: override.brandId, brandName: override.name, src: override.src,
      actionContext: 'brand', actionType: 'brand-page', actionEntityId: override.brandId, actionValue: override.brandId,
    });
    scheduleSave();
  }

  function applyOverrides() {
    if (!S.isEditor()) return;
    for (const [id, override] of S.brandOverrides.entries()) {
      const wrapper = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      const image = wrapper?.querySelector('img');
      if (image && !S.sameUrl(image.getAttribute('src'), override.src)) image.setAttribute('src', override.src);
    }
    for (const [id, override] of S.styleOverrides.entries()) {
      const wrapper = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      const surface = wrapper?.firstElementChild;
      if (surface instanceof HTMLElement) {
        if (Object.hasOwn(override, 'background')) surface.style.background = override.background || '';
        if (override.backgroundColor) surface.style.backgroundColor = override.backgroundColor;
      }
    }
  }

  function backgroundEditor() {
    if (!S.isEditor()) {
      document.getElementById('asteryon-v91-background-editor')?.remove();
      return;
    }
    const wrapper = selectedWrapper();
    const id = wrapper?.getAttribute('data-node-id');
    const item = id ? S.capturedNodeIndex.get(id) : null;
    if (!item?.styles) {
      document.getElementById('asteryon-v91-background-editor')?.remove();
      return;
    }
    const background = S.styleOverrides.get(id)?.background ?? item.styles.background ?? '';
    const color = S.styleOverrides.get(id)?.backgroundColor ?? item.styles.backgroundColor ?? '#ffffff';
    const hasBackground = S.clean(background) || (!S.transparent(color) && item.type !== 'text');
    if (!hasBackground) {
      document.getElementById('asteryon-v91-background-editor')?.remove();
      return;
    }
    let panel = document.getElementById('asteryon-v91-background-editor');
    if (panel?.dataset.nodeId === id) return;
    panel?.remove();
    panel = document.createElement('div');
    panel.id = 'asteryon-v91-background-editor';
    panel.dataset.nodeId = id;
    panel.innerHTML = '<strong>Fundo / gradiente — edição completa V91</strong><input type="text" data-v91-background aria-label="Fundo ou gradiente CSS"><div class="v91-row"><input type="color" data-v91-solid aria-label="Cor sólida"><span>Cor sólida (substitui o gradiente)</span></div>';
    document.body.appendChild(panel);
    const text = panel.querySelector('[data-v91-background]');
    const picker = panel.querySelector('[data-v91-solid]');
    text.value = background;
    picker.value = /^#[0-9a-f]{6}$/i.test(color) ? color : '#ffffff';
    text.addEventListener('change', () => {
      const value = S.clean(text.value);
      S.styleOverrides.set(id, { ...(S.styleOverrides.get(id) || {}), background: value });
      item.styles.background = value;
      applyOverrides();
      scheduleSave();
    });
    picker.addEventListener('input', () => {
      const value = picker.value;
      S.styleOverrides.set(id, { ...(S.styleOverrides.get(id) || {}), background: '', backgroundColor: value });
      item.styles.background = '';
      item.styles.backgroundColor = value;
      text.value = '';
      applyOverrides();
      scheduleSave();
    });
  }

  function blockBrokenPublish(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button,[role="button"]');
    if (!button || S.normalize(button.textContent) !== 'publicar') return;
    if (document.documentElement.dataset.asteryonPreviewEditorParity !== 'failed') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    alert('Publicação bloqueada pelo Grupo 3: o Editor inicial não ficou igual ao Preview Final preenchido. A regra exige voltar ao Grupo 1 e corrigir antes de publicar.');
  }

  function stopParityPolling() {
    if (!parityTimer) return;
    clearInterval(parityTimer);
    parityTimer = 0;
  }

  function run() {
    frame = 0;
    perf.runtimeRuns += 1;
    perf.lastRunAt = Date.now();
    installStyles();
    applyOverrides();
    verifyInitialParity();
    backgroundEditor();
    if (S.initialParityChecked) stopParityPolling();
  }

  function scheduleRun(source = 'interaction') {
    if (source === 'observer') perf.observerSchedules += 1;
    else perf.interactionSchedules += 1;
    if (!frame) frame = requestAnimationFrame(run);
  }

  function addedNodeNeedsRun(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches('[data-node-id],#asteryon-v91-background-editor')) return true;
    return !!node.querySelector?.('[data-node-id],#asteryon-v91-background-editor');
  }

  function mutationNeedsRun(records) {
    if (!S.initialParityChecked) return records.some((record) => record.type === 'childList' && record.addedNodes.length > 0);
    if (!S.brandOverrides.size && !S.styleOverrides.size) return false;
    return records.some((record) => record.type === 'childList' && [...record.addedNodes].some(addedNodeNeedsRun));
  }

  function ensureParityPolling() {
    if (parityTimer || S.initialParityChecked || !expectedNodes()?.length) return;
    parityTimer = setInterval(() => {
      perf.parityPolls += 1;
      if (S.initialParityChecked || !expectedNodes()?.length) {
        stopParityPolling();
        return;
      }
      if (S.isEditor()) scheduleRun('parity');
    }, 500);
  }

  function scheduleInteraction() {
    scheduleRun('interaction');
  }

  document.addEventListener('change', handleBrandChange, true);
  document.addEventListener('click', blockBrokenPublish, true);
  document.addEventListener('click', scheduleInteraction, true);
  document.addEventListener('pointerup', scheduleInteraction, true);
  document.addEventListener('keyup', scheduleInteraction, true);
  const observer = new MutationObserver((records) => {
    if (mutationNeedsRun(records)) scheduleRun('observer');
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('asteryon:preview-final-copied-v91', () => {
    editorSeenAt = 0;
    S.initialParityChecked = false;
    ensureParityPolling();
    scheduleRun('preview');
  });

  function start() {
    if (expectedNodes()?.length) ensureParityPolling();
    scheduleRun('startup');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.__ASTERYON_V91_GROUPS__ = Object.freeze({
    group1: 'captura Preview Final + diagnostica diferenças',
    group2: 'corrige árvore, logos vinculados, marcas, cores e carrossel',
    group3: 'testa Editor inicial contra Preview; somente OK permite aprovação/publicação',
    failRule: 'qualquer diferença retorna ao Grupo 1',
    v94Performance: 'sem observer de style/class/src durante drag/resize; polling existe somente com Preview pendente e encerra após paridade',
  });
})();
