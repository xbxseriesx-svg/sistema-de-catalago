import React, { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Eye, EyeOff, ImageOff, Lock, Paintbrush, Save, Trash2, Unlock } from 'lucide-react'
import { useEditorStore } from './store'
import type { BuilderBlock, Device, SourceType } from './types'

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use #RRGGBB')
const numericSchema = z.coerce.number().min(0).max(9999)

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = reject
  reader.readAsDataURL(file)
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="property-section"><h4>{title}</h4>{children}</section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="property-field"><span>{label}</span>{children}</label>
}

function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const safe = colorSchema.safeParse(value).success ? value! : '#FFFFFF'
  return <Field label={label}><div className="color-field"><input type="color" value={safe} onChange={e => onChange(e.target.value)} /><input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#RRGGBB" /></div></Field>
}

function NumberField({ label, value, onChange, min = 0, max = 9999, suffix }: { label: string; value?: number; onChange: (value: number) => void; min?: number; max?: number; suffix?: string }) {
  return <Field label={label}><div className="number-field"><input type="number" min={min} max={max} value={value ?? 0} onChange={e => onChange(numericSchema.parse(e.target.value))} />{suffix ? <span>{suffix}</span> : null}</div></Field>
}

function TextField({ label, value, onChange, multiline = false, placeholder = '' }: { label: string; value?: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string }) {
  return <Field label={label}>{multiline ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} /> : <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}</Field>
}

function UploadField({ label, value, onChange, accept = 'image/*' }: { label: string; value?: string; onChange: (value: string) => void; accept?: string }) {
  return <Field label={label}><div className="upload-field">{value ? <img src={value} alt="Prévia" /> : <div className="upload-empty">Sem arquivo</div>}<div><label className="small-upload">Escolher arquivo<input type="file" accept={accept} onChange={async e => { const file = e.target.files?.[0]; if (file) onChange(await fileToDataUrl(file)) }} /></label>{value ? <button type="button" className="danger-link" onClick={() => onChange('')}><ImageOff size={14} /> Remover</button> : null}</div></div></Field>
}

function ContentFields({ block }: { block: BuilderBlock }) {
  const updateProps = useEditorStore(s => s.updateBlockProps)
  const set = (patch: Record<string, unknown>, label?: string) => updateProps(block.id, patch, label)
  const source = String(block.props.source || 'featured') as SourceType

  return <>
    {['hero', 'banner', 'card', 'showcase', 'promotion', 'category', 'brand', 'distribution', 'form'].includes(block.type) && <TextField label="Título" value={String(block.props.title || '')} onChange={value => set({ title: value }, 'Título alterado')} />}
    {['hero', 'banner'].includes(block.type) && <TextField label="Subtítulo" value={String(block.props.subtitle || '')} multiline onChange={value => set({ subtitle: value }, 'Subtítulo alterado')} />}
    {block.type === 'hero' && <TextField label="Selo superior" value={String(block.props.eyebrow || '')} onChange={value => set({ eyebrow: value })} />}
    {block.type === 'text' && <><Field label="Tipo"><select value={String(block.props.tag || 'p')} onChange={e => set({ tag: e.target.value })}><option value="p">Parágrafo</option><option value="h1">Título H1</option><option value="h2">Título H2</option><option value="h3">Título H3</option></select></Field><TextField label="Texto" value={String(block.props.text || '')} multiline onChange={value => set({ text: value }, 'Texto alterado')} /></>}
    {block.type === 'card' && <TextField label="Descrição" value={String(block.props.text || '')} multiline onChange={value => set({ text: value })} />}
    {['hero', 'banner'].includes(block.type) && <><TextField label="Texto do botão" value={String(block.props.ctaLabel || '')} onChange={value => set({ ctaLabel: value })} /><TextField label="Link do botão" value={String(block.props.ctaLink || '')} onChange={value => set({ ctaLink: value })} /></>}
    {block.type === 'button' && <><TextField label="Texto" value={String(block.props.label || '')} onChange={value => set({ label: value })} /><TextField label="Link" value={String(block.props.link || '')} onChange={value => set({ link: value })} /><Field label="Abrir em"><select value={String(block.props.target || '_self')} onChange={e => set({ target: e.target.value })}><option value="_self">Mesma aba</option><option value="_blank">Nova aba</option></select></Field></>}
    {['hero', 'banner', 'card'].includes(block.type) && <UploadField label="Imagem" value={String(block.props.image || '')} onChange={value => set({ image: value }, value ? 'Imagem alterada' : 'Imagem removida')} />}
    {block.type === 'image' && <UploadField label="Imagem" value={String(block.props.src || '')} onChange={value => set({ src: value }, value ? 'Imagem alterada' : 'Imagem removida')} />}
    {block.type === 'video' && <TextField label="URL do vídeo" value={String(block.props.url || '')} onChange={value => set({ url: value })} />}
    {block.type === 'map' && <TextField label="Endereço" value={String(block.props.address || '')} onChange={value => set({ address: value })} />}
    {block.type === 'html' && <TextField label="HTML em sandbox" value={String(block.props.html || '')} multiline onChange={value => set({ html: value })} />}
    {block.type === 'header' && <><Field label="Pesquisa"><input type="checkbox" checked={Boolean(block.props.showSearch)} onChange={e => set({ showSearch: e.target.checked })} /></Field><Field label="Navegação"><input type="checkbox" checked={Boolean(block.props.showNav)} onChange={e => set({ showNav: e.target.checked })} /></Field><Field label="Fixo no topo"><input type="checkbox" checked={Boolean(block.props.sticky)} onChange={e => set({ sticky: e.target.checked })} /></Field></>}
    {['showcase', 'promotion', 'category', 'brand', 'distribution'].includes(block.type) && <>
      <Field label="Origem"><select value={source} onChange={e => set({ source: e.target.value })}><option value="manual">Manual</option><option value="category">Categoria</option><option value="brand">Marca</option><option value="distribution">Distribuição</option><option value="promotion">Promoção</option><option value="mostViewed">Mais acessados</option><option value="mostSearched">Mais pesquisados</option><option value="newest">Mais recentes</option><option value="featured">Destaques</option></select></Field>
      {['category', 'brand', 'distribution', 'promotion'].includes(source) && <TextField label="Filtro da origem" value={String(block.props.sourceValue || '')} onChange={value => set({ sourceValue: value })} />}
      <NumberField label="Limite de itens" value={Number(block.props.limit || 8)} min={1} max={48} onChange={value => set({ limit: value })} />
      {['showcase', 'promotion'].includes(block.type) && <Field label="Exibir preço quando cadastrado"><input type="checkbox" checked={Boolean(block.props.showPrice)} onChange={e => set({ showPrice: e.target.checked })} /></Field>}
    </>}
  </>
}

function BlockPanel({ block, device }: { block: BuilderBlock; device: Device }) {
  const updateBlock = useEditorStore(s => s.updateBlock)
  const updateStyle = useEditorStore(s => s.updateBlockStyle)
  const updateDeviceStyle = useEditorStore(s => s.updateDeviceStyle)
  const duplicate = useEditorStore(s => s.duplicateBlock)
  const remove = useEditorStore(s => s.deleteBlock)
  const toggleHidden = useEditorStore(s => s.toggleHidden)
  const toggleLocked = useEditorStore(s => s.toggleLocked)
  const copyStyle = useEditorStore(s => s.copyStyle)
  const pasteStyle = useEditorStore(s => s.pasteStyle)
  const saveAsTemplate = useEditorStore(s => s.saveAsTemplate)

  const d = block.style[device] || {}
  const setD = (patch: Record<string, unknown>, label?: string) => updateDeviceStyle(block.id, device, patch, label)

  return <div className="property-panel-content">
    <div className="selected-block-head"><div><span>{block.type}</span><h3>{block.name}</h3></div><button onClick={() => updateBlock(block.id, { name: `${block.name}` })}>•••</button></div>
    <div className="quick-actions">
      <button onClick={() => duplicate(block.id)} title="Duplicar"><Copy size={15} /></button>
      <button onClick={() => toggleHidden(block.id)} title={block.hidden ? 'Exibir' : 'Ocultar'}>{block.hidden ? <Eye size={15} /> : <EyeOff size={15} />}</button>
      <button onClick={() => toggleLocked(block.id)} title={block.locked ? 'Desbloquear' : 'Bloquear'}>{block.locked ? <Unlock size={15} /> : <Lock size={15} />}</button>
      <button onClick={() => copyStyle(block.id)} title="Copiar estilo"><Paintbrush size={15} /></button>
      <button onClick={() => pasteStyle(block.id)} title="Colar estilo"><Save size={15} /></button>
      <button onClick={() => saveAsTemplate(block.id, block.name)} title="Salvar como template">TPL</button>
      <button className="danger" onClick={() => remove(block.id)} title="Excluir"><Trash2 size={15} /></button>
    </div>

    <Section title="Conteúdo"><ContentFields block={block} /></Section>

    <Section title="Tipografia">
      <TextField label="Fonte" value={block.style.fontFamily || ''} onChange={value => updateStyle(block.id, { fontFamily: value }, 'Fonte alterada')} />
      <ColorField label="Cor do texto" value={block.style.color} onChange={value => updateStyle(block.id, { color: value }, 'Cor do texto alterada')} />
      <NumberField label={`Tamanho (${device})`} value={d.fontSize || 16} min={8} max={120} suffix="px" onChange={value => setD({ fontSize: value }, 'Tamanho da fonte alterado')} />
      <NumberField label="Peso" value={block.style.fontWeight || 400} min={100} max={900} onChange={value => updateStyle(block.id, { fontWeight: value })} />
      <NumberField label="Espaçamento" value={block.style.letterSpacing || 0} min={0} max={24} suffix="px" onChange={value => updateStyle(block.id, { letterSpacing: value })} />
      <Field label="Alinhamento"><select value={d.textAlign || 'left'} onChange={e => setD({ textAlign: e.target.value })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></Field>
    </Section>

    <Section title={`Layout · ${device}`}>
      <TextField label="Largura" value={d.width || '100%'} onChange={value => setD({ width: value }, 'Largura alterada')} />
      <NumberField label="Altura mínima" value={d.minHeight || 0} suffix="px" onChange={value => setD({ minHeight: value })} />
      <NumberField label="Colunas" value={d.columns || 1} min={1} max={12} onChange={value => setD({ columns: value }, 'Colunas alteradas')} />
      <NumberField label="Gap" value={d.gap || 0} max={160} suffix="px" onChange={value => setD({ gap: value })} />
      <div className="quad-grid"><NumberField label="Margin T" value={d.marginTop || 0} suffix="px" onChange={value => setD({ marginTop: value })} /><NumberField label="Margin B" value={d.marginBottom || 0} suffix="px" onChange={value => setD({ marginBottom: value })} /><NumberField label="Padding T" value={d.paddingTop || 0} suffix="px" onChange={value => setD({ paddingTop: value })} /><NumberField label="Padding B" value={d.paddingBottom || 0} suffix="px" onChange={value => setD({ paddingBottom: value })} /></div>
    </Section>

    <Section title="Aparência">
      <ColorField label="Fundo" value={block.style.background} onChange={value => updateStyle(block.id, { background: value }, 'Cor de fundo alterada')} />
      <TextField label="Gradiente CSS" value={block.style.gradient || ''} placeholder="linear-gradient(...)" onChange={value => updateStyle(block.id, { gradient: value })} />
      <UploadField label="Imagem de fundo" value={block.style.backgroundImage || ''} onChange={value => updateStyle(block.id, { backgroundImage: value }, value ? 'Imagem de fundo alterada' : 'Imagem de fundo removida')} />
      <ColorField label="Cor da borda" value={block.style.borderColor} onChange={value => updateStyle(block.id, { borderColor: value })} />
      <NumberField label="Espessura da borda" value={block.style.borderWidth || 0} max={20} suffix="px" onChange={value => updateStyle(block.id, { borderWidth: value })} />
      <NumberField label="Border radius" value={block.style.borderRadius || 0} max={120} suffix="px" onChange={value => updateStyle(block.id, { borderRadius: value })} />
      <TextField label="Sombra" value={block.style.shadow || ''} placeholder="0 12px 32px rgba(...)" onChange={value => updateStyle(block.id, { shadow: value })} />
    </Section>

    <Section title="Comportamento">
      <NumberField label="Escala no hover" value={block.style.hoverScale || 1} min={1} max={2} onChange={value => updateStyle(block.id, { hoverScale: value })} />
      <NumberField label="Transição" value={block.style.transitionMs || 180} min={0} max={3000} suffix="ms" onChange={value => updateStyle(block.id, { transitionMs: value })} />
    </Section>

    <Section title="Visibilidade">
      {(['desktop', 'tablet', 'mobile'] as Device[]).map(target => <Field key={target} label={target}><input type="checkbox" checked={!block.hiddenOn[target]} onChange={e => updateBlock(block.id, { hiddenOn: { ...block.hiddenOn, [target]: !e.target.checked } }, `Visibilidade ${target} alterada`)} /></Field>)}
    </Section>

    <Section title="Inspector avançado">
      <dl className="inspector-list"><div><dt>ID</dt><dd>{block.id}</dd></div><div><dt>Tipo</dt><dd>{block.type}</dd></div><div><dt>Criado</dt><dd>{new Date(block.meta.createdAt).toLocaleString('pt-BR')}</dd></div><div><dt>Criado por</dt><dd>{block.meta.createdBy}</dd></div><div><dt>Alterado</dt><dd>{new Date(block.meta.updatedAt).toLocaleString('pt-BR')}</dd></div><div><dt>Versão</dt><dd>{block.meta.version}</dd></div><div><dt>Status</dt><dd>{block.meta.status}</dd></div><div><dt>Visibilidade</dt><dd>{block.hidden ? 'Oculto' : 'Visível'}</dd></div></dl>
    </Section>
  </div>
}

function DesignSystemPanel() {
  const doc = useEditorStore(s => s.history.present)
  const update = useEditorStore(s => s.updateDesignSystem)
  const ds = doc.designSystem
  return <div className="property-panel-content"><h3>Design System Global</h3><p className="muted">Alterações globais atualizam todos os blocos que usam tokens do tema.</p><Section title="Tipografia"><TextField label="Fonte principal" value={ds.primaryFont} onChange={value => update({ primaryFont: value })} /><TextField label="Fonte secundária" value={ds.secondaryFont} onChange={value => update({ secondaryFont: value })} /></Section><Section title="Cores"><ColorField label="Primária" value={ds.primaryColor} onChange={value => update({ primaryColor: value }, 'Cor primária global alterada')} /><ColorField label="Secundária" value={ds.secondaryColor} onChange={value => update({ secondaryColor: value })} /><ColorField label="Destaque" value={ds.accentColor} onChange={value => update({ accentColor: value })} /><ColorField label="Fundo da página" value={ds.pageBackground} onChange={value => update({ pageBackground: value })} /><ColorField label="Fundo dos cards" value={ds.cardBackground} onChange={value => update({ cardBackground: value })} /><ColorField label="Bordas" value={ds.borderColor} onChange={value => update({ borderColor: value })} /></Section><Section title="Componentes"><NumberField label="Raio de cards" value={ds.cardRadius} max={120} suffix="px" onChange={value => update({ cardRadius: value })} /><NumberField label="Raio de botões" value={ds.buttonRadius} max={120} suffix="px" onChange={value => update({ buttonRadius: value })} /><NumberField label="Unidade de espaçamento" value={ds.spacingUnit} max={32} suffix="px" onChange={value => update({ spacingUnit: value })} /><TextField label="Sombra global" value={ds.shadow} onChange={value => update({ shadow: value })} /></Section></div>
}

function IdentityPanel() {
  const identity = useEditorStore(s => s.history.present.identity)
  const update = useEditorStore(s => s.updateIdentity)
  return <div className="property-panel-content"><h3>Identidade Visual</h3><Section title="Marca"><TextField label="Nome da empresa" value={identity.companyName} onChange={value => update({ companyName: value })} /><UploadField label="Logo principal" value={identity.logo} onChange={value => update({ logo: value }, value ? 'Logo principal alterada' : 'Logo principal removida')} /><UploadField label="Logo mobile" value={identity.mobileLogo} onChange={value => update({ mobileLogo: value })} /><UploadField label="Favicon" value={identity.favicon} onChange={value => update({ favicon: value })} /><UploadField label="Ícone PWA" value={identity.pwaIcon} onChange={value => update({ pwaIcon: value })} /><UploadField label="Marca d'água" value={identity.watermark} onChange={value => update({ watermark: value })} /></Section></div>
}

function ThemePanel() {
  const theme = useEditorStore(s => s.history.present.theme)
  const update = useEditorStore(s => s.updateTheme)
  const themes = ['Padrão', 'Natal', 'Black Friday', 'Carnaval', 'Dia das Mães', 'Dia dos Pais', 'Dia das Crianças', 'Ano Novo'] as const
  return <div className="property-panel-content"><h3>Motor de Temas</h3><Section title="Tema"><Field label="Tema ativo"><select value={theme.name} onChange={e => update({ name: e.target.value as typeof theme.name }, 'Tema alterado')} >{themes.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Ativado"><input type="checkbox" checked={theme.enabled} onChange={e => update({ enabled: e.target.checked })} /></Field><NumberField label="Intensidade" value={theme.intensity} min={0} max={100} onChange={value => update({ intensity: value })} /><Field label="Partículas"><input type="checkbox" checked={theme.particles} onChange={e => update({ particles: e.target.checked })} /></Field><Field label="Animação desktop"><input type="checkbox" checked={theme.animateDesktop} onChange={e => update({ animateDesktop: e.target.checked })} /></Field><Field label="Animação mobile"><input type="checkbox" checked={theme.animateMobile} onChange={e => update({ animateMobile: e.target.checked })} /></Field></Section><div className="theme-ai-note"><strong>Temas prontos + IA</strong><p>O motor visual já aplica decoração e animação por tema. A geração de novos temas por IA fica isolada em um provider para conectar a um serviço autorizado sem misturar credenciais no frontend.</p></div></div>
}

export function PropertiesPanel() {
  const selectedId = useEditorStore(s => s.selectedBlockId)
  const block = useEditorStore(s => s.history.present.blocks.find(item => item.id === s.selectedBlockId))
  const device = useEditorStore(s => s.device)
  const [tab, setTab] = useState<'block' | 'design' | 'identity' | 'theme'>('block')
  useEffect(() => { if (selectedId) setTab('block') }, [selectedId])

  return <aside className="properties-panel"><div className="property-tabs"><button className={tab === 'block' ? 'active' : ''} onClick={() => setTab('block')}>Bloco</button><button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>Design</button><button className={tab === 'identity' ? 'active' : ''} onClick={() => setTab('identity')}>Identidade</button><button className={tab === 'theme' ? 'active' : ''} onClick={() => setTab('theme')}>Tema</button></div>{tab === 'block' ? (block ? <BlockPanel block={block} device={device} /> : <div className="empty-properties"><Paintbrush size={34} /><h3>Selecione qualquer elemento</h3><p>Clique em um bloco no preview. A barra lateral abrirá as opções específicas daquele elemento.</p></div>) : null}{tab === 'design' ? <DesignSystemPanel /> : null}{tab === 'identity' ? <IdentityPanel /> : null}{tab === 'theme' ? <ThemePanel /> : null}</aside>
}
