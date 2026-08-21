(() => {
  'use strict';

  if (window.__ASTERYON_PUBLIC_ENTITY_POPUPS_V81__) return;
  window.__ASTERYON_PUBLIC_ENTITY_POPUPS_V81__ = true;

  const API_URL = '/api/public/catalog';
  const ROOT_ID = 'asteryon-entity-popup-v81';
  let catalogPromise = null;
  let root = null;
  let dialog = null;
  let previousOverflow = '';
  let currentType = '';
  let currentId = '';

  const text = (value) => String(value ?? '').trim();
  const normalize = (value) => text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const escapeHtml = (value) => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

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

  function getIndexes(catalog) {
    const products = Array.isArray(catalog?.products) ? catalog.products : [];
    const brands = Array.isArray(catalog?.brands) ? catalog.brands : [];
    const hierarchy = Array.isArray(catalog?.hierarchy) ? catalog.hierarchy : [];
    const brandById = new Map(brands.map((item) => [text(item.id), item]));
    const hierarchyById = new Map(hierarchy.map((item) => [text(item.id), item]));
    return { products, brands, hierarchy, brandById, hierarchyById };
  }

  function productImage(product) {
    const gallery = Array.isArray(product?.gallery) ? product.gallery : [];
    return text(product?.image || product?.imageUrl || product?.image_url || gallery[0]?.url || gallery[0]);
  }

  function brandLogo(brand) {
    return text(brand?.logo || brand?.logoUrl || brand?.logo_url || brand?.image || brand?.imageUrl);
  }

  function productTitle(product) {
    return text(product?.shortDescription || product?.short_description || product?.name || product?.description || `Produto ${product?.code || ''}`);
  }

  function productCode(product) {
    return text(product?.code || product?.codigo);
  }

  function productPrice(product) {
    const mode = normalize(product?.priceMode || product?.price_mode);
    if (mode === 'oculto') return '';
    if (mode === 'consulte') return 'Consulte';
    if (mode === 'sob_consulta') return 'Sob consulta';
    if (mode === 'loja') return 'Disponível na loja';
    const raw = product?.promoPrice ?? product?.promo_price ?? product?.price;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0
      ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '';
  }

  function hierarchyName(indexes, product, kind) {
    const aliases = kind === 'department'
      ? ['departamentoId', 'departmentId', 'departamento_id', 'department_id']
      : kind === 'section'
        ? ['secaoId', 'sectionId', 'secao_id', 'section_id']
        : ['categoriaId', 'categoryId', 'categoria_id', 'category_id'];
    let id = '';
    for (const key of aliases) {
      if (product?.[key] != null) { id = text(product[key]); break; }
    }
    return text(indexes.hierarchyById.get(id)?.name);
  }

  function addStyles() {
    if (document.getElementById(`${ROOT_ID}-style`)) return;
    const style = document.createElement('style');
    style.id = `${ROOT_ID}-style`;
    style.textContent = `
      #${ROOT_ID}{position:fixed;inset:0;z-index:2147483600;display:none;place-items:center;padding:clamp(10px,3vw,28px);background:rgba(0,0,0,.76);backdrop-filter:blur(7px);font-family:Inter,system-ui,sans-serif}
      #${ROOT_ID}[data-open="true"]{display:grid}
      #${ROOT_ID} *{box-sizing:border-box}
      .aep81-dialog{width:min(1040px,100%);max-height:min(92vh,940px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #30343b;border-radius:18px;background:#17191d;color:#f8fafc;box-shadow:0 35px 120px rgba(0,0,0,.65)}
      .aep81-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #2a2d33;background:#111317}
      .aep81-kicker{font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#7c8cff}
      .aep81-head-title{margin-top:2px;font-size:13px;font-weight:850;color:#f8fafc}
      .aep81-close{display:grid;place-items:center;width:34px;height:34px;border:1px solid #343841;border-radius:9px;background:#1b1e23;color:#d1d5db;font-size:20px;cursor:pointer}
      .aep81-close:hover{background:#262a31;color:#fff}
      .aep81-body{min-height:160px;overflow:auto;padding:18px}
      .aep81-loading,.aep81-empty{display:grid;min-height:220px;place-items:center;text-align:center;color:#8b93a1;font-size:13px}
      .aep81-error{margin:20px;padding:14px;border:1px solid #7f1d1d;border-radius:12px;background:#2b1618;color:#fecaca;font-size:12px}
      .aep81-brand-hero{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:center;gap:18px;margin-bottom:20px;padding:16px;border:1px solid #2c3037;border-radius:15px;background:#121418}
      .aep81-brand-logo{display:grid;height:90px;place-items:center;overflow:hidden;border:1px solid #30343b;border-radius:12px;background:#fff}
      .aep81-brand-logo img{max-width:88%;max-height:76px;object-fit:contain}
      .aep81-brand-logo span{font-size:10px;color:#64748b}
      .aep81-brand-name{font-size:clamp(22px,4vw,34px);font-weight:900;letter-spacing:-.035em}
      .aep81-description{margin-top:7px;max-width:740px;color:#9ca3af;font-size:12px;line-height:1.55}
      .aep81-count{margin-top:8px;font-size:10px;font-weight:800;color:#687184;text-transform:uppercase;letter-spacing:.08em}
      .aep81-section-title{margin:4px 0 10px;font-size:13px;font-weight:850;color:#e5e7eb}
      .aep81-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px}
      .aep81-product-card{min-width:0;padding:0;overflow:hidden;border:1px solid #2d3138;border-radius:12px;background:#111317;color:inherit;text-align:left;cursor:pointer;transition:.14s ease}
      .aep81-product-card:hover{transform:translateY(-2px);border-color:#5668df;background:#171b24}
      .aep81-product-image{display:grid;height:145px;place-items:center;overflow:hidden;background:#fff}
      .aep81-product-image img{width:100%;height:100%;object-fit:contain;padding:8px}
      .aep81-no-image{font-size:10px;color:#94a3b8;text-transform:uppercase}
      .aep81-product-info{padding:9px}
      .aep81-product-code{font-size:8px;font-weight:850;color:#7181f4;text-transform:uppercase}
      .aep81-product-title{margin-top:4px;display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:30px;font-size:10px;font-weight:800;line-height:1.45;color:#f3f4f6}
      .aep81-product-meta{margin-top:5px;font-size:8px;color:#777f8c}
      .aep81-product-price{margin-top:6px;font-size:11px;font-weight:900;color:#e5e7eb}
      .aep81-product-view{display:grid;grid-template-columns:minmax(260px,40%) minmax(0,1fr);gap:20px}
      .aep81-main-image{display:grid;min-height:330px;place-items:center;overflow:hidden;border-radius:14px;background:#fff}
      .aep81-main-image img{width:100%;height:100%;max-height:440px;object-fit:contain;padding:18px}
      .aep81-main-image .aep81-no-image{font-size:12px}
      .aep81-product-heading{font-size:clamp(19px,3vw,30px);font-weight:900;letter-spacing:-.03em;line-height:1.15}
      .aep81-brand-button{margin-top:10px;padding:0;border:0;background:transparent;color:#8ea0ff;font-size:11px;font-weight:850;cursor:pointer;text-align:left}
      .aep81-brand-button:hover{text-decoration:underline}
      .aep81-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:16px}
      .aep81-detail{min-width:0;padding:9px 10px;border:1px solid #2b2f36;border-radius:9px;background:#111317}
      .aep81-detail-label{font-size:8px;font-weight:800;color:#737b88;text-transform:uppercase;letter-spacing:.07em}
      .aep81-detail-value{margin-top:3px;overflow-wrap:anywhere;font-size:10px;font-weight:750;color:#e5e7eb}
      .aep81-price-big{margin-top:16px;font-size:22px;font-weight:900;color:#fff}
      .aep81-similar{margin-top:22px;padding-top:17px;border-top:1px solid #2a2e35}
      @media(max-width:720px){
        #${ROOT_ID}{padding:7px}
        .aep81-dialog{max-height:96vh;border-radius:14px}
        .aep81-body{padding:12px}
        .aep81-brand-hero{grid-template-columns:78px minmax(0,1fr);gap:12px;padding:12px}
        .aep81-brand-logo{height:68px}
        .aep81-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
        .aep81-product-image{height:125px}
        .aep81-product-view{grid-template-columns:1fr}
        .aep81-main-image{min-height:230px;max-height:310px}
        .aep81-detail-grid{grid-template-columns:1fr 1fr}
      }
      @media(max-width:410px){.aep81-detail-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    if (root) return root;
    addStyles();
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
      <div class="aep81-dialog" role="document">
        <div class="aep81-head">
          <div><div class="aep81-kicker">Catálogo</div><div class="aep81-head-title">Detalhes</div></div>
          <button type="button" class="aep81-close" aria-label="Fechar popup">×</button>
        </div>
        <div class="aep81-body"></div>
      </div>`;
    document.body.appendChild(root);
    dialog = root.querySelector('.aep81-dialog');
    root.querySelector('.aep81-close')?.addEventListener('click', close);
    root.addEventListener('click', (event) => {
      if (event.target === root) close();
    });
    root.addEventListener('click', (event) => {
      const productButton = event.target instanceof Element ? event.target.closest('[data-aep81-product]') : null;
      if (productButton) {
        event.preventDefault();
        event.stopPropagation();
        openProduct(productButton.getAttribute('data-aep81-product') || '');
        return;
      }
      const brandButton = event.target instanceof Element ? event.target.closest('[data-aep81-brand]') : null;
      if (brandButton) {
        event.preventDefault();
        event.stopPropagation();
        openBrand(brandButton.getAttribute('data-aep81-brand') || '');
      }
    });
    return root;
  }

  function setOpen(open) {
    ensureRoot();
    if (open) {
      previousOverflow = document.body.style.overflow || '';
      root.dataset.open = 'true';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      root.dataset.open = 'false';
      document.documentElement.style.removeProperty('overflow');
      document.body.style.overflow = previousOverflow;
      previousOverflow = '';
      currentType = '';
      currentId = '';
    }
  }

  function close() {
    if (!root) return;
    setOpen(false);
  }

  function renderLoading(title) {
    ensureRoot();
    root.querySelector('.aep81-head-title').textContent = title;
    root.querySelector('.aep81-body').innerHTML = '<div class="aep81-loading">Carregando informações…</div>';
    setOpen(true);
  }

  function productCard(product, brand) {
    const image = productImage(product);
    const price = productPrice(product);
    const code = productCode(product);
    return `<button type="button" class="aep81-product-card" data-aep81-product="${escapeHtml(product.id || code)}">
      <div class="aep81-product-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(productTitle(product))}" loading="lazy" />` : '<span class="aep81-no-image">Sem imagem</span>'}</div>
      <div class="aep81-product-info">
        ${code ? `<div class="aep81-product-code">Código ${escapeHtml(code)}</div>` : ''}
        <div class="aep81-product-title">${escapeHtml(productTitle(product))}</div>
        <div class="aep81-product-meta">${escapeHtml(brand?.name || '')}</div>
        ${price ? `<div class="aep81-product-price">${escapeHtml(price)}</div>` : ''}
      </div>
    </button>`;
  }

  function findBrand(indexes, key) {
    const wanted = normalize(decodeURIComponent(text(key)));
    return indexes.brands.find((brand) =>
      normalize(brand.id) === wanted || normalize(brand.slug) === wanted || normalize(brand.name) === wanted
    ) || null;
  }

  function findProduct(indexes, key) {
    const wanted = normalize(decodeURIComponent(text(key)));
    return indexes.products.find((product) =>
      normalize(product.id) === wanted || normalize(product.code) === wanted || normalize(product.codigo) === wanted
    ) || null;
  }

  async function openBrand(key) {
    if (location.pathname.startsWith('/admin')) return;
    const requestId = text(key);
    currentType = 'brand';
    currentId = requestId;
    renderLoading('Marca');
    try {
      const catalog = await loadCatalog();
      if (currentType !== 'brand' || currentId !== requestId) return;
      const indexes = getIndexes(catalog);
      const brand = findBrand(indexes, requestId);
      if (!brand) throw new Error('Marca não encontrada no catálogo.');
      const products = indexes.products.filter((product) => text(product.brandId ?? product.brand_id) === text(brand.id));
      const logo = brandLogo(brand);
      root.querySelector('.aep81-head-title').textContent = brand.name || 'Marca';
      root.querySelector('.aep81-body').innerHTML = `
        <section class="aep81-brand-hero">
          <div class="aep81-brand-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.name || 'Marca')}" />` : '<span>Sem logo</span>'}</div>
          <div>
            <div class="aep81-kicker">Marca</div>
            <div class="aep81-brand-name">${escapeHtml(brand.name || '')}</div>
            ${brand.description ? `<div class="aep81-description">${escapeHtml(brand.description)}</div>` : ''}
            <div class="aep81-count">${products.length} produto(s)</div>
          </div>
        </section>
        <div class="aep81-section-title">Produtos ${escapeHtml(brand.name || '')}</div>
        ${products.length ? `<div class="aep81-grid">${products.map((product) => productCard(product, brand)).join('')}</div>` : '<div class="aep81-empty">Nenhum produto cadastrado para esta marca.</div>'}
      `;
      root.querySelector('.aep81-body').scrollTop = 0;
    } catch (error) {
      root.querySelector('.aep81-body').innerHTML = `<div class="aep81-error">${escapeHtml(error?.message || 'Erro ao abrir marca.')}</div>`;
    }
  }

  function detail(label, value) {
    if (!text(value)) return '';
    return `<div class="aep81-detail"><div class="aep81-detail-label">${escapeHtml(label)}</div><div class="aep81-detail-value">${escapeHtml(value)}</div></div>`;
  }

  async function openProduct(key) {
    if (location.pathname.startsWith('/admin')) return;
    const requestId = text(key);
    currentType = 'product';
    currentId = requestId;
    renderLoading('Produto');
    try {
      const catalog = await loadCatalog();
      if (currentType !== 'product' || currentId !== requestId) return;
      const indexes = getIndexes(catalog);
      const product = findProduct(indexes, requestId);
      if (!product) throw new Error('Produto não encontrado no catálogo.');
      const brand = indexes.brandById.get(text(product.brandId ?? product.brand_id));
      const image = productImage(product);
      const price = productPrice(product);
      const code = productCode(product);
      const department = hierarchyName(indexes, product, 'department');
      const section = hierarchyName(indexes, product, 'section');
      const category = hierarchyName(indexes, product, 'category');
      const similar = indexes.products.filter((item) => item.id !== product.id && text(item.brandId ?? item.brand_id) === text(product.brandId ?? product.brand_id)).slice(0, 10);
      root.querySelector('.aep81-head-title').textContent = productTitle(product);
      root.querySelector('.aep81-body').innerHTML = `
        <section class="aep81-product-view">
          <div class="aep81-main-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(productTitle(product))}" />` : '<span class="aep81-no-image">Produto sem imagem</span>'}</div>
          <div>
            <div class="aep81-kicker">Produto</div>
            <div class="aep81-product-heading">${escapeHtml(productTitle(product))}</div>
            ${brand ? `<button type="button" class="aep81-brand-button" data-aep81-brand="${escapeHtml(brand.id)}">${escapeHtml(brand.name)} →</button>` : ''}
            ${price ? `<div class="aep81-price-big">${escapeHtml(price)}</div>` : ''}
            <div class="aep81-detail-grid">
              ${detail('Código', code)}
              ${detail('EAN / GTIN', product.ean || product.gtin)}
              ${detail('Embalagem', product.packaging || product.embalagem)}
              ${detail('Unidade', product.unit || product.unidade)}
              ${detail('Departamento', department)}
              ${detail('Seção', section)}
              ${detail('Categoria', category)}
              ${detail('NCM', product.ncm)}
            </div>
            ${product.longDescription || product.long_description ? `<div class="aep81-description">${escapeHtml(product.longDescription || product.long_description)}</div>` : ''}
          </div>
        </section>
        ${similar.length ? `<section class="aep81-similar"><div class="aep81-section-title">Produtos similares da marca</div><div class="aep81-grid">${similar.map((item) => productCard(item, brand)).join('')}</div></section>` : ''}
      `;
      root.querySelector('.aep81-body').scrollTop = 0;
    } catch (error) {
      root.querySelector('.aep81-body').innerHTML = `<div class="aep81-error">${escapeHtml(error?.message || 'Erro ao abrir produto.')}</div>`;
    }
  }

  function parseEntityLink(link) {
    if (!(link instanceof HTMLAnchorElement)) return null;
    let url;
    try { url = new URL(link.href, location.href); } catch { return null; }
    if (url.origin !== location.origin) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    if (parts[0] === 'marca') return { type: 'brand', key: parts.slice(1).join('/') };
    if (parts[0] === 'produto') return { type: 'product', key: parts.slice(1).join('/') };
    return null;
  }

  document.addEventListener('click', (event) => {
    if (location.pathname.startsWith('/admin')) return;
    if (root?.contains(event.target)) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    const entity = parseEntityLink(link);
    if (!entity) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (entity.type === 'brand') openBrand(entity.key);
    else openProduct(entity.key);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || root?.dataset.open !== 'true') return;
    event.preventDefault();
    close();
  });

  window.addEventListener('asteryon:brand-open', (event) => openBrand(event?.detail?.brandId || event?.detail?.id || event?.detail || ''));
  window.addEventListener('asteryon:public-product-popup', (event) => openProduct(event?.detail?.productId || event?.detail?.id || event?.detail || ''));

  window.AsteryonEntityPopups = {
    openBrand,
    openProduct,
    close,
    refresh: () => loadCatalog(true),
    version: '81',
  };
})();
