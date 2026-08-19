(() => {
  'use strict';

  if (window.__ASTERYON_EDITOR_RUNTIME_V87__) return;
  window.__ASTERYON_EDITOR_RUNTIME_V87__ = true;
  if (!location.pathname.startsWith('/admin')) return;

  const VERSION = '87';
  const AUTOSAVE_MS = 850;
  const PUBLISH_GUARD_MS = AUTOSAVE_MS + 140;
  const releasedPublish = new WeakSet();
  let lastEditAt = 0;

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));

  function isPublishControl(element) {
    const control = element instanceof Element ? element.closest('button,[role="button"]') : null;
    return control instanceof HTMLElement && normalize(control.textContent) === 'publicar' ? control : null;
  }

  function findExplicitSaveButton() {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.find((button) => normalize(button.textContent) === 'salvar')
      || buttons.find((button) => normalize(button.textContent) === 'salvar alteracoes')
      || null;
  }

  function markEdit(event) {
    if (isPublishControl(event.target)) return;
    lastEditAt = Date.now();
  }

  document.addEventListener('input', markEdit, true);
  document.addEventListener('change', markEdit, true);
  document.addEventListener('pointerup', markEdit, true);

  async function flushBeforePublish(button) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    const saveButton = findExplicitSaveButton();
    if (saveButton && saveButton !== button && !saveButton.disabled) saveButton.click();

    const elapsed = lastEditAt ? Date.now() - lastEditAt : Number.POSITIVE_INFINITY;
    if (elapsed < PUBLISH_GUARD_MS) await sleep(PUBLISH_GUARD_MS - elapsed);
    else await sleep(40);

    if (saveButton?.isConnected) {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const label = normalize(saveButton.textContent);
        const saving = label.includes('salvando') || saveButton.getAttribute('aria-busy') === 'true';
        if (!saving) break;
        await sleep(80);
      }
    }
  }

  document.addEventListener('click', (event) => {
    const button = isPublishControl(event.target);
    if (!button) return;
    if (releasedPublish.has(button)) {
      releasedPublish.delete(button);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const previousDisabled = button.hasAttribute('disabled');
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('disabled', '');

    flushBeforePublish(button).then(() => {
      if (!button.isConnected) return;
      button.removeAttribute('aria-busy');
      if (!previousDisabled) button.removeAttribute('disabled');
      releasedPublish.add(button);
      button.click();
      window.dispatchEvent(new CustomEvent('asteryon:publish-flushed-v87', { detail: { version: VERSION } }));
    }).catch((error) => {
      button.removeAttribute('aria-busy');
      if (!previousDisabled) button.removeAttribute('disabled');
      console.error('ASTERYON V87: falha ao preparar publicação.', error);
    });
  }, true);

  function rewriteBrandTextNode(node) {
    if (!(node instanceof Text)) return;
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return;
    const raw = node.nodeValue || '';
    if (normalize(raw) !== 'brand') return;
    node.nodeValue = raw.replace(/brand/i, 'Marca');
  }

  function normalizeBrandLabels(root) {
    if (root instanceof Text) {
      rewriteBrandTextNode(root);
      return;
    }
    if (!(root instanceof Document || root instanceof DocumentFragment || root instanceof Element)) return;

    if (root instanceof Element) {
      for (const attribute of ['title', 'aria-label']) {
        const value = root.getAttribute(attribute);
        if (normalize(value) === 'brand') root.setAttribute(attribute, 'Marca');
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      rewriteBrandTextNode(current);
      current = walker.nextNode();
    }
  }

  const pending = new Set();
  let frame = 0;
  function queueNormalize(node) {
    if (node instanceof Node) pending.add(node);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const roots = [...pending];
      pending.clear();
      roots.forEach(normalizeBrandLabels);
    });
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') queueNormalize(record.target);
      for (const node of record.addedNodes || []) queueNormalize(node);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  const boot = () => queueNormalize(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.__ASTERYON_EDITOR_V87__ = Object.freeze({
    version: VERSION,
    autosaveMs: AUTOSAVE_MS,
    publishGuardMs: PUBLISH_GUARD_MS,
  });
})();
