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
  desktop: { width: '360px', columns: 1, gap: 16, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, positionMode: 'free', x: 24, y: 24, zIndex: 2, rotate: 0 },
  tablet: { width: '320px', columns: 1, gap: 14, positionMode: 'free', x: 20, y: 20, zIndex: 2, rotate: 0 },
  mobile: { width: '320px', columns: 1, gap: 12, positionMode: 'free', x: 16, y: 16, zIndex: 2, rotate: 0 },
})

const boxes: Record<BlockType, { desktop:number; tablet:number; mobile:number; minHeight:number }> = {
  frame:{desktop:620,tablet:620,mobile:350,minHeight:320}, container:{desktop:760,tablet:700,mobile:350,minHeight:320}, row:{desktop:760,tablet:700,mobile:350,minHeight:220}, column:{desktop:380,tablet:360,mobile:350,minHeight:340},
  header:{desktop:1120,tablet:790,mobile:358,minHeight:90}, search:{desktop:520,tablet:500,mobile:350,minHeight:48}, hero:{desktop:900,tablet:760,mobile:350,minHeight:380}, banner:{desktop:780,tablet:700,mobile:350,minHeight:230}, carousel:{desktop:900,tablet:760,mobile:350,minHeight:260},
  card:{desktop:340,tablet:330,mobile:350,minHeight:260}, product:{desktop:290,tablet:290,mobile:350,minHeight:390}, showcase:{desktop:1040,tablet:790,mobile:358,minHeight:520}, category:{desktop:900,tablet:760,mobile:350,minHeight:260}, brand:{desktop:900,tablet:760,mobile:350,minHeight:260}, distribution:{desktop:900,tablet:760,mobile:350,minHeight:260}, promotion:{desktop:1040,tablet:790,mobile:358,minHeight:520},
  text:{desktop:360,tablet:340,mobile:350,minHeight:48}, button:{desktop:190,tablet:190,mobile:220,minHeight:46}, image:{desktop:380,tablet:360,mobile:350,minHeight:240}, video:{desktop:580,tablet:560,mobile:350,minHeight:340}, gallery:{desktop:760,tablet:700,mobile:350,minHeight:360}, faq:{desktop:580,tablet:560,mobile:350,minHeight:260}, form:{desktop:580,tablet:560,mobile:350,minHeight:360}, footer:{desktop:1120,tablet:790,mobile:358,minHeight:190}, map:{desktop:580,tablet:560,mobile:350,minHeight:300}, html:{desktop:580,tablet:560,mobile:350,minHeight:240},
}

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
  const box = boxes[type]
  style.desktop = { ...style.desktop, width:`${box.desktop}px`, minHeight:box.minHeight, positionMode:'free' }
  style.tablet = { ...style.tablet, width:`${box.tablet}px`, minHeight:box.minHeight, positionMode:'free' }
  style.mobile = { ...style.mobile, width:`${box.mobile}px`, minHeight:box.minHeight, positionMode:'free' }
  return {
    id: uid(type), type, name: name || def.name, parentId, order: 0, locked: false, hidden: false, hiddenOn: {},
    props: clone(def.props), style: { ...style, ...(def.style || {}) },
    meta: { createdAt: now, createdBy: 'Administrador', updatedAt: now, version: 1, status: 'draft' },
  }
}

const header = makeBlock('header'); header.order = 0
const hero = makeBlock('hero'); hero.order = 1; hero.style.desktop.y = 150; hero.style.tablet.y = 130; hero.style.mobile.y = 120
const showcase = makeBlock('showcase'); showcase.order = 2; showcase.style.desktop.y = 600; showcase.style.tablet.y = 560; showcase.style.mobile.y = 540; showcase.style.desktop.columns = 4; showcase.style.tablet.columns = 2; showcase.style.mobile.columns = 1
const footer = makeBlock('footer'); footer.order = 3; footer.style.desktop.y = 1250; footer.style.tablet.y = 1150; footer.style.mobile.y = 1100

export const defaultDocument: EditorDocument = {
  id: 'home-draft', pageId: 'home', name: 'Página Inicial', status: 'draft', blocks: [header, hero, showcase, footer],
  designSystem: clone(defaultDesignSystem), identity: clone(defaultIdentity), theme: clone(defaultTheme), canvas: clone(defaultCanvas), updatedAt: new Date().toISOString(),
}

export const blankDocument = (): EditorDocument => ({
  id: uid('doc'), pageId: 'home', name: 'Página Inicial', status: 'draft', blocks: [], designSystem: clone(defaultDesignSystem),
  identity: clone(defaultIdentity), theme: clone(defaultTheme), canvas: clone(defaultCanvas), updatedAt: new Date().toISOString(),
})

export const blockLibrary: Array<{ type: BlockType; label: string; group: string; description: string }> = [
  { type: 'frame', label: 'Quadro / Frame', group: 'Estrutura Livre', description: 'Área vazia que pode ficar em qualquer ponto da página.' },
  { type: 'container', label: 'Container', group: 'Estrutura Livre', description: 'Agrupador livre, reposicionável e redimensionável.' },
  { type: 'row', label: 'Linha', group: 'Estrutura Livre', description: 'Estrutura móvel para composição horizontal.' },
  { type: 'column', label: 'Coluna', group: 'Estrutura Livre', description: 'Estrutura móvel para composição vertical.' },
  { type: 'header', label: 'Cabeçalho', group: 'Estrutura Livre', description: 'Cabeçalho que pode ser movido para qualquer posição.' },
  { type: 'footer', label: 'Rodapé', group: 'Estrutura Livre', description: 'Rodapé reposicionável como qualquer outro elemento.' },
  { type: 'search', label: 'Barra de Pesquisa', group: 'Elementos', description: 'Pesquisa independente, movível e removível.' },
  { type: 'text', label: 'Texto', group: 'Elementos', description: 'Texto independente com tipografia própria.' },
  { type: 'button', label: 'Botão', group: 'Elementos', description: 'Botão independente e redimensionável.' },
  { type: 'image', label: 'Imagem', group: 'Elementos', description: 'Imagem livre em qualquer ponto da página.' },
  { type: 'card', label: 'Card / Quadro', group: 'Elementos', description: 'Card livre; use preset ou monte do zero.' },
  { type: 'hero', label: 'Hero / Banner', group: 'Banners', description: 'Banner principal totalmente reposicionável.' },
  { type: 'banner', label: 'Banner', group: 'Banners', description: 'Banner livre para qualquer posição.' },
  { type: 'carousel', label: 'Carrossel', group: 'Banners', description: 'Carrossel reposicionável.' },
  { type: 'product', label: 'Produto', group: 'Catálogo', description: 'Produto individual em qualquer posição.' },
  { type: 'showcase', label: 'Vitrine Inteligente', group: 'Catálogo', description: 'Vitrine conectada aos dados, mas livre na página.' },
  { type: 'promotion', label: 'Promoção', group: 'Catálogo', description: 'Coleção promocional livre; pode misturar estruturas.' },
  { type: 'category', label: 'Categorias', group: 'Catálogo', description: 'Navegação por categoria reposicionável.' },
  { type: 'brand', label: 'Marcas', group: 'Catálogo', description: 'Navegação por marca reposicionável.' },
  { type: 'distribution', label: 'Distribuições', group: 'Catálogo', description: 'Navegação por distribuição reposicionável.' },
  { type: 'video', label: 'Vídeo', group: 'Mídia', description: 'Vídeo livre e redimensionável.' },
  { type: 'gallery', label: 'Galeria', group: 'Mídia', description: 'Galeria livre e redimensionável.' },
  { type: 'faq', label: 'FAQ', group: 'Conteúdo', description: 'FAQ movível com itens configuráveis.' },
  { type: 'form', label: 'Formulário', group: 'Conteúdo', description: 'Formulário livre com campos configuráveis.' },
  { type: 'map', label: 'Mapa', group: 'Conteúdo', description: 'Localização reposicionável.' },
  { type: 'html', label: 'HTML', group: 'Avançado', description: 'HTML isolado em sandbox e reposicionável.' },
]
