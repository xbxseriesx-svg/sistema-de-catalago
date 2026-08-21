import { create } from "zustand";
import { aiChat, aiTestConnection, aiWebSearch } from "@/lib/ai.functions";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  type AiConfig,
  type AiMessage,
  type AiTestResult,
  type SearchResult,
} from "@/lib/ai-types";
import { useEditor } from "../store";
import type { EditorNode } from "../types";
import { parsePlan, planToNodes, type LayoutPlan } from "./plan";
import { builderSystemPrompt, canvasSummary, templateHint, VARIANT_DIRECTIVES } from "./prompts";

const STORAGE_KEY = "asteryon.ai.config.v1";

export type VariantKey = "A" | "B" | "C";

export interface Variant {
  key: VariantKey;
  plan: LayoutPlan;
  nodes: EditorNode[];
  rootIds: string[];
  pageHeight: number;
  latencyMs: number;
  tokens: number;
}

export interface LogEntry {
  at: number;
  kind: string;
  message: string;
  latencyMs?: number;
  tokens?: number;
}

export interface ChatEntry {
  role: "user" | "assistant";
  content: string;
}

interface AiState {
  open: boolean;
  tab: string;
  config: AiConfig;
  dirty: boolean;
  testing: boolean;
  test: AiTestResult | null;
  lastTestAt: number | null;
  lastError: string | null;
  totalTokens: number;
  logs: LogEntry[];

  chat: ChatEntry[];
  chatBusy: boolean;

  buildBusy: boolean;
  buildStatus: string;
  variants: Variant[];
  activeVariant: VariantKey | null;
  research: SearchResult[];
  searchBusy: boolean;

  setOpen: (v: boolean) => void;
  setTab: (t: string) => void;
  setConfig: (patch: Partial<AiConfig>) => void;
  saveConfig: () => void;
  testConnection: () => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  runSearch: (query: string) => Promise<void>;
  build: (
    prompt: string,
    opts: { versions: number; research: boolean; useCanvas: boolean },
  ) => Promise<void>;
  setActiveVariant: (k: VariantKey) => void;
  applyVariant: (k: VariantKey, mode: "replace" | "append") => void;
  clearVariants: () => void;
}

const defaultConfig = (): AiConfig => ({
  provider: "openai",
  model: DEFAULT_MODEL.openai,
  apiKey: "",
  baseUrl: DEFAULT_BASE_URL.openai,
  temperature: 0.7,
  maxTokens: 6000,
});

function loadConfig(): AiConfig {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    return { ...defaultConfig(), ...(JSON.parse(raw) as Partial<AiConfig>) };
  } catch {
    return defaultConfig();
  }
}

export const useAi = create<AiState>((set, get) => ({
  open: false,
  tab: "builder",
  config: defaultConfig(),
  dirty: false,
  testing: false,
  test: null,
  lastTestAt: null,
  lastError: null,
  totalTokens: 0,
  logs: [],
  chat: [],
  chatBusy: false,
  buildBusy: false,
  buildStatus: "",
  variants: [],
  activeVariant: null,
  research: [],
  searchBusy: false,

  setOpen: (open) => set({ open }),
  setTab: (tab) => set({ tab }),

  setConfig: (patch) =>
    set((s) => {
      const next = { ...s.config, ...patch };
      if (patch.provider && patch.provider !== s.config.provider) {
        next.baseUrl = DEFAULT_BASE_URL[patch.provider];
        next.model = DEFAULT_MODEL[patch.provider];
      }
      return { config: next, dirty: true };
    }),

  saveConfig: () => {
    const cfg = get().config;
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    set((s) => ({
      dirty: false,
      logs: [
        { at: Date.now(), kind: "test", message: `Configuração salva (${cfg.provider} / ${cfg.model})` },
        ...s.logs,
      ].slice(0, 200),
    }));
  },

  testConnection: async () => {
    set({ testing: true });
    try {
      const res = await aiTestConnection({ data: { config: get().config } });
      set((s) => ({
        test: res,
        testing: false,
        lastTestAt: Date.now(),
        lastError: res.status === "connected" ? null : res.message,
        logs: [
          { at: Date.now(), kind: "test", message: `${res.status}: ${res.message}`, latencyMs: res.latencyMs },
          ...s.logs,
        ].slice(0, 200),
      }));
    } catch (err) {
      const message = (err as Error).message;
      set((s) => ({
        testing: false,
        lastTestAt: Date.now(),
        lastError: message,
        test: {
          status: "failed",
          message,
          latencyMs: 0,
          url: get().config.baseUrl,
          model: get().config.model,
        },
        logs: [{ at: Date.now(), kind: "error", message }, ...s.logs].slice(0, 200),
      }));
    }
  },

  sendChat: async (text) => {
    const { config, chat } = get();
    const history: AiMessage[] = [
      {
        role: "system",
        content:
          "Você é o ASTERYON AI, assistente do editor visual de catálogos digitais: designer, UX, marketing, copywriter. Responda em português do Brasil, direto e prático. Considere o layout atual do canvas quando relevante.\n\nCANVAS ATUAL:\n" +
          canvasSummary(useEditor.getState().doc, 80),
      },
      ...chat.map((c) => ({ role: c.role, content: c.content }) as AiMessage),
      { role: "user", content: text },
    ];
    set((s) => ({ chat: [...s.chat, { role: "user", content: text }], chatBusy: true }));
    const res = await aiChat({ data: { config, messages: history, json: false } });
    if (!res.ok) {
      set((s) => ({
        chatBusy: false,
        lastError: res.error ?? "Falha",
        chat: [...s.chat, { role: "assistant", content: `❌ ${res.error ?? "Falha na requisição."}` }],
        logs: [{ at: Date.now(), kind: "error", message: res.error ?? "Falha no chat" }, ...s.logs].slice(0, 200),
      }));
      return;
    }
    set((s) => ({
      chatBusy: false,
      chat: [...s.chat, { role: "assistant", content: res.content }],
      totalTokens: s.totalTokens + res.usage.totalTokens,
      logs: [
        { at: Date.now(), kind: "chat", message: "Resposta recebida", latencyMs: res.latencyMs, tokens: res.usage.totalTokens },
        ...s.logs,
      ].slice(0, 200),
    }));
  },

  runSearch: async (query) => {
    set({ searchBusy: true });
    const res = await aiWebSearch({ data: { query, limit: 6 } });
    set((s) => ({
      searchBusy: false,
      research: res.results,
      lastError: res.ok ? s.lastError : (res.error ?? null),
      logs: [
        {
          at: Date.now(),
          kind: res.ok ? "search" : "error",
          message: res.ok ? `Pesquisa "${query}": ${res.results.length} resultados` : `Pesquisa falhou: ${res.error}`,
        },
        ...s.logs,
      ].slice(0, 200),
    }));
  },

  build: async (prompt, opts) => {
    const { config } = get();
    set({ buildBusy: true, variants: [], activeVariant: null, buildStatus: "Preparando briefing…" });

    let researchBlock = "";
    if (opts.research) {
      set({ buildStatus: "Pesquisando referências e tendências…" });
      const res = await aiWebSearch({
        data: { query: `${prompt} tendências design UX layout 2026 boas práticas`, limit: 6 },
      });
      if (res.ok && res.results.length) {
        set({ research: res.results });
        researchBlock =
          "\n\nREFERÊNCIAS DE PESQUISA (use apenas como inspiração conceitual, jamais copie textos, marcas ou identidades):\n" +
          res.results.map((r) => `- ${r.title}: ${r.snippet}`).join("\n");
      }
      set((s) => ({
        logs: [
          { at: Date.now(), kind: "search", message: `Pesquisa online: ${res.results.length} referências` },
          ...s.logs,
        ].slice(0, 200),
      }));
    }

    const canvasBlock = opts.useCanvas
      ? "\n\nCANVAS ATUAL (interprete e melhore quando o pedido for de melhoria):\n" +
        canvasSummary(useEditor.getState().doc, 100)
      : "";
    const hint = templateHint(prompt);
    const keys: VariantKey[] = (["A", "B", "C"] as VariantKey[]).slice(0, Math.max(1, opts.versions));

    set({ buildStatus: `Gerando ${keys.length} versão(ões) com ${config.model}…` });

    const results = await Promise.all(
      keys.map(async (key) => {
        const messages: AiMessage[] = [
          { role: "system", content: builderSystemPrompt() },
          {
            role: "user",
            content:
              `PEDIDO DO USUÁRIO: ${prompt}\n\n${VARIANT_DIRECTIVES[key]}` +
              (hint ? `\n\nDIRETRIZES DE SEGMENTO:\n${hint}` : "") +
              canvasBlock +
              researchBlock +
              "\n\nGere agora o JSON do layout completo.",
          },
        ];
        const res = await aiChat({ data: { config, messages, json: true } });
        return { key, res };
      }),
    );

    const variants: Variant[] = [];
    let error: string | null = null;
    for (const { key, res } of results) {
      if (!res.ok) {
        error = res.error ?? "Falha na geração.";
        continue;
      }
      try {
        const plan = parsePlan(res.content);
        const { nodes, rootIds, pageHeight } = planToNodes(plan, "__page__");
        variants.push({
          key,
          plan,
          nodes,
          rootIds,
          pageHeight,
          latencyMs: res.latencyMs,
          tokens: res.usage.totalTokens,
        });
      } catch (err) {
        error = `Versão ${key}: ${(err as Error).message}`;
      }
    }

    set((s) => ({
      buildBusy: false,
      buildStatus: variants.length ? `${variants.length} versão(ões) prontas para preview.` : "Nenhuma versão gerada.",
      variants,
      activeVariant: variants[0]?.key ?? null,
      lastError: error,
      totalTokens: s.totalTokens + variants.reduce((a, v) => a + v.tokens, 0),
      logs: [
        {
          at: Date.now(),
          kind: variants.length ? "build" : "error",
          message: variants.length
            ? `Layout gerado: ${variants.map((v) => v.key).join(", ")} (${variants.reduce((a, v) => a + v.nodes.length, 0)} nós)`
            : `Falha ao gerar: ${error ?? "desconhecida"}`,
          latencyMs: Math.max(0, ...variants.map((v) => v.latencyMs)),
          tokens: variants.reduce((a, v) => a + v.tokens, 0),
        },
        ...s.logs,
      ].slice(0, 200),
    }));
  },

  setActiveVariant: (k) => set({ activeVariant: k }),

  applyVariant: (k, mode) => {
    const v = get().variants.find((x) => x.key === k);
    if (!v) return;
    useEditor
      .getState()
      .insertNodes(v.nodes, v.rootIds, { replace: mode === "replace", pageHeight: v.pageHeight });
    set((s) => ({
      logs: [
        { at: Date.now(), kind: "build", message: `Versão ${k} aplicada ao rascunho (${mode})` },
        ...s.logs,
      ].slice(0, 200),
    }));
  },

  clearVariants: () => set({ variants: [], activeVariant: null, buildStatus: "" }),
}));

/** Hydrates persisted config on the client only. */
export function hydrateAiConfig() {
  if (typeof window === "undefined") return;
  useAi.setState({ config: loadConfig(), dirty: false });
}
