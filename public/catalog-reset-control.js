(() => {
  'use strict';

  const CONTROL_ID = 'asteryon-catalog-reset-control';
  const CONFIRMATION = 'APAGAR CATÁLOGO';

  function messageFrom(body, fallback) {
    return body?.error?.message || body?.message || fallback;
  }

  async function resetCatalog(button, status) {
    const confirmation = window.prompt(
      'Esta ação apaga produtos, marcas, fotos, departamentos, seções e categorias.\n\nDigite APAGAR CATÁLOGO para confirmar:',
    );
    if (confirmation !== CONFIRMATION) {
      status.textContent = confirmation === null ? 'Limpeza cancelada.' : 'Confirmação incorreta. Nada foi apagado.';
      return;
    }

    button.disabled = true;
    status.textContent = 'Limpando imagens do Storage e dados do catálogo…';
    try {
      const response = await fetch('/api/admin/catalog/reset', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: CONFIRMATION }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) {
        throw new Error(messageFrom(body, `Falha HTTP ${response.status}`));
      }
      const deleted = body.deleted || {};
      status.textContent = `Limpeza concluída: ${deleted.products || 0} produtos, ${deleted.brands || 0} marcas e ${deleted.media || 0} mídias removidos.`;
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Falha ao limpar o catálogo.';
      button.disabled = false;
    }
  }

  function install() {
    if (document.getElementById(CONTROL_ID)) return;
    const spreadsheetInput = [...document.querySelectorAll('input[type="file"]')]
      .find((input) => String(input.getAttribute('accept') || '').includes('.xlsx'));
    const card = spreadsheetInput?.closest('.rounded-lg');
    if (!card) return;

    const wrapper = document.createElement('div');
    wrapper.id = CONTROL_ID;
    wrapper.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid rgb(39 39 42)';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Apagar dados do catálogo';
    button.setAttribute('aria-label', 'Apagar produtos, marcas, imagens e hierarquia do catálogo');
    button.style.cssText = 'width:100%;border:1px solid rgba(239,68,68,.45);border-radius:6px;background:rgba(127,29,29,.28);color:#fca5a5;padding:8px;font-size:10px;font-weight:700;cursor:pointer';

    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.style.cssText = 'margin:7px 0 0;color:#a1a1aa;font-size:9px;line-height:1.45';
    status.textContent = 'Preserva usuários, páginas, modelos, configurações e segmentos comerciais.';

    button.addEventListener('click', () => resetCatalog(button, status));
    wrapper.append(button, status);
    card.append(wrapper);
  }

  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', install, { once: true });
  install();
})();
