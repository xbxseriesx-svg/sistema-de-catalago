(() => {
  const root = document.documentElement;
  // Mantém exatamente os mesmos limites do renderer público bJ do bundle.
  const MOBILE_MAX = 767;
  const TABLET_MAX = 1100;
  const TOOLBAR_ATTR = 'data-asteryon-mobile-toolbar';
  const BACKDROP_ATTR = 'data-asteryon-sidebar-backdrop';
  let raf = 0;
  let lastSignature = '';
  let observer = null;

  const viewport = () => {
    const vv = window.visualViewport;
    const width = Math.max(1, Math.round(window.innerWidth || root.clientWidth || 1));
    const height = Math.max(1, Math.round(vv?.height || window.innerHeight || root.clientHeight || 1));
    const visualWidth = Math.max(1, Math.round(vv?.width || width));
    return { width, height, visualWidth };
  };

  const deviceFor = (width) => {
    if (width <= MOBILE_MAX) return 'mobile';
    if (width <= TABLET_MAX) return 'tablet';
    return 'desktop';
  };

  const getEditorShell = () => document.querySelector(
    '#root > div.h-screen.w-screen.overflow-hidden > div.flex.flex-1.overflow-hidden',
  );

  const detectSurface = () => {
    if (/\/importar-imagens(?:\.html)?$/i.test(location.pathname)) return 'importer';
    if (getEditorShell()) return 'editor';
    return 'public';
  };

  const setOpenSidebar = (side) => {
    const sidebars = [...document.querySelectorAll('[data-asteryon-editor-sidebar]')];
    let opened = false;
    for (const sidebar of sidebars) {
      const shouldOpen = sidebar.dataset.asteryonEditorSidebar === side;
      sidebar.dataset.open = shouldOpen ? 'true' : 'false';
      if (shouldOpen) opened = true;
    }

    const backdrop = document.querySelector(`[${BACKDROP_ATTR}]`);
    if (backdrop) backdrop.dataset.open = opened ? 'true' : 'false';

    const toolbar = document.querySelector(`[${TOOLBAR_ATTR}]`);
    if (toolbar) {
      for (const button of toolbar.querySelectorAll('button[data-side]')) {
        button.setAttribute('aria-expanded', button.dataset.side === side && opened ? 'true' : 'false');
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

  const ensureEditorControls = () => {
    const shell = getEditorShell();
    if (!shell) return false;

    const shellRect = shell.getBoundingClientRect();
    root.style.setProperty('--asteryon-editor-top', `${Math.max(0, Math.round(shellRect.top))}px`);

    const sidebars = [...shell.children].filter((node) => (
      node instanceof HTMLElement && node.matches('div.flex.shrink-0.flex-col')
    ));

    if (sidebars.length) {
      sidebars.forEach((sidebar, index) => {
        const side = index === 0 ? 'left' : index === sidebars.length - 1 ? 'right' : `extra-${index}`;
        sidebar.dataset.asteryonEditorSidebar = side;
        if (!sidebar.dataset.open) sidebar.dataset.open = 'false';
      });
    }

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
          const isOpen = sidebar?.dataset.open === 'true';
          setOpenSidebar(isOpen ? '' : side);
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
  };

  const markCatalogModal = () => {
    const close = document.querySelector('button[aria-label="Fechar catálogo"]');
    if (!close) return;
    const header = close.parentElement;
    const panel = header?.parentElement;
    const modalRoot = panel?.parentElement;
    if (!header || !panel || !modalRoot) return;
    modalRoot.dataset.asteryonCatalogModalRoot = 'true';
    panel.dataset.asteryonCatalogModalPanel = 'true';
    header.dataset.asteryonCatalogModalHeader = 'true';
  };

  const markProductModalFallback = () => {
    const close = document.querySelector('button[aria-label="Fechar produto"]');
    if (!close) return;
    const header = close.parentElement;
    const panel = header?.parentElement;
    const modalRoot = panel?.parentElement;
    if (!header || !panel || !modalRoot) return;
    modalRoot.dataset.asteryonProductModalRoot = 'true';
    panel.dataset.asteryonProductModalPanel = 'true';
    header.dataset.asteryonProductModalHeader = 'true';
  };

  const apply = () => {
    raf = 0;
    const { width, height, visualWidth } = viewport();
    const device = deviceFor(width);
    const orientation = window.matchMedia?.('(orientation: landscape)')?.matches ? 'landscape' : 'portrait';
    const touch = window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
    const surface = detectSurface();

    root.dataset.asteryonDevice = device;
    root.dataset.asteryonOrientation = orientation;
    root.dataset.asteryonTouch = touch ? 'true' : 'false';
    root.dataset.asteryonSurface = surface;
    root.style.setProperty('--asteryon-vw', `${width}px`);
    root.style.setProperty('--asteryon-visual-vw', `${visualWidth}px`);
    root.style.setProperty('--asteryon-vh', `${height}px`);
    root.style.setProperty('--asteryon-dvh', `${height}px`);
    root.style.setProperty('--asteryon-touch', touch ? '1' : '0');

    if (surface === 'editor') {
      ensureEditorControls();
      if (device === 'desktop') closeSidebars();
    } else {
      removeEditorControlsIfNeeded();
    }

    markCatalogModal();
    markProductModalFallback();

    const signature = `${width}x${height}:${visualWidth}:${device}:${orientation}:${touch ? 1 : 0}:${surface}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      window.dispatchEvent(new CustomEvent('asteryon:viewport-change', {
        detail: { width, height, visualWidth, device, orientation, touch, surface },
      }));
    }
  };

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(apply);
  };

  const start = () => {
    apply();

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true });

    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.querySelector('[data-asteryon-editor-sidebar][data-open="true"]')) {
        closeSidebars();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
