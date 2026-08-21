import type { AiChatResult, AiConfig, AiMessage, AiTestResult, SearchResult } from "./ai-types";

type ServerFnInput<T> = { data: T };
type ApiEnvelope<T> = { ok?: boolean; result?: T; error?: { message?: string } | string };

async function post<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false || payload?.result === undefined) {
    const error = payload?.error;
    const message = typeof error === "string" ? error : error?.message;
    throw new Error(message || `Falha na API ASTERYON AI (${response.status})`);
  }
  return payload.result;
}

export function aiTestConnection(input: ServerFnInput<{ config: AiConfig }>) {
  return post<AiTestResult>("/api/admin/ai/test", input.data);
}

export function aiChat(input: ServerFnInput<{ config: AiConfig; messages: AiMessage[]; json: boolean }>) {
  return post<AiChatResult>("/api/admin/ai/chat", input.data);
}

export function aiWebSearch(input: ServerFnInput<{ query: string; limit: number }>) {
  return post<{ ok: boolean; results: SearchResult[]; error?: string }>("/api/admin/ai/search", input.data);
}
