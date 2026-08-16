(() => {
  'use strict';
  if (window.__ASTERYON_SYSTEM_RUNTIME_V81__) return;
  window.__ASTERYON_SYSTEM_RUNTIME_V81__ = true;

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

  function normalizeNoneLabels() {
    if (!location.pathname.startsWith('/admin')) return;
    document.querySelectorAll('select').forEach((select) => {
      if (!isClickActionSelect(select)) return;
      const option = [...select.options].find((item) => item.value === 'none');
      if (option && option.textContent !== 'Nenhum (padrão)') option.textContent = 'Nenhum (padrão)';
    });
  }

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      normalizeNoneLabels();
    });
  };

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('change', schedule, true);
  document.addEventListener('click', schedule, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
