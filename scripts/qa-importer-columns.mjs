import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/assets/index-_J4BqdfT.js', 'utf8');
const start = source.indexOf('function TY(e)');
const end = source.indexOf('function _Y(e,t)', start);
assert.ok(start >= 0 && end > start, 'parser de planilha não encontrado no bundle');

const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');
const pick = (row, aliases) => {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalize(key), value]));
  for (const alias of aliases) {
    const value = values.get(normalize(alias));
    if (value !== undefined && String(value).trim()) return String(value).trim();
  }
  return '';
};
const number = value => {
  let text = value.replace(/\s|R\$/gi, '');
  if (!text) return null;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  else if (comma >= 0) text = text.replace(',', '.');
  const parsed = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const parse = new Function('Jt', 'GA', 'Lr', `${source.slice(start, end)}; return TY;`)(pick, number, normalize);

const row = {
  'Código': '32',
  'Descrição': 'BALA FLOPI DIET 40G FLORESTAL',
  'Descrição do departamento': 'ATACADO',
  'Descrição da seção': 'BOMBONIERI',
  'Marca': 'FLORESTAL',
  'Nome da categoria': 'BALAS & DROPS',
  'Embalagem': '12X40G',
  'Descrição da unidade': 'DISPLAY',
  'Embalagem Master': '04X12X40G',
  'Descrição da unidade_1': 'CAIXA',
  'NCM + Exceção': '21069090.',
  'NCM': '21069090',
  'Unidade Venda [EAN8, UPC12, EAN13, e DUN14]': '7896321005601',
  'Unidade Master [EAN8, UPC12, EAN13, e DUN14]': '17896321005608',
};

const product = parse(row);
assert.ok(product, 'a linha real da planilha deve ser aceita');
assert.equal(product.code, '32');
assert.equal(product.name, 'BALA FLOPI DIET 40G FLORESTAL');
assert.equal(product.departamentoName, 'ATACADO');
assert.equal(product.secaoName, 'BOMBONIERI');
assert.equal(product.categoriaName, 'BALAS & DROPS');
assert.equal(product.brandName, 'FLORESTAL');
assert.equal(product.packaging, '12X40G');
assert.equal(product.unit, 'DISPLAY');
assert.equal(product.ncm, '21069090');
assert.equal(product.ean, '7896321005601');
assert.equal(product.technical['Embalagem Master'], '04X12X40G');
assert.equal(product.technical['Descrição da unidade Master'], 'CAIXA');
assert.equal(product.technical['NCM + Exceção'], '21069090.');
assert.equal(product.technical['Unidade Master EAN'], '17896321005608');
assert.equal(Object.keys(product.sourceColumns).length, 14, 'todas as colunas devem ser preservadas');
assert.equal(parse({ ...row, 'Nome da categoria': '' }), null, 'categoria continua obrigatória');

console.log('QA dos 14 campos reais da planilha: OK');
