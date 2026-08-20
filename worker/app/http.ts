export const clean = (value: unknown) => String(value ?? '').trim();

export const json = (data: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra,
  },
});

export const ok = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });

export const fail = (message: string, status = 400, code = 'BAD_REQUEST') =>
  json({ ok: false, error: { message, code } }, status);

export async function requestBody(req: Request): Promise<any> {
  try {
    return await req.json() as any;
  } catch {
    return {} as any;
  }
}

export function cookie(req: Request, name: string) {
  try {
    for (const item of (req.headers.get('cookie') || '').split(';')) {
      const [key, ...parts] = item.trim().split('=');
      if (key === name) return decodeURIComponent(parts.join('='));
    }
  } catch {
    return null;
  }
  return null;
}

export function sameOrigin(req: Request) {
  const origin = clean(req.headers.get('origin'));
  return !origin || origin === new URL(req.url).origin;
}

export function secure(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  headers.set(
    'content-security-policy',
    "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self'; font-src 'self' data: https://fonts.gstatic.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
