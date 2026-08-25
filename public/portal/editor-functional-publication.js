(() => {
  'use strict';

  const ENDPOINT = '/api/public/pages/home';
  const FUNCTIONAL_TYPES = new Set(['gallery', 'video', 'banner', 'carousel', 'promotion', 'html', 'embed']);
  const timers = new Set();
  let lastRevision = null;
  let loading = false;

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

  const safeHttpUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };

  const safeCss = (property, value) => {
    if (value == null || value === '') return '';
    const raw = String(value).trim();
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
        nodes[id] = {
          ...raw,
          id,
          parentId: raw.parentId == null ? null : String(raw.parentId),
          children: Array.isArray(raw.children) ? raw.children.map(String) : [],
        };
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

  function publicationDocument(payload) {
    const page = payload?.page || payload;
    return flatten(page?.nodes || page?.publishedNodes || page?.published_nodes || null);
  }

  function publicationRevision(payload) {
    const page = payload?.page || payload || {};
    return String(page.versionNumber ?? page.publishedRevision ?? page.published_revision ?? page.versionId ?? page.publishedAt ?? '');
  }

  function topAncestor(doc, node) {
    let current = node;
    let parent = current?.parentId ? doc.nodes[current.parentId] : null;
    while (parent && parent.id !== doc.rootId) {
      current = parent;
      parent = current?.parentId ? doc.nodes[current.parentId] : null;
    }
    return current;
  }

  function portalTargetFor(doc, node) {
    const top = topAncestor(doc, node);
    const cls = normalize(top?.props?.previewClassName || '');
    const hay = normalize(`${top?.name || ''} ${cls}`);
    if (cls.includes('ltp-site-header')) return document.querySelector('.site-header');
    if (cls.split(/\s+/).includes('ltp-hero')) return document.querySelector('.hero');
    if (hay.includes('segment')) return document.getElementById('segmentos');
    if (hay.includes('portfolio') || hay.includes('produto')) return document.getElementById('produtos');
    if (hay.includes('organizacao') || hay.includes('departamento')) return document.getElementById('departamentos');
    if (hay.includes('industr') || hay.includes('marca')) return document.getElementById('marcas');
    if (hay.includes('relacionamento') || hay.includes('contato') || hay.includes('quem somos')) return document.getElementById('contato');
    if (cls.includes('ltp-footer') || hay.includes('footer') || hay.includes('rodape')) return document.querySelector('.site-footer');
    return document.getElementById('produtos');
  }

  function clearRendered() {
    timers.forEach((timer) => window.clearInterval(timer));
    timers.clear();
    document.querySelectorAll('[data-editor-functional-node]').forEach((node) => node.remove());
  }

  function applyNodeBox(node, element) {
    const styles = node?.styles && typeof node.styles === 'object' ? node.styles : {};
    const background = safeCss('background', styles.background || styles.backgroundColor);
    const color = safeCss('color', styles.color);
    const shadow = safeCss('box-shadow', styles.boxShadow || styles.shadow);
    const radius = Number(styles.radius ?? styles.borderRadius);
    const opacity = Number(node.opacity);
    if (background) element.style.background = background;
    if (color) element.style.color = color;
    if (shadow) element.style.boxShadow = shadow;
    if (Number.isFinite(radius) && radius >= 0 && radius <= 64) element.style.borderRadius = `${radius / 16}rem`;
    if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) element.style.opacity = String(opacity);
  }

  function actionButton(node, fallbackLabel = 'Abrir') {
    const href = String(node?.props?.href || '').trim();
    const label = String(node?.props?.label || fallbackLabel).trim() || fallbackLabel;
    if (!href) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-primary editor-functional-action';
    button.textContent = label;
    button.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('asteryon:open-public-popup', { detail: { href, title: label, label } }));
    });
    return button;
  }

  function imageElement(src, fit = 'contain', alt = '') {
    const image = document.createElement('img');
    image.src = src;
    image.alt = alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.style.objectFit = fit === 'cover' ? 'cover' : 'contain';
    return image;
  }

  function renderVideo(node, host) {
    const src = safeHttpUrl(node?.props?.src);
    if (!src) return false;
    const video = document.createElement('video');
    video.className = 'editor-functional-video';
    video.src = src;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.objectFit = String(node?.props?.fit) === 'cover' ? 'cover' : 'contain';
    host.append(video);
    return true;
  }

  function renderBanner(node, host) {
    const src = safeHttpUrl(node?.props?.src);
    const title = String(node?.props?.title || node?.name || '').trim();
    const banner = document.createElement('div');
    banner.className = 'editor-functional-banner';
    if (src) banner.append(imageElement(src, String(node?.props?.fit || 'contain'), title));
    if (title) {
      const heading = document.createElement('strong');
      heading.textContent = title;
      banner.append(heading);
    }
    const action = actionButton(node, 'Saiba mais');
    if (action) banner.append(action);
    host.append(banner);
    return Boolean(src || title || action);
  }

  function renderCarousel(node, host) {
    const images = (Array.isArray(node?.props?.images) ? node.props.images : [])
      .map(safeHttpUrl)
      .filter(Boolean);
    if (!images.length) return false;
    const carousel = document.createElement('div');
    carousel.className = 'editor-functional-carousel';
    const stage = document.createElement('div');
    stage.className = 'editor-functional-carousel-stage';
    let index = 0;
    const image = imageElement(images[0], String(node?.props?.fit || 'contain'), 'Slide 1');
    stage.append(image);
    const controls = document.createElement('div');
    controls.className = 'editor-functional-carousel-controls';
    const previous = document.createElement('button');
    const next = document.createElement('button');
    previous.type = next.type = 'button';
    previous.textContent = '‹';
    next.textContent = '›';
    const show = (nextIndex) => {
      index = (nextIndex + images.length) % images.length;
      image.src = images[index];
      image.alt = `Slide ${index + 1}`;
      carousel.dataset.slide = String(index + 1);
    };
    previous.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    controls.append(previous, next);
    carousel.append(stage, controls);
    host.append(carousel);
    if (images.length > 1) {
      const interval = Math.max(2000, Math.min(30000, Number(node?.props?.interval) || 5000));
      const timer = window.setInterval(() => show(index + 1), interval);
      timers.add(timer);
    }
    return true;
  }

  function renderGallery(node, host) {
    const raw = Array.isArray(node?.props?.images) ? node.props.images : Array.isArray(node?.props?.srcs) ? node.props.srcs : [];
    const images = raw.map(safeHttpUrl).filter(Boolean);
    if (!images.length) return false;
    const gallery = document.createElement('div');
    gallery.className = 'editor-functional-gallery';
    images.forEach((src, index) => gallery.append(imageElement(src, String(node?.props?.fit || 'contain'), `Imagem ${index + 1}`)));
    host.append(gallery);
    return true;
  }

  function renderPromotion(node, host) {
    const card = document.createElement('div');
    card.className = 'editor-functional-promotion';
    const title = document.createElement('strong');
    title.textContent = String(node?.props?.title || node?.name || 'Promoção');
    card.append(title);
    const text = String(node?.props?.text || node?.props?.description || '').trim();
    if (text) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      card.append(paragraph);
    }
    const action = actionButton(node, String(node?.props?.label || 'Ver promoção'));
    if (action) card.append(action);
    host.append(card);
    return true;
  }

  function sanitizeHtml(raw) {
    const template = document.createElement('template');
    template.innerHTML = String(raw || '');
    template.content.querySelectorAll('script,style,iframe,object,embed,form,meta,link,base').forEach((node) => node.remove());
    template.content.querySelectorAll('*').forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        if (name.startsWith('on') || name === 'srcdoc') element.removeAttribute(attribute.name);
        if ((name === 'href' || name === 'src') && value && !value.startsWith('#') && !safeHttpUrl(value)) element.removeAttribute(attribute.name);
      });
    });
    return template.content;
  }

  function renderHtml(node, host) {
    const html = String(node?.props?.html || node?.props?.content || '').trim();
    if (!html) return false;
    const wrapper = document.createElement('div');
    wrapper.className = 'editor-functional-html';
    wrapper.append(sanitizeHtml(html));
    host.append(wrapper);
    return true;
  }

  function renderEmbed(node, host) {
    const src = safeHttpUrl(node?.props?.src || node?.props?.url);
    if (!src) return false;
    const frame = document.createElement('iframe');
    frame.className = 'editor-functional-embed';
    frame.src = src;
    frame.title = String(node?.props?.title || node?.name || 'Conteúdo incorporado');
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
    frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    host.append(frame);
    return true;
  }

  function renderFunctionalNode(doc, node) {
    if (!node || node.visible === false || !FUNCTIONAL_TYPES.has(String(node.type))) return;
    const target = portalTargetFor(doc, node);
    if (!(target instanceof HTMLElement)) return;
    const container = target.querySelector('.container') || target;
    const host = document.createElement('div');
    host.className = `editor-functional-slot editor-functional-${String(node.type)}`;
    host.dataset.editorFunctionalNode = String(node.id);
    applyNodeBox(node, host);

    let rendered = false;
    if (node.type === 'video') rendered = renderVideo(node, host);
    else if (node.type === 'banner') rendered = renderBanner(node, host);
    else if (node.type === 'carousel') rendered = renderCarousel(node, host);
    else if (node.type === 'gallery') rendered = renderGallery(node, host);
    else if (node.type === 'promotion') rendered = renderPromotion(node, host);
    else if (node.type === 'html') rendered = renderHtml(node, host);
    else if (node.type === 'embed') rendered = renderEmbed(node, host);

    if (rendered) container.append(host);
  }

  function applyRootStyles(doc) {
    const root = doc.nodes[doc.rootId];
    const background = safeCss('background', root?.styles?.background || root?.styles?.backgroundColor);
    if (background) document.body.style.background = background;
  }

  async function sync({ force = false } = {}) {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const revision = publicationRevision(payload);
      if (!force && revision && revision === lastRevision) return;
      const doc = publicationDocument(payload);
      if (!doc) throw new Error('Documento publicado inválido');
      clearRendered();
      applyRootStyles(doc);
      Object.values(doc.nodes).forEach((node) => renderFunctionalNode(doc, node));
      lastRevision = revision || String(Date.now());
      document.documentElement.dataset.editorFunctionalPublication = 'applied';
      document.documentElement.dataset.editorFunctionalRevision = lastRevision;
    } catch (error) {
      document.documentElement.dataset.editorFunctionalPublication = 'unavailable';
      console.warn('[ASTERYON] Componentes funcionais publicados indisponíveis.', error);
    } finally {
      loading = false;
    }
  }

  window.addEventListener('pageshow', () => sync({ force: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync({ force: true });
  });
  window.addEventListener('pagehide', clearRendered);
  sync({ force: true });
})();