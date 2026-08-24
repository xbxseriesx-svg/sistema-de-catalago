(() => {
  'use strict';

  if (window.__ASTERYON_AUTO_RESPONSIVE_V95__) return;
  window.__ASTERYON_AUTO_RESPONSIVE_V95__ = true;

  const VERSION = '95.3';
  const BASE_WIDTH = 1440;
  const DEVICES = Object.freeze({ tablet: 834, mobile: 390 });
  const FRAME_HEIGHT = 900;
  const FRAME_ATTR = 'data-asteryon-responsive-measure-v95';
  const managedFrames = new Map();
  let cssCache = '';

  const clean = (value) => String(value ?? '').trim();
  const normalize = (value) => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const round = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const esc = (value) => clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const frame = (value) => ({
    x: Number(value?.x || 0),
    y: Number(value?.y || 0),
    width: Math.max(1, Number(value?.width || 1)),
    height: Math.max(1, Number(value?.height || 1)),
  });

  function variantFor(name) {
    const key = normalize(name);
    if (key.includes('atacado b2b')) return 'atacado';
    if (key.includes('institucional')) return 'institucional';
    if (key.includes('marcas b2b')) return 'marcas';
    if (key.includes('uniao')) return 'uniao';
    if (key.includes('hierarquico')) return 'hierarquico';
    if (key.includes('vitrine')) return 'vitrine';
    return 'varejo';
  }

  function templateCssText() {
    if (cssCache) return cssCache;
    const chunks = [];
    for (const sheet of [...document.styleSheets]) {
      const href = clean(sheet.href);
      if (!href.includes('template-preview-v69.css')) continue;
      try {
        chunks.push([...sheet.cssRules].map((rule) => rule.cssText).join('\n'));
      } catch (error) {
        console.warn('ASTERYON AUTO RESPONSIVE: CSS responsivo ainda indisponível.', error);
      }
    }
    cssCache = chunks.join('\n');
    return cssCache;
  }

  function ensureFrame(device) {
    const width = DEVICES[device];
    let iframe = document.querySelector(`iframe[${FRAME_ATTR}="${device}"]`);
    if (!(iframe instanceof HTMLIFrameElement)) {
      iframe = document.createElement('iframe');
      iframe.setAttribute(FRAME_ATTR, device);
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      Object.assign(iframe.style, {
        position: 'fixed',
        left: '-30000px',
        top: '0',
        width: `${width}px`,
        height: `${FRAME_HEIGHT}px`,
        visibility: 'hidden',
        pointerEvents: 'none',
        border: '0',
        zIndex: '-1',
      });
      (document.body || document.documentElement).appendChild(iframe);
    }
    iframe.style.width = `${width}px`;
    iframe.style.height = `${FRAME_HEIGHT}px`;
    return iframe;
  }

  function isManaged(node) {
    const props = node?.props || {};
    return Boolean(
      props.previewFinalSource
      || props.previewSourceRect
      || props.previewClassName
      || props.previewDomTag
      || props.brandsCarousel
      || props.carouselViewport
      || props.previewLayoutGroup,
    );
  }

  function sourceRect(node, parent) {
    const own = node?.props?.previewSourceRect;
    if (own && Number(own.width) > 0 && Number(own.height) > 0) {
      const parentSource = parent?.props?.previewSourceRect;
      if (parentSource && Number(parentSource.width) > 0 && Number(parentSource.height) > 0) {
        return {
          x: Number(own.x || 0) - Number(parentSource.x || 0),
          y: Number(own.y || 0) - Number(parentSource.y || 0),
          width: Number(own.width),
          height: Number(own.height),
        };
      }
      return {
        x: Number(own.x || 0),
        y: Number(own.y || 0),
        width: Number(own.width),
        height: Number(own.height),
      };
    }
    return frame(node);
  }

  function nodeTag(node) {
    const declared = clean(node?.props?.previewDomTag).toLowerCase();
    if (/^(div|section|header|footer|nav|main|article|aside|span|strong|small|p|h1|h2|h3|h4|h5|h6|button|a|label)$/.test(declared)) return declared;
    if (node?.type === 'image') return 'img';
    if (node?.type === 'search') return 'input';
    if (node?.type === 'button') return 'button';
    if (['text', 'heading', 'paragraph'].includes(node?.type)) return 'div';
    return 'div';
  }

  function mirrorNode(node, root = false) {
    if (!node || (!root && !isManaged(node))) return '';
    const props = node.props || {};
    if (props.duplicateForLoop) return '';
    const id = esc(node.id || '');
    const cls = clean(props.previewClassName);
    const classAttr = cls ? ` class="${esc(cls)}"` : '';
    const marker = ` data-ar-node="${id}"`;

    if (props.brandsCarousel || props.carouselViewport) {
      return `<div${marker} class="ltp-brand-grid" style="width:100%;min-height:92px;height:92px;overflow:hidden"></div>`;
    }

    if (node.type === 'image') {
      const src = clean(props.src);
      const alt = clean(props.alt || props.brandName || node.name || '');
      const w = Math.max(1, Math.round(Number(node.width || 1)));
      const h = Math.max(1, Math.round(Number(node.height || 1)));
      return `<img${marker}${classAttr} src="${esc(src)}" alt="${esc(alt)}" width="${w}" height="${h}">`;
    }

    if (node.type === 'search') {
      return `<input${marker}${classAttr} type="search" placeholder="${esc(props.placeholder || '')}" value="${esc(props.value || '')}">`;
    }

    const tag = nodeTag(node);
    const children = Array.isArray(node.children)
      ? node.children.map((child) => mirrorNode(child, false)).join('')
      : '';
    const ownText = children ? '' : clean(props.text ?? props.label ?? '');
    const safeText = ownText ? esc(ownText) : '';
    const href = tag === 'a' ? ' href="#"' : '';
    const type = tag === 'button' ? ' type="button"' : '';
    return `<${tag}${marker}${classAttr}${href}${type}>${children || safeText}</${tag}>`;
  }

  function writeFrame(device, root) {
    const iframe = ensureFrame(device);
    const doc = iframe.contentDocument;
    if (!doc) return null;
    const css = templateCssText();
    if (!css) return null;
    const variant = variantFor(root?.props?.templateName || root?.name || '');
    const content = (root.children || [])
      .filter((child) => isManaged(child))
      .map((child) => mirrorNode(child, false))
      .join('');
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${css}\nhtml,body{margin:0!important;padding:0!important;width:100%!important;max-width:100%!important;overflow-x:hidden!important}.ltp-shell{box-shadow:none!important}</style></head><body><div class="ltp-shell ltp-variant-${variant}" data-ar-node="${esc(root.id)}">${content}</div></body></html>`);
    doc.close();
    return { iframe, doc };
  }

  function measure(device, root) {
    const targetWidth = DEVICES[device];
    const written = writeFrame(device, root);
    if (!written) return null;
    const { doc } = written;
    const shell = doc.querySelector(`[data-ar-node="${CSS.escape(clean(root.id))}"]`);
    if (!(shell instanceof written.iframe.contentWindow.HTMLElement)) return null;
    const result = new Map();
    const shellRect = shell.getBoundingClientRect();
    result.set(clean(root.id), {
      x: 0,
      y: 0,
      width: targetWidth,
      height: Math.max(FRAME_HEIGHT, round(Math.max(shellRect.height, shell.scrollHeight))),
    });
    for (const element of doc.querySelectorAll('[data-ar-node]')) {
      if (element === shell) continue;
      const id = clean(element.getAttribute('data-ar-node'));
      if (!id) continue;
      const parentElement = element.parentElement?.closest?.('[data-ar-node]') || shell;
      const rect = element.getBoundingClientRect();
      const parentRect = parentElement.getBoundingClientRect();
      result.set(id, {
        x: round(rect.left - parentRect.left),
        y: round(rect.top - parentRect.top),
        width: Math.max(1, round(rect.width)),
        height: Math.max(1, round(rect.height)),
      });
    }
    return result;
  }

  function flatten(root) {
    const list = [];
    const parents = new Map();
    const walk = (node, parent = null) => {
      if (!node || typeof node !== 'object') return;
      list.push(node);
      if (parent) parents.set(node, parent);
      for (const child of node.children || []) walk(child, node);
    };
    walk(root);
    return { list, parents };
  }

  function isLayoutGroup(node) {
    const props = node?.props || {};
    return node?.type === 'page'
      || props.previewLayoutGroup
      || props.brandsCarousel
      || props.carouselViewport
      || ['ltp-site-header', 'ltp-mainnav', 'ltp-searchrow', 'ltp-deptbar', 'ltp-hero', 'ltp-hero-copy', 'ltp-hero-visual', 'ltp-hero-card', 'ltp-hero-actions', 'ltp-section', 'ltp-section alt', 'ltp-section dark', 'ltp-section red', 'ltp-section-head', 'ltp-segments', 'ltp-products', 'ltp-departments', 'ltp-brand-grid', 'ltp-story', 'ltp-story-list', 'ltp-metrics', 'ltp-contact', 'ltp-footer', 'ltp-footer-grid'].includes(clean(props.previewClassName));
  }

  function applyDesktopDelta(node, parent, baseline, parentTarget) {
    if (!baseline) return baseline;
    if (!node?.props?.previewSourceRect) return { ...baseline };
    const original = sourceRect(node, parent);
    const current = frame(node);
    const parentSource = parent ? sourceRect(parent, null) : { x: 0, y: 0, width: BASE_WIDTH, height: Number(parent?.height || node?.height || 1) };
    const scale = parentTarget && Number(parentSource.width) > 0
      ? Number(parentTarget.width) / Number(parentSource.width)
      : 1;
    const changedX = current.x - original.x;
    const changedY = current.y - original.y;
    const next = {
      x: round(baseline.x + changedX * scale),
      y: round(baseline.y + changedY * scale),
      width: baseline.width,
      height: baseline.height,
    };
    if (!isLayoutGroup(node)) {
      const widthFactor = original.width > 0 ? current.width / original.width : 1;
      const heightFactor = original.height > 0 ? current.height / original.height : 1;
      if (Math.abs(widthFactor - 1) > 0.005) next.width = Math.max(1, round(baseline.width * widthFactor));
      if (Math.abs(heightFactor - 1) > 0.005) next.height = Math.max(1, round(baseline.height * heightFactor));
    }
    return next;
  }

  function nearestTopLevelAnchor(root, freeNode, measured) {
    const centerY = Number(freeNode.y || 0) + Number(freeNode.height || 0) / 2;
    const candidates = (root.children || []).filter((item) => isManaged(item) && measured.has(clean(item.id)));
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const item of candidates) {
      const top = Number(item.y || 0);
      const bottom = top + Number(item.height || 0);
      const distance = centerY < top ? top - centerY : centerY > bottom ? centerY - bottom : 0;
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  }

  function mapFreeFrame(node, parentDesktop, parentTarget, targetWidth) {
    const desktop = frame(node);
    const pd = frame(parentDesktop || { x: 0, y: 0, width: BASE_WIDTH, height: 1 });
    const pt = frame(parentTarget || { x: 0, y: 0, width: targetWidth, height: 1 });
    const scale = Math.min(1, pt.width / Math.max(1, pd.width));
    const relX = (desktop.x - pd.x) / Math.max(1, pd.width);
    const relY = (desktop.y - pd.y) / Math.max(1, pd.height);
    let width = Math.max(node.type === 'image' ? 24 : 1, round(desktop.width * scale));
    let height = Math.max(1, round(desktop.height * scale));
    if (node.type === 'image' && desktop.width > 0) height = Math.max(1, round(width * desktop.height / desktop.width));
    width = Math.min(width, pt.width);
    return {
      x: round(clamp(pt.x + relX * pt.width, pt.x, pt.x + pt.width - width)),
      y: round(pt.y + clamp(relY, 0, 1) * Math.max(0, pt.height - height)),
      width,
      height,
    };
  }

  function layoutCarousel(node, device, target) {
    if (!node?.props?.carouselViewport && !node?.props?.brandsCarousel) return;
    const track = (node.children || []).find((child) => child?.props?.carousel || clean(child?.name).includes('faixa animada'));
    if (!track) return;
    const originals = (track.children || []).filter((child) => !child?.props?.duplicateForLoop);
    if (!originals.length) return;
    const columns = device === 'tablet' ? 4 : 2;
    const gap = device === 'tablet' ? 12 : 10;
    const cardWidth = Math.max(72, round((target.width - gap * (columns - 1)) / columns));
    const cardHeight = Math.max(72, round(target.height));
    const step = cardWidth + gap;
    const cycleWidth = step * originals.length;
    track.responsive ||= {};
    track.responsive[device] = { x: 0, y: 0, width: Math.max(target.width, cycleWidth * 2), height: cardHeight };
    const all = track.children || [];
    all.forEach((card, index) => {
      card.responsive ||= {};
      card.responsive[device] = { x: round(index * step), y: 0, width: cardWidth, height: cardHeight };
    });
  }

  function applyDevice(root, device, measured) {
    if (!measured) return false;
    const targetWidth = DEVICES[device];
    const { list, parents } = flatten(root);
    const rootMeasured = measured.get(clean(root.id));
    root.responsive ||= {};
    root.responsive[device] = {
      x: 0,
      y: 0,
      width: targetWidth,
      height: Math.max(device === 'mobile' ? 1200 : 900, Number(rootMeasured?.height || 0)),
    };

    for (const node of list) {
      if (node === root) continue;
      const parent = parents.get(node) || root;
      const baseline = measured.get(clean(node.id));
      if (!baseline) continue;
      const parentTarget = parent === root ? root.responsive[device] : measured.get(clean(parent.id)) || parent.responsive?.[device];
      const next = applyDesktopDelta(node, parent, baseline, parentTarget);
      if (parentTarget) {
        next.width = Math.min(next.width, Math.max(1, parentTarget.width));
        next.x = round(clamp(next.x, 0, Math.max(0, parentTarget.width - next.width)));
      }
      node.responsive ||= {};
      node.responsive[device] = next;
      layoutCarousel(node, device, next);
    }

    // Elementos livres adicionados pelo usuário não participam do fluxo CSS. Eles são
    // ancorados automaticamente à seção estrutural mais próxima para nunca ficarem fora da tela.
    for (const node of root.children || []) {
      if (measured.has(clean(node.id))) continue;
      const anchor = nearestTopLevelAnchor(root, node, measured);
      const anchorTarget = anchor ? measured.get(clean(anchor.id)) : root.responsive[device];
      const mapped = mapFreeFrame(node, anchor || root, anchorTarget, targetWidth);
      node.responsive ||= {};
      node.responsive[device] = mapped;
      const scaleChildren = (item, parentDesktop, parentResponsive) => {
        for (const child of item.children || []) {
          const mappedChild = mapFreeFrame(child, parentDesktop, parentResponsive, targetWidth);
          child.responsive ||= {};
          child.responsive[device] = { ...mappedChild, x: round(mappedChild.x - parentResponsive.x), y: round(mappedChild.y - parentResponsive.y) };
          scaleChildren(child, child, { ...mappedChild, x: 0, y: 0 });
        }
      };
      scaleChildren(node, node, mapped);
    }
    return true;
  }

  function signature(root) {
    const parts = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      parts.push([
        node.id, node.type, round(node.x), round(node.y), round(node.width), round(node.height),
        clean(node.props?.text), clean(node.props?.previewClassName), clean(node.styles?.fontSize),
        clean(node.styles?.fontWeight), clean(node.styles?.lineHeight), clean(node.styles?.padding), clean(node.styles?.gap),
      ].join(':'));
      for (const child of node.children || []) walk(child);
    };
    walk(root);
    let hash = 2166136261;
    const text = parts.join('|');
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function reflowRoot(root, force = false) {
    if (!root || root.type !== 'page' || !Array.isArray(root.children)) return false;
    const nextSignature = signature(root);
    if (!force && root.props?.autoResponsiveVersion === VERSION && root.props?.autoResponsiveSignature === nextSignature) return true;
    const tablet = measure('tablet', root);
    const mobile = measure('mobile', root);
    if (!tablet || !mobile) return false;
    managedFrames.set(root.id, { tablet, mobile });
    applyDevice(root, 'tablet', tablet);
    applyDevice(root, 'mobile', mobile);
    root.props ||= {};
    root.props.autoResponsive = true;
    root.props.autoResponsiveVersion = VERSION;
    root.props.autoResponsiveMode = 'css-reflow';
    root.props.autoResponsiveSignature = nextSignature;
    root.props.autoResponsiveWidths = { ...DEVICES };
    return true;
  }

  function rootsFrom(value, out = []) {
    if (!value || typeof value !== 'object') return out;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item?.type === 'page' && Array.isArray(item.children)) out.push(item);
        else rootsFrom(item, out);
      }
      return out;
    }
    if (value.type === 'page' && Array.isArray(value.children)) {
      out.push(value);
      return out;
    }
    for (const child of Object.values(value)) rootsFrom(child, out);
    return out;
  }

  function reflowNodes(nodes, force = false) {
    const roots = rootsFrom(nodes, []);
    let changed = false;
    for (const root of roots) changed = reflowRoot(root, force) || changed;
    return changed;
  }

  function responseWithJson(response, payload) {
    return new Proxy(response, {
      get(target, property) {
        if (property === 'json') return async () => payload;
        if (property === 'clone') return () => responseWithJson(target.clone(), payload);
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  function installFetchBridge() {
    if (window.__ASTERYON_AUTO_RESPONSIVE_FETCH_V95__) return;
    window.__ASTERYON_AUTO_RESPONSIVE_FETCH_V95__ = true;
    const previousFetch = window.fetch.bind(window);
    window.fetch = async (...rawArgs) => {
      let args = rawArgs;
      const init = args[1];
      if (init && typeof init.body === 'string' && /^[\[{]/.test(init.body.trim())) {
        try {
          const payload = JSON.parse(init.body);
          if (reflowNodes(payload, false)) args = [args[0], { ...init, body: JSON.stringify(payload) }];
        } catch { /* corpo não JSON: preservar */ }
      }
      const response = await previousFetch(...args);
      try {
        const input = args[0];
        const url = typeof input === 'string' ? input : input?.url || '';
        const method = clean(args[1]?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method !== 'GET' || !/\/api\/(?:admin|public)\/(?:pages|templates)/.test(String(url))) return response;
        const payload = await response.clone().json();
        if (!reflowNodes(payload, false)) return response;
        return responseWithJson(response, payload);
      } catch (error) {
        console.warn('ASTERYON AUTO RESPONSIVE: resposta original preservada.', error);
        return response;
      }
    };
  }

  window.addEventListener('asteryon:preview-final-copied-v91', () => {
    const state = window.__ASTERYON_V91_STATE__;
    if (Array.isArray(state?.capturedNodes)) {
      reflowNodes(state.capturedNodes, true);
      window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__ = state.capturedNodes;
    }
  });

  installFetchBridge();
  window.AsteryonResponsiveAuto = Object.freeze({
    version: VERSION,
    devices: { ...DEVICES },
    reflowNodes,
    reflowRoot,
    invalidateCss: () => { cssCache = ''; },
  });
})();
