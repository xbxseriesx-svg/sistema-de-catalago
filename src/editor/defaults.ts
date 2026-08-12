import type { BlockStyle, BlockType, BuilderBlock, CanvasConfig, DesignSystem, EditorDocument, IdentityConfig, ThemeConfig } from './types'

export const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

export const defaultDesignSystem: DesignSystem = {
  primaryFont: 'Inter', secondaryFont: 'Inter', primaryColor: '#0B5D3B', secondaryColor: '#123A63', accentColor: '#E5B93D',
  pageBackground: '#F5F7FA', cardBackground: '#FFFFFF', cardRadius: 18, buttonRadius: 10, borderColor: '#DCE4EC',
  shadow: '0 12px 32px rgba(12, 32, 56, .10)', spacingUnit: 8,
}

export const defaultIdentity: IdentityConfig = {
  companyName: 'ASTERYON', showCompanyName: true, logo: '', mobileLogo: '', logoWidth: 150, logoHeight: 48, brandGap: 10,
  favicon: '', pwaIcon: '', watermark: '',
}

export const defaultTheme: ThemeConfig = { name: 'Padrão', enabled: true, intensity: 45, particles: true, animateDesktop: true, animateMobile: false }

export const defaultCanvas: CanvasConfig = {
  background: '#F5F7FA', gradient: '', backgroundImage: '', backgroundSize: 'cover', backgroundPosition: 'center',
  showGrid: false, snapToGrid: true, gridSize: 8,
  desktop: { width: 1440, height: 2200 }, tablet: { width: 834, height: 1800 }, mobile: { width: 390, height: 1600 },
}

const baseStyle = (): BlockStyle => ({
  background: 'transparent', color: '#172230', borderColor: '#DCE4EC', borderWidth: 0, borderRadius: 0, shadow: 'none',
  fontFamily: '', fontWeight: 400, letterSpacing: 0, lineHeight: 1.4, opacity: 100, hoverScale: 1, transitionMs: 180,
  desktop: { width: '100%', columns: 1, gap: 16, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, positionMode: 'flow', x: 0, y: 0, zIndex: 1, rotate: 0 },
  tablet: { width: '100%', columns: 1, gap: 14, positionMode: 'flow', x: 0, y: 0, zIndex: 1, rotate: 0 },
  mobile: { width: '100%', columns: 1, gap: 12, positionMode: 'flow', x: 0, y: 0, zIndex: 1, rotate: 0 },
})

export const makeBlock = (type: BlockType, name?: string, parentId: string | null = null): BuilderBlock => {
  const now = new Date().toISOString()
  const style = baseStyle()
  const defaults: Partial<Record<BlockType, { name: string; props: Record<string, unknown>; style?: Partial<BlockStyle> }>> = {
    frame: { name: 'Quadro Livre', props: { showDefaultContent: false }, style: { background: '#FFFFFF', borderColor: '#DCE4EC', borderWidth: 1, borderRadius: 16 } },
    container: { name: 'Container', props: { maxWidth: 1280, showDefaultContent: false } },
    row: { name: 'Linha', props: { showDefaultContent: false } },
    column: { name: 'Coluna', props: { showDefaultContent: false } },
    header: { name: 'Cabeçalho', props: { showDefaultContent: true, showSearch: false, showNav: true, sticky: false }, style: { background: '#0B5D3B', color: '#FFFFFF' } },
    search: { name: 'Barra de Pesquisa', props: { placeholder: 'Buscar produtos, marcas e categorias...', showIcon: true }, style: { background: '#FFFFFF', color: '#223040', borderColor: '#D7DFE7', borderWidth: 1, borderRadius: 12 } },
    hero: { name: 'Banner Hero', props: { showDefaultContent: true, eyebrow: 'CATÁLOGO DIGITAL', title: 'Uma vitrine criada do seu jeito', subtitle: 'Personalize cada detalhe e publique somente quando estiver pronto.', ctaLabel: 'Ver promoções', ctaLink: '#promocoes', image: '', titleStyle: {}, subtitleStyle: {}, ctaStyle: {} }, style: { background: '#0B5D3B', color: '#FFFFFF', borderRadius: 26 } },
    banner: { name: 'Banner', props: { showDefaultContent: true, title: 'Banner promocional', subtitle: 'Mensagem de campanha', image: '', ctaLabel: 'Saiba mais', ctaLink: '#', titleStyle: {}, subtitleStyle: {}, ctaStyle: {} }, style: { background: '#123A63', color: '#FFFFFF', borderRadius: 22 } },
    carousel: { name: 'Carrossel', props: { showDefaultContent: true, autoplay: true, interval: 5000, slides: ['Campanha 1'] } },
    card: { name: 'Card', props: { showDefaultContent: true, title: 'Novo card', text: 'Edite ou desative o conteúdo padrão e adicione elementos livres dentro.', image: '', link: '#', titleStyle: {}, textStyle: {} }, style: { background: '#FFFFFF', borderColor: '#DCE4EC', borderWidth: 1, borderRadius: 18 } },
    product: { name: 'Produto', props: { productCode: '10001', showPrice: false, showImage: true, showBrand: true, showName: true, showBreadcrumb: true, showButton: true, buttonLabel: 'Ver informações' } },
    showcase: { name: 'Vitrine Inteligente', props: { showDefaultContent: true, title: 'Nova vitrine', kicker: '', source: 'featured', sourceValue: '', limit: 8, showHeader: true, showKicker: false, showCount: false, showImage: true, showBrand: true, showName: true, showBreadcrumb: true, showPrice: false, showButton: true, buttonLabel: 'Ver informações', cardMinWidth: 220, cardGap: 16, cardPadding: 14, imageHeight: 170, cardRadius: 18, cardBackground: '#FFFFFF' }, style: { background: 'transparent' } },
    category: { name: 'Categorias', props: { showDefaultContent: true, title: 'Categorias', source: 'manual' }, style: { background: 'transparent' } },
    brand: { name: 'Marcas', props: { showDefaultContent: true, title: 'Marcas', source: 'manual' }, style: { background: 'transparent' } },
    distribution: { name: 'Distribuições', props: { showDefaultContent: true, title: 'Distribuições', source: 'manual' }, style: { background: 'transparent' } },
    promotion: { name: 'Promoções', props: { showDefaultContent: true, title: 'Promoções', source: 'promotion', sourceValue: 'Ofertas da Semana', limit: 6, showHeader: true, showKicker: false, showCount: false, showImage: true, showBrand: true, showName: true, showBreadcrumb: true, showPrice: false, showButton: true, buttonLabel: 'Ver informações', cardMinWidth: 220, cardGap: 16, cardPadding: 14, imageHeight: 170, cardRadius: 18, cardBackground: '#FFFFFF' }, style: { background: 'transparent' } },
    text: { name: 'Texto', props: { text: 'Clique para editar este texto.', tag: 'p' }, style: { background: 'transparent' } },
    button: { name: 'Botão', props: { label: 'Clique aqui', link: '#', target: '_self' }, style: { background: '#0B5D3B', color: '#FFFFFF', borderRadius: 10 } },
    image: { name: 'Imagem', props: { src: '', alt: 'Imagem', fit: 'cover' } },
    video: { name: 'Vídeo', props: { url: '', autoplay: false, muted: true } },
    gallery: { name: 'Galeria', props: { images: [] } },
    faq: { name: 'FAQ', props: { items: [{ question: 'Pergunta frequente', answer: 'Resposta configurável pelo administrador.' }] } },
    form: { name: 'Formulário', props: { title: 'Fale conosco', fields: ['Nome', 'E-mail', 'Mensagem'], submitLabel: 'Enviar' } },
    footer: { name: 'Rodapé', props: { showDefaultContent: true, text: '© ASTERYON — Catálogo Digital', showSocial: true }, style: { background: '#081527', color: '#FFFFFF', borderRadius: 0 } },
    map: { name: 'Mapa', props: { address: 'Endereço da empresa' } },
    html: { name: 'HTML customizado', props: { html: '<div>HTML customizado</div>' } },
  }
  const def = defaults[type] ?? { name: type, props: {} }
  return {
    id: uid(type), type, name: name || def.name, parentId, order: 0, locked: false, hidden: false, hiddenOn: {},
    props: clone(def.props), style: { ...style, ...(def.style || {}) },
    meta: { createdAt: now, createdBy: 'Administrador', updatedAt: now, version: 1, status: 'draft' },
  }
}

const header = makeBlock('header'); header.order = 0
const hero = makeBlock('hero'); hero.order = 1
const showcase = makeBlock('showcase'); showcase.order = 2; showcase.style.desktop.columns = 4; showcase.style.tablet.columns = 2; showcase.style.mobile.columns = 1
const footer = makeBlock('footer'); footer.order = 3

export const defaultDocument: EditorDocument = {
  id: 'home-draft', pageId: 'home', name: 'Página Inicial', status: 'draft', blocks: [header, hero, showcase, footer],
  designSystem: clone(defaultDesignSystem), identity: clone(defaultIdentity), theme: clone(defaultTheme), canvas: clone(defaultCanvas), updatedAt: new Date().toISOString(),
}

export const blankDocument = (): EditorDocument => ({
  id: uid('doc'), pageId: 'home', name: 'Página Inicial', status: 'draft', blocks: [], designSystem: clone(defaultDesignSystem),
  identity: clone(defaultIdentity), theme: clone(defaultTheme), canvas: clone(defaultCanvas), updatedAt: new Date().toISOString(),
})

export const blockLibrary: Array<{ type: BlockType; label: string; group: string; description: string }> = [
  { type: 'frame', label: 'Quadro / Frame', group: 'Estrutura Livre', description: 'Área vazia para montar conteúdo do zero.' },
  { type: 'container', label: 'Container', group: 'Estrutura', description: 'Agrupa elementos e aceita conteúdo interno.' },
  { type: 'row', label: 'Linha', group: 'Estrutura', description: 'Organiza elementos horizontalmente.' },
  { type: 'column', label: 'Coluna', group: 'Estrutura', description: 'Organiza elementos verticalmente.' },
  { type: 'header', label: 'Cabeçalho', group: 'Estrutura', description: 'Pode usar preset ou virar um quadro totalmente livre.' },
  { type: 'footer', label: 'Rodapé', group: 'Estrutura', description: 'Pode usar preset ou receber elementos livres.' },
  { type: 'search', label: 'Barra de Pesquisa', group: 'Elementos', description: 'Elemento independente, removível e reposicionável.' },
  { type: 'text', label: 'Texto', group: 'Elementos', description: 'Texto independente com tipografia própria.' },
  { type: 'button', label: 'Botão', group: 'Elementos', description: 'Botão independente e redimensionável.' },
  { type: 'image', label: 'Imagem', group: 'Elementos', description: 'Imagem independente.' },
  { type: 'card', label: 'Card / Quadro', group: 'Elementos', description: 'Use o preset ou desligue-o e monte o card do zero.' },
  { type: 'hero', label: 'Hero / Banner', group: 'Banners', description: 'Use preset ou transforme em quadro livre.' },
  { type: 'banner', label: 'Banner', group: 'Banners', description: 'Use preset ou monte o conteúdo manualmente.' },
  { type: 'carousel', label: 'Carrossel', group: 'Banners', description: 'Slides configuráveis.' },
  { type: 'product', label: 'Produto', group: 'Catálogo', description: 'Produto individual com campos visíveis configuráveis.' },
  { type: 'showcase', label: 'Vitrine Inteligente', group: 'Catálogo', description: 'Fonte de dados + template de card totalmente configurável.' },
  { type: 'promotion', label: 'Promoção', group: 'Catálogo', description: 'Única coleção autorizada a misturar estruturas.' },
  { type: 'category', label: 'Categorias', group: 'Catálogo', description: 'Navegação por categoria.' },
  { type: 'brand', label: 'Marcas', group: 'Catálogo', description: 'Navegação por marca.' },
  { type: 'distribution', label: 'Distribuições', group: 'Catálogo', description: 'Navegação por distribuição.' },
  { type: 'video', label: 'Vídeo', group: 'Mídia', description: 'Vídeo incorporado.' },
  { type: 'gallery', label: 'Galeria', group: 'Mídia', description: 'Galeria de imagens.' },
  { type: 'faq', label: 'FAQ', group: 'Conteúdo', description: 'Itens adicionáveis/removíveis.' },
  { type: 'form', label: 'Formulário', group: 'Conteúdo', description: 'Campos adicionáveis/removíveis.' },
  { type: 'map', label: 'Mapa', group: 'Conteúdo', description: 'Localização.' },
  { type: 'html', label: 'HTML', group: 'Avançado', description: 'HTML isolado em sandbox.' },
]
