# ASTERYON Catálogo — Enterprise

Aplicação de catálogo com frontend React/TypeScript, API em Cloudflare Worker e dados/mídias no Supabase.

## Arquitetura oficial

`GitHub → Supabase → Cloudflare`

- **Frontend oficial:** fonte em `frontend/src`, compilada pelo Vite para `frontend/dist`.
- **Worker oficial:** `worker/app/index.ts`, organizado por domínio em módulos sem sufixos de release.
- **Release:** `wrangler.jsonc`, servindo `frontend/dist` como Static Assets e executando o Worker primeiro para `/api/*`.
- **Banco:** Supabase Postgres.
- **Mídias:** Supabase Storage.
- **Autenticação:** Supabase Auth, mediada pelo Worker e por cookies HTTP-only.
- **D1 / R2:** não utilizados.

## Build e validação

O build oficial é reproduzível a partir do repositório:

```bash
npm ci --ignore-scripts
npm run build
```

`npm run build` reconstrói o frontend, executa o QA Enterprise do SPA, roda TypeScript e gera `frontend/dist` antes da validação do Worker.

Para a regressão completa do candidato:

```bash
npm test
```

O pipeline Enterprise executa seis etapas independentes:

1. arquitetura e governança;
2. build e desenvolvimento;
3. auditoria técnica e segurança;
4. homologação funcional desktop/mobile;
5. auditoria mestra independente;
6. DevOps e release readiness.

O lockfile do frontend é validado separadamente. Um candidato só é considerado pronto quando todos os gates passam no mesmo SHA.

## Frontend

Rotas principais:

- `/` — Editor Visual ASTERYON;
- `/admin` — Gestão do Catálogo e Editor;
- `/catalogo` — catálogo publicado;
- `/auth/confirmar.html` e `/auth/redefinir-senha.html` — fluxos dedicados de conta.

O navegador usa apenas rotas same-origin `/api/*`. Chaves administrativas do Supabase não fazem parte do bundle do frontend.

## Persistência e compatibilidade

O documento editável mantém `schemaVersion: 5`. O adaptador de persistência continua aceitando o formato já armazenado para preservar dados existentes, mas isso não reintroduz runtime, bundle ou Worker histórico no release atual.

## Rollback

O candidato Enterprise não incorpora uma segunda árvore de runtime para rollback. O rollback é comprovado nos gates por checkout isolado do SHA-base da PR/`main` e dry-run do release anterior. Assim a reversibilidade permanece no histórico Git sem duplicar código antigo dentro do candidato.

## Segurança

- APIs administrativas exigem sessão e associação ativa à empresa.
- Mutações same-origin são protegidas contra origem externa.
- O Worker aplica headers de segurança às respostas.
- O frontend não recebe service-role/secret do Supabase.
- SSRF, isolamento por empresa, autenticação, upload de imagens e dependências são cobertos por regressões automatizadas.

A proteção de senhas vazadas do Supabase depende do plano contratado da plataforma e deve ser tratada como configuração externa de hardening quando disponível.

## Versão

A versão lógica continua registrada em `VERSION` e `package.json`. Números de releases anteriores podem aparecer apenas em documentação histórica ou no baseline externo de rollback; não definem o entrypoint, o bundle ou a arquitetura ativa.
