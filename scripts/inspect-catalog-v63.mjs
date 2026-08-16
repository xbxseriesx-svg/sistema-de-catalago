import { readFile } from 'node:fs/promises';

const source = await readFile('public/assets/index-V60Excel.js', 'utf8');
const needles = [
  'Solaris',
  '30001',
  '30002',
  'Campo Alto',
  'produto(s) encontrado(s)',
  'localStorage',
  'sessionStorage',
  '/api/admin/catalog',
  'reloadCatalog',
  'departamentos',
  'Departamento',
];

console.log(`bundle bytes=${source.length}`);
for (const needle of needles) {
  let offset = 0;
  let count = 0;
  while (count < 8) {
    const index = source.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    const start = Math.max(0, index - 450);
    const end = Math.min(source.length, index + needle.length + 850);
    console.log(`\n=== ${needle} #${count} @ ${index} ===\n${source.slice(start, end)}\n=== /${needle} ===`);
    offset = index + needle.length;
  }
  if (!count) console.log(`\n=== ${needle}: NOT FOUND ===`);
}
