import fs from 'node:fs';

const path = 'public/assets/index-V60Excel.js';
const MARKER = 'ASTER_V90_FUNCTIONAL_POLISH';
let source = fs.readFileSync(path, 'utf8');

if (source.includes(MARKER)) {
  console.log('Polimento funcional V90 já materializado no bundle.');
  process.exit(0);
}

function replaceOnce(find, replacement, label) {
  const first = source.indexOf(find);
  if (first < 0) throw new Error(`V90: trecho não encontrado: ${label}`);
  if (source.indexOf(find, first + find.length) >= 0) throw new Error(`V90: trecho duplicado inesperadamente: ${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + find.length);
}

// O backend/importador aceita departamentos dinâmicos. O editor manual não pode
// limitar o produto a dois nomes fixos, senão um departamento criado pelo Excel
// fica impossível de selecionar/regravar pelo formulário de produto.
replaceOnce(
  'children:[l.jsx("option",{children:"Atacado"}),l.jsx("option",{children:"Distribuição"})]',
  'children:ee.length?ee.map(M=>l.jsx("option",{value:M.name,children:M.name},M.id)):[l.jsx("option",{value:"Atacado",children:"Atacado"}),l.jsx("option",{value:"Distribuição",children:"Distribuição"})]',
  'seletor dinâmico de Departamento no produto',
);

// Textos técnicos antigos apareciam para o usuário mesmo depois da migração
// definitiva D1/Lovable/Bolt -> Supabase/ASTERYON.
replaceOnce(
  'Dados do Lovable dentro do canvas Bolt',
  'Dados do Supabase dentro do editor ASTERYON',
  'descrição do painel Catálogo',
);
replaceOnce(
  'Modelo convertido do protótipo Figma, com produtos e estrutura ligados ao D1.',
  'Modelo convertido do protótipo Figma, com produtos e estrutura ligados ao Supabase.',
  'descrição Distribuidora União',
);
replaceOnce(
  'Vitrine comercial moderna vinculada aos produtos já cadastrados no D1.',
  'Vitrine comercial moderna vinculada aos produtos já cadastrados no Supabase.',
  'descrição Vitrine Atacado Pro',
);

// Marca a materialização para que o build seja idempotente.
replaceOnce(
  'const ASTER_V81_WHITE_SCREEN_FIX=true,ASTER_V81_CORE_PATCH=true;',
  `const ASTER_V81_WHITE_SCREEN_FIX=true,ASTER_V81_CORE_PATCH=true,${MARKER}=true;`,
  'marcador funcional V90',
);

fs.writeFileSync(path, source);
console.log('Polimento funcional V90 aplicado: departamentos dinâmicos e textos técnicos normalizados.');
