import { useEffect, useRef, useState } from "react";
import { Loader2, Search, Send, Sparkles, X } from "lucide-react";
import { useAi, hydrateAiConfig, type VariantKey } from "../ai/aiStore";
import { TEMPLATE_HINTS } from "../ai/prompts";
import { useEditor } from "../store";
import { PROVIDER_LABEL, type ProviderId } from "@/lib/ai-types";
import { PlanPreview } from "./PlanPreview";

const TABS = [
  ["chat", "Chat"],
  ["builder", "Website Builder"],
  ["layouts", "Layouts"],
  ["content", "Conteúdo"],
  ["design", "Design"],
  ["diag", "Diagnóstico"],
  ["settings", "Configurações"],
] as const;

const field =
  "w-full rounded-md border border-ed-border bg-ed-surface px-2 py-1.5 text-[12px] text-ed-ink outline-none focus:border-ed-accent";
const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-ed-border px-2.5 py-1.5 text-[11px] font-semibold text-ed-muted transition-colors hover:border-ed-accent hover:text-ed-ink disabled:opacity-40";
const primary =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-ed-accent px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40";
const label = "mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ed-muted";

const STATUS_UI: Record<string, string> = {
  connected: "✅ Conectado",
  failed: "❌ Falha",
  model_not_found: "⚠ Modelo não encontrado",
  unavailable: "⚠ API indisponível",
  timeout: "⚠ Timeout",
};

export function AiPanel() {
  const ai = useAi();
  useEffect(() => hydrateAiConfig(), []);
  if (!ai.open) return null;

  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-ed-border bg-ed-panel">
      <header className="flex items-center gap-2 border-b border-ed-border px-3 py-2">
        <Sparkles size={14} className="text-ed-accent" />
        <span className="text-xs font-bold tracking-wide text-ed-ink">ASTERYON AI</span>
        <span className="ml-auto text-[10px] text-ed-muted">
          {PROVIDER_LABEL[ai.config.provider]} · {ai.config.model}
        </span>
        <button className={btn} onClick={() => ai.setOpen(false)} title="Fechar">
          <X size={12} />
        </button>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-ed-border px-2 py-1.5">
        {TABS.map(([id, name]) => (
          <button
            key={id}
            onClick={() => ai.setTab(id)}
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              ai.tab === id ? "bg-ed-accent text-white" : "text-ed-muted hover:text-ed-ink"
            }`}
          >
            {name}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {ai.tab === "chat" && <ChatTab />}
        {ai.tab === "builder" && <BuilderTab />}
        {ai.tab === "layouts" && <LayoutsTab />}
        {ai.tab === "content" && <ContentTab />}
        {ai.tab === "design" && <DesignTab />}
        {ai.tab === "diag" && <DiagTab />}
        {ai.tab === "settings" && <SettingsTab />}
      </div>
    </aside>
  );
}

function ChatTab() {
  const { chat, chatBusy, sendChat } = useAi();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [chat.length, chatBusy]);

  const submit = () => {
    const t = text.trim();
    if (!t || chatBusy) return;
    setText("");
    void sendChat(t);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex-1 space-y-2">
        {chat.length === 0 && (
          <p className="text-[12px] text-ed-muted">
            Converse com a IA sobre o layout atual: peça ideias de seções, copy, paleta ou análise de UX.
          </p>
        )}
        {chat.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-lg px-2.5 py-2 text-[12px] ${
              m.role === "user"
                ? "ml-6 bg-ed-accent/20 text-ed-ink"
                : "mr-2 border border-ed-border bg-ed-surface text-ed-ink"
            }`}
          >
            {m.content}
          </div>
        ))}
        {chatBusy && (
          <div className="flex items-center gap-2 text-[11px] text-ed-muted">
            <Loader2 size={12} className="animate-spin" /> gerando…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-1">
        <input
          className={field}
          value={text}
          placeholder="Pergunte ou peça algo…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className={primary} onClick={submit} disabled={chatBusy}>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

function VariantsBlock() {
  const { variants, activeVariant, setActiveVariant, applyVariant, clearVariants } = useAi();
  if (!variants.length) return null;
  const active = variants.find((v) => v.key === activeVariant) ?? variants[0]!;
  return (
    <div className="mt-3 space-y-2 border-t border-ed-border pt-3">
      <div className="flex items-center gap-1">
        {variants.map((v) => (
          <button
            key={v.key}
            onClick={() => setActiveVariant(v.key as VariantKey)}
            className={`rounded px-2 py-1 text-[11px] font-semibold ${
              active.key === v.key ? "bg-ed-accent text-white" : "border border-ed-border text-ed-muted"
            }`}
          >
            Versão {v.key}
          </button>
        ))}
        <button className={`${btn} ml-auto`} onClick={clearVariants}>
          Descartar
        </button>
      </div>
      <p className="text-[11px] text-ed-muted">
        <strong className="text-ed-ink">{active.plan.name}</strong> · {active.nodes.length} nós ·{" "}
        {active.tokens} tokens · {active.latencyMs}ms
      </p>
      {active.plan.rationale && <p className="text-[11px] text-ed-muted">{active.plan.rationale}</p>}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ed-muted">Preview</p>
      <div className="max-h-[380px] overflow-y-auto">
        <PlanPreview
          nodes={active.nodes}
          rootIds={active.rootIds}
          pageHeight={active.pageHeight}
          background={active.plan.page?.background ?? "#ffffff"}
          width={380}
        />
      </div>
      <div className="flex gap-1">
        <button className={primary} onClick={() => applyVariant(active.key as VariantKey, "replace")}>
          Aplicar no rascunho (substituir)
        </button>
        <button className={btn} onClick={() => applyVariant(active.key as VariantKey, "append")}>
          Adicionar
        </button>
      </div>
      <p className="text-[10px] text-ed-muted">
        Aplicar altera apenas o rascunho local e pode ser desfeito com Ctrl+Z. Nada é publicado.
      </p>
    </div>
  );
}

function BuilderForm({
  placeholder,
  presets,
  useCanvasDefault,
}: {
  placeholder: string;
  presets: string[];
  useCanvasDefault?: boolean;
}) {
  const { build, buildBusy, buildStatus, lastError } = useAi();
  const [prompt, setPrompt] = useState("");
  const [versions, setVersions] = useState(3);
  const [research, setResearch] = useState(false);
  const [useCanvas, setUseCanvas] = useState(!!useCanvasDefault);

  const run = (p?: string) => {
    const text = (p ?? prompt).trim();
    if (!text || buildBusy) return;
    setPrompt(text);
    void build(text, { versions, research, useCanvas });
  };

  return (
    <div className="space-y-2">
      <textarea
        className={`${field} h-24 resize-none`}
        value={prompt}
        placeholder={placeholder}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ed-muted">
        <label className="flex items-center gap-1">
          Versões
          <select
            className="rounded border border-ed-border bg-ed-surface px-1 py-0.5"
            value={versions}
            onChange={(e) => setVersions(Number(e.target.value))}
          >
            {[1, 2, 3].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} />
          Pesquisa online
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={useCanvas} onChange={(e) => setUseCanvas(e.target.checked)} />
          Analisar canvas
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button key={p} className={btn} onClick={() => run(p)} disabled={buildBusy}>
            {p}
          </button>
        ))}
      </div>
      <button className={primary} onClick={() => run()} disabled={buildBusy}>
        {buildBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        Gerar layout
      </button>
      {buildStatus && <p className="text-[11px] text-ed-muted">{buildStatus}</p>}
      {lastError && <p className="text-[11px] text-red-400">{lastError}</p>}
      <VariantsBlock />
    </div>
  );
}

function BuilderTab() {
  return (
    <BuilderForm
      placeholder="Ex.: Crie uma homepage moderna para uma distribuidora de alimentos"
      presets={[
        "Crie uma homepage para uma distribuidora de alimentos",
        "Crie uma landing page para Black Friday",
        "Monte uma home premium para cafeteria",
        "Crie uma página moderna para farmácia",
      ]}
    />
  );
}

function LayoutsTab() {
  const { build, buildBusy } = useAi();
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-ed-muted">
        Templates inteligentes: a IA gera a estrutura completa com as diretrizes do segmento.
      </p>
      <div className="grid grid-cols-2 gap-1">
        {Object.keys(TEMPLATE_HINTS).map((k) => (
          <button
            key={k}
            className={btn}
            disabled={buildBusy}
            onClick={() =>
              void build(`Crie uma página completa e profissional para: ${k}`, {
                versions: 3,
                research: false,
                useCanvas: false,
              })
            }
          >
            <span className="capitalize">{k}</span>
          </button>
        ))}
      </div>
      <VariantsBlock />
    </div>
  );
}

function ContentTab() {
  const { config, chatBusy } = useAi();
  const selection = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.doc);
  const updateProps = useEditor((s) => s.updateProps);
  const commit = useEditor((s) => s.commit);
  const [brief, setBrief] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const node = selection[0] ? doc.nodes[selection[0]] : undefined;

  const run = async () => {
    if (!node || busy) return;
    setBusy(true);
    setOut("");
    const { aiChat } = await import("@/lib/ai.functions");
    const res = await aiChat({
      data: {
        config,
        json: false,
        messages: [
          {
            role: "system",
            content:
              "Você é copywriter sênior de catálogos digitais. Responda APENAS com o texto final em português do Brasil, sem aspas, sem explicações, adequado ao espaço do elemento.",
          },
          {
            role: "user",
            content: `Elemento: ${node.type} (${node.name}), largura ${Math.round(node.width)}px. Texto atual: "${String(
              node.props["text"] ?? node.props["label"] ?? "",
            )}". Briefing: ${brief || "melhore o texto mantendo o propósito"}.`,
          },
        ],
      },
    });
    setBusy(false);
    setOut(res.ok ? res.content.trim() : `❌ ${res.error}`);
  };

  const apply = () => {
    if (!node || !out || out.startsWith("❌")) return;
    commit();
    updateProps(node.id, node.type === "button" || node.type === "productButton" ? { label: out } : { text: out });
  };

  return (
    <div className="space-y-2">
      {!node ? (
        <p className="text-[12px] text-ed-muted">Selecione um elemento no canvas para gerar conteúdo.</p>
      ) : (
        <>
          <p className="text-[11px] text-ed-muted">
            Selecionado: <strong className="text-ed-ink">{node.name}</strong> ({node.type})
          </p>
          <textarea
            className={`${field} h-20 resize-none`}
            placeholder="Briefing do texto (tom, objetivo, público)…"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <button className={primary} onClick={() => void run()} disabled={busy || chatBusy}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Gerar texto
          </button>
          {out && (
            <>
              <div className="rounded-md border border-ed-border bg-ed-surface p-2 text-[12px] text-ed-ink">
                {out}
              </div>
              <button className={btn} onClick={apply}>
                Aplicar no elemento
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DesignTab() {
  const { runSearch, research, searchBusy } = useAi();
  const [q, setQ] = useState("");
  return (
    <div className="space-y-3">
      <BuilderForm
        useCanvasDefault
        placeholder="Ex.: Melhore esta página e torne mais premium"
        presets={[
          "Melhore esta página",
          "Torne mais moderna",
          "Torne mais premium",
          "Torne mais minimalista",
          "Torne mais corporativa",
          "Torne mais responsiva",
        ]}
      />
      <div className="border-t border-ed-border pt-3">
        <span className={label}>Pesquisa de referências</span>
        <div className="flex gap-1">
          <input
            className={field}
            value={q}
            placeholder="tendências de UI para supermercado 2026"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && q.trim() && void runSearch(q.trim())}
          />
          <button className={btn} onClick={() => q.trim() && void runSearch(q.trim())} disabled={searchBusy}>
            {searchBusy ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          </button>
        </div>
        <ul className="mt-2 space-y-1">
          {research.map((r) => (
            <li key={r.url} className="text-[11px]">
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-ed-accent"
              >
                {r.title}
              </a>
              <p className="text-ed-muted">{r.snippet}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DiagTab() {
  const { config, test, lastTestAt, lastError, totalTokens, logs, testing, testConnection } = useAi();
  const rows: [string, string][] = [
    ["Provider", PROVIDER_LABEL[config.provider]],
    ["Modelo", config.model],
    ["Status", test ? (STATUS_UI[test.status] ?? test.status) : "sem teste"],
    ["URL", config.baseUrl],
    ["Tempo resposta", test ? `${test.latencyMs} ms` : "—"],
    ["Último teste", lastTestAt ? new Date(lastTestAt).toLocaleString("pt-BR") : "—"],
    ["Último erro", lastError ?? "—"],
    ["Tokens (sessão)", String(totalTokens)],
  ];
  return (
    <div className="space-y-2">
      <button className={primary} onClick={() => void testConnection()} disabled={testing}>
        {testing ? <Loader2 size={12} className="animate-spin" /> : null} Testar conexão
      </button>
      <dl className="divide-y divide-ed-border rounded-md border border-ed-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2 px-2 py-1.5 text-[11px]">
            <dt className="w-28 shrink-0 text-ed-muted">{k}</dt>
            <dd className="min-w-0 break-words text-ed-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <span className={label}>Logs</span>
      <ul className="space-y-1">
        {logs.map((l, i) => (
          <li key={i} className="rounded border border-ed-border bg-ed-surface px-2 py-1 text-[10px] text-ed-muted">
            <span className="text-ed-ink">{new Date(l.at).toLocaleTimeString("pt-BR")}</span> [{l.kind}]{" "}
            {l.message}
            {l.latencyMs ? ` · ${l.latencyMs}ms` : ""}
            {l.tokens ? ` · ${l.tokens} tokens` : ""}
          </li>
        ))}
        {!logs.length && <li className="text-[11px] text-ed-muted">Sem eventos ainda.</li>}
      </ul>
    </div>
  );
}

function SettingsTab() {
  const { config, setConfig, saveConfig, dirty, testConnection, testing, test } = useAi();
  return (
    <div className="space-y-3">
      <div>
        <span className={label}>Provider</span>
        <select
          className={field}
          value={config.provider}
          onChange={(e) => setConfig({ provider: e.target.value as ProviderId })}
        >
          {(Object.keys(PROVIDER_LABEL) as ProviderId[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <span className={label}>Modelo</span>
        <input className={field} value={config.model} onChange={(e) => setConfig({ model: e.target.value })} />
        {test?.models?.length ? (
          <select
            className={`${field} mt-1`}
            value=""
            onChange={(e) => e.target.value && setConfig({ model: e.target.value })}
          >
            <option value="">Modelos disponíveis ({test.models.length})…</option>
            {test.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div>
        <span className={label}>API Key</span>
        <input
          className={field}
          type="password"
          autoComplete="off"
          placeholder={config.provider === "ollama" ? "não necessária" : "sk-…"}
          value={config.apiKey}
          onChange={(e) => setConfig({ apiKey: e.target.value })}
        />
      </div>
      <div>
        <span className={label}>URL Base</span>
        <input className={field} value={config.baseUrl} onChange={(e) => setConfig({ baseUrl: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={label}>Temperature</span>
          <input
            className={field}
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={config.temperature}
            onChange={(e) => setConfig({ temperature: Number(e.target.value) })}
          />
        </div>
        <div>
          <span className={label}>Max Tokens</span>
          <input
            className={field}
            type="number"
            min="64"
            max="32000"
            value={config.maxTokens}
            onChange={(e) => setConfig({ maxTokens: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button className={primary} onClick={saveConfig}>
          Salvar{dirty ? " *" : ""}
        </button>
        <button className={btn} onClick={() => void testConnection()} disabled={testing}>
          {testing ? <Loader2 size={12} className="animate-spin" /> : null} Testar conexão
        </button>
      </div>
      {test && (
        <div
          className={`rounded-md border px-2 py-1.5 text-[11px] ${
            test.status === "connected"
              ? "border-emerald-500/50 text-emerald-400"
              : "border-amber-500/50 text-amber-400"
          }`}
        >
          {STATUS_UI[test.status] ?? test.status} — {test.message}
          <div className="text-ed-muted">
            {test.url} · {test.latencyMs}ms{test.sample ? ` · resposta: "${test.sample}"` : ""}
          </div>
        </div>
      )}
      <p className="text-[10px] text-ed-muted">
        A chave fica apenas neste navegador e é usada somente para chamar o provedor escolhido.
      </p>
    </div>
  );
}
