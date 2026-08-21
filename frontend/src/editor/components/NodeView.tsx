import { memo } from "react";
import { useEditor } from "../store";
import { frameOf } from "../geometry";
import type { EditorNode } from "../types";

const s = (v: unknown, fallback?: string | number) =>
  v === undefined || v === null ? fallback : (v as string | number);

function Placeholder({ label, node }: { label: string; node: EditorNode }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[inherit] border border-dashed border-ed-border/70 bg-ed-surface/60 text-ed-muted"
      style={{ borderRadius: s(node.styles["radius"], 10) as number }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-widest">{label}</span>
    </div>
  );
}

function Inner({ node }: { node: EditorNode }) {
  const st = node.styles;
  const text = String(node.props["text"] ?? "");
  const editingId = useEditor((e) => e.editingId);
  const updateProps = useEditor((e) => e.updateProps);
  const commit = useEditor((e) => e.commit);
  const isEditing = editingId === node.id;
  const preview = useEditor((e) => e.preview);

  const textStyle: React.CSSProperties = {
    fontSize: s(st["fontSize"], 16) as number,
    fontWeight: s(st["fontWeight"], 400) as number,
    color: s(st["color"], "#0f172a") as string,
    textAlign: (s(st["textAlign"], "left") as React.CSSProperties["textAlign"]) ?? "left",
    lineHeight: s(st["lineHeight"], 1.3) as number,
    letterSpacing: `${s(st["letterSpacing"], 0)}px`,
    textShadow: st["textShadow"] ? String(st["textShadow"]) : undefined,
  };

  const editable = (value: string, key: string, style: React.CSSProperties) => (
    <div
      style={style}
      className="h-full w-full outline-none"
      contentEditable={isEditing}
      suppressContentEditableWarning
      onBlur={(e) => {
        commit();
        updateProps(node.id, { [key]: e.currentTarget.textContent ?? "" });
      }}
      ref={(el) => {
        if (el && isEditing && document.activeElement !== el) el.focus();
      }}
    >
      {value}
    </div>
  );

  switch (node.type) {
    case "page":
      return null;
    case "text":
    case "heading":
    case "paragraph":
    case "productName":
    case "productBrand":
    case "productPrice":
      return editable(text, "text", textStyle);
    case "button":
    case "productButton":
      return (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            background: s(st["background"], "#1f6feb") as string,
            color: s(st["color"], "#fff") as string,
            borderRadius: s(st["radius"], 10) as number,
            fontSize: s(st["fontSize"], 15) as number,
            fontWeight: s(st["fontWeight"], 600) as number,
            border: st["borderWidth"] ? `${st["borderWidth"]}px solid ${s(st["borderColor"], "#000")}` : undefined,
            boxShadow: st["shadow"] ? String(st["shadow"]) : undefined,
          }}
        >
          {editable(String(node.props["label"] ?? "Botão"), "label", {
            textAlign: "center",
            width: "100%",
          })}
        </div>
      );
    case "image":
    case "productImage": {
      const src = String(node.props["src"] ?? "");
      const radius = s(st["radius"], 10) as number;
      if (!src)
        return (
          <div
            className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#e7ecf3,#f6f8fb)] text-[11px] font-semibold uppercase tracking-widest text-slate-400"
            style={{ borderRadius: radius }}
          >
            Imagem
          </div>
        );
      return (
        <img
          src={src}
          alt={node.name}
          className="h-full w-full object-contain"
          style={{ borderRadius: radius, objectFit: String(node.props["fit"] ?? "contain") as React.CSSProperties["objectFit"] }}
        />
      );
    }
    case "search":
      return (
        <div className="flex h-full w-full items-center rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-400">
          Buscar produtos…
        </div>
      );
    case "menu":
      return (
        <div className="flex h-full w-full items-center gap-6 px-2 text-sm font-medium text-slate-700">
          {["Início", "Categorias", "Marcas", "Contato"].map((i) => (
            <span key={i}>{i}</span>
          ))}
        </div>
      );
    case "breadcrumb":
      return (
        <div className="flex h-full w-full items-center gap-2 text-xs text-slate-500">
          Catálogo <span>/</span> Categoria <span>/</span> Produto
        </div>
      );
    case "video": {
      const src = String(node.props["src"] ?? "");
      if (!src) return <Placeholder label="Vídeo" node={node} />;
      return <video src={src} controls playsInline className="h-full w-full bg-black object-contain" style={{ objectFit: String(node.props["fit"] ?? "contain") as React.CSSProperties["objectFit"] }} />;
    }
    case "banner":
    case "hero": {
      const src = String(node.props["src"] ?? "");
      const title = String(node.props["title"] ?? (node.type === "hero" ? "Hero" : "Banner"));
      return <div className="relative h-full w-full overflow-hidden rounded-[inherit]">{src ? <img src={src} alt={title} className="h-full w-full object-contain" style={{ objectFit: String(node.props["fit"] ?? "contain") as React.CSSProperties["objectFit"] }} /> : <div className="grid h-full place-items-center text-xs font-semibold text-white/80">{title}</div>}<span className="absolute bottom-2 left-3 rounded bg-black/50 px-2 py-1 text-xs text-white">{title}</span></div>;
    }
    case "carousel": {
      const images = (node.props["images"] as string[] | undefined) ?? [];
      return images.length ? <div className="relative h-full w-full overflow-hidden rounded-[inherit]"><img src={images[0]} alt="Carrossel" className="h-full w-full object-contain" style={{ objectFit: String(node.props["fit"] ?? "contain") as React.CSSProperties["objectFit"] }}/><span className="absolute bottom-2 right-3 rounded bg-black/50 px-2 py-1 text-[10px] text-white">{images.length} slide(s)</span></div> : <Placeholder label="Carrossel" node={node}/>;
    }
    case "promotion": {
      const href=String(node.props["href"]??"#promocoes");
      const label=String(node.props["label"]??"Ver promoção");
      return <div className="flex h-full w-full flex-col items-start justify-center gap-2 p-4"><b>{String(node.props["title"]??"Promoção")}</b><a href={href} onClick={e=>{ if(!preview) e.preventDefault(); }} className="rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-white">{label}</a></div>;
    }
    case "header":
    case "footer":
      return null;
    case "gallery":
      return (
        <div className="grid h-full w-full grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg bg-slate-200" />
          ))}
        </div>
      );
    case "html":
    case "embed":
      return <Placeholder label={node.type} node={node} />;
    default:
      return null;
  }
}

const CONTAINER_LOOK: Partial<Record<EditorNode["type"], string>> = {
  frame: "bg-white/90",
  container: "bg-slate-50",
  section: "bg-white",
  row: "bg-slate-50",
  column: "bg-slate-50",
  hero: "bg-[linear-gradient(120deg,#0b1b3a,#1f6feb)]",
  banner: "bg-[linear-gradient(90deg,#111827,#374151)]",
  carousel: "bg-slate-100",
  promotion: "bg-amber-100",
  category: "bg-slate-100",
  brand: "bg-slate-100",
  distribution: "bg-slate-100",
  group: "",
};

export const NodeView = memo(function NodeView({ id }: { id: string }) {
  const node = useEditor((e) => e.doc.nodes[id]);
  const device = useEditor((e) => e.device);
  const selection = useEditor((e) => e.selection);
  const hoverId = useEditor((e) => e.hoverId);
  const preview = useEditor((e) => e.preview);

  if (!node || !node.visible) return null;
  const f = frameOf(node, device);
  const isSelected = selection.includes(id);
  const look = CONTAINER_LOOK[node.type] ?? "";

  return (
    <div
      data-node-id={id}
      data-locked={node.locked || undefined}
      className={`absolute ${look} ${preview ? "" : "transition-shadow"} ${
        !preview && isSelected ? "outline-2 outline-ed-accent" : ""
      } ${!preview && !isSelected && hoverId === id ? "outline-1 outline-ed-accent/50" : ""}`}
      style={{
        left: f.x,
        top: f.y,
        width: f.width,
        height: f.height,
        opacity: node.opacity,
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        outlineStyle: !preview && (isSelected || hoverId === id) ? "solid" : undefined,
        outlineOffset: 0,
        background:
          typeof node.styles["background"] === "string" ? node.styles["background"] : undefined,
        borderRadius: (s(node.styles["radius"], 0) as number) || undefined,
        border: node.styles["borderWidth"]
          ? `${node.styles["borderWidth"]}px solid ${s(node.styles["borderColor"], "#e2e8f0")}`
          : undefined,
        boxShadow: node.styles["shadow"] ? String(node.styles["shadow"]) : undefined,
        overflow: node.styles["clip"] ? "hidden" : undefined,
      }}
    >
      <Inner node={node} />
      {node.children.map((cid) => (
        <NodeView key={cid} id={cid} />
      ))}
    </div>
  );
});
