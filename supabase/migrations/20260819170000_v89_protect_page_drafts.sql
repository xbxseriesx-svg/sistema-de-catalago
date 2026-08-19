-- V89 P0: impedir que o papel anon consulte a tabela pages diretamente.
-- A tabela contém draft_nodes e published_nodes na mesma linha; RLS por linha
-- não consegue esconder somente draft_nodes. O catálogo público deve consumir
-- a rota do Worker, que seleciona exclusivamente published_nodes.

begin;

drop policy if exists pages_public_select on public.pages;
revoke select on table public.pages from anon;

commit;
