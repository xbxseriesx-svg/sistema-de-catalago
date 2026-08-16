import { readFile } from 'node:fs/promises';
const source = await readFile('public/assets/index-V60Excel.js', 'utf8');
for (const needle of ['function an(', 'const an=', 'an=()=>', 'an(){', 'function JH({children:e})']) {
  const index = source.indexOf(needle);
  console.log(`\n=== ${needle} @ ${index} ===`);
  if (index >= 0) console.log(source.slice(Math.max(0,index-1600), Math.min(source.length,index+needle.length+2600)));
}
