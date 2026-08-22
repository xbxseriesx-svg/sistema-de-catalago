(() => {
  'use strict';

  const PUBLIC_PATH = /^\/$/;
  if (!PUBLIC_PATH.test(location.pathname)) return;
  if (window.__ASTERYON_PUBLIC_EXPERIENCE_V94_1__) return;
  window.__ASTERYON_PUBLIC_EXPERIENCE_V94_1__ = true;

  const doc = document;
  const html = doc.documentElement;
  const STORAGE_KEY = 'asteryon.public.zoom';
  const DEFAULT_ZOOM = 0.85;
  const MIN_ZOOM = 0.70;
  const MAX_ZOOM = 1.20;
  const STEP = 0.05;
  const ZOOM_CONTROL = 'data-asteryon-public-zoom-control';
  const TRACK_ATTR = 'data-asteryon-brand-track';
  const VIEWPORT_ATTR = 'data-asteryon-brand-viewport';
  const CLONE_ATTR = 'data-asteryon-brand-clone';

  let zoom = DEFAULT_ZOOM;
  let repairTimer = 0;
  let resizeTimer = 0;
  let repairingCarousel = false;
  let lastTrack = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const roundedZoom = value => Math.round(clamp(value, MIN_ZOOM, MAX_ZOOM) * 20) / 20;
  const normalizeText = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const readStoredZoom = () => {
    try {
      const value = Number.parseFloat(localStorage.getItem(STORAGE_KEY) || '');
      if (Number.isFinite(value)) return roundedZoom(value);
    } catch (_) {}
    return DEFAULT_ZOOM;
  };

  const injectStyles = () => {
    if (doc.getElementById('asteryon-public-experience-v94-style')) return;
    const style = doc.createElement('style');
    style.id = 'asteryon-public-experience-v94-style';
    style.textContent = `
      html[data-asteryon-public-experience="v94.1"] {
        --asteryon-public-zoom: .85;
      }
      html[data-asteryon-public-experience="v94.1"] body {
        overflow-x: hidden !important;
      }
      [${ZOOM_CONTROL}] {
        position: fixed;
        right: max(.75rem, env(safe-area-inset-right));
        bottom: max(.75rem, env(safe-area-inset-bottom));
        z-index: 2147483600;
        display: inline-flex;
        align-items: center;
        gap: .25rem;
        padding: .3rem;
        border: 1px solid rgba(15, 23, 42, .14);
        border-radius: 999px;
        background: rgba(255, 255, 255, .94);
        box-shadow: 0 .65rem 1.8rem rgba(15, 23, 42, .16);
        backdrop-filter: blur(10px);
        color: #0f172a;
        font: 600 12px/1.1 Inter, system-ui, sans-serif;
      }
      [${ZOOM_CONTROL}] > span {
        padding: 0 .25rem 0 .4rem;
        white-space: nowrap;
      }
      [${ZOOM_CONTROL}] button {
        min-width: 2rem !important;
        min-height: 2rem !important;
        height: 2rem !important;
        padding: 0 .45rem !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: #eef2ff !important;
        color: #1e3a8a !important;
        font: 800 12px/1 Inter, system-ui, sans-serif !important;
        cursor: pointer;
      }
      [${ZOOM_CONTROL}] button[data-zoom-value] {
        min-width: 3.5rem !important;
      }
      [${ZOOM_CONTROL}] button:focus-visible {
        outline: 2px solid #3157b7 !important;
        outline-offset: 2px !important;
      }
      [${VIEWPORT_ATTR}="true"] {
        overflow: hidden !important;
        max-width: 100% !important;
      }
      [${TRACK_ATTR}="true"] {
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: stretch !important;
        width: max-content !important;
        min-width: max-content !important;
        max-width: none !important;
        transform: translate3d(0, 0, 0);
        animation: asteryon-brand-loop var(--asteryon-brand-duration, 36s) linear infinite !important;
        transition: none !important;
        will-change: transform;
      }
      [${TRACK_ATTR}="true"] > * {
        flex: 0 0 auto !important;
      }
      [${TRACK_ATTR}="true"]:hover,
      [${TRACK_ATTR}="true"]:focus-within {
        animation-play-state: paused !important;
      }
      [${CLONE_ATTR}="true"] [id] {
        pointer-events: none;
      }
      @keyframes asteryon-brand-loop {
        from { transform: translate3d(0, 0, 0); }
        to { transform: translate3d(calc(-1 * var(--asteryon-brand-cycle, 0px)), 0, 0); }
      }
      @media (max-width: 767px) {
        [${ZOOM_CONTROL}] {
          right: max(.5rem, env(safe-area-inset-right));
          bottom: max(.5rem, env(safe-area-inset-bottom));
        }
        [${ZOOM_CONTROL}] > span { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        [${TRACK_ATTR}="true"] {
          animation: none !important;
          transform: none !important;
          overflow-x: auto !important;
          scroll-snap-type: x proximity;
        }
      }
    `;
    doc.head.appendChild(style);
  };

  const updateZoomButton = () => {
    const value = doc.querySelector(`[${ZOOM_CONTROL}] [data-zoom-value]`);
    if (value) value.textContent = `${Math.round(zoom * 100)}%`;
  };

  const applyZoom = (nextZoom, { persist = true } = {}) => {
    zoom = roundedZoom(nextZoom);
    html.dataset.asteryonPublicExperience = 'v94.1';
    html.style.setProperty('--asteryon-public-zoom', String(zoom));

    const root = doc.getElementById('root');
    if (root) {
      root.style.zoom = String(zoom);
      root.style.width = `${(100 / zoom).toFixed(4)}%`;
      root.style.maxWidth = 'none';
    }

    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, String(zoom)); } catch (_) {}
    }
    updateZoomButton();
    scheduleCarouselRepair(80);
    window.dispatchEvent(new CustomEvent('asteryon:public-zoom-change', {
      detail: {
        appZoom: zoom,
        browserScale: window.visualViewport?.scale || 1,
        innerWidth: window.innerWidth,
        visualWidth: window.visualViewport?.width || window.innerWidth,
      },
    }));
  };

  const ensureZoomControl = () => {
    if (doc.querySelector(`[${ZOOM_CONTROL}]`)) return;
    const control = doc.createElement('div');
    control.setAttribute(ZOOM_CONTROL, 'true');
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', 'Zoom da página pública');

    const label = doc.createElement('span');
    label.textContent = 'Zoom';
    control.appendChild(label);

    const minus = doc.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.setAttribute('aria-label', 'Diminuir zoom da página');
    minus.addEventListener('click', () => applyZoom(zoom - STEP));
    control.appendChild(minus);

    const value = doc.createElement('button');
    value.type = 'button';
    value.dataset.zoomValue = 'true';
    value.title = 'Restaurar zoom padrão da página';
    value.setAttribute('aria-label', 'Restaurar zoom padrão da página');
    value.addEventListener('click', () => applyZoom(DEFAULT_ZOOM));
    control.appendChild(value);

    const plus = doc.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.setAttribute('aria-label', 'Aumentar zoom da página');
    plus.addEventListener('click', () => applyZoom(zoom + STEP));
    control.appendChild(plus);

    doc.body.appendChild(control);
    updateZoomButton();
  };

  const findPortfolioHeading = () => {
    const selectors = 'h1,h2,h3,h4,[role="heading"],p,span';
    return [...doc.querySelectorAll(selectors)].find((element) => {
      const text = normalizeText(element.textContent);
      return text.length <= 80 && text.includes('marcas do portfolio');
    }) || null;
  };

  const sectionForHeading = (heading) => {
    if (!heading) return null;
    const semantic = heading.closest('section');
    if (semantic) return semantic;
    let node = heading.parentElement;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      const media = node.querySelectorAll('img,svg').length;
      const interactive = node.querySelectorAll('button,a,[role="button"]').length;
      if (media >= 2 || interactive >= 3) return node;
    }
    return heading.parentElement;
  };

  const trackScore = (element, headingBottom) => {
    if (!(element instanceof HTMLElement)) return -Infinity;
    if (element.hasAttribute(CLONE_ATTR)) return -Infinity;
    const children = [...element.children].filter(child => !child.hasAttribute(CLONE_ATTR));
    if (children.length < 2) return -Infinity;
    const rect = element.getBoundingClientRect();
    if (rect.height < 20 || rect.height > 220 || rect.width < 80) return -Infinity;
    if (rect.top < headingBottom - 8) return -Infinity;
    const styled = getComputedStyle(element);
    const contentChildren = children.filter(child => child.querySelector('img,svg,button,a,[role="button"]') || normalizeText(child.textContent).length > 0).length;
    if (contentChildren < Math.min(2, children.length)) return -Infinity;
    let score = children.length * 5;
    if (styled.display.includes('flex')) score += 20;
    if (styled.display.includes('grid')) score += 8;
    if (element.scrollWidth > element.clientWidth + 2) score += 14;
    if (rect.height <= 140) score += 8;
    return score;
  };

  const findBrandTrack = (section, heading) => {
    if (!section || !heading) return null;
    const headingBottom = heading.getBoundingClientRect().bottom;
    const candidates = [...section.querySelectorAll('div,ul,ol')];
    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const score = trackScore(candidate, headingBottom);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return bestScore > 0 ? best : null;
  };

  const stripDuplicateIds = clone => {
    if (clone.id) clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(element => {
      element.setAttribute('tabindex', '-1');
      element.setAttribute('aria-hidden', 'true');
    });
  };

  const bindCloneProxy = (clone, source) => {
    clone.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const target = source.querySelector('button,a,[role="button"]') || source;
      if (target instanceof HTMLElement) target.click();
    }, true);
  };

  const removeClones = track => {
    track.querySelectorAll(`:scope > [${CLONE_ATTR}="true"]`).forEach(node => node.remove());
  };

  const repairBrandCarousel = () => {
    if (repairingCarousel) return false;
    repairingCarousel = true;
    try {
      const heading = findPortfolioHeading();
      const section = sectionForHeading(heading);
      const track = findBrandTrack(section, heading);
      if (!(track instanceof HTMLElement)) return false;

      if (lastTrack && lastTrack !== track) {
        lastTrack.removeAttribute(TRACK_ATTR);
        lastTrack.parentElement?.removeAttribute(VIEWPORT_ATTR);
      }
      lastTrack = track;
      removeClones(track);

      const originals = [...track.children].filter(child => !child.hasAttribute(CLONE_ATTR));
      if (originals.length < 2) return false;

      const viewport = track.parentElement;
      if (!(viewport instanceof HTMLElement)) return false;
      viewport.setAttribute(VIEWPORT_ATTR, 'true');
      track.setAttribute(TRACK_ATTR, 'true');

      const firstRect = originals[0].getBoundingClientRect();
      const lastRect = originals[originals.length - 1].getBoundingClientRect();
      if (firstRect.width < 8 || lastRect.width < 8) return false;
      const gap = originals.length > 1
        ? Math.max(0, originals[1].getBoundingClientRect().left - firstRect.right)
        : 0;
      const cycle = Math.max(1, lastRect.right - firstRect.left + gap);
      const viewportWidth = Math.max(1, viewport.getBoundingClientRect().width);

      let cloneWidth = 0;
      let rounds = 0;
      while (cloneWidth < viewportWidth + cycle && rounds < 8) {
        for (let index = 0; index < originals.length; index += 1) {
          const source = originals[index];
          const clone = source.cloneNode(true);
          if (!(clone instanceof HTMLElement)) continue;
          clone.setAttribute(CLONE_ATTR, 'true');
          clone.dataset.asteryonBrandSourceIndex = String(index);
          clone.setAttribute('aria-hidden', 'true');
          stripDuplicateIds(clone);
          bindCloneProxy(clone, source);
          track.appendChild(clone);
        }
        cloneWidth += cycle;
        rounds += 1;
      }

      const pxPerSecond = window.innerWidth <= 767 ? 28 : 38;
      const duration = clamp(cycle / pxPerSecond, 18, 64);
      track.style.setProperty('--asteryon-brand-cycle', `${cycle.toFixed(2)}px`);
      track.style.setProperty('--asteryon-brand-duration', `${duration.toFixed(2)}s`);
      track.dataset.asteryonBrandOriginalCount = String(originals.length);
      track.dataset.asteryonBrandCloneRounds = String(rounds);
      return true;
    } finally {
      repairingCarousel = false;
    }
  };

  function scheduleCarouselRepair(delay = 100) {
    window.clearTimeout(repairTimer);
    repairTimer = window.setTimeout(() => {
      repairTimer = 0;
      repairBrandCarousel();
    }, delay);
  }

  const mutationIsMeaningful = record => {
    const changed = [...record.addedNodes, ...record.removedNodes].filter(node => node instanceof Element);
    return changed.some(node => !node.hasAttribute(CLONE_ATTR));
  };

  const onViewportChange = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeTimer = 0;
      applyZoom(zoom, { persist: false });
      scheduleCarouselRepair(90);
    }, 80);
  };

  const start = () => {
    injectStyles();
    zoom = readStoredZoom();
    ensureZoomControl();
    applyZoom(zoom, { persist: false });
    scheduleCarouselRepair(60);

    const observer = new MutationObserver(records => {
      if (repairingCarousel) return;
      if (records.some(mutationIsMeaningful)) scheduleCarouselRepair(70);
    });
    observer.observe(doc.getElementById('root') || doc.body, { childList: true, subtree: true });

    window.addEventListener('resize', onViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('asteryon:viewport-change', () => scheduleCarouselRepair(80));
  };

  window.__ASTERYON_PUBLIC_EXPERIENCE__ = {
    get zoom() { return zoom; },
    setZoom: value => applyZoom(Number(value)),
    repairBrandCarousel,
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
