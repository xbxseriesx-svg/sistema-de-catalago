import { useMemo } from "react";
import type { EditorNode } from "../types";
import { DEVICE_WIDTH } from "../types";

/** Standalone renderer for generated nodes (preview before applying). */
export function PlanPreview({
  nodes,
  rootIds,
  pageHeight,
  background,
  width = 300,
}: {
  nodes: EditorNode[];
  rootIds: string[];
  pageHeight: number;
  background?: string;
  width?: number;
}) {
  const map = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const scale = width / DEVICE_WIDTH.desktop;
  const h = Math.max(200, pageHeight) * scale;

  const render = (id: string) => {
    const n = map[id] as EditorNode | undefined;
    if (!n || !n.visible) return null;
    const st = n.styles;
    const text = String(n.props["text"] ?? n.props["label"] ?? "");
    const isText = ["heading", "text", "paragraph", "productName", "productBrand", "productPrice"].includes(
      n.type,
    );
    const isButton = n.type === "button" || n.type === "productButton";
    const isImage = n.type === "image" || n.type === "productImage";
    return (
      <div
        key={n.id}
        style={{
          position: "absolute",
          left: n.x,
          top: n.y,
          width: n.width,
          height: n.height,
          opacity: n.opacity,
          background:
            (typeof st["background"] === "string" ? (st["background"] as string) : undefined) ??
            (isImage ? "linear-gradient(135deg,#e7ecf3,#f6f8fb)" : undefined),
          borderRadius: (st["radius"] as number) || undefined,
          border: st["borderWidth"]
            ? `${st["borderWidth"]}px solid ${String(st["borderColor"] ?? "#e2e8f0")}`
            : undefined,
          color: (st["color"] as string) ?? "#0f172a",
          fontSize: (st["fontSize"] as number) ?? 14,
          fontWeight: (st["fontWeight"] as number) ?? 400,
          textAlign: (st["textAlign"] as React.CSSProperties["textAlign"]) ?? "left",
          lineHeight: (st["lineHeight"] as number) ?? 1.3,
          display: isButton ? "flex" : undefined,
          alignItems: isButton ? "center" : undefined,
          justifyContent: isButton ? "center" : undefined,
          overflow: "hidden",
        }}
      >
        {isText || isButton ? text : null}
        {n.children.map(render)}
      </div>
    );
  };

  return (
    <div
      className="overflow-hidden rounded-lg border border-ed-border bg-white"
      style={{ width, height: h }}
    >
      <div
        style={{
          width: DEVICE_WIDTH.desktop,
          height: Math.max(200, pageHeight),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
          background: background ?? "#ffffff",
        }}
      >
        {rootIds.map(render)}
      </div>
    </div>
  );
}
