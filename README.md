# ASTERYON Catálogo — V58

Este repositório contém somente a versão **58** do sistema publicada originalmente na Cloudflare.

## Conteúdo

- `public/`: frontend compilado da V58.
- `worker/`: API do Worker adaptada para Supabase.
- `wrangler.jsonc`: configuração única do Cloudflare Worker.
- `.github/workflows/deploy-v58.yml`: deploy manual validado.

## Arquitetura

`GitHub → Cloudflare Worker + Static Assets → Supabase`

- Worker: `sistema-de-catalago`
- Supabase: `bjcfknhiwjxznxydvmzt`
- D1 e R2 antigos não são utilizados.

## Segredos obrigatórios

Configure na Cloudflare ou no GitHub Actions, sem gravar os valores no código:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SDM_BOOTSTRAP_TOKEN`

Para o workflow do GitHub também são necessários:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Validação

```bash
npm ci
npm run check
npm run deploy:dry
```

A raiz do repositório já está preparada para importação direta em **Workers & Pages → Import repository**.
