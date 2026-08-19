(() => {
  const VERSION = '82';
  const ROOT_ID = 'asteryon-entity-popup-v81';

  if (location.pathname.startsWith('/admin')) return;

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
    '[class*="brand"]',
    '[class*="Brand"]',
    '[class*="marca"]',
    '[class*="Marca"]',
    '[class*="card"]',
    '[class*="Card"]',
    '[class*="cursor-pointer"]',
  ].join(',');

  function popupApi() {
    const api = window.AsteryonEntityPopups;
    return api && typeof api.openBrand === 'function' ? api : null;
  }

  function decodeSafe(value) {
    try { return decodeURIComponent(value); } catch { return value; }
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
    for (let depth = 0; node instanceof Element && depth < 7; depth += 1, node = node.parentElement) {
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
    for (let depth = 0; node instanceof HTMLElement && depth < 7; depth += 1, node = node.parentElement) {
      try {
        if (getComputedStyle(node).cursor === 'pointer') return node;
      } catch {}
    }
    return null;
  }

  function headingLooksLikeBrandSection(value) {
    const normalized = normalize(value);
    if (!normalized) return false;
    if (!/\bmarcas?\b/.test(normalized)) return false;
    if (/\bproduto(s)?\b/.test(normalized) && !/marcas?\s+em\s+destaque/.test(normalized)) return false;
    return true;
  }

  function isInsideBrandSection(candidate) {
    if (!(candidate instanceof Element)) return false;

    const classAndId = `${candidate.className || ''} ${candidate.id || ''}`;
    if (/brand|marca/i.test(classAndId)) return true;

    let node = candidate;
    for (let depth = 0; node instanceof Element && depth < 7; depth += 1, node = node.parentElement) {
      const nodeClassAndId = `${node.className || ''} ${node.id || ''}`;
      if (/brand|marca/i.test(nodeClassAndId) && !/product|produto/i.test(nodeClassAndId)) return true;

      const headings = node.querySelectorAll?.('h1,h2,h3,h4,h5,h6,[role="heading"]');
      if (headings) {
        for (const heading of headings) {
          if (headingLooksLikeBrandSection(heading.textContent || '')) return true;
        }
      }

      const previous = node.previousElementSibling;
      if (previous) {
        if (previous.matches?.('h1,h2,h3,h4,h5,h6,[role="heading"]') && headingLooksLikeBrandSection(previous.textContent || '')) return true;
        const previousHeading = previous.querySelector?.('h1,h2,h3,h4,h5,h6,[role="heading"]');
        if (previousHeading && headingLooksLikeBrandSection(previousHeading.textContent || '')) return true;
      }
    }
    return false;
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

  function usableBrandLabel(value) {
    const candidate = cleanBrandLabel(value);
    if (!candidate || candidate.length < 2 || candidate.length > 120) return '';
    const normalized = normalize(candidate);
    if (!normalized) return '';
    if (/^(marca|marcas|logo|sem logo|ver mais|saiba mais|produtos?|ver produtos?|abrir)$/.test(normalized)) return '';
    if (/^\d+[\s,.]*$/.test(normalized)) return '';
    if (/r\$|\bpre[cç]o\b|\bc[oó]digo\b|\bean\b|\bgtin\b/i.test(candidate)) return '';
    return candidate;
  }

  function brandFromVisual(candidate, target) {
    const aria = usableBrandLabel(candidate?.getAttribute?.('aria-label'));
    if (aria) return aria;

    const title = usableBrandLabel(candidate?.getAttribute?.('title'));
    if (title) return title;

    const clickedImage = target?.closest?.('img[alt]');
    const clickedAlt = usableBrandLabel(clickedImage?.getAttribute?.('alt'));
    if (clickedAlt) return clickedAlt;

    const image = candidate?.querySelector?.('img[alt]');
    const alt = usableBrandLabel(image?.getAttribute?.('alt'));
    if (alt) return alt;

    const lines = String(candidate?.innerText || candidate?.textContent || '')
      .split(/\n+/)
      .map((line) => usableBrandLabel(line))
      .filter(Boolean);

    if (lines.length === 1) return lines[0];
    if (lines.length > 1) {
      const nonAction = lines.find((line) => !/^(ver|abrir|acessar|visualizar|saiba)/i.test(line));
      if (nonAction && nonAction.length <= 80) return nonAction;
    }
    return '';
  }

  function brandKeyFromClick(target, candidate) {
    return brandFromDataset(target)
      || brandFromHref(candidate)
      || brandFromVisual(candidate, target);
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(`#${ROOT_ID}`)) return;

    const api = popupApi();
    if (!api) return;

    const candidate = findClickableCandidate(event.target);
    if (!candidate) return;

    const explicitKey = brandFromDataset(event.target) || brandFromHref(candidate);
    if (!explicitKey && !isInsideBrandSection(candidate)) return;

    const brandKey = explicitKey || brandFromVisual(candidate, event.target);
    if (!brandKey) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    api.openBrand(brandKey);
  }, true);

  window.AsteryonBrandPopupFix = {
    version: VERSION,
    detect: (element) => {
      if (!(element instanceof Element)) return '';
      const candidate = findClickableCandidate(element);
      if (!candidate) return '';
      if (!brandFromDataset(element) && !brandFromHref(candidate) && !isInsideBrandSection(candidate)) return '';
      return brandKeyFromClick(element, candidate);
    },
  };
})();
