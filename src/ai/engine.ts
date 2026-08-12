import { clone, makeBlock, uid } from '../editor/defaults'
import type { BuilderBlock, EditorDocument } from '../editor/types'
import { ASTERYON_AI_ALLOWED_RESEARCH_SCOPES } from './policy'
import type { AsteryonAiFinding, AsteryonAiIntent, AsteryonAiProposal } from './types'

type Palette = {
  name: string
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  shadow: string
  fontPrimary: string
  fontSecondary: string
  particles: boolean
}

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const palettes: Record<string, Palette> = {
  default: {
    name: 'ASTERYON Moderno', primary: '#0B5D3B', secondary: '#123A63', accent: '#E5B93D', background: '#F5F7FA', surface: '#FFFFFF', text: '#172230', shadow: '0 18px 50px rgba(9, 31, 52, .12)', fontPrimary: 'Inter, system-ui, sans-serif', fontSecondary: 'Inter, system-ui, sans-serif', particles: false,
  },
  junina: {
    name: 'Festa Junina Premium', primary: '#8E2C2C', secondary: '#174F49', accent: '#E8A83A', background: '#FFF7E7', surface: '#FFFCF4', text: '#2A2118', shadow: '0 18px 48px rgba(86, 48, 19, .16)', fontPrimary: 'Inter, system-ui, sans-serif', fontSecondary: 'Georgia, serif', particles: true,
  },
  natal: {
    name: 'Natal Luxo', primary: '#143A2E', secondary: '#7A1721', accent: '#D4AF37', background: '#F5F1E8', surface: '#FFFCF7', text: '#1F2A25', shadow: '0 18px 54px rgba(20, 58, 46, .16)', fontPrimary: 'Inter, system-ui, sans-serif', fontSecondary: 'Georgia, serif', particles: true,
  },
  blackfriday: {
    name: 'Black Friday Moderno', primary: '#0B0B0D', secondary: '#242429', accent: '#FFB800', background: '#111114', surface: '#1A1A1F', text: '#F8F8FA', shadow: '0 20px 60px rgba(0, 0, 0, .35)', fontPrimary: 'Inter, system-ui, sans-serif', fontSecondary: 'Inter, system-ui, sans-serif', particles: false,
  },
  carnaval: {
    name: 'Carnaval Contemporâneo', primary: '#5A2CA0', secondary: '#0E8B8C', accent: '#F5B700', background: '#FFF8F1', surface: '#FFFFFF', text: '#281B35', shadow: '0 18px 50px rgba(90, 44, 160, .15)', fontPrimary: 'Inter, system-ui, sans-serif', fontSecondary: 'Inter, system-ui, sans-serif', particles: true,
  },
  chocolate: {
    name: 'Chocolate Premium Elegante', primary: '#4A2C23', secondary: '#7D4E3A', accent: '#D6B16B', background: '#F6EFE8', surface: '#FFFDFC', text: '#2A1C17', shadow: '0 20px 55px rgba(74, 44, 35, .18)', fontPrimary: 'Inter, system-ui, sans-serif', fontSecondary: 'Georgia, serif', particles: false,
  },
  bebidas: {
    name: 'Distribuidora de Bebidas Moderna', primary: '#0A4B78', secondary: '#0D7C66', accent: '#F2A900', background: '#F2F8FB', surface: '#FFFFFF', text: '#132635', shadow: '0 18px 50px rgba(10, 75, 120, .14)', fontPrimary: 'Inter, system-ui, sans-serif', fontSecondary: 'Inter, system-ui, sans-serif', particles: false,
  },
}

const choosePalette = (prompt: string): Palette => {
  const p = normalized(prompt)
  if (p.includes('festa junina') || p.includes('sao joao')) return palettes.junina
  if (p.includes('natal')) return palettes.natal
  if (p.includes('black friday')) return palettes.blackfriday
  if (p.includes('carnaval')) return palettes.carnaval
  if (p.includes('chocolate')) return palettes.chocolate
  if (p.includes('bebida') || p.includes('distribuidora')) return palettes.bebidas
  return palettes.default
}

export const resolveAsteryonAiIntent = (prompt: string): AsteryonAiIntent => {
  const p = normalized(prompt)
  if (p.includes('analis') && (p.includes('pagina') || p.includes('design'))) return 'design-audit'
  if (p.includes('melhor') && p.includes('pagina')) return 'improve'
  if (p.includes('estrutura') || p.includes('categoria') || p.includes('catalogo')) return 'catalog-structure'
  if (p.includes('identidade') || p.includes('branding') || p.includes('logo')) return 'identity'
  if (p.includes('landing')) return 'landing'
  if (p.includes('campanha')) return 'campaign'
  if (p.includes('banner')) return 'banner'
  if (p.includes('imagem') || p.includes('hero image') || p.includes('arte')) return 'image'
  if (p.includes('fundo') || p.includes('background') || p.includes('textura')) return 'background'
  if (p.includes('tema')) return 'theme'
  if (p.includes('home') || p.includes('layout') || p.includes('pagina moderna')) return 'layout'
  if (p.includes('texto') || p.includes('titulo') || p.includes('cta') || p.includes('copy')) return 'copy'
  return 'suggestions'
}

const applyPalette = (document: EditorDocument, palette: Palette): EditorDocument => {
  const doc = clone(document)
  doc.status = 'draft'
  doc.updatedAt = new Date().toISOString()
  doc.theme = {
    ...doc.theme,
    name: palette.name,
    enabled: true,
    intensity: 58,
    particles: palette.particles,
    animateDesktop: true,
    animateMobile: false,
  }
  doc.designSystem = {
    ...doc.designSystem,
    primaryFont: palette.fontPrimary,
    secondaryFont: palette.fontSecondary,
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    accentColor: palette.accent,
    pageBackground: palette.background,
    cardBackground: palette.surface,
    borderColor: `${palette.primary}22`,
    shadow: palette.shadow,
    cardRadius: 20,
    buttonRadius: 12,
    spacingUnit: 8,
  }
  doc.blocks = doc.blocks.map(block => {
    const next = clone(block)
    if (next.type === 'header') {
      next.style.background = palette.primary
      next.style.color = '#FFFFFF'
    }
    if (next.type === 'hero') {
      next.style.background = palette.primary
      next.style.gradient = `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`
      next.style.color = '#FFFFFF'
      next.style.borderRadius = 28
      next.style.shadow = palette.shadow
    }
    if (['card', 'product'].includes(next.type)) {
      next.style.background = palette.surface
      next.style.color = palette.text
      next.style.borderRadius = 20
      next.style.shadow = palette.shadow
    }
    if (next.type === 'footer') {
      next.style.background = palette.secondary
      next.style.color = '#FFFFFF'
    }
    return next
  })
  return doc
}

const campaignCopy = (prompt: string) => {
  const p = normalized(prompt)
  if (p.includes('dia das criancas')) return { title: 'Diversão que cabe no carrinho', subtitle: 'Uma seleção alegre para celebrar os pequenos com praticidade e variedade.', cta: 'Ver seleção' }
  if (p.includes('natal')) return { title: 'Celebre com escolhas que encantam', subtitle: 'Uma curadoria especial para transformar cada momento de fim de ano.', cta: 'Explorar campanha' }
  if (p.includes('black friday')) return { title: 'Oportunidades em destaque', subtitle: 'Uma vitrine direta, moderna e organizada para facilitar a descoberta das melhores condições.', cta: 'Ver destaques' }
  if (p.includes('festa junina')) return { title: 'Sabores para um arraiá inesquecível', subtitle: 'Seleções temáticas, cores acolhedoras e produtos para deixar a festa ainda mais completa.', cta: 'Entrar no arraiá' }
  if (p.includes('chocolate')) return { title: 'Chocolate em uma experiência premium', subtitle: 'Uma apresentação elegante para valorizar textura, sabor e desejo de compra.', cta: 'Descobrir seleção' }
  return { title: 'Descubra uma seleção feita para você', subtitle: 'Produtos organizados com clareza, destaque visual e uma navegação mais agradável.', cta: 'Explorar catálogo' }
}

const buildLayout = (document: EditorDocument, prompt: string): EditorDocument => {
  const palette = choosePalette(prompt)
  const doc = applyPalette(document, palette)
  const copy = campaignCopy(prompt)

  const header = makeBlock('header')
  header.order = 0
  header.style.background = palette.primary

  const hero = makeBlock('hero')
  hero.order = 1
  hero.props = { ...hero.props, eyebrow: 'CATÁLOGO DIGITAL', title: copy.title, subtitle: copy.subtitle, ctaLabel: copy.cta, ctaLink: '#destaques' }
  hero.style.background = palette.primary
  hero.style.gradient = `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`
  hero.style.shadow = palette.shadow
  hero.style.desktop.minHeight = 420
  hero.style.tablet.minHeight = 340
  hero.style.mobile.minHeight = 300

  const categories = makeBlock('category')
  categories.order = 2
  categories.props = { ...categories.props, title: 'Navegue por categorias' }
  categories.style.background = 'transparent'
  categories.style.desktop.columns = 6
  categories.style.tablet.columns = 3
  categories.style.mobile.columns = 2

  const showcase = makeBlock('showcase')
  showcase.order = 3
  showcase.props = { ...showcase.props, title: 'Destaques do catálogo', source: 'featured', limit: 8 }
  showcase.style.background = 'transparent'
  showcase.style.desktop.columns = 4
  showcase.style.tablet.columns = 2
  showcase.style.mobile.columns = 1

  const promotion = makeBlock('promotion')
  promotion.order = 4
  promotion.props = { ...promotion.props, title: 'Promoções em evidência', source: 'promotion', sourceValue: 'Campanha ASTERYON', limit: 6 }
  promotion.style.background = 'transparent'
  promotion.style.desktop.columns = 3
  promotion.style.tablet.columns = 2
  promotion.style.mobile.columns = 1

  const brands = makeBlock('brand')
  brands.order = 5
  brands.props = { ...brands.props, title: 'Marcas que você encontra aqui' }
  brands.style.background = 'transparent'
  brands.style.desktop.columns = 6
  brands.style.tablet.columns = 4
  brands.style.mobile.columns = 2

  const distribution = makeBlock('distribution')
  distribution.order = 6
  distribution.props = { ...distribution.props, title: 'Distribuições' }
  distribution.style.background = 'transparent'
  distribution.style.desktop.columns = 4
  distribution.style.tablet.columns = 2
  distribution.style.mobile.columns = 1

  const footer = makeBlock('footer')
  footer.order = 7
  footer.style.background = palette.secondary
  footer.props = { ...footer.props, text: `© ${doc.identity.companyName} — Catálogo Digital` }

  doc.blocks = [header, hero, categories, showcase, promotion, brands, distribution, footer]
  return doc
}

const addBanner = (document: EditorDocument, prompt: string): EditorDocument => {
  const palette = choosePalette(prompt)
  const doc = applyPalette(document, palette)
  const copy = campaignCopy(prompt)
  const banner = makeBlock('banner')
  banner.props = { ...banner.props, title: copy.title, subtitle: copy.subtitle, ctaLabel: copy.cta, ctaLink: '#promocoes' }
  banner.style.background = palette.secondary
  banner.style.gradient = `linear-gradient(120deg, ${palette.secondary}, ${palette.primary})`
  banner.style.color = '#FFFFFF'
  banner.style.shadow = palette.shadow
  const heroIndex = doc.blocks.findIndex(b => b.type === 'hero')
  const targetOrder = heroIndex >= 0 ? doc.blocks[heroIndex].order + 1 : 1
  doc.blocks.forEach(b => { if (b.parentId === null && b.order >= targetOrder) b.order += 1 })
  banner.order = targetOrder
  doc.blocks.push(banner)
  return doc
}

const improveDocument = (document: EditorDocument): EditorDocument => {
  const doc = clone(document)
  doc.status = 'draft'
  doc.designSystem = {
    ...doc.designSystem,
    cardRadius: Math.max(16, doc.designSystem.cardRadius),
    buttonRadius: Math.max(10, doc.designSystem.buttonRadius),
    spacingUnit: 8,
    shadow: '0 16px 42px rgba(12, 32, 56, .11)',
  }
  doc.blocks = doc.blocks.map(block => {
    const next = clone(block)
    next.style.transitionMs = 180
    next.style.hoverScale = ['card', 'product'].includes(next.type) ? 1.02 : 1
    next.style.mobile = { ...next.style.mobile, width: '100%', columns: 1, gap: Math.min(next.style.mobile.gap || 12, 16) }
    next.style.tablet = { ...next.style.tablet, columns: Math.min(next.style.tablet.columns || 2, 2) }
    if (['showcase', 'promotion'].includes(next.type)) {
      next.style.desktop.columns = Math.min(next.style.desktop.columns || 4, 4)
      next.style.tablet.columns = 2
      next.style.mobile.columns = 1
    }
    return next
  })
  doc.updatedAt = new Date().toISOString()
  return doc
}

const backgroundDocument = (document: EditorDocument, prompt: string): EditorDocument => {
  const palette = choosePalette(prompt)
  const doc = clone(document)
  doc.status = 'draft'
  doc.designSystem.pageBackground = palette.background
  doc.blocks = doc.blocks.map(block => {
    const next = clone(block)
    if (['category', 'brand', 'distribution', 'showcase', 'promotion'].includes(next.type)) next.style.background = 'transparent'
    if (next.type === 'hero') {
      next.style.gradient = `radial-gradient(circle at 20% 20%, ${palette.accent}44 0, transparent 34%), linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`
      next.style.background = palette.primary
    }
    return next
  })
  doc.updatedAt = new Date().toISOString()
  return doc
}

const contrastRatio = (hexA: string, hexB: string) => {
  const parse = (hex: string) => {
    const clean = hex.replace('#', '')
    if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return [0, 0, 0]
    return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  }
  const [ra, ga, ba] = parse(hexA)
  const [rb, gb, bb] = parse(hexB)
  const la = 0.2126 * ra + 0.7152 * ga + 0.0722 * ba
  const lb = 0.2126 * rb + 0.7152 * gb + 0.0722 * bb
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const auditDesign = (document: EditorDocument): AsteryonAiFinding[] => {
  const findings: AsteryonAiFinding[] = []
  const contrast = contrastRatio(document.designSystem.primaryColor, '#FFFFFF')
  if (contrast < 4.5) findings.push({ severity: 'warning', area: 'contrast', title: 'Contraste da cor primária', description: `Contraste estimado de ${contrast.toFixed(2)}:1 com branco.`, suggestion: 'Ajuste a tonalidade principal para alcançar pelo menos 4.5:1 em textos normais.' })
  else findings.push({ severity: 'info', area: 'contrast', title: 'Contraste principal adequado', description: `Contraste estimado de ${contrast.toFixed(2)}:1 com branco.`, suggestion: 'Mantenha a mesma disciplina nos estados hover, banners e textos sobre imagens.' })

  const mobileIssues = document.blocks.filter(b => (b.style.mobile.columns || 1) > 1 && ['showcase', 'promotion', 'product'].includes(b.type))
  if (mobileIssues.length) findings.push({ severity: 'warning', area: 'mobile', title: 'Densidade elevada no mobile', description: `${mobileIssues.length} bloco(s) usam mais de uma coluna em telas pequenas.`, suggestion: 'Priorize uma coluna para vitrines e promoções quando a legibilidade do card for mais importante que densidade.' })
  else findings.push({ severity: 'info', area: 'mobile', title: 'Grade mobile consistente', description: 'As principais vitrines estão configuradas para leitura confortável em telas pequenas.', suggestion: 'Valide também imagens, CTAs e tamanho de fonte em 320–390 px.' })

  if (document.designSystem.spacingUnit < 6) findings.push({ severity: 'warning', area: 'spacing', title: 'Escala de espaçamento muito compacta', description: 'A unidade global de espaçamento pode gerar componentes visualmente apertados.', suggestion: 'Use uma base entre 8 e 10 px e múltiplos consistentes.' })
  else findings.push({ severity: 'info', area: 'spacing', title: 'Escala de espaçamento coerente', description: `Unidade global de ${document.designSystem.spacingUnit}px.`, suggestion: 'Mantenha múltiplos consistentes para reforçar ritmo visual.' })

  if (!document.identity.companyName.trim()) findings.push({ severity: 'critical', area: 'seo', title: 'Nome institucional ausente', description: 'O nome da empresa está vazio na identidade visual.', suggestion: 'Preencha o nome para títulos, metadados e contexto do catálogo.' })

  const unnamedImages = document.blocks.filter(b => b.type === 'image' && !String(b.props.alt || '').trim())
  if (unnamedImages.length) findings.push({ severity: 'warning', area: 'accessibility', title: 'Imagens sem texto alternativo', description: `${unnamedImages.length} imagem(ns) não possuem descrição alternativa.`, suggestion: 'Adicione alt text objetivo e contextual.' })

  findings.push({ severity: 'info', area: 'performance', title: 'Performance de mídia', description: 'O Editor deve manter imagens responsivas e evitar vídeos automáticos pesados no mobile.', suggestion: 'Use formatos modernos, dimensões adequadas e lazy loading para mídia abaixo da dobra.' })
  return findings
}

const catalogStructure = (prompt: string) => {
  const p = normalized(prompt)
  if (p.includes('bebida')) return {
    primaryAxis: 'Bebidas',
    hierarchy: [
      { name: 'Refrigerantes', children: ['Cola', 'Guaraná', 'Cítricos', 'Zero açúcar'] },
      { name: 'Águas', children: ['Mineral', 'Com gás', 'Saborizada'] },
      { name: 'Sucos', children: ['Integral', 'Néctar', 'Pronto para beber'] },
      { name: 'Energéticos', children: ['Tradicional', 'Zero açúcar'] },
    ],
    alternativeNavigation: { axis: 'Marcas', examples: ['Marca A', 'Marca B', 'Marca C'] },
    rule: 'Produtos permanecem na própria hierarquia. Somente Promoções podem misturar itens de estruturas diferentes.',
  }
  if (p.includes('alimento')) return {
    primaryAxis: 'Alimentos',
    hierarchy: [
      { name: 'Mercearia', children: ['Arroz e grãos', 'Massas', 'Molhos', 'Cafés'] },
      { name: 'Bomboniere', children: ['Chocolates', 'Biscoitos', 'Balas'] },
      { name: 'Conservas', children: ['Vegetais', 'Molhos', 'Azeitonas'] },
    ],
    alternativeNavigation: { axis: 'Marcas', examples: ['Marca A', 'Marca B', 'Marca C'] },
    rule: 'Produtos permanecem na própria hierarquia. Somente Promoções podem misturar itens de estruturas diferentes.',
  }
  return {
    primaryAxis: 'Departamentos',
    hierarchy: [
      { name: 'Departamento 1', children: ['Categoria A', 'Categoria B'] },
      { name: 'Departamento 2', children: ['Categoria C', 'Categoria D'] },
    ],
    alternativeNavigation: { axis: 'Marcas', examples: ['Marca A', 'Marca B'] },
    rule: 'A IA sugere a estrutura, mas não altera produtos reais sem aprovação.',
  }
}

const proposalBase = (prompt: string, intent: AsteryonAiIntent): Omit<AsteryonAiProposal, 'title' | 'summary' | 'structured' | 'canApply'> => ({
  id: uid('ai'),
  intent,
  stage: 'generated',
  createdAt: new Date().toISOString(),
  source: 'safe-local-engine',
  prompt,
  requiresApproval: true,
  productionTouched: false,
  research: {
    requested: false,
    used: false,
    allowedScopes: ASTERYON_AI_ALLOWED_RESEARCH_SCOPES,
    note: 'O motor local não consulta a internet. Um provider externo pode usar pesquisa somente nas categorias permitidas e apenas como inspiração.',
  },
})

export const generateAsteryonAiProposal = (prompt: string, document: EditorDocument): AsteryonAiProposal => {
  const intent = resolveAsteryonAiIntent(prompt)
  const base = proposalBase(prompt, intent)
  const palette = choosePalette(prompt)
  const copy = campaignCopy(prompt)

  if (intent === 'design-audit') {
    const findings = auditDesign(document)
    return { ...base, title: 'Análise de Design', summary: 'Relatório de contraste, mobile, espaçamento, acessibilidade, SEO e performance sem alterar o rascunho.', structured: { scoreHint: Math.max(0, 100 - findings.filter(f => f.severity === 'critical').length * 25 - findings.filter(f => f.severity === 'warning').length * 8), checks: findings.length }, findings, canApply: false }
  }

  if (intent === 'catalog-structure') {
    return { ...base, title: 'Estrutura de Catálogo Sugerida', summary: 'Arquitetura de informação original para organizar o catálogo sem modificar produtos reais.', structured: catalogStructure(prompt), canApply: false }
  }

  if (intent === 'image') {
    const imagePrompt = `Arte original para catálogo digital ASTERYON. ${prompt}. Composição premium, moderna, sem logotipos de terceiros, sem texto incorporado, espaço negativo para CTA, pronta para recorte responsivo desktop e mobile.`
    return { ...base, title: 'Briefing de Imagem por IA', summary: 'Prompt estruturado para gerar uma arte original. Nenhuma imagem da internet é copiada.', structured: { format: 'hero/banner/background', originality: true, copyrightedReferenceReuse: false, responsiveSafeArea: true }, imagePrompt, canApply: false }
  }

  if (intent === 'suggestions') {
    const findings = auditDesign(document)
    return { ...base, title: 'Sugestões ASTERYON AI', summary: 'Melhorias priorizadas para UX, acessibilidade, mobile e performance.', structured: { priorities: ['Clareza de navegação', 'Hierarquia visual', 'Consistência de cards', 'Mobile first', 'SEO semântico'] }, findings, canApply: false }
  }

  let previewDocument: EditorDocument
  if (intent === 'layout' || intent === 'landing') previewDocument = buildLayout(document, prompt)
  else if (intent === 'background') previewDocument = backgroundDocument(document, prompt)
  else if (intent === 'banner') previewDocument = addBanner(document, prompt)
  else if (intent === 'campaign') {
    previewDocument = addBanner(buildLayout(document, prompt), prompt)
    const promo = previewDocument.blocks.find(b => b.type === 'promotion')
    if (promo) promo.props = { ...promo.props, title: copy.title, source: 'promotion', sourceValue: palette.name, limit: 6 }
  } else if (intent === 'improve') previewDocument = improveDocument(document)
  else if (intent === 'identity') {
    previewDocument = applyPalette(document, palette)
    previewDocument.identity = { ...previewDocument.identity, companyName: previewDocument.identity.companyName || 'ASTERYON' }
  } else if (intent === 'copy') {
    previewDocument = clone(document)
    const hero = previewDocument.blocks.find(b => b.type === 'hero')
    if (hero) hero.props = { ...hero.props, title: copy.title, subtitle: copy.subtitle, ctaLabel: copy.cta }
    previewDocument.status = 'draft'
  } else previewDocument = applyPalette(document, palette)

  const titleMap: Record<AsteryonAiIntent, string> = {
    theme: `Tema · ${palette.name}`,
    background: `Plano de Fundo · ${palette.name}`,
    layout: 'Layout de Home Gerado',
    landing: 'Landing Page Gerada',
    'catalog-structure': 'Estrutura de Catálogo',
    copy: 'Copy Original para o Portal',
    banner: 'Banner Original Gerado',
    campaign: `Campanha · ${palette.name}`,
    image: 'Imagem por IA',
    'design-audit': 'Análise de Design',
    improve: 'Melhoria Visual da Página',
    identity: `Identidade Visual · ${palette.name}`,
    suggestions: 'Sugestões ASTERYON AI',
  }

  return {
    ...base,
    title: titleMap[intent],
    summary: 'Proposta criada exclusivamente para Preview. Nada foi aplicado ao rascunho e a produção permanece intocada.',
    structured: {
      theme: palette.name,
      palette: { primary: palette.primary, secondary: palette.secondary, accent: palette.accent, background: palette.background, surface: palette.surface },
      typography: { primary: palette.fontPrimary, secondary: palette.fontSecondary },
      copy,
      mobile: { approach: 'mobile-first', showcaseColumns: 1, tabletColumns: 2 },
      accessibility: { contrastReview: true, altTextRequired: true, reducedMotionOnMobile: true },
      seo: { semanticHierarchy: true, descriptiveCopy: true },
      catalogRule: 'Somente Promoções podem misturar produtos de estruturas diferentes.',
    },
    previewDocument,
    canApply: true,
  }
}

export const cloneProposalWithStage = (proposal: AsteryonAiProposal, stage: AsteryonAiProposal['stage']): AsteryonAiProposal => ({ ...proposal, stage })

export const ensureDraftOnly = (document: EditorDocument): EditorDocument => {
  const doc = clone(document)
  doc.status = 'draft'
  doc.updatedAt = new Date().toISOString()
  doc.blocks = doc.blocks.map((block: BuilderBlock) => ({ ...block, meta: { ...block.meta, status: 'draft', updatedAt: new Date().toISOString() } }))
  return doc
}
