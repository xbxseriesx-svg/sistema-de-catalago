export type ImportProduct = {
  code: string;
  name: string;
  departamentoName: string;
  secaoName: string;
  categoriaName: string;
  brandName: string;
  packaging: string;
  unit: string;
  ncm: string;
  ean: string;
  technical: Record<string, string>;
  sourceColumns: Record<string, string>;
};

export type ParsedSpreadsheet = {
  products: ImportProduct[];
  totalRows: number;
  ignoredRows: number;
};

export const normalizeHeader = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "");

const text = (value: unknown) => String(value ?? "").trim();

function valuesByHeader(row: Record<string, unknown>) {
  return new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  const values = valuesByHeader(row);
  for (const alias of aliases) {
    const value = values.get(normalizeHeader(alias));
    if (value !== undefined && text(value)) return text(value);
  }
  return "";
}

export function parseLocalizedNumber(value: unknown): number | null {
  let source = text(value).replace(/\s|R\$/gi, "");
  if (!source) return null;
  const comma = source.lastIndexOf(",");
  const dot = source.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    source = comma > dot ? source.replace(/\./g, "").replace(",", ".") : source.replace(/,/g, "");
  } else if (comma >= 0) {
    source = source.replace(",", ".");
  }
  const parsed = Number(source.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapProductRow(row: Record<string, unknown>): ImportProduct | null {
  const code = pick(row, ["Código", "Codigo", "Cod", "Código do produto", "Codigo do produto"]);
  const name = pick(row, ["Descrição", "Descricao", "Nome", "Produto", "Descrição do produto"]);
  const departamentoName = pick(row, ["Descrição do departamento", "Descricao do departamento", "Departamento"]);
  const secaoName = pick(row, ["Descrição da seção", "Descricao da secao", "Seção", "Secao"]);
  const brandName = pick(row, ["Marca", "Descrição da marca", "Descricao da marca"]);
  const categoriaName = pick(row, ["Nome da categoria", "Categoria", "Descrição da categoria", "Descricao da categoria"]);
  const packaging = pick(row, ["Embalagem", "Embalagem venda", "Embalagem de venda"]);
  const unit = pick(row, ["Descrição da unidade", "Descricao da unidade", "Unidade", "Unidade venda"]);
  const masterPackaging = pick(row, ["Embalagem Master", "Embalagem master"]);
  const masterUnit = pick(row, ["Descrição da unidade_1", "Descricao da unidade_1", "Descrição da unidade Master", "Descricao da unidade Master"]);
  const ncmException = pick(row, ["NCM + Exceção", "NCM + Excecao", "NCM Exceção", "NCM Excecao"]);
  const ncm = pick(row, ["NCM"]);
  const ean = pick(row, ["Unidade Venda [EAN8, UPC12, EAN13, e DUN14]", "Unidade Venda EAN", "EAN", "EAN Venda"]);
  const masterEan = pick(row, ["Unidade Master [EAN8, UPC12, EAN13, e DUN14]", "Unidade Master EAN", "EAN Master"]);

  if (!code || !name || !departamentoName || !secaoName || !categoriaName) return null;

  const sourceColumns = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, text(value)]),
  );

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
      "Embalagem Master": masterPackaging,
      "Descrição da unidade Master": masterUnit,
      "NCM + Exceção": ncmException,
      "Unidade Master EAN": masterEan,
    },
    sourceColumns,
  };
}

function parseDelimited(textValue: string): string[][] {
  const sample = textValue.slice(0, 4096);
  const candidates = [";", ",", "\t"];
  const delimiter = candidates
    .map((value) => ({ value, count: sample.split(value).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.value ?? ";";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < textValue.length; index++) {
    const char = textValue[index]!;
    if (char === '"') {
      if (quoted && textValue[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && textValue[index + 1] === "\n") index++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function rowsToObjects(rows: string[][]): Record<string, unknown>[] {
  const headerIndex = rows.findIndex((row) => row.filter((value) => value.trim()).length >= 2);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex]!.map((value, index) => value.trim() || `Coluna ${index + 1}`);
  return rows.slice(headerIndex + 1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  ));
}

function u16(view: DataView, offset: number) { return view.getUint16(offset, true); }
function u32(view: DataView, offset: number) { return view.getUint32(offset, true); }

async function inflateRaw(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") throw new Error("Este navegador não suporta descompactação XLSX.");
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  const stream = new Blob([payload.buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 22); offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (u32(view, offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("Arquivo XLSX inválido: diretório ZIP não encontrado.");

  const entries = u16(view, eocd + 10);
  let cursor = u32(view, eocd + 16);
  const files = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();

  for (let index = 0; index < entries; index++) {
    if (u32(view, cursor) !== 0x02014b50) throw new Error("Arquivo XLSX inválido: entrada ZIP corrompida.");
    const method = u16(view, cursor + 10);
    const compressedSize = u32(view, cursor + 20);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localOffset = u32(view, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (u32(view, localOffset) !== 0x04034b50) throw new Error("Arquivo XLSX inválido: cabeçalho ZIP ausente.");
    const localNameLength = u16(view, localOffset + 26);
    const localExtraLength = u16(view, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    let content: Uint8Array;
    if (method === 0) content = compressed;
    else if (method === 8) content = await inflateRaw(compressed);
    else throw new Error(`XLSX usa método ZIP não suportado (${method}).`);
    files.set(name.replace(/^\/+/, ""), content);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function parseXml(value: string) {
  const doc = new DOMParser().parseFromString(value, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML interno da planilha é inválido.");
  return doc;
}

function columnIndex(ref: string) {
  const letters = (ref.match(/[A-Z]+/i)?.[0] ?? "A").toUpperCase();
  let value = 0;
  for (const char of letters) value = value * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buffer);
  const decoder = new TextDecoder();
  const shared: string[] = [];
  const sharedBytes = files.get("xl/sharedStrings.xml");
  if (sharedBytes) {
    const doc = parseXml(decoder.decode(sharedBytes));
    for (const si of Array.from(doc.getElementsByTagName("si"))) {
      shared.push(Array.from(si.getElementsByTagName("t")).map((node) => node.textContent ?? "").join(""));
    }
  }

  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbookBytes = files.get("xl/workbook.xml");
  const relBytes = files.get("xl/_rels/workbook.xml.rels");
  if (workbookBytes && relBytes) {
    const workbook = parseXml(decoder.decode(workbookBytes));
    const firstSheet = workbook.getElementsByTagName("sheet")[0];
    const relationId = firstSheet?.getAttribute("r:id") || firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    if (relationId) {
      const rels = parseXml(decoder.decode(relBytes));
      const relationship = Array.from(rels.getElementsByTagName("Relationship")).find((node) => node.getAttribute("Id") === relationId);
      const target = relationship?.getAttribute("Target")?.replace(/^\.\.\//, "") ?? "";
      if (target) sheetPath = target.startsWith("xl/") ? target : `xl/${target.replace(/^\//, "")}`;
    }
  }
  const sheetBytes = files.get(sheetPath) ?? files.get("xl/worksheets/sheet1.xml");
  if (!sheetBytes) throw new Error("A primeira planilha do XLSX não foi encontrada.");
  const sheet = parseXml(decoder.decode(sheetBytes));
  const rows: string[][] = [];
  for (const rowNode of Array.from(sheet.getElementsByTagName("row"))) {
    const row: string[] = [];
    for (const cell of Array.from(rowNode.getElementsByTagName("c"))) {
      const index = columnIndex(cell.getAttribute("r") ?? "A1");
      const type = cell.getAttribute("t") ?? "";
      const raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
      let value = raw;
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = Array.from(cell.getElementsByTagName("t")).map((node) => node.textContent ?? "").join("");
      row[index] = value;
    }
    if (row.some((value) => text(value))) rows.push(row.map((value) => value ?? ""));
  }
  return rows;
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  let rows: string[][];
  if (extension === "csv" || extension === "txt") {
    rows = parseDelimited(await file.text());
  } else if (extension === "xlsx") {
    rows = await parseXlsx(await file.arrayBuffer());
  } else {
    throw new Error("Formato não suportado. Use .xlsx ou .csv.");
  }

  const objects = rowsToObjects(rows);
  const products = objects.map(mapProductRow).filter((item): item is ImportProduct => !!item);
  return { products, totalRows: objects.length, ignoredRows: objects.length - products.length };
}
