import assert from 'node:assert/strict';

await import('../public/public-brand-popup-fix-v83.js');
const api = globalThis.__ASTERYON_BRAND_POPUP_FIX_TEST__;
assert.ok(api, 'Runtime V85 precisa expor helpers de teste fora do navegador.');

const page = {
  page: {
    nodes: [{
      id: 'root',
      type: 'page',
      children: [
        { id: 'brand-art', type: 'brand', props: { actionType: 'brand-page', actionContext: 'brand', actionEntityId: 'b-art', actionValue: 'b-art' } },
        { id: 'brand-hershey', type: 'brand', props: { actionType: 'brand-page', actionContext: 'brand', actionEntityId: 'b-hershey' } },
        { id: 'generic', type: 'shape', props: { actionEntityId: 'b-art' } },
      ],
    }],
  },
};
const brands = {
  brands: [
    { id: 'b-art', slug: 'art-fritas', name: 'ART FRITAS', logoUrl: 'https://example.invalid/art.webp' },
    { id: 'b-hershey', slug: 'hershey-s', name: "HERSHEY'S", logoUrl: null },
  ],
};

const normalized = api.normalizeBrands(brands);
assert.equal(normalized.length, 2);
assert.equal(normalized[0].logoUrl, 'https://example.invalid/art.webp');
assert.equal(normalized[1].logoUrl, '');
assert.equal(api.brandKeyFromPageNode(page.page.nodes[0].children[0]), 'b-art');
assert.equal(api.brandKeyFromPageNode(page.page.nodes[0].children[2]), '');
assert.equal(api.resolveBrand('art-fritas', normalized)?.id, 'b-art');
assert.equal(api.resolveBrand("HERSHEY'S", normalized)?.id, 'b-hershey');

const plan = api.buildBindingPlan(page, brands);
assert.deepEqual(plan.map((item) => item.nodeId), ['brand-art', 'brand-hershey']);
assert.equal(plan[0].brand.name, 'ART FRITAS');
assert.equal(plan[0].brand.logoUrl, 'https://example.invalid/art.webp');
assert.equal(plan[1].brand.name, "HERSHEY'S");
assert.equal(plan[1].brand.logoUrl, '');

console.log('QA Brand Node Popup V85: OK — vínculo determinístico, logo real e fallback por nome validados.');
