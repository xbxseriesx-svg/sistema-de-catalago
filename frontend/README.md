# ASTERYON Frontend — recuperação de fonte Enterprise

Esta pasta inicia a substituição controlada do frontend legado compilado (`public/assets/index-V60Excel.js` + runtimes versionados) por uma fonte React/TypeScript editável e reproduzível.

## Origem

- Fonte original: `asterion-canvas-studio-main(1).zip`.
- Base consolidada recuperada: `asterion-canvas-studio-v5-supabase-cloudflare-ready-2026-08-14.zip`.
- Referência funcional histórica do pacote V5: `ee9420f97299b6b95586389f3a2aae9f1afd5962`.
- Recuperação iniciada em 2026-08-20 depois da aprovação do backend modular pelo Framework Enterprise de 6 Equipes no SHA `1110d9673cde5c1af952a900addb4945b4aed560`.

## Estado

**NÃO É AINDA O FRONTEND DE PRODUÇÃO.**

O frontend entregue continua em `public/` até esta fonte atingir paridade funcional e passar novamente pelas 6 Equipes. Não remover o bundle/runtimes históricos antes desse gate.

## Regras da consolidação

1. `Desktop` continua sendo a fonte única de posição/tamanho base.
2. `Tablet` e `Mobile` permanecem independentes.
3. Preservar “Aplicar ajuste atual em todos os modos”.
4. Preservar 1366×768, 1440×900, Full HD, 2K e 4K.
5. Preservar autosave de aproximadamente 850 ms, Ctrl+S e salvar manual.
6. Preservar snapshots, publicação e rollback real.
7. Marketing deve permanecer visível, movível, redimensionável, editável e excluível no Editor.
8. Imagens devem usar `object-contain` onde o requisito é não cortar/zoomar.
9. Preview final preenchido deve continuar sendo a fonte do conteúdo aplicado ao Editor.
10. Não criar novas camadas `vXX`/hotfix como arquitetura permanente.

## Migração de segurança obrigatória

O pacote V5 recuperado fazia algumas operações diretamente no Supabase pelo navegador. Isso é somente referência histórica. Antes da ativação desta fonte:

- autenticação deve usar `/api/auth/*` do Worker Enterprise;
- draft/snapshot/publish/rollback devem usar `/api/admin/pages/*`;
- mídia deve usar `/api/admin/media` e `/api/admin/product-images/import`;
- catálogo público deve usar `/api/public/*`;
- o navegador não deve receber service-role/secret e não deve contornar o gate de tenant do Worker.

A troca de `public/` pelo build desta pasta somente será permitida após Equipes 0–5 verdes no mesmo SHA.
