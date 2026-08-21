import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { useEditor } from "../store";

function Row({ id, depth }: { id: string; depth: number }) {
  const node = useEditor((s) => s.doc.nodes[id]);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const updateNode = useEditor((s) => s.updateNode);
  const commit = useEditor((s) => s.commit);
  const reparent = useEditor((s) => s.reparent);
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);

  if (!node) return null;
  const selected = selection.includes(id);
  const children = [...node.children].reverse();

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData("application/x-asteryon-layer", id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const dragged = e.dataTransfer.getData("application/x-asteryon-layer");
          if (dragged && dragged !== id) reparent(dragged, id);
        }}
        onClick={(e) => select(id, e.shiftKey || e.metaKey || e.ctrlKey)}
        onDoubleClick={() => setRenaming(true)}
        className={`group flex items-center gap-1 rounded-md py-1 pr-1.5 text-[11px] ${
          selected ? "bg-ed-accent/20 text-ed-ink" : "text-ed-muted hover:bg-ed-surface"
        }`}
        style={{ paddingLeft: 6 + depth * 12 }}
      >
        {node.children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="shrink-0 text-ed-muted"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {renaming ? (
          <input
            autoFocus
            defaultValue={node.name}
            onBlur={(e) => {
              commit();
              updateNode(id, { name: e.target.value || node.name });
              setRenaming(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="min-w-0 flex-1 rounded bg-ed-surface px-1 text-[11px] text-ed-ink outline-none"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        )}
        <span className="text-[9px] uppercase tracking-wider text-ed-muted/60">{node.type}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateNode(id, { locked: !node.locked });
          }}
          className={`shrink-0 ${node.locked ? "text-ed-accent" : "opacity-0 group-hover:opacity-100"}`}
        >
          {node.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateNode(id, { visible: !node.visible });
          }}
          className={`shrink-0 ${node.visible ? "opacity-0 group-hover:opacity-100" : "text-ed-accent"}`}
        >
          {node.visible ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
      </div>
      {open && children.map((cid) => <Row key={cid} id={cid} depth={depth + 1} />)}
    </div>
  );
}

export function LayersPanel() {
  const rootId = useEditor((s) => s.doc.rootId);
  const order = useEditor((s) => s.order);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ed-border px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ed-muted">
          Camadas
        </p>
        <div className="flex gap-1">
          {(
            [
              ["front", "Topo"],
              ["forward", "+"],
              ["backward", "−"],
              ["back", "Fundo"],
            ] as const
          ).map(([op, label]) => (
            <button
              key={op}
              onClick={() => order(op)}
              className="rounded border border-ed-border px-1.5 py-0.5 text-[9px] text-ed-muted hover:border-ed-accent hover:text-ed-ink"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        <Row id={rootId} depth={0} />
      </div>
    </div>
  );
}
