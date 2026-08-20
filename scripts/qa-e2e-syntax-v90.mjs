import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['tests/e2e'];
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.mjs') || path.endsWith('.js')) files.push(path);
  }
}

for (const root of roots) walk(root);
if (!files.length) throw new Error('Nenhum teste E2E encontrado para validar.');

for (const file of files.sort()) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

console.log(`QA V90 E2E syntax: ${files.length} arquivos válidos antes do Playwright.`);
