import { readFile, writeFile } from 'node:fs/promises';

const assetPath = 'public/assets/index-V60Excel.js';
const original = await readFile(assetPath, 'utf8');
let source = original;

const helperMarker = 'const LAURENCINI_BRAND=Object.freeze({blue:"#214C8F"';
const insertionPoint = 'function rJ(){';

const helpers = `const LAURENCINI_BRAND=Object.freeze({blue:"#214C8F",blueDark:"#123F7D",blueBright:"#1E5EAA",red:"#D13130",redDark:"#A7252A",white:"#FFFFFF",canvas:"#F4F8FC",line:"#DCE6F2",ink:"#172033",muted:"#66758A",paleBlue:"#EAF2FA",paleRed:"#FCEBEC"});function laurenciniColor(e,t="",a=""){if(typeof e!=="string")return e;let r=e.trim();if(!/^#[0-9a-f]{3,8}$/i.test(r))return e;if(r.length===4)r="#"+r.slice(1).split("").map(n=>n+n).join("");if(r.length!==7)return e;const n=parseInt(r.slice(1,3),16)/255,i=parseInt(r.slice(3,5),16)/255,o=parseInt(r.slice(5,7),16)/255,s=Math.max(n,i,o),d=Math.min(n,i,o),h=(s+d)/2,u=s-d,p=u===0?0:u/(1-Math.abs(2*h-1));let f=0;if(u!==0){s===n?f=60*(((i-o)/u)%6):s===i?f=60*((o-n)/u+2):f=60*((n-i)/u+4),f<0&&(f+=360)}const y=/background|fill/i.test(t),x=p<.12;if(x){if(h>=.94)return LAURENCINI_BRAND.white;if(h>=.82)return y?LAURENCINI_BRAND.canvas:LAURENCINI_BRAND.line;if(h>=.64)return LAURENCINI_BRAND.line;if(h>=.42)return LAURENCINI_BRAND.muted;return y?LAURENCINI_BRAND.blueDark:LAURENCINI_BRAND.ink}const k=f<55||f>325;if(k){if(h>=.82)return LAURENCINI_BRAND.paleRed;if(h<=.28)return LAURENCINI_BRAND.redDark;return LAURENCINI_BRAND.red}if(h>=.82)return LAURENCINI_BRAND.paleBlue;if(h<=.28)return LAURENCINI_BRAND.blueDark;return LAURENCINI_BRAND.blue}function laurenciniStyle(e,t,a){return typeof e!=="string"?e:e.replace(/#[0-9a-f]{3,8}\\b/gi,r=>laurenciniColor(r,t,a))}function laurenciniNodes(e){if(!Array.isArray(e))return e;return e.map(t=>{const a={...t.styles||{}};for(const[r,n]of Object.entries(a))a[r]=laurenciniStyle(n,r,t.type);if(t.type==="productbutton"&&a.backgroundColor&&a.backgroundColor!=="transparent")a.backgroundColor=LAURENCINI_BRAND.red;if(t.type==="productprice"&&a.color)a.color=LAURENCINI_BRAND.blue;return{...t,styles:a,children:Array.isArray(t.children)?laurenciniNodes(t.children):t.children}})}function laurenciniTemplate(e){return{...e,accent:LAURENCINI_BRAND.blue,nodes:laurenciniNodes(e.nodes)}}`;

if (!source.includes(helperMarker)) {
  const at = source.indexOf(insertionPoint);
  if (at < 0) throw new Error('V68: ponto de inserção da normalização Laurencini não encontrado.');
  source = source.slice(0, at) + helpers + source.slice(at);
}

function patchExact(oldValue, newValue, label) {
  if (source.includes(oldValue)) {
    source = source.replace(oldValue, newValue);
    return;
  }
  if (!source.includes(newValue)) throw new Error(`V68: ${label} incompatível.`);
}

patchExact(
  'f=q.useMemo(()=>[...aJ,...uJ],[])',
  'f=q.useMemo(()=>[...aJ,...uJ].map(S=>({...S,accent:LAURENCINI_BRAND.blue,build:()=>laurenciniNodes(S.build())})),[])',
  'biblioteca de templates prontos',
);
patchExact(
  'o(S.templates)',
  'o(S.templates.map(laurenciniTemplate))',
  'templates salvos no Supabase',
);
patchExact(
  'const j=oJ(AR(T),a.products,a.brandName)',
  'const j=oJ(AR(laurenciniNodes(T)),a.products,a.brandName)',
  'aplicação do template',
);

// Elementos novos inseridos no canvas também nascem com a identidade Laurencini.
patchExact(
  'button:{type:"button",label:"Botão",category:"content",icon:"MousePointerClick",defaultSize:{width:140,height:44},defaultStyles:{backgroundColor:"#2563eb"',
  'button:{type:"button",label:"Botão",category:"content",icon:"MousePointerClick",defaultSize:{width:140,height:44},defaultStyles:{backgroundColor:"#D13130"',
  'botão padrão',
);
patchExact(
  'shape:{type:"shape",label:"Forma",category:"content",icon:"Square",defaultSize:{width:180,height:120},defaultStyles:{backgroundColor:"#2563eb"',
  'shape:{type:"shape",label:"Forma",category:"content",icon:"Square",defaultSize:{width:180,height:120},defaultStyles:{backgroundColor:"#214C8F"',
  'forma padrão',
);
patchExact(
  'banner:{type:"banner",label:"Banner",category:"marketing",icon:"PanelTop",defaultSize:{width:1200,height:300},canHaveChildren:!0,defaultStyles:{backgroundColor:"#18181b"',
  'banner:{type:"banner",label:"Banner",category:"marketing",icon:"PanelTop",defaultSize:{width:1200,height:300},canHaveChildren:!0,defaultStyles:{backgroundColor:"#123F7D"',
  'banner padrão',
);
patchExact(
  'hero:{type:"hero",label:"Banner Principal",category:"marketing",icon:"ImagePlay",defaultSize:{width:1200,height:500},canHaveChildren:!0,defaultStyles:{background:"linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)"',
  'hero:{type:"hero",label:"Banner Principal",category:"marketing",icon:"ImagePlay",defaultSize:{width:1200,height:500},canHaveChildren:!0,defaultStyles:{background:"linear-gradient(135deg, #123F7D 0%, #214C8F 100%)"',
  'hero padrão',
);
patchExact(
  'promotion:{type:"promotion",label:"Promoção",category:"marketing",icon:"Tag",defaultSize:{width:400,height:200},canHaveChildren:!0,defaultStyles:{background:"linear-gradient(135deg, #dc2626 0%, #ea580c 100%)"',
  'promotion:{type:"promotion",label:"Promoção",category:"marketing",icon:"Tag",defaultSize:{width:400,height:200},canHaveChildren:!0,defaultStyles:{background:"linear-gradient(135deg, #A7252A 0%, #D13130 100%)"',
  'promoção padrão',
);
patchExact(
  'productprice:{type:"productprice",label:"Preço do Produto",category:"catalog",icon:"DollarSign",defaultSize:{width:216,height:24},defaultStyles:{fontSize:18,fontWeight:700,color:"#2563eb"',
  'productprice:{type:"productprice",label:"Preço do Produto",category:"catalog",icon:"DollarSign",defaultSize:{width:216,height:24},defaultStyles:{fontSize:18,fontWeight:700,color:"#214C8F"',
  'preço padrão',
);
patchExact(
  'productbutton:{type:"productbutton",label:"Botão do Produto",category:"catalog",icon:"ShoppingCart",defaultSize:{width:216,height:40},defaultStyles:{backgroundColor:"#2563eb"',
  'productbutton:{type:"productbutton",label:"Botão do Produto",category:"catalog",icon:"ShoppingCart",defaultSize:{width:216,height:40},defaultStyles:{backgroundColor:"#D13130"',
  'botão de produto padrão',
);

if (source !== original) await writeFile(assetPath, source);

// O Modelo Oficial usa as mesmas chaves históricas (navy/orange), mas agora elas
// apontam para azul/vermelho da marca para preservar a API interna do construtor.
const officialPath = 'scripts/modelo-oficial.mjs';
const officialOriginal = await readFile(officialPath, 'utf8');
let official = officialOriginal;
const oldPalette = `const COLORS = Object.freeze({\n  navy: '#183153',\n  navyDeep: '#10253F',\n  navySoft: '#294D73',\n  orange: '#E27D33',\n  orangeSoft: '#FFF0E4',\n  ink: '#172033',\n  muted: '#64748B',\n  line: '#DDE5EE',\n  surface: '#FFFFFF',\n  canvas: '#F5F7FA',\n  paleBlue: '#EAF1F8',\n});`;
const newPalette = `const COLORS = Object.freeze({\n  navy: '#214C8F',\n  navyDeep: '#123F7D',\n  navySoft: '#1E5EAA',\n  orange: '#D13130',\n  orangeSoft: '#FCEBEC',\n  ink: '#172033',\n  muted: '#66758A',\n  line: '#DCE6F2',\n  surface: '#FFFFFF',\n  canvas: '#F4F8FC',\n  paleBlue: '#EAF2FA',\n});`;
if (official.includes(oldPalette)) official = official.replace(oldPalette, newPalette);
else if (!official.includes(newPalette)) throw new Error('V68: paleta do Modelo Oficial incompatível.');
official = official
  .replaceAll('#EEF2F7', '#F4F8FC')
  .replaceAll('#F5F7FA', '#F4F8FC')
  .replaceAll('#EAF1F8', '#EAF2FA')
  .replaceAll('#B9C8D8', '#DCE6F2')
  .replaceAll('rgba(16,37,63,', 'rgba(18,63,125,');
if (official !== officialOriginal) await writeFile(officialPath, official);

if (source === original && official === officialOriginal) {
  console.log('Patch Laurencini V68 já aplicado.');
} else {
  console.log('Patch Laurencini V68 aplicado: 7 templates, biblioteca salva, Modelo Oficial e elementos novos padronizados.');
}
