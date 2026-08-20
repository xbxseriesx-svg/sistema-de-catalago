import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { audit } from '../audit';
import { uid } from '../domain';
import { clean, fail, ok, requestBody } from '../http';
import { requireUser } from '../auth/session';
import { table } from '../supabase';

export async function handlePagesRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  const pageDraft = path.match(/^\/api\/admin\/pages\/([^/]+)\/draft$/);
  if (pageDraft && ['GET', 'PUT'].includes(req.method)) {
    const auth = await requireUser(
      req,
      env,
      req.method === 'GET' ? ['VIEWER', 'EDITOR', 'ADMIN'] : ['EDITOR', 'ADMIN'],
    );
    if (auth.error || !auth.user) return auth.error;
    const slugValue = decodeURIComponent(pageDraft[1]);
    const rows = await table(
      env,
      'pages',
      `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(slugValue)}&select=*&limit=1`,
    ) as any[];
    const page = rows?.[0];
    if (!page) return fail('Página não encontrada', 404, 'NOT_FOUND');

    if (req.method === 'GET') {
      return ok({
        page: {
          id: page.id,
          slug: page.slug,
          title: page.title,
          nodes: page.draft_nodes,
          revision: page.revision,
          updatedAt: page.updated_at,
          publishedVersionId: `supabase-v${page.published_revision}`,
        },
      });
    }

    const input = await requestBody(req);
    if (!Array.isArray(input.nodes)) return fail('Conteúdo inválido');
    if (input.expectedRevision != null && Number(input.expectedRevision) !== Number(page.revision)) {
      return fail(
        'O rascunho foi alterado em outra sessão. Recarregue antes de salvar.',
        409,
        'REVISION_CONFLICT',
      );
    }
    const revision = Number(page.revision) + 1;
    await table(env, 'pages', `id=eq.${encodeURIComponent(page.id)}&company_id=eq.${COMPANY_ID}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ draft_nodes: input.nodes, revision }),
    });
    await audit(env, auth.user, 'draft.save', 'page', page.id, { revision });
    return ok({ revision, savedAt: new Date().toISOString() });
  }

  const publish = path.match(/^\/api\/admin\/pages\/([^/]+)\/publish$/);
  if (publish && req.method === 'POST') {
    const auth = await requireUser(req, env, ['ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const rows = await table(
      env,
      'pages',
      `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(publish[1]))}&select=*&limit=1`,
    ) as any[];
    const page = rows?.[0];
    if (!page) return fail('Página não encontrada', 404, 'NOT_FOUND');

    const versionNumber = Number(page.published_revision) + 1;
    const versionId = uid('ver');
    await table(env, 'page_publications', '', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        id: versionId,
        page_id: page.id,
        revision: versionNumber,
        nodes: page.draft_nodes,
        created_by: auth.user.id,
      }),
    });
    await table(env, 'pages', `id=eq.${encodeURIComponent(page.id)}&company_id=eq.${COMPANY_ID}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        published_nodes: page.draft_nodes,
        published_revision: versionNumber,
      }),
    });
    await audit(env, auth.user, 'page.publish', 'page', page.id, { versionId, versionNumber });
    return ok({
      publication: {
        versionId,
        versionNumber,
        publishedAt: new Date().toISOString(),
      },
    });
  }

  const snapshots = path.match(/^\/api\/admin\/pages\/([^/]+)\/snapshots$/);
  if (snapshots && ['GET', 'POST'].includes(req.method)) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const pages = await table(
      env,
      'pages',
      `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(snapshots[1]))}&select=id,revision&limit=1`,
    ) as any[];
    const page = pages?.[0];
    if (!page) return fail('Página não encontrada', 404, 'NOT_FOUND');

    if (req.method === 'GET') {
      const rows = await table(
        env,
        'page_snapshots',
        `page_id=eq.${encodeURIComponent(page.id)}&select=id,label,nodes,created_at&order=created_at.desc&limit=30`,
      ) as any[];
      return ok({
        snapshots: (rows || []).map((item: any) => ({
          id: item.id,
          label: item.label,
          nodes: item.nodes,
          createdAt: item.created_at,
        })),
      });
    }

    const input = await requestBody(req);
    if (!Array.isArray(input.nodes)) return fail('Snapshot inválido');
    const id = uid('snap');
    const label = clean(input.label).slice(0, 120) || 'Ponto manual';
    await table(env, 'page_snapshots', '', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        id,
        page_id: page.id,
        label,
        nodes: input.nodes,
        revision: page.revision,
        created_by: auth.user.id,
      }),
    });
    return ok({ snapshot: { id, label, createdAt: new Date().toISOString() } });
  }

  const versions = path.match(/^\/api\/admin\/pages\/([^/]+)\/versions$/);
  if (versions && req.method === 'GET') {
    const auth = await requireUser(req, env);
    if (auth.error) return auth.error;
    const pages = await table(
      env,
      'pages',
      `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(versions[1]))}&select=id,published_revision&limit=1`,
    ) as any[];
    const page = pages?.[0];
    if (!page) return fail('Página não encontrada', 404, 'NOT_FOUND');
    const rows = await table(
      env,
      'page_publications',
      `page_id=eq.${encodeURIComponent(page.id)}&select=id,revision,created_at&order=revision.desc&limit=50`,
    ) as any[];
    return ok({
      publishedVersionId: `supabase-v${page.published_revision}`,
      versions: (rows || []).map((item: any) => ({
        id: item.id,
        version_number: item.revision,
        label: `Publicação ${item.revision}`,
        source: 'supabase',
        created_at: item.created_at,
      })),
    });
  }

  const rollback = path.match(/^\/api\/admin\/pages\/([^/]+)\/rollback\/([^/]+)$/);
  if (rollback && req.method === 'POST') {
    const auth = await requireUser(req, env, ['ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const pages = await table(
      env,
      'pages',
      `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(rollback[1]))}&select=*&limit=1`,
    ) as any[];
    const page = pages?.[0];
    const publications = page
      ? await table(
        env,
        'page_publications',
        `id=eq.${encodeURIComponent(decodeURIComponent(rollback[2]))}&page_id=eq.${encodeURIComponent(page.id)}&select=*&limit=1`,
      ) as any[]
      : [];
    const version = publications?.[0];
    if (!page || !version) return fail('Versão não encontrada', 404, 'VERSION_NOT_FOUND');

    const revision = Number(page.revision) + 1;
    await table(env, 'page_snapshots', '', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        id: uid('snap'),
        page_id: page.id,
        label: `Antes de restaurar v${version.revision}`,
        nodes: page.draft_nodes,
        revision: page.revision,
        created_by: auth.user.id,
      }),
    });
    await table(env, 'pages', `id=eq.${encodeURIComponent(page.id)}&company_id=eq.${COMPANY_ID}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ draft_nodes: version.nodes, revision }),
    });
    return ok({
      versionId: version.id,
      versionNumber: version.revision,
      revision,
      restoredAt: new Date().toISOString(),
    });
  }

  return null;
}
