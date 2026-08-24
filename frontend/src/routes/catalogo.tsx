import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PublishedDocument } from "@/editor/components/PublishedDocument";
import { getPublishedDocument } from "@/editor/persistence";
import type { EditorDocument } from "@/editor/types";

export const Route = createFileRoute('/catalogo')({ component: PublicCatalog });

type CommercialSegment = { id: string; name: string; sortOrder: number };
type SegmentProduct = {
  id: string;
  code: string;
  name: string;
  image?: string | null;
  packaging?: string | null;
  unit?: string | null;
};

function SegmentCatalog({ segmentId }: { segmentId: string }) {
  const [segments, setSegments] = useState<CommercialSegment[]>([]);
  const [products, setProducts] = useState<SegmentProduct[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const limit = 100;

  const segment = useMemo(() => segments.find((item) => item.id === segmentId), [segments, segmentId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/api/public/commercial-segments').then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os segmentos.');
        return response.json();
      }),
      fetch(`/api/public/commercial-segments/${encodeURIComponent(segmentId)}/products?offset=0&limit=${limit}`).then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os produtos do segmento.');
        return response.json();
      }),
    ]).then(([segmentPayload, productPayload]) => {
      if (!active) return;
      setSegments(Array.isArray(segmentPayload?.segments) ? segmentPayload.segments : []);
      const first = Array.isArray(productPayload?.products) ? productPayload.products : [];
      setProducts(first);
      setOffset(first.length);
      setHasMore(Boolean(productPayload?.hasMore));
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Falha ao carregar segmento.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [segmentId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/public/commercial-segments/${encodeURIComponent(segmentId)}/products?offset=${offset}&limit=${limit}`);
      if (!response.ok) throw new Error('Falha ao carregar mais produtos.');
      const payload = await response.json();
      const next = Array.isArray(payload?.products) ? payload.products : [];
      setProducts((current) => [...current, ...next]);
      setOffset((current) => current + next.length);
      setHasMore(Boolean(payload?.hasMore));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar mais produtos.');
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-white text-slate-500">Carregando segmento…</div>;
  if (error && !products.length) return <main className="grid min-h-screen place-items-center bg-white p-8 text-slate-900"><div><h1 className="text-xl font-bold">Segmento indisponível</h1><p className="mt-2 text-sm text-slate-500">{error}</p><a className="mt-5 inline-block text-sm font-semibold text-blue-700" href="/catalogo">Voltar ao catálogo</a></div></main>;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto w-full max-w-[1500px] px-5 py-8 sm:px-8">
        <a href="/catalogo" className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">← Catálogo</a>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Segmento comercial</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{segment?.name || 'Produtos do segmento'}</h1>
            <p className="mt-2 text-sm text-slate-500">Produtos priorizados automaticamente para este perfil de cliente.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{products.length}{hasMore ? '+' : ''} produtos</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {products.map((product) => (
            <article key={product.id} className="flex min-h-44 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="grid h-24 place-items-center overflow-hidden rounded-lg bg-slate-50">
                {product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-contain p-2" loading="lazy" /> : <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-300">Produto</span>}
              </div>
              <span className="mt-3 text-[10px] font-semibold text-blue-700">Cód. {product.code}</span>
              <strong className="mt-1 line-clamp-3 text-xs leading-4 text-slate-800">{product.name}</strong>
              {(product.packaging || product.unit) && <span className="mt-auto pt-2 text-[10px] text-slate-400">{[product.packaging, product.unit].filter(Boolean).join(' · ')}</span>}
            </article>
          ))}
        </div>

        {!products.length && <div className="mt-12 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Nenhum produto disponível neste segmento.</div>}
        {error && products.length ? <p className="mt-5 text-center text-xs text-red-600">{error}</p> : null}
        {hasMore && <div className="mt-8 text-center"><button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50">{loadingMore ? 'Carregando…' : 'Carregar mais produtos'}</button></div>}
      </div>
    </main>
  );
}

function PublicCatalog() {
  const [doc, setDoc] = useState<EditorDocument | null>(null);
  const [error, setError] = useState('');
  const segmentId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('segment') || '' : '';

  useEffect(() => {
    if (segmentId) return;
    getPublishedDocument().then(setDoc).catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar'));
  }, [segmentId]);

  if (segmentId) return <SegmentCatalog segmentId={segmentId} />;
  if (error) return <main className="grid min-h-screen place-items-center bg-white p-8 text-slate-900"><div><h1 className="text-xl font-bold">Catálogo indisponível</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></main>;
  if (!doc) return <div className="grid min-h-screen place-items-center bg-white text-slate-500">Carregando catálogo…</div>;
  return <PublishedDocument doc={doc} />;
}
