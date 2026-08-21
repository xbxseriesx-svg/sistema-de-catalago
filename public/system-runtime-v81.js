(() => {
  'use strict';
  if (window.__ASTERYON_SYSTEM_RUNTIME_V81__) return;
  window.__ASTERYON_SYSTEM_RUNTIME_V81__ = true;
  if (!location.pathname.startsWith('/admin')) return;

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  function isClickActionSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return false;
    const none = [...select.options].find((option) => option.value === 'none');
    if (!none) return false;
    let current = select.parentElement;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      const text = normalize(current.textContent);
      if (text.includes('funcao ao clicar') || text.includes('alinhamento e funcao ao clicar')) return true;
    }
    return false;
  }

  function normalizeSelect(select) {
    if (!isClickActionSelect(select)) return;
    const option = [...select.options].find((item) => item.value === 'none');
    if (option && option.textContent !== 'Nenhum (padrão)') option.textContent = 'Nenhum (padrão)';
  }

  function normalizeSubtree(root) {
    if (root instanceof HTMLSelectElement) normalizeSelect(root);
    if (!(root instanceof Document || root instanceof DocumentFragment || root instanceof Element)) return;
    root.querySelectorAll('select').forEach(normalizeSelect);
  }

  const pendingRoots = new Set();
  let frame = 0;

  function queueRoot(root) {
    if (root instanceof Node) pendingRoots.add(root);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.forEach((item) => normalizeSubtree(item));
    });
  }

  // V86: processa somente subárvores recém-renderizadas. A versão anterior
  // consultava todos os <select> do editor em cada clique e em toda mutação React.
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) queueRoot(node);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('change', (event) => {
    const select = event.target instanceof Element ? event.target.closest('select') : null;
    if (select) normalizeSelect(select);
  }, true);

  document.addEventListener('click', (event) => {
    const select = event.target instanceof Element ? event.target.closest('select') : null;
    if (select) normalizeSelect(select);
  }, true);

  const boot = () => normalizeSubtree(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
