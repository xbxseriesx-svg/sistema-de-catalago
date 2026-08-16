(() => {
  'use strict';

  const TARGET_BYTES = 300 * 1024;
  const MAX_DIMENSION = 1400;
  const MIN_DIMENSION = 720;
  const CONCURRENCY = 2;
  const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'jfif', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg', 'heic', 'heif', 'tif', 'tiff']);

  const els = {
    productCount: document.getElementById('productCount'),
    fileCount: document.getElementById('fileCount'),
    matchedCount: document.getElementById('matchedCount'),
    unmatchedCount: document.getElementById('unmatchedCount'),
    catalogStatus: document.getElementById('catalogStatus'),
    folderInput: document.getElementById('folderInput'),
    filesInput: document.getElementById('filesInput'),
    clearButton: document.getElementById('clearButton'),
    importButton: document.getElementById('importButton'),
    stopButton: document.getElementById('stopButton'),
    progressBar: document.getElementById('progressBar'),
    progressStatus: document.getElementById('progressStatus'),
    successCount: document.getElementById('successCount'),
    failedCount: document.getElementById('failedCount'),
    sourceSize: document.getElementById('sourceSize'),
    outputSize: document.getElementById('outputSize'),
    resultBody: document.getElementById('resultBody'),
  };

  let products = [];
  let byCode = new Map();
  let byNumericCode = new Map();
  let items = [];
  let running = false;
  let stopRequested = false;
  let counters = { success: 0, failed: 0, processed: 0, source: 0, output: 0 };

  const clean = value => String(value ?? '').trim();

  function humanBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function extension(filename) {
    const match = /\.([a-z0-9]+)$/i.exec(filename || '');
    return match ? match[1].toLowerCase() : '';
  }

  function stem(filename) {
    return clean(String(filename || '').replace(/\.[^.]+$/, ''));
  }

  function numericKey(value) {
    const code = clean(value);
    if (!/^\d+$/.test(code)) return '';
    return code.replace(/^0+(?=\d)/, '');
  }

  function buildProductMaps() {
    byCode = new Map();
    const numericCandidates = new Map();
    for (const product of products) {
      const code = clean(product.code);
      if (!code) continue;
      byCode.set(code, product);
      const key = numericKey(code);
      if (!key) continue;
      if (!numericCandidates.has(key)) numericCandidates.set(key, []);
      numericCandidates.get(key).push(product);
    }
    byNumericCode = new Map();
    for (const [key, list] of numericCandidates) {
      if (list.length === 1) byNumericCode.set(key, list[0]);
    }
  }

  function matchProduct(file) {
    const codeFromName = stem(file.name);
    const exact = byCode.get(codeFromName);
    if (exact) return { product: exact, match: 'exact' };
    const numeric = numericKey(codeFromName);
    if (numeric && byNumericCode.has(numeric)) return { product: byNumericCode.get(numeric), match: 'numeric' };
    return { product: null, match: 'none' };
  }

  function createCell(row, text, className = '') {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    row.appendChild(td);
    return td;
  }

  function renderItems() {
    els.resultBody.textContent = '';
    if (!items.length) {
      const row = document.createElement('tr');
      createCell(row, 'Nenhum arquivo selecionado.', 'muted').colSpan = 5;
      els.resultBody.appendChild(row);
      return;
    }
    for (const item of items) {
      const row = document.createElement('tr');
      createCell(row, item.file.webkitRelativePath || item.file.name);
      createCell(row, item.code || '—');
      createCell(row, item.product ? clean(item.product.name) : '—');
      item.statusCell = createCell(row, item.statusText, item.statusClass);
      item.sizeCell = createCell(row, humanBytes(item.file.size));
      item.row = row;
      els.resultBody.appendChild(row);
    }
  }

  function setItemStatus(item, text, className = '') {
    item.statusText = text;
    item.statusClass = className;
    if (item.statusCell) {
      item.statusCell.textContent = text;
      item.statusCell.className = className;
    }
  }

  function setItemSize(item, text) {
    if (item.sizeCell) item.sizeCell.textContent = text;
  }

  function updateStats() {
    const matched = items.filter(item => item.ready).length;
    const unmatched = items.length - matched;
    els.fileCount.textContent = String(items.length);
    els.matchedCount.textContent = String(matched);
    els.unmatchedCount.textContent = String(unmatched);
    els.successCount.textContent = String(counters.success);
    els.failedCount.textContent = String(counters.failed);
    els.sourceSize.textContent = humanBytes(counters.source);
    els.outputSize.textContent = humanBytes(counters.output);
    els.importButton.disabled = running || !matched || !products.length;
  }

  function resetRunCounters() {
    counters = { success: 0, failed: 0, processed: 0, source: 0, output: 0 };
    els.progressBar.style.width = '0%';
    els.progressStatus.textContent = items.length ? 'Pronto para importar.' : 'Aguardando seleção.';
    updateStats();
  }

  function selectFiles(fileList) {
    if (running) return;
    const files = [...(fileList || [])].filter(file => file.type.startsWith('image/') || IMAGE_EXTENSIONS.has(extension(file.name)));
    const seenProducts = new Set();
    items = files.map((file, index) => {
      const matched = matchProduct(file);
      const code = matched.product ? clean(matched.product.code) : stem(file.name);
      let ready = !!matched.product;
      let statusText = matched.product ? (matched.match === 'exact' ? 'Pronto' : 'Pronto (código numérico)') : 'Sem produto correspondente';
      let statusClass = matched.product ? 'warn' : 'error';
      if (matched.product && seenProducts.has(matched.product.id)) {
        ready = false;
        statusText = 'Imagem duplicada para o mesmo produto';
        statusClass = 'error';
      }
      if (ready) seenProducts.add(matched.product.id);
      return { id: index, file, product: matched.product, code, ready, statusText, statusClass, statusCell: null, sizeCell: null, row: null };
    });
    resetRunCounters();
    renderItems();
    updateStats();
  }

  async function loadCatalog() {
    try {
      const response = await fetch('/api/admin/catalog', { credentials: 'same-origin', cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        if (response.status === 401) throw new Error('Faça login no editor antes de abrir o importador.');
        throw new Error(payload?.error?.message || `Falha HTTP ${response.status}`);
      }
      products = Array.isArray(payload?.catalog?.products) ? payload.catalog.products : [];
      buildProductMaps();
      els.productCount.textContent = String(products.length);
      els.catalogStatus.textContent = `${products.length} produto(s) disponíveis para vínculo por código.`;
      els.catalogStatus.className = 'status ok';
      if (items.length) selectFiles(items.map(item => item.file));
      updateStats();
    } catch (error) {
      products = [];
      buildProductMaps();
      els.productCount.textContent = '0';
      els.catalogStatus.textContent = error instanceof Error ? error.message : 'Falha ao carregar catálogo.';
      els.catalogStatus.className = 'status error';
      updateStats();
    }
  }

  function drawableFromImageElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve({ drawable: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) });
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Formato não decodificado pelo navegador')); };
      image.src = url;
    });
  }

  async function loadDrawable(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { drawable: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      } catch {
        return drawableFromImageElement(file);
      }
    }
    return drawableFromImageElement(file);
  }

  function webpBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Este navegador não conseguiu gerar WebP'));
      }, 'image/webp', quality);
    });
  }

  async function convertToWebp(file) {
    const loaded = await loadDrawable(file);
    try {
      if (!loaded.width || !loaded.height) throw new Error('Imagem sem dimensões válidas');
      let scale = Math.min(1, MAX_DIMENSION / Math.max(loaded.width, loaded.height));
      let width = Math.max(1, Math.round(loaded.width * scale));
      let height = Math.max(1, Math.round(loaded.height * scale));
      let finalBlob = null;
      let finalWidth = width;
      let finalHeight = height;

      for (let resizePass = 0; resizePass < 6; resizePass++) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) throw new Error('Canvas indisponível');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(loaded.drawable, 0, 0, width, height);

        let quality = 0.84;
        for (let qualityPass = 0; qualityPass < 5; qualityPass++) {
          finalBlob = await webpBlob(canvas, quality);
          finalWidth = width;
          finalHeight = height;
          if (finalBlob.size <= TARGET_BYTES) break;
          quality -= 0.07;
        }
        if (finalBlob && (finalBlob.size <= TARGET_BYTES || Math.max(width, height) <= MIN_DIMENSION)) break;
        width = Math.max(1, Math.round(width * 0.84));
        height = Math.max(1, Math.round(height * 0.84));
      }

      if (!finalBlob) throw new Error('Falha na conversão para WebP');
      return { blob: finalBlob, width: finalWidth, height: finalHeight };
    } finally {
      loaded.close?.();
    }
  }

  async function uploadConverted(item, converted) {
    const code = clean(item.product.code);
    const params = new URLSearchParams({
      code,
      filename: `${code}.webp`,
      originalFilename: item.file.name,
      sourceSize: String(item.file.size),
    });
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(`/api/admin/product-images/import?${params.toString()}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'image/webp' },
          body: converted.blob,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          const message = payload?.error?.message || `Falha HTTP ${response.status}`;
          const error = new Error(message);
          error.status = response.status;
          throw error;
        }
        return payload;
      } catch (error) {
        lastError = error;
        if (error?.status === 401 || error?.status === 403 || attempt === 2) break;
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    throw lastError || new Error('Falha no envio');
  }

  async function processItem(item) {
    if (stopRequested) return;
    setItemStatus(item, 'Convertendo...', 'warn');
    counters.source += item.file.size;
    updateStats();
    try {
      const converted = await convertToWebp(item.file);
      if (stopRequested) {
        setItemStatus(item, 'Interrompido', 'warn');
        return;
      }
      setItemStatus(item, 'Enviando...', 'warn');
      const payload = await uploadConverted(item, converted);
      counters.success++;
      counters.output += converted.blob.size;
      setItemStatus(item, 'Importada e vinculada', 'ok');
      setItemSize(item, `${humanBytes(item.file.size)} → ${humanBytes(converted.blob.size)} • ${converted.width}×${converted.height}`);
      item.result = payload;
    } catch (error) {
      counters.failed++;
      const message = error instanceof Error ? error.message : 'Falha desconhecida';
      setItemStatus(item, message, 'error');
      if (error?.status === 401) stopRequested = true;
    } finally {
      counters.processed++;
      updateStats();
    }
  }

  async function startImport() {
    if (running) return;
    const queue = items.filter(item => item.ready);
    if (!queue.length) return;
    running = true;
    stopRequested = false;
    resetRunCounters();
    els.importButton.disabled = true;
    els.stopButton.disabled = false;
    els.clearButton.disabled = true;
    els.folderInput.disabled = true;
    els.filesInput.disabled = true;

    let cursor = 0;
    const updateProgress = () => {
      const percent = queue.length ? Math.min(100, (counters.processed / queue.length) * 100) : 0;
      els.progressBar.style.width = `${percent.toFixed(2)}%`;
      els.progressStatus.textContent = `Processados ${counters.processed} de ${queue.length} • ${counters.success} importados • ${counters.failed} falhas`;
    };

    const worker = async () => {
      while (!stopRequested) {
        const index = cursor++;
        if (index >= queue.length) break;
        await processItem(queue[index]);
        updateProgress();
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    };

    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    } finally {
      running = false;
      els.stopButton.disabled = true;
      els.clearButton.disabled = false;
      els.folderInput.disabled = false;
      els.filesInput.disabled = false;
      updateProgress();
      if (stopRequested) {
        els.progressStatus.textContent += ' • importação interrompida';
        els.progressStatus.className = 'status warn';
      } else if (counters.failed) {
        els.progressStatus.textContent += ' • concluída com falhas';
        els.progressStatus.className = 'status warn';
      } else {
        els.progressBar.style.width = '100%';
        els.progressStatus.textContent += ' • concluída';
        els.progressStatus.className = 'status ok';
      }
      updateStats();
    }
  }

  function clearSelection() {
    if (running) return;
    items = [];
    els.folderInput.value = '';
    els.filesInput.value = '';
    resetRunCounters();
    renderItems();
    updateStats();
  }

  els.folderInput.addEventListener('change', event => selectFiles(event.target.files));
  els.filesInput.addEventListener('change', event => selectFiles(event.target.files));
  els.clearButton.addEventListener('click', clearSelection);
  els.importButton.addEventListener('click', startImport);
  els.stopButton.addEventListener('click', () => { stopRequested = true; els.stopButton.disabled = true; });

  renderItems();
  updateStats();
  loadCatalog();
})();
