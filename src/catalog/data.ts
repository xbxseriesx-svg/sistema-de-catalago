import type { SourceType } from '../editor/types'
import { loadImportedProducts } from './imports'

export interface CatalogProduct {
  code: string
  name: string
  brand: string
  department: string
  category: string
  section: string
  subcategory: string
  distribution: string
  price?: string
  showPrice: boolean
  image: string
  featured?: boolean
  createdAt: string
  views: number
  searches: number
}

export const demoProducts: CatalogProduct[] = [
  { code: '10001', name: 'Chocolate ao Leite 80g', brand: 'Lacta', department: 'Alimentos', category: 'Bomboniere', section: 'Chocolates', subcategory: 'Barras', distribution: 'Mondelez', price: '5,99', showPrice: true, featured: true, createdAt: '2026-08-01', views: 1420, searches: 680, image: 'https://images.unsplash.com/photo-1575377427642-087cf684f29d?auto=format&fit=crop&w=800&q=80' },
  { code: '10002', name: 'Café Tradicional 500g', brand: '3 Corações', department: 'Alimentos', category: 'Mercearia', section: 'Cafés', subcategory: 'Tradicional', distribution: '3 Corações', price: '27,98', showPrice: true, featured: true, createdAt: '2026-07-25', views: 1110, searches: 730, image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80' },
  { code: '10003', name: 'Cerveja Long Neck 330ml', brand: 'Heineken', department: 'Bebidas', category: 'Cervejas', section: 'Pilsen', subcategory: 'Long Neck', distribution: 'Heineken', price: '4,49', showPrice: true, featured: true, createdAt: '2026-08-03', views: 980, searches: 520, image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=800&q=80' },
  { code: '10004', name: 'Amaciante Tradicional 1,7L', brand: 'Comfort', department: 'Limpeza', category: 'Lavanderia', section: 'Amaciantes', subcategory: 'Tradicional', distribution: 'Unilever', price: '14,39', showPrice: false, createdAt: '2026-07-10', views: 760, searches: 240, image: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=800&q=80' },
  { code: '10005', name: 'Arroz Branco 5kg', brand: 'Tio João', department: 'Alimentos', category: 'Mercearia', section: 'Arroz', subcategory: 'Branco', distribution: 'Joaquim Oliveira', price: '24,99', showPrice: true, createdAt: '2026-08-06', views: 870, searches: 300, image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80' },
  { code: '10006', name: 'Detergente Neutro 500ml', brand: 'Ypê', department: 'Limpeza', category: 'Cozinha', section: 'Detergentes', subcategory: 'Neutro', distribution: 'Química Amparo', price: '1,79', showPrice: true, createdAt: '2026-08-08', views: 640, searches: 190, image: 'https://images.unsplash.com/photo-1583947581924-860bda6a26df?auto=format&fit=crop&w=800&q=80' },
]

export const getCatalogProducts = (): CatalogProduct[] => {
  if (typeof window === 'undefined') return demoProducts
  const imported = loadImportedProducts()
  return imported.length ? imported : demoProducts
}

const pathKey = (product: CatalogProduct) => `${product.department}::${product.category}::${product.section}`

export const resolveSmartProducts = (source: SourceType, value = '', limit = 8): CatalogProduct[] => {
  let products = [...getCatalogProducts()]
  const normalized = value.trim().toLowerCase()

  switch (source) {
    case 'category': products = products.filter(p => p.category.toLowerCase() === normalized); break
    case 'brand': products = products.filter(p => p.brand.toLowerCase() === normalized); break
    case 'distribution': products = products.filter(p => p.distribution.toLowerCase() === normalized); break
    case 'promotion': products = products.filter(p => p.featured || ['10001', '10003', '10005'].includes(p.code)); break
    case 'mostViewed': products.sort((a, b) => b.views - a.views); break
    case 'mostSearched': products.sort((a, b) => b.searches - a.searches); break
    case 'newest': products.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)); break
    case 'featured': products = products.filter(p => p.featured); break
    case 'manual': default: break
  }

  if (source !== 'promotion' && products.length) {
    const safePath = pathKey(products[0])
    products = products.filter(product => pathKey(product) === safePath)
  }
  return products.slice(0, Math.max(1, limit))
}
