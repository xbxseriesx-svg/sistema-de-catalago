(() => {
  'use strict';

  const SECTION_IDS = new Set(['segmentos', 'departamentos', 'marcas', 'produtos', 'contato']);
  const state = {
    modal: null,
    body: null,
    title: null,
    mounted: null,
    placeholder: null,
    lastFocus: null,
  };

  const sectionTitle = (target) => {
    if (!target) return 'Conteúdo';
    if (target.classList?.contains('hero')) return 'Início';
    const heading = target.querySelector?.('h1, h2, h3');
    return String(heading?.textContent || target.getAttribute?.('aria-label') || target.id || 'Conteúdo').trim();
  };

  function ensurePopup() {
    if (state.modal) return state.modal;
    const modal = document.createElement('div');
    modal.id = 'portal-popup';
    modal.className = 'portal-popup';
    modal.hidden = true;
    modal.innerHTML = `
      <button class="portal-popup-backdrop" type="button" data-portal-popup-close aria-label="Fechar janela"></button>
      <section class="portal-popup-panel" role="dialog" aria-modal="true" aria-labelledby="portal-popup-title">
        <header class="portal-popup-header">
          <h2 id="portal-popup-title">Conteúdo</h2>
          <button class="portal-popup-close" type="button" data-portal-popup-close aria-label="Fechar">×</button>
        </header>
        <div class="portal-popup-body" id="portal-popup-body"></div>
      </section>`;
    document.body.append(modal);
    state.modal = modal;
    state.body = modal.querySelector('#portal-popup-body');
    state.title = modal.querySelector('#portal-popup-title');
    return modal;
  }

  function restoreMounted() {
    if (!state.mounted || !state.placeholder?.parentNode) return;
    state.placeholder.parentNode.insertBefore(state.mounted, state.placeholder);
    state.placeholder.remove();
    delete state.mounted.dataset.portalPopupMounted;
    state.mounted = null;
    state.placeholder = null;
  }

  function closePopup({ restoreFocus = true } = {}) {
    const modal = ensurePopup();
    restoreMounted();
    modal.hidden = true;
    document.body.classList.remove('portal-popup-open');
    document.documentElement.dataset.portalPopup = 'closed';
    if (restoreFocus && state.lastFocus instanceof HTMLElement) {
      state.lastFocus.focus({ preventScroll: true });
    }
    state.lastFocus = null;
  }

  function targetFromHash(hash) {
    if (!hash || hash === '#') return null;
    if (hash === '#inicio') return document.querySelector('.hero');
    const id = hash.slice(1);
    if (!SECTION_IDS.has(id)) return null;
    return document.getElementById(id);
  }

  function openTarget(target, title = '') {
    if (!(target instanceof HTMLElement)) return false;
    if (target.hidden && target.dataset.editorHidden === 'true') return false;

    const modal = ensurePopup();
    if (state.mounted === target && !modal.hidden) return true;
    if (state.mounted) restoreMounted();

    state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const placeholder = document.createComment(`asteryon-popup:${target.id || 'section'}`);
    target.parentNode?.insertBefore(placeholder, target);
    state.placeholder = placeholder;
    state.mounted = target;
    target.dataset.portalPopupMounted = 'true';
    state.body.replaceChildren(target);
    state.title.textContent = title || sectionTitle(target);
    modal.hidden = false;
    document.body.classList.add('portal-popup-open');
    document.documentElement.dataset.portalPopup = target.id || (target.classList.contains('hero') ? 'inicio' : 'open');
    modal.querySelector('.portal-popup-close')?.focus({ preventScroll: true });
    return true;
  }

  function openHash(hash, title = '') {
    return openTarget(targetFromHash(hash), title);
  }

  function openExternalAction(href, label = 'Abrir conteúdo') {
    const modal = ensurePopup();
    if (state.mounted) restoreMounted();
    state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.title.textContent = label;
    const wrapper = document.createElement('div');
    wrapper.className = 'portal-action-popup';
    const text = document.createElement('p');
    text.textContent = 'Este conteúdo será aberto em uma nova guia.';
    const link = document.createElement('a');
    link.className = 'button button-primary';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    wrapper.append(text, link);
    state.body.replaceChildren(wrapper);
    modal.hidden = false;
    document.body.classList.add('portal-popup-open');
    document.documentElement.dataset.portalPopup = 'external-action';
    modal.querySelector('.portal-popup-close')?.focus({ preventScroll: true });
  }

  const nativeScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function scrollIntoPopup(options) {
    if (this instanceof HTMLElement && (SECTION_IDS.has(this.id) || this.classList.contains('hero'))) {
      openTarget(this);
      return;
    }
    return nativeScrollIntoView.call(this, options);
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-portal-popup-close]')) {
      event.preventDefault();
      closePopup();
      return;
    }

    const brandHome = target.closest('.brand[href="/"], .brand[href="./"]');
    if (brandHome) {
      event.preventDefault();
      openHash('#inicio', 'Início');
      return;
    }

    const anchor = target.closest('a[href^="#"]');
    if (anchor && !anchor.closest('#product-modal')) {
      const href = anchor.getAttribute('href') || '';
      const popupTarget = targetFromHash(href);
      if (popupTarget) {
        event.preventDefault();
        openTarget(popupTarget, String(anchor.textContent || '').trim());
        return;
      }
    }

    const productCard = target.closest('.product-card');
    if (productCard && !target.closest('button, a, input, select, textarea')) {
      const details = productCard.querySelector('[data-product-id]');
      if (details instanceof HTMLElement) {
        event.preventDefault();
        details.click();
      }
    }
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#clear-button')) {
      window.requestAnimationFrame(() => openTarget(document.getElementById('produtos'), 'Produtos do catálogo'));
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!['department-filter', 'brand-filter'].includes(target.id)) return;
    window.requestAnimationFrame(() => openTarget(document.getElementById('produtos'), 'Produtos do catálogo'));
  });

  window.addEventListener('asteryon:open-public-popup', (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    const href = String(detail?.href || '').trim();
    const title = String(detail?.title || detail?.label || '').trim();
    if (href.startsWith('#') && openHash(href, title)) return;
    if (/^https?:\/\//i.test(href)) openExternalAction(href, title || 'Abrir conteúdo');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.modal && !state.modal.hidden) {
      event.preventDefault();
      closePopup();
    }
  });

  window.addEventListener('beforeunload', restoreMounted);
  document.documentElement.dataset.portalPopupController = 'ready';
  window.AsteryonPortalPopup = { openHash, openTarget, close: closePopup };
})();