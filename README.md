# ASTERYON Catálogo — V62

Versão oficial do catálogo ASTERYON com dados e mídias no **Supabase** e aplicação publicada na **Cloudflare** a partir do repositório GitHub.

## Arquitetura oficial

`GitHub → Supabase → Cloudflare`

Na prática:

- **GitHub**: código-fonte, versionamento e QA automatizado.
- **Supabase Postgres**: produtos, marcas, hierarquia, marketing, páginas, permissões, snapshots e auditoria.
- **Supabase Storage**: imagens novas dos produtos e demais mídias migradas para Storage.
- **Cloudflare Worker + Static Assets**: API, frontend e entrega pública do sistema.
- **Cloudflare D1**: não utilizado.
- **Cloudflare R2**: não utilizado.

## Projeto

- Worker: `sistema-de-catalago`
- Supabase Project ID: `bjcfknhiwjxznxydvmzt`
- Entry point atual: `worker/index-v62.ts`
- Versão: `2.1.62`

## Variáveis e segredos

As credenciais do Supabase usadas pelo Worker devem permanecer na configuração segura da Cloudflare, nunca gravadas no repositório:

- `SUPABASE_SECRET_KEY` — recomendado (`sb_secret_...`)
- ou `SUPABASE_SERVICE_ROLE_KEY` — compatibilidade legada
- `SDM_BOOTSTRAP_TOKEN` — somente para o bootstrap controlado do primeiro SDM

`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` são variáveis públicas de conexão configuradas no `wrangler.jsonc`.

### GitHub Actions

O GitHub Actions é **somente QA**. Ele não faz deploy direto e não depende de:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

A publicação deve ocorrer pela integração do repositório configurada na Cloudflare ao receber atualizações da branch `main`.

## Importação de produtos — Excel

- Valida os campos obrigatórios da planilha.
- Importa em lotes seguros de até 300 produtos por requisição.
- Preserva produtos existentes pelo código.
- Não permite códigos repetidos dentro do mesmo arquivo.
- Cria/vincula hierarquia e marcas quando necessário.
- Exibe barra de progresso com quantidade processada e os códigos/produtos do lote em andamento.

## Importação de imagens

- O nome do arquivo identifica o código do produto. Exemplo: `318.PNG` → produto `318`.
- Aceita seleção de pasta inteira para cargas grandes.
- Converte imagens compatíveis para WebP no navegador antes do envio.
- Processa poucos arquivos simultaneamente para não carregar vários GB em memória.
- Grava a imagem no bucket `product-images` do Supabase Storage.
- Atualiza somente o vínculo de mídia do produto; não altera código, descrição, EAN, preço ou hierarquia.
- Exibe barra de progresso e informa arquivo, código, produto e etapa atual (`Convertendo` / `Enviando`).

## Compatibilidade com mídias antigas

O Worker mantém leitura das mídias legadas enquanto elas são substituídas. Ao importar novamente a imagem de um produto pelo fluxo V62, o vínculo passa a apontar para o Supabase Storage.

## Validação

```bash
npm ci
npm test
```

O QA valida TypeScript, Worker, autenticação Supabase, importação, campos reais da planilha, marketing, modelo oficial, versão, arquitetura e ausência das credenciais antigas de deploy nos workflows.

## Recuperação

A versão estável anterior às mudanças de importação de imagens permanece preservada na branch:

`backup/v60-stable-before-images-v61`
