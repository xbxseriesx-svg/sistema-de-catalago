# ASTERYON Catálogo — V68

Versão oficial do catálogo ASTERYON com dados e mídias no **Supabase** e aplicação publicada na **Cloudflare** a partir do repositório GitHub.

## Arquitetura oficial

`GitHub → Supabase → Cloudflare`

- **GitHub**: código, versionamento e QA.
- **Supabase Postgres**: produtos, marcas, departamentos/seções/categorias, marketing, páginas, permissões, snapshots e auditoria.
- **Supabase Storage**: imagens e mídias.
- **Cloudflare Worker + Static Assets**: API, frontend e entrega pública.
- **Cloudflare D1 / R2**: não utilizados.

## Projeto

- Worker: `sistema-de-catalago`
- Supabase Project ID: `bjcfknhiwjxznxydvmzt`
- Entry point: `worker/index-v62.ts`
- Versão da aplicação: `2.1.68`

## Identidade visual Distribuidora Laurencini — V68

A V68 padroniza todos os modelos de template com a identidade cromática da **Distribuidora Laurencini**, sem alterar a estrutura, posição ou comportamento dos componentes.

### Paleta oficial

- Azul institucional: `#214C8F`
- Azul profundo: `#123F7D`
- Azul de apoio: `#1E5EAA`
- Vermelho institucional: `#D13130`
- Vermelho profundo: `#A7252A`
- Fundo claro: `#F4F8FC`
- Borda clara: `#DCE6F2`
- Texto principal: `#172033`
- Texto secundário: `#66758A`
- Branco: `#FFFFFF`

### Modelos padronizados

A normalização é aplicada aos sete modelos prontos do editor:

- Varejo Contínuo
- Atacado B2B
- Distribuidora Institucional
- Catálogo de Marcas B2B
- Distribuidora União • Figma B2B
- Catálogo Hierárquico B2B
- Vitrine Atacado Pro

Além dos modelos nativos, qualquer modelo já salvo na biblioteca do Supabase é convertido para a paleta Laurencini quando é carregado e novamente validado quando é aplicado ao canvas. Isso evita que modelos antigos mantenham verde, laranja, roxo ou cores genéricas.

### Regras de marca

- Azul é a cor estrutural para navegação, cabeçalhos, títulos, preços e grandes áreas institucionais.
- Vermelho é priorizado em chamadas comerciais, promoções e botões de produto.
- Tons claros derivados da marca substituem fundos verdes, roxos, laranjas ou cinzas antigos.
- Branco e cinzas frios são preservados para contraste e legibilidade.
- Gradientes de hero usam `#123F7D → #214C8F`.
- Gradientes promocionais usam `#A7252A → #D13130`.
- Elementos novos inseridos pelo editor já nascem com a identidade Laurencini.
- O Modelo Oficial também é convertido integralmente para a mesma paleta durante o build.

## Catálogo e dados reais

- O editor não inicializa produtos, marcas ou hierarquia fictícios do bundle de demonstração.
- Os produtos exibidos vêm do catálogo do Supabase.
- Se a leitura administrativa falhar durante a abertura, o frontend tenta o endpoint público do mesmo Supabase em vez de apresentar dados fictícios.
- Todos os departamentos ativos retornados pelo Supabase podem aparecer nos filtros e telas do catálogo.
- O formulário de produto não força um departamento padrão quando o vínculo não foi resolvido.

## Catálogo em pop-up e produto

- Ações de catálogo abrem o catálogo em pop-up com filtros e produtos reais.
- O produto abre em um segundo pop-up com informações, ações e produtos similares.
- O modal de produto possui altura limitada ao viewport, rolagem interna, cabeçalho/fechar acessível, retorno ao topo ao trocar por similar e fechamento por `Esc`.
- O botão Menu é um elemento editável do canvas e pode ser movido, redimensionado, estilizado, duplicado ou excluído.

## Responsividade automática — V67+

A aplicação usa **um único layout**. Não existem cópias separadas de páginas para desktop, tablet e celular.

### Breakpoints do renderer público

- **Mobile:** até `767px`.
- **Tablet:** de `768px` até `1100px`.
- **Desktop:** acima de `1100px`.

O renderer público escolhe automaticamente as coordenadas salvas em `responsive.mobile`, `responsive.tablet` ou a geometria desktop de cada elemento conforme a largura atual.

### Ajustes automáticos

- Monitoramento de `window.resize`, `orientationchange` e `visualViewport`.
- Reaplicação de estado por `requestAnimationFrame`, evitando atualizações redundantes.
- Detecção de orientação retrato/paisagem e de dispositivos com toque.
- Página pública escala para baixo e para cima, aproveitando a largura disponível também em desktops maiores.
- Imagens, vídeos e canvas usam limites fluidos e não ultrapassam o container.
- Proteções globais contra overflow horizontal.
- Tipografia pública fluida com `clamp()`.
- Uso de Flexbox, CSS Grid, `rem`, `vw`, `vh`/`dvh` e `safe-area-inset-*`.
- Fallback `100vh` antes de `100dvh` para navegadores sem viewport dinâmico completo.
- O zoom do usuário não é bloqueado.

### Editor responsivo

- Em desktop, os painéis laterais permanecem visíveis.
- Em tablet e celular, os mesmos painéis do editor viram drawers; nenhum painel é duplicado.
- Uma barra flutuante permite abrir **Painel** e **Propriedades** em telas menores.
- O backdrop e a tecla `Esc` fecham os drawers.
- A área central fica livre para o canvas sem exigir zoom do navegador.

### Catálogo e produtos

- Tablet: grids públicos reduzidos para duas colunas quando necessário.
- Celular: uma coluna por padrão; duas colunas em celulares mais largos ou em orientação horizontal quando houver espaço.
- Botões e campos possuem alvo mínimo para toque.
- Inputs mobile usam no mínimo `16px`, evitando zoom automático de formulário no Safari/iOS.
- Catálogo e modal de produto respeitam `100dvh`, possuem rolagem interna e não cortam o botão fechar.

### Importador de imagens

- Desktop: até quatro cards de status por linha.
- Tablet: duas colunas.
- Celular: uma coluna; duas em paisagem quando houver espaço.
- Ações ficam em largura total no celular.
- O fluxo de importação e conversão não foi duplicado nem alterado.

## Variáveis e segredos

As credenciais do Supabase usadas pelo Worker permanecem na configuração segura da Cloudflare:

- `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`
- `SDM_BOOTSTRAP_TOKEN`

`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` ficam no `wrangler.jsonc`.

O GitHub Actions é **somente QA** e não depende de `CLOUDFLARE_ACCOUNT_ID` nem `CLOUDFLARE_API_TOKEN`.

## Importação de produtos — Excel

- Validação dos campos obrigatórios.
- Lotes de até 300 produtos por requisição.
- Preservação/atualização pelo código do produto.
- Hierarquia e marcas criadas/vinculadas conforme a planilha.
- Barra de progresso real com quantidade, códigos e produtos do lote em andamento.

## Importação de imagens

- Nome do arquivo = código do produto, por exemplo `318.PNG` → produto `318`.
- Seleção de pasta inteira.
- Conversão WebP no navegador.
- Processamento em pequenos lotes.
- Gravação no bucket `product-images` do Supabase Storage.
- A importação da imagem não altera código, descrição, EAN, preço ou hierarquia.
- Barra informa arquivo, código, produto e etapa atual.

## Validação de produção

```bash
npm ci
npm test
```

O QA da V68 valida TypeScript, Worker, Supabase, autenticação, importação Excel, campos da planilha, marketing, Modelo Oficial, catálogo real, modais V65/V66, responsividade V67+ e a identidade Laurencini V68. O teste de marca confirma os sete templates, a biblioteca Supabase, os elementos novos e as cores oficiais.

## Recuperação

A versão estável anterior às mudanças de importação de imagens permanece em:

`backup/v60-stable-before-images-v61`
