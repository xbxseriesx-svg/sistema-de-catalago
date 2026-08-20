import assert from 'node:assert/strict';
import fs from 'node:fs';

const bundle = fs.readFileSync('public/assets/index-V60Excel.js', 'utf8');

assert.match(bundle, /ASTER_V90_FUNCTIONAL_POLISH/, 'bundle deve conter o marcador de polimento V90');

// Produto: departamentos devem vir da hierarquia carregada, não de duas opções fixas.
assert.ok(
  bundle.includes('ee.length?ee.map(M=>l.jsx("option",{value:M.name,children:M.name},M.id))'),
  'formulário de produto deve montar Departamento a partir da hierarquia dinâmica',
);
assert.ok(
  !bundle.includes('children:[l.jsx("option",{children:"Atacado"}),l.jsx("option",{children:"Distribuição"})]'),
  'seletor antigo com apenas Atacado/Distribuição não pode permanecer',
);

// Textos da arquitetura antiga não devem continuar sendo apresentados ao usuário.
for (const stale of [
  'Dados do Lovable dentro do canvas Bolt',
  'produtos e estrutura ligados ao D1.',
  'produtos já cadastrados no D1.',
]) {
  assert.ok(!bundle.includes(stale), `texto técnico legado ainda presente: ${stale}`);
}
assert.ok(bundle.includes('Dados do Supabase dentro do editor ASTERYON'));

// Templates: todo modelo aplicado passa pela normalização recursiva AR, que
// remove travas e flags atômicas antes de substituir os nós no editor.
assert.ok(
  bundle.includes('function AR(e){return e.map(t=>({...t,locked:!1,props:{...t.props||{},atomicTemplate:!1,atomic:!1}'),
  'normalizador de templates deve destravar nós recursivamente',
);
assert.ok(
  bundle.includes('children:t.children?AR(t.children):t.children'),
  'destravamento deve alcançar filhos recursivamente',
);
assert.ok(
  bundle.includes('nodes:AR(laurenciniNodes(T))'),
  'templates prontos devem ser normalizados antes de REPLACE_NODES',
);

for (const name of [
  'Varejo Contínuo',
  'Atacado B2B',
  'Distribuidora Institucional',
  'Catálogo de Marcas B2B',
  'Distribuidora União • Figma B2B',
  'Catálogo Hierárquico B2B',
  'Vitrine Atacado Pro',
]) {
  assert.ok(bundle.includes(name), `template ausente do bundle: ${name}`);
}

// Ações universais e inspetor continuam presentes depois do polimento.
assert.ok(bundle.includes('ASTER_V81_CORE_PATCH'), 'biblioteca de ações/inspector V81 deve permanecer');
assert.ok(bundle.includes('ASTER_V81_WHITE_SCREEN_FIX'), 'correção de seleção/inspector deve permanecer');

console.log('QA V90 funcional: departamentos dinâmicos, textos normalizados e templates recursivamente editáveis validados.');
