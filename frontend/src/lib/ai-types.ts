/** Shared, client-safe AI types. */

export type ProviderId = "openai" | "openrouter" | "ollama";

export interface AiConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiChatResult {
  ok: boolean;
  content: string;
  usage: AiUsage;
  latencyMs: number;
  model: string;
  error?: string;
}

export type TestStatus = "connected" | "failed" | "model_not_found" | "unavailable" | "timeout";

export interface AiTestResult {
  status: TestStatus;
  message: string;
  latencyMs: number;
  url: string;
  model: string;
  models?: string[];
  sample?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export const DEFAULT_BASE_URL: Record<ProviderId, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434",
};

export const DEFAULT_MODEL: Record<ProviderId, string> = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  ollama: "llama3.1",
};

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  ollama: "Ollama",
};
