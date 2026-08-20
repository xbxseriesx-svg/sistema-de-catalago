(() => {
  'use strict';

  if (window.__ASTERYON_PREVIEW_EDITOR_V91_CAPTURE__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V91_CAPTURE__ = true;

  const S = window.__ASTERYON_V91_STATE__;
  if (!S) return;
  const PREVIEW_ID = 'laurencini-template-preview-v69';
  const REPORT_KEY = 'asteryon_preview_editor_parity_v91';
  const NODES_KEY = 'asteryon_preview_editor_nodes_v91';

  function geometry(rect, shellRect, scale) {
    const x = S.round((rect.left - shellRect.left) * scale);
    const y = S.round((rect.top - shellRect.top) * scale);
    const width = Math.max(1, S.round(rect.width * scale));
    const height = Math.max(1, S.round(rect.height * scale));
    return { x, y, width, height, responsive: S.responsive(x, y, width, height) };
  }

  function relativeGeometry(rect, parentRect, scale) {
    const x = S.round((rect.left - parentRect.left) * scale);
    const y = S.round((rect.top - parentRect.top) * scale);
    const width = Math.max(1, S.round(rect.width * scale));
    const height = Math.max(1, S.round(rect.height * scale));
    return { x, y, width, height, responsive: S.responsive(x, y, width, height) };
  }

  function node(type, name, box, props = {}, styles = {}, zIndex = 1) {
    return {
      id: S.nextId(name), name, type,
      x: box.x, y: box.y, width: box.width, height: box.height,
      responsive: box.responsive,
      locked: false, visible: true, opacity: 1, rotation: 0, zIndex,
      props: S.editableProps(props),
      styles: { ...styles },
    };
  }

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.matches('[data-asteryon-carousel-copy="v90"],[aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > .5 && rect.height > .5;
  }

  function visualContainer(element, computed) {
    const bg = S.cssColor(computed.backgroundColor);
    const image = computed.backgroundImage && computed.backgroundImage !== 'none';
    const border = ['Top', 'Right', 'Bottom', 'Left'].some((side) => S.px(computed[`border${side}Width`]) > 0);
    return !S.transparent(bg) || image || border || (computed.boxShadow && computed.boxShadow !== 'none');
  }

  function textCandidate(element) {
    const tag = element.tagName;
    if (['SCRIPT','STYLE','SVG','PATH','IMG','INPUT','TEXTAREA','SELECT','OPTION'].includes(tag)) return false;
    const text = S.clean(element.textContent);
    if (!text) return false;
    if (['H1','H2','H3','H4','H5','H6','P','SPAN','STRONG','SMALL','LABEL','LI','A','BUTTON'].includes(tag)) return !element.querySelector('img,input,textarea,select');
    return tag === 'DIV' && element.childElementCount === 0;
  }

  function findBrandForCard(card) {
    const brands = Array.isArray(S.catalog?.brands) ? S.catalog.brands : [];
    const image = card.querySelector('img');
    const src = S.clean(image?.getAttribute('src'));
    const alt = S.normalize(image?.getAttribute('alt'));
    const text = S.normalize(card.textContent);
    return brands.find((brand) => {
      const id = S.brandId(brand);
      const name = S.normalize(brand?.name);
      const logo = S.brandLogo(brand);
      return (id && S.clean(card.dataset.ltpBrandId) === id)
        || (logo && src && S.sameUrl(logo, src))
        || (name && alt === name)
        || (name && text.includes(name));
    }) || null;
  }

  function brandCard(card, index, duplicate, step, width, height) {
    const brand = findBrandForCard(card);
    const id = S.brandId(brand);
    const strong = card.querySelector('strong');
    const name = S.clean(brand?.name || card.querySelector('img')?.alt || strong?.textContent || card.textContent || `Marca ${index + 1}`);
    const logo = S.brandLogo(brand) || S.clean(card.querySelector('img')?.getAttribute('src'));
    const box = { x: S.round(index * step), y: 0, width, height, responsive: S.responsive(index * step, 0, width, height) };
    const group = node('group', `${name} • marca${duplicate ? ' loop' : ''}`, box, {
      atomicTemplate: true, catalogEntity: 'brand', brandId: id, brandName: name,
      carouselBrand: true, duplicateForLoop: duplicate,
    }, S.stylesFrom(card), 1);
    group.children = [];
    if (logo) {
      const img = card.querySelector('img');
      const cardRect = card.getBoundingClientRect();
      const imgRect = img?.getBoundingClientRect();
      const local = imgRect && cardRect.width ? relativeGeometry(imgRect, cardRect, width / cardRect.width) : {
        x: 12, y: 12, width: Math.max(20, width - 24), height: Math.max(20, height - 24),
        responsive: S.responsive(12, 12, Math.max(20, width - 24), Math.max(20, height - 24)),
      };
      group.children.push(node('image', `${name} • logo vinculada`, local, {
        src: logo, brandId: id, brandName: name, brandLogoAuto: true,
        actionContext: 'brand', actionType: 'brand-page', actionEntityId: id,
        actionValue: id, actionTarget: 'same',
      }, img ? S.stylesFrom(img) : { objectFit: 'contain' }, 2));
    } else {
      const cardRect = card.getBoundingClientRect();
      const textElements = [...card.querySelectorAll('strong,small,span,p')]
        .filter((item) => visible(item) && S.clean(item.textContent));
      if (textElements.length) {
        textElements.forEach((item, textIndex) => {
          const rect = item.getBoundingClientRect();
          const local = cardRect.width > .5
            ? relativeGeometry(rect, cardRect, width / cardRect.width)
            : {
              x: 8, y: 8 + (textIndex * 20), width: Math.max(20, width - 16), height: 18,
              responsive: S.responsive(8, 8 + (textIndex * 20), Math.max(20, width - 16), 18),
            };
          const text = S.clean(item.textContent);
          group.children.push(node('text', `${name} • texto da marca ${textIndex + 1}`, local, {
            text, brandId: id, brandName: name, actionContext: 'brand', actionEntityId: id,
          }, S.stylesFrom(item), 2 + textIndex));
        });
      } else {
        group.children.push(node('text', `${name} • nome da marca`, {
          x: 8, y: 8, width: width - 16, height: height - 16,
          responsive: S.responsive(8, 8, width - 16, height - 16),
        }, { text: name, brandId: id, brandName: name, actionContext: 'brand', actionEntityId: id }, {
          color: '#123F7D', fontSize: 12, fontWeight: 800, textAlign: 'center', fontFamily: 'Inter, sans-serif',
        }, 2));
      }
    }
    return group;
  }

  function brandsCarousel(grid, shellRect, scale, zIndex) {
    const section = grid.parentElement;
    const sectionRect = section?.getBoundingClientRect() || grid.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const sectionStyle = section ? getComputedStyle(section) : null;
    const leftPad = sectionStyle ? S.px(sectionStyle.paddingLeft) : 0;
    const rightPad = sectionStyle ? S.px(sectionStyle.paddingRight) : 0;
    const viewportRect = {
      left: sectionRect.left + leftPad,
      top: gridRect.top,
      width: Math.max(120, sectionRect.width - leftPad - rightPad),
      height: gridRect.height,
    };
    const viewportBox = geometry(viewportRect, shellRect, scale);
    const cards = [...grid.children].filter((item) => item instanceof HTMLElement && visible(item) && !item.matches('[data-asteryon-carousel-copy="v90"],[aria-hidden="true"]'));
    if (!cards.length) return null;
    const gap = S.px(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap, 12) * scale;
    const first = cards[0].getBoundingClientRect();
    const cardWidth = Math.max(60, S.round(first.width * scale));
    const cardHeight = Math.max(40, S.round(first.height * scale));
    const step = cardWidth + S.round(gap);
    const trackWidth = Math.max(viewportBox.width, step * cards.length);

    const track = node('group', 'Marcas • faixa animada editável', {
      x: 0, y: 0, width: trackWidth * 2, height: viewportBox.height,
      responsive: S.responsive(0, 0, trackWidth * 2, viewportBox.height),
    }, {
      atomicTemplate: true, carousel: true, carouselAnimated: true, carouselLoop: true,
      carouselPauseOnHover: true, carouselDirection: 'left', carouselDurationSeconds: 24,
      catalogEntity: 'brand',
    }, { backgroundColor: 'transparent' }, 1);
    track.id = `asteryon-brands-carousel-track-v91-${S.nextId('track')}`;
    track.children = [];
    cards.forEach((card, index) => track.children.push(brandCard(card, index, false, step, cardWidth, cardHeight)));
    cards.forEach((card, index) => track.children.push(brandCard(card, index + cards.length, true, step, cardWidth, cardHeight)));

    const viewport = node('group', 'Marcas • carrossel animado', viewportBox, {
      atomicTemplate: true, brandsCarousel: true, carouselViewport: true,
      carouselAnimated: true, carouselLoop: true, carouselPauseOnHover: true,
      addRemoveBrands: true, reorderBrands: true, catalogEntity: 'brand',
    }, { backgroundColor: 'transparent', overflow: 'hidden' }, zIndex);
    viewport.id = `asteryon-brands-carousel-viewport-v91-${S.nextId('viewport')}`;
    viewport.children = [track];
    return viewport;
  }

  function capture() {
    const modal = document.getElementById(PREVIEW_ID);
    const shell = modal?.querySelector('.ltp-shell');
    if (!(shell instanceof HTMLElement)) throw new Error('Preview Final não está disponível.');
    const shellRect = shell.getBoundingClientRect();
    if (shellRect.width < 100 || shellRect.height < 100) throw new Error('Preview Final sem geometria válida.');
    const modelName = S.clean(shell.dataset.ltpTemplate || modal.querySelector('.ltp-toolbar-copy strong')?.textContent || 'Modelo');
    const scale = 1440 / shellRect.width;
    S.idSequence = 0;
    S.capturedNodeIndex.clear();
    const children = [];
    let zIndex = 1;

    function add(item) { if (item) { children.push(item); zIndex += 1; } }
    function walk(element) {
      if (!(element instanceof HTMLElement) || !visible(element)) return;
      if (element.matches('[data-asteryon-carousel-copy="v90"],[aria-hidden="true"]')) return;
      if (element.matches('.ltp-brand-grid')) { add(brandsCarousel(element, shellRect, scale, zIndex)); return; }
      if (element.closest('.ltp-brand-grid')) return;

      const rect = element.getBoundingClientRect();
      const box = geometry(rect, shellRect, scale);
      const computed = getComputedStyle(element);
      const tag = element.tagName;

      if (tag === 'IMG') {
        const src = S.clean(element.getAttribute('src'));
        if (src) add(node('image', `${S.clean(element.alt) || 'Imagem'} • Preview Final`, box, { src }, S.stylesFrom(element, computed), zIndex));
        return;
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        add(node('search', 'Busca • Preview Final', box, { placeholder: S.clean(element.getAttribute('placeholder')), value: S.clean(element.value) }, S.stylesFrom(element, computed), zIndex));
        return;
      }
      if (visualContainer(element, computed) && element !== shell) add(node('shape', `${S.clean(element.className).split(/\s+/)[0] || tag} • fundo`, box, {}, S.stylesFrom(element, computed), zIndex));
      if (textCandidate(element)) {
        const text = S.clean(element.textContent);
        const button = tag === 'BUTTON' || tag === 'A' || element.classList.contains('ltp-btn') || element.classList.contains('ltp-product-info');
        add(node(button ? 'button' : 'text', `${S.clean(element.className).split(/\s+/).slice(0,2).join(' ') || 'Texto'} • ${text.slice(0,42)}`, box, {
          text, ...(button ? { actionType: 'none', actionValue: '', actionTarget: 'same' } : {}),
        }, S.stylesFrom(element, computed), zIndex));
        return;
      }
      [...element.children].forEach(walk);
    }
    [...shell.children].forEach(walk);

    const shellStyles = S.stylesFrom(shell);
    const pageHeight = Math.max(900, S.round(shellRect.height * scale));
    const page = {
      id: S.nextId(`${modelName} page`), name: `${modelName} • Preview Final preenchido`, type: 'page',
      x: 0, y: 0, width: 1440, height: pageHeight,
      responsive: {
        tablet: { x: 0, y: 0, width: 834, height: Math.max(900, S.round(pageHeight * 834 / 1440)) },
        mobile: { x: 0, y: 0, width: 390, height: Math.max(1200, S.round(pageHeight * 390 / 1440)) },
      },
      locked: false, visible: true, opacity: 1, rotation: 0, zIndex: 0,
      props: S.editableProps({
        autoExtend: true, templateName: modelName, sourceOfTruth: 'preview-final-filled',
        previewEditorParityRequired: true, previewEditorParityPolicy: 'ctrl-c-ctrl-v',
      }),
      styles: { backgroundColor: S.transparent(shellStyles.backgroundColor) ? '#FFFFFF' : shellStyles.backgroundColor },
      children,
    };
    function indexNodes(items) {
      (items || []).forEach((item) => {
        if (item?.id) S.capturedNodeIndex.set(item.id, item);
        if (Array.isArray(item?.children)) indexNodes(item.children);
      });
    }
    indexNodes([page]);
    return { modelName, shell, nodes: [page] };
  }

  function sourceFingerprint(shell) {
    const images = [...shell.querySelectorAll('img')]
      .filter((item) => visible(item) && !item.closest('[data-asteryon-carousel-copy="v90"]'))
      .map((item) => S.absoluteUrl(item.getAttribute('src'))).filter(Boolean);
    const texts = [...shell.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,small,button,a,div')]
      .filter((item) => visible(item) && textCandidate(item) && !item.closest('[data-asteryon-carousel-copy="v90"]'))
      .map((item) => S.normalize(item.textContent)).filter((value) => value.length >= 2);
    const brandLogos = [...shell.querySelectorAll('.ltp-brand img')]
      .filter((item) => visible(item) && !item.closest('[data-asteryon-carousel-copy="v90"]'))
      .map((item) => S.absoluteUrl(item.getAttribute('src'))).filter(Boolean);
    return { images: [...new Set(images)], texts: [...new Set(texts)], brandLogos: [...new Set(brandLogos)] };
  }

  function targetFingerprint(nodes) {
    const images = [], texts = [], brandLogos = [];
    let total = 0, editable = 0, unlocked = 0;
    function walk(item) {
      if (!item) return;
      total += 1;
      if (item.locked === false) unlocked += 1;
      if (item.props?.editable === true && item.props?.styleEditable === true) editable += 1;
      if (item.type === 'image' && item.props?.src) {
        images.push(S.absoluteUrl(item.props.src));
        if (item.props.brandLogoAuto) brandLogos.push(S.absoluteUrl(item.props.src));
      }
      if ((item.type === 'text' || item.type === 'button') && item.props?.text) texts.push(S.normalize(item.props.text));
      (item.children || []).forEach(walk);
    }
    (nodes || []).forEach(walk);
    return { images: [...new Set(images)], texts: [...new Set(texts)], brandLogos: [...new Set(brandLogos)], total, editable, unlocked };
  }

  function validate(result) {
    const source = sourceFingerprint(result.shell);
    const target = targetFingerprint(result.nodes);
    const missingImages = source.images.filter((item) => !target.images.includes(item));
    const missingTexts = source.texts.filter((item) => !target.texts.includes(item));
    const missingBrandLogos = source.brandLogos.filter((item) => !target.brandLogos.includes(item));
    const ok = target.total > 10 && target.editable === target.total && target.unlocked === target.total
      && missingImages.length === 0 && missingTexts.length === 0 && missingBrandLogos.length === 0;
    return {
      version: '91', modelName: result.modelName, ok,
      rule: 'Editor inicial deve ser Ctrl+C/Ctrl+V do Preview Final preenchido.',
      source: { images: source.images.length, texts: source.texts.length, brandLogos: source.brandLogos.length },
      target: { nodes: target.total, editable: target.editable, unlocked: target.unlocked, images: target.images.length, texts: target.texts.length, brandLogos: target.brandLogos.length },
      missingImages, missingTexts, missingBrandLogos, checkedAt: new Date().toISOString(),
    };
  }

  function block(event, message, details) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    console.error('ASTERYON V91 — Grupo 3 bloqueou a aplicação.', details || message);
    alert(`Modelo não aplicado.\n\n${message}\n\nRegra obrigatória: Editor = Preview Final preenchido.`);
  }

  function handleApply(event) {
    if (!(event.target instanceof Element) || !event.target.closest('[data-ltp-apply]')) return;
    try {
      const result = capture();
      const report = validate(result);
      if (!report.ok) return block(event, 'A cópia do Preview Final não passou na validação de equivalência.', report);
      const team4Request = { result, group3Report: report, team4Report: null };
      window.dispatchEvent(new CustomEvent('asteryon:team4-preflight-request-v92', { detail: team4Request }));
      if (window.__ASTERYON_V92_GROUPS__ && team4Request.team4Report?.ok !== true) {
        return block(event, 'A Equipe 4 reprovou a equivalência antes da substituição da árvore.', team4Request.team4Report);
      }
      const refs = S.replaceTemplateNodes(result.modelName, result.nodes);
      if (!refs) return block(event, `O modelo "${result.modelName}" não está ligado à árvore usada pelo editor.`, { available: [...S.templateNodeRefs.keys()] });
      report.templateReferencesUpdated = refs;
      window.__ASTERYON_PREVIEW_EDITOR_APPLY_V92__ = {
        modelName: result.modelName,
        nodes: result.nodes,
        team3Ok: report.ok === true,
        team4Ok: team4Request.team4Report?.ok === true,
        createdAt: Date.now(),
      };
      S.capturedNodes = result.nodes;
      S.report = report;
      window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__ = result.nodes;
      window.__ASTERYON_PREVIEW_EDITOR_PARITY_V91__ = report;
      try {
        sessionStorage.setItem(REPORT_KEY, JSON.stringify(report));
        sessionStorage.setItem(NODES_KEY, JSON.stringify({ modelName: result.modelName, nodes: result.nodes, report }));
      } catch (error) {
        console.warn('ASTERYON V91: snapshot mantido em memória da aba.', error);
      }
      window.dispatchEvent(new CustomEvent('asteryon:preview-final-copied-v91', { detail: report }));
    } catch (error) {
      block(event, error?.message || String(error), error);
    }
  }

  document.addEventListener('click', handleApply, true);
  window.__ASTERYON_V91_CAPTURE__ = Object.freeze({
    rule: 'Preview Final preenchido é a fonte do modelo de edição; falha volta ao Grupo 1.',
    validate: 'imagens + logos + textos + nós destravados/editáveis devem fechar sem diferença',
  });
})();
