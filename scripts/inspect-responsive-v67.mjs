import { readFile } from 'node:fs/promises';

const source = await readFile('public/assets/index-V60Excel.js', 'utf8');
const needles = [
  'innerWidth',
  'visualViewport',
  'orientationchange',
  'responsive',
  'desktop',
  'tablet',
  'mobile',
  'function Gj(',
  'function wJ(',
  'function vJ(',
  'responsive?.',
  '.responsive',
];

for (const needle of needles) {
  let offset = 0;
  let found = 0;
  while (found < 4) {
    const at = source.indexOf(needle, offset);
    if (at < 0) break;
    found += 1;
    const before = Math.max(0, at - 1000);
    const after = Math.min(source.length, at + needle.length + 1800);
    console.log(`\n--- ${needle} #${found} @${at} ---\n${source.slice(before, after)}\n--- /${needle} ---`);
    offset = at + needle.length;
  }
  if (!found) console.log(`\n--- ${needle}: NOT FOUND ---`);
}
