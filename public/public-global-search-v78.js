(() => {
  'use strict';

  if (window.__ASTERYON_PUBLIC_GLOBAL_SEARCH_V78__) return;
  window.__ASTERYON_PUBLIC_GLOBAL_SEARCH_V78__ = true;

  const API_URL = '/api/public/catalog';
  const SEARCH_BUTTON_LABELS = new Set(['busca', 'buscar', 'pesquisa', 'pesquisar', 'consulta', 'consultar']);
  const MAX_PER_GROUP = 14;
  let catalogPromise = null;
  let modal = null;
  let modalInput = null;
  let resultsBox = null;
  let statusBox = null;
  let sourceInput = null;
  let debounceTimer = 0;

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const encode = (value) => encodeURIComponent(String(value ?? ''));

  function addStyles() {
    if (document.getElementById('asteryon-public-search-v78-style')) return;
    const style = document.createElement('style');
    style.id = 'asteryon-public-search-v78-style';
    style.textContent = `
      #asteryon-global-search-v78{position:fixed;inset:0;z-index:2147483000;display:none;align-items:flex-start;justify-content:center;padding:clamp(16px,5vh,56px) 14px;background:rgba(2,6,23,.72);backdrop-filter:blur(7px);font-family:Inter,system-ui,sans-serif}
      #asteryon-global-search-v78[data-open="true"]{display:flex}
      #asteryon-global-search-v78 *{box-sizing:border-box}
      .ags78-dialog{width:min(980px,100%);max-height:min(88vh,900px);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(148,163,184,.28);border-radius:20px;background:#fff;color:#0f172a;box-shadow:0 30px 100px rgba(0,0,0,.35)}
      .ags78-head{padding:18px;border-bottom:1px solid #e2e8f0;background:linear-gradient(180deg,#fff,#f8fafc)}
      .ags78-title-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .ags78-title{font-size:18px;font-weight:850;letter-spacing:-.02em}
      .ags78-subtitle{margin-top:3px;font-size:11px;color:#64748b}
      .ags78-close{display:grid;place-items:center;width:36px;height:36px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;cursor:pointer;font-size:22px;line-height:1}
      .ags78-close:hover{background:#f1f5f9}
      .ags78-search-row{display:grid;grid-template-columns:1fr auto;gap:8px}
      .ags78-input{width:100%;height:48px;padding:0 15px;border:1px solid #94a3b8;border-radius:12px;background:#fff;color:#0f172a;font-size:15px;outline:none}
      .ags78-input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
      .ags78-search-button{height:48px;padding:0 20px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}
      .ags78-status{min-height:22px;padding:9px 18px 0;font-size:11px;color:#64748b;background:#fff}
      .ags78-results{overflow:auto;padding:10px 18px 22px;background:#fff}
      .ags78-empty{padding:34px 14px;text-align:center;color:#64748b;font-size:13px}
      .ags78-error{margin:12px 0;padding:12px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#991b1b;font-size:12px}
      .ags78-group{margin-top:12px}
      .ags78-group-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#475569}
      .ags78-count{font-weight:700;color:#94a3b8}
      .ags78-list{display:grid;gap:7px}
      .ags78-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:11px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#0f172a;text-decoration:none;transition:.14s ease}
      .ags78-item:hover{border-color:#93c5fd;background:#eff6ff;transform:translateY(-1px)}
      .ags78-item-main{min-width:0}
      .ags78-item-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:800}
      .ags78-item-meta{display:flex;flex-wrap:wrap;gap:5px 9px;margin-top:4px;font-size:10px;color:#64748b}
      .ags78-pill{display:inline-flex;align-items:center;border-radius:999px;padding:2px 7px;background:#f1f5f9;font-size:9px;font-weight:800;color:#475569}
      .ags78-open{font-size:11px;font-weight:800;color:#2563eb;white-space:nowrap}
      .ags78-code-exact{border-color:#60a5fa;background:#eff6ff}
      @media(max-width:640px){
        #asteryon-global-search-v78{padding:10px}
        .ags78-dialog{max-height:94vh;border-radius:16px}
        .ags78-head{padding:14px}
        .ags78-search-row{grid-template-columns:1fr}
        .ags78-search-button{width:100%}
        .ags78-item{grid-template-columns:1fr}
        .ags78-open{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  async function loadCatalog(force = false) {
    if (!catalogPromise || force) {
      catalogPromise = fetch(API_URL, { headers: { accept: 'application/json' }, cache: 'no-store' })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok || !payload?.catalog) {
            throw new Error(payload?.error?.message || `Falha ao consultar catálogo (${response.status})`);
          }
          return payload.catalog;
        })
        .catch((error) => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  }

  function buildIndexes(catalog) {
    const products = Array.isArray(catalog?.products) ? catalog.products : [];
    const brands = (Array.isArray(catalog?.brands) ? catalog.brands : []).filter((item) => item?.status !== 'inactive');
    const hierarchy = (Array.isArray(catalog?.hierarchy) ? catalog.hierarchy : []).filter((item) => item?.status !== 'inactive');
    const brandById = new Map(brands.map((item) => [String(item.id), item]));
    const hierarchyById = new Map(hierarchy.map((item) => [String(item.id), item]));
    return { products, brands, hierarchy, brandById, hierarchyById };
  }

  function rank(text, query) {
    const haystack = normalize(text);
    if (!haystack || !query) return 0;
    if (haystack === query) return 120;
    if (haystack.startsWith(query)) return 90;
    const index = haystack.indexOf(query);
    if (index >= 0) return 70 - Math.min(index, 25);
    const words = query.split(' ').filter(Boolean);
    if (words.length > 1 && words.every((word) => haystack.includes(word))) return 50;
    return 0;
  }

  function bestScore(values, query) {
    let best = 0;
    for (const value of values) best = Math.max(best, rank(value, query));
    return best;
  }

  function performSearch(catalog, rawQuery) {
    const query = normalize(rawQuery);
    const idx = buildIndexes(catalog);
    if (!query) return { query, products: [], brands: [], departments: [], sections: [], categories: [], total: 0 };

    const products = idx.products.map((product) => {
      const brand = idx.brandById.get(String(product.brandId ?? product.brand_id ?? ''));
      const department = idx.hierarchyById.get(String(product.departamentoId ?? product.departmentId ?? product.departamento_id ?? ''));
      const section = idx.hierarchyById.get(String(product.secaoId ?? product.sectionId ?? product.secao_id ?? ''));
      const category = idx.hierarchyById.get(String(product.categoriaId ?? product.categoryId ?? product.categoria_id ?? ''));
      const code = String(product.code ?? product.codigo ?? '');
      const exactCode = normalize(code) === query;
      const score = exactCode ? 500 : bestScore([
        code,
        product.name,
        product.shortDescription,
        product.longDescription,
        product.description,
        product.descricao,
        product.ean,
        product.gtin,
        brand?.name,
        department?.name,
        section?.name,
        category?.name,
      ], query);
      return { product, brand, department, section, category, score, exactCode };
    }).filter((item) => item.score > 0)
      .sort((a, b) => Number(b.exactCode) - Number(a.exactCode) || b.score - a.score || String(a.product.name || '').localeCompare(String(b.product.name || ''), 'pt-BR'));

    const brands = idx.brands.map((brand) => ({ item: brand, score: bestScore([brand.name, brand.slug, brand.description], query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(a.item.name || '').localeCompare(String(b.item.name || ''), 'pt-BR'));

    const hierarchyMatches = idx.hierarchy.map((item) => ({ item, score: bestScore([item.name, item.slug], query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(a.item.name || '').localeCompare(String(b.item.name || ''), 'pt-BR'));

    const departments = hierarchyMatches.filter((entry) => ['departamento', 'department'].includes(normalize(entry.item.level ?? entry.item.type)));
    const sections = hierarchyMatches.filter((entry) => ['secao', 'section'].includes(normalize(entry.item.level ?? entry.item.type)));
    const categories = hierarchyMatches.filter((entry) => ['categoria', 'category', 'subcategoria', 'subcategory'].includes(normalize(entry.item.level ?? entry.item.type)));

    return {
      query,
      products,
      brands,
      departments,
      sections,
      categories,
      total: products.length + brands.length + departments.length + sections.length + categories.length,
    };
  }

  function entityHref(type, item) {
    const id = item?.id ?? '';
    if (type === 'brand') return `/marca/${encode(item?.slug || id)}`;
    if (type === 'department') return `/?departamento=${encode(id)}#catalogo`;
    if (type === 'section') return `/?secao=${encode(id)}#catalogo`;
    if (type === 'category') return `/?categoria=${encode(id)}#catalogo`;
    return '/#catalogo';
  }

  function productHref(product) {
    return `/produto/${encode(product?.id ?? product?.code ?? '')}`;
  }

  function productHtml(entry) {
    const product = entry.product || {};
    const title = product.shortDescription || product.name || product.description || `Produto ${product.code || ''}`;
    const code = product.code ?? product.codigo ?? '';
    const brandName = entry.brand?.name || product.brandName || '';
    const hierarchy = [entry.department?.name, entry.section?.name, entry.category?.name].filter(Boolean).join(' › ');
    return `<a class="ags78-item${entry.exactCode ? ' ags78-code-exact' : ''}" href="${productHref(product)}">
      <div class="ags78-item-main">
        <div class="ags78-item-title">${escapeHtml(title)}</div>
        <div class="ags78-item-meta">
          ${code ? `<span class="ags78-pill">Código ${escapeHtml(code)}</span>` : ''}
          ${brandName ? `<span>${escapeHtml(brandName)}</span>` : ''}
          ${hierarchy ? `<span>${escapeHtml(hierarchy)}</span>` : ''}
          ${entry.exactCode ? '<span class="ags78-pill">Código exato</span>' : ''}
        </div>
      </div>
      <span class="ags78-open">Abrir produto →</span>
    </a>`;
  }

  function entityHtml(type, entry) {
    const item = entry.item || {};
    const labels = { brand: 'Marca', department: 'Departamento', section: 'Seção', category: 'Categoria' };
    return `<a class="ags78-item" href="${entityHref(type, item)}">
      <div class="ags78-item-main">
        <div class="ags78-item-title">${escapeHtml(item.name || item.slug || '')}</div>
        <div class="ags78-item-meta"><span class="ags78-pill">${labels[type]}</span></div>
      </div>
      <span class="ags78-open">Abrir →</span>
    </a>`;
  }

  function groupHtml(title, entries, renderer) {
    if (!entries.length) return '';
    const visible = entries.slice(0, MAX_PER_GROUP);
    return `<section class="ags78-group">
      <div class="ags78-group-title"><span>${escapeHtml(title)}</span><span class="ags78-count">${entries.length}</span></div>
      <div class="ags78-list">${visible.map(renderer).join('')}</div>
    </section>`;
  }

  function renderResults(catalog, query) {
    if (!resultsBox || !statusBox) return;
    const result = performSearch(catalog, query);
    if (!result.query) {
      statusBox.textContent = 'Pesquise por produto, código, marca, departamento, seção ou categoria.';
      resultsBox.innerHTML = '<div class="ags78-empty">Digite o que deseja localizar no catálogo.</div>';
      return;
    }
    statusBox.textContent = `${result.total} resultado(s) para “${query}”`;
    if (!result.total) {
      resultsBox.innerHTML = `<div class="ags78-empty">Nenhum resultado encontrado para <strong>${escapeHtml(query)}</strong>.<br>Tente parte do nome, marca, departamento ou o código do produto.</div>`;
      return;
    }
    resultsBox.innerHTML = [
      groupHtml('Produtos', result.products, productHtml),
      groupHtml('Marcas', result.brands, (entry) => entityHtml('brand', entry)),
      groupHtml('Departamentos', result.departments, (entry) => entityHtml('department', entry)),
      groupHtml('Seções', result.sections, (entry) => entityHtml('section', entry)),
      groupHtml('Categorias', result.categories, (entry) => entityHtml('category', entry)),
    ].join('');
  }

  function ensureModal() {
    if (modal) return modal;
    addStyles();
    modal = document.createElement('div');
    modal.id = 'asteryon-global-search-v78';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Consulta geral do catálogo');
    modal.innerHTML = `
      <div class="ags78-dialog" role="document">
        <div class="ags78-head">
          <div class="ags78-title-row">
            <div>
              <div class="ags78-title">Consulta geral do catálogo</div>
              <div class="ags78-subtitle">Produtos, códigos, marcas, departamentos, seções e categorias</div>
            </div>
            <button type="button" class="ags78-close" aria-label="Fechar consulta">×</button>
          </div>
          <div class="ags78-search-row">
            <input class="ags78-input" type="search" autocomplete="off" placeholder="Digite produto, código, marca ou departamento" />
            <button type="button" class="ags78-search-button">Buscar</button>
          </div>
        </div>
        <div class="ags78-status" aria-live="polite"></div>
        <div class="ags78-results"></div>
      </div>`;
    document.body.appendChild(modal);
    modalInput = modal.querySelector('.ags78-input');
    resultsBox = modal.querySelector('.ags78-results');
    statusBox = modal.querySelector('.ags78-status');

    modal.querySelector('.ags78-close')?.addEventListener('click', closeSearch);
    modal.querySelector('.ags78-search-button')?.addEventListener('click', () => runSearch(modalInput?.value || ''));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeSearch();
    });
    modalInput?.addEventListener('input', () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => runSearch(modalInput?.value || ''), 120);
    });
    modalInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch(modalInput?.value || '');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal?.dataset.open === 'true') closeSearch();
    });
    return modal;
  }

  function closeSearch() {
    if (!modal) return;
    modal.dataset.open = 'false';
    document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow');
    if (sourceInput && document.contains(sourceInput)) sourceInput.focus({ preventScroll: true });
  }

  async function runSearch(query) {
    ensureModal();
    if (statusBox) statusBox.textContent = 'Consultando catálogo…';
    if (resultsBox) resultsBox.innerHTML = '<div class="ags78-empty">Carregando resultados…</div>';
    try {
      const catalog = await loadCatalog();
      renderResults(catalog, query);
    } catch (error) {
      if (statusBox) statusBox.textContent = 'Não foi possível concluir a consulta.';
      if (resultsBox) resultsBox.innerHTML = `<div class="ags78-error">${escapeHtml(error?.message || 'Erro ao consultar catálogo.')} <button type="button" id="ags78-retry">Tentar novamente</button></div>`;
      document.getElementById('ags78-retry')?.addEventListener('click', async () => {
        try { await loadCatalog(true); runSearch(query); } catch { /* runSearch mostra o erro */ }
      }, { once: true });
    }
  }

  function openSearch(initialQuery = '', input = null) {
    if (location.pathname.startsWith('/admin')) return;
    ensureModal();
    sourceInput = input || sourceInput;
    modal.dataset.open = 'true';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (modalInput) {
      modalInput.value = String(initialQuery || '');
      requestAnimationFrame(() => {
        modalInput.focus();
        modalInput.select();
      });
    }
    runSearch(initialQuery || '');
  }

  function isSearchInput(input) {
    if (!(input instanceof HTMLInputElement)) return false;
    if (input.type === 'search') return true;
    const hint = normalize(`${input.placeholder || ''} ${input.getAttribute('aria-label') || ''} ${input.name || ''}`);
    if (hint.includes('email') || hint.includes('e-mail')) return false;
    return ['busc', 'pesquis', 'consult', 'produto', 'marca', 'codigo'].some((term) => hint.includes(term));
  }

  function searchInputs() {
    return [...document.querySelectorAll('input')].filter(isSearchInput).filter((input) => !modal?.contains(input));
  }

  function distanceBetween(elementA, elementB) {
    const a = elementA.getBoundingClientRect();
    const b = elementB.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    return Math.hypot(ax - bx, ay - by);
  }

  function nearestSearchInput(button) {
    const inputs = searchInputs();
    let best = null;
    let bestDistance = Infinity;
    for (const input of inputs) {
      const distance = distanceBetween(button, input);
      if (distance < bestDistance) {
        best = input;
        bestDistance = distance;
      }
    }
    return { input: best, distance: bestDistance };
  }

  document.addEventListener('click', (event) => {
    if (location.pathname.startsWith('/admin')) return;
    const target = event.target instanceof Element ? event.target.closest('button,[role="button"],a') : null;
    if (!target || modal?.contains(target)) return;
    const label = normalize(target.textContent).replace(/[→›»]+$/g, '').trim();
    if (!SEARCH_BUTTON_LABELS.has(label)) return;
    const nearest = nearestSearchInput(target);
    const needsNearbyInput = label === 'consulta' || label === 'consultar';
    if (!nearest.input || (needsNearbyInput && nearest.distance > 650)) return;
    if (nearest.distance > 900) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openSearch(nearest.input.value || '', nearest.input);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (location.pathname.startsWith('/admin')) return;
    const input = event.target;
    if (event.key !== 'Enter' || !isSearchInput(input) || modal?.contains(input)) return;
    event.preventDefault();
    event.stopPropagation();
    openSearch(input.value || '', input);
  }, true);

  window.AsteryonPublicSearch = {
    open: (query = '') => openSearch(query),
    refresh: () => loadCatalog(true),
    version: '78',
  };
})();
