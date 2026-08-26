const CONFIRMED_EXTENSIONS = new Set(['xlsx', 'csv', 'txt']);

export const normalizeHeader = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

const text = (value) => String(value ?? '').trim();

function valuesByHeader(row) {
  return new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
}

function pick(row, aliases) {
  const values = valuesByHeader(row);
  for (const alias of aliases) {
    const value = values.get(normalizeHeader(alias));
    if (value !== undefined && text(value)) return text(value);
  }
  return '';
}

export function mapProductRow(row) {
  const code = pick(row, ['Código', 'Codigo', 'Cod', 'Código do produto', 'Codigo do produto']);
  const name = pick(row, ['Descrição', 'Descricao', 'Nome', 'Produto', 'Descrição do produto']);
  const departamentoName = pick(row, ['Descrição do departamento', 'Descricao do departamento', 'Departamento']);
  const secaoName = pick(row, ['Descrição da seção', 'Descricao da secao', 'Seção', 'Secao']);
  const categoriaName = pick(row, ['Nome da categoria', 'Categoria', 'Descrição da categoria', 'Descricao da categoria']) || 'Sem categoria';
  const brandName = pick(row, ['Marca', 'Descrição da marca', 'Descricao da marca']);
  const packaging = pick(row, ['Embalagem', 'Embalagem venda', 'Embalagem de venda']);
  const unit = pick(row, ['Descrição da unidade', 'Descricao da unidade', 'Unidade', 'Unidade venda']);
  const masterPackaging = pick(row, ['Embalagem Master', 'Embalagem master']);
  const masterUnit = pick(row, ['Descrição da unidade_1', 'Descricao da unidade_1', 'Descrição da unidade Master', 'Descricao da unidade Master']);
  const ncmException = pick(row, ['NCM + Exceção', 'NCM + Excecao', 'NCM Exceção', 'NCM Excecao']);
  const ncm = pick(row, ['NCM']);
  const ean = pick(row, ['Unidade Venda EAN', 'Unidade Venda [EAN8, UPC12, EAN13, e DUN14]', 'EAN', 'EAN Venda']);
  const masterEan = pick(row, ['Unidade Master EAN', 'Unidade Master [EAN8, UPC12, EAN13, e DUN14]', 'EAN Master']);

  if (!code || !name || !departamentoName || !secaoName) return null;

  return {
    code,
    name,
    departamentoName,
    secaoName,
    categoriaName,
    brandName,
    packaging,
    unit,
    ncm,
    ean,
    technical: {
      'Embalagem Master': masterPackaging,
      'Descrição da unidade Master': masterUnit,
      'NCM + Exceção': ncmException,
      'Unidade Master EAN': masterEan,
    },
    sourceColumns: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)])),
  };
}

const requiredHeaderGroups = [
  ['Código', 'Codigo', 'Cod', 'Código do produto', 'Codigo do produto'],
  ['Descrição', 'Descricao', 'Nome', 'Produto', 'Descrição do produto'],
  ['Descrição do departamento', 'Descricao do departamento', 'Departamento'],
  ['Descrição da seção', 'Descricao da secao', 'Seção', 'Secao'],
  ['Nome da categoria', 'Categoria', 'Descrição da categoria', 'Descricao da categoria'],
];

function isOfficialHeaderRow(row) {
  const normalized = new Set(row.map(normalizeHeader).filter(Boolean));
  return requiredHeaderGroups.every((aliases) => aliases.some((alias) => normalized.has(normalizeHeader(alias))));
}

function disambiguateHeaders(values) {
  const occurrences = new Map();
  return values.map((value, index) => {
    const header = text(value) || `Coluna ${index + 1}`;
    const key = normalizeHeader(header);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return occurrence ? `${header}_${occurrence}` : header;
  });
}

export function rowsToObjects(rows) {
  const headerIndex = rows.findIndex(isOfficialHeaderRow);
  if (headerIndex < 0) {
    throw new Error('Cabeçalho oficial não encontrado. Confira Código, Descrição, Descrição do departamento, Descrição da seção e Nome da categoria.');
  }
  const rawHeaders = rows[headerIndex];
  const lastHeaderColumn = rawHeaders.reduce((last, value, index) => text(value) ? index : last, -1);
  const headers = disambiguateHeaders(rawHeaders.slice(0, lastHeaderColumn + 1));
  return rows.slice(headerIndex + 1)
    .filter((values) => values.some((value) => text(value)))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function parseDelimited(value) {
  const sample = value.slice(0, 4096);
  const delimiter = [';', ',', '\t']
    .map((candidate) => ({ candidate, count: sample.split(candidate).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.candidate ?? ';';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '"') {
      if (quoted && value[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && value[index + 1] === '\n') index++;
      row.push(cell);
      if (row.some((item) => text(item))) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => text(item))) rows.push(row);
  return rows;
}

const u16 = (view, offset) => view.getUint16(offset, true);
const u32 = (view, offset) => view.getUint32(offset, true);

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não suporta descompactação XLSX. Atualize o navegador ou use CSV.');
  }
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  const stream = new Blob([payload.buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 22); offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (u32(view, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('Arquivo XLSX inválido: diretório ZIP não encontrado.');

  const entries = u16(view, eocd + 10);
  let cursor = u32(view, eocd + 16);
  const files = new Map();
  const decoder = new TextDecoder();
  for (let index = 0; index < entries; index++) {
    if (u32(view, cursor) !== 0x02014b50) throw new Error('Arquivo XLSX inválido: entrada ZIP corrompida.');
    const method = u16(view, cursor + 10);
    const compressedSize = u32(view, cursor + 20);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localOffset = u32(view, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (u32(view, localOffset) !== 0x04034b50) throw new Error('Arquivo XLSX inválido: cabeçalho ZIP ausente.');
    const localNameLength = u16(view, localOffset + 26);
    const localExtraLength = u16(view, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    let content;
    if (method === 0) content = compressed;
    else if (method === 8) content = await inflateRaw(compressed);
    else throw new Error(`XLSX usa método ZIP não suportado (${method}).`);
    files.set(name.replace(/^\/+/, ''), content);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function parseXml(value) {
  const doc = new DOMParser().parseFromString(value, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML interno da planilha é inválido.');
  return doc;
}

function columnIndex(reference) {
  const letters = (reference.match(/[A-Z]+/i)?.[0] ?? 'A').toUpperCase();
  let value = 0;
  for (const char of letters) value = value * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

async function parseXlsx(buffer) {
  const files = await unzip(buffer);
  const decoder = new TextDecoder();
  const shared = [];
  const sharedBytes = files.get('xl/sharedStrings.xml');
  if (sharedBytes) {
    const doc = parseXml(decoder.decode(sharedBytes));
    for (const item of Array.from(doc.getElementsByTagName('si'))) {
      shared.push(Array.from(item.getElementsByTagName('t')).map((node) => node.textContent ?? '').join(''));
    }
  }

  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbookBytes = files.get('xl/workbook.xml');
  const relationBytes = files.get('xl/_rels/workbook.xml.rels');
  if (workbookBytes && relationBytes) {
    const workbook = parseXml(decoder.decode(workbookBytes));
    const firstSheet = workbook.getElementsByTagName('sheet')[0];
    const relationId = firstSheet?.getAttribute('r:id')
      || firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    if (relationId) {
      const relations = parseXml(decoder.decode(relationBytes));
      const relation = Array.from(relations.getElementsByTagName('Relationship'))
        .find((node) => node.getAttribute('Id') === relationId);
      const target = relation?.getAttribute('Target') ?? '';
      const normalizedTarget = target.replace(/^\.\.\//, '').replace(/^\//, '');
      if (normalizedTarget) sheetPath = normalizedTarget.startsWith('xl/') ? normalizedTarget : `xl/${normalizedTarget}`;
    }
  }

  const sheetBytes = files.get(sheetPath) ?? files.get('xl/worksheets/sheet1.xml');
  if (!sheetBytes) throw new Error('A primeira planilha do XLSX não foi encontrada.');
  const sheet = parseXml(decoder.decode(sheetBytes));
  const rows = [];
  for (const rowNode of Array.from(sheet.getElementsByTagName('row'))) {
    const row = [];
    for (const cell of Array.from(rowNode.getElementsByTagName('c'))) {
      const index = columnIndex(cell.getAttribute('r') ?? 'A1');
      const type = cell.getAttribute('t') ?? '';
      const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      let value = raw;
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') {
        value = Array.from(cell.getElementsByTagName('t')).map((node) => node.textContent ?? '').join('');
      }
      row[index] = value;
    }
    if (row.some((value) => text(value))) rows.push(row.map((value) => value ?? ''));
  }
  return rows;
}

export async function parseSpreadsheetFile(file) {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const rows = extension === 'xlsx'
    ? await parseXlsx(await file.arrayBuffer())
    : parseDelimited(await file.text());
  const objects = rowsToObjects(rows);
  const products = objects.map(mapProductRow).filter(Boolean);
  return { products, totalRows: objects.length, ignoredRows: objects.length - products.length };
}

function emitProgress(file, stage, processed, total, currentItems = []) {
  window.dispatchEvent(new CustomEvent('asteryon:import-progress', {
    detail: { mode: 'excel', stage, file, processed, total, currentItems },
  }));
}

function statusElement(input) {
  const card = input.closest('.rounded-lg') ?? input.parentElement;
  let status = card?.querySelector('[data-asteryon-import-v96-status]');
  if (!status && card) {
    status = document.createElement('div');
    status.dataset.asteryonImportV96Status = 'true';
    status.setAttribute('role', 'status');
    status.style.cssText = 'margin-top:10px;border:1px solid #3f3f46;border-radius:6px;padding:8px;color:#d4d4d8;font-size:10px;line-height:1.45';
    card.append(status);
  }
  return status;
}

function apiError(body, status) {
  return body?.error?.message || body?.message || `Falha HTTP ${status}`;
}

async function importFile(input, file) {
  const status = statusElement(input);
  const setStatus = (message, failed = false) => {
    if (!status) return;
    status.textContent = message;
    status.style.borderColor = failed ? 'rgba(239,68,68,.45)' : 'rgba(59,130,246,.45)';
    status.style.color = failed ? '#fca5a5' : '#bfdbfe';
  };

  input.disabled = true;
  setStatus('Lendo e validando as 14 colunas da planilha…');
  emitProgress(file.name, 'reading', 0, 0);
  try {
    const parsed = await parseSpreadsheetFile(file);
    if (!parsed.products.length) {
      throw new Error('Nenhum produto válido. São obrigatórios Código, Descrição, Descrição do departamento e Descrição da seção.');
    }

    let inserted = 0;
    let updated = 0;
    let ignored = parsed.ignoredRows;
    const errors = [];
    emitProgress(file.name, 'ready', 0, parsed.products.length, parsed.products.slice(0, 5));
    for (let index = 0; index < parsed.products.length; index += 300) {
      const batch = parsed.products.slice(index, index + 300);
      setStatus(`Importando ${Math.min(index + batch.length, parsed.products.length)} de ${parsed.products.length} produtos…`);
      emitProgress(file.name, 'importing', index, parsed.products.length, batch.slice(0, 5));
      const response = await fetch('/api/admin/catalog/products/bulk', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ products: batch, filename: file.name, kind: 'spreadsheet' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) throw new Error(apiError(body, response.status));
      inserted += Number(body.inserted || 0);
      updated += Number(body.updated || 0);
      ignored += Number(body.ignored || 0);
      errors.push(...(Array.isArray(body.errors) ? body.errors.slice(0, 5) : []));
      emitProgress(file.name, 'importing', Math.min(index + batch.length, parsed.products.length), parsed.products.length, batch.slice(-5));
    }

    emitProgress(file.name, 'complete', parsed.products.length, parsed.products.length);
    setStatus(`Planilha processada: ${inserted} novo(s), ${updated} atualizado(s), ${ignored} ignorado(s).${errors[0] ? ` ${errors[0]}` : ''}`);
    if (status) {
      status.style.borderColor = 'rgba(34,197,94,.45)';
      status.style.color = '#86efac';
    }
    window.setTimeout(() => window.location.reload(), 1200);
  } catch (error) {
    emitProgress(file.name, 'error', 0, 0);
    setStatus(error instanceof Error ? error.message : 'Falha ao importar a planilha.', true);
  } finally {
    input.disabled = false;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    const file = input.files?.[0];
    const extension = file?.name.toLowerCase().split('.').pop() ?? '';
    if (!file || !CONFIRMED_EXTENSIONS.has(extension)) return;
    const acceptsSpreadsheet = String(input.accept || '').includes('.xlsx');
    if (!acceptsSpreadsheet) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    input.value = '';
    void importFile(input, file);
  }, true);
}
