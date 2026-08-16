(() => {
  'use strict';

  const MAX_DIMENSION = 1400;
  const TARGET_BYTES = 300 * 1024;
  const params = new URLSearchParams(location.search);
  const brandId = String(params.get('brandId') || '').trim();
  const brandName = String(params.get('brandName') || '').trim();
  const status = document.getElementById('status');
  const grid = document.getElementById('grid');
  const brandNameNode = document.getElementById('brandName');
  const closeBtn = document.getElementById('closeBtn');

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

  async function chooseImage(image, button) {
    button.disabled = true;
    try {
      setStatus('Baixando a imagem original selecionada no Google Imagens...');
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

      setStatus(`Salvando a logo na marca (${Math.max(1, Math.round(webp.size / 1024))} KB)...`);
      const uploadUrl = `/api/admin/brand-images/upload?brandId=${encodeURIComponent(brandId)}&source=${encodeURIComponent(image.sourceUrl || image.url)}&provider=google`;
      const payload = await jsonRequest(uploadUrl, {
        method: 'POST',
        headers: { 'content-type': 'image/webp' },
        body: webp,
      });

      const logoUrl = payload.url || payload.brand?.logoUrl || '';
      notifyEditor({ brandId, brandName, url: logoUrl });
      setStatus('Logo do Google Imagens convertida, salva e vinculada à marca com sucesso.', 'success');

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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao aplicar a imagem.', 'error');
      button.disabled = false;
    }
  }

  function render(images) {
    grid.textContent = '';
    if (!images.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Nenhuma imagem compatível foi encontrada no Google Imagens.';
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
      meta.textContent = `${image.title || brandName} · Google Imagens`;

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
    try {
      setStatus(`Consultando Google Imagens por "logo ${brandName}"...`);
      const payload = await jsonRequest(`/api/admin/brand-images/search?provider=google&brandId=${encodeURIComponent(brandId)}`);
      const images = Array.isArray(payload.images) ? payload.images : [];
      if (payload.provider !== 'google') throw new Error('A resposta recebida não veio do Google Imagens.');
      setStatus(payload.providerMessage || `${images.length} resultado(s) encontrados no Google Imagens. Escolha uma imagem existente para converter e anexar à marca.`);
      render(images);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao pesquisar Google Imagens.';
      setStatus(message, 'error');
      grid.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = error?.code === 'GOOGLE_IMAGES_NOT_CONFIGURED'
        ? 'A busca Google ainda precisa das credenciais oficiais configuradas na Cloudflare.'
        : 'Não foi possível carregar resultados do Google Imagens.';
      grid.appendChild(empty);
    }
  }

  load();
})();