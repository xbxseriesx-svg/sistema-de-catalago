(() => {
  'use strict';

  const MARKER = 'data-marketing-hotfix';
  const PERF_MARKER = 'ASTER_V88_MARKETING_PERFORMANCE';
  const MIN_W = 240;
  const MIN_H = 140;

  let config = null;
  let configLoaded = false;
  let configPromise = null;
  let element = null;
  let interval = null;
  let mountTimer = 0;
  let dragRaf = 0;
  let pendingPointer = null;

  const api = async (path, options) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error?.message || payload.message || `HTTP ${response.status}`);
    return payload;
  };

  const normalizeLayout = value => ({
    x: Math.max(0, Number(value?.x) || 0),
    y: Math.max(0, Number(value?.y) || 0),
    width: Math.max(MIN_W, Number(value?.width) || 1440),
    height: Math.max(MIN_H, Number(value?.height) || 560),
    zIndex: Math.max(1, Math.round(Number(value?.zIndex) || 700)),
    visible: value?.visible !== false,
  });

  const active = data => Boolean(data?.banner?.active || data?.videoBanner?.active || (data?.carousel?.active && data.carousel.items?.length));

  const canvas = () => {
    const background = document.querySelector('[data-canvas-bg="true"]');
    return background?.firstElementChild || null;
  };

  const loadConfigOnce = async () => {
    if (configLoaded) return config;
    if (configPromise) return configPromise;
    configPromise = api('/api/public/marketing')
      .then((payload) => {
        config = payload.marketing || null;
        configLoaded = true;
        return config;
      })
      .catch((error) => {
        console.warn('ASTERYON V88: falha ao carregar Marketing.', error);
        return null;
      })
      .finally(() => { configPromise = null; });
    return configPromise;
  };

  const save = async () => {
    if (!config) return;
    const payload = await api('/api/admin/marketing', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ marketing: config }),
    });
    config = payload.marketing || config;
    configLoaded = true;
  };

  const applyLayout = () => {
    if (!element || !config) return;
    const layout = normalizeLayout(config.layout);
    config.layout = layout;
    Object.assign(element.style, {
      left: `${layout.x}px`,
      top: `${layout.y}px`,
      width: `${layout.width}px`,
      height: `${layout.height}px`,
      zIndex: String(layout.zIndex),
      display: layout.visible && active(config) ? 'block' : 'none',
    });
  };

  const showSlide = index => {
    if (!element || !config) return;
    const viewport = element.querySelector('[data-marketing-viewport]');
    if (!viewport) return;
    const banner = config.banner || {};
    const video = config.videoBanner || {};
    const slides = config.carousel?.items || [];
    viewport.replaceChildren();
    if (banner.active && banner.mediaUrl) {
      const media = document.createElement(banner.mediaType === 'video' ? 'video' : 'img');
      media.src = banner.mediaUrl;
      media.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      if (media instanceof HTMLVideoElement) {
        media.autoplay = banner.autoplay !== false;
        media.loop = banner.loop !== false;
        media.muted = banner.muted !== false;
        media.playsInline = true;
      }
      viewport.append(media);
    } else if (video.active && video.mediaUrl) {
      const media = document.createElement('video');
      media.src = video.mediaUrl;
      media.autoplay = video.autoplay !== false;
      media.loop = video.loop !== false;
      media.muted = video.muted !== false;
      media.controls = Boolean(video.controls);
      media.playsInline = true;
      media.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      viewport.append(media);
    } else if (slides.length) {
      const slide = slides[index % slides.length];
      const media = document.createElement('img');
      media.src = slide.url;
      media.alt = slide.alt || '';
      media.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      viewport.append(media);
    }
  };

  const drag = (event, direction) => {
    event.preventDefault();
    event.stopPropagation();
    const start = { ...normalizeLayout(config.layout) };
    const targetCanvas = canvas();
    const zoom = Number(getComputedStyle(targetCanvas).transform.match(/matrix\(([^,]+)/)?.[1]) || 1;
    const startX = event.clientX;
    const startY = event.clientY;

    const applyPointer = (pointer) => {
      const dx = (pointer.clientX - startX) / Math.max(.1, zoom);
      const dy = (pointer.clientY - startY) / Math.max(.1, zoom);
      let { x, y, width, height } = start;
      if (direction === 'move') { x += dx; y += dy; }
      if (direction.includes('e')) width += dx;
      if (direction.includes('s')) height += dy;
      if (direction.includes('w')) { x += dx; width -= dx; }
      if (direction.includes('n')) { y += dy; height -= dy; }
      if (width < MIN_W) { if (direction.includes('w')) x -= MIN_W - width; width = MIN_W; }
      if (height < MIN_H) { if (direction.includes('n')) y -= MIN_H - height; height = MIN_H; }
      config.layout = {
        ...start,
        x: Math.round(Math.max(0, x)),
        y: Math.round(Math.max(0, y)),
        width: Math.round(width),
        height: Math.round(height),
      };
      applyLayout();
    };

    const move = pointer => {
      pendingPointer = pointer;
      if (dragRaf) return;
      dragRaf = requestAnimationFrame(() => {
        dragRaf = 0;
        const next = pendingPointer;
        pendingPointer = null;
        if (next) applyPointer(next);
      });
    };

    const up = async (pointer) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (dragRaf) cancelAnimationFrame(dragRaf);
      dragRaf = 0;
      if (pendingPointer) applyPointer(pendingPointer);
      else if (pointer) applyPointer(pointer);
      pendingPointer = null;
      document.body.style.cursor = '';
      try { await save(); } catch (error) { alert(`Falha ao salvar posição: ${error.message}`); }
    };

    document.body.style.cursor = direction === 'move' ? 'move' : `${direction}-resize`;
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { once: true });
  };

  const button = (text, title, action) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = text;
    item.title = title;
    item.style.cssText = 'border:1px solid #3f3f46;border-radius:5px;padding:4px 8px;background:#18181b;color:#f4f4f5;font:800 10px Inter,sans-serif;cursor:pointer';
    item.addEventListener('pointerdown', event => event.stopPropagation());
    item.addEventListener('click', event => { event.stopPropagation(); action(); });
    return item;
  };

  const createElement = (target) => {
    config.layout = normalizeLayout(config.layout);
    document.querySelectorAll('span').forEach(span => {
      if (span.textContent?.includes('Marketing visível no modo de edição')) span.parentElement?.parentElement?.setAttribute('hidden', '');
    });

    element = document.createElement('section');
    element.setAttribute(MARKER, 'true');
    element.style.cssText = 'position:absolute;overflow:hidden;box-sizing:border-box;border:2px solid #ec4899;background:#fff;box-shadow:0 12px 36px rgba(0,0,0,.28)';

    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-marketing-drag-handle', 'true');
    toolbar.style.cssText = 'position:absolute;inset:0 0 auto 0;z-index:20;height:32px;display:flex;align-items:center;gap:8px;padding:0 8px;background:rgba(9,9,11,.94);color:#f4f4f5;cursor:move;font:800 10px Inter,sans-serif;text-transform:uppercase;letter-spacing:.08em';
    const label = document.createElement('span');
    label.textContent = 'Marketing · arraste para mover';
    label.style.flex = '1';
    toolbar.append(label);
    toolbar.append(button('Editar', 'Abrir Marketing', () => [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === 'Marketing')?.click()));
    toolbar.append(button('Excluir', 'Excluir marketing', async () => {
      if (!confirm('Excluir todo o marketing e as imagens do carrossel?')) return;
      const ids = (config.carousel?.items || []).map(item => item.url?.match(/\/api\/public\/media\/([^/?#]+)/)?.[1]).filter(Boolean);
      config = {
        ...config,
        banner: { ...config.banner, active: false, mediaUrl: '' },
        videoBanner: { ...config.videoBanner, active: false, mediaUrl: '' },
        carousel: { ...config.carousel, active: false, items: [] },
        layout: { ...config.layout, visible: false },
      };
      configLoaded = true;
      await save();
      await Promise.allSettled(ids.map(id => api(`/api/admin/media/${encodeURIComponent(id)}`, { method: 'DELETE' })));
      element.remove();
      element = null;
      clearInterval(interval);
      interval = null;
    }));
    toolbar.addEventListener('pointerdown', event => drag(event, 'move'));

    const viewport = document.createElement('div');
    viewport.setAttribute('data-marketing-viewport', 'true');
    viewport.style.cssText = 'position:absolute;inset:32px 0 0;overflow:hidden';
    element.append(toolbar, viewport);

    for (const direction of ['n','s','e','w','ne','nw','se','sw']) {
      const handle = document.createElement('div');
      handle.setAttribute('data-marketing-resize', direction);
      handle.style.cssText = 'position:absolute;z-index:25;background:#ec4899;border:2px solid white;border-radius:3px;';
      if (direction.includes('n')) Object.assign(handle.style, { top: '-5px', height: '12px' });
      if (direction.includes('s')) Object.assign(handle.style, { bottom: '-5px', height: '12px' });
      if (direction.includes('w')) Object.assign(handle.style, { left: '-5px', width: '12px' });
      if (direction.includes('e')) Object.assign(handle.style, { right: '-5px', width: '12px' });
      if (direction === 'n' || direction === 's') Object.assign(handle.style, { left: '12px', right: '12px', cursor: 'ns-resize', background: 'transparent', border: '0' });
      if (direction === 'e' || direction === 'w') Object.assign(handle.style, { top: '12px', bottom: '12px', cursor: 'ew-resize', background: 'transparent', border: '0' });
      if (direction.length === 2) Object.assign(handle.style, { cursor: `${direction}-resize` });
      handle.addEventListener('pointerdown', event => drag(event, direction));
      element.append(handle);
    }

    target.append(element);
    applyLayout();
    showSlide(0);
    let index = 0;
    clearInterval(interval);
    interval = setInterval(() => {
      if (config?.carousel?.autoplay !== false) showSlide(++index);
    }, Math.max(2000, 5000 / Math.max(.25, Number(config.carousel?.speed) || 1)));
  };

  const mount = async () => {
    mountTimer = 0;
    if (location.pathname !== '/admin') return;
    if (element?.isConnected) return;
    if (element && !element.isConnected) element = null;

    const target = canvas();
    if (!target) return;

    if (!configLoaded) await loadConfigOnce();
    if (!configLoaded || !active(config)) return;
    if (!element) createElement(target);
  };

  const scheduleMount = (delay = 100) => {
    window.clearTimeout(mountTimer);
    mountTimer = window.setTimeout(() => void mount(), delay);
  };

  // V88: o observer não chama mais a API em toda mutação. Ele só tenta remontar
  // quando um canvas novo aparece e já existe Marketing ativo em memória.
  const observer = new MutationObserver((records) => {
    if (element?.isConnected) return;
    if (configLoaded && !active(config)) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('[data-canvas-bg="true"]') || node.querySelector?.('[data-canvas-bg="true"]')) {
          scheduleMount(80);
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const updateFromEvent = (detail) => {
    if (!detail) return;
    config = { ...detail, layout: config?.layout || detail.layout };
    configLoaded = true;
    if (active(config)) {
      if (!element?.isConnected) scheduleMount(0);
      else { applyLayout(); showSlide(0); }
    } else if (element) {
      applyLayout();
    }
  };

  window.addEventListener('asteryon:marketing-live', event => updateFromEvent(event.detail));
  window.addEventListener('asteryon:marketing-updated', event => updateFromEvent(event.detail));

  void PERF_MARKER;
  scheduleMount(0);
})();
