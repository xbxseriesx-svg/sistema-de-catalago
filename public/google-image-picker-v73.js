(() => {
  'use strict';

  const MAX_DIMENSION = 1400;
  const TARGET_BYTES = 300 * 1024;
  const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
  const ALLOWED_SOURCE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const params = new URLSearchParams(location.search);
  const brandId = String(params.get('brandId') || '').trim();
  const brandName = String(params.get('brandName') || '').trim();
  const mode = String(params.get('mode') || 'web').trim().toLowerCase();
  const status = document.getElementById('status');
  const grid = document.getElementById('grid');
  const brandNameNode = document.getElementById('brandName');
  const closeBtn = document.getElementById('closeBtn');
  const manualUploadBtn = document.getElementById('manualUploadBtn');
  const manualFile = document.getElementById('manualFile');

  brandNameNode.textContent = brandName || 'Marca não identificada';
  closeBtn.addEventListener('click', () => window.close());

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.className = kind;
  }

  async function jsonRequest(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!response.ok || payload?.ok === false) {
      const error = new Error(payload?.error?.message || payload?.message || `Falha HTTP ${response.status}`);
      error.code = payload?.error?.code || '';
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }

  function toWebpBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível converter a imagem para WEBP.')), 'image/webp', quality);
    });
  }

  async function decodeImage(blob) {
    if ('createImageBitmap' in window) return createImageBitmap(blob);
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = objectUrl;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function convertToWebp(blob) {
    const source = await decodeImage(blob);
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    if (!width || !height) throw new Error('Não foi possível ler as dimensões da imagem.');

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas indisponível para conversão.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (typeof source.close === 'function') source.close();

    let result = null;
    for (const quality of [0.92, 0.86, 0.8, 0.74, 0.68, 0.6, 0.52]) {
      result = await toWebpBlob(canvas, quality);
      if (result.size <= TARGET_BYTES) break;
    }
    return result;
  }

  function notifyEditor(detail) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'asteryon:brand-logo-updated', detail }, location.origin);
      }
    } catch { /* noop */ }
    try {
      const channel = new BroadcastChannel('asteryon-brand-logo-v73');
      channel.postMessage(detail);
      channel.close();
    } catch { /* noop */ }
  }

  function showSuccess(logoUrl, message) {
    notifyEditor({ brandId, brandName, url: logoUrl });
    setStatus(message, 'success');
    grid.textContent = '';
    const box = document.createElement('div');
    box.className = 'successBox';
    const img = document.createElement('img');
    img.alt = `Logo aplicada em ${brandName}`;
    img.src = logoUrl;
    const label = document.createElement('strong');
    label.textContent = 'Imagem aplicada com sucesso.';
    box.append(img, label);
    grid.appendChild(box);
    setTimeout(() => window.close(), 1400);
  }

  async function uploadWebp(webp, source, provider) {
    setStatus(`Salvando a logo na marca (${Math.max(1, Math.round(webp.size / 1024))} KB)...`);
    const uploadUrl = `/api/admin/brand-images/upload?brandId=${encodeURIComponent(brandId)}&source=${encodeURIComponent(source || provider)}&provider=${encodeURIComponent(provider)}`;
    const payload = await jsonRequest(uploadUrl, {
      method: 'POST',
      headers: { 'content-type': 'image/webp' },
      body: webp,
    });
    return payload.url || payload.brand?.logoUrl || '';
  }

  async function chooseImage(image, button) {
    button.disabled = true;
    try {
      setStatus('Baixando a imagem original selecionada...');
      const proxyUrl = `/api/admin/brand-images/fetch?url=${encodeURIComponent(image.url)}&sig=${encodeURIComponent(image.signature)}`;
      const sourceResponse = await fetch(proxyUrl, { credentials: 'same-origin' });
      if (!sourceResponse.ok) {
        let message = `Falha ao baixar a imagem (${sourceResponse.status})`;
        try { message = (await sourceResponse.json())?.error?.message || message; } catch { /* noop */ }
        throw new Error(message);
      }

      const sourceBlob = await sourceResponse.blob();
      setStatus('Convertendo para WEBP e otimizando a logo...');
      const webp = await convertToWebp(sourceBlob);
      const provider = String(image.provider || 'web').toLowerCase();
      const logoUrl = await uploadWebp(webp, image.sourceUrl || image.url, provider);
      showSuccess(logoUrl, 'Logo convertida, salva e vinculada à marca com sucesso.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao aplicar a imagem.', 'error');
      button.disabled = false;
    }
  }

  async function chooseManualFile(file) {
    if (!brandId) throw new Error('Marca não identificada.');
    if (!file) return;
    const type = String(file.type || '').toLowerCase();
    if (!ALLOWED_SOURCE_TYPES.has(type)) throw new Error('Formato não permitido. Use PNG, JPG/JPEG ou WEBP.');
    if (file.size <= 0) throw new Error('O arquivo selecionado está vazio.');
    if (file.size > MAX_SOURCE_BYTES) throw new Error('A imagem manual deve ter no máximo 15 MB.');

    setStatus(`Processando arquivo manual "${file.name}"...`);
    const webp = await convertToWebp(file);
    const logoUrl = await uploadWebp(webp, `manual:${file.name}`, 'manual');
    showSuccess(logoUrl, 'Logo enviada manualmente, convertida para WEBP e vinculada à marca com sucesso.');
  }

  manualUploadBtn?.addEventListener('click', () => {
    if (!brandId) {
      setStatus('Marca não identificada. Feche esta janela e abra novamente pela lista de marcas.', 'error');
      return;
    }
    manualFile.value = '';
    manualFile.click();
  });

  manualFile?.addEventListener('change', async () => {
    const file = manualFile.files?.[0];
    if (!file) return;
    manualUploadBtn.disabled = true;
    try {
      await chooseManualFile(file);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao enviar a logo manualmente.', 'error');
      manualUploadBtn.disabled = false;
    }
  });

  function providerLabel(image) {
    return String(image?.provider || '').toLowerCase() === 'google' ? 'Google Imagens' : 'Pesquisa na web';
  }

  function render(images) {
    grid.textContent = '';
    if (!images.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Nenhuma imagem compatível foi encontrada. Você também pode usar “Enviar logo manualmente”.';
      grid.appendChild(empty);
      return;
    }

    for (const image of images) {
      const card = document.createElement('article');
      card.className = 'card';

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.alt = image.title || brandName;
      img.src = image.thumbnailUrl || image.url;
      thumb.appendChild(img);

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${image.title || brandName} · ${providerLabel(image)}`;

      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'use';
      use.textContent = 'Usar esta imagem';
      use.addEventListener('click', () => chooseImage(image, use));

      card.append(thumb, meta, use);
      grid.appendChild(card);
    }
  }

  async function load() {
    if (!brandId) {
      setStatus('Marca não identificada. Feche esta janela e abra novamente pela lista de marcas.', 'error');
      render([]);
      return;
    }

    if (mode === 'manual') {
      setStatus('Modo manual: escolha uma imagem do computador. O sistema converterá para WEBP e vinculará à marca.');
      grid.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Clique em “Enviar logo manualmente” para selecionar PNG, JPG/JPEG ou WEBP.';
      grid.appendChild(empty);
      return;
    }

    try {
      setStatus(`Pesquisando na web por "${brandName} logo"...`);
      const payload = await jsonRequest(`/api/admin/brand-images/search?brandId=${encodeURIComponent(brandId)}`);
      const images = Array.isArray(payload.images) ? payload.images : [];
      setStatus(payload.providerMessage || `${images.length} resultado(s) encontrados. Escolha uma imagem existente para converter e anexar à marca.`);
      render(images);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao pesquisar imagens na web.';
      setStatus(message, 'error');
      grid.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Não foi possível carregar resultados da pesquisa. Você pode usar “Enviar logo manualmente”.';
      grid.appendChild(empty);
    }
  }

  load();
})();
