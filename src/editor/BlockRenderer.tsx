import React, { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Search, ChevronRight, MapPin, Play, Send } from 'lucide-react'
import type { BuilderBlock, Device, EditorDocument, SourceType } from './types'
import { AsteryonMark } from '../components/AsteryonMark'
import { demoProducts, resolveSmartProducts } from '../catalog/data'

const px = (value?: number) => value == null ? undefined : `${value}px`
const partStyle = (value: unknown): CSSProperties => value && typeof value === 'object' && !Array.isArray(value) ? value as CSSProperties : {}
const bool = (value: unknown, fallback = true) => value == null ? fallback : Boolean(value)

export function positionStyleForBlock(block: BuilderBlock, device: Device): CSSProperties {
  const d = block.style[device] || {}
  if (d.positionMode !== 'free') return { position: 'relative' }
  return {
    position: 'absolute', left: px(d.x || 0), top: px(d.y || 0), width: d.width || 'auto',
    minHeight: px(d.minHeight), height: px(d.height), zIndex: d.zIndex || 1,
    transform: d.rotate ? `rotate(${d.rotate}deg)` : undefined,
  }
}

export function styleForBlock(block: BuilderBlock, document: EditorDocument, device: Device): CSSProperties {
  const d = block.style[device] || {}
  return {
    width: d.width || 'auto', minHeight: px(d.minHeight), height: px(d.height),
    marginTop: px(d.marginTop), marginRight: px(d.marginRight), marginBottom: px(d.marginBottom), marginLeft: px(d.marginLeft),
    paddingTop: px(d.paddingTop), paddingRight: px(d.paddingRight), paddingBottom: px(d.paddingBottom), paddingLeft: px(d.paddingLeft), gap: px(d.gap),
    background: block.style.gradient || block.style.background,
    backgroundImage: block.style.backgroundImage ? `url(${block.style.backgroundImage})` : undefined,
    backgroundSize: block.style.backgroundSize || (block.style.backgroundImage ? 'cover' : undefined),
    backgroundPosition: block.style.backgroundPosition || (block.style.backgroundImage ? 'center' : undefined),
    color: block.style.color,
    border: `${block.style.borderWidth || 0}px solid ${block.style.borderColor || document.designSystem.borderColor}`,
    borderRadius: px(block.style.borderRadius), boxShadow: block.style.shadow === 'global' ? document.designSystem.shadow : block.style.shadow,
    fontFamily: block.style.fontFamily || document.designSystem.primaryFont, fontWeight: block.style.fontWeight,
    letterSpacing: px(block.style.letterSpacing), lineHeight: block.style.lineHeight,
    opacity: (block.style.opacity ?? 100) / 100, fontSize: px(d.fontSize), textAlign: d.textAlign,
    display: d.display, gridTemplateColumns: d.display === 'grid' ? `repeat(${d.columns || 1}, minmax(0, 1fr))` : undefined,
    transition: `all ${block.style.transitionMs || 180}ms ease`, position: 'relative',
  }
}

function CompanyLogo({ document, mobile = false }: { document: EditorDocument; mobile?: boolean }) {
  const identity = document.identity || ({} as EditorDocument['identity'])
  const src = mobile ? identity.mobileLogo || identity.logo : identity.logo
  const width = Number(identity.logoWidth || 150)
  const height = Number(identity.logoHeight || 48)
  const gap = Number(identity.brandGap ?? 10)
  return <div className="portal-brand" style={{ gap }}>
    {src ? <img className="portal-logo-image" style={{ width, height, maxWidth: width, maxHeight: height }} src={src} alt="Logo" /> : <AsteryonMark size={Math.min(36, height)} />}
    {identity.showCompanyName !== false ? <strong className="portal-company-name">{identity.companyName || 'ASTERYON'}</strong> : null}
  </div>
}

interface ProductCardOptions {
  showImage?: boolean; showBrand?: boolean; showName?: boolean; showBreadcrumb?: boolean; showPrice?: boolean; showButton?: boolean
  buttonLabel?: string; imageHeight?: number; cardPadding?: number; cardRadius?: number; cardBackground?: string
}

function ProductCard({ product, options = {} }: { product: typeof demoProducts[number]; options?: ProductCardOptions }) {
  const showImage = options.showImage !== false
  const showBrand = options.showBrand !== false
  const showName = options.showName !== false
  const showBreadcrumb = options.showBreadcrumb !== false
  const showButton = options.showButton !== false
  const showPrice = Boolean(options.showPrice)
  return <article className="catalog-product-card" style={{ borderRadius: options.cardRadius, background: options.cardBackground }}>
    {showImage ? <div className="catalog-product-image" style={{ height: options.imageHeight || 170 }}><img src={product.image} alt={product.name} /></div> : null}
    <div className="catalog-product-body" style={{ padding: options.cardPadding || 14 }}>
      {showBrand ? <span className="catalog-product-brand">{product.brand}</span> : null}
      {showName ? <h3>{product.name}</h3> : null}
      {showBreadcrumb ? <div className="catalog-breadcrumb">{product.department} <ChevronRight size={12} /> {product.category} <ChevronRight size={12} /> {product.section}</div> : null}
      {showPrice && product.showPrice && product.price ? <strong className="catalog-price">R$ {product.price}</strong> : null}
      {showButton ? <button className="catalog-details">{options.buttonLabel || 'Ver informações'}</button> : null}
    </div>
  </article>
}

function showcaseOptions(block: BuilderBlock): ProductCardOptions {
  return {
    showImage: bool(block.props.showImage), showBrand: bool(block.props.showBrand), showName: bool(block.props.showName),
    showBreadcrumb: bool(block.props.showBreadcrumb), showPrice: Boolean(block.props.showPrice), showButton: bool(block.props.showButton),
    buttonLabel: String(block.props.buttonLabel || 'Ver informações'), imageHeight: Number(block.props.imageHeight || 170),
    cardPadding: Number(block.props.cardPadding || 14), cardRadius: Number(block.props.cardRadius || 18), cardBackground: String(block.props.cardBackground || '#FFFFFF'),
  }
}

function ShowcaseBlock({ block, device }: { block: BuilderBlock; device: Device }) {
  const source = String(block.props.source || 'featured') as SourceType
  const sourceValue = String(block.props.sourceValue || '')
  const limit = Number(block.props.limit || 8)
  const products = useMemo(() => resolveSmartProducts(source, sourceValue, limit), [source, sourceValue, limit])
  const columns = block.style[device]?.columns || (device === 'desktop' ? 4 : device === 'tablet' ? 2 : 1)
  const gap = Number(block.props.cardGap || block.style[device]?.gap || 16)
  const minWidth = Number(block.props.cardMinWidth || 220)
  const useAutoFit = Boolean(block.props.autoFitCards)
  const gridTemplateColumns = useAutoFit ? `repeat(auto-fit, minmax(${minWidth}px, 1fr))` : `repeat(${columns}, minmax(0, 1fr))`
  return <section className="catalog-section free-showcase-section">
    {bool(block.props.showHeader) ? <div className="catalog-section-title"><div>{bool(block.props.showKicker, false) && block.props.kicker ? <span className="catalog-kicker">{String(block.props.kicker)}</span> : null}<h2>{String(block.props.title || block.name)}</h2></div>{bool(block.props.showCount, false) ? <span>{products.length} itens</span> : null}</div> : null}
    <div className="catalog-product-grid" style={{ gridTemplateColumns, gap }}>{products.map(product => <ProductCard key={product.code} product={product} options={showcaseOptions(block)} />)}</div>
  </section>
}

function CategoryTiles({ kind, block, device }: { kind: 'category' | 'brand' | 'distribution'; block: BuilderBlock; device: Device }) {
  const values = Array.from(new Set(demoProducts.map(p => kind === 'category' ? p.category : kind === 'brand' ? p.brand : p.distribution)))
  const columns = block.style[device]?.columns || (device === 'desktop' ? 4 : device === 'tablet' ? 2 : 1)
  return <section className="catalog-section"><div className="catalog-section-title"><h2>{String(block.props.title || block.name)}</h2></div><div className="catalog-tile-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{values.map(value => <button key={value} className="catalog-tile"><span>{value}</span><ChevronRight size={18} /></button>)}</div></section>
}

function ThemeParticles({ document, device }: { document: EditorDocument; device: Device }) {
  const { theme } = document
  if (!theme.enabled || theme.name === 'Padrão' || !theme.particles) return null
  if (device === 'mobile' && !theme.animateMobile) return null
  if (device !== 'mobile' && !theme.animateDesktop) return null
  const symbols: Record<string, string[]> = { Natal: ['❄','✦','❅'], 'Black Friday':['◆','●','✦'], Carnaval:['◆','●','▲','✦'], 'Dia das Mães':['✿','❀','♥'], 'Dia dos Pais':['★','◆','✦'], 'Dia das Crianças':['●','■','▲','★'], 'Ano Novo':['✦','✧','✺'] }
  const list = symbols[theme.name] || ['✦']; const count = Math.max(6, Math.min(40, Math.round(theme.intensity / 3)))
  return <div className={`theme-particles theme-${theme.name.toLowerCase().replaceAll(' ', '-')}`}>{Array.from({ length: count }).map((_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * .35}s` }}>{list[i % list.length]}</span>)}</div>
}

export function PortalSurface({ document, device, children, visitorMode = false }: { document: EditorDocument; device: Device; children: ReactNode; visitorMode?: boolean }) {
  const design = document.designSystem
  const canvas = document.canvas
  const bg = canvas?.gradient || canvas?.background || design.pageBackground
  const vars = { '--ast-primary': design.primaryColor, '--ast-secondary': design.secondaryColor, '--ast-accent': design.accentColor, '--ast-page': bg, '--ast-card': design.cardBackground, '--ast-border': design.borderColor, '--ast-radius': `${design.cardRadius}px`, '--ast-button-radius': `${design.buttonRadius}px`, '--ast-shadow': design.shadow, '--ast-font': design.primaryFont } as CSSProperties
  const canvasStyle: CSSProperties = {
    ...vars, background: bg,
    backgroundImage: canvas?.backgroundImage ? `url(${canvas.backgroundImage})` : undefined,
    backgroundSize: canvas?.backgroundSize || 'cover', backgroundPosition: canvas?.backgroundPosition || 'center',
    minHeight: canvas?.[device]?.height ? `${canvas[device].height}px` : undefined,
  }
  return <div className={`portal-surface portal-${device} ${visitorMode ? 'visitor-mode' : ''}`} style={canvasStyle}><ThemeParticles document={document} device={device} />{children}</div>
}

function ChildLayer({ children }: { children?: ReactNode }) {
  return children ? <div className="element-children-layer">{children}</div> : null
}

export function BlockContent({ block, document, device, children }: { block: BuilderBlock; document: EditorDocument; device: Device; children?: ReactNode }) {
  const [query, setQuery] = useState('')
  const baseStyle = styleForBlock(block, document, device)
  const deviceColumns = block.style[device]?.columns || 1
  const titleStyle = partStyle(block.props.titleStyle), subtitleStyle = partStyle(block.props.subtitleStyle), ctaStyle = partStyle(block.props.ctaStyle), textStyle = partStyle(block.props.textStyle)
  const preset = block.props.showDefaultContent !== false

  switch (block.type) {
    case 'frame': return <div className="builder-frame" style={baseStyle}><ChildLayer>{children}</ChildLayer></div>
    case 'container': return <div className="builder-container" style={{ ...baseStyle, maxWidth: Number(block.props.maxWidth || 1280), marginInline: block.style[device]?.positionMode === 'free' ? undefined : 'auto' }}><ChildLayer>{children}</ChildLayer></div>
    case 'row': return <div style={{ ...baseStyle, display: 'flex', flexWrap: 'wrap' }}><ChildLayer>{children}</ChildLayer></div>
    case 'column': return <div style={{ ...baseStyle, display: 'flex', flexDirection: 'column' }}><ChildLayer>{children}</ChildLayer></div>
    case 'header': return <header className="portal-header" style={baseStyle}>{preset ? <><CompanyLogo document={document} mobile={device === 'mobile'} />{Boolean(block.props.showSearch) && <label className="portal-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produtos, marcas e categorias..." /></label>}{Boolean(block.props.showNav) && device !== 'mobile' && <nav><a href="#catalogo">Catálogo</a><a href="#promocoes">Promoções</a><a href="#marcas">Marcas</a></nav>}</> : null}<ChildLayer>{children}</ChildLayer></header>
    case 'search': return <label className="portal-search standalone-search" style={baseStyle}>{Boolean(block.props.showIcon ?? true) ? <Search size={18} /> : null}<input value={query} onChange={e => setQuery(e.target.value)} placeholder={String(block.props.placeholder || 'Buscar...')} /></label>
    case 'hero': return <section className="portal-hero" style={baseStyle}>{preset ? <><div className="portal-hero-copy"><span className="catalog-kicker">{String(block.props.eyebrow || '')}</span><h1 style={titleStyle}>{String(block.props.title || '')}</h1><p style={subtitleStyle}>{String(block.props.subtitle || '')}</p><a className="portal-cta" style={ctaStyle} href={String(block.props.ctaLink || '#')}>{String(block.props.ctaLabel || 'Saiba mais')}</a></div>{block.props.image ? <img className="portal-hero-image" src={String(block.props.image)} alt="" /> : <div className="portal-hero-art"><AsteryonMark size={112} /></div>}</> : null}<ChildLayer>{children}</ChildLayer></section>
    case 'banner': return <section className="portal-banner" style={baseStyle}>{preset ? <>{block.props.image ? <img src={String(block.props.image)} alt="" /> : null}<div><h2 style={titleStyle}>{String(block.props.title || '')}</h2><p style={subtitleStyle}>{String(block.props.subtitle || '')}</p><a style={ctaStyle} href={String(block.props.ctaLink || '#')}>{String(block.props.ctaLabel || 'Saiba mais')}</a></div></> : null}<ChildLayer>{children}</ChildLayer></section>
    case 'carousel': return <section className="portal-carousel" style={baseStyle}>{preset ? (block.props.slides as string[] || []).map((slide, index) => <div key={index} className="portal-carousel-slide">{slide}</div>) : null}<ChildLayer>{children}</ChildLayer></section>
    case 'showcase': return <div style={baseStyle}>{preset ? <ShowcaseBlock block={block} device={device} /> : null}<ChildLayer>{children}</ChildLayer></div>
    case 'promotion': return <div id="promocoes" style={baseStyle}>{preset ? <ShowcaseBlock block={{ ...block, props: { ...block.props, source: 'promotion' } }} device={device} /> : null}<ChildLayer>{children}</ChildLayer></div>
    case 'product': { const product = demoProducts.find(p => p.code === String(block.props.productCode)) || demoProducts[0]; return <div style={baseStyle}><ProductCard product={product} options={showcaseOptions(block)} /></div> }
    case 'category': return <div style={baseStyle}>{preset ? <CategoryTiles kind="category" block={block} device={device} /> : null}<ChildLayer>{children}</ChildLayer></div>
    case 'brand': return <div id="marcas" style={baseStyle}>{preset ? <CategoryTiles kind="brand" block={block} device={device} /> : null}<ChildLayer>{children}</ChildLayer></div>
    case 'distribution': return <div style={baseStyle}>{preset ? <CategoryTiles kind="distribution" block={block} device={device} /> : null}<ChildLayer>{children}</ChildLayer></div>
    case 'card': return <article className="free-card" style={baseStyle}>{preset ? <>{block.props.image ? <img src={String(block.props.image)} alt="" /> : null}<h3 style={titleStyle}>{String(block.props.title || '')}</h3><p style={textStyle}>{String(block.props.text || '')}</p></> : null}<ChildLayer>{children}</ChildLayer></article>
    case 'text': { const tag = String(block.props.tag || 'p'); if (tag === 'h1') return <h1 style={baseStyle}>{String(block.props.text || '')}</h1>; if (tag === 'h2') return <h2 style={baseStyle}>{String(block.props.text || '')}</h2>; if (tag === 'h3') return <h3 style={baseStyle}>{String(block.props.text || '')}</h3>; return <p style={baseStyle}>{String(block.props.text || '')}</p> }
    case 'button': return <a className="free-button" style={baseStyle} href={String(block.props.link || '#')} target={String(block.props.target || '_self')}>{String(block.props.label || 'Botão')}</a>
    case 'image': return block.props.src ? <img className="free-image" style={baseStyle} src={String(block.props.src)} alt={String(block.props.alt || '')} /> : <div className="empty-media" style={baseStyle}>Imagem — selecione um arquivo no painel</div>
    case 'video': return block.props.url ? <div className="video-shell" style={baseStyle}><video controls muted={Boolean(block.props.muted)} autoPlay={Boolean(block.props.autoplay)} src={String(block.props.url)} /></div> : <div className="empty-media" style={baseStyle}><Play /> Vídeo</div>
    case 'gallery': { const images = (block.props.images as string[] || []); return <div className="gallery-grid" style={{ ...baseStyle, display: 'grid', gridTemplateColumns: `repeat(${deviceColumns || 3}, minmax(0,1fr))` }}>{images.length ? images.map((src, i) => <img key={i} src={src} alt="" />) : <div className="empty-media">Galeria vazia</div>}</div> }
    case 'faq': return <section className="faq-block" style={baseStyle}>{(block.props.items as Array<{ question: string; answer: string }> || []).map((item, i) => <details key={i}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>
    case 'form': return <form className="form-block" style={baseStyle} onSubmit={e => e.preventDefault()}><h2>{String(block.props.title || 'Fale conosco')}</h2>{(block.props.fields as string[] || []).map(field => <label key={field}>{field}<input placeholder={field} /></label>)}<button><Send size={16} />{String(block.props.submitLabel || 'Enviar')}</button></form>
    case 'map': return <div className="map-block" style={baseStyle}><MapPin size={30} /><strong>{String(block.props.address || '')}</strong><span>Mapa será conectado ao provedor configurado em produção.</span></div>
    case 'html': return <iframe title="HTML customizado" className="html-sandbox" style={baseStyle} sandbox="" srcDoc={String(block.props.html || '')} />
    case 'footer': return <footer className="portal-footer" style={baseStyle}>{preset ? <><CompanyLogo document={document} /><p>{String(block.props.text || '')}</p></> : null}<ChildLayer>{children}</ChildLayer></footer>
    default: return <div style={baseStyle}>{children}</div>
  }
}
