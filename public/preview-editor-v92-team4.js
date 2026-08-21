(() => {
  'use strict';
  const ASTER_V94_TEAM4_IDLE_PERFORMANCE = true;

  if (window.__ASTERYON_PREVIEW_EDITOR_V92_TEAM4__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V92_TEAM4__ = true;

  const S = window.__ASTERYON_V91_STATE__;
  if (!S) return;

  const PREVIEW_ID = 'laurencini-template-preview-v69';
  const NODES_KEY = 'asteryon_preview_editor_nodes_v91';
  const TEAM4_KEY = 'asteryon_preview_editor_team4_v92';
  let auditTimer = 0;
  const state = {
    version: '92',
    preflight: null,
    editor: null,
    group3Apply: null,
    group3Editor: null,
    approved: false,
  };

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest('[data-asteryon-carousel-copy="v90"],[aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > .5 && rect.height > .5;
  }

  function textCandidate(element) {
    const tag = element.tagName;
    if (['SCRIPT','STYLE','SVG','PATH','IMG','INPUT','TEXTAREA','SELECT','OPTION'].includes(tag)) return false;
    const text = S.clean(element.textContent);
    if (!text) return false;
    if (['H1','H2','H3','H4','H5','H6','P','SPAN','STRONG','SMALL','LABEL','LI','A','BUTTON'].includes(tag)) {
      return !element.querySelector('img,input,textarea,select');
    }
    return tag === 'DIV' && element.childElementCount === 0;
  }

  function flatten(nodes) {
    const list = [];
    function walk(item) {
      if (!item) return;
      list.push(item);
      (item.children || []).forEach(walk);
    }
    (nodes || []).forEach(walk);
    return list;
  }

  function expectedNodes() {
    if (Array.isArray(S.capturedNodes)) return S.capturedNodes;
    if (Array.isArray(window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__)) return window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__;
    try {
      const payload = JSON.parse(sessionStorage.getItem(NODES_KEY) || 'null');
      if (Array.isArray(payload?.nodes)) return payload.nodes;
    } catch { /* noop */ }
    return null;
  }

  function sourceFingerprint(shell) {
    const images = [...shell.querySelectorAll('img[src]')]
      .filter(visible)
      .map((item) => S.absoluteUrl(item.getAttribute('src')))
      .filter(Boolean);
    const texts = [...shell.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,small,label,li,a,button,div')]
      .filter((item) => visible(item) && textCandidate(item))
      .map((item) => S.normalize(item.textContent))
      .filter((value) => value.length >= 2);
    const brandLogos = [...shell.querySelectorAll('.ltp-brand img[src]')]
      .filter(visible)
      .map((item) => S.absoluteUrl(item.getAttribute('src')))
      .filter(Boolean);
    return {
      images: [...new Set(images)],
      texts: [...new Set(texts)],
      brandLogos: [...new Set(brandLogos)],
    };
  }

  function targetFingerprint(nodes) {
    const list = flatten(nodes);
    const images = list.filter((item) => item.type === 'image' && item.props?.src).map((item) => S.absoluteUrl(item.props.src));
    const texts = list.filter((item) => ['text','button'].includes(item.type) && item.props?.text).map((item) => S.normalize(item.props.text)).filter(Boolean);
    const brandLogos = list.filter((item) => item.props?.brandLogoAuto && item.props?.src).map((item) => S.absoluteUrl(item.props.src));
    return {
      nodes: list.length,
      editable: list.filter((item) => item.props?.editable === true && item.props?.styleEditable === true).length,
      unlocked: list.filter((item) => item.locked === false).length,
      images: [...new Set(images)],
      texts: [...new Set(texts)],
      brandLogos: [...new Set(brandLogos)],
    };
  }

  function persist() {
    window.__ASTERYON_PREVIEW_EDITOR_TEAM4_V92__ = state;
    try { sessionStorage.setItem(TEAM4_KEY, JSON.stringify(state)); } catch { /* noop */ }
  }

  function banner(message) {
    let element = document.getElementById('asteryon-v92-team4-error');
    if (!element) {
      element = document.createElement('div');
      element.id = 'asteryon-v92-team4-error';
      Object.assign(element.style, {
        position: 'fixed', left: '16px', right: '16px', bottom: '64px', zIndex: '2147483100',
        padding: '12px 16px', borderRadius: '10px', background: '#7f1d1d', color: '#fff',
        font: '700 12px/1.45 Inter,Arial,sans-serif', boxShadow: '0 12px 36px rgba(0,0,0,.28)',
      });
      document.body.appendChild(element);
    }
    element.textContent = `Equipe 4: REPROVADO — ${message}`;
  }

  function clearBanner() {
    document.getElementById('asteryon-v92-team4-error')?.remove();
  }

  function group3ApplyOk(report) {
    return report?.ok === true
      && Array.isArray(report.missingImages) && report.missingImages.length === 0
      && Array.isArray(report.missingTexts) && report.missingTexts.length === 0
      && Array.isArray(report.missingBrandLogos) && report.missingBrandLogos.length === 0;
  }

  function verifyPreflight(group3Report, candidate = null) {
    const shell = candidate?.shell || document.getElementById(PREVIEW_ID)?.querySelector('.ltp-shell');
    const nodes = candidate?.nodes || expectedNodes();
    if (!(shell instanceof HTMLElement) || !nodes?.length) {
      const report = { version: '92', ok: false, reason: 'Preview ou árvore capturada indisponível para auditoria independente.' };
      state.preflight = report;
      state.approved = false;
      document.documentElement.dataset.asteryonTeam4Preflight = 'failed';
      persist();
      banner(report.reason);
      return report;
    }

    const source = sourceFingerprint(shell);
    const target = targetFingerprint(nodes);
    const missingImages = source.images.filter((item) => !target.images.includes(item));
    const missingTexts = source.texts.filter((item) => !target.texts.includes(item));
    const missingBrandLogos = source.brandLogos.filter((item) => !target.brandLogos.includes(item));
    const structuralOk = target.nodes > 10 && target.editable === target.nodes && target.unlocked === target.nodes;
    const ok = group3ApplyOk(group3Report) && structuralOk
      && missingImages.length === 0 && missingTexts.length === 0 && missingBrandLogos.length === 0;
    const report = {
      version: '92', stage: 'preflight', ok,
      group3Ok: group3ApplyOk(group3Report), structuralOk,
      source: { images: source.images.length, texts: source.texts.length, brandLogos: source.brandLogos.length },
      target: { nodes: target.nodes, editable: target.editable, unlocked: target.unlocked, images: target.images.length, texts: target.texts.length, brandLogos: target.brandLogos.length },
      missingImages, missingTexts, missingBrandLogos,
      checkedAt: new Date().toISOString(),
    };
    state.preflight = report;
    state.approved = false;
    document.documentElement.dataset.asteryonTeam4Preflight = ok ? 'approved' : 'failed';
    if (ok) clearBanner(); else banner('a validação independente do Preview Final encontrou divergências que o Grupo 3 não pode liberar.');
    persist();
    window.dispatchEvent(new CustomEvent('asteryon:team4-preflight-v92', { detail: report }));
    return report;
  }

  function stopAuditPolling() {
    if (!auditTimer) return;
    clearInterval(auditTimer);
    auditTimer = 0;
  }

  function verifyEditor(group3Report) {
    if (!S.isEditor()) return null;
    const nodes = expectedNodes();
    if (!nodes?.length) return null;
    const expected = flatten(nodes);
    const wrappers = [...document.querySelectorAll('[data-node-id]')];
    const expectedImages = [...new Set(expected.filter((item) => item.type === 'image' && item.props?.src).map((item) => S.absoluteUrl(item.props.src)))];
    const expectedBrands = [...new Set(expected.filter((item) => item.props?.brandLogoAuto && item.props?.src).map((item) => S.absoluteUrl(item.props.src)))];
    const expectedTexts = [...new Set(expected.filter((item) => ['text','button'].includes(item.type) && item.props?.text).map((item) => S.normalize(item.props.text)).filter(Boolean))];
    const actualImages = [...new Set([...document.querySelectorAll('[data-node-id] img[src]')].map((item) => S.absoluteUrl(item.getAttribute('src'))))];
    const canvasText = S.normalize(wrappers.map((item) => item.textContent || '').join(' | '));
    const missingImages = expectedImages.filter((item) => !actualImages.includes(item));
    const missingBrandLogos = expectedBrands.filter((item) => !actualImages.includes(item));
    const missingTexts = expectedTexts.filter((item) => !canvasText.includes(item));
    const nodeCountOk = wrappers.length >= Math.floor(expected.length * .95);
    const group3Ok = group3Report?.ok === true && group3Report?.editorInitialParityOk === true;
    const ok = group3Ok && nodeCountOk && missingImages.length === 0 && missingBrandLogos.length === 0 && missingTexts.length === 0;
    const report = {
      version: '92', stage: 'editor', ok, group3Ok, nodeCountOk,
      expectedNodes: expected.length, editorRenderedNodes: wrappers.length,
      missingImages, missingBrandLogos, missingTexts,
      checkedAt: new Date().toISOString(),
    };
    state.editor = report;
    state.approved = Boolean(state.preflight?.ok && report.ok);
    document.documentElement.dataset.asteryonTeam4Parity = state.approved ? 'approved' : 'failed';
    if (state.approved) {
      clearBanner();
      stopAuditPolling();
    } else banner('o Editor renderizado não reproduziu integralmente a árvore aprovada no Preview Final.');
    persist();
    window.dispatchEvent(new CustomEvent('asteryon:team4-editor-v92', { detail: report }));
    return report;
  }

  function blockApply(event) {
    if (!(event.target instanceof Element) || !event.target.closest('[data-ltp-apply]')) return;
    if (state.preflight?.ok === true) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    console.error('ASTERYON V92 — Equipe 4 bloqueou a aplicação.', state.preflight || state.group3Apply);
    alert('Modelo não aplicado.\n\nEquipe 4 reprovou a validação final do Preview.\n\nA aplicação só é liberada quando Equipe 3 e Equipe 4 aprovarem sem divergências.');
  }

  function blockPublish(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button,[role="button"]');
    if (!button || S.normalize(button.textContent) !== 'publicar') return;
    if (!expectedNodes()?.length) return;
    if (state.approved || document.documentElement.dataset.asteryonTeam4Parity === 'approved') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    alert('Publicação bloqueada pela Equipe 4: a validação independente do Preview Final e do Editor ainda não foi aprovada.');
  }

  function ensureAuditPolling() {
    if (auditTimer || state.approved) return;
    auditTimer = setInterval(() => {
      if (state.approved) {
        stopAuditPolling();
        return;
      }
      if (!S.isEditor()) return;
      const group3 = S.report || window.__ASTERYON_PREVIEW_EDITOR_PARITY_V91__;
      if (group3?.editorInitialParityOk != null) verifyEditor(group3);
    }, 700);
  }

  window.addEventListener('asteryon:team4-preflight-request-v92', (event) => {
    state.group3Apply = event.detail?.group3Report || null;
    state.approved = false;
    const report = verifyPreflight(state.group3Apply, event.detail?.result || null);
    if (event.detail) event.detail.team4Report = report;
    ensureAuditPolling();
  });
  window.addEventListener('asteryon:preview-final-copied-v91', (event) => {
    state.group3Apply = event.detail || state.group3Apply || null;
    state.approved = false;
    if (!state.preflight) verifyPreflight(state.group3Apply);
    ensureAuditPolling();
  });
  window.addEventListener('asteryon:preview-editor-parity-v91', (event) => {
    state.group3Editor = event.detail || null;
    verifyEditor(state.group3Editor);
  });
  document.addEventListener('click', blockApply, true);
  document.addEventListener('click', blockPublish, true);

  if (expectedNodes()?.length && !state.approved) ensureAuditPolling();

  persist();
  window.__ASTERYON_V92_GROUPS__ = Object.freeze({
    group1: 'captura o Preview Final e registra diferenças reais',
    group2: 'corrige árvore, conteúdo, logos, estilos e vínculos',
    group3: 'valida a equivalência antes e depois da aplicação',
    group4: 'audita independentemente a Equipe 3 e bloqueia aplicação/publicação se qualquer evidência divergir',
    releaseRule: 'somente Equipe 3 APROVADA + Equipe 4 APROVADA permitem liberar',
    v94Performance: 'polling independente encerra imediatamente apos aprovacao e reinicia apenas em nova aplicacao',
  });
})();
