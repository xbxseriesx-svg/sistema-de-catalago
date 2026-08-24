(() => {
  'use strict';
  if (window.__ASTERYON_COMMERCIAL_SEGMENTS_V95__) return;
  window.__ASTERYON_COMMERCIAL_SEGMENTS_V95__ = true;

  const VERSION = '95';
  const ACTION = 'commercial-segment';
  const normalize = (value) => String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const state = {
    segments: [],
    actions: new Map(),
    selectedNodeId: '',
    panel: null,
    select: null,
    status: null,
    modal: null,
    productState: null,
    searchTimer: 0,
  };

  const jsonFetch = async (url, init) => {
    const response = await fetch(url, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) throw new Error(payload?.error?.message || `Falha HTTP ${response.status}`);
    return payload;
  };

  function walk(value, visitor, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    visitor(value);
    if (Array.isArray(value)) value.forEach((item) => walk(item, visitor, seen));
    else Object.values(value).forEach((item) => walk(item, visitor, seen));
  }

  function absorbActions(payload) {
    walk(payload, (item) => {
      const props = item?.props;
      if (!item?.id || !props || typeof props !== 'object') return;
      if (props.actionType === ACTION && props.actionSegmentId) {
        state.actions.set(String(item.id), {
          segmentId: String(props.actionSegmentId),
          segmentName: String(props.actionSegmentName || ''),
        });
      }
    });
    syncPanel();
  }

  function rewriteDraft(payload) {
    walk(payload, (item) => {
      if (!item?.id || !state.actions.has(String(item.id))) return;
      const choice = state.actions.get(String(item.id));
      item.props = item.props && typeof item.props === 'object' ? item.props : {};
      if (!choice?.segmentId) {
        if (item.props.actionType === ACTION) {
          item.props.actionType = 'none';
          item.props.actionSegmentId = '';
          item.props.actionSegmentName = '';
          item.props.actionValue = '';
          item.props.href = '';
        }
        return;
      }
      Object.assign(item.props, {
        actionType: ACTION,
        actionSegmentId: choice.segmentId,
        actionSegmentName: choice.segmentName,
        actionValue: choice.segmentId,
        actionTarget: 'same',
        href: `/catalogo?segment=${encodeURIComponent(choice.segmentId)}`,
      });
    });
    return payload;
  }

  function installFetchBridge() {
    if (window.__ASTERYON_COMMERCIAL_FETCH_V95__) return;
    window.__ASTERYON_COMMERCIAL_FETCH_V95__ = true;
    const previous = window.fetch.bind(window);
    window.fetch = async (...raw) => {
      let [input, init] = raw;
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method === 'PUT' && /\/api\/admin\/pages\/[^/]+\/draft(?:\?|$)/.test(String(url)) && typeof init?.body === 'string') {
          const payload = JSON.parse(init.body);
          rewriteDraft(payload);
          init = { ...init, body: JSON.stringify(payload) };
        }
      } catch (error) {
        console.warn('ASTERYON V95: não foi possível enriquecer o rascunho com a ação comercial.', error);
      }
      const response = await previous(input, init);
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method === 'GET' && /\/api\/admin\/pages\/[^/]+\/draft(?:\?|$)/.test(String(url))) {
          const payload = await response.clone().json();
          absorbActions(payload);
        }
      } catch (error) {
        console.warn('ASTERYON V95: rascunho original preservado após falha de leitura da ação comercial.', error);
      }
      return response;
    };
  }

  function selectedAction() {
    return state.actions.get(state.selectedNodeId) || null;
  }

  function syncPanel() {
    if (!state.select || !state.status) return;
    const action = selectedAction();
    state.select.value = action?.segmentId || '';
    state.status.textContent = action?.segmentId
      ? `Ação automática detectada: segmento → ${action.segmentName || 'segmento comercial'}`
      : state.selectedNodeId
        ? 'Ação automática detectada: none.'
        : 'Selecione um elemento no canvas para vincular o segmento.';
  }

  function forceSave() {
    window.dispatchEvent(new CustomEvent('asteryon:commercial-segment-change-v95', { detail: { version: VERSION } }));
    const buttons = [...document.querySelectorAll('button')];
    const save = buttons.find((button) => ['salvar', 'salvar alteracoes'].includes(normalize(button.textContent)));
    if (save && !save.disabled) window.setTimeout(() => save.click(), 20);
  }

  async function loadSegments() {
    if (state.segments.length) return state.segments;
    const payload = await jsonFetch('/api/admin/commercial-segments');
    state.segments = Array.isArray(payload?.segments) ? payload.segments : [];
    return state.segments;
  }

  function fieldLabel(text) {
    const label = document.createElement('label');
    label.textContent = text;
    Object.assign(label.style, { display: 'block', margin: '10px 0 5px', color: '#7f8797', font: '500 10px/1.3 Inter,Arial,sans-serif' });
    return label;
  }

  function editorSelect() {
    const select = document.createElement('select');
    Object.assign(select.style, {
      width: '100%', height: '30px', border: '1px solid #3a3e49', borderRadius: '4px',
      background: '#17191f', color: '#f5f7fb', padding: '0 10px', font: '500 11px Inter,Arial,sans-serif',
    });
    return select;
  }

  function findClickSection() {
    const labels = [...document.querySelectorAll('p,div,h2,h3,h4,span')];
    const title = labels.find((element) => normalize(element.textContent) === 'alinhamento e funcao ao clicar');
    if (!title) return null;
    let current = title.parentElement;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      const text = normalize(current.textContent);
      if (text.includes('tipo de destino') && text.includes('funcao ao clicar') && current.clientWidth < 500) return current;
    }
    return title.parentElement;
  }

  async function injectPanel() {
    if (!location.pathname.startsWith('/admin')) return;
    if (document.getElementById('asteryon-commercial-segments-v95')) return;
    const section = findClickSection();
    if (!section) return;
    try { await loadSegments(); } catch { return; }

    const box = document.createElement('div');
    box.id = 'asteryon-commercial-segments-v95';
    Object.assign(box.style, { marginTop: '9px', paddingTop: '9px', borderTop: '1px solid #303440' });
    box.appendChild(fieldLabel('Segmento comercial'));
    const select = editorSelect();
    select.innerHTML = '<option value="">Nenhum segmento</option>' + state.segments
      .map((segment) => `<option value="${segment.id}">${String(segment.name).replace(/</g, '&lt;')}</option>`).join('');
    select.addEventListener('change', () => {
      if (!state.selectedNodeId) {
        select.value = '';
        window.alert('Selecione primeiro o elemento do catálogo que receberá a ação de clique.');
        return;
      }
      const segment = state.segments.find((item) => item.id === select.value);
      state.actions.set(state.selectedNodeId, segment
        ? { segmentId: segment.id, segmentName: segment.name }
        : { segmentId: '', segmentName: '' });
      syncPanel();
      forceSave();
    });
    box.appendChild(select);

    const status = document.createElement('div');
    Object.assign(status.style, {
      marginTop: '8px', padding: '7px 9px', borderRadius: '4px', border: '1px solid #135d55',
      background: '#0d302d', color: '#6ee7c8', font: '600 10px/1.35 Inter,Arial,sans-serif',
    });
    box.appendChild(status);

    const help = document.createElement('p');
    help.textContent = 'O clique abre os produtos do segmento ordenados por prioridade comercial. O score interno nunca é exibido no catálogo público.';
    Object.assign(help.style, { margin: '8px 0 0', color: '#737b8d', font: '400 9px/1.45 Inter,Arial,sans-serif' });
    box.appendChild(help);

    const manage = document.createElement('button');
    manage.type = 'button';
    manage.textContent = 'Ajuste manual dos produtos';
    Object.assign(manage.style, {
      width: '100%', marginTop: '9px', padding: '7px 8px', borderRadius: '5px', border: '1px solid #315783',
      background: '#10243b', color: '#8fc5ff', font: '700 10px Inter,Arial,sans-serif', cursor: 'pointer',
    });
    manage.addEventListener('click', openManualModal);
    box.appendChild(manage);
    section.appendChild(box);
    state.panel = box;
    state.select = select;
    state.status = status;
    syncPanel();
  }

  function modalButton(text, primary = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    Object.assign(button.style, {
      border: `1px solid ${primary ? '#2563eb' : '#3c4657'}`, borderRadius: '6px',
      background: primary ? '#2563eb' : '#17202c', color: '#fff', padding: '8px 12px',
      font: '700 11px Inter,Arial,sans-serif', cursor: 'pointer',
    });
    return button;
  }

  function closeModal() {
    state.modal?.remove();
    state.modal = null;
    state.productState = null;
  }

  function renderProductSegments(host, payload) {
    host.innerHTML = '';
    state.productState = payload;
    const product = document.createElement('div');
    product.innerHTML = `<b>${payload.product.code} — ${payload.product.name}</b><br><span style="color:#8993a5;font-size:10px">Selecione no máximo ${payload.maxSegments || 5}. Score e motivo são internos.</span>`;
    product.style.marginBottom = '10px';
    host.appendChild(product);

    const selectedCount = () => [...host.querySelectorAll('input[data-segment-check]')].filter((item) => item.checked).length;
    for (const segment of payload.segments || []) {
      const row = document.createElement('div');
      row.dataset.segmentId = segment.id;
      Object.assign(row.style, { display: 'grid', gridTemplateColumns: '22px minmax(150px,1fr) 72px minmax(180px,1.5fr)', gap: '7px', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #29303b' });
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.dataset.segmentCheck = '1';
      check.checked = Boolean(segment.selected);
      const name = document.createElement('span');
      name.textContent = segment.name;
      name.style.fontSize = '11px';
      const score = document.createElement('input');
      score.type = 'number'; score.min = '30'; score.max = '100'; score.value = String(segment.score ?? 70); score.dataset.score = '1';
      const reason = document.createElement('input');
      reason.type = 'text'; reason.value = segment.reason || ''; reason.placeholder = 'Motivo da associação'; reason.dataset.reason = '1';
      for (const input of [score, reason]) Object.assign(input.style, { minWidth: '0', border: '1px solid #3b4350', borderRadius: '5px', background: '#121820', color: '#eef2f7', padding: '6px 7px', fontSize: '10px' });
      const sync = () => { score.disabled = reason.disabled = !check.checked; score.style.opacity = reason.style.opacity = check.checked ? '1' : '.45'; };
      check.addEventListener('change', () => {
        if (check.checked && selectedCount() > (payload.maxSegments || 5)) {
          check.checked = false;
          window.alert(`É permitido no máximo ${payload.maxSegments || 5} segmentos por produto.`);
        }
        sync();
      });
      row.append(check, name, score, reason); host.appendChild(row); sync();
    }
  }

  async function loadProductDetail(productId, host) {
    host.innerHTML = '<div style="padding:12px;color:#8b95a7">Carregando classificação…</div>';
    try {
      const payload = await jsonFetch(`/api/admin/products/${encodeURIComponent(productId)}/commercial-segments`);
      renderProductSegments(host, payload);
    } catch (error) {
      host.innerHTML = `<div style="padding:12px;color:#fca5a5">${error.message}</div>`;
    }
  }

  async function searchProducts(query, resultSelect, detailHost) {
    try {
      const payload = await jsonFetch(`/api/admin/commercial-segments/products?q=${encodeURIComponent(query || '')}`);
      const products = Array.isArray(payload.products) ? payload.products : [];
      resultSelect.innerHTML = products.map((product) => `<option value="${product.id}">${String(product.code)} — ${String(product.name).replace(/</g, '&lt;')}</option>`).join('');
      if (products[0]) {
        resultSelect.value = products[0].id;
        loadProductDetail(products[0].id, detailHost);
      } else detailHost.innerHTML = '<div style="padding:12px;color:#8b95a7">Nenhum produto encontrado.</div>';
    } catch (error) {
      detailHost.innerHTML = `<div style="padding:12px;color:#fca5a5">${error.message}</div>`;
    }
  }

  async function saveManual(detailHost) {
    const payload = state.productState;
    if (!payload?.product?.id) return;
    const rows = [...detailHost.querySelectorAll('[data-segment-id]')];
    const selected = rows.filter((row) => row.querySelector('[data-segment-check]')?.checked).map((row) => ({
      segmentId: row.dataset.segmentId,
      score: Number(row.querySelector('[data-score]')?.value || 70),
      reason: String(row.querySelector('[data-reason]')?.value || '').trim(),
    }));
    try {
      await jsonFetch(`/api/admin/products/${encodeURIComponent(payload.product.id)}/commercial-segments`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ segments: selected }),
      });
      await loadProductDetail(payload.product.id, detailHost);
      window.alert('Ajuste manual salvo. Ele será preservado nas próximas importações.');
    } catch (error) { window.alert(error.message); }
  }

  async function restoreAutomatic(detailHost) {
    const productId = state.productState?.product?.id;
    if (!productId) return;
    try {
      await jsonFetch(`/api/admin/products/${encodeURIComponent(productId)}/commercial-segments/recalculate`, { method: 'POST' });
      await loadProductDetail(productId, detailHost);
      window.alert('Classificação automática restaurada.');
    } catch (error) { window.alert(error.message); }
  }

  function openManualModal() {
    if (state.modal) return;
    const overlay = document.createElement('div');
    overlay.id = 'asteryon-commercial-manual-v95';
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483000', background: 'rgba(2,6,12,.78)', display: 'grid', placeItems: 'center', padding: '22px' });
    const card = document.createElement('div');
    Object.assign(card.style, { width: 'min(1050px,96vw)', maxHeight: '90vh', overflow: 'auto', border: '1px solid #394252', borderRadius: '12px', background: '#0f141c', color: '#eef2f7', boxShadow: '0 30px 90px rgba(0,0,0,.55)', padding: '18px', fontFamily: 'Inter,Arial,sans-serif' });
    const header = document.createElement('div');
    header.innerHTML = '<b style="font-size:15px">Ajuste manual de segmentos comerciais</b><div style="margin-top:4px;color:#8d98aa;font-size:10px">A revisão manual prevalece sobre a classificação automática e permanece protegida após novas importações.</div>';
    const close = modalButton('Fechar'); close.style.float = 'right'; close.addEventListener('click', closeModal); header.prepend(close); card.appendChild(header);

    const search = document.createElement('input');
    search.placeholder = 'Buscar por código ou descrição do produto';
    Object.assign(search.style, { width: '100%', marginTop: '16px', border: '1px solid #3a4350', borderRadius: '7px', background: '#111923', color: '#fff', padding: '9px 10px', fontSize: '11px' });
    const results = document.createElement('select'); results.size = 6;
    Object.assign(results.style, { width: '100%', marginTop: '8px', border: '1px solid #343d49', borderRadius: '7px', background: '#111923', color: '#eef2f7', padding: '5px', fontSize: '10px' });
    const detail = document.createElement('div'); detail.style.marginTop = '12px';
    const actions = document.createElement('div'); Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px', position: 'sticky', bottom: '0', padding: '10px 0 0', background: '#0f141c' });
    const automatic = modalButton('Restaurar automático'); automatic.addEventListener('click', () => restoreAutomatic(detail));
    const save = modalButton('Salvar ajuste manual', true); save.addEventListener('click', () => saveManual(detail));
    actions.append(automatic, save);
    card.append(search, results, detail, actions); overlay.appendChild(card); document.body.appendChild(overlay); state.modal = overlay;
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });
    results.addEventListener('change', () => results.value && loadProductDetail(results.value, detail));
    search.addEventListener('input', () => { clearTimeout(state.searchTimer); state.searchTimer = window.setTimeout(() => searchProducts(search.value, results, detail), 260); });
    searchProducts('', results, detail);
  }

  function trackSelection(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-node-id]') : null;
    if (!target) return;
    state.selectedNodeId = target.getAttribute('data-node-id') || '';
    syncPanel();
  }

  let frame = 0;
  const observer = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; injectPanel(); });
  });

  installFetchBridge();
  document.addEventListener('click', trackSelection, true);
  const boot = () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    injectPanel();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.__ASTERYON_COMMERCIAL_SEGMENTS_STATE_V95__ = state;
})();
