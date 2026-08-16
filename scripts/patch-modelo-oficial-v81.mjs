import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/modelo-oficial.mjs';
const original = await readFile(path, 'utf8');
let source = original;

const replacements = [
  ['#183153', '#214C8F'],
  ['#10253F', '#123F7D'],
  ['#294D73', '#1E5EAA'],
  ['#E27D33', '#D13130'],
  ['#FFF0E4', '#FCEBEC'],
  ['#64748B', '#66758A'],
  ['#DDE5EE', '#DCE6F2'],
  ['#F5F7FA', '#F4F8FC'],
  ['#EAF1F8', '#EAF2FA'],
  ['#EEF2F7', '#F4F8FC'],
  ['#B9C8D8', '#DCE6F2'],
  ['rgba(16,37,63,', 'rgba(18,63,125,'],
];

for (const [from, to] of replacements) source = source.replaceAll(from, to);

for (const required of ['#214C8F', '#123F7D', '#D13130', '#DCE6F2', '#F4F8FC']) {
  if (!source.includes(required)) throw new Error(`Modelo Oficial V81 sem cor obrigatória ${required}.`);
}
for (const forbidden of ['#183153', '#10253F', '#294D73', '#E27D33', '#FFF0E4', '#DDE5EE', '#F5F7FA', '#EAF1F8']) {
  if (source.includes(forbidden)) throw new Error(`Modelo Oficial V81 ainda contém cor legada ${forbidden}.`);
}

if (source === original) {
  console.log('Paleta do Modelo Oficial V81 já materializada.');
} else {
  await writeFile(path, source);
  console.log('Paleta do Modelo Oficial V81 atualizada com sucesso.');
}
