import fs from 'node:fs';

const file = 'tests/e2e/editor-functional-regressions.spec.mjs';
let source = fs.readFileSync(file, 'utf8');
const marker = 'ASTER_V93_LEGACY_FILLED_MOCK';
if (source.includes(marker)) {
  console.log('V93: mock preenchido do teste legado já aplicado.');
  process.exit(0);
}

const anchor = `const pageNode = {\n  id: 'page-qa', type: 'page', name: 'Página QA', x: 0, y: 0, width: 1440, height: 1800,\n  rotation: 0, zIndex: 0, visible: true, locked: false, opacity: 1,\n  styles: { backgroundColor: '#ffffff' }, props: {},\n  children: [{\n    id: 'qa-shape', type: 'shape', name: 'Forma QA', x: 120, y: 140, width: 220, height: 120,\n    rotation: 0, zIndex: 1, visible: true, locked: false, opacity: 1,\n    styles: { backgroundColor: '#214C8F', borderRadius: 12 }, props: {}, children: [],\n  }],\n};`;
if (!source.includes(anchor)) throw new Error('V93 mock: âncora pageNode não encontrada.');
const insert = `${anchor}\n\nconst ${marker} = true;\nconst qaImage = label => \`data:image/svg+xml,\${encodeURIComponent(\`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="260"><rect width="240" height="260" fill="#eef4fb"/><text x="120" y="135" text-anchor="middle" font-family="Arial" font-size="24" fill="#214C8F">\${label}</text></svg>\`)}\`;\nconst qaBrands = [\n  { id: 'brand-qa', name: 'Marca QA', slug: 'marca-qa', status: 'active', logoUrl: qaImage('MARCA QA') },\n  { id: 'brand-qa-2', name: 'Marca QA Dois', slug: 'marca-qa-dois', status: 'active', logoUrl: qaImage('MARCA 2') },\n];\nconst qaProducts = Array.from({ length: 8 }, (_, index) => ({\n  id: \`p\${index + 1}\`, code: \`00012\${index + 1}\`, name: \`Produto QA \${index + 1}\`, shortDescription: \`Produto QA \${index + 1}\`,\n  status: 'ativo', departamentoId: 'dep-qa', secaoId: 'sec-qa', categoriaId: 'cat-qa',\n  brandId: index % 2 ? 'brand-qa-2' : 'brand-qa', brandName: index % 2 ? 'Marca QA Dois' : 'Marca QA',\n  packaging: 'CX 12', image: qaImage(\`P\${index + 1}\`),\n}));`;
source = source.replace(anchor, insert);

const oldCatalogProducts = `        products: [{ id: 'p1', code: '000123', name: 'Produto QA', shortDescription: 'Produto QA', status: 'ativo', departamentoId: 'dep-qa', secaoId: 'sec-qa', categoriaId: 'cat-qa', brandId: 'brand-qa' }],\n        brands: [{ id: 'brand-qa', name: 'Marca QA', slug: 'marca-qa', status: 'active' }],`;
const newCatalogProducts = `        products: qaProducts,\n        brands: qaBrands,`;
if (!source.includes(oldCatalogProducts)) throw new Error('V93 mock: catálogo mínimo legado não encontrado.');
source = source.replace(oldCatalogProducts, newCatalogProducts);

const oldBrandRoute = `    if (path === '/api/admin/brands' || path === '/api/public/brands') return json({ ok: true, brands: [{ id: 'brand-qa', name: 'Marca QA', slug: 'marca-qa', status: 'active' }] });`;
const newBrandRoute = `    if (path === '/api/admin/brands' || path === '/api/public/brands') return json({ ok: true, brands: qaBrands });`;
if (!source.includes(oldBrandRoute)) throw new Error('V93 mock: rota de marca mínima não encontrada.');
source = source.replace(oldBrandRoute, newBrandRoute);

fs.writeFileSync(file, source);
console.log('V93: teste legado mobile agora usa catálogo realmente preenchido (8 produtos + 2 marcas + imagens).');
