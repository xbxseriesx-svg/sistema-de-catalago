(() => {
  'use strict';

  const ENDPOINT = '/api/public/pages/home';
  const NATIVE_ID = /^n[a-z0-9]{5,}$/i;
  const TEXT_TYPES = new Set(['text', 'heading', 'paragraph', 'productName', 'productBrand', 'productPrice']);
  const BUTTON_TYPES = new Set(['button', 'productButton']);
  const IMAGE_TYPES = new Set(['image', 'productImage']);
  const CONTAINER_TYPES = new Set(['frame', 'container', 'row', 'column', 'section', 'group', 'product', 'showcase', 'smartShowcase', 'header', 'footer']);
  const SUPPORTED_TYPES = new Set([...TEXT_TYPES, ...BUTTON_TYPES, ...IMAGE_TYPES, ...CONTAINER_TYPES, 'search', 'menu', 'breadcrumb', 'hero', 'category', 'brand', 'distribution']);
  let loading = false;
  let revision = '';

  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const finite = (value, fallback = NaN) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const classNameOf = (node) => String(node?.props?.previewClassName || '').trim();
  const frameY = (node) => finite(node?.responsive?.desktop?.y, finite(node?.y, 0));
  const frameHeight = (node) => finite(node?.responsive?.desktop?.height, finite(node?.height, 0));

  const safeHttpUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };

  const editorCssValue = (value) => String(value ?? '')
    .replaceAll('var(--ed-ink)', 'var(--text)')
    .replaceAll('var(--ed-muted)', 'var(--muted)')
    .replaceAll('var(--ed-accent)', 'var(--blue)')
    .replaceAll('var(--ed-surface)', 'var(--surface)')
    .replaceAll('var(--ed-border)', 'var(--line)');

  const safeCss = (property, value) => {
    const raw = editorCssValue(value).trim();
    if (!raw || /expression\s*\(|javascript\s*:|url\s*\(/i.test(raw)) return '';
    try { return CSS.supports(property, raw) ? raw : ''; } catch { return ''; }
  };

  function flatten(value) {
    if (!value) return null;
    if (!Array.isArray(value) && typeof value === 'object' && value.rootId && value.nodes) {
      const nodes = {};
      Object.entries(value.nodes).forEach(([key, raw]) => {
        if (!raw || typeof raw !== 'object') return;
        const id = String(raw.id || key || '').trim();
        if (!id) return;
        nodes[id] = { ...raw, id, parentId: raw.parentId == null ? null : String(raw.parentId), children: Array.isArray(raw.children) ? raw.children.map(String) : [] };
      });
      return nodes[String(value.rootId)] ? { rootId: String(value.rootId), nodes } : null;
    }
    if (!Array.isArray(value) || value.length !== 1 || !value[0]) return null;
    const nodes = {};
    const visit = (raw, parentId = null) => {
      if (!raw || typeof raw !== 'object') return '';
      const id = String(raw.id || '').trim();
      if (!id) return '';
      const children = Array.isArray(raw.children) ? raw.children : [];
      nodes[id] = { ...raw, id, parentId, children: children.map((child) => String(child?.id || '')).filter(Boolean) };
      children.forEach((child) => visit(child, id));
      return id;
    };
    const rootId = visit(value[0]);
    return rootId ? { rootId, nodes } : null;
  }

  const isNative = (node) => Boolean(node && NATIVE_ID.test(String(node.id || '')) && SUPPORTED_TYPES.has(String(node.type || '')));

  function topAncestor(doc, node) {
    let current = node;
    let parent = current?.parentId ? doc.nodes[current.parentId] : null;
    while (parent && parent.id !== doc.rootId) {
      current = parent;
      parent = current?.parentId ? doc.nodes[current.parentId] : null;
    }
    return current;
  }

  function placementSource(doc, node) {
    const top = topAncestor(doc, node);
    if (!isNative(top)) return top;
    const root = doc.nodes[doc.rootId];
    const historical = (root?.children || []).map((id) => doc.nodes[id]).filter((candidate) => candidate && !isNative(candidate));
    if (!historical.length) return top;
    const y = frameY(top);
    const containing = historical.find((candidate) => y >= frameY(candidate) && y <= frameY(candidate) + Math.max(1, frameHeight(candidate)));
    if (containing) return containing;
    return historical.sort((a, b) => Math.abs(frameY(a) - y) - Math.abs(frameY(b) - y))[0] || top;
  }

  function portalTarget(doc, node) {
    const source = placementSource(doc, node);
    const cls = normalize(classNameOf(source));
    const hay = normalize(`${source?.name || ''} ${cls}`);
    if (cls.includes('ltp-site-header') || source?.type === 'header') return document.querySelector('.site-header');
    if (cls.split(/\s+/).includes('ltp-hero') || source?.type === 'hero') return document.querySelector('.hero');
    if (hay.includes('segment')) return document.getElementById('segmentos');
    if (hay.includes('organizacao') || hay.includes('departamento')) return document.getElementById('departamentos');
    if (hay.includes('industr') || hay.includes('marca')) return document.getElementById('marcas');
    if (hay.includes('relacionamento') || hay.includes('contato') || hay.includes('quem somos')) return document.getElementById('contato');
    if (cls.includes('ltp-footer') || hay.includes('footer') || hay.includes('rodape') || source?.type === 'footer') return document.querySelector('.site-footer');
    return document.getElementById('produtos');
  }

  function currentDevice() {
    if (window.matchMedia('(max-width: 47.9375rem)').matches) return 'mobile';
    if (window.matchMedia('(max-width: 74.9375rem)').matches) return 'tablet';
    return 'desktop';
  }

  function applyBox(node, element) {
    const styles = node?.styles || {};
    const background = safeCss('background', styles.background || styles.backgroundColor);
    const color = safeCss('color', styles.color);
    const shadow = safeCss('box-shadow', styles.shadow || styles.boxShadow);
    const borderColor = safeCss('border-color', styles.borderColor);
    const radius = finite(styles.radius ?? styles.borderRadius);
    const borderWidth = finite(styles.borderWidth);
    const opacity = finite(node?.opacity);
    const rotation = finite(node?.rotation);
    if (background) element.style.background = background;
    if (color) element.style.color = color;
    if (shadow) element.style.boxShadow = shadow;
    if (borderColor) element.style.borderColor = borderColor;
    if (Number.isFinite(radius) && radius >= 0 && radius <= 128) element.style.borderRadius = `${radius / 16}rem`;
    if (Number.isFinite(borderWidth) && borderWidth >= 0 && borderWidth <= 24) { element.style.borderWidth = `${borderWidth}px`; element.style.borderStyle = 'solid'; }
    if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) element.style.opacity = String(opacity);
    if (Number.isFinite(rotation) && rotation && Math.abs(rotation) <= 360) element.style.transform = `rotate(${rotation}deg)`;
  }

  function applyText(node, element) {
    const styles = node?.styles || {};
    const color = safeCss('color', styles.color);
    const weight = safeCss('font-weight', styles.fontWeight);
    const align = safeCss('text-align', styles.textAlign);
    const family = safeCss('font-family', styles.fontFamily);
    const shadow = safeCss('text-shadow', styles.textShadow);
    const fontSize = finite(styles.fontSize);
    const lineHeight = finite(styles.lineHeight);
    const letterSpacing = finite(styles.letterSpacing);
    if (color) element.style.color = color;
    if (weight) element.style.fontWeight = weight;
    if (align) element.style.textAlign = align;
    if (family) element.style.fontFamily = family;
    if (shadow) element.style.textShadow = shadow;
    if (Number.isFinite(fontSize)) element.style.fontSize = `${Math.max(10, Math.min(64, fontSize)) / 16}rem`;
    if (Number.isFinite(lineHeight) && lineHeight >= 0.8 && lineHeight <= 2.5) element.style.lineHeight = String(lineHeight);
    if (Number.isFinite(letterSpacing) && Math.abs(letterSpacing) <= 16) element.style.letterSpacing = `${letterSpacing / 16}rem`;
  }

  function applyTopWidth(node, element) {
    const frame = node?.responsive?.[currentDevice()] || node || {};
    const width = finite(frame.width);
    if (!Number.isFinite(width) || width <= 0) return;
    element.style.width = '100%';
    element.style.maxWidth = `${Math.max(80, Math.min(1360, width))}px`;
  }

  function popupAction(href, label) {
    const raw = String(href || '').trim();
    if (!raw) return;
    window.dispatchEvent(new CustomEvent('asteryon:open-public-popup', { detail: { href: raw, title: label, label } }));
  }

  function actionHref(node) {
    const href = String(node?.props?.href || '').trim();
    if (href) return href;
    const action = normalize(node?.props?.actionType);
    if (action.includes('segment')) return '#segmentos';
    if (action.includes('catalog') || action.includes('product')) return '#produtos';
    if (action.includes('department')) return '#departamentos';
    if (action.includes('brand')) return '#marcas';
    if (action.includes('contact') || action.includes('about')) return '#contato';
    if (action.includes('home') || action.includes('inicio')) return '#inicio';
    return '';
  }

  function renderText(node) {
    const tag = node.type === 'heading' ? 'h3' : node.type === 'paragraph' ? 'p' : 'div';
    const element = document.createElement(tag);
    element.className = `editor-native-text editor-native-${node.type}`;
    element.textContent = String(node?.props?.text || '');
    applyText(node, element);
    return element;
  }

  function renderButton(node) {
    const button = document.createElement('button');
    const label = String(node?.props?.label || node?.name || 'Botão').trim() || 'Botão';
    button.type = 'button';
    button.className = 'button editor-native-button';
    button.textContent = label;
    applyText(node, button);
    applyBox(node, button);
    const href = actionHref(node);
    if (href) button.addEventListener('click', () => popupAction(href, label));
    else button.dataset.editorNativePassive = 'true';
    return button;
  }

  function renderImage(node) {
    const host = document.createElement('div');
    host.className = 'editor-native-image';
    const src = safeHttpUrl(node?.props?.src);
    if (!src) { host.classList.add('editor-native-placeholder'); host.textContent = String(node?.name || 'Imagem'); return host; }
    const image = document.createElement('img');
    image.src = src;
    image.alt = String(node?.name || 'Imagem publicada');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.style.objectFit = String(node?.props?.fit) === 'cover' ? 'cover' : 'contain';
    host.append(image);
    return host;
  }

  function renderSearch(node) {
    const form = document.createElement('form');
    form.className = 'editor-native-search';
    form.setAttribute('role', 'search');
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = String(node?.props?.placeholder || 'Buscar produtos…');
    input.setAttribute('aria-label', 'Buscar produtos no catálogo');
    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'button button-primary';
    button.textContent = 'Buscar';
    form.append(input, button);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const mainSearch = document.getElementById('catalog-search');
      const mainButton = document.getElementById('search-button');
      if (mainSearch instanceof HTMLInputElement) mainSearch.value = input.value;
      if (mainButton instanceof HTMLButtonElement) mainButton.click();
    });
    return form;
  }

  function renderMenu() {
    const nav = document.createElement('nav');
    nav.className = 'editor-native-menu';
    nav.setAttribute('aria-label', 'Menu publicado pelo editor');
    [['Início','#inicio'],['Segmentos','#segmentos'],['Departamentos','#departamentos'],['Marcas','#marcas'],['Produtos','#produtos'],['Contato','#contato']].forEach(([label, href]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => popupAction(href, label));
      nav.append(button);
    });
    return nav;
  }

  function renderBreadcrumb() {
    const nav = document.createElement('nav');
    nav.className = 'editor-native-breadcrumb';
    nav.setAttribute('aria-label', 'Breadcrumb publicado pelo editor');
    [['Catálogo','#inicio'],['Produtos','#produtos']].forEach(([label, href], index) => {
      if (index) { const separator = document.createElement('span'); separator.textContent = '/'; nav.append(separator); }
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => popupAction(href, label));
      nav.append(button);
    });
    return nav;
  }

  function renderHero(node) {
    const hero = document.createElement('div');
    hero.className = 'editor-native-hero';
    const src = safeHttpUrl(node?.props?.src);
    if (src) { const image = document.createElement('img'); image.src = src; image.alt = String(node?.props?.title || 'Hero'); image.style.objectFit = String(node?.props?.fit) === 'cover' ? 'cover' : 'contain'; hero.append(image); }
    const copy = document.createElement('div');
    copy.className = 'editor-native-hero-copy';
    const title = document.createElement('strong');
    title.textContent = String(node?.props?.title || node?.name || 'Hero');
    copy.append(title);
    const subtitle = String(node?.props?.subtitle || '').trim();
    if (subtitle) { const p = document.createElement('p'); p.textContent = subtitle; copy.append(p); }
    hero.append(copy);
    return hero;
  }

  function renderNode(doc, node, topLevel = false) {
    if (!isNative(node) || node.visible === false) return null;
    let element = null;
    if (TEXT_TYPES.has(node.type)) element = renderText(node);
    else if (BUTTON_TYPES.has(node.type)) element = renderButton(node);
    else if (IMAGE_TYPES.has(node.type)) element = renderImage(node);
    else if (node.type === 'search') element = renderSearch(node);
    else if (node.type === 'menu') element = renderMenu();
    else if (node.type === 'breadcrumb') element = renderBreadcrumb();
    else if (node.type === 'hero') element = renderHero(node);
    else if (['category','brand','distribution'].includes(node.type)) { element = document.createElement('div'); element.className = `editor-native-placeholder editor-native-${node.type}`; element.textContent = String(node.name || node.type); }
    else if (CONTAINER_TYPES.has(node.type)) { element = document.createElement('div'); element.className = `editor-native-container editor-native-${node.type}`; }
    if (!(element instanceof HTMLElement)) return null;

    element.dataset.editorNativeElement = String(node.id);
    element.dataset.editorNativeType = String(node.type);
    applyBox(node, element);
    if (topLevel) applyTopWidth(node, element);

    if (CONTAINER_TYPES.has(node.type) || node.type === 'hero') {
      const childHost = node.type === 'hero' ? document.createElement('div') : element;
      if (node.type === 'hero') { childHost.className = 'editor-native-children'; element.append(childHost); }
      (node.children || []).map((id) => doc.nodes[id]).filter((child) => isNative(child) && child.visible !== false).sort((a,b) => frameY(a) - frameY(b) || finite(a?.x,0) - finite(b?.x,0)).forEach((child) => {
        const rendered = renderNode(doc, child, false);
        if (rendered) childHost.append(rendered);
      });
    }
    return element;
  }

  function clear() {
    document.querySelectorAll('[data-editor-native-node]').forEach((node) => node.remove());
  }

  function render(doc) {
    clear();
    const nodes = Object.values(doc.nodes)
      .filter((node) => isNative(node) && node.visible !== false)
      .filter((node) => !isNative(node?.parentId ? doc.nodes[node.parentId] : null))
      .sort((a,b) => frameY(a) - frameY(b) || finite(a?.x,0) - finite(b?.x,0));
    let count = 0;
    nodes.forEach((node) => {
      const target = portalTarget(doc, node);
      if (!(target instanceof HTMLElement)) return;
      const rendered = renderNode(doc, node, true);
      if (!(rendered instanceof HTMLElement)) return;
      const slot = document.createElement('div');
      slot.className = 'editor-native-slot';
      slot.dataset.editorNativeNode = String(node.id);
      slot.append(rendered);
      (target.querySelector('.container') || target).append(slot);
      count += 1;
    });
    document.documentElement.dataset.editorNativeCount = String(count);
  }

  async function sync({ force = false } = {}) {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const page = payload?.page || payload || {};
      const nextRevision = String(page.versionNumber ?? page.publishedRevision ?? page.versionId ?? page.publishedAt ?? '');
      if (!force && nextRevision && nextRevision === revision) return;
      const doc = flatten(page.nodes || page.publishedNodes || page.published_nodes);
      if (!doc) throw new Error('Documento publicado inválido');
      render(doc);
      revision = nextRevision || String(Date.now());
      document.documentElement.dataset.editorNativePublication = 'applied';
      document.documentElement.dataset.editorNativeRevision = revision;
    } catch (error) {
      document.documentElement.dataset.editorNativePublication = 'unavailable';
      console.warn('[ASTERYON] Elementos nativos publicados indisponíveis.', error);
    } finally { loading = false; }
  }

  window.addEventListener('pageshow', () => sync({ force: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync({ force: true }); });
  window.addEventListener('pagehide', clear);
  sync({ force: true });
})();