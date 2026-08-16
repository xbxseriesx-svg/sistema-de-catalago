(() => {
  'use strict';

  if (window.__ASTERYON_MARKETING_PANEL_SCOPE_V79__) return;
  window.__ASTERYON_MARKETING_PANEL_SCOPE_V79__ = true;

  const MARKER = 'data-asteryon-v79-hidden-by-marketing';
  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const visible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };

  function exactTextElement(text) {
    const wanted = normalize(text);
    return [...document.querySelectorAll('button,div,span,p,h1,h2,h3,h4,h5')]
      .find((element) => visible(element) && normalize(element.textContent) === wanted) || null;
  }

  function isLinksMarketingOpen() {
    if (!location.pathname.startsWith('/admin')) return false;

    const marketingLoaded = [...document.querySelectorAll('div,p,span')].some((element) => {
      if (!visible(element)) return false;
      const text = normalize(element.textContent);
      return text === 'marketing carregado do supabase.' || text === 'marketing carregado do supabase';
    });
    if (!marketingLoaded) return false;

    // Garante que estamos no painel Vínculos e no módulo Marketing, não apenas
    // diante de algum texto de marketing em outro ponto do editor.
    const linksTab = exactTextElement('Vínculos');
    const marketingTab = exactTextElement('Marketing');
    return Boolean(linksTab && marketingTab);
  }

  function hasShowcasePickerSignals(root) {
    if (!(root instanceof HTMLElement)) return false;
    const addButton = [...root.querySelectorAll('button')]
      .some((button) => normalize(button.textContent).includes('adicionar vitrine editavel'));
    const productSearch = [...root.querySelectorAll('input')]
      .some((input) => {
        const hint = normalize(`${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`);
        return hint.includes('codigo') && (hint.includes('descricao') || hint.includes('marca'));
      });
    const departmentFilter = [...root.querySelectorAll('option')]
      .some((option) => normalize(option.textContent).includes('todos os departamentos'));
    return addButton && (productSearch || departmentFilter);
  }

  function findShowcasePicker() {
    const addButton = [...document.querySelectorAll('button')]
      .find((button) => visible(button) && normalize(button.textContent).includes('adicionar vitrine editavel'));
    if (!addButton) return null;

    // Sobe somente até o menor contêiner que reúna botão + busca/filtro.
    // Assim não escondemos o painel Vínculos inteiro.
    let current = addButton.parentElement;
    let fallback = current;
    for (let depth = 0; current && current !== document.body && depth < 9; depth += 1) {
      fallback = current;
      if (hasShowcasePickerSignals(current)) return current;
      current = current.parentElement;
    }
    return fallback;
  }

  function hideForMarketing(element) {
    if (!(element instanceof HTMLElement)) return;
    if (element.getAttribute(MARKER) === '1') return;
    element.dataset.asteryonV79PreviousDisplay = element.style.display || '';
    element.setAttribute(MARKER, '1');
    element.style.setProperty('display', 'none', 'important');
  }

  function restoreOutsideMarketing() {
    document.querySelectorAll(`[${MARKER}="1"]`).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const previous = element.dataset.asteryonV79PreviousDisplay || '';
      element.style.removeProperty('display');
      if (previous) element.style.display = previous;
      delete element.dataset.asteryonV79PreviousDisplay;
      element.removeAttribute(MARKER);
    });
  }

  function markMarketingPanel() {
    const loaded = [...document.querySelectorAll('div,p,span')]
      .find((element) => visible(element) && normalize(element.textContent).startsWith('marketing carregado do supabase'));
    if (!loaded) return;

    let current = loaded.parentElement;
    for (let depth = 0; current && current !== document.body && depth < 7; depth += 1) {
      const text = normalize(current.textContent);
      const hasTabs = text.includes('banner') && text.includes('video') && text.includes('carrossel') && text.includes('promocoes');
      if (hasTabs) {
        current.setAttribute('data-asteryon-marketing-panel-v79', 'true');
        break;
      }
      current = current.parentElement;
    }
  }

  function sync() {
    if (!location.pathname.startsWith('/admin')) {
      restoreOutsideMarketing();
      return;
    }

    const marketingOpen = isLinksMarketingOpen();
    if (!marketingOpen) {
      restoreOutsideMarketing();
      return;
    }

    markMarketingPanel();
    const showcasePicker = findShowcasePicker();
    if (showcasePicker) hideForMarketing(showcasePicker);
  }

  let scheduled = 0;
  const schedule = () => {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      sync();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-selected'] });
  document.addEventListener('click', () => setTimeout(schedule, 0), true);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('popstate', schedule);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
