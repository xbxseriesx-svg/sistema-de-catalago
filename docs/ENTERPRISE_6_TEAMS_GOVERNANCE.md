# Framework Enterprise de 6 Equipes — Governança Oficial

## Status

Este documento estabelece o processo oficial de desenvolvimento, auditoria, homologação, DevOps e limpeza técnica do ASTERYON Catálogo.

A partir desta trilha de consolidação, nenhuma mudança estrutural é considerada aprovada apenas porque compila, passa em um teste isolado ou foi publicada com sucesso. A aprovação exige separação de responsabilidades e evidências independentes.

## Objetivos obrigatórios

- 100% dos requisitos implementados e rastreáveis.
- 100% dos módulos funcionando e na mesma arquitetura/release.
- Zero bug crítico aberto.
- Zero vulnerabilidade crítica/alta aberta sem aceite formal de risco.
- Zero dependência funcional de versões anteriores após a migração ser concluída.
- Zero código legado ativo após substituição validada.
- Uma única arquitetura oficial de frontend, backend, APIs, banco, integrações e CI/CD.
- Evidência documentada para alteração, auditoria, homologação, deploy e limpeza.

## Regra de independência

Nenhuma equipe pode aprovar o próprio trabalho.

Uma implementação da Equipe 1 precisa ser auditada pela Equipe 2. A homologação da Equipe 3 precisa ser repetida ou fiscalizada independentemente pela Equipe 4. A Equipe 5 só promove uma release que tenha os gates anteriores aprovados.

## Equipe 0 — Descoberta, Governança, Arquitetura e Conformidade

Responsável por compreender o sistema antes de alteração estrutural.

Entregáveis mínimos:

- inventário de módulos;
- inventário de versões e dependências;
- mapa de Worker/API;
- mapa de frontend, loaders e runtimes;
- mapa de banco, Storage, Auth e RLS;
- mapa de integrações externas;
- mapa de CI/CD;
- riscos;
- critérios de aceite;
- plano de implementação;
- plano de rollback;
- classificação de legado em ativo, substituível, inativo ou histórico.

Regra: desenvolvimento estrutural só começa quando a arquitetura e os fluxos impactados atingirem entendimento suficiente para uma alteração segura. Exclusão destrutiva exige prova de substituição e autorização de limpeza.

## Equipe 0.1 — Conformidade e Limpeza

Fiscaliza migração, reconstrução e remoção de legado.

Nenhum arquivo antigo é removido apenas por nome, idade ou número de versão. Antes da remoção deve existir prova de que:

1. não é mais carregado em runtime;
2. não é mais importado pelo Worker;
3. não é mais exigido pelo build;
4. não é mais exigido pelos testes oficiais;
5. não possui dado/migração necessária ainda não consolidada;
6. existe rollback documentado.

## Equipe 1 — Desenvolvimento

Responsável por implementar e reconstruir.

Regras:

- corrigir causa raiz, não sintoma;
- não criar nova camada de hotfix sobre hotfix;
- não introduzir novos arquivos `*-vXX` como mecanismo de arquitetura;
- separar módulos por responsabilidade funcional;
- manter TypeScript e contratos explícitos no backend;
- recuperar fonte de frontend editável e reproduzível;
- preservar compatibilidade apenas durante a janela de migração;
- toda alteração deve registrar motivo, impacto e dependências afetadas.

## Equipe 2 — Auditoria Técnica

Audita 100% do trabalho da Equipe 1.

Obrigatório revisar:

- arquitetura;
- código;
- contratos de API;
- autenticação;
- autorização;
- isolamento por empresa/tenant;
- RLS;
- Storage;
- SSRF e downloads remotos;
- XSS;
- CSRF/origin policy;
- SQL/PostgREST injection;
- exposição de secrets;
- dependências vulneráveis;
- performance;
- concorrência e revision conflict;
- rollback;
- ausência de dependência funcional da versão anterior.

## Equipe 3 — Homologação e UX

Executa os fluxos como usuário real.

Cobertura mínima do catálogo:

- login/logout/refresh;
- perfis e permissões;
- produtos;
- importação Excel;
- marcas;
- imagens de produto;
- imagem/logo de marca;
- hierarquia departamento → seção → categoria;
- marketing, banner, vídeo e carrossel;
- biblioteca de modelos;
- oito templates oficiais;
- Preview preenchido → Editor;
- edição de texto, cor, posição, tamanho, drag e resize;
- cabeçalho editável;
- carrossel de marcas;
- autosave e conflito de revisão;
- snapshots;
- publicação;
- rollback;
- catálogo público;
- modal de produto;
- desktop, tablet e mobile.

Toda reprovação precisa conter passos, esperado, obtido e evidência.

## Equipe 4 — Auditoria Mestra

Possui poder de veto de qualidade.

Executa de forma independente:

- regressão dos fluxos críticos;
- testes exploratórios;
- casos extremos;
- concorrência;
- stress do Editor;
- isolamento de tenants;
- permissões negativas;
- validação de segurança;
- verificação de resíduos de versões anteriores.

Uma aprovação da Equipe 3 não substitui a Equipe 4.

## Equipe 5 — DevOps, Infraestrutura e SRE

Responsável por CI/CD, Cloudflare, observabilidade e recuperação.

Valida:

- build reproduzível;
- `npm ci`;
- TypeScript;
- testes automatizados;
- dry-run Wrangler;
- secrets e variáveis;
- artefatos;
- healthcheck;
- deploy;
- smoke pós-deploy;
- logs;
- rollback;
- prova de que artefatos antigos não ficaram ativos.

## Política de versão única

Durante a migração, componentes antigos podem existir somente como base temporária de comparação e rollback.

A release final consolidada não pode depender funcionalmente de uma cadeia como:

`release atual → index-vXX → index-vYY → index-vZZ`

Nem de um frontend composto por uma sequência histórica de patches carregados em runtime.

Versões devem ser metadados de release, não nomes arquiteturais permanentes de módulos.

## Política de reconstrução

A ordem oficial é:

**RECONSTRUIR → VALIDAR → SUBSTITUIR → REMOVER**

É proibido considerar como reconstrução:

- apenas renomear arquivo;
- apenas alterar número da versão;
- apenas encapsular código antigo;
- apenas adicionar novo loader sobre loader antigo;
- apenas adicionar patch sobre bundle minificado;
- apenas esconder componente antigo.

## Política de banco e dados

Mudança de DDL deve usar migration versionada e auditável.

Antes de qualquer mudança destrutiva:

- inventariar tabela/coluna/função/policy;
- comprovar uso em Worker/frontend/RPC;
- produzir rollback ou backup apropriado;
- executar advisors de segurança/performance após alteração;
- revalidar RLS e isolamento por tenant.

## Critérios para produção

Uma release só pode ser promovida quando:

- Equipe 0: arquitetura/escopo aprovados;
- Equipe 1: implementação concluída;
- Equipe 2: auditoria técnica aprovada;
- Equipe 3: homologação aprovada;
- Equipe 4: auditoria mestra aprovada;
- Equipe 5: pipeline/deploy/rollback aprovados;
- não houver bug crítico aberto;
- não houver regressão crítica aberta;
- não houver dependência funcional não autorizada da versão substituída;
- relatório de evidências estiver anexado.

## Limpeza final

A limpeza acontece somente depois da substituição validada.

Itens elegíveis para remoção incluem:

- código morto;
- `index-vXX` substituídos;
- runtimes antigos;
- patches antigos;
- workflows históricos não utilizados;
- scripts temporários;
- artefatos obsoletos;
- configurações antigas;
- dependências não utilizadas.

A remoção deve ser auditada novamente pelas Equipes 2, 4 e 5 antes do fechamento da release.
