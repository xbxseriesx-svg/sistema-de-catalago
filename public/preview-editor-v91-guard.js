(() => {
  'use strict';
  if (window.__ASTERYON_PREVIEW_EDITOR_V91_GUARD__) return;
  window.__ASTERYON_PREVIEW_EDITOR_V91_GUARD__ = true;
  const S = window.__ASTERYON_V91_STATE__;
  if (!S) return;

  function selectedWrapper() {
    return [...document.querySelectorAll('[data-node-id]')].find((item) => item.querySelector('[style*="nwse-resize"],[style*="nesw-resize"],[style*="ns-resize"],[style*="ew-resize"]')) || null;
  }

  function syncBrandCard(event) {
    if (!S.isEditor() || !(event.target instanceof HTMLSelectElement)) return;
    const select = event.target;
    const label = S.normalize(select.parentElement?.querySelector('span,label')?.textContent || select.parentElement?.textContent || '');
    if (!label.startsWith('marca')) return;
    const brand = S.findBrand(select.value);
    const logo = S.brandLogo(brand);
    if (!brand || !logo) return;

    const selected = selectedWrapper();
    if (!selected) return;
    const linkedImage = selected.matches('img') ? selected : selected.querySelector('img');
    const imageWrapper = linkedImage?.closest('[data-node-id]');
    const ids = new Set([
      selected.getAttribute('data-node-id'),
      imageWrapper?.getAttribute('data-node-id'),
    ].filter(Boolean));
    const override = { brandId: S.brandId(brand), src: logo, name: S.clean(brand.name) };

    ids.forEach((id) => {
      S.brandOverrides.set(id, override);
      const item = S.capturedNodeIndex.get(id);
      if (item?.props) Object.assign(item.props, {
        brandId: override.brandId,
        brandName: override.name,
        ...(item.type === 'image' || item.props.brandLogoAuto ? { src: override.src, brandLogoAuto: true } : {}),
        actionContext: 'brand', actionType: 'brand-page', actionEntityId: override.brandId, actionValue: override.brandId,
      });
    });
    if (linkedImage) {
      linkedImage.setAttribute('src', logo);
      linkedImage.setAttribute('alt', override.name);
    }
  }

  document.addEventListener('change', syncBrandCard, true);
  window.__ASTERYON_V91_BRAND_GUARD__ = Object.freeze({
    rule: 'trocar a marca vinculada atualiza card + logo e persiste ambos no mesmo vínculo',
  });
})();
