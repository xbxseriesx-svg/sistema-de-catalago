# ASTERYON Catálogo — limpeza final Enterprise

Data: 2026-08-21

## Baseline comprovado

O SHA `9065b73d8fb7abef582c70ed9abb63e823462477` passou simultaneamente pelo gate Enterprise de 6 Equipes, QA V92, QA V93, QA V94 e validação determinística do lockfile do frontend.

Esse SHA é o ponto comprovado de equivalência antes da remoção física do legado no branch `enterprise/6-equipes-consolidacao`.

## Regra do candidato final

O candidato Enterprise não deve carregar runtime, bundle, Worker, patch ou configuração de rollback histórica. O runtime oficial é exclusivamente:

- Worker: `worker/app/index.ts` e seus módulos sem sufixo de release;
- Frontend: fonte em `frontend/src` construída deterministicamente para `frontend/dist`;
- Release: `wrangler.jsonc`, servindo `frontend/dist` e executando o Worker modular para `/api/*`.

A compatibilidade de formato de documentos persistidos não é considerada runtime legado: o adaptador de documento continua aceitando o formato anteriormente armazenado para evitar perda de dados durante a migração.

## Rollback

O rollback não fica mais incorporado ao candidato. As Equipes 2 e 5 devem fazer checkout isolado do SHA-base da PR (ou `main` em execução manual), instalar suas dependências e executar o dry-run do release anterior sem publicar. Dessa forma, o rollback permanece verificável pelo histórico Git sem manter código antigo ativo ou duplicado dentro do candidato Enterprise.

## Critério de liberação

Após esta limpeza, todas as 6 Equipes devem ser executadas novamente sobre o mesmo SHA final. A PR continua Draft e não deve ser mergeada/publicada enquanto qualquer etapa estiver vermelha ou enquanto existir pendência de segurança não tratada.
