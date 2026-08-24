(() => {
  'use strict';

  if (window.__ASTERYON_PUBLIC_COMMERCIAL_SEGMENT_POPUP_V95__) return;
  window.__ASTERYON_PUBLIC_COMMERCIAL_SEGMENT_POPUP_V95__ = true;

  const VERSION = '95.2';
  const ROOT_ID = 'asteryon-commercial-segment-popup-v95';
  const PAGE_SIZE = 120;
  const state = {
    root: null,
    segmentId: '',
    segmentName: '',
    products: [],
    offset: 0,
    hasMore: false,
    loadingMore: false,
    previousOverflow: '',
    segmentsPromise: null,
    publishedMappings: [],
    mappingsReady: false,
  };

  const text = (value) => String(value ?? '').trim();
  const normalize = (value) => text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const escapeHtml = (value) => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  async function jsonFetch(url) {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error?.message || `Falha ao consultar segmento (${response.status})`);
    }
    return payload;
  }

  function loadSegments() {
    if (!state.segmentsPromise) {
      state.segmentsPromise = jsonFetch('/api/public/commercial-segments')
        .then((payload) => Array.isArray(payload?.segments) ? payload.segments : [])
        .catch((error) => {
          state.segmentsPromise = null;
          throw error;
        });
    }
    return state.segmentsPromise;
  }

  async function loadProducts(segmentId, offset = 0) {
    const payload = await jsonFetch(`/api/public/commercial-segments/${encodeURIComponent(segmentId)}/products?offset=${offset}&limit=${PAGE_SIZE}`);
    return {
      products: Array.isArray(payload?.products) ? payload.products : [],
      hasMore: Boolean(payload?.hasMore),
    };
  }

  function productImage(product) {
    const gallery = Array.isArray(product?.gallery) ? product.gallery : [];
    const first = gallery[0];
    return text(product?.image || product?.imageUrl || product?.image_url || first?.url || first);
  }

  function productBrand(product) {
    const attrs = product?.attributes && typeof product.attributes === 'object' ? product.attributes : {};
    return text(product?.brandName || attrs['Marca'] || attrs['marca']);
  }

  function productCategory(product) {
    const attrs = product?.attributes && typeof product.attributes === 'object' ? product.attributes : {};
    return text(product?.categoriaName || attrs['Nome da categoria'] || attrs['Categoria'] || attrs['categoria']);
  }

  function productMeta(product) {
    return [productBrand(product), productCategory(product), text(product?.packaging), text(product?.unit)]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .join(' · ');
  }

  function addStyles() {
    if (document.getElementById(`${ROOT_ID}-style`)) return;
    const style = document.createElement('style');
    style.id = `${ROOT_ID}-style`;
    style.textContent = `
      #${ROOT_ID}{position:fixed;inset:0;z-index:2147483550;display:none;place-items:center;padding:clamp(8px,2.5vw,26px);background:rgba(4,8,15,.78);backdrop-filter:blur(7px);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #${ROOT_ID}[data-open="true"]{display:grid}
      #${ROOT_ID} *{box-sizing:border-box}
      .acs95-dialog{width:min(1240px,100%);max-height:min(94vh,980px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #dce3ec;border-radius:18px;background:#fff;color:#172033;box-shadow:0 32px 110px rgba(0,0,0,.42)}
      .acs95-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid #e5eaf0;background:#fff}
      .acs95-kicker{font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#2d63ae}
      .acs95-title{margin-top:3px;font-size:clamp(17px,2.2vw,24px);font-weight:900;letter-spacing:-.02em;color:#172033}
      .acs95-subtitle{margin-top:3px;font-size:10px;color:#7a8494}
      .acs95-close{display:grid;place-items:center;width:36px;height:36px;flex:0 0 auto;border:1px solid #d9e0e9;border-radius:10px;background:#f8fafc;color:#536071;font-size:22px;cursor:pointer}
      .acs95-close:hover{background:#eef3f8;color:#172033}
      .acs95-tools{display:flex;align-items:center;gap:10px;padding:11px 17px;border-bottom:1px solid #edf0f4;background:#fbfcfe}
      .acs95-search{min-width:0;flex:1;height:38px;border:1px solid #d7dee8;border-radius:9px;background:#fff;padding:0 12px;color:#172033;font:500 12px Inter,system-ui,sans-serif;outline:none}
      .acs95-search:focus{border-color:#5a82bd;box-shadow:0 0 0 3px rgba(49,95,160,.09)}
      .acs95-count{flex:0 0 auto;border-radius:999px;background:#eef4fb;padding:7px 10px;color:#315f9d;font-size:10px;font-weight:850;white-space:nowrap}
      .acs95-body{min-height:220px;overflow:auto;padding:15px 17px 18px}
      .acs95-loading,.acs95-empty{display:grid;min-height:260px;place-items:center;text-align:center;color:#7d8898;font-size:12px}
      .acs95-error{margin:18px;padding:14px;border:1px solid #fecaca;border-radius:10px;background:#fff1f2;color:#b42318;font-size:11px}
      .acs95-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px}
      .acs95-card{min-width:0;overflow:hidden;padding:0;border:1px solid #dde4ed;border-radius:13px;background:#fff;color:inherit;text-align:left;cursor:pointer;box-shadow:0 5px 16px rgba(28,46,72,.045);transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease}
      .acs95-card:hover{transform:translateY(-2px);border-color:#7b9bc8;box-shadow:0 9px 24px rgba(28,62,110,.10)}
      .acs95-image{display:grid;height:142px;place-items:center;overflow:hidden;background:#f7f9fc}
      .acs95-image img{width:100%;height:100%;object-fit:contain;padding:9px}
      .acs95-no-image{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a5afbc}
      .acs95-info{padding:10px}
      .acs95-code{font-size:8px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:#3266ad}
      .acs95-name{margin-top:4px;display:-webkit-box;min-height:34px;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#1f2937;font-size:11px;font-weight:800;line-height:1.45}
      .acs95-meta{margin-top:6px;display:-webkit-box;min-height:24px;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#7a8492;font-size:8px;line-height:1.45}
      .acs95-more-wrap{display:flex;justify-content:center;padding:18px 0 3px}
      .acs95-more{border:1px solid #cfd8e4;border-radius:9px;background:#fff;padding:9px 16px;color:#315f9d;font-size:10px;font-weight:850;cursor:pointer}
      .acs95-more:hover{background:#f3f7fb}.acs95-more:disabled{opacity:.55;cursor:wait}
      @media(max-width:720px){
        #${ROOT_ID}{padding:6px}.acs95-dialog{max-height:97vh;border-radius:13px}.acs95-head{padding:12px}.acs95-tools{padding:9px 12px;gap:7px}.acs95-body{padding:11px 12px 14px}.acs95-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.acs95-image{height:124px}.acs95-count{display:none}
      }
      @media(max-width:390px){.acs95-grid{grid-template-columns:1fr 1fr}.acs95-name{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    if (state.root?.isConnected) return state.root;
    addStyles();
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.dataset.open = 'false';
    root.innerHTML = `
      <div class="acs95-dialog" role="document">
        <div class="acs95-head">
          <div>
            <div class="acs95-kicker">Segmento comercial</div>
            <div class="acs95-title">Produtos do segmento</div>
            <div class="acs95-subtitle">Produtos priorizados para este perfil de cliente.</div>
          </div>
          <button type="button" class="acs95-close" aria-label="Fechar produtos do segmento">×</button>
        </div>
        <div class="acs95-tools">
          <input class="acs95-search" type="search" autocomplete="off" placeholder="Buscar nos produtos carregados" aria-label="Buscar produtos do segmento" />
          <div class="acs95-count">0 produtos</div>
        </div>
        <div class="acs95-body"><div class="acs95-loading">Carregando produtos…</div></div>
      </div>`;
    document.body.appendChild(root);
    state.root = root;

    root.querySelector('.acs95-close')?.addEventListener('click', close);
    root.addEventListener('click', (event) => {
      if (event.target === root) close();
      const card = event.target instanceof Element ? event.target.closest('[data-acs95-product]') : null;
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      const productId = card.getAttribute('data-acs95-product') || '';
      if (!productId) return;
      close();
      if (window.AsteryonEntityPopups?.openProduct) {
        window.AsteryonEntityPopups.openProduct(productId);
      } else {
        window.dispatchEvent(new CustomEvent('asteryon:public-product-popup', { detail: { productId } }));
      }
    });
    root.querySelector('.acs95-search')?.addEventListener('input', renderProducts);
    return root;
  }

  function setOpen(open) {
    const root = ensureRoot();
    if (open) {
      state.previousOverflow = document.body.style.overflow || '';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      root.dataset.open = 'true';
    } else {
      root.dataset.open = 'false';
      document.documentElement.style.removeProperty('overflow');
      document.body.style.overflow = state.previousOverflow;
      state.previousOverflow = '';
    }
  }

  function close() {
    if (!state.root) return;
    setOpen(false);
  }

  function filteredProducts() {
    const query = normalize(state.root?.querySelector('.acs95-search')?.value || '');
    if (!query) return state.products;
    return state.products.filter((product) => normalize([
      product?.code,
      product?.name,
      productBrand(product),
      productCategory(product),
      product?.packaging,
      product?.unit,
    ].join(' ')).includes(query));
  }

  function renderProducts() {
    const root = ensureRoot();
    const body = root.querySelector('.acs95-body');
    const count = root.querySelector('.acs95-count');
    const products = filteredProducts();
    if (count) count.textContent = `${state.products.length}${state.hasMore ? '+' : ''} produtos`;
    if (!body) return;
    if (!products.length) {
      body.innerHTML = '<div class="acs95-empty">Nenhum produto encontrado nos itens carregados deste segmento.</div>';
      return;
    }
    const cards = products.map((product) => {
      const image = productImage(product);
      const code = text(product?.code);
      const name = text(product?.name || product?.shortDescription || 'Produto');
      const meta = productMeta(product);
      return `<button type="button" class="acs95-card" data-acs95-product="${escapeHtml(product?.id || code)}">
        <div class="acs95-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" />` : '<span class="acs95-no-image">Sem imagem</span>'}</div>
        <div class="acs95-info">
          ${code ? `<div class="acs95-code">Cód. ${escapeHtml(code)}</div>` : ''}
          <div class="acs95-name">${escapeHtml(name)}</div>
          <div class="acs95-meta">${escapeHtml(meta)}</div>
        </div>
      </button>`;
    }).join('');
    body.innerHTML = `<div class="acs95-grid">${cards}</div>${state.hasMore ? '<div class="acs95-more-wrap"><button type="button" class="acs95-more">Carregar mais produtos</button></div>' : ''}`;
    body.querySelector('.acs95-more')?.addEventListener('click', loadMore);
  }

  async function loadMore() {
    if (state.loadingMore || !state.hasMore || !state.segmentId) return;
    state.loadingMore = true;
    const button = state.root?.querySelector('.acs95-more');
    if (button) {
      button.disabled = true;
      button.textContent = 'Carregando…';
    }
    try {
      const next = await loadProducts(state.segmentId, state.offset);
      const known = new Set(state.products.map((product) => text(product?.id)));
      for (const product of next.products) {
        if (!known.has(text(product?.id))) state.products.push(product);
      }
      state.offset += next.products.length;
      state.hasMore = next.hasMore;
      renderProducts();
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = error instanceof Error ? 'Tentar novamente' : 'Falha ao carregar';
      }
    } finally {
      state.loadingMore = false;
    }
  }

  async function openSegment(segmentId, segmentName = '') {
    segmentId = text(segmentId);
    if (!segmentId) return;
    const root = ensureRoot();
    state.segmentId = segmentId;
    state.segmentName = text(segmentName);
    state.products = [];
    state.offset = 0;
    state.hasMore = false;
    const search = root.querySelector('.acs95-search');
    if (search) search.value = '';
    root.querySelector('.acs95-title').textContent = state.segmentName || 'Produtos do segmento';
    root.querySelector('.acs95-count').textContent = 'Carregando…';
    root.querySelector('.acs95-body').innerHTML = '<div class="acs95-loading">Carregando produtos do segmento…</div>';
    setOpen(true);

    try {
      const [segments, first] = await Promise.all([loadSegments(), loadProducts(segmentId, 0)]);
      if (state.segmentId !== segmentId) return;
      const segment = segments.find((item) => text(item?.id) === segmentId);
      state.segmentName = text(segment?.name || state.segmentName || 'Produtos do segmento');
      state.products = first.products;
      state.offset = first.products.length;
      state.hasMore = first.hasMore;
      root.querySelector('.acs95-title').textContent = state.segmentName;
      renderProducts();
    } catch (error) {
      if (state.segmentId !== segmentId) return;
      root.querySelector('.acs95-count').textContent = 'Indisponível';
      root.querySelector('.acs95-body').innerHTML = `<div class="acs95-error">${escapeHtml(error instanceof Error ? error.message : 'Falha ao carregar produtos do segmento.')}</div>`;
    }
  }

  function segmentFromHref(element) {
    const link = element?.closest?.('a[href*="segment="]');
    const href = link?.getAttribute('href') || '';
    if (!href) return null;
    try {
      const url = new URL(href, location.origin);
      if (url.pathname !== '/catalogo') return null;
      const segmentId = text(url.searchParams.get('segment'));
      return segmentId ? { segmentId, segmentName: '' } : null;
    } catch {
      return null;
    }
  }

  function segmentFromDataset(element) {
    const owner = element?.closest?.('[data-commercial-segment-action],[data-action-segment-id],[data-segment-id]');
    if (!owner) return null;
    const segmentId = text(
      owner.getAttribute('data-commercial-segment-action')
      || owner.getAttribute('data-action-segment-id')
      || (normalize(owner.getAttribute('data-action-type')) === 'commercial-segment' ? owner.getAttribute('data-segment-id') : ''),
    );
    return segmentId ? { segmentId, segmentName: text(owner.getAttribute('data-segment-name')) } : null;
  }

  function collectLabels(node) {
    const labels = [];
    const walk = (value) => {
      if (!value || typeof value !== 'object') return;
      const props = value.props && typeof value.props === 'object' ? value.props : {};
      for (const candidate of [props.text, props.label, props.title]) {
        const label = text(candidate);
        if (label && !/^\d+$/.test(label) && normalize(label).length >= 3) labels.push(label);
      }
      const children = Array.isArray(value.children) ? value.children : [];
      children.forEach(walk);
    };
    walk(node);
    return [...new Set(labels.map((label) => normalize(label)))];
  }

  function collectMappings(payload) {
    const mappings = [];
    const seen = new Set();
    const walk = (value) => {
      if (!value || typeof value !== 'object') return;
      const props = value.props && typeof value.props === 'object' ? value.props : {};
      if (props.actionType === 'commercial-segment' && props.actionSegmentId) {
        const nodeId = text(value.id || `${props.actionSegmentId}:${props.actionSegmentName}`);
        if (!seen.has(nodeId)) {
          seen.add(nodeId);
          mappings.push({
            segmentId: text(props.actionSegmentId),
            segmentName: text(props.actionSegmentName),
            labels: collectLabels(value),
          });
        }
      }
      if (Array.isArray(value)) value.forEach(walk);
      else Object.values(value).forEach(walk);
    };
    walk(payload);
    return mappings.filter((item) => item.segmentId && item.labels.length);
  }

  async function warmPublishedMappings() {
    if (location.pathname.startsWith('/admin')) return;
    try {
      const payload = await jsonFetch('/api/public/pages/home');
      state.publishedMappings = collectMappings(payload?.page?.nodes || payload?.page || payload);
    } catch (error) {
      console.warn('ASTERYON V95.2: fallback de segmentos publicados indisponível.', error);
    } finally {
      state.mappingsReady = true;
    }
  }

  function segmentFromPublishedText(element) {
    if (!state.publishedMappings.length || !(element instanceof Element)) return null;
    const candidates = [];
    let current = element;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      if (!(current instanceof HTMLElement)) continue;
      const rect = current.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 28 || rect.width > Math.min(window.innerWidth * .8, 700)) continue;
      const value = normalize(current.innerText || current.textContent);
      if (!value || value.length > 220) continue;
      for (const mapping of state.publishedMappings) {
        if (mapping.labels.some((label) => label.length >= 3 && (value.includes(label) || label.includes(value)))) {
          candidates.push({ mapping, depth, size: value.length });
        }
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.depth - b.depth || a.size - b.size);
    const first = candidates[0].mapping;
    const ambiguous = candidates.some((candidate) => candidate.mapping.segmentId !== first.segmentId && candidate.depth === candidates[0].depth && candidate.size === candidates[0].size);
    return ambiguous ? null : { segmentId: first.segmentId, segmentName: first.segmentName };
  }

  function resolveSegment(element) {
    return segmentFromDataset(element)
      || segmentFromHref(element)
      || segmentFromPublishedText(element);
  }

  function intercept(event) {
    if (location.pathname.startsWith('/admin')) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${ROOT_ID}`)) return;
    const segment = resolveSegment(target);
    if (!segment?.segmentId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openSegment(segment.segmentId, segment.segmentName);
  }

  function interceptKeyboard(event) {
    if (!['Enter', ' '].includes(event.key)) return;
    intercept(event);
  }

  document.addEventListener('click', intercept, true);
  document.addEventListener('keydown', interceptKeyboard, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.root?.dataset.open === 'true') {
      event.preventDefault();
      close();
    }
  });
  window.addEventListener('asteryon:commercial-segment-popup', (event) => {
    const detail = event?.detail || {};
    openSegment(detail.segmentId || detail.id || detail, detail.segmentName || detail.name || '');
  });

  const boot = () => {
    ensureRoot();
    void loadSegments().catch(() => {});
    void warmPublishedMappings();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AsteryonCommercialSegmentPopup = {
    open: openSegment,
    close,
    refreshMappings: warmPublishedMappings,
    version: VERSION,
  };
})();