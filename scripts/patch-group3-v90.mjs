import fs from 'node:fs';
import { buildModeloOficial } from './modelo-oficial.mjs';

const path = 'public/assets/index-V60Excel.js';
const MARKER = 'ASTER_V90_GROUP3_FIXES';
let source = fs.readFileSync(path, 'utf8');

if (source.includes(MARKER)) {
  console.log('Correções Grupo 3 V90 já materializadas no bundle.');
  process.exit(0);
}

function replaceOnce(find, replacement, label) {
  const first = source.indexOf(find);
  if (first < 0) throw new Error(`V90 Grupo 3: trecho não encontrado: ${label}`);
  if (source.indexOf(find, first + find.length) >= 0) throw new Error(`V90 Grupo 3: trecho duplicado inesperadamente: ${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + find.length);
}

const official = buildModeloOficial();
const officialNodes = JSON.stringify(official.nodes);
const officialDescription = JSON.stringify(official.description || 'Modelo Oficial premium, responsivo e totalmente editável.');

// O Modelo Oficial existia no backend/seed, porém a galeria visível do editor
// renderizava somente os sete modelos compilados. Ele passa a fazer parte da
// mesma coleção, usa o mesmo botão "Aplicar modelo" e o mesmo normalizador AR.
replaceOnce(
  'f=q.useMemo(()=>[...aJ,...uJ].map(S=>({...S,accent:LAURENCINI_BRAND.blue,build:()=>laurenciniNodes(S.build())})),[])',
  `f=q.useMemo(()=>[...aJ,...uJ,{id:"tpl_modelo_oficial",name:"Modelo Oficial",description:${officialDescription},accent:LAURENCINI_BRAND.blue,build:()=>${officialNodes}}].map(S=>({...S,accent:LAURENCINI_BRAND.blue,build:()=>laurenciniNodes(S.build())})),[])`,
  'Modelo Oficial na biblioteca visível',
);

// Marca a materialização sem alterar o contrato público do bundle.
replaceOnce(
  'const ASTER_V81_WHITE_SCREEN_FIX=true,ASTER_V81_CORE_PATCH=true,ASTER_V90_FUNCTIONAL_POLISH=true;',
  `const ASTER_V81_WHITE_SCREEN_FIX=true,ASTER_V81_CORE_PATCH=true,ASTER_V90_FUNCTIONAL_POLISH=true,${MARKER}=true;`,
  'marcador Grupo 3 V90',
);

fs.writeFileSync(path, source);
console.log('Correções Grupo 3 V90 aplicadas: Modelo Oficial visível e aplicável pelo fluxo padrão.');
