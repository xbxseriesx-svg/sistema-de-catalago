# Baseline Supabase — ASTERYON Catálogo V89

Este diretório é a fotografia reconstruível do schema do projeto Supabase `bjcfknhiwjxznxydvmzt` em 19/08/2026.

Ordem para um projeto Supabase vazio:

1. `001_core.sql` — tabelas, constraints, índices, funções, triggers e buckets.
2. `002_rls.sql` — RLS, policies e grants.
3. Aplicar depois as migrations de `../migrations/` cuja data seja posterior ao baseline.

## Importante

- Estes arquivos **não são migrations de produção** e não devem ser executados sobre o banco atual.
- O banco atual já contém os objetos; as correções incrementais continuam em `supabase/migrations/`.
- O baseline incorpora o estado-alvo V89: `anon` não recebe leitura direta de `public.pages`; `product_media` usa policies separadas de SELECT/INSERT/UPDATE/DELETE; RPCs mutáveis de páginas não são executáveis por `anon/PUBLIC`.
- Dados de negócio, usuários e objetos do Storage não fazem parte do baseline; somente schema/configuração de buckets.

A finalidade é impedir que o repositório dependa de um schema criado manualmente e permitir reconstrução/auditoria do modelo de dados a partir do GitHub.
