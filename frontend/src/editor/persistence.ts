import type { EditorDocument, ResolutionPreset } from "./types";
import { normalizePersistedDocument, serializeForLegacyStorage } from "./documentAdapter";

export type SavedEditorPayload = {
  schemaVersion: 5;
  doc: EditorDocument;
  resolution: ResolutionPreset;
  savedAt: string;
};

type ApiUser = {
  id: string;
  companyId: string;
  email: string | null;
  name: string | null;
  role: string;
};

type ApiError = { message?: string; code?: string };
type ApiEnvelope = Record<string, unknown> & { ok?: boolean; error?: string | ApiError; message?: string; code?: string };

const LOCAL_KEY = "asteryon:v5:editor-draft";
const PAGE_SLUG = "home";
let remoteRevision: number | null = null;

function errorMessage(payload: ApiEnvelope | null, status: number) {
  const error = payload?.error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  return `Falha na API ASTERYON (${status})`;
}

async function api<T extends ApiEnvelope>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (body && typeof body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    body,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  let payload: T | null = null;
  try { payload = await response.json() as T; } catch { payload = null; }
  if (!response.ok || payload?.ok === false) throw new Error(errorMessage(payload, response.status));
  return (payload ?? { ok: true }) as T;
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function remoteDocument(value: unknown): EditorDocument | null {
  return normalizePersistedDocument(value) as EditorDocument | null;
}

export function loadLocalDraft(): SavedEditorPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedEditorPayload & { version?: number; schemaVersion?: number };
    const doc = remoteDocument(parsed?.doc);
    if (!doc) return null;
    return { ...parsed, schemaVersion: 5, doc } as SavedEditorPayload;
  } catch {
    return null;
  }
}

export function saveLocalDraft(payload: SavedEditorPayload) {
  if (typeof window !== "undefined") localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
}

export async function getSessionState() {
  const status = await api<ApiEnvelope & { needsBootstrap?: boolean; user?: ApiUser | null }>("/api/auth/status");
  const user = status.user ?? null;
  return {
    configured: true,
    needsBootstrap: !!status.needsBootstrap,
    session: user ? { user: { id: user.id, email: user.email } } : null,
    membership: user ? {
      company_id: user.companyId,
      user_id: user.id,
      role: String(user.role || "").toLowerCase(),
      active: true,
    } : null,
  };
}

export async function signIn(email: string, password: string) {
  return api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signOut() {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
}

export async function loadRemoteDraft(): Promise<SavedEditorPayload | null> {
  const state = await getSessionState();
  if (!state.session || !state.membership?.active) return null;
  const data = await api<ApiEnvelope & {
    page?: {
      nodes?: unknown;
      revision?: number;
      updatedAt?: string;
      settings?: Record<string, unknown>;
    };
  }>(`/api/admin/pages/${PAGE_SLUG}/draft`);
  const doc = remoteDocument(data.page?.nodes);
  if (!doc) return null;
  remoteRevision = Number.isFinite(Number(data.page?.revision)) ? Number(data.page?.revision) : null;
  const settings = data.page?.settings ?? {};
  return {
    schemaVersion: 5,
    doc,
    resolution: (settings.resolutionPreset as ResolutionPreset) ?? "1080p",
    savedAt: data.page?.updatedAt ?? new Date().toISOString(),
  };
}

export async function saveRemoteDraft(payload: SavedEditorPayload) {
  const state = await getSessionState();
  if (!state.session || !state.membership?.active) return { remote: false as const };
  const data = await api<ApiEnvelope & { revision?: number; savedAt?: string }>(`/api/admin/pages/${PAGE_SLUG}/draft`, {
    method: "PUT",
    body: JSON.stringify({
      nodes: serializeForLegacyStorage(payload.doc),
      settings: { editorSchemaVersion: 5, resolutionPreset: payload.resolution },
      expectedRevision: remoteRevision,
    }),
  });
  if (Number.isFinite(Number(data.revision))) remoteRevision = Number(data.revision);
  return { remote: true as const, revision: remoteRevision, savedAt: data.savedAt ?? payload.savedAt };
}

export async function createRemoteSnapshot(label = "Ponto manual") {
  const data = await api<ApiEnvelope & { snapshot?: unknown }>(`/api/admin/pages/${PAGE_SLUG}/snapshots`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
  return data.snapshot;
}

export async function publishRemotePage() {
  const data = await api<ApiEnvelope & { publication?: unknown }>(`/api/admin/pages/${PAGE_SLUG}/publish`, {
    method: "POST",
    body: "{}",
  });
  return data.publication;
}

export async function listRemoteSnapshots() {
  const data = await api<ApiEnvelope & { snapshots?: Array<Record<string, unknown>> }>(`/api/admin/pages/${PAGE_SLUG}/snapshots`);
  return (data.snapshots ?? []).map((item) => ({
    ...item,
    created_at: item.createdAt ?? item.created_at,
  }));
}

export async function restoreRemoteSnapshot(snapshotId: string) {
  const data = await api<ApiEnvelope & { revision?: number }>(
    `/api/admin/pages/${PAGE_SLUG}/snapshots/${encodeURIComponent(snapshotId)}/restore`,
    { method: "POST", body: "{}" },
  );
  if (Number.isFinite(Number(data.revision))) remoteRevision = Number(data.revision);
  return data;
}

export async function getPublishedDocument(): Promise<EditorDocument | null> {
  const data = await api<ApiEnvelope & { page?: { nodes?: unknown } }>(`/api/public/pages/${PAGE_SLUG}`);
  return remoteDocument(data.page?.nodes);
}

export async function uploadEditorMedia(file: File, nodeType: string, nodeId: string) {
  const state = await getSessionState();
  if (!state.session || !state.membership?.active) throw new Error("Faça login com acesso ativo para enviar mídia.");
  const dataBase64 = await toDataUrl(file);
  const data = await api<ApiEnvelope & { url?: string }>("/api/admin/media", {
    method: "POST",
    body: JSON.stringify({
      kind: `editor-${nodeType}`,
      entityKey: nodeId,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      dataBase64,
    }),
  });
  if (!data.url) throw new Error("A API não retornou a URL da mídia.");
  return data.url;
}
