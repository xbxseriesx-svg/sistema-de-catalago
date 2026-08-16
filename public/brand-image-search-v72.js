(() => {
  'use strict';

  const MODAL_ID = 'asteryon-brand-image-search-modal-v70';
  const LINK_ATTR = 'data-asteryon-google-images-v72';

  function googleUrl(brandName) {
    const query = `logo ${String(brandName || '').trim()}`.trim();
    return `https://www.google.com/search?tbm=isch&safe=active&q=${encodeURIComponent(query)}`;
  }

  function patchModal(modal) {
    if (!modal || modal.querySelector(`[${LINK_ATTR}]`)) return;
    const head = modal.querySelector('.abiv70-head');
    const title = modal.querySelector('.abiv70-title span');
    const close = modal.querySelector('.abiv70-close');
    if (!head || !close) return;

    const link = document.createElement('a');
    link.setAttribute(LINK_ATTR, 'v72');
    link.href = googleUrl(title?.textContent || '');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Google Imagens';
    link.title = 'Abrir a pesquisa desta marca no Google Imagens';
    Object.assign(link.style, {
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
      textDecoration: 'none',
      whiteSpace: 'nowrap',
    });

    head.insertBefore(link, close);
  }

  function scan() {
    patchModal(document.getElementById(MODAL_ID));
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
})();
