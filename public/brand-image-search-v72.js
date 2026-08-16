(() => {
  'use strict';

  const MODAL_ID = 'asteryon-brand-image-search-modal-v70';
  const BUTTON_ATTR = 'data-asteryon-google-images-v73';
  const nativeFetch = window.fetch.bind(window);
  let currentBrand = { id: '', name: '' };

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  window.fetch = async function asterYonBrandSearchFetch(input, init) {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '');
    if (url.includes('/api/admin/brand-images/search')) {
      try {
        const parsed = new URL(url, location.origin);
        currentBrand.id = parsed.searchParams.get('brandId') || currentBrand.id;
      } catch { /* noop */ }
    }

    const response = await nativeFetch(input, init);
    if (url.includes('/api/admin/brand-images/search')) {
      response.clone().json().then((payload) => {
        if (payload?.brand?.id) currentBrand.id = String(payload.brand.id);
        if (payload?.brand?.name) currentBrand.name = String(payload.brand.name);
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

  function openPicker(brandId, brandName) {
    if (!brandId) {
      alert('Aguarde a pesquisa da marca carregar e tente novamente.');
      return;
    }
    const url = `/google-image-picker-v73.html?brandId=${encodeURIComponent(brandId)}&brandName=${encodeURIComponent(brandName || '')}`;
    const popup = window.open(url, 'asteryonGoogleImagePicker', popupFeatures());
    if (!popup) alert('O navegador bloqueou o pop-up. Libere pop-ups para este endereço e tente novamente.');
    else popup.focus();
  }

  function patchModal(modal) {
    if (!modal || modal.querySelector(`[${BUTTON_ATTR}]`)) return;
    const head = modal.querySelector('.abiv70-head');
    const title = modal.querySelector('.abiv70-title span');
    const close = modal.querySelector('.abiv70-close');
    if (!head || !close) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(BUTTON_ATTR, 'v73');
    button.textContent = 'Google Imagens';
    button.title = 'Abrir pop-up para escolher uma imagem existente e anexar à marca';
    Object.assign(button.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '34px',
      padding: '0 12px',
      border: '1px solid #3f3f46',
      borderRadius: '8px',
      background: '#18181b',
      color: '#fafafa',
      fontSize: '11px',
      fontWeight: '700',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    });

    button.addEventListener('click', () => {
      const brandName = String(title?.textContent || currentBrand.name || '').trim();
      currentBrand.name = brandName || currentBrand.name;
      openPicker(currentBrand.id, currentBrand.name);
    });

    head.insertBefore(button, close);
  }

  function refreshLogo(detail) {
    if (!detail?.url) return;
    const brandName = normalize(detail.brandName);
    const candidates = [...document.querySelectorAll('strong,span,p,div')].filter((element) => {
      if (element.children.length > 2) return false;
      return normalize(element.textContent) === brandName;
    });
    for (const label of candidates) {
      let current = label;
      for (let depth = 0; depth < 7 && current; depth += 1, current = current.parentElement) {
        if (current.querySelectorAll('button').length < 3) continue;
        const noLogo = [...current.querySelectorAll('*')].find((element) => normalize(element.textContent) === 'sem logo');
        if (!noLogo) continue;
        noLogo.textContent = '';
        noLogo.style.backgroundImage = `url("${String(detail.url).replace(/"/g, '%22')}")`;
        noLogo.style.backgroundSize = 'contain';
        noLogo.style.backgroundRepeat = 'no-repeat';
        noLogo.style.backgroundPosition = 'center';
        break;
      }
    }
    window.dispatchEvent(new CustomEvent('asteryon:brand-logo-updated', { detail }));
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
      if (title?.textContent) currentBrand.name = String(title.textContent).trim();
    }
    patchModal(modal);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
})();
