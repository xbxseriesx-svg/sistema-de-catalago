import type { Device, EditorDocument, EditorNode, Frame, Guide } from "./types";

export const frameOf = (node: EditorNode, device: Device): Frame => node.responsive[device];

export function absFrame(doc: EditorDocument, id: string, device: Device): Frame {
  const node = doc.nodes[id];
  if (!node) return { x: 0, y: 0, width: 0, height: 0 };
  const f = frameOf(node, device);
  let x = f.x;
  let y = f.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = doc.nodes[parentId];
    if (!parent) break;
    const pf = frameOf(parent, device);
    if (parent.parentId !== null) { x += pf.x; y += pf.y; }
    parentId = parent.parentId;
  }
  return { x, y, width: f.width, height: f.height };
}

export function ancestors(doc: EditorDocument, id: string): EditorNode[] {
  const out: EditorNode[] = [];
  let cur = doc.nodes[id]?.parentId ?? null;
  while (cur) {
    const parent = doc.nodes[cur];
    if (!parent) break;
    out.unshift(parent);
    cur = parent.parentId;
  }
  return out;
}

export function descendants(doc: EditorDocument, id: string): string[] {
  const out: string[] = [];
  const walk = (nid: string) => {
    for (const c of doc.nodes[nid]?.children ?? []) { out.push(c); walk(c); }
  };
  walk(id);
  return out;
}

export const unionFrame = (list: Frame[]): Frame => {
  const x = Math.min(...list.map((f) => f.x));
  const y = Math.min(...list.map((f) => f.y));
  const r = Math.max(...list.map((f) => f.x + f.width));
  const b = Math.max(...list.map((f) => f.y + f.height));
  return { x, y, width: r - x, height: b - y };
};

const THRESHOLD = 6;
type SnapResult = { dx: number; dy: number; guides: Guide[] };

export function computeSnap(moving: Frame, targets: Frame[], page: Frame, opts: { snap: boolean; grid: boolean; gridSize: number; zoom: number }): SnapResult {
  if (!opts.snap) return { dx: 0, dy: 0, guides: [] };
  const t = THRESHOLD / Math.max(opts.zoom, 0.2);
  const guides: Guide[] = [];
  let dx = 0, dy = 0, bestX = t, bestY = t;
  const movX = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const movY = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];
  const all = [...targets, page];
  for (const [i, target] of all.entries()) {
    const isPage = i === all.length - 1;
    const tX = [target.x, target.x + target.width / 2, target.x + target.width];
    const tY = [target.y, target.y + target.height / 2, target.y + target.height];
    tX.forEach((tv, ti) => movX.forEach((mv) => {
      const d = tv - mv;
      if (Math.abs(d) <= bestX) { bestX = Math.abs(d); dx = d; guides.push({ axis: "x", position: tv, start: Math.min(moving.y, target.y), end: Math.max(moving.y + moving.height, target.y + target.height), kind: isPage ? "canvas" : ti === 1 ? "center" : "edge" }); }
    }));
    tY.forEach((tv, ti) => movY.forEach((mv) => {
      const d = tv - mv;
      if (Math.abs(d) <= bestY) { bestY = Math.abs(d); dy = d; guides.push({ axis: "y", position: tv, start: Math.min(moving.x, target.x), end: Math.max(moving.x + moving.width, target.x + target.width), kind: isPage ? "canvas" : ti === 1 ? "center" : "edge" }); }
    }));
  }
  if (opts.grid && dx === 0) { const gx = Math.round(moving.x / opts.gridSize) * opts.gridSize - moving.x; if (Math.abs(gx) <= t) dx = gx; }
  if (opts.grid && dy === 0) { const gy = Math.round(moving.y / opts.gridSize) * opts.gridSize - moving.y; if (Math.abs(gy) <= t) dy = gy; }
  const keep = guides.filter((g) => g.axis === "x"
    ? [moving.x + dx, moving.x + dx + moving.width / 2, moving.x + dx + moving.width].some((v) => Math.abs(v - g.position) < 0.5)
    : [moving.y + dy, moving.y + dy + moving.height / 2, moving.y + dy + moving.height].some((v) => Math.abs(v - g.position) < 0.5));
  return { dx, dy, guides: keep };
}
