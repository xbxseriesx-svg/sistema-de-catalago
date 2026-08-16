(() => {
  'use strict';

  const SEARCH_PLACEHOLDER = 'Pesquisar marca';
  const BUTTON_ATTR = 'data-asteryon-brand-image-search';
  const MODAL_ID = 'asteryon-brand-image-search-modal-v70';
  const STYLE_ID = 'asteryon-brand-image-search-style-v70';
  const MAX_DIMENSION = 1400;
  const TARGET_BYTES = 300 * 1024;
  let brandCache = null;
  let augmentTimer = 0;
  let loadingBrands = null;

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [${BUTTON_ATTR}] { position: relative; }
      [${BUTTON_ATTR}][aria-busy="true"] { opacity: .55; pointer-events: none; }
      #${MODAL_ID} { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: 22px; background: rgba(0,0,0,.72); backdrop-filter: blur(5px); }
      #${MODAL_ID} .abiv70-panel { width: min(980px, 96vw); max-height: min(820px, 92vh); overflow: hidden; display: flex; flex-direction: column; border: 1px solid #34343f; border-radius: 14px; background: #111115; color: #f4f4f5; box-shadow: 0 28px 80px rgba(0,0,0,.55); }
      #${MODAL_ID} .abiv70-head { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #2b2b33; }
      #${MODAL_ID} .abiv70-title { min-width: 0; flex: 1; }
      #${MODAL_ID} .abiv70-title strong { display: block; font-size: 14px; }
      #${MODAL_ID} .abiv70-title span { display: block; margin-top: 3px; color: #a1a1aa; font-size: 11px; }
      #${MODAL_ID} .abiv70-close { width: 34px; height: 34px; border: 1px solid #3f3f46; border-radius: 8px; background: #18181b; color: #fafafa; cursor: pointer; font-size: 18px; }
      #${MODAL_ID} .abiv70-status { padding: 10px 18px; min-height: 38px; border-bottom: 1px solid #23232a; color: #c4c4cc; font-size: 12px; }
      #${MODAL_ID} .abiv70-status[data-kind="error"] { color: #fca5a5; }
      #${MODAL_ID} .abiv70-status[data-kind="success"] { color: #86efac; }
      #${MODAL_ID} .abiv70-grid { overflow: auto; padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; scrollbar-gutter: stable; }
      #${MODAL_ID} .abiv70-card { overflow: hidden; display: flex; flex-direction: column; min-height: 215px; border: 1px solid #30303a; border-radius: 11px; background: #17171c; }
      #${MODAL_ID} .abiv70-thumb { height: 145px; display: grid; place-items: center; padding: 10px; background: #fafafa; }
      #${MODAL_ID} .abiv70-thumb img { width: 100%; height: 100%; object-fit: contain; }
      #${MODAL_ID} .abiv70-meta { padding: 9px 10px 7px; min-height: 45px; color: #d4d4d8; font-size: 10px; line-height: 1.35; }
      #${MODAL_ID} .abiv70-use { margin: auto 10px 10px; height: 31px; border: 0; border-radius: 7px; background: #7c3aed; color: white; font-size: 11px; font-weight: 700; cursor: pointer; }
      #${MODAL_ID} .abiv70-use:disabled { opacity: .5; cursor: wait; }
      #${MODAL_ID} .abiv70-empty { grid-column: 1 / -1; padding: 34px 18px; text-align: center; color: #a1a1aa; font-size: 12px; }
    `;
    document.head.appendChild(style);
  }

  function searchIcon() {
    return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.8" cy="10.8" r="5.8"></circle><path d="m15.2 15.2 4 4"></path><path d="M7.8 10.8h6"></path><path d="M10.8 7.8v6"></path></svg>';
  }

  async function jsonRequest(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!response.ok || payload?.ok === false) {
      const message = payload?.error?.message || payload?.message || `Falha HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload || {};
  }

  async function getBrands(force = false) {
    if (!force && Array.isArray(brandCache)) return brandCache;
    if (!force && loadingBrands) return loadingBrands;
    loadingBrands = jsonRequest('/api/admin/brands')
      .then((payload) => {
        brandCache = Array.isArray(payload.brands) ? payload.brands : [];
        return brandCache;
      })
      .finally(() => { loadingBrands = null; });
    return loadingBrands;
  }

  function panelRootFor(input) {
    let current = input;
    for (let depth = 0; depth < 9 && current; depth += 1, current = current.parentElement) {
      const text = current.textContent || '';
      if (text.includes('NOVA MARCA') && text.includes('Pesquisar marca') && current.querySelectorAll('button').length >= 5) return current;
    }
    return document;
  }

  function rowForBrand(root, brand) {
    const target = normalize(brand.name);
    const candidates = [...root.querySelectorAll('strong,span,p,div')].filter((element) => {
      if (element.children.length > 2) return false;
      return normalize(element.textContent) === target;
    });
    for (const label of candidates) {
      let current = label;
      for (let depth = 0; depth < 7 && current && current !== root; depth += 1, current = current.parentElement) {
        const text = normalize(current.textContent);
        const buttons = current.querySelectorAll('button');
        if (buttons.length >= 3 && /produto\(s\)|produto/.test(text)) return current;
      }
    }
    return null;
  }

  function actionContainer(row) {
    const buttons = [...row.querySelectorAll('button')].filter((button) => !button.hasAttribute(BUTTON_ATTR));
    if (!buttons.length) return null;
    const groups = [...row.querySelectorAll('div')].filter((element) => {
      const directButtons = [...element.children].filter((child) => child.tagName === 'BUTTON');
      return directButtons.length >= 2;
    });
    if (groups.length) return groups.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0];
    return buttons.at(-1)?.parentElement || null;
  }

  function setStatus(modal, message, kind = '') {
    const status = modal.querySelector('.abiv70-status');
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
  }

  function toWebpBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('O navegador não conseguiu converter a imagem para WEBP.')), 'image/webp', quality);
    });
  }

  async function decodeImage(blob) {
    if ('createImageBitmap' in window) return createImageBitmap(blob);
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = objectUrl;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function convertToWebp(blob) {
    const source = await decodeImage(blob);
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    if (!width || !height) throw new Error('Não foi possível ler as dimensões da imagem.');
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas indisponível para conversão.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    if (typeof source.close === 'function') source.close();

    let result = null;
    for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
      result = await toWebpBlob(canvas, quality);
      if (result.size <= TARGET_BYTES) break;
    }
    return result;
  }

  function refreshVisibleLogo(brand, url) {
    const input = document.querySelector(`input[placeholder="${SEARCH_PLACEHOLDER}"]`);
    if (!input) return;
    const row = rowForBrand(panelRootFor(input), brand);
    if (!row) return;
    const noLogo = [...row.querySelectorAll('*')].find((element) => normalize(element.textContent) === 'sem logo');
    if (!noLogo) return;
    noLogo.textContent = '';
    noLogo.style.backgroundImage = `url("${String(url).replace(/"/g, '%22')}")`;
    noLogo.style.backgroundSize = 'contain';
    noLogo.style.backgroundRepeat = 'no-repeat';
    noLogo.style.backgroundPosition = 'center';
  }

  async function chooseImage(modal, brand, image, button) {
    button.disabled = true;
    try {
      setStatus(modal, 'Baixando a imagem com proteção de origem...');
      const proxyUrl = `/api/admin/brand-images/fetch?url=${encodeURIComponent(image.url)}&sig=${encodeURIComponent(image.signature)}`;
      const sourceResponse = await fetch(proxyUrl, { credentials: 'same-origin' });
      if (!sourceResponse.ok) {
        let message = `Falha ao baixar imagem (${sourceResponse.status})`;
        try { message = (await sourceResponse.json())?.error?.message || message; } catch { /* mantém mensagem */ }
        throw new Error(message);
      }
      const sourceBlob = await sourceResponse.blob();
      setStatus(modal, 'Convertendo para WEBP e otimizando a logo...');
      const webp = await convertToWebp(sourceBlob);
      setStatus(modal, `Enviando logo otimizada (${Math.max(1, Math.round(webp.size / 1024))} KB) para o Supabase...`);
      const uploadUrl = `/api/admin/brand-images/upload?brandId=${encodeURIComponent(brand.id)}&source=${encodeURIComponent(image.sourceUrl || image.url)}&provider=${encodeURIComponent(image.provider || 'internet')}`;
      const payload = await jsonRequest(uploadUrl, {
        method: 'POST',
        headers: { 'content-type': 'image/webp' },
        body: webp,
      });
      brand.logoUrl = payload.url || payload.brand?.logoUrl || brand.logoUrl;
      refreshVisibleLogo(brand, brand.logoUrl);
      setStatus(modal, 'Logo salva na marca com sucesso. A alteração já está no Supabase.', 'success');
      window.dispatchEvent(new CustomEvent('asteryon:brand-logo-updated', { detail: { brandId: brand.id, brandName: brand.name, url: brand.logoUrl } }));
      [...modal.querySelectorAll('.abiv70-use')].forEach((item) => { item.disabled = true; });
      button.textContent = 'Aplicada';
    } catch (error) {
      setStatus(modal, error instanceof Error ? error.message : 'Falha ao aplicar imagem da marca.', 'error');
      button.disabled = false;
    }
  }

  function renderImages(modal, brand, images) {
    const grid = modal.querySelector('.abiv70-grid');
    grid.textContent = '';
    if (!images.length) {
      const empty = document.createElement('div');
      empty.className = 'abiv70-empty';
      empty.textContent = 'Nenhuma imagem compatível foi encontrada para esta marca.';
      grid.appendChild(empty);
      return;
    }
    for (const image of images) {
      const card = document.createElement('div');
      card.className = 'abiv70-card';
      const thumb = document.createElement('div');
      thumb.className = 'abiv70-thumb';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.alt = image.title || `Logo ${brand.name}`;
      img.src = image.thumbnailUrl || image.url;
      img.addEventListener('error', () => { img.style.opacity = '.2'; });
      thumb.appendChild(img);
      const meta = document.createElement('div');
      meta.className = 'abiv70-meta';
      meta.textContent = `${image.title || brand.name}${image.provider ? ` · ${image.provider}` : ''}`;
      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'abiv70-use';
      use.textContent = 'Usar esta imagem';
      use.addEventListener('click', () => chooseImage(modal, brand, image, use));
      card.append(thumb, meta, use);
      grid.appendChild(card);
    }
  }

  async function openSearch(brand, trigger) {
    ensureStyles();
    closeModal();
    trigger.setAttribute('aria-busy', 'true');
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <section class="abiv70-panel" role="dialog" aria-modal="true" aria-label="Pesquisar imagem da marca">
        <div class="abiv70-head">
          <div class="abiv70-title"><strong>Pesquisar imagem da marca</strong><span></span></div>
          <button type="button" class="abiv70-close" aria-label="Fechar">×</button>
        </div>
        <div class="abiv70-status">Pesquisando imagens na internet...</div>
        <div class="abiv70-grid"><div class="abiv70-empty">Carregando resultados...</div></div>
      </section>`;
    modal.querySelector('.abiv70-title span').textContent = brand.name;
    modal.querySelector('.abiv70-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    document.body.appendChild(modal);
    try {
      const payload = await jsonRequest(`/api/admin/brand-images/search?brandId=${encodeURIComponent(brand.id)}`);
      const images = Array.isArray(payload.images) ? payload.images : [];
      const providerText = payload.provider === 'google' ? 'Google Images' : 'Wikimedia Commons';
      setStatus(modal, payload.providerMessage || `${images.length} resultado(s) encontrado(s) em ${providerText}. Selecione uma imagem para converter e salvar.`);
      renderImages(modal, brand, images);
    } catch (error) {
      setStatus(modal, error instanceof Error ? error.message : 'Falha ao pesquisar imagens da marca.', 'error');
      renderImages(modal, brand, []);
    } finally {
      trigger.removeAttribute('aria-busy');
    }
  }

  function addButton(row, brand) {
    if (row.querySelector(`[${BUTTON_ATTR}]`)) return;
    const actions = actionContainer(row);
    if (!actions) return;
    const reference = [...actions.children].find((child) => child.tagName === 'BUTTON');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(BUTTON_ATTR, 'v70');
    button.setAttribute('aria-label', `Pesquisar imagem da marca ${brand.name}`);
    button.title = 'Pesquisar imagem da marca';
    if (reference?.className) button.className = reference.className;
    button.innerHTML = searchIcon();
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openSearch(brand, button);
    });
    actions.insertBefore(button, reference || actions.firstChild);
  }

  async function augment() {
    const input = document.querySelector(`input[placeholder="${SEARCH_PLACEHOLDER}"]`);
    if (!input) return;
    try {
      const brands = await getBrands();
      const root = panelRootFor(input);
      for (const brand of brands) {
        const row = rowForBrand(root, brand);
        if (row) addButton(row, brand);
      }
    } catch (error) {
      console.warn('ASTERYON V70: não foi possível preparar pesquisa de imagens das marcas.', error);
    }
  }

  function scheduleAugment() {
    clearTimeout(augmentTimer);
    augmentTimer = window.setTimeout(augment, 120);
  }

  ensureStyles();
  const observer = new MutationObserver(scheduleAugment);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('asteryon:brand-logo-updated', () => { getBrands(true).then(scheduleAugment).catch(() => {}); });
  window.addEventListener('focus', scheduleAugment);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleAugment(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleAugment, { once: true });
  else scheduleAugment();
})();
