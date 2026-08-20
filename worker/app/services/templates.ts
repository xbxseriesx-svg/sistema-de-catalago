import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { uid } from '../domain';
import { clean, fail, ok, requestBody } from '../http';
import { requireUser } from '../auth/session';
import { table } from '../supabase';

export async function handleTemplatesRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/admin/templates' && req.method === 'GET') {
    const auth = await requireUser(req, env);
    if (auth.error) return auth.error;
    const rows = await table(
      env,
      'templates',
      `company_id=eq.${COMPANY_ID}&active=eq.true&select=*&order=updated_at.desc`,
    ) as any[];
    return ok({
      templates: (rows || []).map((item: any) => ({
        id: item.id,
        systemKey: item.system_key,
        name: item.name,
        description: item.description,
        category: item.category,
        tags: item.tags,
        accent: item.accent,
        nodes: item.nodes,
        isSystem: !!item.data?.isSystem,
        version: item.version,
        updatedAt: item.updated_at,
      })),
    });
  }

  if (path === '/api/admin/templates/seed' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    if (auth.user.role !== 'SDM') {
      return fail('Somente o SDM pode administrar os modelos globais', 403, 'SDM_ONLY');
    }

    const input = await requestBody(req);
    const templates = Array.isArray(input.templates) ? input.templates.slice(0, 30) : [];
    const rows = templates
      .filter((template: any) => clean(template.systemKey) && Array.isArray(template.nodes))
      .map((template: any) => ({
        id: uid('tpl'),
        company_id: COMPANY_ID,
        system_key: clean(template.systemKey),
        name: clean(template.name) || 'Modelo',
        description: clean(template.description),
        category: clean(template.category) || 'geral',
        tags: template.tags || [],
        accent: clean(template.accent),
        nodes: template.nodes,
        active: true,
        data: { isSystem: true },
      }));

    if (rows.length) {
      await table(env, 'templates', 'on_conflict=company_id,system_key', {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
    }
    return ok({ requested: templates.length });
  }

  const templateItem = path.match(/^\/api\/admin\/templates\/([^/]+)$/);
  if (templateItem && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    if (auth.user.role !== 'SDM') {
      return fail('Somente o SDM pode alterar ou excluir modelos', 403, 'SDM_ONLY');
    }

    const id = decodeURIComponent(templateItem[1]);
    if (req.method === 'DELETE') {
      await table(env, 'templates', `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}`, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ active: false }),
      });
      return ok({ id });
    }

    const input = await requestBody(req);
    const currentRows = await table(
      env,
      'templates',
      `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}&select=*&limit=1`,
    ) as any[];
    const current = currentRows?.[0];
    if (!current) return fail('Modelo não encontrado', 404, 'NOT_FOUND');
    const version = Number(current.version) + 1;
    await table(env, 'templates', `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        category: input.category ?? current.category,
        tags: input.tags ?? current.tags,
        accent: input.accent ?? current.accent,
        nodes: input.nodes ?? current.nodes,
        version,
      }),
    });
    return ok({ id, version });
  }

  return null;
}
