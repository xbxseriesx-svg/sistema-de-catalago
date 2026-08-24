(() => {
  'use strict';
  if (window.__ASTERYON_COMMERCIAL_DESTINATION_V95__) return;
  window.__ASTERYON_COMMERCIAL_DESTINATION_V95__ = true;

  const ACTION = 'commercial-segment';
  const LABEL = 'Segmento comercial';
  const normalize = (value) => String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  function commercialState() {
    return window.__ASTERYON_COMMERCIAL_SEGMENTS_STATE_V95__ || null;
  }

  function findClickSection() {
    const candidates = [...document.querySelectorAll('p,div,h2,h3,h4,span,label')];
    const title = candidates.find((element) => normalize(element.textContent) === 'alinhamento e funcao ao clicar');
    if (!title) return null;
    let current = title.parentElement;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      const text = normalize(current.textContent);
      if (text.includes('tipo de destino') && text.includes('funcao ao clicar') && current.clientWidth < 500) return current;
    }
    return title.parentElement;
  }

  function findDestinationSelect(section = findClickSection()) {
    if (!section) return null;
    const labels = [...section.querySelectorAll('label,p,span,div')]
      .filter((element) => normalize(element.textContent) === 'tipo de destino');

    for (const label of labels) {
      if (label instanceof HTMLLabelElement) {
        const direct = label.querySelector('select');
        if (direct) return direct;
        if (label.htmlFor) {
          const linked = document.getElementById(label.htmlFor);
          if (linked instanceof HTMLSelectElement) return linked;
        }
      }
      let current = label.parentElement;
      for (let depth = 0; current && depth < 4; depth += 1, current = current.parentElement) {
        const select = current.querySelector('select');
        if (select) return select;
      }
    }

    return [...section.querySelectorAll('select')].find((select) => {
      const options = [...select.options].map((option) => normalize(option.textContent));
      return options.includes('produto') && options.includes('marca') && options.includes('departamento')
        && options.includes('secao') && options.includes('categoria');
    }) || null;
  }

  function setCommercialPanelVisible(visible) {
    const panel = document.getElementById('asteryon-commercial-segments-v95');
    if (!panel) return;
    panel.style.display = visible ? 'block' : 'none';
  }

  function promptSegmentChoice() {
    const state = commercialState();
    if (!state?.status) return;
    const action = state.selectedNodeId && state.actions?.get(state.selectedNodeId);
    if (!action?.segmentId) {
      state.status.textContent = 'Selecione abaixo qual segmento comercial será aberto ao clicar.';
    }
  }

  function syncDestination(select) {
    const state = commercialState();
    if (!state || !select) return;
    state.destinationSelect = select;
    const nodeId = String(state.selectedNodeId || '');
    const hasCommercialAction = Boolean(nodeId && state.actions?.has(nodeId));
    if (hasCommercialAction) select.value = ACTION;
    const active = hasCommercialAction || select.value === ACTION;
    setCommercialPanelVisible(active);
    if (active) promptSegmentChoice();
  }

  function onDestinationChange(event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    const state = commercialState();
    if (!state) return;
    const nodeId = String(state.selectedNodeId || '');

    if (select.value === ACTION) {
      if (!nodeId) {
        window.alert('Selecione primeiro o elemento que receberá a função de clique por segmento comercial.');
        return;
      }
      const current = state.actions?.get(nodeId) || { segmentId: '', segmentName: '' };
      state.actions?.set(nodeId, current);
      setCommercialPanelVisible(true);
      promptSegmentChoice();
      window.setTimeout(() => state.select?.focus(), 30);
      return;
    }

    if (nodeId && state.actions?.has(nodeId)) {
      state.actions.delete(nodeId);
      if (state.select) state.select.value = '';
    }
    setCommercialPanelVisible(false);
  }

  function ensureDestinationOption() {
    if (!location.pathname.startsWith('/admin')) return;
    const section = findClickSection();
    const select = findDestinationSelect(section);
    if (!(select instanceof HTMLSelectElement)) return;

    let option = [...select.options].find((item) => item.value === ACTION || normalize(item.textContent) === normalize(LABEL));
    if (!option) {
      option = document.createElement('option');
      option.value = ACTION;
      option.textContent = LABEL;
      const category = [...select.options].find((item) => normalize(item.textContent) === 'categoria');
      if (category) category.insertAdjacentElement('afterend', option);
      else select.appendChild(option);
    } else {
      option.value = ACTION;
      option.textContent = LABEL;
    }

    if (select.dataset.asteryonCommercialDestination !== 'v95') {
      select.dataset.asteryonCommercialDestination = 'v95';
      select.addEventListener('change', onDestinationChange);
    }
    syncDestination(select);
  }

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      ensureDestinationOption();
    });
  };

  const observer = new MutationObserver(schedule);
  const boot = () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('click', () => window.setTimeout(schedule, 0), true);
    window.addEventListener('asteryon:commercial-segment-change-v95', schedule);
    schedule();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();