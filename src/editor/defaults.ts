import type { BlockStyle, BlockType, BuilderBlock, DesignSystem, EditorDocument, IdentityConfig, ThemeConfig } from './types'

export const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

export const defaultDesignSystem: DesignSystem = {
  primaryFont: 'Inter', secondaryFont: 'Inter', primaryColor: '#0B5D3B', secondaryColor: '#123A63', accentColor: '#E5B93D',
  pageBackground: '#F5F7FA', cardBackground: '#FFFFFF', cardRadius: 18, buttonRadius: 10, borderColor: '#DCE4EC',
  shadow: '0 12px 32px rgba(12, 32, 56, .10)', spacingUnit: 8,
}

export const defaultIdentity: IdentityConfig = { companyName: 'ASTERYON', logo: '', mobileLogo: '', favicon: '', pwaIcon: '', watermark: '' }
export const defaultTheme: ThemeConfig = { name: 'Padrão', enabled: true, intensity: 45, particles: true, animateDesktop: true, animateMobile: false }

const baseStyle = (): BlockStyle => ({
  background: '#FFFFFF', color: '#172230', borderColor: '#DCE4EC', borderWidth: 0, borderRadius: 16, shadow: 'none',
  fontFamily: '', fontWeight: 400, letterSpacing: 0, lineHeight: 1.4, opacity: 100, hoverScale: 1, transitionMs: 180,
  desktop: { width: '100%', columns: 1, gap: 16, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, positionMode: 'flow', x: 0, y: 0, zIndex: 1, rotate: 0 },
  tablet: { width: '100%', columns: 1, gap: 14, positionMode: 'flow', x: 0, y: 0, zIndex: 1, rotate: 0 },
  mobile: { width: '100%', columns: 1, gap: 12, positionMode: 'flow', x: 0, y: 0, zIndex: 1, rotate: 0 },
})

export const makeBlock = (type: BlockType, name?: string, parentId: string | null = null): BuilderBlock => {
  const now = new Date().toISOString()
  const style = baseStyle()
  const defaults: Partial<Record<BlockType, { name: string; props: Record<string, unknown>; style?: Partial<BlockStyle> }>> = {
    container: { name: 'Container', props: { maxWidth: 1280 } },
    row: { name: 'Linha', props: {} },
    column: { name: 'Coluna', props: {} },
    header: { name: 'Cabeçalho', props: { showSearch: false, showNav: true, sticky: true }, style: { background: '#0B5D3B', color: '#FFFFFF' } },
    search: { name: 'Barra de Pesquisa', props: { placeholder: 'Buscar produtos, marcas e categorias...', showIcon: true }, style: { background: '#FFFFFF', color: '#223040', borderColor: '#D7DFE7', borderWidth: 1, borderRadius: 12 } },
    hero: { name: 'Banner Hero', props: { eyebrow: 'CATÁLOGO DIGITAL', title: 'Uma vitrine criada do seu jeito', subtitle: 'Personalize cada detalhe e publique somente quando estiver pronto.', ctaLabel: 'Ver promoções', ctaLink: '#promocoes', image: '', titleStyle: {}, subtitleStyle: {}, ctaStyle: {} }, style: { background: '#0B5D3B', color: '#FFFFFF', borderRadius: 26 } },
    banner: { name: 'Banner Interno', props: { title: 'Banner promocional', subtitle: 'Mensagem de campanha', image: '', ctaLabel: 'Saiba mais', ctaLink: '#', titleStyle: {}, subtitleStyle: {}, ctaStyle: {} }, style: { background: '#123A63', color: '#FFFFFF', borderRadius: 22 } },
    carousel: { name: 'Carrossel', props: { autoplay: true, interval: 5000, slides: ['Campanha 1', 'Campanha 2', 'Campanha 3'] } },
    card: { name: 'Card', props: { title: 'Card personalizado', text: 'Descrição do card', image: '', link: '#', titleStyle: {}, textStyle: {} } },
    product: { name: 'Produto', props: { productCode: '10001', showPrice: false } },
    showcase: { name: 'Vitrine de Produtos', props: { title: 'Produtos em destaque', source: 'featured', sourceValue: '', limit: 8, showPrice: false }, style: { background: 'transparent' } },
    category: { name: 'Categorias', props: { title: 'Categorias', source: 'manual' }, style: { background: 'transparent' } },
    brand: { name: 'Marcas', props: { title: 'Marcas', source: 'manual' }, style: { background: 'transparent' } },
    distribution: { name: 'Distribuições', props: { title: 'Distribuições', source: 'manual' }, style: { background: 'transparent' } },
    promotion: { name: 'Promoções', props: { title: 'Promoções', source: 'promotion', sourceValue: 'Ofertas da Semana', limit: 6 }, style: { background: 'transparent' } },
    text: { name: 'Texto', props: { text: 'Clique para editar este texto.', tag: 'p' }, style: { background: 'transparent' } },
    button: { name: 'Botão', props: { label: 'Clique aqui', link: '#', target: '_self' }, style: { background: '#0B5D3B', color: '#FFFFFF', borderRadius: 10 } },
    image: { name: 'Imagem', props: { src: '', alt: 'Imagem', fit: 'cover' } },
    video: { name: 'Vídeo', props: { url: '', autoplay: false, muted: true } },
    gallery: { name: 'Galeria', props: { images: [] } },
    faq: { name: 'FAQ', props: { items: [{ question: 'Pergunta frequente', answer: 'Resposta configurável pelo administrador.' }] } },
    form: { name: 'Formulário', props: { title: 'Fale conosco', fields: ['Nome', 'E-mail', 'Mensagem'], submitLabel: 'Enviar' } },
    footer: { name: 'Rodapé', props: { text: '© ASTERYON — Catálogo Digital', showSocial: true }, style: { background: '#081527', color: '#FFFFFF', borderRadius: 0 } },
    map: { name: 'Mapa', props: { address: 'Endereço da empresa' } },
    html: { name: 'HTML customizado', props: { html: '<div>HTML customizado</div>' } },
  }
  const def = defaults[type] ?? { name: type, props: {} }
  return { id: uid(type), type, name: name || def.name, parentId, order: 0, locked: false, hidden: false, hiddenOn: {}, props: clone(def.props), style: { ...style, ...(def.style || {}) }, meta: { createdAt: now, createdBy: 'Administrador', updatedAt: now, version: 1, status: 'draft' } }
}

const header = makeBlock('header'); header.order = 0
const search = makeBlock('search'); search.order = 1; search.style.desktop.width = '62%'; search.style.tablet.width = '78%'; search.style.mobile.width = '92%'
const hero = makeBlock('hero'); hero.order = 2
const promo = makeBlock('promotion'); promo.order = 3; promo.style.desktop.columns = 4; promo.style.tablet.columns = 2; promo.style.mobile.columns = 1
const showcase = makeBlock('showcase'); showcase.order = 4; showcase.style.desktop.columns = 4; showcase.style.tablet.columns = 2; showcase.style.mobile.columns = 1
const footer = makeBlock('footer'); footer.order = 5

export const defaultDocument: EditorDocument = { id: 'home-draft', pageId: 'home', name: 'Página Inicial', status: 'draft', blocks: [header, search, hero, promo, showcase, footer], designSystem: clone(defaultDesignSystem), identity: clone(defaultIdentity), theme: clone(defaultTheme), updatedAt: new Date().toISOString() }

export const blockLibrary: Array<{ type: BlockType; label: string; group: string; description: string }> = [
  { type: 'container', label: 'Container', group: 'Estrutura', description: 'Área de agrupamento com largura controlada.' },
  { type: 'row', label: 'Linha', group: 'Estrutura', description: 'Organiza componentes horizontalmente.' },
  { type: 'column', label: 'Coluna', group: 'Estrutura', description: 'Coluna para composição livre.' },
  { type: 'header', label: 'Header', group: 'Estrutura', description: 'Cabeçalho com logo e navegação.' },
  { type: 'search', label: 'Barra de Pesquisa', group: 'Conteúdo', description: 'Pesquisa independente: adicione, mova, duplique ou remova quando quiser.' },
  { type: 'hero', label: 'Banner Hero', group: 'Banners', description: 'Banner principal de alto impacto.' },
  { type: 'banner', label: 'Banner Interno', group: 'Banners', description: 'Faixa ou campanha interna.' },
  { type: 'carousel', label: 'Carrossel', group: 'Banners', description: 'Sequência rotativa de campanhas.' },
  { type: 'card', label: 'Card', group: 'Conteúdo', description: 'Card livre e totalmente customizável.' },
  { type: 'product', label: 'Produto', group: 'Catálogo', description: 'Card conectado a um produto.' },
  { type: 'showcase', label: 'Vitrine', group: 'Catálogo', description: 'Vitrine inteligente conectada ao banco.' },
  { type: 'category', label: 'Categorias', group: 'Catálogo', description: 'Lista de categorias.' },
  { type: 'brand', label: 'Marcas', group: 'Catálogo', description: 'Lista de marcas.' },
  { type: 'distribution', label: 'Distribuições', group: 'Catálogo', description: 'Lista de distribuições.' },
  { type: 'promotion', label: 'Promoção', group: 'Catálogo', description: 'Único bloco autorizado a misturar estruturas.' },
  { type: 'text', label: 'Texto', group: 'Conteúdo', description: 'Texto livre, título ou parágrafo.' },
  { type: 'button', label: 'Botão', group: 'Conteúdo', description: 'Ação com link e hover.' },
  { type: 'image', label: 'Imagem', group: 'Mídia', description: 'Imagem com ajuste e responsividade.' },
  { type: 'video', label: 'Vídeo', group: 'Mídia', description: 'Vídeo incorporado.' },
  { type: 'gallery', label: 'Galeria', group: 'Mídia', description: 'Galeria responsiva.' },
  { type: 'faq', label: 'FAQ', group: 'Conteúdo', description: 'Perguntas e respostas.' },
  { type: 'form', label: 'Formulário', group: 'Conteúdo', description: 'Formulário configurável.' },
  { type: 'map', label: 'Mapa', group: 'Conteúdo', description: 'Bloco para localização.' },
  { type: 'html', label: 'HTML', group: 'Avançado', description: 'HTML customizado sob responsabilidade do ADMIN.' },
  { type: 'footer', label: 'Rodapé', group: 'Estrutura', description: 'Rodapé institucional.' },
]
