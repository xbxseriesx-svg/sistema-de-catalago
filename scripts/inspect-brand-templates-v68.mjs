import { readFile } from 'node:fs/promises';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');
const needles = [
  'Template', 'template', 'Modelo', 'modelo', 'theme', 'colorPrimary', 'colorSecondary',
  'backgroundColor', 'Tema', 'tema', 'preset', 'Preset', 'palette', 'Paleta'
];

for (const needle of needles) {
  let offset = 0;
  let count = 0;
  while (count < 12) {
    const at = bundle.indexOf(needle, offset);
    if (at < 0) break;
    count += 1;
    const start = Math.max(0, at - 900);
    const end = Math.min(bundle.length, at + needle.length + 1500);
    console.log(`\n--- ${needle} #${count} @${at} ---\n${bundle.slice(start, end)}\n--- /${needle} ---`);
    offset = at + needle.length;
  }
  if (!count) console.log(`\n--- ${needle}: NOT FOUND ---`);
}
