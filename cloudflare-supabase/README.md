# ASTERYON Catálogo — Cloudflare + Supabase

Compatibilidade da versão publicada Cloudflare `cde35de1` (versão 58), com o
frontend preservado byte a byte e a API migrada de D1 para Supabase Postgres.

## Arquitetura

- Cloudflare Workers Static Assets: frontend V5 publicado.
- Cloudflare Worker: camada compatível `/api/*`.
- Supabase Postgres: dados do catálogo, editor, histórico e mídias legadas.
- Supabase Auth: usuários e sessões novas.
- D1 e R2: desativados.

## Segredos obrigatórios no Cloudflare

- `SUPABASE_SERVICE_ROLE_KEY`: chave secreta do projeto Supabase.
- `SDM_BOOTSTRAP_TOKEN`: token temporário para criar o primeiro administrador.

Nunca grave esses valores no GitHub. O workflow recebe os segredos do GitHub
Actions e os publica como Worker Secrets durante o deploy.

## Validação local

```bash
npm ci
npm run check
npm run deploy:dry
```
