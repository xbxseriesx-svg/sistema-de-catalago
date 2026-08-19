(() => {
  'use strict';

  if (window.__ASTERYON_RUNTIME_LOADER_V87__) return;
  window.__ASTERYON_RUNTIME_LOADER_V87__ = true;

  const loaded = new Map();
  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  function canonical(src) {
    try {
      const url = new URL(src, location.origin);
      return `${url.pathname}${url.search}`;
    } catch {
      return String(src || '');
    }
  }

  function loadScript(src) {
    const key = canonical(src);
    if (loaded.has(key)) return loaded.get(key);

    const existing = [...document.scripts].find((script) => canonical(script.src) === key);
    if (existing) {
      const done = Promise.resolve(existing);
      loaded.set(key, done);
      return done;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.asteryonLazyV87 = '1';
      script.addEventListener('load', () => resolve(script), { once: true });
      script.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
      document.head.appendChild(script);
    });
    loaded.set(key, promise);
    promise.catch((error) => console.warn('ASTERYON V87:', error));
    return promise;
  }

  const loadAll = (items) => Promise.all(items.map(loadScript));
  const loadSeries = async (items) => {
    for (const item of items) await loadScript(item);
  };

  function idle(callback, timeout = 1200) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => callback(), { timeout });
      return;
    }
    window.setTimeout(callback, Math.min(timeout, 450));
  }

  const COMMON = ['/responsive-v67.js?v=81'];
  const PUBLIC = [
    '/product-modal-v66.js?v=81',
    '/public-global-search-v78.js?v=81',
    '/public-entity-popups-v81.js?v=81',
    '/public-brand-popup-fix-v83.js?v=85',
    '/public-entity-popup-guard-v81.js?v=81',
  ];
  const ADMIN_CORE = [
    '/system-runtime-v81.js?v=81&perf=87',
  ];
  const ADMIN_IDLE = [
    '/system-runtime-v80.js?v=81&perf=87',
    '/marketing-canvas-hotfix.js?v=81&perf=87',
    '/product-modal-v66.js?v=81',
    '/template-preview-v69.js?v=81',
  ];
  const ADMIN_BRANDS = [
    '/brand-image-search-v70.js?v=81&perf=87',
    '/brand-image-search-v72.js?v=81&perf=87',
  ];
  const ADMIN_IMPORT = [
    '/import-images-tab-fix.js?v=81',
    '/import-progress-v62.js?v=81',
    '/import-progress-fetch-v62.js?v=81',
  ];

  function warmForLabel(label) {
    const text = normalize(label);
    if (!text) return;
    if (text === 'marcas' || text.includes('nova marca') || text.includes('pesquisar marca')) {
      loadSeries(ADMIN_BRANDS);
    }
    if (text === 'importar' || text.includes('importar imagens') || text.includes('planilha')) {
      loadSeries(ADMIN_IMPORT);
    }
    if (text === 'marketing') loadScript('/marketing-canvas-hotfix.js?v=81&perf=87');
    if (text.includes('modelo') || text.includes('template') || text.includes('pre-visual')) {
      loadScript('/template-preview-v69.js?v=81');
    }
  }

  function bindAdminIntent() {
    const warm = (event) => {
      const target = event.target instanceof Element
        ? event.target.closest('button,a,[role="button"],input')
        : null;
      if (!target) return;
      warmForLabel(`${target.textContent || ''} ${target.getAttribute('aria-label') || ''} ${target.getAttribute('placeholder') || ''}`);
    };
    document.addEventListener('pointerover', warm, true);
    document.addEventListener('pointerdown', warm, true);
    document.addEventListener('focusin', warm, true);
  }

  async function boot() {
    await loadAll(COMMON);
    if (!location.pathname.startsWith('/admin')) {
      await loadAll(PUBLIC);
      return;
    }

    bindAdminIntent();
    await loadAll(ADMIN_CORE);
    idle(() => loadAll(ADMIN_IDLE), 1400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
