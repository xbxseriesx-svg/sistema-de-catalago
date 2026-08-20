import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublishedDocument } from "@/editor/components/PublishedDocument";
import { getPublishedDocument } from "@/editor/persistence";
import type { EditorDocument } from "@/editor/types";

export const Route = createFileRoute('/catalogo')({ component: PublicCatalog });
function PublicCatalog() {
  const [doc, setDoc] = useState<EditorDocument | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getPublishedDocument().then(setDoc).catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar')); }, []);
  if (error) return <main className="grid min-h-screen place-items-center bg-white p-8 text-slate-900"><div><h1 className="text-xl font-bold">Catálogo indisponível</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></main>;
  if (!doc) return <div className="grid min-h-screen place-items-center bg-white text-slate-500">Carregando catálogo…</div>;
  return <PublishedDocument doc={doc} />;
}
