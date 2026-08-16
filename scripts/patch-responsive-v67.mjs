import { readFile, writeFile } from 'node:fs/promises';

const assetPath = 'public/assets/index-V60Excel.js';
const original = await readFile(assetPath, 'utf8');
let source = original;

const oldViewport = 'function bJ(){const[e,t]=q.useState(()=>typeof window>"u"?1440:window.innerWidth);q.useEffect(()=>{const r=()=>t(window.innerWidth);return window.addEventListener("resize",r),()=>window.removeEventListener("resize",r)},[]);const a=e<=767?"mobile":e<=1100?"tablet":"desktop";return{viewport:e,device:a}}';
const newViewport = 'function bJ(){const[e,t]=q.useState(()=>typeof window>"u"?1440:window.innerWidth);q.useEffect(()=>{const r=()=>t(window.innerWidth);return window.addEventListener("resize",r),window.addEventListener("orientationchange",r),window.visualViewport?.addEventListener("resize",r),()=>{window.removeEventListener("resize",r),window.removeEventListener("orientationchange",r),window.visualViewport?.removeEventListener("resize",r)}},[]);const a=e<=767?"mobile":e<=1100?"tablet":"desktop";return{viewport:e,device:a}}';

if (source.includes(oldViewport)) {
  source = source.replace(oldViewport, newViewport);
} else if (!source.includes(newViewport)) {
  throw new Error('V67: monitor de viewport público incompatível.');
}

const oldScale = 'function LJ({page:e,viewport:t,device:a,children:r}){const n=xt(e,a),i=Math.min(1,t/Math.max(1,n.width));return';
const newScale = 'function LJ({page:e,viewport:t,device:a,children:r}){const n=xt(e,a),i=t/Math.max(1,n.width);return';

if (source.includes(oldScale)) {
  source = source.replace(oldScale, newScale);
} else if (!source.includes(newScale)) {
  throw new Error('V67: escala do renderer público incompatível.');
}

if (source === original) {
  console.log('Patch responsivo V67 já aplicado.');
} else {
  await writeFile(assetPath, source);
  console.log('Patch responsivo V67 aplicado: largura total + resize/orientação/visualViewport.');
}
