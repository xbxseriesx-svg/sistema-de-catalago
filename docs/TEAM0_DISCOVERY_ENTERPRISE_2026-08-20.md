# Equipe 0 — Descoberta, Governança e Arquitetura

Data: 2026-08-20
Branch de trabalho: `enterprise/6-equipes-consolidacao`
Base de produção observada: V94
Issue de governança: #31

## 1. Resultado executivo

A arquitetura funcional atual foi mapeada em nível suficiente para iniciar reconstrução controlada por domínio, mas **não para executar limpeza destrutiva do frontend**.

A aplicação está funcionalmente dividida em três blocos principais:

1. Cloudflare Worker + Static Assets;
2. Supabase Postgres/Auth/Storage;
3. frontend compilado com múltiplos runtimes e patches históricos.

O maior débito estrutural confirmado é a convivência de versões em runtime e build. A release lógica é V94, mas backend e frontend continuam dependendo de componentes nomeados e encadeados de releases anteriores.

A estratégia aprovada pela Equipe 0 é substituir por domínio, com testes de equivalência, e só então remover o legado.

## 2. Inventário de infraestrutura

### GitHub

Repositório: `xbxseriesx-svg/sistema-de-catalago`
Branch principal: `main`
Branch de consolidação: `enterprise/6-equipes-consolidacao`

Permissões verificadas no conector:

- admin;
- maintain;
- push;
- pull;
- triage.

### Cloudflare

Configuração versionada em `wrangler.jsonc`:

- Worker: `sistema-de-catalago`;
- entrypoint atual: `worker/index-v81.ts`;
- Static Assets: `./public`;
- `/api/*` executa Worker antes dos assets;
- observabilidade habilitada;
- workers.dev habilitado.

Produção registrada pelo próprio repositório:

`https://sistema-de-catalago.xbxseriesx.workers.dev`

A evidência gravada em `docs/production-v94-live-verified.txt` declara health V94 e runtime V94 confirmado em 2026-08-20.

Limitação da auditoria atual: não há conector Cloudflare disponível nesta sessão. Portanto a configuração do dashboard/secrets não pode ser tratada como diretamente inspecionada; apenas a configuração versionada e evidências registradas no GitHub são consideradas confirmadas.

### Supabase

Project ID: `bjcfknhiwjxznxydvmzt`
Nome: `sistema-de-catalago`
Região: `sa-east-1`
Status verificado: `ACTIVE_HEALTHY`
PostgreSQL: 17

Arquitetura oficial confirmada:

`GitHub → Supabase → Cloudflare`

D1 e R2 não fazem parte da arquitetura atual.

## 3. Banco de dados — inventário atual

Tabelas de negócio do schema `public` verificadas:

- `app_config`;
- `audit_logs`;
- `brands`;
- `catalog_settings`;
- `companies`;
- `company_memberships`;
- `editor_settings`;
- `hierarchy_nodes`;
- `marketing_settings`;
- `media_assets`;
- `offer_products`;
- `offers`;
- `page_publications`;
- `page_snapshots`;
- `pages`;
- `product_media`;
- `products`;
- `profiles`;
- `templates`.

### Fotografia de volume observada

Valores estimados pelo PostgreSQL no momento da auditoria:

- produtos: ~2.513;
- marcas: ~260;
- hierarquia: ~58;
- templates: 8;
- media_assets: ~2.413;
- product_media: ~2.337;
- audit_logs: ~6.471;
- page_publications: ~67;
- page_snapshots: ~15.

Esses valores são fotografia operacional, não limites do sistema.

### RLS

As 19 tabelas de negócio do schema `public` estão com RLS habilitado.

Políticas verificadas incluem controles para:

- membership por empresa;
- editor/admin;
- owner/admin;
- leitura pública de produtos ativos;
- leitura pública de marcas ativas;
- leitura pública de hierarquia ativa;
- ofertas publicadas/vigentes;
- páginas/snapshots/publicações;
- mídia vinculada a produto;
- isolamento por `company_id`.

Funções privadas usadas por RLS:

- `private.is_company_member`;
- `private.can_edit_company`;
- `private.can_admin_company`.

As três usam `SECURITY DEFINER` e deverão ser auditadas pela Equipe 2 quanto a `search_path`, grants e bypass indevido.

### Storage

Buckets existentes:

- `product-images` — público — imagens;
- `brand-media` — público — imagens;
- `marketing-media` — público — imagens/vídeos;
- `catalog-files` — público — PDF.

Existem policies de escrita/leitura autenticada com caminho associado à empresa e uma policy de leitura pública dos quatro buckets.

Ponto de revisão Equipe 2: confirmar que todos os objetos de `catalog-files` e demais buckets são por definição públicos. Não classificar como vulnerabilidade antes de confirmar requisito de negócio.

### Advisor Supabase

Performance: nenhum aviso retornado.

Segurança: aviso ativo `auth_leaked_password_protection` — proteção contra senha vazada está desabilitada.

Classificação: melhoria de segurança recomendada. Não altera código automaticamente nesta etapa porque envolve configuração do Auth e deve passar por validação de login/bootstrap.

## 4. Backend — mapa de dependências

Cadeia atualmente ativa a partir do Wrangler:

`worker/index-v81.ts`
→ `worker/index-v71.ts`
→ `worker/index-v72.ts`
→ `worker/index-v70.ts`
→ `worker/index-v62.ts`
→ `worker/index-v61.ts`
→ `worker/index.ts`

Módulo adicional ativo:

- `worker/modules/hierarchy-v89.ts` importado por `index-v81.ts`.

Módulo adicional de Auth:

- `worker/auth-account-v89.ts` importado por `index-v71.ts`.

Conclusão: a release V94 depende funcionalmente de pelo menos sete camadas históricas de Worker. Pela política de versão única, isso é legado ativo a consolidar.

## 5. Backend — responsabilidades mapeadas

### `worker/index.ts`

É o núcleo funcional antigo e contém:

- Auth status/bootstrap/login/logout;
- acesso a Supabase/PostgREST;
- membership e roles;
- auditoria;
- catálogo público/admin;
- produtos;
- importação em lote;
- criação automática de departamentos/seções/categorias;
- marcas;
- marketing;
- ofertas;
- páginas/draft;
- snapshots;
- versões/publicações;
- rollback;
- templates;
- mídia legada;
- segurança básica de origem e headers;
- entrega de Static Assets.

### `worker/index-v61.ts`

Adiciona fluxo atual de imagens de produto:

- importação binária;
- formatos suportados;
- upload Supabase Storage;
- vínculo `media_assets`;
- vínculo `product_media`;
- atualização do produto;
- auditoria;
- compatibilidade com endpoint antigo `/api/admin/media`;
- redirect de mídia pública quando existe `public_url`.

### `worker/index-v62.ts`

Adiciona health metadata V62 e delega todo restante.

### `worker/index-v70.ts`

Adiciona busca/importação de logo de marca e proteção SSRF mais robusta:

- Google CSE;
- Wikimedia;
- validação HTTPS;
- bloqueio IPv4/IPv6 não público;
- validação DNS via Cloudflare DNS over HTTPS;
- assinatura HMAC de URL remota;
- limite de redirects;
- validação de MIME/magic bytes;
- upload de logo para Storage;
- atualização de `brands`/`media_assets`;
- auditoria.

### `worker/index-v72.ts`

Adiciona busca alternativa de imagens de marca via DuckDuckGo e fallback para cadeia anterior.

### `worker/index-v71.ts`

Intercepta fluxo de conta/autenticação complementar em `auth-account-v89.ts` e delega o restante.

### `worker/index-v81.ts`

É o entrypoint configurado atualmente.

Adiciona:

- headers CSP/HSTS adicionais;
- refresh de sessão;
- membership para rotas admin;
- proteção de writes por `company_id`;
- CRUD de hierarquia V89;
- normalização canônica de marcas;
- filtro público de hierarquia/ofertas;
- health V94.

Conclusão: a lógica nova existe, mas está distribuída em wrappers de versões diferentes. A reconstrução deve separar por domínio, não apenas juntar tudo em um arquivo gigante.

## 6. Rotas/API identificadas

### Auth

- `GET /api/auth/status`
- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- rotas complementares de conta em `auth-account-v89.ts`

### Público

- `GET /api/public/catalog`
- `GET /api/public/brands`
- `GET /api/public/marketing`
- `GET /api/public/media/:id`
- `GET /api/public/pages/:slug`

### Catálogo administrativo

- `GET /api/admin/catalog`
- `PUT /api/admin/catalog/settings`
- `POST /api/admin/catalog/products/bulk`
- `PUT|DELETE /api/admin/products/:id`

### Marcas

- `GET /api/admin/brands`
- `POST /api/admin/brands`
- `POST /api/admin/brands/bulk`
- `PUT|DELETE /api/admin/brands/:id`
- `GET /api/admin/brand-images/search`
- `GET /api/admin/brand-images/fetch`
- `POST /api/admin/brand-images/upload`

### Imagens de produto/mídia

- `POST /api/admin/product-images/import`
- `POST /api/admin/media`
- `DELETE /api/admin/media/:id`

### Hierarquia

- `POST /api/admin/hierarchy`
- `PUT|DELETE /api/admin/hierarchy/:id`
- rotas adicionais tratadas por `worker/modules/hierarchy-v89.ts`.

### Marketing

- `GET /api/admin/marketing`
- `PUT /api/admin/marketing`

### Ofertas

- `GET /api/admin/catalog/offers`
- `POST /api/admin/catalog/offers`
- `PUT|DELETE /api/admin/catalog/offers/:id`

### Páginas

- `GET|PUT /api/admin/pages/:slug/draft`
- snapshots;
- publicação;
- versions;
- rollback.

### Templates

- `GET /api/admin/templates`
- `POST /api/admin/templates/seed`
- `PUT|DELETE /api/admin/templates/:id`

## 7. Frontend — estado arquitetural

### Fato principal

Não existe uma árvore `src/` de frontend no repositório atual.

O frontend oficial é baseado em:

- bundle compilado `public/assets/index-V60Excel.js`;
- CSS compilado;
- scripts independentes em `public/`;
- scripts `patch-*` que modificam bundle/HTML;
- loader contextual.

### `public/index.html` V94 carrega diretamente

- `resolved-template-v90.js`;
- `preview-editor-v91-core.js`;
- `preview-editor-v93-source.js`;
- `preview-editor-v91-capture.js`;
- `preview-editor-v91-runtime.js`;
- `preview-editor-v91-guard.js`;
- `preview-editor-v92-team4.js`;
- `preview-editor-v93-visual-gate.js`;
- `preview-editor-v93-team4.js`;
- `editor-runtime-v87.js`;
- bundle `assets/index-V60Excel.js`;
- `runtime-loader-v87.js`.

O próprio manifesto do HTML referencia ainda recursos V62–V83.

Conclusão: a release lógica V94 é uma composição runtime de várias gerações.

## 8. Build atual

`package.json` declara release `2.1.94`.

`npm run prepare:bundle` executa:

1. `scripts/sync-release-metadata-v94.mjs`;
2. `scripts/prepare-bundle-v81.mjs`.

`prepare-bundle-v81.mjs` modifica/valida o bundle `public/assets/index-V60Excel.js` e executa uma cadeia de patches de várias gerações, incluindo funções originadas em V60, V64, V65, V67, V68, V81, V86, V89, V92 e V93.

Classificação: mecanismo de build legado ativo.

Regra da reconstrução: a nova fonte não poderá depender de patching de bundle minificado como etapa normal de desenvolvimento.

## 9. Testes

O `npm test` atual cobre grande quantidade de regressões históricas e segurança.

E2E identificados:

- `auth-account-pages.spec.mjs`;
- `editor-functional-regressions.spec.mjs`;
- `editor-smoke.spec.mjs`;
- `preview-editor-team4-v92.spec.mjs`;
- `preview-editor-v93-filled-source.spec.mjs`.

Problema estrutural: parte dos testes está nomeada e acoplada a releases antigas.

Plano: preservar comportamento coberto, mas migrar os nomes/contratos para testes funcionais independentes de VXX.

## 10. GitHub Actions

Workflows coexistentes identificados:

- QA produto V61;
- QA catálogo V93;
- QA catálogo V94.

O workflow V94 contém:

- Grupos 1/2;
- Grupo 3;
- Grupo 4.

Os runs observados no commit V94 concluíram com sucesso.

Não existe ainda gate formal de seis equipes.

Conclusão: a Equipe 5 deverá substituir os workflows históricos por pipeline único após equivalência comprovada. Os workflows antigos não serão apagados antes disso.

## 11. Não conformidades confirmadas

### NC-01 — versão lógica e arquitetura física divergentes

Severidade: alta de governança.

V94 depende de Worker V81/V71/V72/V70/V62/V61/core.

### NC-02 — frontend sem fonte de desenvolvimento atual

Severidade: crítica arquitetural.

O repositório contém bundle compilado + patches, mas não fonte frontend equivalente e reproduzível.

### NC-03 — patching de bundle minificado como mecanismo de build

Severidade: alta.

A cadeia de patches é funcionalmente necessária hoje.

### NC-04 — múltiplos runtimes históricos carregados pelo HTML V94

Severidade: alta de manutenção/regressão.

### NC-05 — workflows históricos coexistentes

Severidade: média.

### NC-06 — gate formal ainda não possui as seis equipes

Severidade: alta de governança.

### NC-07 — leaked password protection desabilitado

Severidade: média de hardening Auth, sujeita a validação funcional.

### NC-08 — storage público precisa de confirmação de requisito

Severidade: revisão necessária; não classificada como vulnerabilidade até confirmação do requisito de catálogo público.

### NC-09 — `COMPANY_ID = cmp_asteryon` aparece fixo em várias camadas do Worker

Severidade: média/alta para arquitetura multi-tenant futura.

A RLS é multi-company, mas o Worker atual direciona o catálogo principal explicitamente para `cmp_asteryon`. Isso pode ser intencional para este projeto; a Equipe 1 não deve alterar sem contrato claro.

## 12. Estratégia de reconstrução aprovada

A reconstrução será incremental por domínio, porém resultará em uma única arquitetura.

### Fase A — Backend fonte única

Criar estrutura sem números de versão, por exemplo:

- `worker/index.ts` — entrypoint final;
- `worker/env.ts`;
- `worker/http/security.ts`;
- `worker/auth/*`;
- `worker/db/*`;
- `worker/routes/public/*`;
- `worker/routes/admin/*`;
- `worker/services/products/*`;
- `worker/services/brands/*`;
- `worker/services/media/*`;
- `worker/services/pages/*`;
- `worker/services/templates/*`;
- `worker/services/marketing/*`;
- `worker/services/offers/*`;
- `worker/services/hierarchy/*`.

Primeiro reproduzir contratos atuais. Depois apontar Wrangler para o novo entrypoint. Só após Equipes 2/3/4 aprovarem, remover a cadeia `index-vXX`.

### Fase B — Frontend fonte editável

Criar projeto fonte reproduzível, preservando exatamente os contratos visuais e funcionais atuais.

Obrigatório migrar por função:

- autenticação;
- shell/editor;
- canvas;
- componentes editáveis;
- propriedades;
- modelos;
- Preview preenchido → Editor;
- produtos/marcas/hierarquia;
- marketing;
- importadores;
- publicação/snapshot/rollback;
- catálogo público/modais;
- responsividade.

O bundle antigo continuará somente como referência/rollback até a nova fonte passar equivalência.

### Fase C — Pipeline de seis gates

Pipeline futuro:

1. Equipe 0 — invariantes/arquitetura/versionamento;
2. Equipe 1 — build/unit/component;
3. Equipe 2 — auditoria técnica/security/static;
4. Equipe 3 — E2E funcional/UX;
5. Equipe 4 — repetição independente/stress/negativos;
6. Equipe 5 — dry-run/deploy readiness/artefatos/rollback.

### Fase D — limpeza

Somente quando backend e frontend novos estiverem aprovados:

- remover imports `index-vXX`;
- remover runtimes substituídos;
- remover patches substituídos;
- remover bundle antigo da rota ativa;
- remover workflows históricos substituídos;
- atualizar README/versionamento;
- provar que produção não carrega recurso antigo.

## 13. Plano de rollback

Até a promoção final:

- `main` V94 permanece referência de produção;
- a reconstrução ocorre em branch isolada;
- nenhuma migration destrutiva será aplicada durante a fase de equivalência;
- mudanças de banco serão aditivas/reversíveis quando necessárias;
- o entrypoint antigo permanece disponível até gate final;
- em falha de homologação, não há promoção;
- após promoção, rollback deve poder retornar ao último commit aprovado e ao último estado de banco compatível.

## 14. Critérios de aceite da Equipe 0 para iniciar Equipe 1

Aprovados para **iniciar reconstrução do backend**:

- cadeia de Worker identificada;
- responsabilidades por camada identificadas;
- rotas principais identificadas;
- Supabase/tabelas/RLS/Storage identificados;
- build/testes/workflows identificados;
- risco/rollback definidos.

Ainda bloqueados para **remoção do frontend legado**:

- fonte frontend atual inexistente no repositório;
- necessidade de reconstrução e equivalência completa antes da remoção.

## 15. Decisão da Equipe 0

**APROVADO iniciar Equipe 1 em branch isolada para consolidação do backend e preparação da nova fonte frontend.**

**NÃO APROVADO apagar componentes V59–V94 neste momento.**

A limpeza só será autorizada após prova de substituição e aprovação das Equipes 2, 3, 4 e 5.
