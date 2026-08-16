(() => {
  'use strict';

  const IMAGE_IMPORT_URL = '/importar-imagens.html';

  function normalizedText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isImagesImportControl(target) {
    if (!(target instanceof Element)) return false;
    const control = target.closest('button, [role="tab"], a, [tabindex]');
    if (!control) return false;

    const label = normalizedText(control.textContent);
    if (label !== 'imagens' && !label.endsWith(' imagens')) return false;

    // Restringe o hotfix exclusivamente ao seletor Planilha/Imagens da tela
    // Gestão do Catálogo > Importar, evitando interferir em outros botões de mídia.
    let scope = control.parentElement;
    for (let depth = 0; scope && depth < 6; depth += 1, scope = scope.parentElement) {
      const text = normalizedText(scope.textContent);
      if (text.includes('planilha') && text.includes('imagens') &&
          (text.includes('obrigatórios: código') || text.includes('obrigatorios: codigo'))) {
        return true;
      }
    }
    return false;
  }

  function openImageImporter(event) {
    if (!isImagesImportControl(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    window.location.assign(IMAGE_IMPORT_URL);
  }

  // Captura antes dos handlers do bundle/React para impedir que o clique em
  // "Imagens" seja tratado pelo painel de planilha.
  document.addEventListener('click', openImageImporter, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!isImagesImportControl(event.target)) return;
    openImageImporter(event);
  }, true);
})();
