(() => {
  'use strict';

  if (window.__ASTERYON_PREVIEW_EDITOR_V91_CORE__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V91_CORE__ = true;

  const VERSION = '91';
  const EDITABLE_STYLE_KEYS = Object.freeze([
    'background', 'backgroundColor', 'color', 'borderColor', 'border',
    'borderRadius', 'boxShadow', 'opacity', 'fontFamily', 'fontSize',
    'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'padding',
    'margin', 'gap', 'width', 'height', 'objectFit', 'objectPosition',
  ]);

  const state = {
    version: VERSION,
    templateNodeRefs: new Map(),
    catalog: null,
    capturedNodes: null,
    capturedNodeIndex: new Map(),
    brandOverrides: new Map(),
    styleOverrides: new Map(),
    report: null,
    initialParityChecked: false,
    idSequence: 0,
  };

  const clean = (value) => String(value ?? '').trim();
  const normalize = (value) => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const absoluteUrl = (value) => {
    const raw = clean(value);
    if (!raw) return '';
    try { return new URL(raw, location.href).href; } catch { return raw; }
  };
  const sameUrl = (a, b) => absoluteUrl(a) === absoluteUrl(b);
  const round = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
  };
  const px = (value, fallback = 0) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? round(number) : fallback;
  };
  const isEditor = () => {
    if (!location.pathname.startsWith('/admin')) return false;
    const titleMatch = [...document.querySelectorAll('h1,h2')].some((node) => normalize(node.textContent) === 'editar catalogo');
    if (titleMatch) return true;
    const canvasNode = document.querySelector('[data-node-id]');
    if (!(canvasNode instanceof HTMLElement)) return false;
    const editorChrome = document.querySelector('[data-asteryon-editor-sidebar], [data-asteryon-mobile-toolbar]')
      || [...document.querySelectorAll('button')].find((button) => ['elementos','modelos','gestao do catalogo','publicar','salvar'].includes(normalize(button.textContent)));
    return !!editorChrome;
  };

  function cssColor(value) {
    const raw = clean(value);
    if (!raw || raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return 'transparent';
    const match = raw.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+))?\)$/i);
    if (!match) return raw;
    const alpha = match[4] == null ? 1 : Number(match[4]);
    if (alpha < 1) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
  }

  const transparent = (value) => !value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)' || value === '#00000000';

  function nextId(label = 'node') {
    state.idSequence += 1;
    return `preview_v91_${normalize(label).replace(/[^a-z0-9]+/g, '_') || 'node'}_${state.idSequence}`;
  }

  function editableProps(extra = {}) {
    return {
      editable: true,
      styleEditable: true,
      geometryEditable: true,
      colorsEditable: true,
      contentEditable: true,
      editableStyleProperties: EDITABLE_STYLE_KEYS,
      previewFinalSource: true,
      previewFinalVersion: VERSION,
      ...extra,
    };
  }

  function responsive(x, y, width, height) {
    const tablet = 834 / 1440;
    const mobile = 390 / 1440;
    return {
      tablet: { x: round(x * tablet), y: round(y * tablet), width: Math.max(1, round(width * tablet)), height: Math.max(1, round(height * tablet)) },
      mobile: { x: round(x * mobile), y: round(y * mobile), width: Math.max(1, round(width * mobile)), height: Math.max(1, round(height * mobile)) },
    };
  }

  function stylesFrom(element, computed = getComputedStyle(element)) {
    const backgroundColor = cssColor(computed.backgroundColor);
    const backgroundImage = computed.backgroundImage && computed.backgroundImage !== 'none' ? computed.backgroundImage : '';
    const borderWidth = Math.max(px(computed.borderTopWidth), px(computed.borderRightWidth), px(computed.borderBottomWidth), px(computed.borderLeftWidth));
    const borderColor = cssColor(computed.borderTopColor);
    const borderStyle = computed.borderTopStyle && computed.borderTopStyle !== 'none' ? computed.borderTopStyle : 'solid';
    const styles = {
      color: cssColor(computed.color),
      backgroundColor,
      borderRadius: px(computed.borderRadius),
      boxShadow: computed.boxShadow === 'none' ? '' : computed.boxShadow,
      fontFamily: computed.fontFamily || 'Inter, sans-serif',
      fontSize: px(computed.fontSize, 14),
      fontWeight: computed.fontWeight || 400,
      lineHeight: computed.lineHeight === 'normal' ? 1.25 : px(computed.lineHeight, 18),
      letterSpacing: computed.letterSpacing === 'normal' ? 0 : px(computed.letterSpacing),
      textAlign: computed.textAlign || 'left',
      objectFit: computed.objectFit || 'contain',
      objectPosition: computed.objectPosition || '50% 50%',
    };
    if (backgroundImage) styles.background = backgroundImage;
    if (borderWidth > 0) styles.border = `${round(borderWidth)}px ${borderStyle} ${borderColor}`;
    return styles;
  }

  function brandLogo(brand) {
    return clean(brand?.logoUrl || brand?.logo_url || brand?.logo || brand?.image || brand?.imageUrl || brand?.image_url);
  }
  function brandId(brand) { return clean(brand?.id || brand?.brandId || brand?.brand_id); }
  function findBrand(id) {
    const brands = Array.isArray(state.catalog?.brands) ? state.catalog.brands : [];
    return brands.find((brand) => brandId(brand) === clean(id)) || null;
  }

  function registerTemplateRef(name, nodes) {
    const key = normalize(name);
    if (!key || !Array.isArray(nodes)) return;
    const refs = state.templateNodeRefs.get(key) || [];
    if (!refs.includes(nodes)) refs.push(nodes);
    state.templateNodeRefs.set(key, refs);
  }

  function retainTemplateRefs(payload) {
    const seen = new WeakSet();
    function walk(value, inheritedName = '') {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach((item) => walk(item, inheritedName));
        return;
      }
      const name = clean(value.name || value.title || value.templateName || value.template_name || inheritedName);
      for (const [key, child] of Object.entries(value)) {
        if (key === 'nodes' && Array.isArray(child) && name) registerTemplateRef(name, child);
        else walk(child, name);
      }
    }
    walk(payload);
  }

  function refsForTemplate(name) {
    const key = normalize(name);
    if (state.templateNodeRefs.has(key)) return state.templateNodeRefs.get(key);
    for (const [candidate, refs] of state.templateNodeRefs.entries()) {
      if (candidate.includes(key) || key.includes(candidate)) return refs;
    }
    return [];
  }

  function replaceTemplateNodes(name, nodes) {
    const refs = refsForTemplate(name);
    refs.forEach((ref) => ref.splice(0, ref.length, ...nodes));
    return refs.length;
  }

  function responseWithSharedJson(response, payload) {
    return new Proxy(response, {
      get(target, property) {
        if (property === 'json') return async () => payload;
        if (property === 'clone') return () => responseWithSharedJson(target.clone(), payload);
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  function rewriteLinkedNodes(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      value.forEach(rewriteLinkedNodes);
      return value;
    }
    if (value.id && state.styleOverrides.has(value.id)) value.styles = { ...(value.styles || {}), ...state.styleOverrides.get(value.id) };
    const props = value.props && typeof value.props === 'object' ? value.props : null;
    if (props) {
      const override = value.id ? state.brandOverrides.get(value.id) : null;
      const linkedId = clean(override?.brandId || props.actionEntityId || props.brandId);
      if ((props.brandLogoAuto || override) && linkedId) {
        const brand = findBrand(linkedId);
        const logo = brandLogo(brand) || override?.src;
        if (logo) Object.assign(props, {
          brandId: linkedId,
          brandName: clean(brand?.name || override?.name || props.brandName),
          src: logo,
          actionContext: 'brand',
          actionType: 'brand-page',
          actionEntityId: linkedId,
          actionValue: linkedId,
        });
      }
    }
    (value.children || []).forEach(rewriteLinkedNodes);
    return value;
  }

  function rewriteRequest(args) {
    const input = args[0];
    const init = args[1];
    if (!init || typeof init.body !== 'string') return args;
    const body = clean(init.body);
    if (!body.startsWith('{') && !body.startsWith('[')) return args;
    try {
      const payload = JSON.parse(body);
      rewriteLinkedNodes(payload);
      return [input, { ...init, body: JSON.stringify(payload) }];
    } catch { return args; }
  }

  function installFetchBridge() {
    if (window.__ASTERYON_FETCH_V91__) return;
    window.__ASTERYON_FETCH_V91__ = true;
    const previousFetch = window.fetch.bind(window);
    window.fetch = async (...rawArgs) => {
      const args = rewriteRequest(rawArgs);
      const response = await previousFetch(...args);
      try {
        const input = args[0];
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = normalize(args[1]?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method !== 'GET') return response;
        if (String(url).includes('/api/admin/templates')) {
          const payload = await response.clone().json();
          retainTemplateRefs(payload);
          return responseWithSharedJson(response, payload);
        }
        if (String(url).includes('/api/public/catalog')) {
          const payload = await response.clone().json();
          state.catalog = payload?.catalog || payload;
          return responseWithSharedJson(response, payload);
        }
      } catch (error) {
        console.warn('ASTERYON V91: resposta original preservada após falha da ponte.', error);
      }
      return response;
    };
  }

  Object.assign(state, {
    clean, normalize, absoluteUrl, sameUrl, round, px, cssColor, transparent,
    nextId, editableProps, responsive, stylesFrom, brandLogo, brandId, findBrand,
    replaceTemplateNodes, rewriteLinkedNodes, isEditor,
  });

  installFetchBridge();
  window.__ASTERYON_V91_STATE__ = state;
})();
