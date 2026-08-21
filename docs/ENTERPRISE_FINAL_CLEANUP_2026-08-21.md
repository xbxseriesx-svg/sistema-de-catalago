# ASTERYON Catálogo — limpeza final Enterprise

Data: 2026-08-21

## Baseline comprovado

A migração foi executada por checkpoints. Antes da remoção física do legado, um SHA de referência passou simultaneamente pelos gates Enterprise e regressões históricas. Depois da remoção, o candidato voltou a passar pelas 6 Equipes com rollback reconstruído a partir do SHA-base em checkout isolado.

## Runtime final do candidato

O candidato Enterprise não carrega runtime, bundle, Worker, patch ou configuração de rollback histórica. O runtime oficial é exclusivamente:

- Worker: `worker/app/index.ts` e seus módulos sem sufixo de release;
- Frontend: fonte em `frontend/src`, construída deterministicamente para `frontend/dist`;
- Release: `wrangler.jsonc`, servindo `frontend/dist` e executando o Worker modular para `/api/*`.

A compatibilidade de formato dos documentos persistidos continua no adaptador de documento para evitar perda de dados durante a migração. Compatibilidade de dados não é uma segunda árvore de runtime.

## Rollback

O rollback não fica incorporado ao candidato. As Equipes 2 e 5 fazem checkout isolado do SHA-base da PR (ou `main` em execução manual), instalam as dependências desse baseline e executam o dry-run do release anterior sem publicar. Assim a reversibilidade permanece verificável pelo histórico Git sem manter código antigo duplicado dentro do candidato.

## Incidente de build/preview de 21/08/2026

Durante a limpeza dos rótulos de releases históricas, o Toolbar passou corretamente de `ASTERYON V94` para `ASTERYON`, mas o QA do frontend ainda exigia o texto antigo. O build da Cloudflare abortava em `frontend/scripts/qa-enterprise.mjs` antes da geração/publicação do candidato, deixando o preview indisponível e apresentando HTTP 503 na interface de publicação.

A correção foi feita no contrato do QA — não revertendo o frontend. O QA passou a exigir a identidade estável `ASTERYON` e a rejeitar o retorno de marcadores/rótulos privados de releases antigas. Uma segunda referência `ASTERYON V94` na rota raiz também foi removida. Em seguida o Git Integration da Cloudflare registrou deployment bem-sucedido do candidato e o `npm test` completo voltou a passar.

A homologação encontrou ainda um E2E mobile que procurava os antigos seletores `#laurencini-template-preview-v69` e `.ltp-shell`; o teste foi alinhado aos seletores estáveis atuais `#asteryon-template-preview` e `.asteryon-template-preview-shell`, sem alterar a funcionalidade do aplicativo.

## Critério de liberação

Toda alteração posterior invalida a aprovação anterior. O SHA final só pode ser considerado pronto se, no mesmo commit:

1. Frontend Lockfile Validation estiver verde;
2. Equipes 0–5 estiverem verdes;
3. o build/deploy de preview da Cloudflare estiver bem-sucedido;
4. o candidato continuar sem runtime/build legado físico;
5. o rollback do SHA-base continuar provado por dry-run isolado.

A PR permanece Draft e não deve ser mergeada em `main` ou promovida a produção enquanto qualquer uma dessas condições estiver incompleta ou vermelha.
