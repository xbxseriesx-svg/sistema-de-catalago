type FrameLike = { x: number; y: number; width: number; height: number };
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
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    x: number(input.x, fallback.x),
    y: number(input.y, fallback.y),
    width: Math.max(1, number(input.width, fallback.width)),
    height: Math.max(1, number(input.height, fallback.height)),
  };
}

function desktopFrame(node: Record<string, unknown>): FrameLike {
  return {
    x: number(node.x),
    y: number(node.y),
    width: Math.max(1, number(node.width, 1)),
    height: Math.max(1, number(node.height, 1)),
  };
}

function normalizedResponsive(node: Record<string, unknown>) {
  const base = desktopFrame(node);
  const responsive = node.responsive && typeof node.responsive === "object"
    ? node.responsive as Record<string, unknown>
    : {};
  const desktop = frame(responsive.desktop, base);
  return {
    desktop,
    tablet: frame(responsive.tablet, desktop),
    mobile: frame(responsive.mobile, desktop),
  };
}

function flattenRecursiveNode(
  input: Record<string, unknown>,
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
    return String((child as Record<string, unknown>).id || "").trim();
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

  rawChildren.forEach((child) => flattenRecursiveNode(child as Record<string, unknown>, id, output));
  return id;
}

function normalizeAlreadyFlat(input: Record<string, unknown>): DocumentLike | null {
  const rootId = String(input.rootId || "").trim();
  const rawNodes = input.nodes;
  if (!rootId || !rawNodes || typeof rawNodes !== "object" || Array.isArray(rawNodes)) return null;
  const nodes: Record<string, NodeLike> = {};
  for (const [key, raw] of Object.entries(rawNodes as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Nó normalizado inválido: ${key}`);
    const node = raw as Record<string, unknown>;
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

/**
 * Converte tanto o formato recursivo da V94 quanto o formato normalizado Enterprise
 * para o documento editável usado pela fonte React recuperada.
 */
export function normalizePersistedDocument(input: unknown): DocumentLike | null {
  if (!input) return null;
  if (typeof input === "object" && !Array.isArray(input)) {
    const normalized = normalizeAlreadyFlat(input as Record<string, unknown>);
    if (normalized) return normalized;
  }
  if (!Array.isArray(input) || input.length !== 1) return null;
  const root = input[0];
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  const nodes: Record<string, NodeLike> = {};
  const rootId = flattenRecursiveNode(root as Record<string, unknown>, null, nodes);
  return { rootId, nodes };
}

function recursiveNode(doc: DocumentLike, id: string, seen: Set<string>): Record<string, unknown> {
  if (seen.has(id)) throw new Error(`Ciclo detectado no documento: ${id}`);
  const node = doc.nodes[id];
  if (!node) throw new Error(`Nó referenciado não encontrado: ${id}`);
  seen.add(id);
  const responsive = node.responsive || {} as NodeLike["responsive"];
  const desktop = frame(responsive.desktop, desktopFrame(node));
  const tablet = frame(responsive.tablet, desktop);
  const mobile = frame(responsive.mobile, desktop);
  const children = (Array.isArray(node.children) ? node.children : [])
    .map((childId) => recursiveNode(doc, String(childId), seen));
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

/**
 * Retorna o mesmo formato recursivo usado pela V94 em produção.
 * Isso mantém o rollback do frontend legado compatível mesmo depois de uma edição no novo editor.
 */
export function serializeForLegacyStorage(input: unknown): Record<string, unknown>[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Documento inválido");
  const doc = normalizeAlreadyFlat(input as Record<string, unknown>);
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
    const item = node.responsive?.[device];
    return !!item && [item.x, item.y, item.width, item.height].every(Number.isFinite);
  }));
}
