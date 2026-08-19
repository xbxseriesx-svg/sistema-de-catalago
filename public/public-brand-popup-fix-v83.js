(() => {
  'use strict';

  const VERSION = '85';
  const POPUP_ROOT_ID = 'asteryon-entity-popup-v81';
  const BOUND_ATTR = 'data-asteryon-brand-bound-v85';
  const OVERLAY_ATTR = 'data-asteryon-brand-runtime-v85';

  const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalize = (value) => text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  function flattenNodes(nodes, output = []) {
    if (!Array.isArray(nodes)) return output;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      output.push(node);
      if (Array.isArray(node.children)) flattenNodes(node.children, output);
    }
    return output;
  }

  function pageNodes(payload) {
    const page = payload?.page ?? payload ?? {};
    return page.nodes
      || page.publishedNodes
      || page.published_nodes
      || payload?.nodes
      || [];
  }

  function normalizeBrandRecord(brand) {
    const id = text(brand?.id);
    const slug = text(brand?.slug);
    const name = text(brand?.name);
    const logoUrl = text(brand?.logoUrl || brand?.logo_url || brand?.logo || '');
    return {
      ...brand,
      id,
      slug,
      name,
      logoUrl,
      keys: new Set([id, slug, name].map(normalize).filter(Boolean)),
    };
  }

  function normalizeBrands(payload) {
    const list = Array.isArray(payload?.brands)
      ? payload.brands
      : Array.isArray(payload)
        ? payload
        : [];
    return list
      .map(normalizeBrandRecord)
      .filter((brand) => brand.id || brand.slug || brand.name);
  }

  function brandKeyFromPageNode(node) {
    if (!node || node.type !== 'brand') return '';
    const props = node.props || {};
    return text(
      props.actionEntityId
      || props.brandId
      || props.brand_id
      || props.actionValue
      || props.brandSlug
      || props.brand_slug
      || props.slug
      || '',
    );
  }

  function resolveBrand(value, brands) {
    const wanted = normalize(value);
    if (!wanted) return null;
    return brands.find((brand) => brand.keys.has(wanted)) || null;
  }

  function buildBindingPlan(pagePayload, brandsPayload) {
    const brands = normalizeBrands(brandsPayload);
    const nodes = flattenNodes(pageNodes(pagePayload));
    const plan = [];

    for (const node of nodes) {
      if (node?.type !== 'brand' || !text(node.id)) continue;
      const key = brandKeyFromPageNode(node);
      if (!key) continue;
      const brand = resolveBrand(key, brands);
      if (!brand) continue;
      plan.push({ nodeId: text(node.id), brand });
    }
    return plan;
  }

  const testApi = {
    flattenNodes,
    pageNodes,
    normalizeBrands,
    brandKeyFromPageNode,
    resolveBrand,
    buildBindingPlan,
  };

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    globalThis.__ASTERYON_BRAND_POPUP_FIX_TEST__ = testApi;
    return;
  }

  if (location.pathname.startsWith('/admin')) return;
  if (window.__ASTERYON_BRAND_POPUP_FIX_V85__) return;
  window.__ASTERYON_BRAND_POPUP_FIX_V85__ = true;

  let pagePayload = null;
  let brandPayload = null;
  let plan = [];
  let refreshPromise = null;
  let bindTimer = 0;
  let styleInstalled = false;

  function popupApi() {
    const api = window.AsteryonEntityPopups;
    return api && typeof api.openBrand === 'function' ? api : null;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
    const payload = await response.json();
    if (payload?.ok === false) throw new Error(payload?.error?.message || `Falha em ${url}`);
    return payload;
  }

  function installStyle() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement('style');
    style.id = 'asteryon-brand-runtime-v85-style';
    style.textContent = `
      [${BOUND_ATTR}="1"] { cursor: pointer !important; }
      [${OVERLAY_ATTR}] {
        position: absolute;
        inset: 0;
        z-index: 6;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        box-sizing: border-box;
        overflow: hidden;
        pointer-events: none;
        background: #fff;
        border-radius: inherit;
      }
      [${OVERLAY_ATTR}] img {
        display: block;
        width: auto;
        height: auto;
        max-width: 88%;
        max-height: 78%;
        object-fit: contain;
      }
      [${OVERLAY_ATTR}] span {
        display: block;
        max-width: 92%;
        color: #334155;
        font: 700 14px/1.25 Inter, system-ui, sans-serif;
        text-align: center;
        overflow-wrap: anywhere;
      }
    `;
    document.head.appendChild(style);
  }

  function fallbackName(overlay, brand) {
    overlay.replaceChildren();
    const label = document.createElement('span');
    label.textContent = brand.name || brand.slug || brand.id || 'Marca';
    overlay.appendChild(label);
  }

  function renderBrandOverlay(card, brand) {
    installStyle();
    let overlay = Array.from(card.children || []).find(
      (child) => child instanceof Element && child.hasAttribute(OVERLAY_ATTR),
    );
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.setAttribute(OVERLAY_ATTR, '1');
      card.appendChild(overlay);
    }

    const signature = `${brand.id}|${brand.logoUrl}|${brand.name}`;
    if (overlay.getAttribute('data-signature') === signature) return;
    overlay.setAttribute('data-signature', signature);
    overlay.replaceChildren();

    if (brand.logoUrl) {
      const image = document.createElement('img');
      image.src = brand.logoUrl;
      image.alt = brand.name ? `Logo ${brand.name}` : 'Logo da marca';
      image.loading = 'eager';
      image.decoding = 'async';
      image.addEventListener('error', () => fallbackName(overlay, brand), { once: true });
      overlay.appendChild(image);
    } else {
      fallbackName(overlay, brand);
    }
  }

  function domNodeMap() {
    return new Map(
      Array.from(document.querySelectorAll('[data-node-id]'))
        .map((element) => [text(element.getAttribute('data-node-id')), element])
        .filter(([id]) => id),
    );
  }

  function bindCard(card, brand) {
    if (!(card instanceof HTMLElement) || !brand) return;
    if (card.closest(`#${POPUP_ROOT_ID}`)) return;

    card.setAttribute(BOUND_ATTR, '1');
    card.setAttribute('data-brand-id', brand.id || brand.slug || brand.name);
    card.setAttribute('data-brand-card', '1');
    card.setAttribute('data-aep85-brand', brand.id || brand.slug || brand.name);
    card.setAttribute('role', 'button');
    if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
    card.setAttribute('aria-label', `Abrir marca ${brand.name || brand.slug || brand.id}`);
    card.setAttribute('title', brand.name || brand.slug || brand.id);

    const position = getComputedStyle(card).position;
    if (!position || position === 'static') card.style.position = 'relative';
    renderBrandOverlay(card, brand);
  }

  function bindPublishedBrandNodes() {
    if (!plan.length) return 0;
    const nodes = domNodeMap();
    let bound = 0;
    for (const item of plan) {
      const card = nodes.get(item.nodeId);
      if (!card) continue;
      bindCard(card, item.brand);
      bound += 1;
    }
    return bound;
  }

  function scheduleBind() {
    clearTimeout(bindTimer);
    bindTimer = window.setTimeout(bindPublishedBrandNodes, 60);
  }

  async function refresh(force = false) {
    if (refreshPromise && !force) return refreshPromise;
    refreshPromise = Promise.all([
      fetchJson('/api/public/pages/home'),
      fetchJson('/api/public/brands'),
    ])
      .then(([page, brands]) => {
        pagePayload = page;
        brandPayload = brands;
        plan = buildBindingPlan(pagePayload, brandPayload);
        scheduleBind();
        return { page: pagePayload, brands: normalizeBrands(brandPayload), plan };
      })
      .catch((error) => {
        console.error('[Asteryon V85] Falha ao vincular cards de marca:', error);
        return { page: pagePayload, brands: normalizeBrands(brandPayload), plan };
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  }

  function boundCardFromTarget(target) {
    return target instanceof Element ? target.closest(`[${BOUND_ATTR}="1"]`) : null;
  }

  function openBoundCard(card, event) {
    if (!(card instanceof Element)) return false;
    const brandId = text(card.getAttribute('data-brand-id'));
    if (!brandId) return false;
    const api = popupApi();
    if (!api) return false;

    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    api.openBrand(brandId);
    return true;
  }

  document.addEventListener('click', (event) => {
    const card = boundCardFromTarget(event.target);
    if (!card || card.closest(`#${POPUP_ROOT_ID}`)) return;
    openBoundCard(card, event);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = boundCardFromTarget(event.target);
    if (!card || card.closest(`#${POPUP_ROOT_ID}`)) return;
    openBoundCard(card, event);
  }, true);

  const observer = new MutationObserver(() => scheduleBind());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function boot() {
    refresh();
    scheduleBind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.AsteryonBrandPopupFix = {
    version: VERSION,
    refresh: () => refresh(true),
    annotate: bindPublishedBrandNodes,
    plan: () => plan.slice(),
    test: testApi,
  };
})();
