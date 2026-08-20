(() => {
  'use strict';

  if (window.__ASTERYON_RESOLVED_TEMPLATE_V90__) return;
  window.__ASTERYON_RESOLVED_TEMPLATE_V90__ = true;

  const VERSION = '90';
  const STORAGE_KEY = 'asteryon_resolved_template_v90';
  const PENDING_KEY = 'asteryon_resolved_template_v90_pending';
  const PREVIEW_ID = 'laurencini-template-preview-v69';
  const CAROUSEL_TRACK_ID = 'asteryon-brands-carousel-track-v90';
  const EDITABLE_STYLE_KEYS = Object.freeze([
    'background', 'backgroundColor', 'color', 'borderColor', 'border',
    'borderRadius', 'boxShadow', 'opacity', 'fontFamily', 'fontSize',
    'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'padding',
    'margin', 'gap', 'width', 'height', 'objectFit', 'objectPosition',
  ]);

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const isAdmin = () => location.pathname.startsWith('/admin');
  const isEditor = () => {
    if (!isAdmin()) return false;
    const heading = [...document.querySelectorAll('h1,h2')]
      .find((node) => normalize(node.textContent) === 'editar catalogo');
    return Boolean(heading);
  };

  function installStyles() {
    if (document.getElementById('asteryon-resolved-template-v90-styles')) return;
    const style = document.createElement('style');
    style.id = 'asteryon-resolved-template-v90-styles';
    style.textContent = `
      @keyframes asteryonBrandsMarqueeV90 {
        from { transform: translate3d(0,0,0); }
        to { transform: translate3d(-50%,0,0); }
      }
      [data-asteryon-brands-track="v90"],
      [data-node-id="${CAROUSEL_TRACK_ID}"],
      [data-element-id="${CAROUSEL_TRACK_ID}"] {
        animation: asteryonBrandsMarqueeV90 24s linear infinite !important;
        will-change: transform;
      }
      [data-asteryon-brands-track="v90"]:hover,
      [data-node-id="${CAROUSEL_TRACK_ID}"]:hover,
      [data-element-id="${CAROUSEL_TRACK_ID}"]:hover {
        animation-play-state: paused !important;
      }
      #${PREVIEW_ID} .ltp-brand-grid[data-asteryon-carousel="v90"] {
        display: flex !important;
        width: max-content !important;
        min-width: 200% !important;
        gap: 12px !important;
        animation: asteryonBrandsMarqueeV90 24s linear infinite !important;
        will-change: transform;
      }
      #${PREVIEW_ID} .ltp-brand-grid[data-asteryon-carousel="v90"]:hover {
        animation-play-state: paused !important;
      }
      #${PREVIEW_ID} [data-asteryon-carousel-viewport="v90"] {
        overflow: hidden !important;
      }
      [data-asteryon-editable-v90="true"] { cursor: inherit; }
    `;
    document.head.appendChild(style);
  }

  function semantic(node) {
    if (!node || typeof node !== 'object') return '';
    const props = node.props && typeof node.props === 'object' ? node.props : {};
    return normalize([
      node.id, node.name, node.type, props.name, props.label, props.text,
      props.testId, props.testID, props.role,
    ].filter(Boolean).join(' '));
  }

  function cloneResponsive(source, x, y, width, height) {
    const responsive = source && typeof source === 'object' ? source : {};
    const make = (mode) => {
      const current = responsive[mode] && typeof responsive[mode] === 'object' ? responsive[mode] : {};
      return {
        ...current,
        x: Number.isFinite(x?.[mode]) ? x[mode] : Number(current.x || 0),
        y: Number.isFinite(y?.[mode]) ? y[mode] : Number(current.y || 0),
        width: Number.isFinite(width?.[mode]) ? width[mode] : Number(current.width || 0),
        height: Number.isFinite(height?.[mode]) ? height[mode] : Number(current.height || 0),
      };
    };
    return { tablet: make('tablet'), mobile: make('mobile') };
  }

  function brandText(node) {
    const props = node?.props && typeof node.props === 'object' ? node.props : {};
    return normalize(props.text || node?.name || '');
  }

  function makeBrandsCarousel(group) {
    if (!group || typeof group !== 'object' || !Array.isArray(group.children)) return group;
    if (group.children.some((child) => child?.id === CAROUSEL_TRACK_ID || child?.id === 'asteryon-brands-carousel-viewport-v90')) return group;

    const groupSemantic = semantic(group);
    const hasBrandMeaning = groupSemantic.includes('marca') || groupSemantic.includes('brand');
    if (!hasBrandMeaning) return group;

    const title = group.children.find((child) => {
      const value = brandText(child);
      return value.includes('marcas em destaque') || value === 'marcas' || value === 'brands';
    });
    const candidates = group.children.filter((child) => child !== title);
    if (candidates.length < 4) return group;

    const viewportX = 24;
    const viewportY = title ? 62 : 16;
    const viewportWidth = Math.max(240, Number(group.width || 1056) - (viewportX * 2));
    const viewportHeight = Math.max(48, Number(group.height || 140) - viewportY - 16);
    const tabletWidth = Math.max(220, Number(group.responsive?.tablet?.width || viewportWidth) - 32);
    const mobileWidth = Math.max(220, Number(group.responsive?.mobile?.width || 350) - 24);

    const desktopStep = Math.max(142, Math.floor(viewportWidth / Math.min(6, candidates.length)));
    const tabletStep = Math.max(132, Math.floor(tabletWidth / Math.min(4, candidates.length)));
    const mobileStep = Math.max(118, Math.floor(mobileWidth / Math.min(3, candidates.length)));

    const normalizeBrand = (source, index, duplicate) => {
      const clone = {
        ...source,
        id: duplicate ? `${source.id || `brand-${index + 1}`}-loop-v90` : `${source.id || `brand-${index + 1}`}-carousel-v90`,
        name: source.name || `Marca ${index + 1}`,
        x: index * desktopStep,
        y: 4,
        width: Math.min(Number(source.width || 140), desktopStep - 12),
        height: Math.max(34, Number(source.height || 38)),
        locked: false,
        visible: source.visible !== false,
        styles: {
          ...(source.styles || {}),
          flexShrink: 0,
        },
        props: {
          ...(source.props || {}),
          editable: true,
          styleEditable: true,
          editableStyleProperties: EDITABLE_STYLE_KEYS,
          carouselBrand: true,
        },
      };
      clone.responsive = cloneResponsive(
        source.responsive,
        { tablet: index * tabletStep, mobile: index * mobileStep },
        { tablet: 4, mobile: 4 },
        {
          tablet: Math.min(Number(source.responsive?.tablet?.width || clone.width), tabletStep - 10),
          mobile: Math.min(Number(source.responsive?.mobile?.width || clone.width), mobileStep - 8),
        },
        {
          tablet: Math.max(34, Number(source.responsive?.tablet?.height || clone.height)),
          mobile: Math.max(34, Number(source.responsive?.mobile?.height || clone.height)),
        },
      );
      return clone;
    };

    const firstSet = candidates.map((child, index) => normalizeBrand(child, index, false));
    const secondSet = candidates.map((child, index) => normalizeBrand(child, index + candidates.length, true));
    const trackWidth = desktopStep * candidates.length * 2;
    const trackTabletWidth = tabletStep * candidates.length * 2;
    const trackMobileWidth = mobileStep * candidates.length * 2;

    const track = {
      id: CAROUSEL_TRACK_ID,
      name: 'Carrossel de marcas animado',
      type: 'group',
      x: 0,
      y: 0,
      width: trackWidth,
      height: viewportHeight,
      locked: false,
      visible: true,
      opacity: 1,
      rotation: 0,
      zIndex: 1,
      props: {
        atomicTemplate: true,
        editable: true,
        styleEditable: true,
        carousel: true,
        carouselAnimated: true,
        carouselLoop: true,
        carouselPauseOnHover: true,
        carouselDirection: 'left',
        carouselDurationSeconds: 24,
        editableStyleProperties: EDITABLE_STYLE_KEYS,
      },
      styles: {
        animation: 'asteryonBrandsMarqueeV90 24s linear infinite',
        willChange: 'transform',
      },
      responsive: {
        tablet: { x: 0, y: 0, width: trackTabletWidth, height: viewportHeight },
        mobile: { x: 0, y: 0, width: trackMobileWidth, height: viewportHeight },
      },
      children: [...firstSet, ...secondSet],
    };

    const viewport = {
      id: 'asteryon-brands-carousel-viewport-v90',
      name: 'Área visível do carrossel de marcas',
      type: 'group',
      x: viewportX,
      y: viewportY,
      width: viewportWidth,
      height: viewportHeight,
      locked: false,
      visible: true,
      opacity: 1,
      rotation: 0,
      zIndex: 1,
      props: {
        atomicTemplate: true,
        editable: true,
        styleEditable: true,
        carouselViewport: true,
        editableStyleProperties: EDITABLE_STYLE_KEYS,
      },
      styles: { overflow: 'hidden' },
      responsive: {
        tablet: { x: 16, y: viewportY, width: tabletWidth, height: viewportHeight },
        mobile: { x: 12, y: viewportY, width: mobileWidth, height: viewportHeight },
      },
      children: [track],
    };

    return {
      ...group,
      locked: false,
      props: {
        ...(group.props || {}),
        editable: true,
        styleEditable: true,
        brandsCarousel: true,
        carouselAnimated: true,
        editableStyleProperties: EDITABLE_STYLE_KEYS,
      },
      children: title ? [title, viewport] : [viewport],
    };
  }

  function enhanceNode(input) {
    if (!input || typeof input !== 'object') return input;
    let node = {
      ...input,
      locked: false,
      props: {
        ...(input.props || {}),
        editable: true,
        styleEditable: true,
        editableStyleProperties: EDITABLE_STYLE_KEYS,
      },
      styles: { ...(input.styles || {}) },
    };

    const meaning = semantic(node);
    if (meaning.includes('header') || meaning.includes('cabecalho') || meaning.includes('menu') || meaning.includes('logo') || meaning.includes('marca editavel')) {
      node.props = {
        ...node.props,
        headerEditable: true,
        contentEditable: true,
        colorsEditable: true,
        geometryEditable: true,
      };
    }

    if (Array.isArray(input.children)) node.children = input.children.map(enhanceNode);
    node = makeBrandsCarousel(node);
    return node;
  }

  function enhancePayload(value, key = '') {
    if (Array.isArray(value)) {
      if (normalize(key) === 'nodes') return value.map(enhanceNode);
      return value.map((item) => enhancePayload(item));
    }
    if (!value || typeof value !== 'object') return value;

    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      if (normalize(childKey) === 'nodes' && Array.isArray(childValue)) output[childKey] = childValue.map(enhanceNode);
      else output[childKey] = enhancePayload(childValue, childKey);
    }
    return output;
  }

  function installTemplateFetchBridge() {
    if (!isAdmin() || window.__ASTERYON_TEMPLATE_FETCH_V90__) return;
    window.__ASTERYON_TEMPLATE_FETCH_V90__ = true;
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      try {
        const input = args[0];
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = normalize(args[1]?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
        if (method !== 'GET' || !String(url).includes('/api/admin/templates')) return response;

        const payload = await response.clone().json();
        const enhanced = enhancePayload(payload);
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        headers.set('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(enhanced), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        console.warn('ASTERYON V90: não foi possível enriquecer os modelos; resposta original preservada.', error);
        return response;
      }
    };
  }

  function duplicatePreviewBrands() {
    const modal = document.getElementById(PREVIEW_ID);
    if (!modal) return;
    const grids = [...modal.querySelectorAll('.ltp-brand-grid')];
    grids.forEach((grid) => {
      if (grid.dataset.asteryonCarousel === 'v90') return;
      const original = [...grid.children];
      if (original.length < 2) return;
      const viewport = grid.parentElement;
      if (viewport) viewport.dataset.asteryonCarouselViewport = 'v90';
      original.forEach((node) => {
        const copy = node.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.setAttribute('data-asteryon-carousel-copy', 'v90');
        grid.appendChild(copy);
      });
      grid.dataset.asteryonCarousel = 'v90';
    });
  }

  function persistPreviewSnapshot() {
    const modal = document.getElementById(PREVIEW_ID);
    const content = modal?.querySelector('[data-ltp-content]');
    if (!modal || !content) return null;

    const title = normalize(modal.querySelector('[data-ltp-title]')?.textContent || '');
    const originalApply = document.querySelector('button[title^="Aplicar modelo:"]');
    const modelTitle = originalApply?.getAttribute('title') || title || 'modelo';
    const snapshot = {
      version: VERSION,
      createdAt: new Date().toISOString(),
      modelTitle,
      previewHtml: content.innerHTML,
      previewText: content.textContent || '',
      route: location.pathname,
      policy: {
        sourceOfTruth: 'applied-template-state',
        editorMustReuseAppliedState: true,
        headerFullyEditable: true,
        allColorsEditable: true,
        brandsAnimatedCarousel: true,
      },
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ createdAt: snapshot.createdAt, modelTitle }));
    } catch (error) {
      console.warn('ASTERYON V90: snapshot do preview não pôde ser persistido.', error);
    }
    window.__ASTERYON_LAST_RESOLVED_TEMPLATE_V90__ = snapshot;
    window.dispatchEvent(new CustomEvent('asteryon:resolved-template-v90', { detail: snapshot }));
    return snapshot;
  }

  function unlockEditorControls() {
    if (!isEditor()) return;

    const controls = [...document.querySelectorAll('input,textarea,select,button')];
    controls.forEach((control) => {
      if (!(control instanceof HTMLElement)) return;
      const context = normalize([
        control.getAttribute('aria-label'), control.getAttribute('title'),
        control.getAttribute('placeholder'), control.closest('label')?.textContent,
        control.parentElement?.textContent,
      ].filter(Boolean).join(' '));

      const isProtectedAction = context.includes('excluir conta') || context.includes('sair');
      if (isProtectedAction) return;

      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
        control.removeAttribute('readonly');
        control.removeAttribute('aria-readonly');
        if (control.disabled && (
          context.includes('cor') || context.includes('fundo') || context.includes('borda') ||
          context.includes('fonte') || context.includes('header') || context.includes('cabecalho') ||
          context.includes('menu') || context.includes('logo') || context.includes('texto') ||
          context.includes('largura') || context.includes('altura') || context.includes('posicao') ||
          context.includes('margem') || context.includes('espacamento') || context.includes('opacidade')
        )) control.removeAttribute('disabled');
        control.dataset.asteryonEditableV90 = 'true';
      }
    });

    const colorInputs = [...document.querySelectorAll('input[type="color"]')];
    colorInputs.forEach((input) => {
      input.removeAttribute('disabled');
      input.removeAttribute('readonly');
      input.dataset.asteryonEditableV90 = 'true';
    });

    document.documentElement.dataset.asteryonEditorResolvedV90 = 'true';
  }

  let editNavigationRequested = false;
  function maybeOpenEditorAfterApply() {
    if (!isAdmin() || editNavigationRequested || isEditor()) return;
    let pending = null;
    try { pending = sessionStorage.getItem(PENDING_KEY); } catch { pending = null; }
    if (!pending) return;

    const success = [...document.querySelectorAll('body *')]
      .find((node) => normalize(node.textContent) === 'modelo aplicado com sucesso.');
    if (!success) return;

    const editButton = [...document.querySelectorAll('button')]
      .find((button) => normalize(button.textContent) === 'editar' && !button.disabled);
    if (!editButton) return;

    editNavigationRequested = true;
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* noop */ }
    window.setTimeout(() => editButton.click(), 60);
  }

  function handleCaptureClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-ltp-apply]') : null;
    if (!target) return;
    persistPreviewSnapshot();
  }

  function runDomPatches() {
    duplicatePreviewBrands();
    unlockEditorControls();
    maybeOpenEditorAfterApply();
  }

  installStyles();
  installTemplateFetchBridge();
  document.addEventListener('click', handleCaptureClick, true);

  const observer = new MutationObserver(runDomPatches);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'readonly'] });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runDomPatches, { once: true });
  } else {
    runDomPatches();
  }
  window.addEventListener('popstate', runDomPatches);

  window.__ASTERYON_TEMPLATE_V90__ = Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    editableStyleKeys: EDITABLE_STYLE_KEYS,
    enhancePayload,
    enhanceNode,
  });
})();
