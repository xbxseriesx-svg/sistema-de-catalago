import type { EditorNode } from '../editor/types';
import type { Brand, Distribution, HierarchyNode, Product, Promotion } from '../catalog/types';

export type CloudRole = 'SDM' | 'ADMIN' | 'EDITOR' | 'VIEWER';
export interface CloudUser { id: string; companyId: string; email: string; name: string; role: CloudRole; }
export interface AuthStatus { needsBootstrap: boolean; user: CloudUser | null; }
export interface CloudTemplate {
  id: string;
  systemKey?: string | null;
  name: string;
  description: string;
  category: string;
  tags: string[];
  accent?: string | null;
  nodes: EditorNode[];
  isSystem: boolean;
  version: number;
  updatedAt: string;
}

export const isCloudRuntime = () => {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'file:') return false;
  return !['localhost', '127.0.0.1'].includes(window.location.hostname);
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({ ok: false, error: { message: `HTTP ${response.status}` } }));
  if (!response.ok || payload?.ok === false) {
    const err = new Error(payload?.error?.message || `Falha HTTP ${response.status}`) as Error & { status?: number; code?: string };
    err.status = response.status;
    err.code = payload?.error?.code;
    throw err;
  }
  return payload as T;
}

export const cloudApi = {
  authStatus: () => request<{ ok: true; needsBootstrap: boolean; user: CloudUser | null }>('/api/auth/status'),
  bootstrap: (input: { token: string; email: string; password: string; name: string }) => request<{ ok: true; user: CloudUser }>('/api/auth/bootstrap', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) => request<{ ok: true; user: CloudUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' }),

  getDraft: (slug = 'home') => request<{ ok: true; page: { id: string; slug: string; title: string; nodes: EditorNode[]; revision: number; updatedAt: string; publishedVersionId: string | null } }>(`/api/admin/pages/${slug}/draft`),
  saveDraft: (nodes: EditorNode[], expectedRevision?: number, slug = 'home') => request<{ ok: true; revision: number; savedAt: string }>(`/api/admin/pages/${slug}/draft`, { method: 'PUT', body: JSON.stringify({ nodes, expectedRevision }) }),
  publish: (slug = 'home') => request<{ ok: true; publication: { versionId: string; versionNumber: number; publishedAt: string } }>(`/api/admin/pages/${slug}/publish`, { method: 'POST', body: '{}' }),
  createSnapshot: (nodes: EditorNode[], label: string, slug = 'home') => request<{ ok: true; snapshot: { id: string; label: string; createdAt: string } }>(`/api/admin/pages/${slug}/snapshots`, { method: 'POST', body: JSON.stringify({ nodes, label }) }),
  getSnapshots: (slug = 'home') => request<{ ok: true; snapshots: Array<{ id: string; label: string; createdAt: string; nodes: EditorNode[] }> }>(`/api/admin/pages/${slug}/snapshots`),
  getVersions: (slug = 'home') => request<{ ok: true; publishedVersionId: string | null; versions: Array<{ id: string; version_number: number; label: string; source: string; created_at: string }> }>(`/api/admin/pages/${slug}/versions`),
  rollback: (versionId: string, slug = 'home') => request<{ ok: true; versionId: string; versionNumber: number }>(`/api/admin/pages/${slug}/rollback/${versionId}`, { method: 'POST', body: '{}' }),

  publicPage: (slug = 'home') => request<{ ok: true; page: { slug: string; title: string; versionId: string; versionNumber: number; publishedAt: string; nodes: EditorNode[] } }>(`/api/public/pages/${slug}`),

  listTemplates: () => request<{ ok: true; templates: CloudTemplate[] }>('/api/admin/templates'),
  seedTemplates: (templates: Array<{ systemKey: string; name: string; description: string; category: string; tags: string[]; accent: string; nodes: EditorNode[] }>) => request<{ ok: true; requested: number }>('/api/admin/templates/seed', { method: 'POST', body: JSON.stringify({ templates }) }),
  updateTemplate: (id: string, input: Partial<CloudTemplate> & { nodes?: EditorNode[] }) => request<{ ok: true; id: string; version: number }>(`/api/admin/templates/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteTemplate: (id: string) => request<{ ok: true }>(`/api/admin/templates/${id}`, { method: 'DELETE' }),

  getCatalog: (publicOnly = false) => request<{ ok: true; catalog: { products: Product[]; brands: Brand[]; distributions: Distribution[]; hierarchy: HierarchyNode[]; promotions: Promotion[] } }>(publicOnly ? '/api/public/catalog' : '/api/admin/catalog'),
  bulkProducts: (products: unknown[], filename = 'importacao.json', kind = 'json') => request<{ ok: true; importId: string; total: number; inserted: number; updated: number; ignored: number }>('/api/admin/catalog/products/bulk', { method: 'POST', body: JSON.stringify({ products, filename, kind }) }),
};
