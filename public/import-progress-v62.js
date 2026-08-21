(() => {
  'use strict';

  const EVENT = 'asteryon:import-progress';
  let excelPanel = null;
  let excelHideTimer = 0;

  function pct(processed, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
  }

  function stageLabel(stage) {
    return ({
      reading: 'Lendo planilha',
      ready: 'Planilha validada',
      importing: 'Importando produtos',
      refreshing: 'Atualizando catálogo',
      complete: 'Importação concluída',
      error: 'Falha na importação',
    })[stage] || 'Importando';
  }

  function findImportHost() {
    const candidates = [...document.querySelectorAll('div')].filter((node) => {
      const text = (node.textContent || '').replace(/\s+/g, ' ');
      return text.includes('Planilha') && text.includes('Imagens') &&
        (text.includes('Obrigatórios: Código') || text.includes('Obrigatorios: Codigo'));
    });
    candidates.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    return candidates[0] || null;
  }

  function createExcelPanel() {
    if (excelPanel?.isConnected) return excelPanel;

    const panel = document.createElement('div');
    panel.id = 'asteryon-import-progress-v62';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = [
      'margin-top:10px',
      'border:1px solid #334155',
      'border-radius:10px',
      'background:#090d14',
      'padding:10px',
      'color:#e5e7eb',
      'font:11px Inter,system-ui,sans-serif',
      'box-shadow:0 10px 28px rgba(0,0,0,.22)',
    ].join(';');
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <strong data-ip-title style="font-size:11px">Importação da planilha</strong>
        <span data-ip-percent style="color:#93c5fd;font-weight:800">0%</span>
      </div>
      <div style="margin-top:7px;height:8px;overflow:hidden;border:1px solid #263244;border-radius:999px;background:#05080d">
        <div data-ip-bar style="height:100%;width:0%;background:#2563eb;transition:width .18s ease"></div>
      </div>
      <div data-ip-summary style="margin-top:7px;color:#aab6c8">Preparando...</div>
      <div data-ip-items style="margin-top:7px;display:grid;gap:4px"></div>
    `;

    const host = findImportHost();
    if (host) {
      host.appendChild(panel);
    } else {
      panel.style.position = 'fixed';
      panel.style.left = '50%';
      panel.style.bottom = '22px';
      panel.style.transform = 'translateX(-50%)';
      panel.style.width = 'min(560px, calc(100vw - 28px))';
      panel.style.zIndex = '1000001';
      document.body.appendChild(panel);
    }
    excelPanel = panel;
    return panel;
  }

  function renderExcel(detail) {
    const panel = createExcelPanel();
    window.clearTimeout(excelHideTimer);
    panel.style.display = 'block';

    const processed = Number(detail.processed || 0);
    const total = Number(detail.total || 0);
    const percent = detail.stage === 'complete' ? 100 : pct(processed, total);
    const title = panel.querySelector('[data-ip-title]');
    const percentEl = panel.querySelector('[data-ip-percent]');
    const bar = panel.querySelector('[data-ip-bar]');
    const summary = panel.querySelector('[data-ip-summary]');
    const items = panel.querySelector('[data-ip-items]');

    title.textContent = `${stageLabel(detail.stage)}${detail.file ? ` · ${detail.file}` : ''}`;
    percentEl.textContent = total ? `${percent}%` : '...';
    bar.style.width = total ? `${percent}%` : '22%';
    bar.style.background = detail.stage === 'error' ? '#dc2626' : detail.stage === 'complete' ? '#059669' : '#2563eb';

    if (detail.stage === 'error') {
      summary.textContent = detail.message || 'Falha ao importar a planilha.';
      summary.style.color = '#fca5a5';
    } else if (total) {
      summary.textContent = `${processed.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} produto(s) processado(s).`;
      summary.style.color = detail.stage === 'complete' ? '#6ee7b7' : '#aab6c8';
    } else {
      summary.textContent = stageLabel(detail.stage);
      summary.style.color = '#aab6c8';
    }

    const current = Array.isArray(detail.currentItems) ? detail.currentItems : [];
    items.innerHTML = '';
    current.slice(0, 5).forEach((item) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;border:1px solid #1f2937;border-radius:7px;background:#111827;padding:5px 7px;min-width:0';
      const code = String(item?.code || '').trim();
      const name = String(item?.name || item || '').trim();
      row.innerHTML = `<b style="color:#bfdbfe;white-space:nowrap"></b><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1"></span>`;
      row.querySelector('b').textContent = code ? `Código ${code}` : 'Item';
      row.querySelector('span').textContent = name || 'Processando...';
      items.appendChild(row);
    });

    if (!current.length && (detail.stage === 'reading' || detail.stage === 'refreshing')) {
      const row = document.createElement('div');
      row.style.color = '#64748b';
      row.textContent = detail.stage === 'reading' ? 'Lendo e validando as linhas do arquivo...' : 'Recarregando os produtos após a gravação...';
      items.appendChild(row);
    }

    if (detail.stage === 'complete' || detail.stage === 'error') {
      excelHideTimer = window.setTimeout(() => {
        if (excelPanel) excelPanel.style.display = 'none';
      }, 10000);
    }
  }

  window.addEventListener(EVENT, (event) => {
    const detail = event.detail || {};
    if (detail.mode === 'excel') renderExcel(detail);
  });

  function enhanceImageImporter() {
    const body = document.getElementById('resultBody');
    const progressStatus = document.getElementById('progressStatus');
    if (!body || !progressStatus || document.getElementById('imageActiveItemsV62')) return;

    const box = document.createElement('div');
    box.id = 'imageActiveItemsV62';
    box.style.cssText = 'margin-top:10px;border:1px solid #263244;border-radius:9px;background:#090d14;padding:10px;font-size:12px';
    box.innerHTML = '<strong style="display:block;margin-bottom:6px;color:#cbd5e1">Arquivos em processamento</strong><div data-image-active-list style="display:grid;gap:5px;color:#8290a6">Aguardando importação.</div>';
    progressStatus.insertAdjacentElement('afterend', box);
    const list = box.querySelector('[data-image-active-list]');

    const render = () => {
      const active = [...body.querySelectorAll('tr')].map((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) return null;
        const status = (cells[3].textContent || '').trim();
        if (!/convertendo|enviando/i.test(status)) return null;
        return {
          file: (cells[0].textContent || '').trim(),
          code: (cells[1].textContent || '').trim(),
          product: (cells[2].textContent || '').trim(),
          status,
        };
      }).filter(Boolean);

      list.innerHTML = '';
      if (!active.length) {
        const item = document.createElement('div');
        item.style.color = '#64748b';
        item.textContent = /conclu|interromp|falha/i.test(progressStatus.textContent || '')
          ? 'Nenhum arquivo em processamento.'
          : 'Preparando o próximo arquivo...';
        list.appendChild(item);
        return;
      }

      active.slice(0, 4).forEach((entry) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center;border:1px solid #1f2937;border-radius:7px;background:#111827;padding:6px 8px';
        const code = document.createElement('b');
        code.style.cssText = 'color:#bfdbfe;white-space:nowrap';
        code.textContent = entry.code ? `Código ${entry.code}` : entry.file;
        const product = document.createElement('span');
        product.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1';
        product.textContent = entry.product || entry.file;
        const status = document.createElement('span');
        status.style.cssText = 'color:#93c5fd;font-weight:700;white-space:nowrap';
        status.textContent = entry.status;
        item.append(code, product, status);
        list.appendChild(item);
      });
    };

    new MutationObserver(render).observe(body, { childList: true, subtree: true, characterData: true });
    new MutationObserver(render).observe(progressStatus, { childList: true, subtree: true, characterData: true });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceImageImporter, { once: true });
  else enhanceImageImporter();
})();
