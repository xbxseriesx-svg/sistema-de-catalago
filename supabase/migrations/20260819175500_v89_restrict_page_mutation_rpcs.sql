-- V89 P1: RPCs que alteram páginas não devem ser executáveis por anon/PUBLIC.
-- O Worker já protege as rotas administrativas e estas funções devem ficar
-- disponíveis apenas para sessão autenticada e service_role.

begin;

revoke execute on function public.create_page_snapshot(text, text) from public;
revoke execute on function public.create_page_snapshot(text, text) from anon;
grant execute on function public.create_page_snapshot(text, text) to authenticated;
grant execute on function public.create_page_snapshot(text, text) to service_role;

revoke execute on function public.publish_page(text) from public;
revoke execute on function public.publish_page(text) from anon;
grant execute on function public.publish_page(text) to authenticated;
grant execute on function public.publish_page(text) to service_role;

revoke execute on function public.restore_page_snapshot(text) from public;
revoke execute on function public.restore_page_snapshot(text) from anon;
grant execute on function public.restore_page_snapshot(text) to authenticated;
grant execute on function public.restore_page_snapshot(text) to service_role;

commit;
