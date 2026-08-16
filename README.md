# ASTERYON Catálogo — V63

Versão oficial do catálogo ASTERYON com dados e mídias no **Supabase** e aplicação publicada na **Cloudflare** a partir do repositório GitHub.

## Arquitetura oficial

`GitHub → Supabase → Cloudflare`

- **GitHub**: código, versionamento e QA.
- **Supabase Postgres**: produtos, marcas, departamentos/seções/categorias, marketing, páginas, permissões, snapshots e auditoria.
- **Supabase Storage**: imagens e mídias.
- **Cloudflare Worker + Static Assets**: API, frontend e entrega pública.
- **Cloudflare D1 / R2**: não utilizados.

## Projeto

- Worker: `sistema-de-catalago`
- Supabase Project ID: `bjcfknhiwjxznxydvmzt`
- Entry point: `worker/index-v62.ts`
- Versão da aplicação: `2.1.63`

## Catálogo V63

- O editor **não inicializa mais produtos, marcas ou hierarquia fictícios** do bundle de demonstração.
- Os produtos exibidos vêm do catálogo do Supabase.
- Se a leitura administrativa do catálogo falhar durante a abertura, o frontend tenta o endpoint público do mesmo Supabase em vez de apresentar dados fictícios.
- Todos os departamentos ativos retornados pelo Supabase podem aparecer nos filtros e telas do catálogo; não existe mais limitação fixa a `Atacado` e `Distribuição`.
- O formulário de produto não força `Atacado` quando o departamento não foi resolvido.

## Variáveis e segredos

As credenciais do Supabase usadas pelo Worker permanecem na configuração segura da Cloudflare:

- `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`
- `SDM_BOOTSTRAP_TOKEN`

`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` ficam no `wrangler.jsonc`.

O GitHub Actions é **somente QA** e não depende de `CLOUDFLARE_ACCOUNT_ID` nem `CLOUDFLARE_API_TOKEN`.

## Importação de produtos — Excel

- Validação dos campos obrigatórios.
- Lotes de até 300 produtos por requisição.
- Preservação/atualização pelo código do produto.
- Hierarquia e marcas criadas/vinculadas conforme a planilha.
- Barra de progresso real com quantidade, códigos e produtos do lote em andamento.

## Importação de imagens

- Nome do arquivo = código do produto, por exemplo `318.PNG` → produto `318`.
- Seleção de pasta inteira.
- Conversão WebP no navegador.
- Processamento em pequenos lotes.
- Gravação no bucket `product-images` do Supabase Storage.
- A importação da imagem não altera código, descrição, EAN, preço ou hierarquia.
- Barra informa arquivo, código, produto e etapa atual.

## Validação

```bash
npm ci
npm test
```

O QA da V63 bloqueia regressões de seed fictício e filtros fixos de departamento, além dos testes de TypeScript, Worker, Supabase, importação, marketing, modelo oficial e arquitetura.

## Recuperação

A versão estável anterior às mudanças de importação de imagens permanece em:

`backup/v60-stable-before-images-v61`
