import assert from 'node:assert/strict';
import { buildModeloOficial } from './modelo-oficial.mjs';

const template = buildModeloOficial();
const [page] = template.nodes;
const ids = new Set();
const names = new Set();
const nodes = [];

function walk(item) {
  nodes.push(item);
  assert.ok(item.id && !ids.has(item.id), `ID ausente ou duplicado: ${item.id}`);
  ids.add(item.id);
  names.add(item.name);
  assert.equal(item.locked, false, `${item.name} deve permanecer editável`);
  assert.equal(item.visible, true, `${item.name} deve iniciar visível`);
  assert.ok(Number.isFinite(item.x) && Number.isFinite(item.y), `${item.name} tem posição inválida`);
  assert.ok(item.width > 0 && item.height > 0, `${item.name} tem dimensões inválidas`);
  assert.ok(item.responsive?.tablet, `${item.name} não tem layout tablet`);
  assert.ok(item.responsive?.mobile, `${item.name} não tem layout mobile`);
  for (const device of ['tablet', 'mobile']) {
    const value = item.responsive[device];
    assert.ok([value.x, value.y, value.width, value.height].every(Number.isFinite), `${item.name} tem geometria ${device} inválida`);
    assert.ok(value.width > 0 && value.height > 0, `${item.name} tem tamanho ${device} inválido`);
  }
  for (const child of item.children || []) walk(child);
}

for (const item of template.nodes) walk(item);

assert.equal(template.name, 'Modelo Oficial');
assert.equal(template.system_key, 'modelo-oficial');
assert.equal(page.type, 'page');
assert.equal(page.width, 1440);
assert.equal(page.responsive.tablet.width, 834);
assert.equal(page.responsive.mobile.width, 390);
assert.ok(nodes.length >= 170, 'O modelo precisa manter granularidade de edição');

for (const section of [
  'Header principal editável',
  'Hero banner principal',
  'Benefícios e diferenciais',
  'Marcas em destaque',
  'Banners promocionais editáveis',
  'Curadoria de produtos editável',
  'Quem somos institucional',
  'Depoimentos de clientes',
  'Perguntas frequentes',
  'Contato e newsletter',
  'Rodapé completo editável',
]) assert.ok(names.has(section), `Seção obrigatória ausente: ${section}`);

const actions = nodes.filter((item) => ['button', 'productbutton'].includes(item.type));
assert.ok(actions.every((item) => item.props?.actionType && item.props.actionType !== 'none'), 'Todo botão deve ter uma ação configurada');
assert.ok(actions.some((item) => item.props.actionType === 'scroll' && item.props.actionValue === '#catalogo'));
assert.ok(actions.some((item) => item.props.actionType === 'scroll' && item.props.actionValue === '#contato'));
assert.ok(actions.some((item) => item.props.actionType === 'url' && item.props.actionValue === '/admin'));
assert.ok(actions.some((item) => item.props.actionType === 'custom-form'));
assert.ok(actions.some((item) => item.props.actionType === 'top'));

const source = JSON.stringify(template).toLowerCase();
assert.ok(!source.includes('wilso'), 'O modelo não pode conter identidade da referência');
assert.ok(!source.includes('distribuidora união'), 'O modelo não pode conter identidade de versões anteriores');

console.log(`QA do Modelo Oficial: OK (${nodes.length} elementos, ${actions.length} ações)`);
