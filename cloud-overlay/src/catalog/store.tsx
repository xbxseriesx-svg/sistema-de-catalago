import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BRANDS, COMPANY, DISTRIBUTIONS, HIERARCHY, PRODUCTS, PROMOTIONS } from './seed';
import type { Brand, Distribution, HierarchyNode, Product, Promotion } from './types';
import { cloudApi, isCloudRuntime } from '../cloud/api';

interface CatalogState {
  products: Product[];
  brands: Brand[];
  distributions: Distribution[];
  hierarchy: HierarchyNode[];
  promotions: Promotion[];
}

interface CatalogContextValue extends CatalogState {
  productById: (id?: string | null) => Product | undefined;
  brandName: (id?: string | null) => string;
  distributionName: (id?: string | null) => string;
  hierarchyPath: (product: Product) => string[];
  searchProducts: (query: string) => Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  cloudLoading: boolean;
  cloudError: string | null;
  reloadCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [brands, setBrands] = useState<Brand[]>(BRANDS);
  const [distributions, setDistributions] = useState<Distribution[]>(DISTRIBUTIONS);
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>(HIERARCHY);
  const [promotions, setPromotions] = useState<Promotion[]>(PROMOTIONS);
  const [cloudLoading, setCloudLoading] = useState(isCloudRuntime());
  const [cloudError, setCloudError] = useState<string | null>(null);

  const reloadCatalog = async () => {
    if (!isCloudRuntime()) return;
    setCloudLoading(true);
    try {
      const result = await cloudApi.getCatalog(false);
      setProducts(result.catalog.products);
      setBrands(result.catalog.brands);
      setDistributions(result.catalog.distributions);
      setHierarchy(result.catalog.hierarchy);
      setPromotions(result.catalog.promotions);
      setCloudError(null);
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Falha ao carregar catálogo do D1');
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    void reloadCatalog();
  }, []);

  const value = useMemo<CatalogContextValue>(() => ({
    products,
    brands,
    distributions,
    hierarchy,
    promotions,
    productById: (id) => products.find((p) => p.id === id),
    brandName: (id) => brands.find((b) => b.id === id)?.name ?? 'Sem marca',
    distributionName: (id) => distributions.find((d) => d.id === id)?.name ?? 'Sem distribuição',
    hierarchyPath: (product) => [product.departamentoId, product.categoriaId, product.secaoId, product.subcategoriaId]
      .map((id) => hierarchy.find((n) => n.id === id)?.name)
      .filter((v): v is string => Boolean(v)),
    searchProducts: (query) => {
      const q = query.trim().toLowerCase();
      if (!q) return products;
      return products.filter((p) => {
        const brand = brands.find((b) => b.id === p.brandId)?.name ?? '';
        const dist = distributions.find((d) => d.id === p.distributionId)?.name ?? '';
        const hier = [p.departamentoId, p.categoriaId, p.secaoId, p.subcategoriaId]
          .map((id) => hierarchy.find((n) => n.id === id)?.name ?? '')
          .join(' ');
        return [p.code, p.ean, p.shortDescription, p.longDescription, brand, dist, hier, p.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
    },
    setProducts,
    cloudLoading,
    cloudError,
    reloadCatalog,
  }), [products, brands, distributions, hierarchy, promotions, cloudLoading, cloudError]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog deve ser usado dentro de CatalogProvider');
  return ctx;
}

export function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export { COMPANY };
