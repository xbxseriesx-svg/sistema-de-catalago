import fs from 'node:fs';
const databaseId = process.env.D1_DATABASE_ID;
if (!databaseId) throw new Error('D1_DATABASE_ID não informado');
const config = {
  name: 'sistema-de-catalago',
  main: 'worker/index.ts',
  compatibility_date: '2026-08-13',
  assets: { directory: './dist', binding: 'ASSETS', not_found_handling: 'single-page-application', run_worker_first: ['/api/*'] },
  d1_databases: [{ binding: 'DB', database_name: 'sistema-de-catalago', database_id: databaseId, migrations_dir: 'migrations' }],
  observability: { enabled: true },
};
fs.writeFileSync('wrangler.deploy.jsonc', JSON.stringify(config, null, 2));
console.log(`wrangler.deploy.jsonc criado para D1 ${databaseId}`);
