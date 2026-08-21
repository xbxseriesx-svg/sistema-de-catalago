/**
 * Real AI providers. Server-only: every call performs a real HTTP request.
 * No mocks, no simulated answers.
 */
import {
  DEFAULT_BASE_URL,
  type AiChatResult,
  type AiConfig,
  type AiMessage,
  type AiTestResult,
  type AiUsage,
} from "./ai-types";

const TIMEOUT_MS = 120_000;

const emptyUsage = (): AiUsage => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

export class AiTimeoutError extends Error {}

async function request(url: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw new AiTimeoutError("timeout");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const trim = (u: string) => u.replace(/\/+$/, "");

/** Base contract every provider implements. */
export abstract class AiProvider {
  constructor(protected cfg: AiConfig) {}
  abstract readonly id: string;
  abstract get baseUrl(): string;
  /** Real list of models exposed by the endpoint. */
  abstract listModels(): Promise<string[]>;
  abstract chat(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiChatResult>;

  async test(): Promise<AiTestResult> {
    const started = Date.now();
    const url = this.baseUrl;
    try {
      const models = await this.listModels();
      if (models.length && !models.includes(this.cfg.model)) {
        return {
          status: "model_not_found",
          message: `Modelo "${this.cfg.model}" não encontrado no endpoint (${models.length} modelos disponíveis).`,
          latencyMs: Date.now() - started,
          url,
          model: this.cfg.model,
          models,
        };
      }
      const probe = await this.chat([
        { role: "user", content: "Responda apenas com a palavra: OK" },
      ]);
      if (!probe.ok) {
        return {
          status: /not found|does not exist|unknown model/i.test(probe.error ?? "")
            ? "model_not_found"
            : "failed",
          message: probe.error ?? "Falha na requisição.",
          latencyMs: Date.now() - started,
          url,
          model: this.cfg.model,
          models,
        };
      }
      return {
        status: "connected",
        message: "Conexão validada com resposta real do modelo.",
        latencyMs: Date.now() - started,
        url,
        model: this.cfg.model,
        models,
        sample: probe.content.slice(0, 120),
      };
    } catch (err) {
      const isTimeout = err instanceof AiTimeoutError;
      return {
        status: isTimeout ? "timeout" : "unavailable",
        message: isTimeout ? "Timeout ao contatar a API." : `API indisponível: ${(err as Error).message}`,
        latencyMs: Date.now() - started,
        url,
        model: this.cfg.model,
      };
    }
  }
}

/** OpenAI-compatible chat completions (used by OpenAI and OpenRouter). */
abstract class OpenAiCompatible extends AiProvider {
  protected abstract headers(): Record<string, string>;

  get baseUrl() {
    return trim(this.cfg.baseUrl || DEFAULT_BASE_URL[this.cfg.provider]);
  }

  async listModels(): Promise<string[]> {
    const res = await request(`${this.baseUrl}/models`, {
      headers: this.headers(),
      timeoutMs: 20_000,
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error("API Key inválida (401/403).");
      return [];
    }
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    return (json.data ?? []).map((m) => String(m.id)).filter(Boolean);
  }

  async chat(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiChatResult> {
    const started = Date.now();
    const res = await request(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.headers() },
      body: JSON.stringify({
        model: this.cfg.model,
        messages,
        temperature: this.cfg.temperature,
        max_tokens: this.cfg.maxTokens,
        ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 400);
      try {
        const j = JSON.parse(text) as { error?: { message?: string } };
        if (j.error?.message) msg = j.error.message;
      } catch {
        /* raw text */
      }
      return {
        ok: false,
        content: "",
        usage: emptyUsage(),
        latencyMs: Date.now() - started,
        model: this.cfg.model,
        error: `HTTP ${res.status}: ${msg}`,
      };
    }
    const json = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };
    return {
      ok: true,
      content: json.choices?.[0]?.message?.content ?? "",
      usage: {
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
        totalTokens: json.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - started,
      model: json.model ?? this.cfg.model,
    };
  }
}

export class OpenAIProvider extends OpenAiCompatible {
  readonly id = "openai";
  protected headers() {
    if (!this.cfg.apiKey) throw new Error("API Key da OpenAI não informada.");
    return { authorization: `Bearer ${this.cfg.apiKey}` };
  }
}

export class OpenRouterProvider extends OpenAiCompatible {
  readonly id = "openrouter";
  protected headers() {
    if (!this.cfg.apiKey) throw new Error("API Key do OpenRouter não informada.");
    return {
      authorization: `Bearer ${this.cfg.apiKey}`,
      "http-referer": "https://asteryon.lovable.app",
      "x-title": "ASTERYON AI Website Builder",
    };
  }
}

export class OllamaProvider extends AiProvider {
  readonly id = "ollama";

  get baseUrl() {
    return trim(this.cfg.baseUrl || DEFAULT_BASE_URL.ollama);
  }

  async listModels(): Promise<string[]> {
    const res = await request(`${this.baseUrl}/api/tags`, { timeoutMs: 15_000 });
    if (!res.ok) throw new Error(`HTTP ${res.status} em /api/tags`);
    const json = (await res.json()) as { models?: Array<{ name?: string }> };
    const names = (json.models ?? []).map((m) => String(m.name)).filter(Boolean);
    // Ollama reports "llama3.1:latest"; accept the bare name too.
    return [...new Set(names.flatMap((n) => [n, n.split(":")[0]!]))];
  }

  async chat(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiChatResult> {
    const started = Date.now();
    const res = await request(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.cfg.model,
        messages,
        stream: false,
        ...(opts?.json ? { format: "json" } : {}),
        options: { temperature: this.cfg.temperature, num_predict: this.cfg.maxTokens },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        content: "",
        usage: emptyUsage(),
        latencyMs: Date.now() - started,
        model: this.cfg.model,
        error: `HTTP ${res.status}: ${text.slice(0, 400)}`,
      };
    }
    const json = JSON.parse(text) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
      model?: string;
    };
    const p = json.prompt_eval_count ?? 0;
    const c = json.eval_count ?? 0;
    return {
      ok: true,
      content: json.message?.content ?? "",
      usage: { promptTokens: p, completionTokens: c, totalTokens: p + c },
      latencyMs: Date.now() - started,
      model: json.model ?? this.cfg.model,
    };
  }
}

export function createProvider(cfg: AiConfig): AiProvider {
  switch (cfg.provider) {
    case "openai":
      return new OpenAIProvider(cfg);
    case "openrouter":
      return new OpenRouterProvider(cfg);
    case "ollama":
      return new OllamaProvider(cfg);
    default:
      throw new Error(`Provider desconhecido: ${String(cfg.provider)}`);
  }
}
