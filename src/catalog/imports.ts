import * as XLSX from 'xlsx'
import type { CatalogProduct } from './data'

export const IMPORTED_PRODUCTS_KEY = 'asteryon_imported_products_v2'
export const IMPORTED_IMAGES_KEY = 'asteryon_imported_images_v1'

export type ImportSummary = {
  imported: number
  updated: number
  skipped: number
  totalRows: number
  profile: string
  mappedFields: string[]
  errors: string[]
}

const aliases: Record<string, string[]> = {
  code: ['codigo','código','cod','codigo produto','código produto','sku','id'],
  name: ['descricao','descrição','produto','nome','nome produto','descricao produto','descrição produto'],
  brand: ['marca','brand'],
  department: ['departamento','depto','descricao do departamento','descrição do departamento'],
  category: ['categoria','nome da categoria'],
  section: ['secao','seção','descricao da secao','descrição da seção'],
  subcategory: ['subcategoria','sub categoria'],
  distribution: ['distribuicao','distribuição','distribuidor','nome do fornecedor','fornecedor'],
  price: ['preco','preço','valor','preco venda','preço venda'],
}

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const text = (value: unknown) => value == null ? '' : String(value).trim()
const numericText = (value: unknown) => {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) ? String(value) : String(value)
  return String(value).trim()
}
const cleanZero = (value: unknown) => {
  const v = numericText(value)
  return v === '0' || v === '0.0' ? '' : v
}
const normalizeNcm = (rawNcm: unknown, rawWithException: unknown) => {
  const withException = text(rawWithException)
  const fromException = withException.split('.')[0].replace(/\D/g, '')
  if (fromException) return fromException.padStart(8, '0').slice(-8)
  const digits = numericText(rawNcm).replace(/\D/g, '')
  return digits ? digits.padStart(8, '0').slice(-8) : ''
}
const normalizeException = (value: unknown) => {
  const v = text(value)
  if (!v) return ''
  const [ncm, exception = ''] = v.split('.')
  const cleanNcm = ncm.replace(/\D/g, '').padStart(8, '0').slice(-8)
  return exception ? `${cleanNcm}.${exception.replace(/\D/g, '')}` : cleanNcm
}

const findColumns = (headers: unknown[], label: string) => {
  const wanted = norm(label)
  return headers.reduce<number[]>((acc, header, index) => {
    if (norm(header) === wanted) acc.push(index)
    return acc
  }, [])
}
const firstColumn = (headers: unknown[], ...labels: string[]) => {
  for (const label of labels) {
    const found = findColumns(headers, label)
    if (found.length) return found[0]
  }
  return -1
}
const valueAt = (row: unknown[], index: number) => index >= 0 ? row[index] : ''

const WINTHOR_REQUIRED = ['Código','Descrição','Fornecedor','Nome do fornecedor','Descrição do departamento','Descrição da seção','Categoria','Nome da categoria','Embalagem','Embalagem Master','NCM','Unidade Venda [EAN8, UPC12, EAN13, e DUN14]']
const isWinthorProductSheet = (headers: unknown[]) => WINTHOR_REQUIRED.every(label => firstColumn(headers, label) >= 0)

function parseWinthorRows(matrix: unknown[][], previousByCode: Map<string, CatalogProduct>, images: Record<string,string>) {
  const headers = matrix[0] || []
  const brandCols = findColumns(headers, 'Marca')
  const unitCols = findColumns(headers, 'Descrição da unidade')
  const cols = {
    code: firstColumn(headers, 'Código'),
    name: firstColumn(headers, 'Descrição'),
    supplierCode: firstColumn(headers, 'Fornecedor'),
    supplierName: firstColumn(headers, 'Nome do fornecedor'),
    department: firstColumn(headers, 'Descrição do departamento'),
    section: firstColumn(headers, 'Descrição da seção'),
    brandCode: brandCols[0] ?? -1,
    brand: brandCols[1] ?? brandCols[0] ?? -1,
    categoryCode: firstColumn(headers, 'Categoria'),
    category: firstColumn(headers, 'Nome da categoria'),
    salePackaging: firstColumn(headers, 'Embalagem'),
    saleUnit: unitCols[0] ?? -1,
    masterPackaging: firstColumn(headers, 'Embalagem Master'),
    masterUnit: unitCols[1] ?? -1,
    ncmException: firstColumn(headers, 'NCM + Exceção'),
    ncm: firstColumn(headers, 'NCM'),
    saleEan: firstColumn(headers, 'Unidade Venda [EAN8, UPC12, EAN13, e DUN14]'),
    masterEan: firstColumn(headers, 'Unidade Master [EAN8, UPC12, EAN13, e DUN14]'),
  }

  const mappedFields = [
    'Código do produto','Descrição','Código do fornecedor','Nome do fornecedor','Departamento','Seção','Código da marca','Marca',
    'Código da categoria','Nome da categoria','Embalagem de venda','Unidade de venda','Embalagem master','Unidade master',
    'NCM + Exceção','NCM','EAN/DUN venda','EAN/DUN master',
  ]

  let imported = 0, updated = 0, skipped = 0
  const errors: string[] = []
  const byCode = new Map(previousByCode)

  matrix.slice(1).forEach((row, index) => {
    const code = cleanZero(valueAt(row, cols.code))
    const name = text(valueAt(row, cols.name))
    if (!code || !name) {
      skipped++
      if (errors.length < 12) errors.push(`Linha ${index + 2}: código ou descrição ausente.`)
      return
    }

    const previous = byCode.get(code)
    const supplierCode = cleanZero(valueAt(row, cols.supplierCode))
    const supplierName = text(valueAt(row, cols.supplierName))
    const department = text(valueAt(row, cols.department)) || previous?.department || 'Sem departamento'
    const section = text(valueAt(row, cols.section)) || previous?.section || 'Sem seção'
    const category = text(valueAt(row, cols.category)) || previous?.category || 'Sem categoria'
    const brand = text(valueAt(row, cols.brand)) || previous?.brand || 'Sem marca'
    const ncmException = normalizeException(valueAt(row, cols.ncmException))
    const ncm = normalizeNcm(valueAt(row, cols.ncm), valueAt(row, cols.ncmException))

    const product: CatalogProduct = {
      code,
      name,
      supplierCode,
      supplierName,
      brandCode: cleanZero(valueAt(row, cols.brandCode)),
      brand,
      department,
      section,
      categoryCode: cleanZero(valueAt(row, cols.categoryCode)),
      category,
      subcategory: previous?.subcategory || '',
      distribution: supplierName || previous?.distribution || '',
      salePackaging: text(valueAt(row, cols.salePackaging)),
      saleUnit: text(valueAt(row, cols.saleUnit)),
      masterPackaging: text(valueAt(row, cols.masterPackaging)),
      masterUnit: text(valueAt(row, cols.masterUnit)),
      ncmException,
      ncm,
      saleEan: cleanZero(valueAt(row, cols.saleEan)),
      masterEan: cleanZero(valueAt(row, cols.masterEan)),
      hierarchyPath: [department, section, category].filter(Boolean).join(' > '),
      price: previous?.price,
      showPrice: previous?.showPrice ?? false,
      image: images[code] || previous?.image || '',
      featured: previous?.featured ?? false,
      createdAt: previous?.createdAt || new Date().toISOString().slice(0,10),
      views: previous?.views || 0,
      searches: previous?.searches || 0,
    }
    if (previous) updated++; else imported++
    byCode.set(code, product)
  })

  return { products: [...byCode.values()], imported, updated, skipped, errors, mappedFields }
}

const pick = (row: Record<string, unknown>, key: keyof typeof aliases) => {
  const map = new Map(Object.entries(row).map(([k,v]) => [norm(k), v]))
  for (const alias of aliases[key]) {
    const value = map.get(norm(alias))
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

function parseGenericRows(ws: XLSX.WorkSheet, previousByCode: Map<string,CatalogProduct>, images: Record<string,string>) {
  const rows = XLSX.utils.sheet_to_json<Record<string,unknown>>(ws, { defval: '', raw: true })
  const byCode = new Map(previousByCode)
  let imported = 0, updated = 0, skipped = 0
  const errors: string[] = []
  rows.forEach((row, index) => {
    const code = pick(row, 'code')
    const name = pick(row, 'name')
    if (!code || !name) { skipped++; if (errors.length < 12) errors.push(`Linha ${index + 2}: código ou descrição ausente.`); return }
    const previous = byCode.get(code)
    const department = pick(row,'department') || previous?.department || 'Sem departamento'
    const section = pick(row,'section') || previous?.section || 'Sem seção'
    const category = pick(row,'category') || previous?.category || 'Sem categoria'
    const product: CatalogProduct = {
      code,
      name,
      brand: pick(row,'brand') || previous?.brand || 'Sem marca',
      department,
      category,
      section,
      subcategory: pick(row,'subcategory') || previous?.subcategory || '',
      distribution: pick(row,'distribution') || previous?.distribution || '',
      hierarchyPath: [department, section, category].filter(Boolean).join(' > '),
      price: pick(row,'price') || previous?.price,
      showPrice: Boolean(pick(row,'price') || previous?.showPrice),
      image: images[code] || previous?.image || '',
      featured: previous?.featured ?? false,
      createdAt: previous?.createdAt || new Date().toISOString().slice(0,10),
      views: previous?.views || 0,
      searches: previous?.searches || 0,
    }
    if (previous) updated++; else imported++
    byCode.set(code, product)
  })
  return { products:[...byCode.values()], imported, updated, skipped, errors, mappedFields:['Código','Descrição','Marca','Departamento','Seção','Categoria','Distribuição','Preço'] }
}

export function loadImportedProducts(): CatalogProduct[] {
  try { return JSON.parse(localStorage.getItem(IMPORTED_PRODUCTS_KEY) || '[]') }
  catch { return [] }
}
export function saveImportedProducts(products: CatalogProduct[]) {
  localStorage.setItem(IMPORTED_PRODUCTS_KEY, JSON.stringify(products))
}
export function loadImportedImages(): Record<string,string> {
  try { return JSON.parse(localStorage.getItem(IMPORTED_IMAGES_KEY) || '{}') }
  catch { return {} }
}
export function saveImportedImages(images: Record<string,string>) {
  localStorage.setItem(IMPORTED_IMAGES_KEY, JSON.stringify(images))
}

export async function importSpreadsheet(file: File): Promise<ImportSummary> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellText: true })
  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  if (!ws) throw new Error('A planilha não possui uma aba válida para importação.')

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true, blankrows: false })
  if (!matrix.length) throw new Error('A primeira aba da planilha está vazia.')
  const headers = matrix[0] || []
  const current = loadImportedProducts()
  const previousByCode = new Map(current.map(product => [product.code, product]))
  const images = loadImportedImages()
  const winthor = isWinthorProductSheet(headers)
  const parsed = winthor ? parseWinthorRows(matrix, previousByCode, images) : parseGenericRows(ws, previousByCode, images)

  saveImportedProducts(parsed.products)
  window.dispatchEvent(new CustomEvent('asteryon-catalog-imported'))
  return {
    imported: parsed.imported,
    updated: parsed.updated,
    skipped: parsed.skipped,
    totalRows: Math.max(0, matrix.length - 1),
    profile: winthor ? `Produtos WinThor · ${sheetName}` : `Mapeamento genérico · ${sheetName}`,
    mappedFields: parsed.mappedFields,
    errors: parsed.errors,
  }
}

const fileToDataUrl = (file: File) => new Promise<string>((resolve,reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(file)
})

export async function importProductImages(files: FileList | File[]): Promise<{linked:number; unmatched:string[]}> {
  const products = loadImportedProducts()
  const known = new Set(products.map(p => p.code))
  const images = loadImportedImages()
  let linked = 0
  const unmatched: string[] = []
  for (const file of Array.from(files)) {
    const base = file.name.replace(/\.[^.]+$/, '')
    const code = base.replace(/[_-]\d+$/, '')
    if (!known.has(code)) { unmatched.push(file.name); continue }
    images[code] = await fileToDataUrl(file)
    linked++
  }
  saveImportedImages(images)
  const refreshed = products.map(product => ({ ...product, image: images[product.code] || product.image }))
  saveImportedProducts(refreshed)
  window.dispatchEvent(new CustomEvent('asteryon-catalog-imported'))
  return { linked, unmatched }
}
