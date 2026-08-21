import { create } from "zustand";
import { ELEMENT_MAP, buildNodeTree, makeNode, uid } from "./registry";
import { absFrame, descendants, frameOf, unionFrame } from "./geometry";
import type { Device, EditorDocument, EditorMode, EditorNode, Frame, NodeType, ResolutionPreset } from "./types";
import { DEVICE_WIDTH, RESOLUTION_PRESETS } from "./types";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function createPage(): EditorDocument {
  const page = makeNode(
    "page",
    { x: 0, y: 0, width: DEVICE_WIDTH.desktop, height: RESOLUTION_PRESETS["1080p"].height },
    { name: "Página", styles: { background: "#ffffff" } },
  );
  page.responsive.tablet = { x: 0, y: 0, width: DEVICE_WIDTH.tablet, height: 1100 };
  page.responsive.mobile = { x: 0, y: 0, width: DEVICE_WIDTH.mobile, height: 1400 };
  return { rootId: page.id, nodes: { [page.id]: page } };
}

export interface EditorState {
  doc: EditorDocument;
  selection: string[];
  hoverId: string | null;
  editingId: string | null;
  device: Device;
  mode: EditorMode;
  zoom: number;
  resolution: ResolutionPreset;
  saveAllModes: boolean;
  saveState: "idle" | "dirty" | "saving" | "saved" | "error";
  lastSavedAt: string | null;
  pan: { x: number; y: number };
  snap: boolean;
  grid: boolean;
  gridSize: number;
  preview: boolean;
  past: EditorDocument[];
  future: EditorDocument[];

  // view
  setZoom: (z: number, anchor?: { x: number; y: number }) => void;
  setPan: (p: { x: number; y: number }) => void;
  setDevice: (d: Device) => void;
  setMode: (m: EditorMode) => void;
  setResolution: (r: ResolutionPreset) => void;
  setSaveAllModes: (enabled: boolean) => void;
  applyCurrentFrameToAllModes: () => void;
  replaceDocument: (doc: EditorDocument, resolution?: ResolutionPreset) => void;
  markSaveState: (state: EditorState["saveState"], at?: string | null) => void;
  toggle: (k: "snap" | "grid" | "preview") => void;

  // history
  commit: () => void;
  undo: () => void;
  redo: () => void;

  // selection
  select: (id: string | null, additive?: boolean) => void;
  setSelection: (ids: string[]) => void;
  setHover: (id: string | null) => void;
  setEditing: (id: string | null) => void;

  // nodes
  addElement: (type: NodeType, at?: { x: number; y: number }, parentId?: string) => void;
  updateFrame: (id: string, patch: Partial<Frame>) => void;
  updateNode: (id: string, patch: Partial<EditorNode>) => void;
  updateStyle: (id: string, patch: Record<string, unknown>) => void;
  updateProps: (id: string, patch: Record<string, unknown>) => void;
  nudge: (dx: number, dy: number) => void;
  remove: (ids?: string[]) => void;
  duplicate: () => void;
  group: () => void;
  ungroup: () => void;
  order: (op: "front" | "back" | "forward" | "backward") => void;
  reparent: (id: string, parentId: string, index?: number) => void;
  align: (op: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void;
  distribute: (axis: "h" | "v") => void;

  /** Applies AI-generated nodes into the working draft (never publishes). */
  insertNodes: (
    nodes: EditorNode[],
    rootIds: string[],
    opts?: { replace?: boolean; pageHeight?: number },
  ) => void;
}

const HISTORY_LIMIT = 60;

export const useEditor = create<EditorState>((set, get) => ({
  doc: createPage(),
  selection: [],
  hoverId: null,
  editingId: null,
  device: "desktop",
  mode: "beginner",
  zoom: 0.45,
  resolution: "1080p",
  saveAllModes: false,
  saveState: "idle",
  lastSavedAt: null,
  pan: { x: 0, y: 0 },
  snap: true,
  grid: true,
  gridSize: 8,
  preview: false,
  past: [],
  future: [],

  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.1, z)) }),
  setPan: (p) => set({ pan: p }),
  setDevice: (device) => set({ device }),
  setMode: (mode) => set({ mode }),
  setResolution: (resolution) =>
    set((s) => {
      const doc = clone(s.doc);
      const page = doc.nodes[doc.rootId];
      const preset = RESOLUTION_PRESETS[resolution];
      if (page) {
        page.responsive.desktop = { ...page.responsive.desktop, width: preset.width, height: preset.height };
        Object.assign(page, page.responsive.desktop);
      }
      return { doc, resolution, saveState: "dirty" };
    }),
  setSaveAllModes: (saveAllModes) => set({ saveAllModes }),
  applyCurrentFrameToAllModes: () =>
    set((s) => {
      if (s.selection.length !== 1) return {};
      const doc = clone(s.doc);
      const node = doc.nodes[s.selection[0]!];
      if (!node) return {};
      const current = { ...frameOf(node, s.device) };
      (["desktop", "tablet", "mobile"] as Device[]).forEach((d) => {
        node.responsive[d] = { ...current };
      });
      Object.assign(node, node.responsive.desktop);
      return { doc, saveState: "dirty" };
    }),
  replaceDocument: (doc, resolution) => set({ doc: clone(doc), selection: [], editingId: null, past: [], future: [], ...(resolution ? { resolution } : {}), saveState: "saved" }),
  markSaveState: (saveState, at) => set({ saveState, ...(at !== undefined ? { lastSavedAt: at } : {}) }),
  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<EditorState>),

  commit: () =>
    set((s) => ({
      past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT),
      future: [],
    })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return {};
      return { doc: prev, past: s.past.slice(0, -1), future: [clone(s.doc), ...s.future] };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return {};
      return { doc: next, future: s.future.slice(1), past: [...s.past, clone(s.doc)] };
    }),

  select: (id, additive) =>
    set((s) => {
      if (!id) return { selection: [], editingId: null };
      if (!additive) return { selection: [id], editingId: null };
      return {
        selection: s.selection.includes(id)
          ? s.selection.filter((x) => x !== id)
          : [...s.selection, id],
        editingId: null,
      };
    }),
  setSelection: (ids) => set({ selection: ids }),
  setHover: (hoverId) => set({ hoverId }),
  setEditing: (editingId) => set({ editingId }),

  addElement: (type, at, parentId) => {
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const parent = doc.nodes[parentId ?? doc.rootId] ?? doc.nodes[doc.rootId]!;
      const def = ELEMENT_MAP[type];
      const nodes = buildNodeTree(type, {
        x: Math.round(at?.x ?? 40),
        y: Math.round(at?.y ?? 40),
        width: def?.width ?? 200,
        height: def?.height ?? 120,
      });
      const root = nodes[0]!;
      root.parentId = parent.id;
      root.zIndex = parent.children.length;
      for (const n of nodes) doc.nodes[n.id] = n;
      parent.children.push(root.id);
      return { doc, selection: [root.id], saveState: "dirty" };
    });
  },

  updateFrame: (id, patch) =>
    set((s) => {
      const doc = clone(s.doc);
      const node = doc.nodes[id];
      if (!node) return {};
      const f = { ...frameOf(node, s.device), ...patch };
      f.width = Math.max(4, f.width);
      f.height = Math.max(4, f.height);
      if (s.saveAllModes && node.id !== doc.rootId) {
        (["desktop", "tablet", "mobile"] as Device[]).forEach((d) => {
          node.responsive[d] = { ...f };
        });
      } else {
        node.responsive[s.device] = f;
      }
      // Desktop has one source of truth: responsive.desktop. Legacy base fields only mirror it.
      Object.assign(node, node.responsive.desktop);
      return { doc, saveState: "dirty" };
    }),

  updateNode: (id, patch) =>
    set((s) => {
      const doc = clone(s.doc);
      const node = doc.nodes[id];
      if (!node) return {};
      Object.assign(node, patch);
      return { doc, saveState: "dirty" };
    }),

  updateStyle: (id, patch) =>
    set((s) => {
      const doc = clone(s.doc);
      const node = doc.nodes[id];
      if (!node) return {};
      node.styles = { ...node.styles, ...patch };
      return { doc, saveState: "dirty" };
    }),

  updateProps: (id, patch) =>
    set((s) => {
      const doc = clone(s.doc);
      const node = doc.nodes[id];
      if (!node) return {};
      node.props = { ...node.props, ...patch };
      return { doc, saveState: "dirty" };
    }),

  nudge: (dx, dy) =>
    set((s) => {
      const doc = clone(s.doc);
      for (const id of s.selection) {
        const node = doc.nodes[id];
        if (!node || node.locked) continue;
        const f = frameOf(node, s.device);
        const next = { ...f, x: f.x + dx, y: f.y + dy };
        if (s.saveAllModes) (["desktop", "tablet", "mobile"] as Device[]).forEach((d) => (node.responsive[d] = { ...next }));
        else node.responsive[s.device] = next;
        Object.assign(node, node.responsive.desktop);
      }
      return { doc };
    }),

  remove: (ids) => {
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const target = ids ?? s.selection;
      for (const id of target) {
        if (id === doc.rootId) continue;
        const node = doc.nodes[id];
        if (!node) continue;
        for (const d of descendants(doc, id)) delete doc.nodes[d];
        const parent = node.parentId ? doc.nodes[node.parentId] : undefined;
        if (parent) parent.children = parent.children.filter((c) => c !== id);
        delete doc.nodes[id];
      }
      return { doc, selection: [], editingId: null, saveState: "dirty" };
    });
  },

  duplicate: () => {
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const created: string[] = [];
      const copy = (id: string, parentId: string, offset: number): string | null => {
        const src = doc.nodes[id];
        if (!src) return null;
        const nid = uid();
        const next: EditorNode = clone(src);
        next.id = nid;
        next.parentId = parentId;
        next.children = [];
        next.responsive = clone(src.responsive);
        (["desktop", "tablet", "mobile"] as Device[]).forEach((d) => {
          next.responsive[d] = {
            ...next.responsive[d],
            x: next.responsive[d].x + offset,
            y: next.responsive[d].y + offset,
          };
        });
        next.x += offset;
        next.y += offset;
        doc.nodes[nid] = next;
        for (const c of src.children) {
          const cid = copy(c, nid, 0);
          if (cid) next.children.push(cid);
        }
        return nid;
      };
      for (const id of s.selection) {
        const src = doc.nodes[id];
        if (!src?.parentId) continue;
        const nid = copy(id, src.parentId, 24);
        if (nid) {
          doc.nodes[src.parentId]?.children.push(nid);
          created.push(nid);
        }
      }
      return { doc, selection: created, saveState: "dirty" };
    });
  },

  group: () => {
    const { selection, doc: cur, device } = get();
    if (selection.length < 2) return;
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const first = doc.nodes[selection[0]!];
      const parentId = first?.parentId ?? doc.rootId;
      const rects = selection.map((id) => absFrame(cur, id, device));
      const box = unionFrame(rects);
      const parentAbs = absFrame(cur, parentId, device);
      const g = makeNode(
        "group",
        {
          x: box.x - (parentId === doc.rootId ? 0 : parentAbs.x),
          y: box.y - (parentId === doc.rootId ? 0 : parentAbs.y),
          width: box.width,
          height: box.height,
        },
        { name: "Grupo", parentId },
      );
      doc.nodes[g.id] = g;
      const parent = doc.nodes[parentId];
      if (parent) {
        parent.children = parent.children.filter((c) => !selection.includes(c));
        parent.children.push(g.id);
      }
      selection.forEach((id, i) => {
        const n = doc.nodes[id];
        if (!n) return;
        const old = n.parentId ? doc.nodes[n.parentId] : undefined;
        if (old && old.id !== parentId) old.children = old.children.filter((c) => c !== id);
        n.parentId = g.id;
        const abs = rects[i]!;
        (["desktop", "tablet", "mobile"] as Device[]).forEach((d) => {
          n.responsive[d] = {
            ...n.responsive[d],
            x: abs.x - box.x,
            y: abs.y - box.y,
          };
        });
        Object.assign(n, n.responsive.desktop);
        g.children.push(id);
      });
      return { doc, selection: [g.id], saveState: "dirty" };
    });
  },

  ungroup: () => {
    const { selection, doc: cur, device } = get();
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const next: string[] = [];
      for (const id of selection) {
        const g = doc.nodes[id];
        if (!g || g.children.length === 0 || !g.parentId) continue;
        const parent = doc.nodes[g.parentId];
        if (!parent) continue;
        for (const cid of [...g.children]) {
          const child = doc.nodes[cid];
          if (!child) continue;
          const abs = absFrame(cur, cid, device);
          const parentAbs = absFrame(cur, parent.id, device);
          child.parentId = parent.id;
          (["desktop", "tablet", "mobile"] as Device[]).forEach((d) => {
            child.responsive[d] = {
              ...child.responsive[d],
              x: abs.x - (parent.parentId === null ? 0 : parentAbs.x),
              y: abs.y - (parent.parentId === null ? 0 : parentAbs.y),
            };
          });
          Object.assign(child, child.responsive.desktop);
          parent.children.push(cid);
          next.push(cid);
        }
        parent.children = parent.children.filter((c) => c !== id);
        delete doc.nodes[id];
      }
      return { doc, selection: next, saveState: "dirty" };
    });
  },

  order: (op) => {
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      for (const id of s.selection) {
        const node = doc.nodes[id];
        const parent = node?.parentId ? doc.nodes[node.parentId] : undefined;
        if (!node || !parent) continue;
        const i = parent.children.indexOf(id);
        parent.children.splice(i, 1);
        const to =
          op === "front"
            ? parent.children.length
            : op === "back"
              ? 0
              : op === "forward"
                ? Math.min(parent.children.length, i + 1)
                : Math.max(0, i - 1);
        parent.children.splice(to, 0, id);
        parent.children.forEach((cid, idx) => {
          const c = doc.nodes[cid];
          if (c) c.zIndex = idx;
        });
      }
      return { doc };
    });
  },

  reparent: (id, parentId, index) => {
    const { doc: cur, device } = get();
    if (id === parentId) return;
    if (descendants(cur, id).includes(parentId)) return;
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const node = doc.nodes[id];
      const parent = doc.nodes[parentId];
      if (!node || !parent || !node.parentId) return {};
      const abs = absFrame(cur, id, device);
      const parentAbs = absFrame(cur, parentId, device);
      const old = doc.nodes[node.parentId];
      if (old) old.children = old.children.filter((c) => c !== id);
      node.parentId = parentId;
      const isRoot = parent.parentId === null;
      (["desktop", "tablet", "mobile"] as Device[]).forEach((d) => {
        node.responsive[d] = {
          ...node.responsive[d],
          x: abs.x - (isRoot ? 0 : parentAbs.x),
          y: abs.y - (isRoot ? 0 : parentAbs.y),
        };
      });
      Object.assign(node, node.responsive.desktop);
      const at = index ?? parent.children.length;
      parent.children.splice(Math.max(0, Math.min(at, parent.children.length)), 0, id);
      return { doc };
    });
  },

  align: (op) => {
    const { selection, doc: cur, device } = get();
    if (selection.length === 0) return;
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const rects = selection.map((id) => absFrame(cur, id, device));
      const box =
        selection.length > 1
          ? unionFrame(rects)
          : absFrame(cur, doc.nodes[selection[0]!]?.parentId ?? doc.rootId, device);
      selection.forEach((id, i) => {
        const n = doc.nodes[id];
        const r = rects[i];
        if (!n || !r) return;
        const f = frameOf(n, s.device);
        let nx = f.x;
        let ny = f.y;
        if (op === "left") nx += box.x - r.x;
        if (op === "right") nx += box.x + box.width - (r.x + r.width);
        if (op === "hcenter") nx += box.x + box.width / 2 - (r.x + r.width / 2);
        if (op === "top") ny += box.y - r.y;
        if (op === "bottom") ny += box.y + box.height - (r.y + r.height);
        if (op === "vcenter") ny += box.y + box.height / 2 - (r.y + r.height / 2);
        n.responsive[s.device] = { ...f, x: nx, y: ny };
        if (s.device === "desktop") Object.assign(n, n.responsive.desktop);
      });
      return { doc };
    });
  },

  distribute: (axis) => {
    const { selection, doc: cur, device } = get();
    if (selection.length < 3) return;
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const items = selection
        .map((id) => ({ id, rect: absFrame(cur, id, device) }))
        .sort((a, b) => (axis === "h" ? a.rect.x - b.rect.x : a.rect.y - b.rect.y));
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const total =
        axis === "h"
          ? last.rect.x + last.rect.width - first.rect.x
          : last.rect.y + last.rect.height - first.rect.y;
      const used = items.reduce((a, it) => a + (axis === "h" ? it.rect.width : it.rect.height), 0);
      const gap = (total - used) / (items.length - 1);
      let cursor = axis === "h" ? first.rect.x : first.rect.y;
      for (const it of items) {
        const n = doc.nodes[it.id];
        if (!n) continue;
        const f = frameOf(n, s.device);
        const delta = cursor - (axis === "h" ? it.rect.x : it.rect.y);
        n.responsive[s.device] =
          axis === "h" ? { ...f, x: f.x + delta } : { ...f, y: f.y + delta };
        if (s.device === "desktop") Object.assign(n, n.responsive[s.device]);
        cursor += (axis === "h" ? it.rect.width : it.rect.height) + gap;
      }
      return { doc };
    });
  },

  insertNodes: (nodes, rootIds, opts) => {
    get().commit();
    set((s) => {
      const doc = clone(s.doc);
      const page = doc.nodes[doc.rootId]!;
      if (opts?.replace) {
        for (const cid of [...page.children]) {
          for (const d of descendants(doc, cid)) delete doc.nodes[d];
          delete doc.nodes[cid];
        }
        page.children = [];
      }
      for (const n of clone(nodes)) {
        if (n.parentId === "__page__" || n.parentId === null) n.parentId = doc.rootId;
        doc.nodes[n.id] = n;
      }
      for (const id of rootIds) {
        const n = doc.nodes[id];
        if (!n) continue;
        n.parentId = doc.rootId;
        n.zIndex = page.children.length;
        page.children.push(id);
      }
      if (opts?.pageHeight) {
        const h = Math.max(600, Math.round(opts.pageHeight));
        page.height = h;
        page.responsive.desktop = { ...page.responsive.desktop, height: h };
        page.responsive.tablet = { ...page.responsive.tablet, height: Math.round(h * 1.15) };
        page.responsive.mobile = { ...page.responsive.mobile, height: Math.round(h * 1.6) };
      }
      return { doc, selection: rootIds.slice(0, 1), saveState: "dirty" };
    });
  },
}));
