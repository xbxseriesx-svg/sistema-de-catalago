(() => {
  'use strict';

  const PAGE_SLUG = 'home';
  const PUBLICATION_ENDPOINT = `/api/public/pages/${PAGE_SLUG}`;
  const MAX_TEXT_LENGTH = 12000;

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

  const finite = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const safeHttpUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.origin);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return url.href;
    } catch {
      return '';
    }
  };

  const safeHref = (value, fallback = '#') => {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    if (raw.startsWith('#') || raw.startsWith('/')) return raw;
    return safeHttpUrl(raw) || fallback;
  };

  const safeCss = (property, value) => {
    if (value === null || value === undefined || value === '') return '';
    const raw = String(value).trim();
    if (!raw || /expression\s*\(|javascript\s*:|url\s*\(/i.test(raw)) return '';
    try {
      return CSS.supports(property, raw) ? raw : '';
    } catch {
      return '';
    }
  };

  function flattenStoredDocument(value) {
    if (!value) return null;

    if (!Array.isArray(value) && typeof value === 'object' && value.rootId && value.nodes && typeof value.nodes === 'object') {
      const nodes = {};
      for (const [key, raw] of Object.entries(value.nodes)) {
        if (!raw || typeof raw !== 'object') continue;
        const id = String(raw.id || key || '').trim();
        if (!id) continue;
        nodes[id] = {
          ...raw,
          id,
          parentId: raw.parentId == null ? null : String(raw.parentId),
          children: Array.isArray(raw.children) ? raw.children.map((child) => String(child || '')).filter(Boolean) : [],
        };
      }
      return nodes[String(value.rootId)] ? { rootId: String(value.rootId), nodes } : null;
    }

    if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== 'object') return null;
    const nodes = {};

    const visit = (raw, parentId = null) => {
      if (!raw || typeof raw !== 'object') return '';
      const id = String(raw.id || '').trim();
      if (!id) return '';
      const rawChildren = Array.isArray(raw.children) ? raw.children : [];
      nodes[id] = {
        ...raw,
        id,
        parentId,
        children: rawChildren.map((child) => String(child?.id || '')).filter(Boolean),
      };
      rawChildren.forEach((child) => visit(child, id));
      return id;
    };

    const rootId = visit(value[0], null);
    return rootId ? { rootId, nodes } : null;
  }

  function descendants(doc, root) {
    if (!root) return [];
    const output = [];
    const queue = [root];
    const seen = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (!node || seen.has(node.id)) continue;
      seen.add(node.id);
      output.push(node);
      for (const childId of node.children || []) {
        const child = doc.nodes[childId];
        if (child) queue.push(child);
      }
    }
    return output;
  }

  const classNameOf = (node) => String(node?.props?.previewClassName || '').trim();
  const domTagOf = (node) => normalize(node?.props?.previewDomTag || String(node?.name || '').split('•')[0] || '');
  const textOf = (node) => String(node?.props?.text ?? node?.props?.label ?? node?.props?.title ?? '').trim();

  function semanticText(doc, node) {
    return descendants(doc, node)
      .map((item) => [item.name, classNameOf(item), textOf(item)].filter(Boolean).join(' '))
      .join(' ')
      .slice(0, MAX_TEXT_LENGTH);
  }

  function topLevelNodes(doc) {
    const root = doc.nodes[doc.rootId];
    if (!root) return [];
    return (root.children || [])
      .map((id) => doc.nodes[id])
      .filter(Boolean)
      .sort((a, b) => finite(a.y) - finite(b.y));
  }

  function findIn(doc, source, predicate) {
    return descendants(doc, source).find(predicate) || null;
  }

  function findAllIn(doc, source, predicate) {
    return descendants(doc, source).filter(predicate);
  }

  function findPreviewClass(doc, source, needle) {
    const key = normalize(needle);
    return findIn(doc, source, (node) => normalize(classNameOf(node)).split(/\s+/).includes(key));
  }

  function findTag(doc, source, tags) {
    const expected = new Set(tags.map(normalize));
    return findIn(doc, source, (node) => expected.has(domTagOf(node)) && Boolean(textOf(node)));
  }

  function longestBodyText(doc, source, excluded = new Set()) {
    return findAllIn(doc, source, (node) => {
      if (excluded.has(node?.id)) return false;
      const text = textOf(node);
      if (!text || text.length < 20) return false;
      const tag = domTagOf(node);
      return ['p', 'div', 'span', 'paragraph', 'text'].includes(tag) || node.type === 'paragraph' || node.type === 'text';
    }).sort((a, b) => textOf(b).length - textOf(a).length)[0] || null;
  }

  function sourceForKey(doc, key) {
    const tops = topLevelNodes(doc);
    if (key === 'header') return tops.find((node) => normalize(classNameOf(node)).includes('ltp-site-header')) || null;
    if (key === 'hero') return tops.find((node) => normalize(classNameOf(node)).split(/\s+/).includes('ltp-hero')) || null;
    if (key === 'footer') return tops.find((node) => normalize(classNameOf(node)).includes('ltp-footer')) || null;

    const scored = tops.map((node) => ({ node, hay: normalize(`${node.name || ''} ${semanticText(doc, node)}`) }));
    const needles = {
      segmentos: ['segmentos'],
      produtos: ['portfolio real', 'produtos do catalogo'],
      departamentos: ['organizacao do catalogo', 'departamentos'],
      marcas: ['industrias e parceiros', 'marcas do portfolio', 'marcas'],
      contato: ['relacionamento', 'atendimento comercial', 'quem somos'],
    }[key] || [];

    for (const needle of needles) {
      const match = scored.find((entry) => entry.hay.includes(needle));
      if (match) return match.node;
    }
    return null;
  }

  function applyVisibility(source, target) {
    if (!source || !target) return;
    if (source.visible === false) {
      target.hidden = true;
      target.dataset.editorHidden = 'true';
    } else if (target.dataset.editorHidden === 'true') {
      target.hidden = false;
      delete target.dataset.editorHidden;
    }
  }

  function applyBoxStyles(source, target) {
    if (!source || !target) return;
    const styles = source.styles && typeof source.styles === 'object' ? source.styles : {};
    const background = safeCss('background', styles.background || styles.backgroundColor);
    const color = safeCss('color', styles.color);
    const borderColor = safeCss('border-color', styles.borderColor);
    const border = safeCss('border', styles.border);
    const shadow = safeCss('box-shadow', styles.boxShadow);
    const radius = finite(styles.borderRadius ?? styles.radius, NaN);
    const opacity = finite(source.opacity, NaN);

    if (background) target.style.background = background;
    if (color) target.style.color = color;
    if (border) target.style.border = border;
    else if (borderColor) target.style.borderColor = borderColor;
    if (shadow) target.style.boxShadow = shadow;
    if (Number.isFinite(radius) && radius >= 0 && radius <= 64) target.style.borderRadius = `${radius / 16}rem`;
    if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) target.style.opacity = String(opacity);
    applyVisibility(source, target);
  }

  function applyTextStyles(source, target, role = 'body') {
    if (!source || !target) return;
    const styles = source.styles && typeof source.styles === 'object' ? source.styles : {};
    const color = safeCss('color', styles.color);
    const family = safeCss('font-family', styles.fontFamily);
    const weight = safeCss('font-weight', styles.fontWeight);
    const align = safeCss('text-align', styles.textAlign);
    const lineHeight = finite(styles.lineHeight, NaN);
    const letterSpacing = finite(styles.letterSpacing, NaN);
    const fontSize = finite(styles.fontSize, NaN);
    const caps = {
      hero: [30, 52],
      heading: [22, 36],
      eyebrow: [10, 15],
      button: [11, 18],
      body: [12, 19],
      nav: [10, 16],
    }[role] || [12, 19];

    if (color) target.style.color = color;
    if (family) target.style.fontFamily = family;
    if (weight) target.style.fontWeight = weight;
    if (align) target.style.textAlign = align;
    if (Number.isFinite(fontSize)) {
      const bounded = Math.min(caps[1], Math.max(caps[0], fontSize));
      target.style.fontSize = `${bounded / 16}rem`;
    }
    if (Number.isFinite(lineHeight) && lineHeight >= 0.8 && lineHeight <= 2.5) target.style.lineHeight = String(lineHeight);
    if (Number.isFinite(letterSpacing) && Math.abs(letterSpacing) <= 16) target.style.letterSpacing = `${letterSpacing / 16}rem`;
    applyVisibility(source, target);
  }

  function writeText(source, target, role = 'body') {
    if (!source || !target) return;
    const text = textOf(source);
    if (text) target.textContent = text;
    applyTextStyles(source, target, role);
  }

  function applyHeadingBlock(doc, source, target, headingSelector) {
    if (!source || !target) return;
    applyBoxStyles(source, target);
    const eyebrowSource = findPreviewClass(doc, source, 'ltp-eyebrow');
    const headingSource = findTag(doc, source, ['h1', 'h2', 'h3']) || findIn(doc, source, (node) => ['heading'].includes(String(node.type || '')) && Boolean(textOf(node)));
    const excluded = new Set([eyebrowSource?.id, headingSource?.id].filter(Boolean));
    const bodySource = longestBodyText(doc, source, excluded);

    const eyebrowTarget = target.querySelector('.eyebrow');
    const headingTarget = target.querySelector(headingSelector);
    const bodyTarget = target.querySelector('.section-heading > p, .hero-text, .contact-grid > div > p:not(.eyebrow)');

    writeText(eyebrowSource, eyebrowTarget, 'eyebrow');
    writeText(headingSource, headingTarget, headingSelector === 'h1' ? 'hero' : 'heading');
    writeText(bodySource, bodyTarget, 'body');
  }

  function applyHeader(doc, source) {
    const target = document.querySelector('.site-header');
    if (!source || !target) return;
    applyBoxStyles(source, target);

    const topLine = findPreviewClass(doc, source, 'ltp-topline');
    if (topLine) {
      const topStrip = target.querySelector('.top-strip');
      const color = safeCss('background', topLine?.styles?.background || topLine?.styles?.backgroundColor);
      if (topStrip && color) topStrip.style.background = color;
    }

    const logo = findIn(doc, source, (node) => node.type === 'image' && safeHttpUrl(node?.props?.src));
    const mark = target.querySelector('.brand-mark');
    if (logo && mark) {
      const src = safeHttpUrl(logo?.props?.src);
      if (src) {
        mark.textContent = '';
        const image = document.createElement('img');
        image.src = src;
        image.alt = String(logo.name || 'Logo');
        image.loading = 'eager';
        image.style.width = '100%';
        image.style.height = '100%';
        image.style.objectFit = 'contain';
        mark.append(image);
      }
    }

    const navSource = findPreviewClass(doc, source, 'ltp-navlinks');
    if (navSource) {
      const labels = findAllIn(doc, navSource, (node) => Boolean(textOf(node)) && (domTagOf(node) === 'span' || domTagOf(node) === 'a' || node.type === 'text'))
        .filter((node) => textOf(node).length <= 40)
        .slice(0, 6);
      const anchors = [...target.querySelectorAll('.main-nav a')];
      labels.forEach((node, index) => {
        const anchor = anchors[index];
        if (!anchor) return;
        writeText(node, anchor, 'nav');
        const action = normalize(node?.props?.actionType);
        if (action.includes('catalog')) anchor.href = '#produtos';
        else if (action.includes('department')) anchor.href = '#departamentos';
        else if (action.includes('brand')) anchor.href = '#marcas';
        else if (action.includes('contact') || action.includes('about')) anchor.href = '#contato';
        else if (normalize(textOf(node)).includes('inicio')) anchor.href = '#inicio';
      });
    }
  }

  function applyHero(doc, source) {
    const target = document.querySelector('.hero');
    if (!source || !target) return;
    applyHeadingBlock(doc, source, target, 'h1');

    const actionsSource = findPreviewClass(doc, source, 'ltp-hero-actions');
    if (actionsSource) {
      const sourceButtons = findAllIn(doc, actionsSource, (node) => Boolean(textOf(node)) && (
        node.type === 'button' || ['a', 'button', 'span'].includes(domTagOf(node)) || Boolean(node?.props?.actionType)
      )).filter((node) => textOf(node).length <= 60).slice(0, 2);
      const targets = [...target.querySelectorAll('.hero-actions .button')];
      sourceButtons.forEach((node, index) => {
        const button = targets[index];
        if (!button) return;
        writeText(node, button, 'button');
        button.setAttribute('href', safeHref(node?.props?.href, index === 0 ? '#produtos' : '#contato'));
      });
    }

    const visual = findPreviewClass(doc, source, 'ltp-hero-visual') || source;
    const heroImage = findIn(doc, visual, (node) => node.type === 'image' && safeHttpUrl(node?.props?.src));
    const screen = target.querySelector('.summary-screen');
    if (heroImage && screen) {
      const src = safeHttpUrl(heroImage?.props?.src);
      if (src) {
        screen.style.backgroundImage = `linear-gradient(rgba(255,255,255,.86), rgba(255,255,255,.86)), url("${src.replaceAll('"', '%22')}")`;
        screen.style.backgroundRepeat = 'no-repeat';
        screen.style.backgroundPosition = 'center';
        screen.style.backgroundSize = 'contain';
      }
    }
  }

  function applyContact(doc, source) {
    const target = document.querySelector('#contato');
    if (!source || !target) return;
    applyHeadingBlock(doc, source, target, 'h2');
  }

  function applyFooter(doc, source) {
    const target = document.querySelector('.site-footer');
    if (!source || !target) return;
    applyBoxStyles(source, target);
    const texts = findAllIn(doc, source, (node) => Boolean(textOf(node)) && textOf(node).length <= 140).slice(0, 2);
    const spans = [...target.querySelectorAll('.footer-row > span')];
    if (texts[0] && spans[0]) writeText(texts[0], spans[0], 'body');
  }

  function styleDynamicCards(doc) {
    const rules = [
      ['product-card', '.product-card'],
      ['brand-card', '.brand-card'],
      ['department-card', '.department-card'],
      ['segment-card', '.segment-card'],
    ];
    for (const [needle, selector] of rules) {
      const source = Object.values(doc.nodes).find((node) => normalize(classNameOf(node)).includes(needle));
      if (!source) continue;
      document.querySelectorAll(selector).forEach((target) => applyBoxStyles(source, target));
    }
  }

  function reorderSemanticSections(doc) {
    const main = document.getElementById('conteudo');
    if (!main) return;
    const searchBand = main.querySelector('.search-band');
    const mappings = [
      ['hero', document.querySelector('.hero')],
      ['segmentos', document.querySelector('#segmentos')],
      ['produtos', document.querySelector('#produtos')],
      ['departamentos', document.querySelector('#departamentos')],
      ['marcas', document.querySelector('#marcas')],
      ['contato', document.querySelector('#contato')],
    ].map(([key, target]) => ({ key, target, source: sourceForKey(doc, key) }))
      .filter((entry) => entry.target && entry.source)
      .sort((a, b) => finite(a.source.y) - finite(b.source.y));

    if (searchBand) main.append(searchBand);
    mappings.forEach((entry) => main.append(entry.target));
  }

  function applyPublication(doc, page) {
    const sources = {
      header: sourceForKey(doc, 'header'),
      hero: sourceForKey(doc, 'hero'),
      segmentos: sourceForKey(doc, 'segmentos'),
      produtos: sourceForKey(doc, 'produtos'),
      departamentos: sourceForKey(doc, 'departamentos'),
      marcas: sourceForKey(doc, 'marcas'),
      contato: sourceForKey(doc, 'contato'),
      footer: sourceForKey(doc, 'footer'),
    };

    applyHeader(doc, sources.header);
    applyHero(doc, sources.hero);
    applyHeadingBlock(doc, sources.segmentos, document.querySelector('#segmentos'), 'h2');
    applyHeadingBlock(doc, sources.produtos, document.querySelector('#produtos'), 'h2');
    applyHeadingBlock(doc, sources.departamentos, document.querySelector('#departamentos'), 'h2');
    applyHeadingBlock(doc, sources.marcas, document.querySelector('#marcas'), 'h2');
    applyContact(doc, sources.contato);
    applyFooter(doc, sources.footer);
    reorderSemanticSections(doc);
    styleDynamicCards(doc);

    const revision = Number(page?.versionNumber ?? 0) || 0;
    document.documentElement.dataset.editorPublication = 'applied';
    document.documentElement.dataset.editorPublicationRevision = String(revision);
    document.documentElement.dataset.editorPublicationVersion = String(page?.versionId || '');
    document.dispatchEvent(new CustomEvent('asteryon:public-publication-applied', {
      detail: { slug: PAGE_SLUG, revision, versionId: page?.versionId || null },
    }));
  }

  let lastRevision = null;
  let loading = false;

  async function refreshPublication() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(PUBLICATION_ENDPOINT, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Publicação indisponível (${response.status})`);
      const payload = await response.json();
      const page = payload?.page;
      const revision = Number(page?.versionNumber ?? 0) || 0;
      if (lastRevision !== null && revision === lastRevision) return;
      const doc = flattenStoredDocument(page?.nodes);
      if (!doc) throw new Error('Documento publicado inválido');
      applyPublication(doc, page);
      lastRevision = revision;
    } catch (error) {
      console.warn('[Portal V97] publicação do editor não aplicada; mantendo layout público padrão.', error);
      document.documentElement.dataset.editorPublication = 'fallback';
    } finally {
      loading = false;
    }
  }

  const observeDynamicContent = () => {
    const targets = ['product-grid', 'brand-rail', 'department-grid', 'segment-grid']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!targets.length) return;
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.editorPublication !== 'applied') return;
      refreshPublication().catch(() => {});
    });
    targets.forEach((target) => observer.observe(target, { childList: true }));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeDynamicContent();
      refreshPublication();
    }, { once: true });
  } else {
    observeDynamicContent();
    refreshPublication();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshPublication();
  });
})();
