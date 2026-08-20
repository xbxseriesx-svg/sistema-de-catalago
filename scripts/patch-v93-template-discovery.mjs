import fs from 'node:fs';

const file = 'public/preview-editor-v93-source.js';
let source = fs.readFileSync(file, 'utf8');

const oldNames = `  const CURRENT_TEMPLATES = new Set([\n    'varejo contínuo','atacado b2b','distribuidora institucional','catálogo de marcas b2b',\n    'distribuidora união • figma b2b','catálogo hierárquico b2b','vitrine atacado pro','modelo oficial',\n  ]);`;
const newNames = `  const CURRENT_TEMPLATES = new Set([\n    'varejo continuo','atacado b2b','distribuidora institucional','catalogo de marcas b2b',\n    'distribuidora uniao • figma b2b','catalogo hierarquico b2b','vitrine atacado pro','modelo oficial',\n  ]);`;
if (source.includes(oldNames)) source = source.replace(oldNames, newNames);
if (!source.includes("'varejo continuo','atacado b2b'")) throw new Error('V93: lista normalizada das templates não foi materializada.');

const oldRoot = `    const root = title.closest('div')?.parentElement || title.parentElement;\n    for (const article of root?.querySelectorAll('article') || []) {`;
const newRoot = `    let root = title.parentElement;\n    while (root && root !== document.body && root.querySelectorAll('article').length === 0) root = root.parentElement;\n    if (!root || root === document.body) return;\n    for (const article of root.querySelectorAll('article')) {`;
if (source.includes(oldRoot)) source = source.replace(oldRoot, newRoot);
if (!source.includes("while (root && root !== document.body && root.querySelectorAll('article').length === 0)")) {
  throw new Error('V93: busca robusta do contêiner das templates não foi materializada.');
}

const badBrandGuard = `      if (element.closest('.ltp-brand-grid') && !element.classList.contains('ltp-brand-grid')) {\n        const grid = element.closest('.ltp-brand-grid');\n        if (grid !== element.parentElement) return null;\n      }\n`;
if (source.includes(badBrandGuard)) source = source.replace(badBrandGuard, '');
if (source.includes("if (grid !== element.parentElement) return null;")) {
  throw new Error('V93: guarda que descartava filhos reais dos cards de marca ainda está presente.');
}

fs.writeFileSync(file, source);
console.log('V93: descoberta das templates e captura completa dos cards de marca corrigidas.');