import type { Device, EditorNode, Frame, NodeType } from "./types";

let counter = 0;
export const uid = () => `n${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export type ElementDef = {
  type: NodeType;
  label: string;
  category: "Layout" | "Conteúdo" | "Mídia" | "Navegação" | "Marketing" | "Catálogo" | "Avançado";
  width: number;
  height: number;
  beginner?: boolean;
  styles?: Record<string, unknown>;
  props?: Record<string, unknown>;
  /** Composed elements: atomic children built at insert time. */
  compose?: (self: EditorNode) => EditorNode[];
};

const frames = (f: Frame): Record<Device, Frame> => ({
  desktop: { ...f },
  tablet: { ...f },
  mobile: { ...f },
});

export function makeNode(
  type: NodeType,
  frame: Frame,
  overrides: Partial<EditorNode> = {},
): EditorNode {
  const def = ELEMENTS.find((e) => e.type === type);
  return {
    id: uid(),
    type,
    name: overrides.name ?? def?.label ?? type,
    parentId: null,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    rotation: 0,
    zIndex: 0,
    visible: true,
    locked: false,
    opacity: 1,
    responsive: frames(frame),
    styles: { ...(def?.styles ?? {}), ...(overrides.styles ?? {}) },
    props: { ...(def?.props ?? {}), ...(overrides.props ?? {}) },
    children: [],
    ...overrides,
  } as EditorNode;
}

const productAtoms = (self: EditorNode): EditorNode[] => {
  const pad = 12;
  const w = self.width - pad * 2;
  return [
    makeNode(
      "productImage",
      { x: pad, y: pad, width: w, height: self.height * 0.52 },
      { parentId: self.id, name: "Imagem" },
    ),
    makeNode(
      "productBrand",
      { x: pad, y: self.height * 0.52 + pad + 10, width: w, height: 16 },
      { parentId: self.id, name: "Marca" },
    ),
    makeNode(
      "productName",
      { x: pad, y: self.height * 0.52 + pad + 30, width: w, height: 40 },
      { parentId: self.id, name: "Nome" },
    ),
    makeNode(
      "productPrice",
      { x: pad, y: self.height * 0.52 + pad + 74, width: w, height: 26 },
      { parentId: self.id, name: "Preço" },
    ),
    makeNode(
      "productButton",
      { x: pad, y: self.height - 52, width: w, height: 38 },
      { parentId: self.id, name: "Botão" },
    ),
  ];
};

export const ELEMENTS: ElementDef[] = [
  // Layout
  { type: "frame", label: "Frame", category: "Layout", width: 480, height: 320, beginner: true },
  { type: "container", label: "Container", category: "Layout", width: 520, height: 260 },
  { type: "row", label: "Row", category: "Layout", width: 560, height: 160 },
  { type: "column", label: "Column", category: "Layout", width: 240, height: 320 },
  { type: "section", label: "Section", category: "Layout", width: 900, height: 360 },

  // Conteúdo
  {
    type: "heading",
    label: "Título",
    category: "Conteúdo",
    width: 420,
    height: 56,
    beginner: true,
    props: { text: "Título da seção" },
    styles: { fontSize: 40, fontWeight: 700, color: "var(--ed-ink)", textAlign: "left" },
  },
  {
    type: "text",
    label: "Texto",
    category: "Conteúdo",
    width: 300,
    height: 28,
    beginner: true,
    props: { text: "Texto editável" },
    styles: { fontSize: 18, fontWeight: 500, color: "var(--ed-ink)", textAlign: "left" },
  },
  {
    type: "paragraph",
    label: "Parágrafo",
    category: "Conteúdo",
    width: 420,
    height: 96,
    beginner: true,
    props: {
      text: "Parágrafo de apoio para descrever produtos, condições comerciais ou destaques do catálogo.",
    },
    styles: { fontSize: 15, fontWeight: 400, color: "var(--ed-muted)", lineHeight: 1.6 },
  },
  {
    type: "button",
    label: "Botão",
    category: "Conteúdo",
    width: 180,
    height: 46,
    beginner: true,
    props: { label: "Ver catálogo" },
    styles: { radius: 10, background: "#1f6feb", color: "#ffffff", fontSize: 15, fontWeight: 600 },
  },

  // Mídia
  {
    type: "image",
    label: "Imagem",
    category: "Mídia",
    width: 320,
    height: 220,
    beginner: true,
    props: { src: "", fit: "contain" },
    styles: { radius: 12 },
  },
  { type: "gallery", label: "Galeria", category: "Mídia", width: 520, height: 220, props: { images: [] } },
  { type: "video", label: "Vídeo", category: "Mídia", width: 480, height: 270, props: { src: "", fit: "contain" } },

  // Navegação
  { type: "search", label: "Busca", category: "Navegação", width: 360, height: 46 },
  { type: "menu", label: "Menu", category: "Navegação", width: 520, height: 48 },
  { type: "breadcrumb", label: "Breadcrumb", category: "Navegação", width: 380, height: 28 },
  {
    type: "header",
    label: "Header",
    category: "Navegação",
    width: 960,
    height: 76,
    beginner: true,
    styles: { background: "#ffffff", color: "#0f172a", radius: 0 },
    compose: (self) => [
      makeNode("text", { x: 24, y: 24, width: 180, height: 30 }, { parentId: self.id, name: "Marca", props: { text: "ASTERYON" }, styles: { fontSize: 20, fontWeight: 800, color: "#0f172a" } }),
      makeNode("search", { x: 260, y: 15, width: 330, height: 46 }, { parentId: self.id, name: "Busca" }),
      makeNode("menu", { x: 620, y: 14, width: 310, height: 48 }, { parentId: self.id, name: "Menu" }),
    ],
  },
  {
    type: "footer",
    label: "Rodapé",
    category: "Navegação",
    width: 960,
    height: 120,
    styles: { background: "#0f172a", color: "#ffffff" },
    compose: (self) => [
      makeNode("text", { x: 24, y: 44, width: 460, height: 26 }, { parentId: self.id, name: "Texto do Rodapé", props: { text: "ASTERYON · Catálogo Digital" }, styles: { fontSize: 14, fontWeight: 600, color: "#ffffff" } }),
    ],
  },

  // Marketing
  {
    type: "banner", label: "Banner", category: "Marketing", width: 900, height: 180,
    props: { src: "", title: "Campanha em destaque", fit: "contain", href: "" },
    styles: { background: "#111827", color: "#ffffff", radius: 14 },
  },
  {
    type: "hero", label: "Hero", category: "Marketing", width: 960, height: 420,
    props: { src: "", title: "Uma vitrine criada do seu jeito", subtitle: "Personalize e publique quando estiver pronto.", fit: "contain" },
    styles: { background: "#065f46", color: "#ffffff", radius: 18 },
  },
  {
    type: "carousel", label: "Carrossel", category: "Marketing", width: 760, height: 260,
    props: { images: [], autoplay: true, loop: true, interval: 5000, fit: "contain" },
    styles: { background: "#f1f5f9", radius: 14 },
  },
  {
    type: "promotion", label: "Promoção", category: "Marketing", width: 320, height: 140,
    props: { title: "Promoção", label: "Ver promoção", href: "#promocoes" },
    styles: { background: "#fef3c7", color: "#92400e", radius: 14 },
  },

  // Catálogo
  {
    type: "product",
    label: "Produto",
    category: "Catálogo",
    width: 240,
    height: 340,
    styles: { radius: 14, background: "#ffffff", border: 1 },
    compose: productAtoms,
  },
  { type: "productImage", label: "Imagem do Produto", category: "Catálogo", width: 200, height: 160, props: { src: "", fit: "contain" } },
  {
    type: "productName",
    label: "Nome do Produto",
    category: "Catálogo",
    width: 200,
    height: 40,
    props: { text: "Cadeira Ergonômica Pro" },
    styles: { fontSize: 15, fontWeight: 600 },
  },
  {
    type: "productBrand",
    label: "Marca",
    category: "Catálogo",
    width: 200,
    height: 16,
    props: { text: "ASTERYON" },
    styles: { fontSize: 11, fontWeight: 600, color: "var(--ed-muted)" },
  },
  {
    type: "productPrice",
    label: "Preço",
    category: "Catálogo",
    width: 200,
    height: 26,
    props: { text: "R$ 1.290,00" },
    styles: { fontSize: 20, fontWeight: 700 },
  },
  {
    type: "productButton",
    label: "Botão do Produto",
    category: "Catálogo",
    width: 200,
    height: 38,
    props: { label: "Adicionar" },
    styles: { radius: 8, background: "#111827", color: "#ffffff", fontSize: 13, fontWeight: 600 },
  },
  { type: "category", label: "Categoria", category: "Catálogo", width: 220, height: 120 },
  { type: "brand", label: "Marca (bloco)", category: "Catálogo", width: 180, height: 90 },
  { type: "distribution", label: "Distribuição", category: "Catálogo", width: 300, height: 120 },
  {
    type: "showcase",
    label: "Vitrine",
    category: "Catálogo",
    width: 800,
    height: 400,
    styles: { radius: 16, background: "#f7f8fa" },
    compose: (self) => {
      const title = makeNode(
        "heading",
        { x: 24, y: 20, width: 340, height: 34 },
        { parentId: self.id, name: "Título da Vitrine", props: { text: "Mais vendidos" }, styles: { fontSize: 24, fontWeight: 700 } },
      );
      const cards = [0, 1, 2].map((i) =>
        makeNode(
          "product",
          { x: 24 + i * 256, y: 72, width: 240, height: 300 },
          { parentId: self.id, name: `Produto ${i + 1}` },
        ),
      );
      return [title, ...cards];
    },
  },
  {
    type: "smartShowcase",
    label: "Vitrine Inteligente",
    category: "Catálogo",
    width: 800,
    height: 400,
    styles: { radius: 16, background: "#f2f6ff" },
    compose: (self) => {
      const title = makeNode(
        "heading",
        { x: 24, y: 20, width: 420, height: 34 },
        { parentId: self.id, name: "Título", props: { text: "Recomendados para você" }, styles: { fontSize: 24, fontWeight: 700 } },
      );
      const cards = [0, 1, 2].map((i) =>
        makeNode(
          "product",
          { x: 24 + i * 256, y: 72, width: 240, height: 300 },
          { parentId: self.id, name: `Produto ${i + 1}` },
        ),
      );
      return [title, ...cards];
    },
  },

  // Avançado
  { type: "html", label: "HTML", category: "Avançado", width: 320, height: 140 },
  { type: "embed", label: "Embed", category: "Avançado", width: 400, height: 240 },
];

export const ELEMENT_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.type, e])) as Record<
  NodeType,
  ElementDef
>;

/** Types that accept children dropped inside them. */
export const CONTAINER_TYPES: NodeType[] = [
  "page",
  "frame",
  "container",
  "row",
  "column",
  "section",
  "group",
  "showcase",
  "smartShowcase",
  "product",
  "hero",
  "banner",
  "carousel",
];

export const isContainer = (type: NodeType) => CONTAINER_TYPES.includes(type);

/** Builds a node plus all of its atomic descendants, ready to be inserted. */
export function buildNodeTree(type: NodeType, frame: Frame): EditorNode[] {
  const def = ELEMENT_MAP[type];
  const root = makeNode(type, frame);
  const out: EditorNode[] = [root];
  const children = def?.compose?.(root) ?? [];
  for (const child of children) {
    root.children.push(child.id);
    const sub = def?.compose ? [] : [];
    out.push(child, ...sub);
    const childDef = ELEMENT_MAP[child.type];
    const grand = childDef?.compose?.(child) ?? [];
    for (const g of grand) {
      child.children.push(g.id);
      out.push(g);
    }
  }
  return out;
}
