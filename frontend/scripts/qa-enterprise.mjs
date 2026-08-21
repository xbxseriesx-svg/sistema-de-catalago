import fs from 'node:fs';
const checks = {
  'src/editor/types.ts': ['1080p / Full HD', '2K / QHD', '4K / UHD'],
  'src/editor/components/Toolbar.tsx': ['ASTERYON V94', 'Aplicar 3 modos', 'Publicar', 'Salvar'],
  'src/editor/store.ts': ['saveAllModes', 'applyCurrentFrameToAllModes', 'RESOLUTION_PRESETS', 'responsive.desktop'],
  'src/editor/components/NodeView.tsx': ['object-contain', 'case "carousel"', 'case "promotion"'],
  'src/editor/usePersistence.ts': ['schemaVersion: 5', '850', 'saveRemoteDraft', 'asteryon:manual-save'],
  'src/editor/persistence.ts': ['/api/auth/status', '/api/auth/login', '/api/admin/pages/', '/api/admin/media', '/api/public/pages/', 'serializeForLegacyStorage'],
  'src/editor/documentAdapter.ts': ['normalizePersistedDocument', 'serializeForLegacyStorage', 'responsive: { tablet, mobile }'],
  'src/routes/catalogo.tsx': ['PublishedDocument'],
  'src/editor/components/MarketingPreview.tsx': ['Carrossel', 'object-contain'],
};
for (const [file, needles] of Object.entries(checks)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) if (!text.includes(needle)) throw new Error(`${file}: ausente ${needle}`);
}
const all = fs.readdirSync('src', { recursive: true })
  .filter((entry) => /\.(?:ts|tsx|js|jsx)$/.test(String(entry)))
  .map((entry) => fs.readFileSync(`src/${entry}`, 'utf8'))
  .join('\n');
if (all.includes('ASTERYON V5')) throw new Error('Frontend ainda anuncia V5 como versão da aplicação');
for (const forbidden of ['D1Database', 'R2Bucket', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', '/rest/v1/', '/storage/v1/', '/auth/v1/', 'getSupabase(']) {
  if (all.includes(forbidden)) throw new Error(`Referência proibida no frontend Enterprise: ${forbidden}`);
}
console.log('QA frontend Enterprise estrutural: OK');
