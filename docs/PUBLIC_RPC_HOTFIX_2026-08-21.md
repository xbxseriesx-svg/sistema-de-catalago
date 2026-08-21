# Hotfix público por RPC — 2026-08-21

## Sintoma

O modo público carregava a UI V94, mas caía na mensagem `Falha interna ao executar a operação`.

## Evidência

Os logs reais do Supabase mostraram 401 nas leituras anônimas diretas de `products`, `brands`, `hierarchy_nodes`, `offers`, `catalog_settings` e `marketing_settings`, enquanto as mesmas áreas autenticadas continuavam retornando 200.

As policies RLS públicas existiam, porém o papel `anon` não possuía `SELECT` direto nessas tabelas. Não foi concedido `GRANT SELECT` amplo, pois isso poderia expor colunas além do contrato público.

## Correção

O Worker passou a usar os RPCs já existentes e filtrados:

- `public.get_public_catalog()` -> `private.get_public_catalog_data()`
- `public.get_public_site(page_slug)` -> `private.get_public_site_data(page_slug)`

As funções privadas são `SECURITY DEFINER`, retornam somente o conjunto público previsto e podem ser executadas pelo papel `anon`. O vínculo `offer_products`, que já possui SELECT público com RLS apropriado, permanece consultado diretamente.

O caminho administrativo continua inalterado e autenticado. A UI `public/` V94 também permanece inalterada.

## Prova no banco

Executando como role `anon`, os RPCs retornaram o catálogo público corrente (2.513 produtos, 259 marcas, 58 nós de hierarquia) e os objetos de página/marketing sem necessidade de abrir SELECT direto nas tabelas principais.

## Segurança

- nenhuma tabela principal ganhou novo GRANT para `anon`;
- nenhuma service-role foi enviada ao navegador;
- `SUPABASE_ANON_KEY` legado não é necessário para este hotfix;
- o Worker continua usando somente `SUPABASE_PUBLISHABLE_KEY` no caminho público;
- o gate Enterprise passa a exigir os RPCs públicos filtrados e a impedir regressão para leitura anônima direta das tabelas principais.
