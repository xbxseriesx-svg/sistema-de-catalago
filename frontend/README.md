# ASTERYON Frontend Enterprise

Esta pasta contém o **frontend oficial** do ASTERYON Catálogo em React/TypeScript.

## Runtime

- Fonte: `frontend/src`.
- Entrada HTML: `frontend/index.html`.
- Build: Vite.
- Saída oficial: `frontend/dist`.
- Publicação: feita pelo `wrangler.jsonc` da raiz; o frontend não possui deploy independente.

O antigo `public/` raiz e seus bundles/runtimes versionados não fazem parte do candidato Enterprise.

## Contrato com o backend

O navegador acessa somente rotas same-origin `/api/*` do Worker. Supabase Auth, Postgres e Storage são acessados pelo backend quando a operação exige credenciais privilegiadas. Nenhum service-role/secret é incorporado ao bundle do navegador.

## Editor

O editor preserva:

- Desktop, Tablet e Mobile independentes;
- presets HD, 1440×900, Full HD, 2K e 4K;
- autosave e salvamento manual;
- snapshots, publicação e restauração;
- painéis de Elementos, Camadas, Propriedades, Marketing e ASTERYON AI;
- modelos preenchidos aplicados como documento realmente editável;
- gestão de produtos, hierarquia, marcas, ofertas, marketing e importação de planilhas.

`schemaVersion: 5` é a versão do formato interno do documento editável, não uma versão separada do aplicativo.

## Build local/CI

A partir da raiz do repositório, `npm run prepare:release` executa instalação determinística, QA, TypeScript e build deste SPA. Isoladamente:

```bash
cd frontend
npm ci --ignore-scripts --no-audit --no-fund
npm run qa:enterprise
npm run typecheck
npm run build
```

O build válido precisa gerar `dist/index.html` e não pode criar runtimes paralelos server-side.

## QA

Os E2Es validam o DOM e o estado reais do editor. O runtime oficial não publica variáveis globais ou `dataset` privados apenas para declarar que um teste passou.

A proveniência dos pacotes usados para recuperar a fonte permanece apenas como histórico; ela não define a arquitetura, o entrypoint ou a versão ativa.
