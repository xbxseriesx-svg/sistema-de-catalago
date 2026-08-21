import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AiChatResult, AiConfig, AiTestResult, SearchResult } from "./ai-types";

const configSchema = z.object({
  provider: z.enum(["openai", "openrouter", "ollama"]),
  model: z.string().min(1),
  apiKey: z.string().default(""),
  baseUrl: z.string().default(""),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(64).max(32000).default(4000),
});

const messagesSchema = z.array(
  z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  }),
);

export const aiTestConnection = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ config: configSchema }).parse(data))
  .handler(async ({ data }): Promise<AiTestResult> => {
    const { createProvider } = await import("./ai-providers.server");
    return createProvider(data.config as AiConfig).test();
  });

export const aiChat = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ config: configSchema, messages: messagesSchema, json: z.boolean().default(false) })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AiChatResult> => {
    const { createProvider, AiTimeoutError } = await import("./ai-providers.server");
    try {
      return await createProvider(data.config as AiConfig).chat(data.messages, { json: data.json });
    } catch (err) {
      const timeout = err instanceof AiTimeoutError;
      return {
        ok: false,
        content: "",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 0,
        model: data.config.model,
        error: timeout ? "Timeout ao contatar a API." : (err as Error).message,
      };
    }
  });

export const aiWebSearch = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(10).default(6) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; results: SearchResult[]; error?: string }> => {
    const { webSearch } = await import("./ai-search.server");
    try {
      return { ok: true, results: await webSearch(data.query, data.limit) };
    } catch (err) {
      return { ok: false, results: [], error: (err as Error).message };
    }
  });
