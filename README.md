# ASTERYON Catálogo — V89

Versão oficial do catálogo ASTERYON com dados e mídias no **Supabase** e aplicação publicada na **Cloudflare** a partir do repositório GitHub.

## Arquitetura oficial

`GitHub → Supabase → Cloudflare`

- **GitHub**: código, versionamento, PRs e QA.
- **Supabase Postgres**: produtos, marcas, departamentos/seções/categorias, marketing, páginas, permissões, snapshots e auditoria.
- **Supabase Storage**: imagens e mídias.
- **Cloudflare Worker + Static Assets**: API, frontend e entrega pública.
- **Cloudflare D1 / R2**: não utilizados.

## Projeto

- Worker: `sistema-de-catalago`
- Supabase Project ID: `bjcfknhiwjxznxydvmzt`
- Entry point: `worker/index-v81.ts`
- Release lógica atual: `V89`
- Versão da aplicação: `2.1.89`

O nome físico `index-v81.ts` é preservado por compatibilidade/histórico. A versão funcional da aplicação é definida por `VERSION`, `package.json`, `/api/health` e esta documentação; esses pontos devem permanecer alinhados.

## V89 — segurança, sessão, banco e QA

A V89 consolidou a auditoria de segurança e persistência sem reescrever o frontend e sem criar uma nova cadeia de runtimes.

Principais pontos:

- HMAC de imagens remotas usa `REMOTE_IMAGE_HMAC_SECRET`, separado das chaves administrativas do Supabase.
- Download remoto de logos valida HTTPS, DNS A/AAAA, endereços não públicos, redirects, MIME, assinatura e limite de tamanho.
- Sessão pode renovar access token expirado por refresh token válido.
- Leitura direta anônima de drafts em `public.pages` foi removida.
- RPCs mutáveis de snapshot/publicação/restauração são restritas a papéis autenticados/service role.
- Policies de `product_media` são separadas por operação.
- Baseline do Supabase está versionado em `supabase/baseline/` e alterações posteriores são migrations incrementais.
- QA inclui TypeScript, Wrangler dry-run, regressões Node e Playwright em desktop/mobile.
- A rodada funcional V89 adiciona regressão para impedir leitura anônima direta entre tenants nas tabelas públicas servidas pelo Worker.

## Catálogo e dados reais

- O editor não deve inicializar produtos, marcas ou hierarquia fictícios do bundle de demonstração.
- Os produtos exibidos vêm do Supabase através das APIs do Worker.
- Busca pública, popups públicos e catálogo utilizam `/api/public/*`.
- O Worker aplica o escopo da empresa oficial antes de consultar o Supabase.
- Todos os departamentos ativos retornados pela empresa correta podem aparecer nos filtros e telas do catálogo.
- O formulário de produto não força um departamento padrão quando o vínculo não foi resolvido.

## Páginas, draft e publicação

- O editor trabalha em `draft_nodes`.
- O site público deve utilizar somente `published_nodes`.
- `publish_page` publica o draft corrente sob lock de revisão e registra a publicação.
- `create_page_snapshot` salva o estado do draft.
- `restore_page_snapshot` restaura somente o draft e cria um snapshot de segurança antes da restauração; não publica automaticamente.
- Escritas concorrentes de página utilizam revisão esperada e podem retornar `409 REVISION_CONFLICT` quando a revisão enviada estiver desatualizada.

## Editor e responsividade

A aplicação usa um único layout com geometria responsiva.

### Breakpoints públicos

- **Mobile:** até `767px`.
- **Tablet:** de `768px` até `1100px`.
- **Desktop:** acima de `1100px`.

### Comportamento

- Em desktop, os painéis laterais permanecem visíveis.
- Em tablet e celular, os mesmos painéis do editor viram drawers.
- Uma barra flutuante permite abrir **Painel** e **Propriedades** em telas menores.
- Backdrop e `Esc` fecham drawers.
- Imagens, vídeos e canvas respeitam os limites do container.
- O zoom do usuário não é bloqueado.
- Catálogo e modal de produto possuem rolagem interna e controles de fechamento acessíveis.

## Marketing

O estado de Marketing é persistido no Supabase e inclui:

- tema;
- banner;
- vídeo;
- carrossel;
- layout/posição/tamanho/z-index/visibilidade;
- itens vinculados a produtos e marcas quando aplicável.

Mudanças de Marketing devem ser validadas por persistência real e recarga; teste apenas mockado não é evidência funcional suficiente.

## Templates

A biblioteca mantém os modelos históricos e o **Modelo Oficial**. A funcionalidade de preview completo introduzida na V69 continua utilizando `/api/public/catalog` como fonte de dados. Aplicar um template deve resultar em elementos editáveis no canvas; o preview não cria um fluxo paralelo de catálogo/produto.

A identidade visual Laurencini introduzida nas V68/V69 permanece como parte do comportamento histórico dos modelos existentes.

## Importação de produtos — Excel

O fluxo atual contempla:

- validação dos campos obrigatórios;
- lotes de até 300 produtos por requisição;
- preservação/atualização pelo código do produto;
- criação/vínculo de hierarquia e marcas conforme a planilha;
- preservação de dados não fornecidos na atualização, inclusive mídia quando o Excel não a substitui;
- barra de progresso por lote.

A aprovação funcional do importador exige importação pelo navegador e conferência posterior no Supabase; parser ou teste Node isolado não bastam.

## Importação de imagens

- Nome do arquivo identifica o código do produto.
- Seleção pode processar múltiplos arquivos.
- O navegador converte para WEBP quando o fluxo exigir.
- O Worker grava no bucket `product-images` do Supabase Storage.
- O vínculo de mídia utiliza `media_assets`/`product_media` e campos de imagem/galeria do produto.
- A importação da imagem não deve alterar código, descrição, EAN, preço ou hierarquia.

A aprovação funcional exige arquivo → navegador → Storage → banco → recarga → site público.

## Variáveis e segredos

Credenciais administrativas permanecem nos Secrets da Cloudflare:

- `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`
- `SDM_BOOTSTRAP_TOKEN`
- `REMOTE_IMAGE_HMAC_SECRET`
- `GOOGLE_CSE_API_KEY`, quando configurada

`REMOTE_IMAGE_HMAC_SECRET` deve ser aleatório e exclusivo; não reutilizar chave administrativa do Supabase, bootstrap token ou chave Google.

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e configurações públicas ficam no `wrangler.jsonc` conforme o ambiente.

## Supabase e migrations

- `supabase/baseline/001_core.sql`: baseline estrutural.
- `supabase/baseline/002_rls.sql`: baseline de RLS/policies/grants.
- `supabase/migrations/`: mudanças incrementais posteriores.

Nunca aplicar o baseline sobre uma produção existente para “sincronizar” o banco. Produção só recebe migrations incrementais revisadas.

## QA e validação

```bash
npm ci
npm test
```

O QA da V89 valida, entre outros pontos:

- TypeScript;
- Worker/Wrangler dry-run;
- autenticação e refresh;
- importação e colunas do Excel;
- Marketing;
- páginas/snapshot/publicação;
- catálogo público;
- modais e responsividade;
- pesquisa/importação de logos e proteção SSRF;
- baseline Supabase;
- isolamento de acesso anônimo;
- coerência de versionamento.

Há também Playwright para smoke visual em desktop/mobile. Testes mockados permanecem úteis para regressão de UI, mas não substituem E2E funcional com persistência real.

## Produção

Fluxo esperado:

`main → branch de correção → QA → E2E → revisão → PR → CI verde → merge → deploy → smoke de produção`

Não promover uma alteração apenas porque compila. O SHA publicado deve corresponder ao SHA aprovado.

## Recuperação

A base anterior à V89 permanece no histórico Git. A branch histórica `backup/v60-stable-before-images-v61` também continua disponível para investigação de regressões antigas de importação de imagens; ela não representa a release atual.
