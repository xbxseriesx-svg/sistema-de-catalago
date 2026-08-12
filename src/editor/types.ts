export type Device = 'desktop' | 'tablet' | 'mobile'
export type PublishStatus = 'draft' | 'preview' | 'scheduled' | 'published' | 'archived'

export type BlockType =
  | 'frame' | 'container' | 'row' | 'column' | 'header' | 'search' | 'hero' | 'banner' | 'carousel'
  | 'card' | 'product' | 'showcase' | 'category' | 'brand' | 'distribution'
  | 'promotion' | 'text' | 'button' | 'image' | 'video' | 'gallery' | 'faq'
  | 'form' | 'footer' | 'map' | 'html'

export type SourceType =
  | 'manual' | 'category' | 'brand' | 'distribution' | 'promotion'
  | 'mostViewed' | 'mostSearched' | 'newest' | 'featured'

export interface DeviceStyle {
  width?: string
  minHeight?: number
  height?: number
  columns?: number
  gap?: number
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  display?: 'block' | 'flex' | 'grid'
  positionMode?: 'flow' | 'free'
  x?: number
  y?: number
  zIndex?: number
  rotate?: number
}

export interface BlockStyle {
  background?: string
  color?: string
  gradient?: string
  backgroundImage?: string
  backgroundSize?: 'cover' | 'contain' | 'auto'
  backgroundPosition?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  shadow?: string
  fontFamily?: string
  fontWeight?: number
  letterSpacing?: number
  lineHeight?: number
  opacity?: number
  hoverScale?: number
  transitionMs?: number
  desktop: DeviceStyle
  tablet: DeviceStyle
  mobile: DeviceStyle
}

export interface BuilderBlock {
  id: string
  type: BlockType
  name: string
  parentId: string | null
  order: number
  locked: boolean
  hidden: boolean
  hiddenOn: Partial<Record<Device, boolean>>
  props: Record<string, unknown>
  style: BlockStyle
  meta: {
    createdAt: string
    createdBy: string
    updatedAt: string
    version: number
    status: PublishStatus
  }
}

export interface DesignSystem {
  primaryFont: string
  secondaryFont: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  pageBackground: string
  cardBackground: string
  cardRadius: number
  buttonRadius: number
  borderColor: string
  shadow: string
  spacingUnit: number
}

export interface IdentityConfig {
  companyName: string
  showCompanyName: boolean
  logo: string
  mobileLogo: string
  logoWidth: number
  logoHeight: number
  brandGap: number
  favicon: string
  pwaIcon: string
  watermark: string
}

export interface ThemeConfig {
  name: string
  enabled: boolean
  intensity: number
  particles: boolean
  animateDesktop: boolean
  animateMobile: boolean
}

export interface CanvasDeviceConfig {
  width: number
  height: number
}

export interface CanvasConfig {
  background: string
  gradient: string
  backgroundImage: string
  backgroundSize: 'cover' | 'contain' | 'auto'
  backgroundPosition: string
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  desktop: CanvasDeviceConfig
  tablet: CanvasDeviceConfig
  mobile: CanvasDeviceConfig
}

export interface EditorDocument {
  id: string
  pageId: string
  name: string
  status: PublishStatus
  blocks: BuilderBlock[]
  designSystem: DesignSystem
  identity: IdentityConfig
  theme: ThemeConfig
  canvas: CanvasConfig
  updatedAt: string
}

export interface EditorPage {
  id: string
  slug: string
  name: string
  order: number
  active: boolean
  document: EditorDocument
  createdAt: string
  updatedAt: string
}

export interface ActivityEntry { id: string; at: string; action: string; label: string; blockId?: string }
export interface Snapshot { id: string; at: string; label: string; document: EditorDocument }
export interface PublishedVersion { id: string; number: number; at: string; status: PublishStatus; label: string; document: EditorDocument }
export interface Sandbox { id: string; name: string; createdAt: string; document: EditorDocument }
export interface SavedTemplate { id: string; name: string; type: BlockType; createdAt: string; block: BuilderBlock }
