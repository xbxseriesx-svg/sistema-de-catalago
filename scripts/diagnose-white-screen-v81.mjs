import { readFile } from 'node:fs/promises';
const bundle = await readFile('public/assets/index-V60Excel.js','utf8');
const needles=['function cq(','function hq(','function NR(','data-node-id','l.jsx(cq,{node:e})','ASTER_V81_CORE_PATCH'];
for(const needle of needles){
 const i=bundle.indexOf(needle);
 console.log(`\n=== ${needle} @ ${i} ===`);
 if(i>=0) console.log(bundle.slice(Math.max(0,i-1800), Math.min(bundle.length,i+7000)));
}
