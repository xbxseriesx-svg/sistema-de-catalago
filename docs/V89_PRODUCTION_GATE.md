# V89 — Gate obrigatório de produção

A V89 não deve ser promovida apenas porque compila. Antes de merge/deploy, confirmar os itens abaixo no mesmo SHA aprovado.

## GitHub

- PR da V89 com `qa` verde.
- PR da V89 com `e2e` verde.
- `main` protegida contra merge sem status checks/revisão quando a configuração do repositório permitir.
- Nenhum commit novo depois do SHA aprovado sem repetir QA/E2E.

## Cloudflare

- Criar Secret `REMOTE_IMAGE_HMAC_SECRET` com valor aleatório forte e exclusivo.
- Nunca reutilizar `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SDM_BOOTSTRAP_TOKEN` ou chave Google como HMAC.
- Confirmar `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` somente em Secrets, nunca no bundle/repositório.
- Deploy deve usar exatamente o SHA aprovado no PR.

## Supabase

Aplicar na ordem:

1. `20260819170000_v89_protect_page_drafts.sql`
2. `20260819174500_v89_product_media_policy_cleanup.sql`
3. `20260819175500_v89_restrict_page_mutation_rpcs.sql`

Depois executar Security/Performance Advisors e confirmar:

- ausência de leitura `anon` direta em `public.pages`;
- ausência de `product_media_write FOR ALL` sobrepondo SELECT;
- RPCs `create_page_snapshot`, `publish_page` e `restore_page_snapshot` sem EXECUTE para `anon/PUBLIC`;
- habilitar Leaked Password Protection no Supabase Auth quando disponível no painel/Management API.

## Smoke pós-deploy

- `/api/health` responde 200.
- página pública carrega somente conteúdo publicado.
- login SDM/Admin/Editor funciona.
- sessão expirada com refresh válido continua ativa.
- catálogo abre sem tela branca.
- painéis continuam roláveis.
- Marketing abre/edita sem erro JS.
- importação Excel continua preservando códigos/IDs existentes.
- importação de imagens continua vinculando por código.
- busca de logo remota funciona com o novo HMAC dedicado.

Se qualquer item falhar, interromper promoção e manter/retornar ao SHA anterior estável.
