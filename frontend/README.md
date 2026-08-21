# ASTERYON Frontend Enterprise — V94

Esta pasta contém a fonte React/TypeScript recuperada e em reconstrução controlada para substituir o bundle histórico de `public/`.

## Estado atual

- **Ainda não é o frontend de produção.** `public/` continua sendo o rollback funcional durante a transição.
- A versão lógica da aplicação é **V94 / 2.1.94**. O número `schemaVersion: 5` identifica apenas o formato interno do documento editável e não é uma segunda versão da aplicação.
- A persistência do navegador usa somente rotas same-origin `/api/*` do Worker Enterprise.
- O navegador não acessa Supabase Auth, Postgres ou Storage diretamente e não recebe service-role/secret.
- Drafts editados pelo frontend novo são serializados no formato recursivo compatível com V94 para preservar rollback.
- Desktop continua nos campos-base; Tablet e Mobile permanecem independentes.
- Snapshot restore cria um snapshot de segurança antes da restauração.
- O frontend não possui `wrangler.jsonc`, `.env.production` nem script de deploy independente.

## Gate para ativação

A troca do `public/assets/index-V60Excel.js` pelo build desta fonte só poderá ocorrer depois de: build e typecheck reproduzíveis, E2E do frontend candidato, paridade funcional, auditoria de segurança e aprovação das Equipes 0–5 no mesmo SHA.

## Proveniência

A fonte foi recuperada de `asterion-canvas-studio-main(1).zip` e do pacote `asterion-canvas-studio-v5-supabase-cloudflare-ready-2026-08-14.zip`. Arquivos V5 preservados nesta pasta servem apenas como documentação histórica da origem e não definem a versão ativa da aplicação.
