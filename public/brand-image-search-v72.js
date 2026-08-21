(() => {
  'use strict';

  const MODAL_ID = 'asteryon-brand-image-search-modal-v70';
  const SEARCH_BUTTON_ATTR = 'data-asteryon-brand-image-search';
  const ROW_ID_ATTR = 'data-asteryon-brand-id-v77';
  const WEB_BUTTON_ATTR = 'data-asteryon-web-images-v77';
  const MANUAL_BUTTON_ATTR = 'data-asteryon-manual-logo-v77';
  const nativeFetch = window.fetch.bind(window);
  let currentBrand = { id: '', name: '' };

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function findBrandRowFromTrigger(trigger) {
    let current = trigger;
    for (let depth = 0; depth < 8 && current; depth += 1, current = current.parentElement) {
      const text = normalize(current.textContent);
      if (current.querySelectorAll?.('button').length >= 3 && /produto\(s\)|produto/.test(text)) return current;
    }
    return null;
  }

  function markActiveContext(brandId, brandName = '') {
    const id = String(brandId || '').trim();
    if (!id) return;

    const name = String(brandName || '').trim();
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.setAttribute('data-asteryon-brand-id-v77', id);
      if (name) modal.setAttribute('data-asteryon-brand-name-v77', name);
    }

    const trigger = document.querySelector(`button[${SEARCH_BUTTON_ATTR}][aria-busy="true"]`);
    if (!trigger) return;
    const row = findBrandRowFromTrigger(trigger);
    if (!row) return;
    row.setAttribute(ROW_ID_ATTR, id);
    if (name) row.setAttribute('data-asteryon-brand-name-v77', name);
  }

  window.fetch = async function asterYonBrandSearchFetch(input, init) {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '');
    if (url.includes('/api/admin/brand-images/search')) {
      try {
        const parsed = new URL(url, location.origin);
        const nextId = String(parsed.searchParams.get('brandId') || '').trim();
        if (nextId) {
          if (nextId !== currentBrand.id) currentBrand = { id: nextId, name: '' };
          markActiveContext(nextId);
        }
      } catch { /* noop */ }
    }

    const response = await nativeFetch(input, init);
    if (url.includes('/api/admin/brand-images/search')) {
      response.clone().json().then((payload) => {
        const id = String(payload?.brand?.id || currentBrand.id || '').trim();
        const name = String(payload?.brand?.name || currentBrand.name || '').trim();
        if (id) currentBrand.id = id;
        if (name) currentBrand.name = name;
        markActiveContext(id, name);
      }).catch(() => {});
    }
    return response;
  };

  function popupFeatures() {
    const width = Math.min(1180, Math.max(900, Math.round(screen.availWidth * 0.82)));
    const height = Math.min(860, Math.max(650, Math.round(screen.availHeight * 0.82)));
    const left = Math.max(0, Math.round((screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((screen.availHeight - height) / 2));
    return `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
  }

  function openPicker(brandId, brandName, mode = 'web') {
    const id = String(brandId || '').trim();
    if (!id) {
      alert('Aguarde a marca carregar e tente novamente.');
      return;
    }
    const url = `/google-image-picker-v73.html?v=77&mode=${encodeURIComponent(mode)}&brandId=${encodeURIComponent(id)}&brandName=${encodeURIComponent(brandName || '')}`;
    const popup = window.open(url, 'asteryonBrandImagePicker', popupFeatures());
    if (!popup) alert('O navegador bloqueou o pop-up. Libere pop-ups para este endereço e tente novamente.');
    else popup.focus();
  }

  function styleButton(button, primary = false) {
    Object.assign(button.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '34px',
      padding: '0 12px',
      border: `1px solid ${primary ? '#7c3aed' : '#3f3f46'}`,
      borderRadius: '8px',
      background: primary ? '#7c3aed' : '#18181b',
      color: '#fafafa',
      fontSize: '11px',
      fontWeight: '700',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    });
  }

  function patchModal(modal) {
    if (!modal) return;
    const head = modal.querySelector('.abiv70-head');
    const title = modal.querySelector('.abiv70-title span');
    const close = modal.querySelector('.abiv70-close');
    if (!head || !close) return;

    const modalBrandId = () => String(modal.getAttribute('data-asteryon-brand-id-v77') || currentBrand.id || '').trim();
    const modalBrandName = () => String(title?.textContent || modal.getAttribute('data-asteryon-brand-name-v77') || currentBrand.name || '').trim();

    if (!modal.querySelector(`[${MANUAL_BUTTON_ATTR}]`)) {
      const manualButton = document.createElement('button');
      manualButton.type = 'button';
      manualButton.setAttribute(MANUAL_BUTTON_ATTR, 'v77');
      manualButton.textContent = 'Logo manual';
      manualButton.title = 'Escolher uma logo do computador, converter para WEBP e vincular somente à marca selecionada';
      styleButton(manualButton, true);
      manualButton.addEventListener('click', () => openPicker(modalBrandId(), modalBrandName(), 'manual'));
      head.insertBefore(manualButton, close);
    }

    if (!modal.querySelector(`[${WEB_BUTTON_ATTR}]`)) {
      const webButton = document.createElement('button');
      webButton.type = 'button';
      webButton.setAttribute(WEB_BUTTON_ATTR, 'v77');
      webButton.textContent = 'Pesquisar na web';
      webButton.title = 'Pesquisar imagens existentes da marca na web';
      styleButton(webButton, false);
      webButton.addEventListener('click', () => openPicker(modalBrandId(), modalBrandName(), 'web'));
      head.insertBefore(webButton, close);
    }
  }

  function applyLogoOnlyToExactRow(detail) {
    const id = String(detail?.brandId || '').trim();
    const url = String(detail?.url || '').trim();
    if (!id || !url) return false;

    const rows = [...document.querySelectorAll(`[${ROW_ID_ATTR}]`)]
      .filter((row) => String(row.getAttribute(ROW_ID_ATTR) || '').trim() === id);

    if (rows.length !== 1) {
      console.warn(`ASTERYON V77: atualização visual ignorada porque brandId ${id} não possui exatamente uma linha identificada.`);
      return false;
    }

    const row = rows[0];
    const noLogo = [...row.querySelectorAll('*')]
      .find((element) => normalize(element.textContent) === 'sem logo');
    if (!noLogo) return false;

    noLogo.textContent = '';
    noLogo.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
    noLogo.style.backgroundSize = 'contain';
    noLogo.style.backgroundRepeat = 'no-repeat';
    noLogo.style.backgroundPosition = 'center';
    noLogo.setAttribute('data-asteryon-logo-owner-v77', id);
    return true;
  }

  function refreshLogo(detail) {
    const id = String(detail?.brandId || '').trim();
    if (!id || !detail?.url) return;
    applyLogoOnlyToExactRow(detail);
    window.dispatchEvent(new CustomEvent('asteryon:brand-logo-updated', { detail: { ...detail, brandId: id } }));
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.data?.type !== 'asteryon:brand-logo-updated') return;
    refreshLogo(event.data.detail);
  });

  try {
    const channel = new BroadcastChannel('asteryon-brand-logo-v73');
    channel.addEventListener('message', (event) => refreshLogo(event.data));
  } catch { /* BroadcastChannel indisponível */ }

  function scan() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      const title = modal.querySelector('.abiv70-title span');
      const name = String(title?.textContent || '').trim();
      if (name) {
        currentBrand.name = name;
        if (currentBrand.id) markActiveContext(currentBrand.id, name);
      }
    }
    patchModal(modal);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
})();