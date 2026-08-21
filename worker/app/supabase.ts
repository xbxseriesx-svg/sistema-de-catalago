import type { Env } from './env';
import { postgrestLiteral } from './domain';
import { clean } from './http';

export function adminKey(env: Env) {
  return clean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
}

export function adminHeaders(env: Env, initial: HeadersInit = {}) {
  const key = adminKey(env);
  if (!key) throw new Error('SUPABASE_SECRET_KEY não configurada');
  const headers = new Headers(initial);
  headers.set('apikey', key);
  if (!key.startsWith('sb_secret_')) headers.set('authorization', `Bearer ${key}`);
  return headers;
}

export function publicHeaders(env: Env, initial: HeadersInit = {}) {
  const key = clean(env.SUPABASE_PUBLISHABLE_KEY);
  if (!key) throw new Error('SUPABASE_PUBLISHABLE_KEY não configurada');
  const headers = new Headers(initial);
  headers.set('apikey', key);
  return headers;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function publicSupabase(env: Env, path: string, init: RequestInit = {}) {
  const url = clean(env.SUPABASE_URL).replace(/\/+$/, '');
  if (!url) throw new Error('SUPABASE_URL não configurada');
  const headers = publicHeaders(env, init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return parseResponse(await fetch(`${url}${path}`, { ...init, headers }));
}

export async function publicTable(
  env: Env,
  name: string,
  query = '',
  init: RequestInit = {},
) {
  return publicSupabase(env, `/rest/v1/${name}${query ? `?${query}` : ''}`, init);
}

export async function publicTableAll(
  env: Env,
  name: string,
  query = '',
  pageSize = 500,
  maxRows = 10000,
) {
  const rows: any[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await publicTable(env, name, `${query}${query ? '&' : ''}limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error(`Resposta pública inválida ao consultar ${name}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error(`A consulta pública de ${name} excedeu o limite seguro de ${maxRows} registros`);
}

export async function supabase(
  env: Env,
  path: string,
  init: RequestInit = {},
  userToken?: string,
) {
  const headers = new Headers(init.headers);
  const key = adminKey(env);
  if (!userToken && !key) throw new Error('SUPABASE_SECRET_KEY não configurada');

  headers.set('apikey', userToken ? env.SUPABASE_PUBLISHABLE_KEY : key);
  if (userToken) {
    headers.set('authorization', `Bearer ${userToken}`);
  } else if (!key.startsWith('sb_secret_')) {
    headers.set('authorization', `Bearer ${key}`);
  }
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  return parseResponse(await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers }));
}

export async function table(
  env: Env,
  name: string,
  query = '',
  init: RequestInit = {},
  userToken?: string,
) {
  return supabase(env, `/rest/v1/${name}${query ? `?${query}` : ''}`, init, userToken);
}

export async function tableAll(
  env: Env,
  name: string,
  query = '',
  pageSize = 500,
  maxRows = 10000,
) {
  const rows: any[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await table(env, name, `${query}${query ? '&' : ''}limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error(`Resposta inválida ao consultar ${name}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error(`A consulta de ${name} excedeu o limite seguro de ${maxRows} registros`);
}

export async function tableByValues(
  env: Env,
  name: string,
  baseQuery: string,
  column: string,
  values: string[],
) {
  const rows: any[] = [];
  for (let index = 0; index < values.length; index += 150) {
    const list = values.slice(index, index + 150).map(postgrestLiteral).join(',');
    const page = await table(
      env,
      name,
      `${baseQuery}${baseQuery ? '&' : ''}${column}=in.(${list})`,
    );
    if (!Array.isArray(page)) throw new Error(`Resposta inválida ao consultar ${name}`);
    rows.push(...page);
  }
  return rows;
}

export async function adminFetch(env: Env, path: string, init: RequestInit = {}) {
  const headers = adminHeaders(env, init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return parseResponse(await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers }));
}
