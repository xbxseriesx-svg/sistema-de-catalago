# ASTERYON Catálogo — V91

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
- Entry point: `worker/index-v81.ts`
- Versão da aplicação: `2.1.91`

## Release atual — V91

A V91 é a release lógica atual. O nome físico `worker/index-v81.ts` é mantido por compatibilidade e histórico, sem renomear a cadeia antiga apenas por estética.

A V91 preserva o hardening de segurança consolidado na V89 e a resolução de templates da V90, acrescentando a regra de paridade entre **Preview Final preenchido** e **Editor inicial**, sincronização de logos vinculados às marcas, edição de fundos/gradientes, validação independente antes da publicação e cache-busting coerente com a release V91.

As fontes funcionais de versão que devem permanecer coerentes são `VERSION`, `package.json`, `package-lock.json`, `/api/health`, `public/index.html`, o runtime loader e este README.

## Preview completo dos templates — V69

A V69 acrescenta um modo **Pré-visualizar modelo completo** na biblioteca de templates. A prévia abre em tela cheia e mostra cada modelo já montado como uma página final, antes de substituir o layout atual do editor.

### Dados reais na prévia

A camada de preview consulta exclusivamente o endpoint público existente `/api/public/catalog`, portanto usa a mesma fonte Supabase já utilizada pelo catálogo publicado.

Na fotografia da base usada na implementação da V69 havia:

- `2.513` produtos;
- `260` marcas;
- `58` nós de hierarquia;
- `8` templates cadastrados;
- `2.392` mídias;
- `2.301` vínculos produto ↔ mídia.

Esses números são apenas uma fotografia da base e podem crescer normalmente. A prévia não fixa esses totais: ela calcula os indicadores novamente a cada abertura com os dados recebidos do catálogo público.

Os previews podem utilizar:

- nome, código, descrição, imagem e embalagem do produto;
- marca vinculada;
- departamento;
- seção;
- categoria;
- logos de marcas quando disponíveis no catálogo;
- quantidades reais do portfólio e da hierarquia.

Não existe seed fictício para preencher os previews.

### Identidade Distribuidora Laurencini

Todos os previews usam o nome **Distribuidora Laurencini**, a logo Laurencini incorporada à V69 e a paleta oficial já criada na V68.

- Azul institucional: `#214C8F`
- Azul profundo: `#123F7D`
- Azul de apoio: `#1E5EAA`
- Vermelho institucional: `#D13130`
- Vermelho profundo: `#A7252A`
- Fundo claro: `#F4F8FC`
- Borda clara: `#DCE6F2`

### Modelos com preview completo

A V69 cobre os sete modelos prontos e também o Modelo Oficial:

- Varejo Contínuo;
- Atacado B2B;
- Distribuidora Institucional;
- Catálogo de Marcas B2B;
- Distribuidora União • Figma B2B;
- Catálogo Hierárquico B2B;
- Vitrine Atacado Pro;
- Modelo Oficial.

Cada família recebe uma composição visual própria, mas todas são montadas com a mesma base real de produtos, marcas e hierarquia.

### Referência estrutural institucional

A organização dos previews usa como referência conceitual sites de distribuidores B2B, incluindo a estrutura institucional observada no site da Wilso: navegação por departamentos, segmentos atendidos, marcas, apresentação da empresa e contato.

Foram **deliberadamente desconsiderados** os recursos de e-commerce e venda, entre eles:

- carrinho;
- checkout;
- adicionar ao carrinho;
- compra online;
- pedidos;
- pagamento;
- boleto;
- faturamento e demais fluxos comerciais transacionais.

O objetivo é apresentar portfólio e empresa, não transformar os templates em loja virtual.

### Catálogo e produto continuam com a regra existente

A V69 **não substitui nem reimplementa** as regras de abertura do catálogo e do produto.

- O botão **Aplicar este modelo** do preview fecha a prévia e aciona o mesmo botão **Aplicar modelo** já existente no card original.
- O catálogo publicado continua abrindo no pop-up atual do ASTERYON.
- O produto continua abrindo no modal atual, com informações e produtos similares.
- A camada de preview não adiciona rota administrativa nem novo fluxo de produto.
- A prévia visual usa somente `/api/public/catalog`.

Assim, a novidade fica isolada na escolha do template, sem alterar o comportamento já aprovado do catálogo publicado.

### Busca dentro do preview

O campo de busca da prévia filtra os produtos carregados do catálogo por:

- descrição/nome;
- código;
- marca;
- departamento;
- seção;
- categoria.

Essa busca serve apenas para demonstrar o template preenchido; não substitui a busca e os filtros do catálogo oficial.

## Identidade visual Distribuidora Laurencini — V68+

A V68 padronizou todos os modelos de template com a identidade cromática da **Distribuidora Laurencini**, sem alterar a estrutura, posição ou comportamento dos componentes.

### Regras de marca

- Azul é a cor estrutural para navegação, cabeçalhos, títulos, preços e grandes áreas institucionais.
- Vermelho é priorizado em chamadas comerciais, promoções e botões de produto.
- Tons claros derivados da marca substituem fundos verdes, roxos, laranjas ou cinzas antigos.
- Branco e cinzas frios são preservados para contraste e legibilidade.
- Gradientes de hero usam `#123F7D → #214C8F`.
- Gradientes promocionais usam `#A7252A → #D13130`.
- Elementos novos inseridos pelo editor já nascem com a identidade Laurencini.
- O Modelo Oficial também é convertido integralmente para a mesma paleta durante o build.

Além dos modelos nativos, qualquer modelo já salvo na biblioteca do Supabase é convertido para a paleta Laurencini quando é carregado e novamente validado quando é aplicado ao canvas.

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
- `REMOTE_IMAGE_HMAC_SECRET`

`REMOTE_IMAGE_HMAC_SECRET` deve ser um segredo aleatório exclusivo e não deve reutilizar chave administrativa do Supabase, bootstrap token ou chave Google.

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

O QA atual da V91 preserva as regressões históricas de V61–V90 e acrescenta validações da paridade Preview Final → Editor, sincronização de logos de marcas, cache V91, autenticação/refresh, segurança de imagens remotas, baseline Supabase, E2E desktop/mobile, isolamento anônimo entre tenants e coerência de versionamento. Testes mockados continuam úteis para smoke de UI, mas não substituem a prova funcional com persistência real.

## Recuperação

A versão estável anterior às mudanças de importação de imagens permanece em:

`backup/v60-stable-before-images-v61`
