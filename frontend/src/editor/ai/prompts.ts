import type { EditorDocument } from "../types";
import { DEVICE_WIDTH } from "../types";
import { ALLOWED_TYPES } from "./plan";

export const TEMPLATE_HINTS: Record<string, string> = {
  supermercado:
    "Supermercado: destaque ofertas da semana, categorias de mercearia/hortifruti/bebidas, selos de preço, cores vibrantes (vermelho/amarelo) com base clara.",
  distribuidora:
    "Distribuidora/Atacado: foco B2B, tabela de condições comerciais, pedido mínimo, categorias por linha, marcas parceiras, tom corporativo azul/cinza.",
  atacado: "Atacado: preço por caixa, volume, logística e cobertura de entrega.",
  varejo: "Varejo: vitrines de destaque, promoções, prova social e CTA de compra forte.",
  cafeteria:
    "Cafeteria: clima acolhedor, tons terrosos (marrom/creme), fotografia grande, cardápio em destaque.",
  farmacia:
    "Farmácia: confiança e clareza, verde/branco, busca proeminente, categorias de saúde, entrega rápida.",
  padaria: "Padaria: artesanal, tons dourados, produtos frescos do dia, horários.",
  moda: "Moda: editorial, muito espaço em branco, imagens grandes, tipografia elegante.",
  construcao: "Construção: robusto, laranja/cinza escuro, categorias técnicas, orçamento rápido.",
  industria: "Indústria: institucional técnico, azul profundo, capacidades e certificações.",
  institucional: "Institucional: história, valores, unidades, contato e credibilidade.",
  landing: "Landing page: 1 objetivo, headline forte, benefícios, prova social, CTA repetido.",
  "black friday":
    "Black Friday: fundo preto, acentos neon/amarelo, contagem de ofertas, urgência e descontos %.",
  natal: "Natal: vermelho/verde/dourado, clima festivo, kits e presentes.",
  "dia das maes": "Dia das Mães: rosa/nude, presentes, mensagem afetiva.",
  "dia dos pais": "Dia dos Pais: azul escuro, presentes masculinos, tom direto.",
  "ano novo": "Ano Novo: dourado/preto, renovação, kits de comemoração.",
};

export function templateHint(prompt: string): string {
  const p = prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hits = Object.entries(TEMPLATE_HINTS)
    .filter(([k]) => p.includes(k))
    .map(([, v]) => v);
  return hits.join("\n");
}

export function builderSystemPrompt(): string {
  return `Você é o ASTERYON AI: designer, UX designer, arquiteto de layout, especialista em marketing e catálogos digitais, e copywriter sênior.
Você constrói páginas completas no editor visual ASTERYON gerando um PLANO JSON de nós posicionados em coordenadas absolutas.

RESPONDA SOMENTE COM JSON VÁLIDO, sem markdown, sem comentários, neste formato:
{
  "name": "string curto",
  "rationale": "1-2 frases sobre as decisões de design",
  "page": { "width": ${DEVICE_WIDTH.desktop}, "height": number, "background": "#hex" },
  "nodes": [ Node, ... ]
}
Node = {
  "type": "<um dos tipos permitidos>",
  "name": "nome legível",
  "x": number, "y": number, "width": number, "height": number,
  "text": "conteúdo textual (para heading/text/paragraph/productName/productPrice/productBrand)",
  "label": "rótulo (para button/productButton)",
  "styles": { "background": "#hex", "color": "#hex", "fontSize": number, "fontWeight": number, "radius": number, "textAlign": "left|center|right", "lineHeight": number, "shadow": "css box-shadow", "borderWidth": number, "borderColor": "#hex", "clip": true },
  "children": [ Node, ... ]
}

TIPOS PERMITIDOS: ${ALLOWED_TYPES.join(", ")}.

REGRAS OBRIGATÓRIAS:
- x/y dos filhos são RELATIVOS ao pai. Nós de primeiro nível são relativos à página (x começa em 0).
- Largura da página: ${DEVICE_WIDTH.desktop}px. Use margens laterais consistentes (ex.: 64px) e grid de 8px.
- Seções empilhadas verticalmente sem sobreposição: o próximo y = y anterior + altura anterior.
- Toda página completa deve conter, no mínimo: cabeçalho (container com logo/heading, menu, search), banner/hero com título, subtítulo e botão, faixa de categorias, vitrine (showcase) de destaques, bloco de promoções, faixa de marcas, banner secundário e rodapé (container com colunas de texto).
- Textos SEMPRE em português do Brasil, originais, específicos do segmento, com copy de marketing real (nada de "Lorem ipsum" ou "Texto exemplo").
- Defina uma paleta coerente (máx. 4 cores) e hierarquia tipográfica clara (h1 40-64px, h2 28-36px, corpo 15-18px).
- Nunca copie marcas, logotipos, textos ou identidade visual de terceiros. Produza conteúdo original.
- Use "showcase" para vitrines de produtos (ele já cria cards de produto atômicos) e "product" para cards isolados.
- Não use imagens externas (deixe "src" vazio): o editor exibe placeholders de imagem.`;
}

export function canvasSummary(doc: EditorDocument, maxNodes = 120): string {
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const n = doc.nodes[id];
    if (!n || lines.length >= maxNodes) return;
    const text = String(n.props["text"] ?? n.props["label"] ?? "").slice(0, 60);
    lines.push(
      `${"  ".repeat(depth)}- ${n.type} "${n.name}" @(${Math.round(n.x)},${Math.round(n.y)}) ${Math.round(
        n.width,
      )}x${Math.round(n.height)}${text ? ` texto:"${text}"` : ""}${
        n.styles["background"] ? ` bg:${String(n.styles["background"])}` : ""
      }`,
    );
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(doc.rootId, 0);
  return lines.join("\n") || "(canvas vazio)";
}

export const VARIANT_DIRECTIVES: Record<"A" | "B" | "C", string> = {
  A: "Versão A — Clássica e conversiva: estrutura previsível, blocos densos, CTA forte, ideal para conversão imediata.",
  B: "Versão B — Premium e minimalista: muito respiro, tipografia grande, poucos elementos, sofisticação.",
  C: "Versão C — Ousada e editorial: composição assimétrica, blocos coloridos, contraste alto, storytelling visual.",
};
