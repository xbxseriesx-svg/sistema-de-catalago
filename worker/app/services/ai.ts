import type { Env } from '../env';
import { audit } from '../audit';
import { requireUser } from '../auth/session';
import { clean, fail, ok, requestBody } from '../http';

type ProviderId = 'openai' | 'openrouter' | 'ollama';
type AiConfig = {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
};
type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type AiUsage = { promptTokens: number; completionTokens: number; totalTokens: number };
type AiChatResult = {
  ok: boolean;
  content: string;
  usage: AiUsage;
  latencyMs: number;
  model: string;
  error?: string;
};
type AiTestResult = {
  status: 'connected' | 'failed' | 'model_not_found' | 'unavailable' | 'timeout';
  message: string;
  latencyMs: number;
  url: string;
  model: string;
  models?: string[];
  sample?: string;
};
type SearchResult = { title: string; url: string; snippet: string };

const DEFAULT_BASE_URL: Record<ProviderId, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434',
};
const DNS_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const UA = 'ASTERYON-Catalog/94 (Cloudflare Worker; AI gateway)';

const emptyUsage = (): AiUsage => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
class AiTimeoutError extends Error {}

function ipv4Parts(value: string) {
  const parts = value.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

function isNonPublicIpv4(value: string) {
  const parts = ipv4Parts(value);
  if (!parts) return false;
  const [a, b, c] = parts;
  return a === 0
    || a === 10
    || (a === 100 && b >= 64 && b <= 127)
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function expandIpv6(value: string) {
  const raw = value.toLowerCase().split('%')[0];
  if (!raw.includes(':')) return null;
  let input = raw;
  const last = input.slice(input.lastIndexOf(':') + 1);
  if (last.includes('.')) {
    const v4 = ipv4Parts(last);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    input = `${input.slice(0, input.lastIndexOf(':'))}:${hi}:${lo}`;
  }
  const halves = input.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(':').filter(Boolean) : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 2 && missing < 1)) return null;
  const groups = halves.length === 2 ? [...left, ...Array(missing).fill('0'), ...right] : left;
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => parseInt(group, 16));
}

function isNonPublicIpv6(value: string) {
  const groups = expandIpv6(value);
  if (!groups) return false;
  const [g0, g1, g2, g3, g4, g5] = groups;
  if (groups.every((group) => group === 0)) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true;
  if ((g0 & 0xfe00) === 0xfc00) return true;
  if ((g0 & 0xffc0) === 0xfe80) return true;
  if ((g0 & 0xff00) === 0xff00) return true;
  if (g0 === 0x2001 && g1 === 0x0db8) return true;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    const mapped = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return isNonPublicIpv4(mapped);
  }
  return false;
}

async function dnsAddresses(hostname: string, type: 'A' | 'AAAA') {
  const response = await fetch(`${DNS_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${type}`, {
    headers: { accept: 'application/dns-json' },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error(`Falha ao validar DNS do provedor (${response.status})`);
  const payload = await response.json() as any;
  if (Number(payload?.Status) !== 0) return [] as string[];
  const expectedType = type === 'A' ? 1 : 28;
  return (Array.isArray(payload?.Answer) ? payload.Answer : [])
    .filter((answer: any) => Number(answer?.type) === expectedType)
    .map((answer: any) => clean(answer?.data))
    .filter(Boolean);
}

async function safeProviderBase(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('URL do provedor de IA inválida'); }
  if (url.protocol !== 'https:') {
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
      throw new Error('O Worker não acessa Ollama local. Informe um endpoint HTTPS público e protegido.');
    }
    throw new Error('Endpoint de IA precisa usar HTTPS');
  }
  if (url.username || url.password) throw new Error('Endpoint de IA não pode conter credenciais na URL');
  if (url.port && url.port !== '443') throw new Error('Porta do endpoint de IA não permitida');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname === 'metadata.google.internal') {
    throw new Error('Host do provedor de IA não permitido');
  }
  if (isNonPublicIpv4(hostname) || isNonPublicIpv6(hostname)) throw new Error('Endereço privado/reservado não permitido');
  if (!ipv4Parts(hostname) && !hostname.includes(':')) {
    const [a, aaaa] = await Promise.all([dnsAddresses(hostname, 'A'), dnsAddresses(hostname, 'AAAA')]);
    const addresses = [...a, ...aaaa];
    if (!addresses.length) throw new Error('Host do provedor sem DNS público válido');
    if (addresses.some((address) => isNonPublicIpv4(address) || isNonPublicIpv6(address))) {
      throw new Error('DNS do provedor resolveu para endereço não público');
    }
  }
  return url.toString().replace(/\/+$/, '');
}

function normalizeConfig(value: unknown): AiConfig {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as any : {};
  const provider = clean(input.provider) as ProviderId;
  if (!['openai', 'openrouter', 'ollama'].includes(provider)) throw new Error('Provider de IA inválido');
  const model = clean(input.model).slice(0, 160);
  if (!model) throw new Error('Modelo de IA não informado');
  const apiKey = clean(input.apiKey).slice(0, 4096);
  const baseUrl = clean(input.baseUrl) || DEFAULT_BASE_URL[provider];
  const temperature = Number(input.temperature);
  const maxTokens = Number(input.maxTokens);
  return {
    provider,
    model,
    apiKey,
    baseUrl,
    temperature: Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : 0.7,
    maxTokens: Number.isInteger(maxTokens) ? Math.min(32_000, Math.max(64, maxTokens)) : 4000,
  };
}

async function providerRequest(url: string, init: RequestInit & { timeoutMs?: number }) {
  const target = new URL(url);
  await safeProviderBase(`${target.protocol}//${target.host}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) throw new Error('Redirecionamento do provedor recusado por segurança');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_RESPONSE_BYTES) throw new Error('Resposta do provedor excede o limite permitido');
    return response;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw new AiTimeoutError('timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

class AiProvider {
  constructor(protected cfg: AiConfig) {}
  get baseUrl() { return this.cfg.baseUrl.replace(/\/+$/, ''); }
  async validatedBase() { return safeProviderBase(this.cfg.baseUrl); }
  async listModels(): Promise<string[]> { return []; }
  async chat(_messages: AiMessage[], _opts?: { json?: boolean }): Promise<AiChatResult> { throw new Error('Provider sem implementação'); }
  async test(): Promise<AiTestResult> {
    const started = Date.now();
    let url = this.baseUrl;
    try {
      url = await this.validatedBase();
      const models = await this.listModels();
      if (models.length && !models.includes(this.cfg.model)) {
        return { status: 'model_not_found', message: `Modelo "${this.cfg.model}" não encontrado no endpoint (${models.length} modelos disponíveis).`, latencyMs: Date.now() - started, url, model: this.cfg.model, models };
      }
      const probe = await this.chat([{ role: 'user', content: 'Responda apenas com a palavra: OK' }]);
      if (!probe.ok) {
        return { status: /not found|does not exist|unknown model/i.test(probe.error ?? '') ? 'model_not_found' : 'failed', message: probe.error ?? 'Falha na requisição.', latencyMs: Date.now() - started, url, model: this.cfg.model, models };
      }
      return { status: 'connected', message: 'Conexão validada com resposta real do modelo.', latencyMs: Date.now() - started, url, model: this.cfg.model, models, sample: probe.content.slice(0, 120) };
    } catch (error) {
      const timeout = error instanceof AiTimeoutError;
      return { status: timeout ? 'timeout' : 'unavailable', message: timeout ? 'Timeout ao contatar a API.' : `API indisponível: ${(error as Error).message}`, latencyMs: Date.now() - started, url, model: this.cfg.model };
    }
  }
}

class OpenAiCompatible extends AiProvider {
  headers() {
    if (!this.cfg.apiKey) throw new Error('API Key não informada.');
    return {
      authorization: `Bearer ${this.cfg.apiKey}`,
      ...(this.cfg.provider === 'openrouter' ? { 'http-referer': 'https://sistema-de-catalago.xbxseriesx.workers.dev', 'x-title': 'ASTERYON AI Website Builder' } : {}),
    };
  }
  async listModels(): Promise<string[]> {
    const base = await this.validatedBase();
    const response = await providerRequest(`${base}/models`, { headers: this.headers(), timeoutMs: 20_000 });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('API Key inválida (401/403).');
      return [];
    }
    const json = await response.json() as { data?: Array<{ id?: string }> };
    return (json.data ?? []).map((item) => clean(item.id)).filter(Boolean).slice(0, 500);
  }
  async chat(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiChatResult> {
    const started = Date.now();
    const base = await this.validatedBase();
    const response = await providerRequest(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.headers() },
      body: JSON.stringify({ model: this.cfg.model, messages, temperature: this.cfg.temperature, max_tokens: this.cfg.maxTokens, ...(opts?.json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    const text = await response.text();
    if (!response.ok) {
      let message = text.slice(0, 400);
      try { message = JSON.parse(text)?.error?.message || message; } catch { /* raw */ }
      return { ok: false, content: '', usage: emptyUsage(), latencyMs: Date.now() - started, model: this.cfg.model, error: `HTTP ${response.status}: ${message}` };
    }
    const json = JSON.parse(text) as any;
    return {
      ok: true,
      content: clean(json?.choices?.[0]?.message?.content),
      usage: { promptTokens: Number(json?.usage?.prompt_tokens) || 0, completionTokens: Number(json?.usage?.completion_tokens) || 0, totalTokens: Number(json?.usage?.total_tokens) || 0 },
      latencyMs: Date.now() - started,
      model: clean(json?.model) || this.cfg.model,
    };
  }
}

class OllamaProvider extends AiProvider {
  async listModels(): Promise<string[]> {
    const base = await this.validatedBase();
    const response = await providerRequest(`${base}/api/tags`, { timeoutMs: 15_000 });
    if (!response.ok) throw new Error(`HTTP ${response.status} em /api/tags`);
    const json = await response.json() as { models?: Array<{ name?: string }> };
    const names: string[] = (json.models ?? [])
      .map((item) => clean(item.name))
      .filter((name): name is string => Boolean(name));
    return [...new Set<string>(names.flatMap((name) => [name, name.split(':')[0] || name]))].slice(0, 500);
  }
  async chat(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiChatResult> {
    const started = Date.now();
    const base = await this.validatedBase();
    const response = await providerRequest(`${base}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.cfg.model, messages, stream: false, ...(opts?.json ? { format: 'json' } : {}), options: { temperature: this.cfg.temperature, num_predict: this.cfg.maxTokens } }),
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, content: '', usage: emptyUsage(), latencyMs: Date.now() - started, model: this.cfg.model, error: `HTTP ${response.status}: ${text.slice(0, 400)}` };
    const json = JSON.parse(text) as any;
    const promptTokens = Number(json?.prompt_eval_count) || 0;
    const completionTokens = Number(json?.eval_count) || 0;
    return { ok: true, content: clean(json?.message?.content), usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }, latencyMs: Date.now() - started, model: clean(json?.model) || this.cfg.model };
  }
}

function createProvider(config: AiConfig) {
  return config.provider === 'ollama' ? new OllamaProvider(config) : new OpenAiCompatible(config);
}

function normalizeMessages(value: unknown): AiMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 80) throw new Error('Histórico de mensagens inválido');
  let total = 0;
  return value.map((item) => {
    const role = clean(item?.role) as AiMessage['role'];
    if (!['system', 'user', 'assistant'].includes(role)) throw new Error('Role de mensagem inválido');
    const content = clean(item?.content);
    if (!content || content.length > 20_000) throw new Error('Mensagem vazia ou acima do limite');
    total += content.length;
    if (total > 150_000) throw new Error('Contexto de IA acima do limite permitido');
    return { role, content };
  });
}

const decodeHtml = (value: string) => value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
function ddgUrl(href: string) {
  const match = /[?&]uddg=([^&"]+)/.exec(href);
  if (match) { try { return decodeURIComponent(match[1] || ''); } catch { /* keep */ } }
  return href.startsWith('//') ? `https:${href}` : href;
}
function parseDdg(html: string, limit: number): SearchResult[] {
  const output: SearchResult[] = [];
  const regex = /<a[^>]+href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=class=['"]result-link['"]|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) && output.length < limit) {
    const url = ddgUrl(decodeHtml(match[1] || ''));
    if (!/^https?:\/\//.test(url)) continue;
    const snippet = /class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/.exec(match[3] || '')?.[1] || '';
    output.push({ url, title: decodeHtml(match[2] || ''), snippet: decodeHtml(snippet).slice(0, 320) });
  }
  return output;
}
function bingUrl(href: string) {
  const match = /[?&]u=a1([A-Za-z0-9_-]+)/.exec(href.replace(/&amp;/g, '&'));
  if (match) { try { const base = (match[1] || '').replace(/-/g, '+').replace(/_/g, '/'); const decoded = atob(base + '='.repeat((4 - base.length % 4) % 4)); if (/^https?:\/\//.test(decoded)) return decoded; } catch { /* keep */ } }
  return href.replace(/&amp;/g, '&');
}
function parseBing(html: string, limit: number): SearchResult[] {
  const output: SearchResult[] = [];
  for (const block of html.split(/<li class="b_algo"/).slice(1)) {
    if (output.length >= limit) break;
    const link = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!link) continue;
    const url = bingUrl(link[1] || '');
    if (!/^https?:\/\//.test(url)) continue;
    const snippet = /<p[^>]*>([\s\S]*?)<\/p>/.exec(block)?.[1] || '';
    output.push({ url, title: decodeHtml(link[2] || ''), snippet: decodeHtml(snippet).slice(0, 320) });
  }
  return output;
}
async function webSearch(query: string, limit: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  const get = async (url: string) => {
    const response = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9', accept: 'text/html' }, redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  };
  try {
    try {
      const result = parseDdg(await get(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`), limit);
      if (result.length) return result;
    } catch { /* fallback */ }
    const result = parseBing(await get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=pt-br`), limit);
    if (!result.length) throw new Error('Nenhum resultado retornado pelos buscadores.');
    return result;
  } finally { clearTimeout(timer); }
}

export async function handleAiRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (!path.startsWith('/api/admin/ai/')) return null;
  if (req.method !== 'POST') return fail('Método não permitido', 405, 'METHOD_NOT_ALLOWED');
  const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
  if (auth.error) return auth.error;
  const body = await requestBody(req);

  try {
    if (path === '/api/admin/ai/test') {
      const config = normalizeConfig(body?.config);
      const result = await createProvider(config).test();
      await audit(env, auth.user, 'ai.test', 'ai_gateway', null, { provider: config.provider, model: config.model, status: result.status });
      return ok({ result });
    }
    if (path === '/api/admin/ai/chat') {
      const config = normalizeConfig(body?.config);
      const messages = normalizeMessages(body?.messages);
      const result = await createProvider(config).chat(messages, { json: body?.json === true });
      await audit(env, auth.user, 'ai.chat', 'ai_gateway', null, { provider: config.provider, model: config.model, success: result.ok, totalTokens: result.usage.totalTokens });
      return ok({ result });
    }
    if (path === '/api/admin/ai/search') {
      const query = clean(body?.query).slice(0, 300);
      if (query.length < 2) return fail('Pesquisa muito curta', 400, 'INVALID_QUERY');
      const limit = Math.min(10, Math.max(1, Number(body?.limit) || 6));
      try {
        const results = await webSearch(query, limit);
        await audit(env, auth.user, 'ai.search', 'ai_gateway', null, { resultCount: results.length, queryLength: query.length });
        return ok({ result: { ok: true, results } });
      } catch (error) {
        return ok({ result: { ok: false, results: [], error: (error as Error).message } });
      }
    }
    return null;
  } catch (error) {
    return fail((error as Error).message || 'Falha ao executar IA', 400, 'AI_ERROR');
  }
}
