(() => {
  'use strict';

  if (window.__ASTERYON_SYSTEM_RUNTIME_V80__) return;
  window.__ASTERYON_SYSTEM_RUNTIME_V80__ = true;

  const HIDDEN = 'data-asteryon-v80-hidden';
  const STYLE_MARK = 'data-asteryon-v80-layout';

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };

  const hide = (element) => {
    if (!(element instanceof HTMLElement) || element.hasAttribute(HIDDEN)) return;
    element.setAttribute(HIDDEN, '1');
    element.dataset.asteryonV80Display = element.style.display || '';
    element.style.setProperty('display', 'none', 'important');
  };

  const restoreHidden = () => {
    document.querySelectorAll(`[${HIDDEN}="1"]`).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const previous = element.dataset.asteryonV80Display || '';
      element.style.removeProperty('display');
      if (previous) element.style.display = previous;
      delete element.dataset.asteryonV80Display;
      element.removeAttribute(HIDDEN);
    });
  };

  const rememberLayout = (element) => {
    if (!(element instanceof HTMLElement) || element.hasAttribute(STYLE_MARK)) return;
    element.setAttribute(STYLE_MARK, '1');
    element.dataset.asteryonV80Flex = element.style.flex || '';
    element.dataset.asteryonV80MinHeight = element.style.minHeight || '';
    element.dataset.asteryonV80Overflow = element.style.overflow || '';
    element.dataset.asteryonV80Height = element.style.height || '';
  };

  const restoreLayout = () => {
    document.querySelectorAll(`[${STYLE_MARK}="1"]`).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.style.flex = element.dataset.asteryonV80Flex || '';
      element.style.minHeight = element.dataset.asteryonV80MinHeight || '';
      element.style.overflow = element.dataset.asteryonV80Overflow || '';
      element.style.height = element.dataset.asteryonV80Height || '';
      delete element.dataset.asteryonV80Flex;
      delete element.dataset.asteryonV80MinHeight;
      delete element.dataset.asteryonV80Overflow;
      delete element.dataset.asteryonV80Height;
      element.removeAttribute(STYLE_MARK);
    });
  };

  const restore = () => {
    restoreHidden();
    restoreLayout();
  };

  const exactButton = (root, text) => {
    const wanted = normalize(text);
    return [...root.querySelectorAll('button')]
      .find((button) => normalize(button.textContent) === wanted) || null;
  };

  function findManagementSection() {
    const heading = [...document.querySelectorAll('div,h1,h2,h3,h4,p,span')]
      .find((element) => isVisible(element) && normalize(element.textContent) === 'gestao do catalogo');
    if (!heading) return null;

    let current = heading.closest('section');
    if (!current) {
      current = heading.parentElement;
      while (current && current !== document.body && current.tagName !== 'SECTION') current = current.parentElement;
    }
    if (!(current instanceof HTMLElement)) return null;

    const requiredTabs = ['Produtos', 'Importar', 'Estrutura', 'Marcas', 'Ofertas', 'Marketing'];
    return requiredTabs.every((label) => exactButton(current, label)) ? current : null;
  }

  function findLinksContext(section) {
    if (!(section instanceof HTMLElement)) return null;
    const header = section.parentElement;
    const root = header?.parentElement;
    if (!(header instanceof HTMLElement) || !(root instanceof HTMLElement)) return null;

    const sectionIndex = [...header.children].indexOf(section);
    if (sectionIndex < 0) return null;

    const laterSiblings = [...header.children].slice(sectionIndex + 1);
    const hasOuterShowcaseButton = laterSiblings.some((element) =>
      element instanceof HTMLElement && [...element.querySelectorAll('button')]
        .some((button) => normalize(button.textContent).includes('adicionar vitrine editavel'))
    );
    const hasOuterSearch = laterSiblings.some((element) => {
      if (!(element instanceof HTMLElement)) return false;
      return [...element.querySelectorAll('input')].some((input) => {
        const hint = normalize(`${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`);
        return hint.includes('codigo') && hint.includes('descricao') && hint.includes('marca');
      });
    });
    const hasInsertCanvas = [...root.querySelectorAll('button')]
      .some((button) => normalize(button.textContent).includes('inserir no canvas'));

    if (!(hasOuterShowcaseButton || hasOuterSearch) || !hasInsertCanvas) return null;
    return { header, root, section, sectionIndex };
  }

  function activeManagementMode(section) {
    const tabs = [
      ['products', 'Produtos'],
      ['import', 'Importar'],
      ['hierarchy', 'Estrutura'],
      ['brands', 'Marcas'],
      ['offers', 'Ofertas'],
      ['marketing', 'Marketing'],
    ];

    for (const [mode, label] of tabs) {
      const button = exactButton(section, label);
      if (!button || !isVisible(button)) continue;
      const active = button.getAttribute('aria-selected') === 'true'
        || button.getAttribute('aria-pressed') === 'true'
        || button.classList.contains('bg-blue-600');
      if (active) return mode;
    }

    const text = normalize(section.textContent);
    if (text.includes('promocoes e vitrine de ofertas')) return 'offers';
    if (text.includes('estrutura organizacional')) return 'hierarchy';
    if (text.includes('nova marca') && text.includes('importar marcas')) return 'brands';
    if (text.includes('marketing carregado') && text.includes('carrossel') && text.includes('tema')) return 'marketing';
    if (text.includes('planilha') && text.includes('imagens') && text.includes('obrigatorios')) return 'import';
    return 'products';
  }

  function hideDuplicateImporter(context) {
    const siblings = [...context.header.children].slice(context.sectionIndex + 1);
    for (const element of siblings) {
      if (!(element instanceof HTMLElement)) continue;
      const text = normalize(element.textContent);
      const hasFiles = element.querySelector('input[type="file"]');
      if (hasFiles && text.includes('planilha') && text.includes('imagens')) {
        hide(element);
        break;
      }
    }
  }

  function isolateNestedPanel(context) {
    const laterSiblings = [...context.header.children].slice(context.sectionIndex + 1);
    laterSiblings.forEach((element) => hide(element));

    [...context.root.children].forEach((element) => {
      if (element !== context.header) hide(element);
    });

    rememberLayout(context.header);
    rememberLayout(context.section);
    context.header.style.flex = '1 1 auto';
    context.header.style.minHeight = '0';
    context.header.style.overflow = 'auto';
    context.section.style.height = 'auto';
    context.section.style.minHeight = '0';
    context.section.style.overflow = 'visible';
  }

  function sync() {
    restore();
    if (!location.pathname.startsWith('/admin')) return;

    const section = findManagementSection();
    const context = findLinksContext(section);
    if (!context) return;

    context.root.setAttribute('data-asteryon-v80-links-context', 'true');
    const mode = activeManagementMode(section);
    context.root.setAttribute('data-asteryon-v80-links-mode', mode);

    if (mode === 'products') {
      hideDuplicateImporter(context);
      return;
    }

    isolateNestedPanel(context);
  }

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-selected', 'aria-pressed'],
  });

  document.addEventListener('click', () => setTimeout(schedule, 0), true);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('popstate', schedule);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
