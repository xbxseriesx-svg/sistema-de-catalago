(() => {
  const CLOSE_SELECTOR = 'button[aria-label="Fechar produto"]';
  let previousBodyOverflow = null;
  let lastProductKey = '';

  function getParts() {
    const close = document.querySelector(CLOSE_SELECTOR);
    if (!close) return null;

    const header = close.parentElement;
    const panel = header?.parentElement;
    const root = panel?.parentElement;
    if (!header || !panel || !root) return null;

    return { close, header, panel, root };
  }

  function lockBackground() {
    if (previousBodyOverflow === null) previousBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  }

  function unlockBackground() {
    if (previousBodyOverflow === null) return;
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
  }

  function bindModal() {
    const parts = getParts();
    if (!parts) {
      lastProductKey = '';
      unlockBackground();
      return;
    }

    const { close, header, panel, root } = parts;
    root.dataset.asteryonProductModalRoot = 'true';
    panel.dataset.asteryonProductModalPanel = 'true';
    header.dataset.asteryonProductModalHeader = 'true';
    close.title = close.title || 'Fechar produto';
    lockBackground();

    const productKey = header.textContent?.trim() || '';
    if (productKey && productKey !== lastProductKey) {
      lastProductKey = productKey;
      panel.scrollTop = 0;
      root.scrollTop = 0;
      requestAnimationFrame(() => {
        panel.scrollTop = 0;
        root.scrollTop = 0;
      });
    }
  }

  const observer = new MutationObserver(bindModal);

  function start() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    bindModal();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const close = document.querySelector(CLOSE_SELECTOR);
    if (!close) return;
    event.preventDefault();
    close.click();
  });

  window.addEventListener('pagehide', unlockBackground);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
