(() => {
  'use strict';

  const VERSION = '83';
  const POPUP_ROOT_ID = 'asteryon-entity-popup-v81';
  const BRAND_ATTR = 'data-aep83-brand';

  if (location.pathname.startsWith('/admin')) return;
  if (window.__ASTERYON_BRAND_POPUP_FIX_V83__) return;
  window.__ASTERYON_BRAND_POPUP_FIX_V83__ = true;

  const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalize = (value) => text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const BRAND_DATA_ATTRS = [
    'data-brand-id',
    'data-brand',
    'data-brand-slug',
    'data-marca-id',
    'data-marca',
    'data-marca-slug',
    BRAND_ATTR,
  ];

  const CANDIDATE_SELECTOR = [
    'a[href]',
    'button',
    '[role="button"]',
    '[tabindex]',
    '[data-brand-id]',
    '[data-brand]',
    '[data-brand-slug]',
    '[data-marca-id]',
    '[data-marca]',
    '[data-marca-slug]',
    `[${BRAND_ATTR}]`,
    '[class*="brand"]',
    '[class*="Brand"]',
    '[class*="marca"]',
    '[class*="Marca"]',
    '[class*="card"]',
    '[class*="Card"]',
    '[class*="cursor-pointer"]',
  ].join(',');

  let brandRecords = [];
  let brandLoadPromise = null;
  let annotateTimer = 0;

  function popupApi() {
    const api = window.AsteryonEntityPopups;
    return api && typeof api.openBrand === 'function' ? api : null;
  }

  function decodeSafe(value) {
    try { return decodeURIComponent(value); } catch { return value; }
  }

  function cleanBrandLabel(value) {
    let result = text(value);
    if (!result) return '';
    result = result
      .replace(/^(abrir|ver|acessar|visualizar)\s+(a\s+)?marca\s*[:\-–—]?\s*/i, '')
      .replace(/^marca\s*[:\-–—]?\s*/i, '')
      .replace(/^logo\s+(da\s+|de\s+)?/i, '')
      .replace(/\s+(logo|marca)$/i, '')
      .trim();
    return result;
  }

  function brandFromHref(element) {
    const anchor = element?.closest?.('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return '';
    try {
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'marca' || parts.length < 2) return '';
      return decodeSafe(parts.slice(1).join('/'));
    } catch {
      return '';
    }
  }

  function brandFromDataset(element) {
    let node = element;
    for (let depth = 0; node instanceof Element && depth < 8; depth += 1, node = node.parentElement) {
      for (const attr of BRAND_DATA_ATTRS) {
        const value = text(node.getAttribute(attr));
        if (value) return value;
      }
    }
    return '';
  }

  function findClickableCandidate(target) {
    if (!(target instanceof Element)) return null;
    const direct = target.closest(CANDIDATE_SELECTOR);
    if (direct) return direct;

    let node = target;
    for (let depth = 0; node instanceof HTMLElement && depth < 8; depth += 1, node = node.parentElement) {
      try {
        if (getComputedStyle(node).cursor === 'pointer') return node;
      } catch {}
    }
    return null;
  }

  function headingLooksLikeBrandSection(value) {
    const normalized = normalize(value);
    return /\bmarcas?\b/.test(normalized)
      && (!/\bprodutos?\b/.test(normalized) || /marcas?\s+em\s+destaque/.test(normalized));
  }

  function brandSectionRoots() {
    const roots = [];
    const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]');

    for (const heading of headings) {
      if (!headingLooksLikeBrandSection(heading.textContent || '')) continue;

      let node = heading.parentElement;
      let best = node;
      for (let depth = 0; node instanceof Element && depth < 5; depth += 1, node = node.parentElement) {
        const headingCount = node.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]').length;
        const clickableCount = node.querySelectorAll(CANDIDATE_SELECTOR).length;
        if (clickableCount > 0 && headingCount <= 2) {
          best = node;
          break;
        }
        if (headingCount > 2) break;
      }
      if (best) roots.push(best);
    }
    return roots;
  }

  function isInsideBrandSection(candidate) {
    if (!(candidate instanceof Element)) return false;
    const ownClass = `${candidate.className || ''} ${candidate.id || ''}`;
    if (/brand|marca/i.test(ownClass) && !/product|produto/i.test(ownClass)) return true;
    return brandSectionRoots().some((root) => root?.contains(candidate));
  }

  function setBrands(catalog) {
    const brands = Array.isArray(catalog?.brands) ? catalog.brands : [];
    brandRecords = brands
      .map((brand) => ({
        id: text(brand?.id),
        slug: text(brand?.slug),
        name: text(brand?.name),
      }))
      .filter((brand) => brand.id || brand.slug || brand.name)
      .map((brand) => ({
        ...brand,
        keys: new Set([brand.id, brand.slug, brand.name].map(normalize).filter(Boolean)),
      }));
    return brandRecords;
  }

  function primeBrands(force = false) {
    if (brandLoadPromise && !force) return brandLoadPromise;
    const api = popupApi();
    if (!api || typeof api.refresh !== 'function') return Promise.resolve(brandRecords);

    brandLoadPromise = Promise.resolve(api.refresh())
      .then((catalog) => setBrands(catalog))
      .catch(() => brandRecords)
      .finally(() => {
        scheduleAnnotate();
      });
    return brandLoadPromise;
  }

  function resolveBrand(value) {
    const wanted = normalize(cleanBrandLabel(value));
    if (!wanted) return null;
    return brandRecords.find((brand) => brand.keys.has(wanted)) || null;
  }

  function strongVisualValues(candidate, target) {
    const values = [];
    const push = (value) => {
      const cleaned = cleanBrandLabel(value);
      if (cleaned) values.push(cleaned);
    };

    push(candidate?.getAttribute?.('aria-label'));
    push(candidate?.getAttribute?.('title'));

    const clickedImage = target?.closest?.('img[alt]');
    push(clickedImage?.getAttribute?.('alt'));

    const candidateImage = candidate?.querySelector?.('img[alt]');
    push(candidateImage?.getAttribute?.('alt'));

    push(candidate?.innerText || candidate?.textContent || '');
    return [...new Set(values)];
  }

  function contextualVisualValues(candidate) {
    return String(candidate?.innerText || candidate?.textContent || '')
      .split(/\n+/)
      .map(cleanBrandLabel)
      .filter(Boolean);
  }

  function resolveCandidateBrand(candidate, target, allowLines = false) {
    const explicit = brandFromDataset(target) || brandFromHref(candidate);
    if (explicit) return resolveBrand(explicit) || { id: explicit, slug: '', name: explicit };

    for (const value of strongVisualValues(candidate, target)) {
      const found = resolveBrand(value);
      if (found) return found;
    }

    if (allowLines) {
      for (const value of contextualVisualValues(candidate)) {
        const found = resolveBrand(value);
        if (found) return found;
      }
    }
    return null;
  }

  function markCandidate(candidate, brand) {
    if (!(candidate instanceof Element) || !brand) return;
    candidate.setAttribute(BRAND_ATTR, brand.id || brand.slug || brand.name);
  }

  function annotateBrandCards() {
    if (!brandRecords.length) return;

    const candidates = document.querySelectorAll(CANDIDATE_SELECTOR);
    for (const candidate of candidates) {
      if (!(candidate instanceof Element)) continue;
      if (candidate.closest(`#${POPUP_ROOT_ID}`)) continue;
      if (candidate.hasAttribute(BRAND_ATTR)) continue;

      const contextual = isInsideBrandSection(candidate);
      const brand = resolveCandidateBrand(candidate, candidate, contextual);
      if (brand) markCandidate(candidate, brand);
    }
  }

  function scheduleAnnotate() {
    clearTimeout(annotateTimer);
    annotateTimer = setTimeout(annotateBrandCards, 80);
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(`#${POPUP_ROOT_ID}`)) return;

    const api = popupApi();
    if (!api) return;

    const candidate = findClickableCandidate(event.target);
    if (!candidate) return;

    const explicit = brandFromDataset(event.target) || brandFromHref(candidate);
    const contextual = isInsideBrandSection(candidate);
    let brand = resolveCandidateBrand(candidate, event.target, contextual);

    if (!brand && explicit) brand = { id: explicit, slug: '', name: explicit };
    if (!brand) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    markCandidate(candidate, brand);
    api.openBrand(brand.id || brand.slug || brand.name);
  }, true);

  const observer = new MutationObserver(() => scheduleAnnotate());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      primeBrands();
      scheduleAnnotate();
    }, { once: true });
  } else {
    primeBrands();
    scheduleAnnotate();
  }

  window.AsteryonBrandPopupFix = {
    version: VERSION,
    refresh: () => primeBrands(true),
    annotate: annotateBrandCards,
    detect: (element) => {
      if (!(element instanceof Element)) return '';
      const candidate = findClickableCandidate(element);
      if (!candidate) return '';
      const brand = resolveCandidateBrand(candidate, element, isInsideBrandSection(candidate));
      return brand ? (brand.id || brand.slug || brand.name) : '';
    },
  };
})();
