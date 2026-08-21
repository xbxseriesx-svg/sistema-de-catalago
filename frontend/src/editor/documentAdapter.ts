type FrameLike = { x: number; y: number; width: number; height: number };
type ResponsiveInput = Record<string, unknown> & {
  desktop?: unknown;
  tablet?: unknown;
  mobile?: unknown;
};
type PersistedNodeInput = Record<string, unknown> & {
  id?: unknown;
  type?: unknown;
  children?: unknown;
  parentId?: unknown;
  responsive?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
};
type PersistedDocumentInput = Record<string, unknown> & {
  rootId?: unknown;
  nodes?: unknown;
};
type NodeLike = Record<string, unknown> & {
  id: string;
  type: string;
  children: string[];
  parentId: string | null;
  responsive: Record<"desktop" | "tablet" | "mobile", FrameLike>;
};
type DocumentLike = { rootId: string; nodes: Record<string, NodeLike> };

const DEVICES = ["desktop", "tablet", "mobile"] as const;

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function frame(value: unknown, fallback: FrameLike): FrameLike {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as PersistedNodeInput
    : {} as PersistedNodeInput;
  return {
    x: number(input.x, fallback.x),
    y: number(input.y, fallback.y),
    width: Math.max(1, number(input.width, fallback.width)),
    height: Math.max(1, number(input.height, fallback.height)),
  };
}

function desktopFrame(node: PersistedNodeInput): FrameLike {
  return {
    x: number(node.x),
    y: number(node.y),
    width: Math.max(1, number(node.width, 1)),
    height: Math.max(1, number(node.height, 1)),
  };
}

function normalizedResponsive(node: PersistedNodeInput) {
  const base = desktopFrame(node);
  const responsive = node.responsive && typeof node.responsive === "object" && !Array.isArray(node.responsive)
    ? node.responsive as ResponsiveInput
    : {} as ResponsiveInput;
  const desktop = frame(responsive.desktop, base);
  return {
    desktop,
    tablet: frame(responsive.tablet, desktop),
    mobile: frame(responsive.mobile, desktop),
  };
}

function flattenRecursiveNode(
  input: PersistedNodeInput,
  parentId: string | null,
  output: Record<string, NodeLike>,
): string {
  const id = String(input.id || "").trim();
  if (!id) throw new Error("Nó persistido sem id");
  if (output[id]) throw new Error(`ID duplicado no documento: ${id}`);
  const type = String(input.type || "").trim();
  if (!type) throw new Error(`Nó ${id} sem type`);
  const rawChildren = Array.isArray(input.children) ? input.children : [];
  const responsive = normalizedResponsive(input);
  const childIds = rawChildren.map((child) => {
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      throw new Error(`Filho inválido em ${id}`);
    }
    return String((child as PersistedNodeInput).id || "").trim();
  });

  output[id] = {
    ...input,
    id,
    type,
    parentId,
    x: responsive.desktop.x,
    y: responsive.desktop.y,
    width: responsive.desktop.width,
    height: responsive.desktop.height,
    responsive,
    children: childIds,
  } as NodeLike;

  rawChildren.forEach((child) => flattenRecursiveNode(child as PersistedNodeInput, id, output));
  return id;
}

function normalizeAlreadyFlat(input: PersistedDocumentInput): DocumentLike | null {
  const rootId = String(input.rootId || "").trim();
  const rawNodes = input.nodes;
  if (!rootId || !rawNodes || typeof rawNodes !== "object" || Array.isArray(rawNodes)) return null;
  const nodes: Record<string, NodeLike> = {};
  for (const [key, raw] of Object.entries(rawNodes as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Nó normalizado inválido: ${key}`);
    const node = raw as PersistedNodeInput;
    const id = String(node.id || key).trim();
    if (!id) throw new Error("Nó normalizado sem id");
    const responsive = normalizedResponsive(node);
    const rawChildren = Array.isArray(node.children) ? node.children : [];
    const children = rawChildren.map((child) => String(child || "").trim()).filter(Boolean);
    nodes[id] = {
      ...node,
      id,
      type: String(node.type || "").trim(),
      parentId: node.parentId == null ? null : String(node.parentId),
      x: responsive.desktop.x,
      y: responsive.desktop.y,
      width: responsive.desktop.width,
      height: responsive.desktop.height,
      responsive,
      children,
    } as NodeLike;
  }
  if (!nodes[rootId]) throw new Error(`rootId inexistente: ${rootId}`);
  return { rootId, nodes };
}

export function normalizePersistedDocument(input: unknown): DocumentLike | null {
  if (!input) return null;
  if (typeof input === "object" && !Array.isArray(input)) {
    const normalized = normalizeAlreadyFlat(input as PersistedDocumentInput);
    if (normalized) return normalized;
  }
  if (!Array.isArray(input) || input.length !== 1) return null;
  const root = input[0];
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  const nodes: Record<string, NodeLike> = {};
  const rootId = flattenRecursiveNode(root as PersistedNodeInput, null, nodes);
  return { rootId, nodes };
}

function recursiveNode(doc: DocumentLike, id: string, seen: Set<string>): Record<string, unknown> {
  if (seen.has(id)) throw new Error(`Ciclo detectado no documento: ${id}`);
  const node = doc.nodes[id];
  if (!node) throw new Error(`Nó referenciado não encontrado: ${id}`);
  seen.add(id);
  const responsive = node.responsive;
  const desktop = frame(responsive.desktop, desktopFrame(node));
  const tablet = frame(responsive.tablet, desktop);
  const mobile = frame(responsive.mobile, desktop);
  const children = node.children.map((childId) => recursiveNode(doc, String(childId), seen));
  seen.delete(id);

  const {
    parentId: _parentId,
    responsive: _responsive,
    children: _children,
    ...rest
  } = node;
  return {
    ...rest,
    id: node.id,
    type: node.type,
    x: desktop.x,
    y: desktop.y,
    width: desktop.width,
    height: desktop.height,
    responsive: { tablet, mobile },
    children,
  };
}

export function serializeForLegacyStorage(input: unknown): Record<string, unknown>[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Documento inválido");
  const doc = normalizeAlreadyFlat(input as PersistedDocumentInput);
  if (!doc) throw new Error("Documento normalizado inválido");
  return [recursiveNode(doc, doc.rootId, new Set())];
}

export function countDocumentNodes(input: unknown) {
  const doc = normalizePersistedDocument(input);
  return doc ? Object.keys(doc.nodes).length : 0;
}

export function hasCompleteResponsiveFrames(input: unknown) {
  const doc = normalizePersistedDocument(input);
  if (!doc) return false;
  return Object.values(doc.nodes).every((node) => DEVICES.every((device) => {
    const item = node.responsive[device];
    return [item.x, item.y, item.width, item.height].every(Number.isFinite);
  }));
}
