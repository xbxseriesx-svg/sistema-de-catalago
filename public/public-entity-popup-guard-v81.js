(() => {
  'use strict';

  if (window.__ASTERYON_PUBLIC_ENTITY_POPUP_GUARD_V81__) return;
  window.__ASTERYON_PUBLIC_ENTITY_POPUP_GUARD_V81__ = true;
  if (location.pathname.startsWith('/admin')) return;

  const ENTITY_ID = 'asteryon-entity-popup-v81';
  const SEARCH_ID = 'asteryon-global-search-v78';

  function syncScrollLock() {
    const entity = document.getElementById(ENTITY_ID);
    const search = document.getElementById(SEARCH_ID);
    const entityOpen = entity?.dataset.open === 'true';
    const searchOpen = search?.dataset.open === 'true';

    if (entityOpen || searchOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      return;
    }

    document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow');
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-open') {
        syncScrollLock();
        return;
      }
      if (mutation.type === 'childList') {
        const entity = document.getElementById(ENTITY_ID);
        const search = document.getElementById(SEARCH_ID);
        if (entity || search) {
          syncScrollLock();
          return;
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-open'],
  });

  window.addEventListener('pageshow', syncScrollLock);
  window.addEventListener('asteryon:catalog-open', syncScrollLock);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') queueMicrotask(syncScrollLock);
  });
})();
