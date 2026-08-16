import { readFile } from 'node:fs/promises';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');

function printRange(label, startNeedle, endNeedle, extra = 0) {
  const start = bundle.indexOf(startNeedle);
  const end = bundle.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || end < 0) {
    console.log(`${label}: NOT FOUND (${start}, ${end})`);
    return;
  }
  console.log(`\n=== ${label} ===\n${bundle.slice(start, Math.min(bundle.length, end + extra))}\n=== /${label} ===`);
}

printRange('TEMPLATES_A', 'const aJ=', 'function rJ()', 0);
printRange('TEMPLATES_U', 'const uJ=', 'function pJ()', 0);

const markers = ['function JY()', 'function eJ()', 'function tJ()', 'function lJ()', 'function dJ()', 'function hJ()'];
for (let i = 0; i < markers.length; i += 1) {
  const start = bundle.indexOf(markers[i]);
  const next = markers.slice(i + 1).map((m) => bundle.indexOf(m, start + 1)).find((n) => n > start);
  const fallback = bundle.indexOf('const uJ=', start);
  const end = next || (fallback > start ? fallback : Math.min(bundle.length, start + 12000));
  if (start >= 0) console.log(`\n=== ${markers[i]} ===\n${bundle.slice(start, end)}\n=== /${markers[i]} ===`);
}
