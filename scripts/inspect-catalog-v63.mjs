import { readFile } from 'node:fs/promises';

const source = await readFile('public/assets/index-V60Excel.js', 'utf8');
const needles = ['["Atacado","Distribuição"]','produto(s) encontrado(s)','function JH({children:e})'];
console.log(`bundle bytes=${source.length}`);
for (const needle of needles) {
  let offset = 0;
  let count = 0;
  while (count < 20) {
    const index = source.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    const back = needle === 'produto(s) encontrado(s)' ? 3200 : 1300;
    const forward = needle === 'produto(s) encontrado(s)' ? 1600 : 1800;
    const start = Math.max(0, index - back);
    const end = Math.min(source.length, index + needle.length + forward);
    console.log(`\n=== ${needle} #${count} @ ${index} ===\n${source.slice(start, end)}\n=== /${needle} ===`);
    offset = index + needle.length;
  }
  if (!count) console.log(`\n=== ${needle}: NOT FOUND ===`);
}
