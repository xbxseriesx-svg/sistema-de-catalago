import type { Env } from './env';
import { COMPANY_ID } from './env';
import { fail, ok, sameOrigin, secure } from './http';
import {
  attachRefreshedSession,
  companyMembership,
  currentUser,
  handleCoreAuth,
  refreshSession,
  type RefreshedSession,
} from './auth/session';
import { handleAccountAuth } from './auth/account';
import { handlePublicCatalogRoute } from './services/catalog';
import { handleCatalogAdminRoute } from './services/catalog-admin';
import { handleBrandsRoute } from './services/brands';
import { handleBrandImagesRoute } from './services/brand-images';
import { handleHierarchyRoute } from './services/hierarchy';
import { handleMarketingRoute } from './services/marketing';
import { handleOffersRoute } from './services/offers';
import { handleProductsRoute } from './services/products';
import { handleProductImagesRoute } from './services/product-images';
import { handleMediaRoute } from './services/media';
import { handlePagesRoute } from './services/pages';
import { handleTemplatesRoute } from './services/templates';

async function firstResponse(promises: Array<() => Promise<Response | null>>) {
  for (const run of promises) {
    const response = await run();
    if (response) return response;
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const path = url.pathname;
      let effectiveReq = req;
      let refreshed: RefreshedSession | null = null;
      const finish = (response: Response) => secure(attachRefreshedSession(response, refreshed));

      if (!path.startsWith('/api/')) {
        return finish(await env.ASSETS.fetch(req));
      }

      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOrigin(req)) {
        return finish(fail('Origem não autorizada', 403, 'ORIGIN'));
      }

      if (path === '/api/health') {
        return finish(ok({
          service: 'sistema-de-catalago',
          version: 'V94',
          database: 'Supabase Postgres',
          storage: 'Supabase Storage',
          d1: false,
          r2: false,
          architecture: 'enterprise-modular',
        }));
      }

      if (path === '/api/auth/status' && req.method === 'GET') {
        const user = await currentUser(effectiveReq, env);
        if (!user) {
          refreshed = await refreshSession(req, env);
          if (refreshed) effectiveReq = refreshed.request;
        }
      }

      const accountResponse = await handleAccountAuth(effectiveReq, env);
      if (accountResponse) return finish(accountResponse);

      const authResponse = await handleCoreAuth(effectiveReq, env, path);
      if (authResponse) return finish(authResponse);

      if (path.startsWith('/api/public/')) {
        const publicResponse = await firstResponse([
          () => handleMediaRoute(effectiveReq, env, path),
          () => handlePublicCatalogRoute(effectiveReq, env, path),
        ]);
        if (publicResponse) return finish(publicResponse);
      }

      if (path.startsWith('/api/admin/')) {
        let membership = await companyMembership(effectiveReq, env);
        if (!membership) {
          refreshed = await refreshSession(req, env);
          if (refreshed) {
            effectiveReq = refreshed.request;
            membership = await companyMembership(effectiveReq, env);
          }
        }
        if (!membership) {
          return finish(fail('Sessão sem acesso ativo a esta empresa', 403, 'COMPANY_FORBIDDEN'));
        }

        const hierarchyResponse = await handleHierarchyRoute(
          effectiveReq,
          env,
          path,
          COMPANY_ID,
          {
            id: String(membership.user?.id || ''),
            role: String(membership.membership?.role || ''),
          },
        );
        if (hierarchyResponse) return finish(hierarchyResponse);

        const adminResponse = await firstResponse([
          () => handleProductImagesRoute(effectiveReq, env, path),
          () => handleMediaRoute(effectiveReq, env, path),
          () => handleBrandImagesRoute(effectiveReq, env, path),
          () => handleCatalogAdminRoute(effectiveReq, env, path),
          () => handleBrandsRoute(effectiveReq, env, path),
          () => handleMarketingRoute(effectiveReq, env, path),
          () => handleOffersRoute(effectiveReq, env, path),
          () => handleProductsRoute(effectiveReq, env, path),
          () => handlePagesRoute(effectiveReq, env, path),
          () => handleTemplatesRoute(effectiveReq, env, path),
        ]);
        if (adminResponse) return finish(adminResponse);
      }

      return finish(fail('Rota não encontrada', 404, 'NOT_FOUND'));
    } catch (error) {
      console.error('Enterprise Worker error', error);
      return secure(fail('Falha interna ao executar a operação', 500, 'INTERNAL'));
    }
  },
};
