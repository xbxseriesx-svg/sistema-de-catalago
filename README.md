# ASTERYON Catálogo Digital

Plataforma de catálogo empresarial com dois módulos separados em produção:

- **Portal Público:** domínio oficial da empresa, sem login para o visitante.
- **Painel Administrativo:** subdomínio `admin`, com construção visual e publicação controlada.

## Editor Visual Pro

O Editor Visual trabalha **somente sobre rascunhos**. O Portal Público lê exclusivamente a última versão publicada.

Layout inspirado em ferramentas profissionais de construção visual:

- Barra superior: **Undo · Redo · Salvar · Preview · Publicar**.
- Biblioteca de blocos à esquerda.
- Preview WYSIWYG em tempo real no centro.
- Painel contextual de propriedades à direita.
- Modos independentes **Desktop · Tablet · Mobile**.

### Drag & Drop

Implementado com `dnd-kit`:

- reordenação de seções e blocos;
- componentes aninháveis em Container, Linha e Coluna;
- indicadores **Inserir acima · Inserir abaixo · Inserir dentro**;
- blocos bloqueados não podem ser movidos;
- biblioteca pode ser arrastada para o canvas.

### Biblioteca de blocos

Container, Linha, Coluna, Header, Banner Hero, Banner Interno, Carrossel, Card, Produto, Vitrine, Categoria, Marca, Distribuição, Promoção, Texto, Botão, Imagem, Vídeo, Galeria, FAQ, Formulário, Rodapé, Mapa e HTML customizado isolado em `iframe sandbox`.

### Blocos inteligentes

Vitrines suportam origem:

- Manual
- Categoria
- Marca
- Distribuição
- Promoção
- Mais acessados
- Mais pesquisados
- Mais recentes
- Destaques

A camada `src/catalog/data.ts` contém o resolver de demonstração. Em produção, a mesma interface passa a buscar os dados no Supabase.

### Propriedades contextuais

Ao selecionar um bloco, o painel direito disponibiliza controles específicos para:

- conteúdo;
- tipografia;
- layout por dispositivo;
- largura, altura, colunas, gap, margem e padding;
- cores por paleta ou hexadecimal;
- gradiente e imagem de fundo;
- borda, radius e sombra;
- hover e transição;
- visibilidade Desktop/Tablet/Mobile;
- metadados do Inspector Avançado.

Todo bloco possui ações rápidas para **Duplicar, Excluir, Ocultar, Bloquear, Copiar Estilo, Colar Estilo e Salvar como Template**.

## Design System Global

Controla tokens reutilizáveis de:

- fonte principal e secundária;
- cor primária, secundária e destaque;
- fundo geral e dos cards;
- bordas e sombras;
- radius de cards e botões;
- unidade de espaçamento.

## Identidade Visual

Área dedicada a:

- Logo Principal
- Logo Mobile
- Favicon
- Ícone PWA
- Marca d'água

O sistema também inclui o novo símbolo ASTERYON, baseado no conceito **Aster = Estrela**, combinando uma estrela geométrica com a letra `A`.

## Temas

Temas nativos:

- Padrão
- Natal
- Black Friday
- Carnaval
- Dia das Mães
- Dia dos Pais
- Dia das Crianças
- Ano Novo

O motor permite controlar intensidade, partículas e animações por Desktop/Mobile. A arquitetura deixa a geração de novos temas por IA isolada em um provider externo, sem expor credenciais no frontend.

## Undo, Redo e Histórico

Estado do editor mantido com Zustand no formato:

```ts
{
  past: [],
  present: {},
  future: []
}
```

Atalhos:

- `Ctrl + Z` — Undo
- `Ctrl + Shift + Z` — Redo

Snapshots automáticos são criados:

- a cada 25 ações;
- a cada 5 minutos.

O Histórico Visual registra as ações, e os snapshots podem ser restaurados.

## Sandbox e Time Machine

- Vários rascunhos paralelos podem existir sem afetar a produção.
- Uma versão publicada pode ser restaurada para rascunho.
- Versões podem ser duplicadas em novos Sandboxes.
- Publicações anteriores são preservadas como versões arquivadas.

## Preview e Publicação

O **Modo Visitante** remove todos os controles administrativos e renderiza o rascunho exatamente como portal.

Antes da publicação, o sistema exibe:

- resumo das mudanças;
- blocos criados, alterados e removidos;
- mudanças em banners, vitrines, tema, rodapé, design system e identidade;
- comparação lado a lado **Publicado x Novo Rascunho**.

Estados previstos:

`draft → preview → scheduled → published → archived`

A publicação cria uma nova versão imutável e mantém as anteriores disponíveis para restauração.

## Supabase

A migração `supabase/migrations/202608120001_editor_visual_pro.sql` adiciona:

- `site_pages`
- `site_sandboxes`
- `site_drafts`
- `site_versions`
- `editor_snapshots`
- `editor_activity`
- `component_templates`
- `design_systems`
- `visual_identity`

Também cria o bucket privado `catalog-editor-assets` e a função transacional `publish_site_draft`.

O Portal Público deve consultar apenas a versão apontada por `site_pages.published_version_id`, impedindo que um rascunho seja exibido acidentalmente.

A Edge Function `supabase/functions/publish-scheduled` processa publicações agendadas quando acionada por um scheduler/cron seguro.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- dnd-kit
- Zustand
- Zod
- React Hook Form
- Supabase / PostgreSQL / Storage

## Rodar localmente

```bash
npm install
npm run dev
```

- `http://localhost:5173/` — Portal Público
- `http://localhost:5173/admin` — Editor Visual Pro

Validação:

```bash
npm run typecheck
npm run build
```

O GitHub Actions executa typecheck e build antes da integração na branch `main`.

## Produção

Arquitetura planejada:

`GitHub → Supabase/PostgreSQL + Storage → Cloudflare`

- `www.empresa.com.br` → Portal Público
- `admin.empresa.com.br` → Painel Administrativo
- Supabase Auth + RLS por empresa/usuário
- Storage para produtos, logos, banners e encartes
- Cloudflare para domínio, HTTPS, CDN, cache, rate limit e proteção
