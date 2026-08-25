(() => {
  'use strict';

  const PAGE_SIZE = 24;
  const state = {
    catalog: { products: [], brands: [], hierarchy: [], promotions: [] },
    segments: [],
    query: '',
    departmentId: '',
    brandId: '',
    segmentId: '',
    segmentName: '',
    segmentProductIds: null,
    visibleCount: PAGE_SIZE,
  };

  const byId = (id) => document.getElementById(id);
  const elements = {
    navToggle: document.querySelector('.nav-toggle'),
    nav: byId('main-nav'),
    search: byId('catalog-search'),
    departmentFilter: byId('department-filter'),
    brandFilter: byId('brand-filter'),
    searchButton: byId('search-button'),
    clearButton: byId('clear-button'),
    removeSegmentFilter: byId('remove-segment-filter'),
    segmentGrid: byId('segment-grid'),
    departmentGrid: byId('department-grid'),
    brandRail: byId('brand-rail'),
    productGrid: byId('product-grid'),
    resultsLabel: byId('results-label'),
    loadMore: byId('load-more'),
    statProducts: byId('stat-products'),
    statBrands: byId('stat-brands'),
    statCategories: byId('stat-categories'),
    footerStatus: byId('footer-status'),
    modal: byId('product-modal'),
    modalTitle: byId('product-modal-title'),
    modalBody: byId('product-modal-body'),
    toast: byId('toast'),
  };

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const safeUrl = (value) => {
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

  const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { accept: 'application/json', ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error(`Falha ${response.status} ao carregar ${url}`);
    return response.json();
  }

  function hierarchyByLevel(level) {
    return state.catalog.hierarchy
      .filter((item) => normalize(item?.level) === level)
      .sort((a, b) => Number(a?.sortOrder ?? a?.sort_order ?? 0) - Number(b?.sortOrder ?? b?.sort_order ?? 0)
        || String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));
  }

  function hierarchyName(id) {
    if (!id) return '';
    return state.catalog.hierarchy.find((item) => String(item?.id) === String(id))?.name || '';
  }

  function brandName(product) {
    return product?.brandName
      || state.catalog.brands.find((brand) => String(brand?.id) === String(product?.brandId))?.name
      || '';
  }

  function setStats() {
    elements.statProducts.textContent = formatNumber(state.catalog.products.length);
    elements.statBrands.textContent = formatNumber(state.catalog.brands.length);
    elements.statCategories.textContent = formatNumber(hierarchyByLevel('categoria').length);
  }

  function renderFilters() {
    const departments = hierarchyByLevel('departamento');
    elements.departmentFilter.innerHTML = [
      '<option value="">Todos os departamentos</option>',
      ...departments.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`),
    ].join('');

    const brands = [...state.catalog.brands]
      .filter((item) => String(item?.status || 'active').toLowerCase() !== 'inactive')
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));
    elements.brandFilter.innerHTML = [
      '<option value="">Todas as marcas</option>',
      ...brands.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`),
    ].join('');
  }

  function renderSegments() {
    if (!state.segments.length) {
      elements.segmentGrid.innerHTML = '<div class="empty-card">Nenhum segmento comercial disponível.</div>';
      return;
    }

    elements.segmentGrid.innerHTML = state.segments.map((segment, index) => `
      <button class="segment-card" type="button" data-segment-id="${escapeHtml(segment.id)}" data-segment-name="${escapeHtml(segment.name)}">
        <span class="segment-index">${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(segment.name)}</strong>
        <span>Ver produtos →</span>
      </button>
    `).join('');
  }

  function renderDepartments() {
    const departments = hierarchyByLevel('departamento');
    if (!departments.length) {
      elements.departmentGrid.innerHTML = '<div class="empty-card">Nenhum departamento disponível.</div>';
      return;
    }

    elements.departmentGrid.innerHTML = departments.map((department) => `
      <button class="department-card" type="button" data-department-id="${escapeHtml(department.id)}">
        <strong>${escapeHtml(department.name)}</strong><span aria-hidden="true">→</span>
      </button>
    `).join('');
  }

  function renderBrands() {
    const brands = [...state.catalog.brands]
      .filter((item) => String(item?.status || 'active').toLowerCase() !== 'inactive')
      .sort((a, b) => Number(b?.featured || 0) - Number(a?.featured || 0)
        || Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0)
        || String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));

    if (!brands.length) {
      elements.brandRail.innerHTML = '<div class="empty-card">Nenhuma marca disponível.</div>';
      return;
    }

    elements.brandRail.innerHTML = brands.map((brand) => {
      const logo = safeUrl(brand?.logoUrl);
      const initials = String(brand?.name || 'M').slice(0, 2).toUpperCase();
      return `
        <button class="brand-card" type="button" data-brand-id="${escapeHtml(brand.id)}" title="Filtrar por ${escapeHtml(brand.name)}">
          ${logo
            ? `<img class="brand-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(brand.name)}" loading="lazy" />`
            : `<span class="brand-placeholder" aria-hidden="true">${escapeHtml(initials)}</span>`}
          <strong>${escapeHtml(brand.name)}</strong>
        </button>
      `;
    }).join('');
  }

  function productSearchText(product) {
    return normalize([
      product?.code,
      product?.ean,
      product?.name,
      product?.shortDescription,
      product?.longDescription,
      brandName(product),
      hierarchyName(product?.departamentoId),
      hierarchyName(product?.secaoId),
      hierarchyName(product?.categoriaId),
      ...(Array.isArray(product?.tags) ? product.tags : []),
    ].filter(Boolean).join(' '));
  }

  function filteredProducts() {
    const query = normalize(state.query);
    return state.catalog.products.filter((product) => {
      if (state.departmentId && String(product?.departamentoId) !== String(state.departmentId)) return false;
      if (state.brandId && String(product?.brandId) !== String(state.brandId)) return false;
      if (state.segmentProductIds && !state.segmentProductIds.has(String(product?.id))) return false;
      if (query && !productSearchText(product).includes(query)) return false;
      return true;
    });
  }

  function productCard(product) {
    const image = safeUrl(product?.imageUrl || product?.image);
    const brand = brandName(product);
    const category = product?.categoriaName || hierarchyName(product?.categoriaId);
    const packaging = [product?.packaging, product?.unit].filter(Boolean).join(' · ');
    return `
      <article class="product-card">
        <div class="product-media">
          ${image
            ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product?.name || 'Produto')}" loading="lazy" />`
            : '<span class="product-media-placeholder">Produto</span>'}
        </div>
        <div class="product-content">
          <p class="product-code">Cód. ${escapeHtml(product?.code || '—')}</p>
          <h3>${escapeHtml(product?.name || 'Produto')}</h3>
          <div class="product-meta">
            ${brand ? `<span>${escapeHtml(brand)}</span>` : ''}
            ${category ? `<span>${escapeHtml(category)}</span>` : ''}
            ${packaging ? `<span>${escapeHtml(packaging)}</span>` : ''}
          </div>
          <button class="button button-light" type="button" data-product-id="${escapeHtml(product?.id)}">Informações do produto</button>
        </div>
      </article>
    `;
  }

  function renderProducts({ scroll = false } = {}) {
    const products = filteredProducts();
    const visible = products.slice(0, state.visibleCount);

    elements.resultsLabel.textContent = state.segmentName
      ? `${formatNumber(products.length)} produtos em ${state.segmentName}`
      : `${formatNumber(products.length)} produtos encontrados`;
    elements.removeSegmentFilter.hidden = !state.segmentProductIds;

    if (!products.length) {
      elements.productGrid.innerHTML = '<div class="empty-card">Nenhum produto corresponde aos filtros selecionados.</div>';
      elements.loadMore.hidden = true;
    } else {
      elements.productGrid.innerHTML = visible.map(productCard).join('');
      elements.loadMore.hidden = visible.length >= products.length;
    }

    if (scroll) byId('produtos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function applyFilters({ scroll = true } = {}) {
    state.query = elements.search.value.trim();
    state.departmentId = elements.departmentFilter.value;
    state.brandId = elements.brandFilter.value;
    state.visibleCount = PAGE_SIZE;
    renderProducts({ scroll });
  }

  function clearFilters({ keepSegment = false } = {}) {
    state.query = '';
    state.departmentId = '';
    state.brandId = '';
    state.visibleCount = PAGE_SIZE;
    elements.search.value = '';
    elements.departmentFilter.value = '';
    elements.brandFilter.value = '';
    if (!keepSegment) {
      state.segmentId = '';
      state.segmentName = '';
      state.segmentProductIds = null;
    }
    renderProducts();
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 3200);
  }

  async function loadSegment(segmentId, segmentName) {
    showToast(`Carregando ${segmentName}…`);
    const ids = new Set();
    const limit = 500;
    for (let offset = 0; offset < 10000; offset += limit) {
      const payload = await fetchJson(`/api/public/commercial-segments/${encodeURIComponent(segmentId)}/products?offset=${offset}&limit=${limit}`);
      const rows = Array.isArray(payload?.products) ? payload.products : [];
      rows.forEach((item) => ids.add(String(item?.id)));
      if (!payload?.hasMore || rows.length < limit) break;
    }
    state.segmentId = segmentId;
    state.segmentName = segmentName;
    state.segmentProductIds = ids;
    state.visibleCount = PAGE_SIZE;
    renderProducts({ scroll: true });
    showToast(`${formatNumber(ids.size)} produtos no segmento ${segmentName}.`);
  }

  function detailRow(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `<div class="detail-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
  }

  function openProduct(productId) {
    const product = state.catalog.products.find((item) => String(item?.id) === String(productId));
    if (!product) return;
    const image = safeUrl(product?.imageUrl || product?.image);
    elements.modalTitle.textContent = product?.name || 'Detalhes do produto';
    elements.modalBody.innerHTML = `
      <div class="modal-product-media">
        ${image
          ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product?.name || 'Produto')}" />`
          : '<span class="product-media-placeholder">Produto sem imagem</span>'}
      </div>
      <div class="modal-product-info">
        <p class="product-code">Cód. ${escapeHtml(product?.code || '—')}</p>
        <h3>${escapeHtml(product?.name || 'Produto')}</h3>
        <div class="detail-list">
          ${detailRow('Marca', brandName(product))}
          ${detailRow('Departamento', product?.departamentoName || hierarchyName(product?.departamentoId))}
          ${detailRow('Seção', product?.secaoName || hierarchyName(product?.secaoId))}
          ${detailRow('Categoria', product?.categoriaName || hierarchyName(product?.categoriaId))}
          ${detailRow('Embalagem', product?.packaging)}
          ${detailRow('Unidade', product?.unit)}
          ${detailRow('EAN', product?.ean)}
          ${detailRow('NCM', product?.ncm)}
        </div>
      </div>
    `;
    elements.modal.hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector('.modal-close')?.focus({ preventScroll: true });
  }

  function closeProduct() {
    elements.modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function bindEvents() {
    elements.navToggle?.addEventListener('click', () => {
      const next = elements.nav?.dataset.open !== 'true';
      if (elements.nav) elements.nav.dataset.open = next ? 'true' : 'false';
      elements.navToggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    });

    elements.nav?.addEventListener('click', (event) => {
      if (!(event.target instanceof HTMLAnchorElement)) return;
      elements.nav.dataset.open = 'false';
      elements.navToggle?.setAttribute('aria-expanded', 'false');
    });

    elements.searchButton.addEventListener('click', () => applyFilters());
    elements.clearButton.addEventListener('click', () => clearFilters());
    elements.removeSegmentFilter.addEventListener('click', () => {
      state.segmentId = '';
      state.segmentName = '';
      state.segmentProductIds = null;
      state.visibleCount = PAGE_SIZE;
      renderProducts();
    });
    elements.departmentFilter.addEventListener('change', () => applyFilters({ scroll: false }));
    elements.brandFilter.addEventListener('change', () => applyFilters({ scroll: false }));
    elements.search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') applyFilters();
      if (event.key === 'Escape') clearFilters({ keepSegment: true });
    });

    elements.segmentGrid.addEventListener('click', async (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-segment-id]') : null;
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = true;
      try {
        await loadSegment(button.dataset.segmentId || '', button.dataset.segmentName || 'segmento');
      } catch (error) {
        console.error('Falha ao carregar segmento', error);
        showToast('Não foi possível carregar os produtos do segmento.');
      } finally {
        button.disabled = false;
      }
    });

    elements.departmentGrid.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-department-id]') : null;
      if (!(button instanceof HTMLButtonElement)) return;
      state.segmentId = '';
      state.segmentName = '';
      state.segmentProductIds = null;
      elements.departmentFilter.value = button.dataset.departmentId || '';
      applyFilters();
    });

    elements.brandRail.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-brand-id]') : null;
      if (!(button instanceof HTMLButtonElement)) return;
      state.segmentId = '';
      state.segmentName = '';
      state.segmentProductIds = null;
      elements.brandFilter.value = button.dataset.brandId || '';
      applyFilters();
    });

    elements.productGrid.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-product-id]') : null;
      if (!(button instanceof HTMLButtonElement)) return;
      openProduct(button.dataset.productId || '');
    });

    elements.loadMore.addEventListener('click', () => {
      state.visibleCount += PAGE_SIZE;
      renderProducts();
    });

    document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeProduct));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.modal.hidden) closeProduct();
    });
  }

  async function init() {
    bindEvents();
    try {
      const [catalogPayload, segmentPayload] = await Promise.all([
        fetchJson('/api/public/catalog'),
        fetchJson('/api/public/commercial-segments'),
      ]);
      state.catalog = catalogPayload?.catalog && typeof catalogPayload.catalog === 'object'
        ? catalogPayload.catalog
        : state.catalog;
      state.catalog.products = Array.isArray(state.catalog.products) ? state.catalog.products : [];
      state.catalog.brands = Array.isArray(state.catalog.brands) ? state.catalog.brands : [];
      state.catalog.hierarchy = Array.isArray(state.catalog.hierarchy) ? state.catalog.hierarchy : [];
      state.segments = Array.isArray(segmentPayload?.segments) ? segmentPayload.segments : [];

      setStats();
      renderFilters();
      renderSegments();
      renderDepartments();
      renderBrands();
      renderProducts();
      elements.footerStatus.textContent = 'Catálogo conectado';
      document.documentElement.dataset.portalReady = 'true';
    } catch (error) {
      console.error('Falha ao iniciar portal público', error);
      elements.segmentGrid.innerHTML = '<div class="error-card">Não foi possível carregar os segmentos.</div>';
      elements.productGrid.innerHTML = '<div class="error-card">Catálogo temporariamente indisponível.</div>';
      elements.resultsLabel.textContent = 'Falha ao carregar o catálogo';
      elements.footerStatus.textContent = 'Catálogo indisponível';
      document.documentElement.dataset.portalReady = 'error';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else void init();
})();
