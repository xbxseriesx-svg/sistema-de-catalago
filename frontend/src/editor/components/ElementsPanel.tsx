import { useMemo, useState } from "react";
import { ELEMENTS } from "../registry";
import { useEditor } from "../store";

const BEGINNER_CATEGORIES = ["Layout", "Conteúdo", "Mídia", "Catálogo"];

export function ElementsPanel() {
  const [query, setQuery] = useState("");
  const mode = useEditor((s) => s.mode);
  const addElement = useEditor((s) => s.addElement);

  const groups = useMemo(() => {
    const list = ELEMENTS.filter((e) =>
      mode === "beginner" ? BEGINNER_CATEGORIES.includes(e.category) : true,
    ).filter((e) => e.label.toLowerCase().includes(query.toLowerCase()));
    const map = new Map<string, typeof ELEMENTS>();
    for (const el of list) {
      const arr = map.get(el.category) ?? [];
      arr.push(el);
      map.set(el.category, arr);
    }
    return [...map.entries()];
  }, [mode, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ed-border px-3 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar elemento…"
          className="w-full rounded-md border border-ed-border bg-ed-surface px-2.5 py-1.5 text-xs text-ed-ink outline-none placeholder:text-ed-muted focus:border-ed-accent"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {groups.map(([category, items]) => (
          <div key={category} className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ed-muted">
              {category}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((el) => (
                <button
                  key={el.type}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("application/x-asteryon-element", el.type)
                  }
                  onClick={() => addElement(el.type, { x: 60, y: 60 })}
                  className="cursor-grab rounded-md border border-ed-border bg-ed-surface px-2 py-2 text-left text-[11px] font-medium text-ed-ink transition-colors hover:border-ed-accent hover:bg-ed-accent/10 active:cursor-grabbing"
                >
                  {el.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
