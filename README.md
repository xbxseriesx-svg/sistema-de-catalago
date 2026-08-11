# Asteryon Catálogo Digital

Sistema de catálogo empresarial com dois módulos separados na produção:

- **Portal público:** domínio oficial da empresa, sem login para o visitante.
- **Painel administrativo:** subdomínio `admin`, com editor visual e publicação controlada.

## Editor Visual — versão avançada

O editor foi redesenhado para funcionar como um construtor visual livre:

- Clique em qualquer elemento da página para abrir suas propriedades na barra lateral.
- Todos os elementos editáveis exibem menu de **três pontos** e identificação ao passar o mouse.
- Blocos podem ser **arrastados e reposicionados** diretamente na prévia.
- Cards de produto podem ter estilo individual: largura, posição, fundo, texto, borda, raio, imagem, altura da imagem, sombra, alinhamento e botão.
- Barra de pesquisa com edição separada de largura, largura máxima, altura, raio, cores, borda, fonte e placeholder.
- Logo da empresa e favicon/ícone com upload, substituição e remoção.
- Caixas de texto livres podem ser adicionadas, editadas, movidas e excluídas.
- Cores podem ser escolhidas pela paleta **ou digitadas em código hexadecimal** (`#RRGGBB`).
- Biblioteca de blocos com vários modelos sugeridos de banners e cards.
- Banners permitem imagem, remoção da imagem, altura, overlay, alinhamento, texto, CTA e cores.
- Preview em Desktop, Tablet e Celular.
- Rascunho separado do conteúdo público.

## Produtos

- Filtros por texto/código, departamento, categoria, marca e visibilidade de preço.
- Preço opcional.
- Upload e remoção de imagem.
- Campos da ficha pública escolhidos pelo ADMIN.
- Importação Excel/CSV.
- Associação automática de PNG/JPG pelo código do produto (`10001.png`, `10001_2.png`).
- Alterações de produto ficam no rascunho e só chegam ao Portal ao publicar.

## Estrutura 100% editável

Cada empresa pode criar sua própria árvore de navegação, sem quantidade fixa de níveis ou nomes obrigatórios. Exemplos:

- Departamentos → Categorias → Seções → Subcategorias.
- Distribuições → Marca → Linha → Família.
- Segmentos, coleções, aplicações ou qualquer estrutura própria.

A regra principal continua: **produto segue sua classificação normal; somente Promoções podem misturar livremente produtos de estruturas diferentes.**

## Temas pré-criados

- Padrão
- Natal
- Black Friday
- Dia das Mães
- Dia dos Pais
- Dia das Crianças
- Ano Novo
- Carnaval

Cada tema possui paleta e efeitos animados próprios e pode ser usado como ponto de partida para customização no Editor Visual.

## Analytics

Métricas de interesse para produtos, pesquisas, departamentos e promoções. A arquitetura está preparada para ampliar a granularidade por categoria, seção, subcategoria, banner e card.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra:

- `http://localhost:5173/` — Portal Público
- `http://localhost:5173/admin` — Painel ADMIN

## Publicação

O ADMIN trabalha em rascunho. O Portal Público usa somente a última versão publicada. Ao clicar em **Publicar alterações**, configuração visual, produtos e promoções do rascunho são promovidos para a versão pública.

## Produção planejada

`GitHub → Supabase/PostgreSQL + Storage → Cloudflare`

- `www.empresa.com.br` → Portal Público
- `admin.empresa.com.br` → Painel Administrativo
- Supabase Auth + RLS + auditoria
- Storage para produtos, logos, banners e encartes
- Cloudflare para domínio, cache, HTTPS, rate limit e proteção
