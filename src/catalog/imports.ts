import * as XLSX from 'xlsx'
import type { CatalogProduct } from './data'

export const IMPORTED_PRODUCTS_KEY = 'asteryon_imported_products_v1'
export const IMPORTED_IMAGES_KEY = 'asteryon_imported_images_v1'

export type ImportSummary = {
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

const aliases: Record<string, string[]> = {
  code: ['codigo','código','cod','codigo produto','código produto','sku','id'],
  name: ['descricao','descrição','produto','nome','nome produto','descricao produto','descrição produto'],
  brand: ['marca','brand'],
  department: ['departamento','depto'],
  category: ['categoria'],
  section: ['secao','seção'],
  subcategory: ['subcategoria','sub categoria'],
  distribution: ['distribuicao','distribuição','distribuidor','fornecedor'],
  price: ['preco','preço','valor','preco venda','preço venda'],
}

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const pick = (row: Record<string, unknown>, key: keyof typeof aliases) => {
  const map = new Map(Object.entries(row).map(([k,v]) => [norm(k), v]))
  for (const alias of aliases[key]) {
    const value = map.get(norm(alias))
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
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
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string,unknown>>(ws, { defval: '' })
  const current = loadImportedProducts()
  const byCode = new Map(current.map(product => [product.code, product]))
  const images = loadImportedImages()
  let imported = 0, updated = 0, skipped = 0
  const errors: string[] = []

  rows.forEach((row, index) => {
    const code = pick(row, 'code')
    const name = pick(row, 'name')
    if (!code || !name) { skipped++; if (errors.length < 12) errors.push(`Linha ${index + 2}: código ou descrição ausente.`); return }
    const previous = byCode.get(code)
    const product: CatalogProduct = {
      code,
      name,
      brand: pick(row,'brand') || previous?.brand || 'Sem marca',
      department: pick(row,'department') || previous?.department || 'Sem departamento',
      category: pick(row,'category') || previous?.category || 'Sem categoria',
      section: pick(row,'section') || previous?.section || 'Sem seção',
      subcategory: pick(row,'subcategory') || previous?.subcategory || '',
      distribution: pick(row,'distribution') || previous?.distribution || '',
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

  saveImportedProducts([...byCode.values()])
  window.dispatchEvent(new CustomEvent('asteryon-catalog-imported'))
  return { imported, updated, skipped, errors }
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
