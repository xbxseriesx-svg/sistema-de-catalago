import { ChevronRight } from "lucide-react";
import { useEditor } from "../store";
import { ancestors } from "../geometry";

export function SelectionBreadcrumb() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);

  const id = selection.length === 1 ? selection[0] : undefined;
  const chain = id ? [...ancestors(doc, id), doc.nodes[id]!] : [doc.nodes[doc.rootId]!];

  return (
    <div className="flex h-8 items-center gap-1 border-b border-ed-border bg-ed-panel px-3 text-[11px] text-ed-muted">
      {chain.map((n, i) => (
        <span key={n.id} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} className="text-ed-muted/60" />}
          <button
            onClick={() => select(n.id)}
            className={i === chain.length - 1 ? "font-semibold text-ed-ink" : "hover:text-ed-ink"}
          >
            {n.name}
          </button>
        </span>
      ))}
      {selection.length > 1 && (
        <span className="ml-2 rounded bg-ed-accent/20 px-1.5 py-0.5 text-ed-ink">
          {selection.length} selecionados
        </span>
      )}
    </div>
  );
}
