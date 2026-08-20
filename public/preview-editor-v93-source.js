(() => {
  'use strict';
  const ASTER_V93_FILLED_PREVIEW_SOURCE=true;
  const ASTER_V94_TEMPLATE_OBSERVER_PERFORMANCE=true;

  if (window.__ASTERYON_PREVIEW_EDITOR_V93_SOURCE__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V93_SOURCE__ = true;

  const S = window.__ASTERYON_V91_STATE__;
  if (!S) return;

  const PREVIEW_ID = 'laurencini-template-preview-v69';
  const REPORT_KEY = 'asteryon_preview_editor_parity_v91';
  const NODES_KEY = 'asteryon_preview_editor_nodes_v91';
  const CURRENT_TEMPLATES = new Set([
    'varejo continuo','atacado b2b','distribuidora institucional','catalogo de marcas b2b',
    'distribuidora uniao • figma b2b','catalogo hierarquico b2b','vitrine atacado pro','modelo oficial',
  ]);

  const clean = S.clean;
  const normalize = S.normalize;
  const round = S.round;
  const px = S.px;
  let templateFrame = 0;

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.matches('[aria-hidden="true"],[data-asteryon-carousel-copy="v90"]')) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > .5 && rect.height > .5;
  }

  function textCandidate(element) {
    const tag = element.tagName;
    if (['SCRIPT','STYLE','SVG','PATH','IMG','INPUT','TEXTAREA','SELECT','OPTION'].includes(tag)) return false;
    const text = clean(element.textContent);
    if (!text) return false;
    if (['H1','H2','H3','H4','H5','H6','P','SPAN','STRONG','SMALL','LABEL','LI','A','BUTTON'].includes(tag)) {
      return !element.querySelector('img,input,textarea,select');
    }
    return tag === 'DIV' && element.childElementCount === 0;
  }

  function relativeBox(rect, parentRect, scale) {
    const x = round((rect.left - parentRect.left) * scale);
    const y = round((rect.top - parentRect.top) * scale);
    const width = Math.max(1, round(rect.width * scale));
    const height = Math.max(1, round(rect.height * scale));
    return { x, y, width, height, responsive: S.responsive(x, y, width, height) };
  }

  function absoluteBox(rect, shellRect, scale) {
    const x = round((rect.left - shellRect.left) * scale);
    const y = round((rect.top - shellRect.top) * scale);
    const width = Math.max(1, round(rect.width * scale));
    const height = Math.max(1, round(rect.height * scale));
    return { x, y, width, height };
  }

  function stylesFrom(element, computed = getComputedStyle(element)) {
    const styles = { ...S.stylesFrom(element, computed) };
    const fontSize = Math.max(1, px(computed.fontSize, Number(styles.fontSize) || 14));
    const linePx = computed.lineHeight === 'normal' ? fontSize * 1.25 : px(computed.lineHeight, fontSize * 1.25);
    styles.fontSize = fontSize;
    styles.lineHeight = round(Math.min(3, Math.max(.72, linePx / fontSize)));
    if (computed.overflow && computed.overflow !== 'visible') styles.overflow = computed.overflow;
    if (computed.textTransform && computed.textTransform !== 'none') styles.textTransform = computed.textTransform;
    if (computed.whiteSpace && computed.whiteSpace !== 'normal') styles.whiteSpace = computed.whiteSpace;
    return styles;
  }

  function node(type, name, box, sourceRect, props = {}, styles = {}, zIndex = 1) {
    return {
      id: S.nextId(name), name, type,
      x: box.x, y: box.y, width: box.width, height: box.height,
      responsive: box.responsive,
      locked: false, visible: true, opacity: 1, rotation: 0, zIndex,
      props: S.editableProps({
        templateCurrentVersion: 'V93',
        sourceOfTruth: 'preview-final-filled-v93',
        previewSourceRect: sourceRect,
        ...props,
      }),
      styles: { ...styles },
      children: [],
    };
  }

  function cloneLoop(item, shiftX, suffix = 'loop') {
    const copy = structuredClone(item);
    function renew(current, root = false) {
      current.id = S.nextId(`${current.name || current.type} ${suffix}`);
      current.name = `${current.name || current.type} • ${suffix}`;
      current.props = { ...(current.props || {}), duplicateForLoop: true };
      if (root) current.x = round(Number(current.x || 0) + shiftX);
      (current.children || []).forEach(child => renew(child, false));
    }
    renew(copy, true);
    return copy;
  }

  function elementLabel(element) {
    const cls = clean(element.className).split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
    const text = clean(element.textContent).replace(/\s+/g, ' ').slice(0, 48);
    return `${cls || element.tagName.toLowerCase()}${text ? ` • ${text}` : ''}`;
  }

  function productProps(element) {
    if (!element.classList.contains('ltp-product')) return {};
    return {
      catalogEntity: 'product',
      productId: clean(element.dataset.ltpProductId),
      previewProductCard: true,
    };
  }

  function brandProps(element) {
    if (!element.classList.contains('ltp-brand')) return {};
    const image = element.querySelector('img');
    const strong = element.querySelector('strong');
    return {
      catalogEntity: 'brand',
      previewBrandCard: true,
      brandName: clean(image?.alt || strong?.textContent || element.textContent),
    };
  }

  function captureBrandCarousel(grid, parentRect, shellRect, scale, zIndex, captureElement) {
    const gridRect = grid.getBoundingClientRect();
    const viewportBox = relativeBox(gridRect, parentRect, scale);
    const sourceRect = absoluteBox(gridRect, shellRect, scale);
    const viewport = node('group', 'Marcas • carrossel preenchido V93', viewportBox, sourceRect, {
      brandsCarousel: true, carouselViewport: true, carouselAnimated: true, carouselLoop: true,
      carouselPauseOnHover: true, addRemoveBrands: true, reorderBrands: true, catalogEntity: 'brand',
      atomicTemplate: false,
    }, { ...stylesFrom(grid), overflow: 'hidden' }, zIndex);
    viewport.id = `asteryon-brands-carousel-viewport-v91-${S.nextId('viewport-v93')}`;

    const cards = [...grid.children].filter(item => item instanceof HTMLElement && visible(item) && !item.matches('[aria-hidden="true"],[data-asteryon-carousel-copy="v90"]'));
    const cardNodes = cards.map((card, index) => captureElement(card, gridRect, shellRect, scale, index + 1)).filter(Boolean);
    const cycleWidth = Math.max(viewportBox.width, ...cardNodes.map(card => Number(card.x || 0) + Number(card.width || 0)));
    const track = node('group', 'Marcas • faixa animada preenchida V93', {
      x: 0, y: 0, width: cycleWidth * 2, height: viewportBox.height,
      responsive: S.responsive(0, 0, cycleWidth * 2, viewportBox.height),
    }, sourceRect, {
      carousel: true, carouselAnimated: true, carouselLoop: true, carouselPauseOnHover: true,
      carouselDirection: 'left', carouselDurationSeconds: 24, catalogEntity: 'brand', atomicTemplate: false,
    }, { backgroundColor: 'transparent' }, 1);
    track.id = `asteryon-brands-carousel-track-v91-${S.nextId('track-v93')}`;
    track.children = [...cardNodes, ...cardNodes.map(card => cloneLoop(card, cycleWidth))];
    viewport.children = [track];
    return viewport;
  }

  function capture() {
    const modal = document.getElementById(PREVIEW_ID);
    const shell = modal?.querySelector('.ltp-shell');
    if (!(shell instanceof HTMLElement)) throw new Error('Preview preenchido V93 não está disponível.');
    const shellRect = shell.getBoundingClientRect();
    if (shellRect.width < 100 || shellRect.height < 100) throw new Error('Preview preenchido V93 sem geometria válida.');

    const modelName = clean(shell.dataset.ltpTemplate || modal.querySelector('.ltp-toolbar-copy strong')?.textContent || 'Modelo');
    const scale = 1440 / shellRect.width;
    S.idSequence = 0;
    S.capturedNodeIndex.clear();

    function captureElement(element, parentRect, sourceShellRect, sourceScale, zIndex = 1) {
      if (!(element instanceof HTMLElement) || !visible(element)) return null;
      if (element.matches('[aria-hidden="true"],[data-asteryon-carousel-copy="v90"]')) return null;
      if (element.classList.contains('ltp-brand-grid')) {
        return captureBrandCarousel(element, parentRect, sourceShellRect, sourceScale, zIndex, captureElement);
      }

      const rect = element.getBoundingClientRect();
      const box = relativeBox(rect, parentRect, sourceScale);
      const sourceRect = absoluteBox(rect, sourceShellRect, sourceScale);
      const computed = getComputedStyle(element);
      const tag = element.tagName;
      const baseProps = { previewDomTag: tag.toLowerCase(), previewClassName: clean(element.className), ...productProps(element), ...brandProps(element) };

      if (tag === 'IMG') {
        const src = clean(element.getAttribute('src'));
        if (!src) return null;
        const image = node('image', `${clean(element.alt) || 'Imagem'} • Preview preenchido V93`, box, sourceRect, { ...baseProps, src }, stylesFrom(element, computed), zIndex);
        if (element.closest('.ltp-brand')) Object.assign(image.props, { brandLogoAuto: true, catalogEntity: 'brand' });
        return image;
      }

      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        return node('search', 'Busca • Preview preenchido V93', box, sourceRect, {
          ...baseProps, placeholder: clean(element.getAttribute('placeholder')), value: clean(element.value),
        }, stylesFrom(element, computed), zIndex);
      }

      if (textCandidate(element)) {
        const text = clean(element.textContent).replace(/\s+/g, ' ');
        const button = tag === 'BUTTON' || tag === 'A' || element.classList.contains('ltp-btn') || element.classList.contains('ltp-product-info');
        return node(button ? 'button' : 'text', `${elementLabel(element)} • V93`, box, sourceRect, {
          ...baseProps, text, ...(button ? { actionType: 'none', actionValue: '', actionTarget: 'same' } : {}),
        }, stylesFrom(element, computed), zIndex);
      }

      const group = node('group', `${elementLabel(element)} • grupo V93`, box, sourceRect, {
        ...baseProps, atomicTemplate: false, previewLayoutGroup: true,
      }, stylesFrom(element, computed), zIndex);
      let childZ = 1;
      for (const child of element.children) {
        const captured = captureElement(child, rect, sourceShellRect, sourceScale, childZ++);
        if (captured) group.children.push(captured);
      }
      if (!group.children.length && !clean(element.textContent)) return null;
      return group;
    }

    const children = [];
    let zIndex = 1;
    for (const child of shell.children) {
      const captured = captureElement(child, shellRect, shellRect, scale, zIndex++);
      if (captured) children.push(captured);
    }

    const pageHeight = Math.max(900, round(shellRect.height * scale));
    const page = {
      id: S.nextId(`${modelName} page V93`), name: `${modelName} • Preview preenchido V93`, type: 'page',
      x: 0, y: 0, width: 1440, height: pageHeight,
      responsive: {
        tablet: { x: 0, y: 0, width: 834, height: Math.max(900, round(pageHeight * 834 / 1440)) },
        mobile: { x: 0, y: 0, width: 390, height: Math.max(1200, round(pageHeight * 390 / 1440)) },
      },
      locked: false, visible: true, opacity: 1, rotation: 0, zIndex: 0,
      props: S.editableProps({
        autoExtend: true, templateName: modelName, templateCurrentVersion: 'V93',
        sourceOfTruth: 'preview-final-filled-v93', previewEditorParityRequired: true,
        previewEditorParityPolicy: 'visual-tree-copy', legacyTemplateDisabled: true,
      }),
      styles: { backgroundColor: S.transparent(stylesFrom(shell).backgroundColor) ? '#FFFFFF' : stylesFrom(shell).backgroundColor },
      children,
    };

    function index(items) {
      for (const item of items || []) {
        if (item?.id) S.capturedNodeIndex.set(item.id, item);
        index(item?.children || []);
      }
    }
    index([page]);
    return { modelName, shell, nodes: [page], pageHeight };
  }

  function flatten(nodes) {
    const list = [];
    const walk = item => { if (!item) return; list.push(item); (item.children || []).forEach(walk); };
    (nodes || []).forEach(walk);
    return list;
  }

  function validate(result) {
    const sourceImages = [...result.shell.querySelectorAll('img')].filter(visible).map(item => S.absoluteUrl(item.getAttribute('src'))).filter(Boolean);
    const sourceTexts = [...result.shell.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,small,button,a,div')]
      .filter(item => visible(item) && textCandidate(item)).map(item => normalize(item.textContent)).filter(value => value.length >= 2);
    const sourceProducts = [...result.shell.querySelectorAll('.ltp-product')].filter(visible).length;
    const nodes = flatten(result.nodes);
    const targetImages = nodes.filter(item => item.type === 'image' && item.props?.src).map(item => S.absoluteUrl(item.props.src));
    const targetTexts = nodes.filter(item => ['text','button'].includes(item.type) && item.props?.text).map(item => normalize(item.props.text));
    const targetProducts = nodes.filter(item => item.props?.previewProductCard).length;
    const missingImages = [...new Set(sourceImages)].filter(item => !targetImages.includes(item));
    const missingTexts = [...new Set(sourceTexts)].filter(item => !targetTexts.includes(item));
    const unlocked = nodes.filter(item => item.locked === false).length;
    const editable = nodes.filter(item => item.props?.editable === true && item.props?.styleEditable === true && item.props?.geometryEditable === true).length;
    const malformedGeometry = nodes.filter(item => item.type !== 'page' && (!item.props?.previewSourceRect || Number(item.width) <= 0 || Number(item.height) <= 0));
    const ok = nodes.length > 20 && missingImages.length === 0 && missingTexts.length === 0
      && targetProducts === sourceProducts && unlocked === nodes.length && editable === nodes.length && malformedGeometry.length === 0;
    return {
      version: '93', release: 'V93', modelName: result.modelName, ok,
      sourceOfTruth: 'preview-final-filled-v93', hierarchyMode: 'nested-relative-groups',
      source: { images: sourceImages.length, texts: sourceTexts.length, products: sourceProducts },
      target: { nodes: nodes.length, images: targetImages.length, texts: targetTexts.length, products: targetProducts, editable, unlocked },
      missingImages, missingTexts, malformedGeometry: malformedGeometry.map(item => item.id),
      checkedAt: new Date().toISOString(),
    };
  }

  function block(event, message, details) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    console.error('ASTERYON V93 — Grupo 3 bloqueou a aplicação.', details || message);
    alert(`Modelo não aplicado.\n\n${message}\n\nRegra V93: a template corrente deve nascer da Prévia preenchida e manter geometria, textos e produtos.`);
  }

  function hasApprovedOneShot() {
    const payload = window.__ASTERYON_PREVIEW_EDITOR_APPLY_V92__;
    return !!(payload && payload.team3Ok === true && payload.team4Ok === true && Array.isArray(payload.nodes) && Date.now() - Number(payload.createdAt || 0) < 15000);
  }

  function handlePreviewApply(event) {
    if (!(event.target instanceof Element) || !event.target.closest('[data-ltp-apply]')) return;
    try {
      const result = capture();
      const report = validate(result);
      if (!report.ok) return block(event, 'A Prévia preenchida V93 não passou no gate estrutural.', report);

      const team4Request = { result, group3Report: report, team4Report: null };
      window.dispatchEvent(new CustomEvent('asteryon:team4-preflight-request-v92', { detail: team4Request }));
      if (window.__ASTERYON_V92_GROUPS__ && team4Request.team4Report?.ok !== true) {
        return block(event, 'A Equipe 4 reprovou a template preenchida antes de entrar no Editor.', team4Request.team4Report);
      }

      event.__asteryonV93Captured = true;
      window.__ASTERYON_PREVIEW_EDITOR_APPLY_V92__ = {
        modelName: result.modelName, nodes: result.nodes,
        team3Ok: true, team4Ok: team4Request.team4Report?.ok === true,
        currentTemplateVersion: 'V93', sourceOfTruth: 'preview-final-filled-v93', createdAt: Date.now(),
      };
      S.capturedNodes = result.nodes;
      S.report = report;
      S.initialParityChecked = false;
      window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__ = result.nodes;
      window.__ASTERYON_PREVIEW_EDITOR_PARITY_V91__ = report;
      window.__ASTERYON_PREVIEW_EDITOR_SOURCE_V93__ = { modelName: result.modelName, pageHeight: result.pageHeight, capturedAt: Date.now() };
      try {
        sessionStorage.setItem(REPORT_KEY, JSON.stringify(report));
        sessionStorage.setItem(NODES_KEY, JSON.stringify({ modelName: result.modelName, nodes: result.nodes, report }));
      } catch (error) { console.warn('ASTERYON V93: snapshot mantido em memória.', error); }
      window.dispatchEvent(new CustomEvent('asteryon:preview-final-copied-v91', { detail: report }));
      window.dispatchEvent(new CustomEvent('asteryon:preview-final-copied-v93', { detail: report }));
    } catch (error) {
      block(event, error?.message || String(error), error);
    }
  }

  function forceFilledPreview(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button');
    if (!button || button.closest(`#${PREVIEW_ID}`)) return;
    const article = button.closest('article');
    if (!article) return;
    const heading = article.querySelector('h4');
    const name = normalize(heading?.textContent);
    if (!CURRENT_TEMPLATES.has(name)) return;
    if (!normalize(button.textContent).includes('aplicar modelo')) return;
    if (hasApprovedOneShot()) return;

    const previewButton = article.querySelector('[data-laurencini-template-preview]');
    if (!(previewButton instanceof HTMLButtonElement)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    previewButton.click();
  }

  function refreshTemplateCards() {
    templateFrame = 0;
    const title = [...document.querySelectorAll('h3')].find(item => normalize(item.textContent) === 'modelos prontos');
    if (!title) return;
    let root = title.parentElement;
    while (root && root !== document.body && root.querySelectorAll('article').length === 0) root = root.parentElement;
    if (!root || root === document.body) return;
    for (const article of root.querySelectorAll('article')) {
      const heading = article.querySelector('h4');
      const name = normalize(heading?.textContent);
      if (!CURRENT_TEMPLATES.has(name)) continue;
      article.dataset.asteryonTemplateVersion = '93';
      article.dataset.asteryonTemplateSource = 'preview-filled';
      const apply = [...article.querySelectorAll('button')].find(item => normalize(item.textContent).includes('aplicar modelo'));
      if (apply && normalize(apply.textContent) === 'aplicar modelo') apply.textContent = 'Aplicar modelo preenchido V93';
      for (const text of article.querySelectorAll('p')) {
        if (normalize(text.textContent).includes('supabase') && normalize(text.textContent).includes('v')) text.textContent = 'Supabase · V93 · Preview preenchido';
      }
    }
  }

  function scheduleTemplateRefresh() {
    if (!templateFrame) templateFrame = requestAnimationFrame(refreshTemplateCards);
  }

  function addedNodeTouchesTemplates(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches('article,h3,[data-laurencini-template-preview]')) return true;
    return !!node.querySelector?.('article,h3,[data-laurencini-template-preview]');
  }

  function templateMutation(records) {
    return records.some(record => record.type === 'childList' && [...record.addedNodes].some(addedNodeTouchesTemplates));
  }

  document.addEventListener('click', handlePreviewApply, true);
  document.addEventListener('click', forceFilledPreview, true);
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button && normalize(button.textContent) === 'modelos') scheduleTemplateRefresh();
  }, true);
  const observer = new MutationObserver((records) => {
    if (templateMutation(records)) scheduleTemplateRefresh();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleTemplateRefresh, { once: true });
  else scheduleTemplateRefresh();

  window.__ASTERYON_V93_TEMPLATE_POLICY__ = Object.freeze({
    version: 'V93', source: 'Preview Final preenchido', legacyApply: 'bloqueado',
    rule: 'Todas as templates correntes são aplicadas somente a partir da Prévia preenchida V93.',
    v94Performance: 'observer global filtra somente inserções relacionadas ao painel Modelos e agrupa em um RAF',
  });
})();