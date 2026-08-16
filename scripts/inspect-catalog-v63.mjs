import { readFile } from 'node:fs/promises';

const source = await readFile('public/assets/index-V60Excel.js', 'utf8');
const needles = ['ZH','XH','GH','KH','YH(','useState(ZH','products:ZH','hierarchy:','setProducts:', 'cloudLoading:'];
console.log(`bundle bytes=${source.length}`);
for (const needle of needles) {
  let offset = 0;
  let count = 0;
  while (count < 16) {
    const index = source.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    const start = Math.max(0, index - 700);
    const end = Math.min(source.length, index + needle.length + 1400);
    console.log(`\n=== ${needle} #${count} @ ${index} ===\n${source.slice(start, end)}\n=== /${needle} ===`);
    offset = index + needle.length;
  }
  if (!count) console.log(`\n=== ${needle}: NOT FOUND ===`);
}
