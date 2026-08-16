(() => {
  'use strict';

  const PREVIEW_ID = 'laurencini-template-preview-v69';
  const LOGO = '/laurencini-logo-v69.svg';
  const CATALOG_URL = '/api/public/catalog';
  const BRAND_NAME = 'Distribuidora Laurencini';
  const SEGMENTS = ['Supermercados', 'Padarias e Conveniências', 'Food Service', 'Farmácias', 'Uso Corporativo', 'Hotelaria'];
  const TEMPLATE_NAMES = [
    'Varejo Contínuo',
    'Atacado B2B',
    'Distribuidora Institucional',
    'Catálogo de Marcas B2B',
    'Distribuidora União • Figma B2B',
    'Catálogo Hierárquico B2B',
    'Vitrine Atacado Pro',
    'Modelo Oficial',
  ];

  let catalogPromise = null;
  let activeArticle = null;
  let activeTemplate = '';
  let observerScheduled = false;

  const clean = (value) => String(value ?? '').trim();
  const escapeHtml = (value) => clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const normalize = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const uniq = (values) => [...new Set(values.filter(Boolean))];

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

  function descriptionFor(name) {
    const variant = variantFor(name);
    const descriptions = {
      varejo: 'Página longa de catálogo institucional com busca, segmentos, produtos, departamentos, marcas e apresentação da empresa.',
      atacado: 'Estrutura B2B com navegação por departamentos, segmentos atendidos, vitrines reais do catálogo e presença institucional.',
      institucional: 'Apresentação corporativa com identidade forte, números do catálogo, portfólio, marcas, estrutura e contato.',
      marcas: 'Modelo centrado nas indústrias e marcas do banco, com portfólio real e navegação institucional por catálogo.',
      uniao: 'Estrutura editorial B2B com hierarquia Departamento → Seção → Categoria e produtos reais do Supabase.',
      hierarquico: 'Visão organizada da hierarquia real do catálogo, seguida por produtos e marcas vinculados ao banco.',
      vitrine: 'Vitrine institucional de alto impacto com produtos reais, departamentos e marcas, sem fluxo comercial de venda.',
    };
    return descriptions[variant] || descriptions.varejo;
  }

  async function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(CATALOG_URL, { credentials: 'same-origin', cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Catálogo indisponível (${response.status})`);
          const payload = await response.json();
          if (!payload?.ok || !payload?.catalog) throw new Error('Resposta pública do catálogo inválida');
          return payload.catalog;
        })
        .catch((error) => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  }

  function productBrand(product, brandMap) {
    return clean(product.brandName || product.attributes?.Marca || brandMap.get(product.brandId)?.name || brandMap.get(product.brand_id)?.name || 'Marca');
  }

  function productDepartment(product) {
    return clean(product.departamentoName || product.attributes?.['Descrição do departamento'] || 'Catálogo');
  }

  function productSection(product) {
    return clean(product.secaoName || product.attributes?.['Descrição da seção'] || 'Portfólio');
  }

  function productCategory(product) {
    return clean(product.categoriaName || product.attributes?.['Nome da categoria'] || 'Produtos');
  }

  function selectProducts(catalog, limit = 15) {
    const products = Array.isArray(catalog.products) ? catalog.products : [];
    const withImages = products.filter((item) => clean(item.image || item.image_url));
    const source = withImages.length >= limit ? withImages : products;
    const selected = [];
    const brands = new Set();
    for (const product of source) {
      const key = clean(product.brandId || product.brand_id || product.brandName);
      if (key && brands.has(key) && selected.length < Math.ceil(limit * .7)) continue;
      selected.push(product);
      if (key) brands.add(key);
      if (selected.length >= limit) break;
    }
    if (selected.length < limit) {
      for (const product of source) {
        if (!selected.includes(product)) selected.push(product);
        if (selected.length >= limit) break;
      }
    }
    return selected;
  }

  function productCards(products, catalog, max = 15) {
    const brandMap = new Map((catalog.brands || []).map((brand) => [clean(brand.id), brand]));
    return products.slice(0, max).map((product) => {
      const name = clean(product.shortDescription || product.short_description || product.name || 'Produto');
      const image = clean(product.image || product.image_url);
      const brand = productBrand(product, brandMap);
      const code = clean(product.code || product.codigo);
      const pack = clean(product.packaging || product.attributes?.Embalagem || product.unit);
      const initials = name.split(/\s+/).slice(0, 2).map((word) => word[0] || '').join('').toUpperCase();
      return `<article class="ltp-product" data-ltp-product-id="${escapeHtml(product.id)}">
        <div class="ltp-product-media">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy">` : `<div class="ltp-product-fallback">${escapeHtml(initials || 'P')}</div>`}</div>
        <div class="ltp-product-body">
          <div class="ltp-product-brand">${escapeHtml(brand)}</div>
          <h3>${escapeHtml(name)}</h3>
          <div class="ltp-product-meta">${code ? `<span>Cód. ${escapeHtml(code)}</span>` : ''}${pack ? `<span>${escapeHtml(pack)}</span>` : ''}</div>
          <div class="ltp-product-info" title="Na página publicada, a abertura do produto continua usando a regra atual do sistema.">Informações do produto</div>
        </div>
      </article>`;
    }).join('');
  }

  function brandCards(catalog, max = 24) {
    const brands = (catalog.brands || []).filter((brand) => clean(brand.name)).slice(0, max);
    if (!brands.length) return '<div class="ltp-empty">Nenhuma marca ativa encontrada.</div>';
    return brands.map((brand) => {
      const logo = clean(brand.logoUrl || brand.logo_url || brand.logo || brand.image);
      return `<div class="ltp-brand">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.name)}" loading="lazy">` : `<div><strong>${escapeHtml(brand.name)}</strong><small>Marca do catálogo</small></div>`}</div>`;
    }).join('');
  }

  function departmentCards(catalog, max = 12) {
    const nodes = (catalog.hierarchy || []).filter((item) => item.level === 'departamento' && item.status !== 'inactive');
    const productCounts = new Map();
    for (const product of catalog.products || []) {
      const name = productDepartment(product);
      productCounts.set(normalize(name), (productCounts.get(normalize(name)) || 0) + 1);
    }
    if (!nodes.length) {
      const names = uniq((catalog.products || []).map(productDepartment)).slice(0, max);
      return names.map((name) => `<div class="ltp-department"><strong>${escapeHtml(name)}</strong><span>${productCounts.get(normalize(name)) || 0} produtos vinculados</span></div>`).join('');
    }
    return nodes.slice(0, max).map((node) => `<div class="ltp-department"><strong>${escapeHtml(node.name)}</strong><span>${productCounts.get(normalize(node.name)) || 0} produtos vinculados</span></div>`).join('');
  }

  function hierarchyColumns(catalog) {
    const hierarchy = catalog.hierarchy || [];
    const groups = [
      ['Departamentos', hierarchy.filter((item) => item.level === 'departamento')],
      ['Seções', hierarchy.filter((item) => item.level === 'secao')],
      ['Categorias', hierarchy.filter((item) => item.level === 'categoria')],
    ];
    return groups.map(([title, items]) => `<div class="ltp-hierarchy-col"><h3>${title}</h3><div class="ltp-hierarchy-list">${items.slice(0, 18).map((item) => `<span>${escapeHtml(item.name)}</span>`).join('') || '<span>Sem itens</span>'}</div></div>`).join('');
  }

  function segments() {
    return SEGMENTS.map((name, index) => `<div class="ltp-segment"><div class="ltp-segment-icon">${index + 1}</div><strong>${escapeHtml(name)}</strong><small>Navegação institucional</small></div>`).join('');
  }

  function stats(catalog) {
    const products = (catalog.products || []).length;
    const brands = (catalog.brands || []).length;
    const hierarchy = catalog.hierarchy || [];
    const departments = hierarchy.filter((item) => item.level === 'departamento').length || uniq((catalog.products || []).map(productDepartment)).length;
    const categories = hierarchy.filter((item) => item.level === 'categoria').length || uniq((catalog.products || []).map(productCategory)).length;
    return { products, brands, departments, categories };
  }

  function header(catalog) {
    const departments = (catalog.hierarchy || []).filter((item) => item.level === 'departamento').slice(0, 10);
    return `<header class="ltp-site-header">
      <div class="ltp-topline">Catálogo institucional • portfólio real do Supabase • Distribuidora Laurencini</div>
      <div class="ltp-mainnav">
        <img src="${LOGO}" alt="${BRAND_NAME}">
        <nav class="ltp-navlinks" aria-label="Navegação da prévia"><span>Início</span><span>Catálogo</span><span>Departamentos</span><span>Marcas</span><span>Quem somos</span><span>Contato</span></nav>
        <div class="ltp-navbadge">Catálogo B2B</div>
      </div>
      <div class="ltp-searchrow"><input type="search" data-ltp-search placeholder="Busque no banco por produto, código, marca ou categoria"><button type="button" data-ltp-search-button>Buscar</button></div>
      <div class="ltp-deptbar">${departments.map((item) => `<span>${escapeHtml(item.name)}</span>`).join('') || '<span>Departamentos do catálogo</span>'}</div>
    </header>`;
  }

  function hero(catalog, name) {
    const count = stats(catalog);
    return `<section class="ltp-hero">
      <div class="ltp-hero-copy">
        <div class="ltp-kicker">${escapeHtml(name)}</div>
        <h1>Um catálogo completo para apresentar a força da Laurencini.</h1>
        <p>${escapeHtml(descriptionFor(name))} Esta prévia é preenchida com os dados reais atualmente disponíveis no banco.</p>
        <div class="ltp-hero-actions"><span class="ltp-btn ltp-btn-primary">Explorar catálogo</span><span class="ltp-btn ltp-btn-secondary">Conhecer a empresa</span></div>
      </div>
      <div class="ltp-hero-visual"><div class="ltp-hero-card"><div class="ltp-hero-logo"><img src="${LOGO}" alt="${BRAND_NAME}"></div><div class="ltp-hero-stats"><div class="ltp-hero-stat"><strong>${count.products.toLocaleString('pt-BR')}</strong><span>Produtos</span></div><div class="ltp-hero-stat"><strong>${count.brands.toLocaleString('pt-BR')}</strong><span>Marcas</span></div><div class="ltp-hero-stat"><strong>${count.categories.toLocaleString('pt-BR')}</strong><span>Categorias</span></div></div></div></div>
    </section>`;
  }

  function section(title, eyebrow, body, content, options = {}) {
    const classes = ['ltp-section', options.alt ? 'alt' : '', options.dark ? 'dark' : '', options.red ? 'red' : ''].filter(Boolean).join(' ');
    return `<section class="${classes}"><div class="ltp-section-head"><div><div class="ltp-eyebrow">${escapeHtml(eyebrow)}</div><h2>${escapeHtml(title)}</h2>${body ? `<p>${escapeHtml(body)}</p>` : ''}</div>${options.count ? `<span class="ltp-count">${escapeHtml(options.count)}</span>` : ''}</div>${content}</section>`;
  }

  function productsSection(catalog, selected, alt = false) {
    return section('Produtos do catálogo', 'Portfólio real', 'Os cards abaixo usam descrições, imagens, marcas, códigos e embalagens do Supabase. Não há preço ou fluxo de venda nesta prévia.', `<div class="ltp-products" data-ltp-products-host>${productCards(selected, catalog)}</div>`, { alt, count: `${(catalog.products || []).length.toLocaleString('pt-BR')} produtos no banco` });
  }

  function departmentsSection(catalog, alt = false) {
    const count = stats(catalog);
    return section('Navegue por departamentos', 'Organização do catálogo', 'A estrutura usa a hierarquia real cadastrada e mantém a navegação focada em consulta institucional.', `<div class="ltp-departments">${departmentCards(catalog)}</div>`, { alt, count: `${count.departments} departamentos` });
  }

  function brandsSection(catalog, alt = false) {
    return section('Marcas do portfólio', 'Indústrias e parceiros', 'As marcas são carregadas do banco e apresentadas como parte central do catálogo institucional.', `<div class="ltp-brand-grid">${brandCards(catalog)}</div>`, { alt, count: `${(catalog.brands || []).length.toLocaleString('pt-BR')} marcas` });
  }

  function segmentsSection(alt = false) {
    return section('Atendimento para diferentes negócios', 'Segmentos', 'Uma navegação inspirada em distribuidores B2B, sem recursos de venda online.', `<div class="ltp-segments">${segments()}</div>`, { alt });
  }

  function hierarchySection(catalog, alt = false) {
    return section('Departamento → Seção → Categoria', 'Hierarquia real', 'A organização estrutural é montada diretamente a partir dos nós cadastrados no Supabase.', `<div class="ltp-hierarchy">${hierarchyColumns(catalog)}</div>`, { alt, count: `${(catalog.hierarchy || []).length} nós` });
  }

  function storySection() {
    return `<section class="ltp-section"><div class="ltp-story"><div class="ltp-story-art"><img src="${LOGO}" alt="${BRAND_NAME}"></div><div><div class="ltp-eyebrow">Quem somos</div><h2>Distribuição, portfólio e relacionamento em uma presença digital consistente.</h2><p>Este espaço institucional é estruturado para apresentar a Distribuidora Laurencini, sua operação, seus diferenciais e a forma como o catálogo organiza marcas e produtos. O conteúdo permanece totalmente editável depois que o modelo é aplicado.</p><div class="ltp-story-list"><div><strong>Catálogo centralizado</strong><span>Produtos, marcas e hierarquia em uma única base.</span></div><div><strong>Conteúdo institucional</strong><span>Áreas para história, estrutura, cobertura e diferenciais.</span></div><div><strong>Experiência responsiva</strong><span>Organização preparada para desktop, tablet e celular.</span></div><div><strong>Dados reais</strong><span>Prévia vinculada ao catálogo público do Supabase.</span></div></div></div></div></section>`;
  }

  function metricsSection(catalog) {
    const count = stats(catalog);
    return `<section class="ltp-section dark"><div class="ltp-metrics"><div class="ltp-metric"><strong>${count.products.toLocaleString('pt-BR')}</strong><span>Produtos cadastrados</span></div><div class="ltp-metric"><strong>${count.brands.toLocaleString('pt-BR')}</strong><span>Marcas</span></div><div class="ltp-metric"><strong>${count.departments}</strong><span>Departamentos</span></div><div class="ltp-metric"><strong>${count.categories}</strong><span>Categorias</span></div></div></section>`;
  }

  function contactSection() {
    return `<section class="ltp-section dark"><div class="ltp-section-head"><div><div class="ltp-eyebrow">Relacionamento</div><h2>Informações institucionais e contato em destaque.</h2><p>Estrutura final pronta para receber os canais oficiais da empresa.</p></div></div><div class="ltp-contact"><div class="ltp-contact-card"><h3>Fale com a Distribuidora Laurencini</h3><p>Na edição final, estes campos podem receber WhatsApp, telefone, e-mail, endereço, horário de atendimento e links institucionais.</p><div class="ltp-contact-lines"><div>Atendimento comercial</div><div>Representantes e regiões</div><div>Informações da empresa</div></div></div><div class="ltp-faq"><div><strong>Como localizar um produto?</strong><span>Use a busca e os filtros do catálogo já existentes no sistema.</span></div><div><strong>Como consultar os detalhes?</strong><span>A página publicada continuará abrindo o produto no modal atual do ASTERYON.</span></div><div><strong>Como navegar pelo catálogo?</strong><span>O comportamento atual de abertura do catálogo é preservado integralmente.</span></div></div></div></section>`;
  }

  function footer(catalog) {
    const departments = uniq((catalog.hierarchy || []).filter((item) => item.level === 'departamento').map((item) => item.name)).slice(0, 7);
    const brands = (catalog.brands || []).slice(0, 7).map((item) => item.name);
    return `<footer class="ltp-footer"><div class="ltp-footer-grid"><div><img src="${LOGO}" alt="${BRAND_NAME}"><p>Prévia institucional completa baseada no catálogo real. A identidade visual segue a paleta Laurencini e a estrutura privilegia portfólio, marcas, departamentos e apresentação corporativa.</p></div><div><h4>Departamentos</h4>${departments.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div><div><h4>Marcas</h4>${brands.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div></div><div class="ltp-footnote">Distribuidora Laurencini • Preview V69 • Dados públicos do catálogo Supabase</div></footer>`;
  }

  function bodyFor(catalog, name) {
    const variant = variantFor(name);
    const selected = selectProducts(catalog, variant === 'hierarquico' ? 12 : 15);
    const blocks = [];
    if (variant === 'institucional') {
      blocks.push(storySection(), metricsSection(catalog), departmentsSection(catalog, true), brandsSection(catalog), productsSection(catalog, selected, true));
    } else if (variant === 'marcas') {
      blocks.push(brandsSection(catalog), productsSection(catalog, selected, true), segmentsSection(), departmentsSection(catalog, true), storySection(), metricsSection(catalog));
    } else if (variant === 'hierarquico') {
      blocks.push(hierarchySection(catalog), departmentsSection(catalog, true), productsSection(catalog, selected), brandsSection(catalog, true), storySection());
    } else if (variant === 'uniao') {
      blocks.push(segmentsSection(), hierarchySection(catalog, true), productsSection(catalog, selected), storySection(), metricsSection(catalog), brandsSection(catalog, true));
    } else if (variant === 'vitrine') {
      blocks.push(productsSection(catalog, selected), departmentsSection(catalog, true), brandsSection(catalog), segmentsSection(true), storySection(), metricsSection(catalog));
    } else if (variant === 'atacado') {
      blocks.push(segmentsSection(), departmentsSection(catalog, true), productsSection(catalog, selected), brandsSection(catalog, true), hierarchySection(catalog), metricsSection(catalog), storySection());
    } else {
      blocks.push(segmentsSection(), productsSection(catalog, selected, true), departmentsSection(catalog), brandsSection(catalog, true), storySection(), metricsSection(catalog));
    }
    blocks.push(contactSection());
    return blocks.join('');
  }

  function shell(catalog, name) {
    const variant = variantFor(name);
    return `<div class="ltp-shell ltp-variant-${variant}" data-ltp-template="${escapeHtml(name)}">${header(catalog)}${hero(catalog, name)}${bodyFor(catalog, name)}${footer(catalog)}</div>`;
  }

  function showError(error) {
    const overlay = document.getElementById(PREVIEW_ID);
    if (!overlay) return;
    const host = overlay.querySelector('[data-ltp-content]');
    if (!host) return;
    host.innerHTML = `<div class="ltp-error"><h2>Não foi possível montar a prévia.</h2><p>${escapeHtml(error?.message || error)}</p><p>O modelo não foi alterado. Feche a prévia e tente novamente quando o catálogo público estiver disponível.</p></div>`;
  }

  function closePreview() {
    document.getElementById(PREVIEW_ID)?.remove();
    document.body.classList.remove('ltp-open');
    activeArticle = null;
    activeTemplate = '';
  }

  function applyCurrentTemplate() {
    const article = activeArticle;
    closePreview();
    if (!article || !document.contains(article)) return;
    const button = [...article.querySelectorAll('button')].find((item) => normalize(item.textContent).includes('aplicar modelo'));
    button?.click();
  }

  function setupSearch(catalog) {
    const overlay = document.getElementById(PREVIEW_ID);
    const input = overlay?.querySelector('[data-ltp-search]');
    const button = overlay?.querySelector('[data-ltp-search-button]');
    const host = overlay?.querySelector('[data-ltp-products-host]');
    if (!input || !host) return;
    const brandMap = new Map((catalog.brands || []).map((brand) => [clean(brand.id), brand]));
    const update = () => {
      const term = normalize(input.value);
      if (!term) {
        host.innerHTML = productCards(selectProducts(catalog, 15), catalog, 15);
        return;
      }
      const results = (catalog.products || []).filter((product) => {
        const searchable = [product.name, product.shortDescription, product.code, productBrand(product, brandMap), productDepartment(product), productSection(product), productCategory(product)].map(normalize).join(' ');
        return searchable.includes(term);
      }).slice(0, 30);
      host.innerHTML = results.length ? productCards(results, catalog, 30) : '<div class="ltp-empty" style="grid-column:1/-1">Nenhum produto encontrado para esta busca.</div>';
    };
    input.addEventListener('input', update);
    button?.addEventListener('click', update);
  }

  async function openPreview(name, article) {
    closePreview();
    activeArticle = article;
    activeTemplate = name;
    document.body.classList.add('ltp-open');
    const overlay = document.createElement('div');
    overlay.id = PREVIEW_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Pré-visualização do modelo ${name}`);
    overlay.innerHTML = `<div class="ltp-toolbar"><img class="ltp-toolbar-logo" src="${LOGO}" alt="${BRAND_NAME}"><div class="ltp-toolbar-copy"><strong>${escapeHtml(name)}</strong><span>Preview final preenchido com os dados reais do catálogo</span></div><div class="ltp-toolbar-actions"><button type="button" class="ltp-apply" data-ltp-apply>Aplicar este modelo</button><button type="button" class="ltp-close" data-ltp-close>Fechar</button></div></div><div data-ltp-content><div class="ltp-loading">Montando preview com produtos, marcas e hierarquia do Supabase…</div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-ltp-close]')?.addEventListener('click', closePreview);
    overlay.querySelector('[data-ltp-apply]')?.addEventListener('click', applyCurrentTemplate);
    try {
      const catalog = await loadCatalog();
      if (!document.getElementById(PREVIEW_ID) || activeTemplate !== name) return;
      const host = overlay.querySelector('[data-ltp-content]');
      host.innerHTML = shell(catalog, name);
      setupSearch(catalog);
      overlay.scrollTop = 0;
    } catch (error) {
      showError(error);
    }
  }

  function findTemplateRoot() {
    const title = [...document.querySelectorAll('h3')].find((item) => normalize(item.textContent) === 'modelos prontos');
    if (!title) return null;
    let root = title.parentElement;
    while (root && root !== document.body) {
      if (root.querySelectorAll('article').length) return root;
      root = root.parentElement;
    }
    return null;
  }

  function attachPreviewButtons() {
    const root = findTemplateRoot();
    if (!root) return;
    for (const article of root.querySelectorAll('article')) {
      if (article.querySelector('[data-laurencini-template-preview]')) continue;
      const heading = article.querySelector('h4');
      const name = clean(heading?.textContent);
      if (!name) continue;
      const apply = [...article.querySelectorAll('button')].find((item) => normalize(item.textContent).includes('aplicar modelo'));
      if (!apply) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.laurenciniTemplatePreview = 'v69';
      button.textContent = 'Pré-visualizar modelo completo';
      button.title = `Abrir preview final de ${name}`;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void openPreview(name, article);
      });
      apply.insertAdjacentElement('afterend', button);
    }
  }

  function scheduleAttach() {
    if (observerScheduled) return;
    observerScheduled = true;
    requestAnimationFrame(() => {
      observerScheduled = false;
      attachPreviewButtons();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById(PREVIEW_ID)) closePreview();
  });

  const observer = new MutationObserver(scheduleAttach);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleAttach, { once: true });
  else scheduleAttach();

  window.addEventListener('asteryon:viewport-change', scheduleAttach);
  window.dispatchEvent(new CustomEvent('asteryon:template-preview-v69-ready', { detail: { templates: TEMPLATE_NAMES, catalogUrl: CATALOG_URL } }));
})();
