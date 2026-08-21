/** Real web research (DuckDuckGo Lite + Bing fallback, no API key required). */
import type { SearchResult } from "./ai-types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const decode = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function ddgUrl(href: string): string {
  const m = /[?&]uddg=([^&"]+)/.exec(href);
  if (m) {
    try {
      return decodeURIComponent(m[1]!);
    } catch {
      /* fallthrough */
    }
  }
  return href.startsWith("//") ? `https:${href}` : href;
}

function parseDdgLite(html: string, limit: number): SearchResult[] {
  const out: SearchResult[] = [];
  const re =
    /<a[^>]+href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=class=['"]result-link['"]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const url = ddgUrl(decode(m[1] ?? ""));
    if (!/^https?:\/\//.test(url)) continue;
    const snippet = /class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/.exec(m[3] ?? "")?.[1] ?? "";
    out.push({ url, title: decode(m[2] ?? ""), snippet: decode(snippet).slice(0, 320) });
  }
  return out;
}

function bingUrl(href: string): string {
  const m = /[?&]u=a1([A-Za-z0-9_-]+)/.exec(href.replace(/&amp;/g, "&"));
  if (m) {
    try {
      const b64 = m[1]!.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
      if (/^https?:\/\//.test(decoded)) return decoded;
    } catch {
      /* fallthrough */
    }
  }
  return href.replace(/&amp;/g, "&");
}

function parseBing(html: string, limit: number): SearchResult[] {
  const out: SearchResult[] = [];
  for (const block of html.split(/<li class="b_algo"/).slice(1)) {
    if (out.length >= limit) break;
    const link = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!link) continue;
    const url = bingUrl(link[1] ?? "");
    if (!/^https?:\/\//.test(url)) continue;
    const snippet = /<p[^>]*>([\s\S]*?)<\/p>/.exec(block)?.[1] ?? "";
    out.push({ url, title: decode(link[2] ?? ""), snippet: decode(snippet).slice(0, 320) });
  }
  return out;
}

async function get(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9", accept: "text/html" },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function webSearch(query: string, limit = 6): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  const q = encodeURIComponent(query);
  try {
    try {
      const results = parseDdgLite(await get(`https://lite.duckduckgo.com/lite/?q=${q}`, controller.signal), limit);
      if (results.length) return results;
    } catch {
      /* try fallback */
    }
    const results = parseBing(
      await get(`https://www.bing.com/search?q=${q}&setlang=pt-br`, controller.signal),
      limit,
    );
    if (!results.length) throw new Error("Nenhum resultado retornado pelos buscadores.");
    return results;
  } finally {
    clearTimeout(timer);
  }
}
