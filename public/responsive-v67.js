(() => {
  'use strict';

  if (window.__ASTERYON_RESPONSIVE_V88__) return;
  window.__ASTERYON_RESPONSIVE_V88__ = true;

  const root = document.documentElement;
  const MOBILE_MAX = 767;
  const TABLET_MAX = 1100;
  const TOOLBAR_ATTR = 'data-asteryon-mobile-toolbar';
  const BACKDROP_ATTR = 'data-asteryon-sidebar-backdrop';
  const MARKER = 'ASTER_V88_RESPONSIVE_PERFORMANCE';

  let raf = 0;
  let structuralTimer = 0;
  let lastSignature = '';
  let lastDevice = '';
  let lastSurface = '';
  let resizeObserver = null;
  let observedShell = null;

  const viewport = () => {
    const vv = window.visualViewport;
    const width = Math.max(1, Math.round(window.innerWidth || root.clientWidth || 1));
    const height = Math.max(1, Math.round(vv?.height || window.innerHeight || root.clientHeight || 1));
    const visualWidth = Math.max(1, Math.round(vv?.width || width));
    return { width, height, visualWidth };
  };

  const deviceFor = (width) => width <= MOBILE_MAX ? 'mobile' : width <= TABLET_MAX ? 'tablet' : 'desktop';

  const getEditorShell = () => document.querySelector(
    '#root > div.h-screen.w-screen.overflow-hidden > div.flex.flex-1.overflow-hidden',
  );

  const detectSurface = () => {
    if (/\/importar-imagens(?:\.html)?$/i.test(location.pathname)) return 'importer';
    if (getEditorShell()) return 'editor';
    return 'public';
  };

  const setDataset = (element, key, value) => {
    if (element.dataset[key] !== value) element.dataset[key] = value;
  };

  const setCssVar = (name, value) => {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  };

  const setOpenSidebar = (side) => {
    const sidebars = [...document.querySelectorAll('[data-asteryon-editor-sidebar]')];
    let opened = false;
    for (const sidebar of sidebars) {
      const shouldOpen = sidebar.dataset.asteryonEditorSidebar === side;
      setDataset(sidebar, 'open', shouldOpen ? 'true' : 'false');
      if (shouldOpen) opened = true;
    }

    const backdrop = document.querySelector(`[${BACKDROP_ATTR}]`);
    if (backdrop) setDataset(backdrop, 'open', opened ? 'true' : 'false');

    const toolbar = document.querySelector(`[${TOOLBAR_ATTR}]`);
    if (toolbar) {
      for (const button of toolbar.querySelectorAll('button[data-side]')) {
        const expanded = button.dataset.side === side && opened ? 'true' : 'false';
        if (button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);
      }
    }

    if (opened) {
      requestAnimationFrame(() => {
        const sidebar = document.querySelector(`[data-asteryon-editor-sidebar="${side}"][data-open="true"]`);
        sidebar?.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus?.({ preventScroll: true });
      });
    }
  };

  const closeSidebars = () => setOpenSidebar('');

  const updateEditorTop = (shell) => {
    if (!(shell instanceof HTMLElement)) return;
    const top = `${Math.max(0, Math.round(shell.getBoundingClientRect().top))}px`;
    setCssVar('--asteryon-editor-top', top);
  };

  const bindShellResize = (shell) => {
    if (observedShell === shell) return;
    resizeObserver?.disconnect();
    observedShell = shell instanceof HTMLElement ? shell : null;
    if (!observedShell || !('ResizeObserver' in window)) return;
    resizeObserver = new ResizeObserver(() => updateEditorTop(observedShell));
    resizeObserver.observe(observedShell);
  };

  const ensureEditorControls = () => {
    const shell = getEditorShell();
    if (!shell) return false;

    updateEditorTop(shell);
    bindShellResize(shell);

    const sidebars = [...shell.children].filter((node) => (
      node instanceof HTMLElement && node.matches('div.flex.shrink-0.flex-col')
    ));

    sidebars.forEach((sidebar, index) => {
      const side = index === 0 ? 'left' : index === sidebars.length - 1 ? 'right' : `extra-${index}`;
      setDataset(sidebar, 'asteryonEditorSidebar', side);
      if (!sidebar.dataset.open) sidebar.dataset.open = 'false';
    });

    let backdrop = document.querySelector(`[${BACKDROP_ATTR}]`);
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.setAttribute(BACKDROP_ATTR, 'true');
      backdrop.setAttribute('aria-label', 'Fechar painéis do editor');
      backdrop.dataset.open = 'false';
      backdrop.addEventListener('click', closeSidebars);
      document.body.appendChild(backdrop);
    }

    let toolbar = document.querySelector(`[${TOOLBAR_ATTR}]`);
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.setAttribute(TOOLBAR_ATTR, 'true');
      toolbar.setAttribute('role', 'toolbar');
      toolbar.setAttribute('aria-label', 'Painéis do editor');
      document.body.appendChild(toolbar);
    }

    const desired = [
      sidebars.some((el) => el.dataset.asteryonEditorSidebar === 'left') && ['left', '☰ Painel'],
      sidebars.some((el) => el.dataset.asteryonEditorSidebar === 'right') && ['right', '⚙ Propriedades'],
    ].filter(Boolean);

    const currentKey = [...toolbar.querySelectorAll('button[data-side]')].map((b) => b.dataset.side).join('|');
    const desiredKey = desired.map(([side]) => side).join('|');
    if (currentKey !== desiredKey) {
      toolbar.replaceChildren();
      for (const [side, label] of desired) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.side = side;
        button.textContent = label;
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', () => {
          const sidebar = document.querySelector(`[data-asteryon-editor-sidebar="${side}"]`);
          setOpenSidebar(sidebar?.dataset.open === 'true' ? '' : side);
        });
        toolbar.appendChild(button);
      }
    }

    return true;
  };

  const removeEditorControlsIfNeeded = () => {
    if (root.dataset.asteryonSurface === 'editor') return;
    document.querySelector(`[${TOOLBAR_ATTR}]`)?.remove();
    document.querySelector(`[${BACKDROP_ATTR}]`)?.remove();
    for (const sidebar of document.querySelectorAll('[data-asteryon-editor-sidebar]')) {
      delete sidebar.dataset.asteryonEditorSidebar;
      delete sidebar.dataset.open;
    }
    resizeObserver?.disconnect();
    resizeObserver = null;
    observedShell = null;
  };

  const markCatalogModalFrom = (scope = document) => {
    const close = scope instanceof Element && scope.matches('button[aria-label="Fechar catálogo"]')
      ? scope
      : scope.querySelector?.('button[aria-label="Fechar catálogo"]');
    if (!close) return false;
    const header = close.parentElement;
    const panel = header?.parentElement;
    const modalRoot = panel?.parentElement;
    if (!header || !panel || !modalRoot) return false;
    modalRoot.dataset.asteryonCatalogModalRoot = 'true';
    panel.dataset.asteryonCatalogModalPanel = 'true';
    header.dataset.asteryonCatalogModalHeader = 'true';
    return true;
  };

  const markProductModalFrom = (scope = document) => {
    const close = scope instanceof Element && scope.matches('button[aria-label="Fechar produto"]')
      ? scope
      : scope.querySelector?.('button[aria-label="Fechar produto"]');
    if (!close) return false;
    const header = close.parentElement;
    const panel = header?.parentElement;
    const modalRoot = panel?.parentElement;
    if (!header || !panel || !modalRoot) return false;
    modalRoot.dataset.asteryonProductModalRoot = 'true';
    panel.dataset.asteryonProductModalPanel = 'true';
    header.dataset.asteryonProductModalHeader = 'true';
    return true;
  };

  const apply = (forceStructure = false) => {
    raf = 0;
    const { width, height, visualWidth } = viewport();
    const device = deviceFor(width);
    const orientation = window.matchMedia?.('(orientation: landscape)')?.matches ? 'landscape' : 'portrait';
    const touch = window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
    const surface = detectSurface();
    const signature = `${width}x${height}:${visualWidth}:${device}:${orientation}:${touch ? 1 : 0}:${surface}`;
    const viewportChanged = signature !== lastSignature;
    const surfaceChanged = surface !== lastSurface;

    if (viewportChanged) {
      setDataset(root, 'asteryonDevice', device);
      setDataset(root, 'asteryonOrientation', orientation);
      setDataset(root, 'asteryonTouch', touch ? 'true' : 'false');
      setDataset(root, 'asteryonSurface', surface);
      setCssVar('--asteryon-vw', `${width}px`);
      setCssVar('--asteryon-visual-vw', `${visualWidth}px`);
      setCssVar('--asteryon-vh', `${height}px`);
      setCssVar('--asteryon-dvh', `${height}px`);
      setCssVar('--asteryon-touch', touch ? '1' : '0');
    }

    if (forceStructure || surfaceChanged) {
      if (surface === 'editor') ensureEditorControls();
      else removeEditorControlsIfNeeded();
      markCatalogModalFrom(document);
      markProductModalFrom(document);
    }

    if (surface === 'editor' && device === 'desktop' && lastDevice && lastDevice !== 'desktop') closeSidebars();

    if (viewportChanged) {
      lastSignature = signature;
      window.dispatchEvent(new CustomEvent('asteryon:viewport-change', {
        detail: { width, height, visualWidth, device, orientation, touch, surface },
      }));
    }

    lastDevice = device;
    lastSurface = surface;
  };

  const schedule = (forceStructure = false) => {
    if (raf) return;
    raf = requestAnimationFrame(() => apply(forceStructure));
  };

  const scheduleStructure = (delay = 90) => {
    window.clearTimeout(structuralTimer);
    structuralTimer = window.setTimeout(() => {
      structuralTimer = 0;
      schedule(true);
    }, delay);
  };

  const addedNodeNeedsWork = (node) => {
    if (!(node instanceof Element)) return false;
    if (node.matches('button[aria-label="Fechar catálogo"],button[aria-label="Fechar produto"]')) return true;
    if (node.querySelector?.('button[aria-label="Fechar catálogo"],button[aria-label="Fechar produto"]')) return true;
    if (!observedShell && (node.matches('#root, .h-screen.w-screen.overflow-hidden') || node.querySelector?.('#root > div.h-screen.w-screen.overflow-hidden'))) return true;
    if (lastSurface !== 'editor' && node.querySelector?.('div.flex.flex-1.overflow-hidden')) return true;
    return false;
  };

  const start = () => {
    apply(true);

    window.addEventListener('resize', () => schedule(false), { passive: true });
    window.addEventListener('orientationchange', () => schedule(false), { passive: true });
    window.visualViewport?.addEventListener('resize', () => schedule(false), { passive: true });
    window.visualViewport?.addEventListener('scroll', () => schedule(false), { passive: true });

    // V88: não reage mais a toda mutação React. Só sincroniza quando surge a
    // estrutura do editor ou um modal que realmente precisa de marcação responsiva.
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (addedNodeNeedsWork(node)) {
            if (node instanceof Element) {
              markCatalogModalFrom(node);
              markProductModalFrom(node);
            }
            scheduleStructure(80);
            return;
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.querySelector('[data-asteryon-editor-sidebar][data-open="true"]')) closeSidebars();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  void MARKER;
})();
