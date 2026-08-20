-- V89 rodada funcional 2
-- Causa raiz: as policies public_* permitiam ao papel anon enumerar dados ativos
-- de qualquer company_id diretamente pelo Data API. O site público conhecido usa
-- o Worker (/api/public/*), que aplica COMPANY_ID e usa credencial administrativa.
-- Mantemos authenticated/service_role intactos e removemos somente o privilégio
-- de SELECT direto do papel anon nas tabelas públicas expostas pelo Worker.

begin;

revoke select on table
  public.products,
  public.brands,
  public.hierarchy_nodes,
  public.offers,
  public.marketing_settings,
  public.catalog_settings
from anon;

commit;
