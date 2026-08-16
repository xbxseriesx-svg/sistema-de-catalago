import { readFile } from 'node:fs/promises';
const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');
function hits(needle, before=5000, after=6500, limit=8){const a=[];let p=0;while(a.length<limit){const i=bundle.indexOf(needle,p);if(i<0)break;a.push({i,t:bundle.slice(Math.max(0,i-before),Math.min(bundle.length,i+needle.length+after))});p=i+needle.length}return a}
for(const needle of ['function _I(','const _2=','carousel.items','e.carousel','function RY(','function XY(','label:"Histórico"','function dq(']){
 console.log(`\n=== ${needle} ===`); for(const h of hits(needle)) console.log(`index=${h.i}\n${h.t}\n`);
}
