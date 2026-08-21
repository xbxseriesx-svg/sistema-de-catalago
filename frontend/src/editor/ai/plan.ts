/**
 * Layout plan produced by the AI -> real ASTERYON editor nodes.
 * The AI answers strict JSON; this module validates it and materializes
 * EditorNodes (identical to nodes created by hand in the editor).
 */
import { ELEMENT_MAP, makeNode } from "../registry";
import type { Device, EditorNode, Frame, NodeType } from "../types";
import { DEVICE_WIDTH } from "../types";

export interface PlanNode {
  type: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  label?: string;
  src?: string;
  styles?: Record<string, unknown>;
  children?: PlanNode[];
}

export interface LayoutPlan {
  name: string;
  rationale?: string;
  page: { width?: number; height?: number; background?: string };
  nodes: PlanNode[];
}

const ALIAS: Record<string, NodeType> = {
  header: "container",
  footer: "container",
  nav: "menu",
  navbar: "menu",
  logo: "heading",
  title: "heading",
  subtitle: "paragraph",
  cta: "button",
  link: "text",
  card: "container",
  grid: "row",
  list: "column",
  div: "container",
  box: "container",
  icon: "image",
  categories: "row",
  brands: "row",
  productcard: "product",
  vitrine: "showcase",
};

export const ALLOWED_TYPES = Object.keys(ELEMENT_MAP).filter((t) => t !== "page") as NodeType[];

function resolveType(raw: string): NodeType {
  const key = String(raw || "").trim();
  if (ELEMENT_MAP[key as NodeType]) return key as NodeType;
  const lower = key.toLowerCase().replace(/[^a-z]/g, "");
  if (ELEMENT_MAP[lower as NodeType]) return lower as NodeType;
  return ALIAS[lower] ?? "container";
}

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;

const scaleFrame = (f: Frame, ratio: number): Frame => ({
  x: Math.round(f.x * ratio),
  y: Math.round(f.y * ratio),
  width: Math.max(4, Math.round(f.width * ratio)),
  height: Math.max(4, Math.round(f.height * ratio)),
});

/** Materializes a plan into real editor nodes. Returns flat list + root ids. */
export function planToNodes(
  plan: LayoutPlan,
  parentId: string,
): { nodes: EditorNode[]; rootIds: string[]; pageHeight: number } {
  const out: EditorNode[] = [];
  const rootIds: string[] = [];
  const pageWidth = num(plan.page?.width, DEVICE_WIDTH.desktop);

  const walk = (pn: PlanNode, pid: string, fallbackY: number): EditorNode => {
    const type = resolveType(pn.type);
    const def = ELEMENT_MAP[type];
    const frame: Frame = {
      x: num(pn.x, 0),
      y: num(pn.y, fallbackY),
      width: Math.max(4, num(pn.width, def?.width ?? 200)),
      height: Math.max(4, num(pn.height, def?.height ?? 80)),
    };
    const props: Record<string, unknown> = {};
    if (typeof pn.text === "string") props["text"] = pn.text;
    if (typeof pn.label === "string") props["label"] = pn.label;
    if (typeof pn.src === "string" && pn.src) props["src"] = pn.src;

    const node = makeNode(type, frame, {
      parentId: pid,
      name: pn.name || def?.label || type,
      styles: { ...(def?.styles ?? {}), ...(pn.styles ?? {}) },
      props: { ...(def?.props ?? {}), ...props },
    });

    // Responsive derivation: proportional reflow for tablet/mobile.
    (["tablet", "mobile"] as Device[]).forEach((d) => {
      const ratio = DEVICE_WIDTH[d] / pageWidth;
      node.responsive[d] = pid === parentId ? scaleFrame(frame, ratio) : scaleFrame(frame, ratio);
    });

    out.push(node);

    const kids = Array.isArray(pn.children) ? pn.children : [];
    if (kids.length) {
      let cursor = 0;
      for (const k of kids) {
        const child = walk(k, node.id, cursor);
        node.children.push(child.id);
        cursor = child.y + child.height + 16;
      }
    } else if (def?.compose) {
      for (const child of def.compose(node)) {
        node.children.push(child.id);
        (["tablet", "mobile"] as Device[]).forEach((d) => {
          child.responsive[d] = { ...child.responsive[d] };
        });
        out.push(child);
        const cdef = ELEMENT_MAP[child.type];
        for (const g of cdef?.compose?.(child) ?? []) {
          child.children.push(g.id);
          out.push(g);
        }
      }
    }
    return node;
  };

  let cursor = 0;
  for (const pn of plan.nodes ?? []) {
    const node = walk(pn, parentId, cursor);
    node.zIndex = rootIds.length;
    rootIds.push(node.id);
    cursor = node.y + node.height;
  }

  const pageHeight = Math.max(
    num(plan.page?.height, 0),
    out.reduce((m, n) => (n.parentId === parentId ? Math.max(m, n.y + n.height) : m), 0) + 80,
  );

  return { nodes: out, rootIds, pageHeight };
}

/** Tolerant JSON extraction (models sometimes wrap JSON in prose/fences). */
export function parsePlan(raw: string): LayoutPlan {
  let text = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) text = fence[1]!.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start > 0 || end < text.length - 1) text = text.slice(start, end + 1);
  const parsed = JSON.parse(text) as LayoutPlan;
  if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new Error("A IA retornou um plano sem nós.");
  }
  parsed.name = parsed.name || "Página gerada";
  parsed.page = parsed.page ?? {};
  return parsed;
}
