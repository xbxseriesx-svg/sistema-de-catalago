import assert from 'node:assert/strict';
import fs from 'node:fs';

const bundle = fs.readFileSync('public/assets/index-V60Excel.js', 'utf8');
const marketingRuntime = fs.readFileSync('public/marketing-canvas-hotfix.js', 'utf8');

assert.match(bundle, /ASTER_V90_FUNCTIONAL_POLISH/, 'bundle deve conter o marcador de polimento V90');
assert.match(bundle, /ASTER_V90_GROUP3_FIXES/, 'bundle deve conter as correções finais do Grupo 3 V90');

assert.ok(bundle.includes('ee.length?ee.map(M=>l.jsx("option",{value:M.name,children:M.name},M.id))'), 'formulário de produto deve montar Departamento a partir da hierarquia dinâmica');
assert.ok(!bundle.includes('children:[l.jsx("option",{children:"Atacado"}),l.jsx("option",{children:"Distribuição"})]'), 'seletor antigo com apenas Atacado/Distribuição não pode permanecer');

assert.ok(bundle.includes('children:"Novo departamento"'), 'Estrutura deve permitir criar Departamento manualmente');
assert.ok(bundle.includes('parentId:a==="departamento"?"":n'), 'Departamento manual deve ser enviado sem item pai');
assert.ok(bundle.includes('!d&&a!=="departamento"&&l.jsxs(l.Fragment'), 'seletor de pai não deve ser exibido ao criar Departamento');
assert.ok(bundle.includes('l.jsx(QF,{node:w,count:w.sections.length,onEdit:S,onDelete:b})'), 'Departamento listado deve expor editar/excluir como os demais níveis');

for (const stale of ['Dados do Lovable dentro do canvas Bolt','produtos e estrutura ligados ao D1.','produtos já cadastrados no D1.']) assert.ok(!bundle.includes(stale), `texto técnico legado ainda presente: ${stale}`);
assert.ok(bundle.includes('Dados do Supabase dentro do editor ASTERYON'));

assert.ok(bundle.includes('function AR(e){return e.map(t=>({...t,locked:!1,props:{...t.props||{},atomicTemplate:!1,atomic:!1}'), 'normalizador de templates deve destravar nós recursivamente');
assert.ok(bundle.includes('children:t.children?AR(t.children):t.children'), 'destravamento deve alcançar filhos recursivamente');
assert.ok(bundle.includes('const j=oJ(AR(laurenciniNodes(T)),a.products,a.brandName);'), 'modelo deve ser destravado antes do vínculo com os produtos');
assert.ok(bundle.includes('t({type:"REPLACE_NODES",nodes:j})'), 'REPLACE_NODES deve receber a árvore já destravada e vinculada');

for (const name of ['Varejo Contínuo','Atacado B2B','Distribuidora Institucional','Catálogo de Marcas B2B','Distribuidora União • Figma B2B','Catálogo Hierárquico B2B','Vitrine Atacado Pro','Modelo Oficial']) assert.ok(bundle.includes(name), `template ausente do bundle: ${name}`);
assert.ok(bundle.includes('id:"tpl_modelo_oficial",name:"Modelo Oficial"'), 'Modelo Oficial deve integrar a biblioteca visual do editor');

assert.match(marketingRuntime, /touch-action:none/, 'drag/resize do Marketing deve bloquear gesto de scroll no touch');
assert.match(marketingRuntime, /pointercancel/, 'Marketing deve finalizar/cancelar gesto touch de forma segura');
assert.match(marketingRuntime, /setPointerCapture/, 'Marketing deve capturar o ponteiro durante drag/resize');

assert.ok(bundle.includes('ASTER_V81_CORE_PATCH'), 'biblioteca de ações/inspector V81 deve permanecer');
assert.ok(bundle.includes('ASTER_V81_WHITE_SCREEN_FIX'), 'correção de seleção/inspector deve permanecer');

console.log('QA V90 funcional: departamentos dinâmicos, hierarquia completa, 8 modelos editáveis e Marketing touch validados.');
