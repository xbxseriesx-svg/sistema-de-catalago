(() => {
  'use strict';

  const EVENT = 'asteryon:import-progress';
  let preciseEvents = false;
  let cumulative = 0;

  window.addEventListener(EVENT, (event) => {
    if (event.detail?.mode === 'excel' && !event.detail?.fallback) preciseEvents = true;
  });

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, window.location.href); }
    catch { return nativeFetch(input, init); }

    const method = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const isBulk = method === 'POST' && url.pathname === '/api/admin/catalog/products/bulk';
    if (!isBulk || preciseEvents) return nativeFetch(input, init);

    let products = [];
    let filename = '';
    try {
      const rawBody = typeof init.body === 'string' ? init.body : '';
      const payload = rawBody ? JSON.parse(rawBody) : {};
      products = Array.isArray(payload.products) ? payload.products : [];
      filename = String(payload.filename || 'planilha').trim();
    } catch { /* o envio original continua normalmente */ }

    const items = products.slice(0, 5).map((product) => ({
      code: product?.code ?? product?.codigo ?? '',
      name: product?.name ?? product?.shortDescription ?? product?.description ?? product?.descricao ?? '',
    }));

    if (products.length) {
      window.dispatchEvent(new CustomEvent(EVENT, {
        detail: {
          mode: 'excel',
          stage: 'importing',
          fallback: true,
          file: filename,
          processed: 0,
          total: products.length,
          currentItems: items,
          cumulative,
        },
      }));
    }

    try {
      const response = await nativeFetch(input, init);
      if (products.length) {
        if (response.ok) cumulative += products.length;
        window.dispatchEvent(new CustomEvent(EVENT, {
          detail: {
            mode: 'excel',
            stage: response.ok ? 'importing' : 'error',
            fallback: true,
            file: filename,
            processed: response.ok ? products.length : 0,
            total: products.length,
            currentItems: items,
            cumulative,
            message: response.ok ? '' : `Falha ao importar lote com ${products.length} produto(s).`,
          },
        }));
      }
      return response;
    } catch (error) {
      window.dispatchEvent(new CustomEvent(EVENT, {
        detail: {
          mode: 'excel',
          stage: 'error',
          fallback: true,
          file: filename,
          processed: 0,
          total: products.length,
          currentItems: items,
          cumulative,
          message: error instanceof Error ? error.message : 'Falha de rede durante a importação.',
        },
      }));
      throw error;
    }
  };
})();
