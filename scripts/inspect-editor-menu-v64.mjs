import { readFile } from 'node:fs/promises';

const source = await readFile('public/assets/index-V60Excel.js', 'utf8');

function dump(label, needle, back, forward) {
  const index = source.indexOf(needle);
  console.log(`\n=== ${label} @ ${index} ===`);
  if (index >= 0) console.log(source.slice(Math.max(0, index - back), Math.min(source.length, index + forward)));
  console.log(`\n=== /${label} ===`);
}

console.log(`bundle bytes=${source.length}`);
dump('EDITOR NJ', 'function NJ({cloudUser:e})', 500, 18000);
dump('PUBLIC MENU COMPONENT', 'function mJ({products:e,hierarchy:t,theme:a})', 500, 5000);
dump('PUBLIC MENU CALL', 'l.jsx(mJ,{products:a,hierarchy:o,theme:A})', 2500, 3500);
