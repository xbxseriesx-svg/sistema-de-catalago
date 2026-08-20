(() => {
  'use strict';

  if (window.__ASTERYON_RUNTIME_LOADER_V88__) return;
  window.__ASTERYON_RUNTIME_LOADER_V88__ = true;

  const MARKER = 'ASTER_V88_CONTEXT_LOADER';
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
      script.dataset.asteryonLazyV88 = '1';
      script.addEventListener('load', () => resolve(script), { once: true });
      script.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
      document.head.appendChild(script);
    });

    loaded.set(key, promise);
    promise.catch((error) => console.warn('ASTERYON V88:', error));
    return promise;
  }

  const loadAll = (items) => Promise.all(items.map(loadScript));
  const loadSeries = async (items) => {
    for (const item of items) await loadScript(item);
  };

  function idle(callback, timeout = 3200) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => callback(), { timeout });
      return;
    }
    window.setTimeout(callback, timeout);
  }

  const COMMON = ['/responsive-v67.js?v=94&perf=88'];
  const PUBLIC = [
    '/product-modal-v66.js?v=94',
    '/public-global-search-v78.js?v=94',
    '/public-entity-popups-v81.js?v=94',
    '/public-brand-popup-fix-v83.js?v=94',
    '/public-entity-popup-guard-v81.js?v=94',
  ];
  const ADMIN_CORE = ['/system-runtime-v81.js?v=94&perf=88'];
  const ADMIN_MANAGEMENT = ['/system-runtime-v80.js?v=94&perf=88'];
  const ADMIN_BRANDS = [
    '/brand-image-search-v70.js?v=94&perf=88',
    '/brand-image-search-v72.js?v=94&perf=88',
  ];
  const ADMIN_IMPORT = [
    '/import-images-tab-fix.js?v=94',
    '/import-progress-v62.js?v=94',
    '/import-progress-fetch-v62.js?v=94',
  ];

  const loadMarketing = () => loadScript('/marketing-canvas-hotfix.js?v=94&perf=88');
  const loadTemplatePreview = () => loadScript('/template-preview-v69.js?v=94&perf=88');
  const loadProductModal = () => loadScript('/product-modal-v66.js?v=94');

  const isManagementText = (text) => [
    'gestao do catalogo',
    'vinculos',
    'produtos',
    'importar',
    'estrutura',
    'marcas',
    'ofertas',
    'marketing',
  ].some((label) => text === label || text.includes(label));

  function warmForLabel(label) {
    const text = normalize(label);
    if (!text) return;

    if (isManagementText(text)) loadAll(ADMIN_MANAGEMENT);

    if (text === 'marcas' || text.includes('nova marca') || text.includes('pesquisar marca')) {
      loadSeries(ADMIN_BRANDS);
    }

    if (text === 'importar' || text.includes('importar imagens') || text.includes('planilha')) {
      loadSeries(ADMIN_IMPORT);
    }

    if (text.includes('marketing')) loadMarketing();

    if (text.includes('modelo') || text.includes('template') || text.includes('pre-visual')) {
      loadTemplatePreview();
    }

    if (text.includes('informacoes do produto') || text.includes('abrir produto') || text === 'produto') {
      loadProductModal();
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

  function warmVisibleManagementOnce() {
    const required = new Set(['produtos', 'importar', 'estrutura', 'marcas', 'ofertas', 'marketing']);
    const visibleLabels = new Set(
      [...document.querySelectorAll('button')]
        .filter((button) => button.getClientRects().length > 0)
        .map((button) => normalize(button.textContent))
        .filter((text) => required.has(text)),
    );
    if (visibleLabels.size >= 4) loadAll(ADMIN_MANAGEMENT);
  }

  async function boot() {
    await loadAll(COMMON);

    if (!location.pathname.startsWith('/admin')) {
      await loadAll(PUBLIC);
      return;
    }

    bindAdminIntent();
    await loadAll(ADMIN_CORE);

    // V88/V94: runtimes pesados de gestão/template/produto continuam sob demanda.
    // Marketing recebe somente a tentativa tardia já protegida por sua própria
    // camada de performance e não participa do loop de edição do canvas.
    idle(() => {
      warmVisibleManagementOnce();
      void loadMarketing();
    }, 3500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  void MARKER;
})();