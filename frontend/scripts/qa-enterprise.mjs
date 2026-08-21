import fs from 'node:fs';

const checks = {
  'src/main.tsx': ['RouterProvider', 'createRoot', './styles.css'],
  'src/editor/types.ts': ['1080p / Full HD', '2K / QHD', '4K / UHD'],
  'src/editor/components/Toolbar.tsx': ['ASTERYON V94', 'Aplicar 3 modos', 'Publicar', 'Salvar'],
  'src/editor/store.ts': ['saveAllModes', 'applyCurrentFrameToAllModes', 'RESOLUTION_PRESETS', 'responsive.desktop'],
  'src/editor/components/NodeView.tsx': ['object-contain', 'case "carousel"', 'case "promotion"'],
  'src/editor/usePersistence.ts': ['schemaVersion: 5', '850', 'saveRemoteDraft', 'asteryon:manual-save'],
  'src/editor/persistence.ts': ['/api/auth/status', '/api/auth/login', '/api/admin/pages/', '/api/admin/media', '/api/public/pages/', 'serializeForLegacyStorage'],
  'src/editor/documentAdapter.ts': ['normalizePersistedDocument', 'serializeForLegacyStorage', 'responsive: { tablet, mobile }'],
  'src/lib/ai.functions.ts': ['/api/admin/ai/test', '/api/admin/ai/chat', '/api/admin/ai/search', 'credentials: "include"'],
  'src/routes/catalogo.tsx': ['PublishedDocument'],
  'src/routes/index.tsx': ['overflow-y-auto', 'overscroll-contain'],
  'src/editor/components/MarketingPreview.tsx': ['Carrossel', 'object-contain'],
};
for (const [file, needles] of Object.entries(checks)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) if (!text.includes(needle)) throw new Error(`${file}: ausente ${needle}`);
}

for (const required of ['index.html', 'vite.config.ts']) {
  if (!fs.existsSync(required)) throw new Error(`Frontend SPA incompleto: ${required}`);
}
for (const removed of [
  'src/server.ts',
  'src/start.ts',
  'src/lib/ai-providers.server.ts',
  'src/lib/ai-search.server.ts',
  'src/lib/lovable-error-reporting.ts',
  'src/lib/error-capture.ts',
  'src/lib/error-page.ts',
]) {
  if (fs.existsSync(removed)) throw new Error(`Resíduo server-side precisa ser removido: ${removed}`);
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const dependency of ['@tanstack/react-start', '@tanstack/router-plugin', '@lovable.dev/vite-tanstack-config', 'nitro']) {
  if (pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]) throw new Error(`Dependência de runtime paralelo proibida: ${dependency}`);
}

const all = fs.readdirSync('src', { recursive: true })
  .filter((entry) => /\.(?:ts|tsx|js|jsx)$/.test(String(entry)))
  .map((entry) => fs.readFileSync(`src/${entry}`, 'utf8'))
  .join('\n');
for (const forbidden of [
  'ASTERYON V5',
  'D1Database',
  'R2Bucket',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  '/rest/v1/',
  '/storage/v1/',
  '/auth/v1/',
  'getSupabase(',
  'createServerFn',
  '@tanstack/react-start',
  '@lovable.dev/',
  'Lovable Generated Project',
]) {
  if (all.includes(forbidden)) throw new Error(`Referência proibida no frontend Enterprise: ${forbidden}`);
}
console.log('QA frontend Enterprise SPA: OK — runtime único, API same-origin e painéis roláveis.');
