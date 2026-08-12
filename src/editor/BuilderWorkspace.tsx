import React, { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCenter,
  useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Blocks, Box, Clock3, Copy, GripVertical, History, Layers3, MoreVertical,
  Plus, RotateCcw, Save, Search, Trash2, EyeOff, Lock, Unlock, GitBranch,
} from 'lucide-react'
import { blockLibrary } from './defaults'
import { useEditorStore } from './store'
import type { BlockType, BuilderBlock } from './types'
import { BlockContent, PortalSurface } from './BlockRenderer'
import { PropertiesPanel } from './PropertiesPanel'

const nestingTypes: BlockType[] = ['container', 'row', 'column']

function LibraryItem({ type, label, description }: { type: BlockType; label: string; description: string }) {
  const addBlock = useEditorStore(s => s.addBlock)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library:${type}`,
    data: { kind: 'library', type, label },
  })
  return <button ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? .45 : 1 }} className="library-item" onClick={() => addBlock(type)} {...attributes} {...listeners}><span className="library-icon"><Box size={17} /></span><span><strong>{label}</strong><small>{description}</small></span><GripVertical size={16} /></button>
}

function LeftLibrary() {
  const [tab, setTab] = useState<'blocks' | 'templates' | 'sandbox' | 'history' | 'versions'>('blocks')
  const [query, setQuery] = useState('')
  const templates = useEditorStore(s => s.templates)
  const addTemplate = useEditorStore(s => s.addBlockFromTemplate)
  const sandboxes = useEditorStore(s => s.sandboxes)
  const activeSandboxId = useEditorStore(s => s.activeSandboxId)
  const createSandbox = useEditorStore(s => s.createSandbox)
  const switchSandbox = useEditorStore(s => s.switchSandbox)
  const activity = useEditorStore(s => s.activity)
  const snapshots = useEditorStore(s => s.snapshots)
  const restoreSnapshot = useEditorStore(s => s.restoreSnapshot)
  const versions = useEditorStore(s => s.versions)
  const restoreVersion = useEditorStore(s => s.restoreVersion)
  const duplicateVersionToSandbox = useEditorStore(s => s.duplicateVersionToSandbox)

  const groups = useMemo(() => {
    const filtered = blockLibrary.filter(item => `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(query.toLowerCase()))
    return filtered.reduce<Record<string, typeof filtered>>((acc, item) => { (acc[item.group] ||= []).push(item); return acc }, {})
  }, [query])

  return <aside className="builder-library">
    <div className="library-tabs">
      <button className={tab === 'blocks' ? 'active' : ''} onClick={() => setTab('blocks')} title="Blocos"><Blocks size={17} /></button>
      <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')} title="Templates"><Layers3 size={17} /></button>
      <button className={tab === 'sandbox' ? 'active' : ''} onClick={() => setTab('sandbox')} title="Sandbox"><GitBranch size={17} /></button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')} title="Histórico"><History size={17} /></button>
      <button className={tab === 'versions' ? 'active' : ''} onClick={() => setTab('versions')} title="Time Machine"><Clock3 size={17} /></button>
    </div>

    {tab === 'blocks' && <div className="library-body"><div className="library-heading"><h3>Biblioteca de Blocos</h3><p>Arraste para a página ou clique para inserir.</p></div><label className="library-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar bloco..." /></label>{Object.entries(groups).map(([group, items]) => <div key={group} className="library-group"><h4>{group}</h4>{items.map(item => <LibraryItem key={item.type} {...item} />)}</div>)}</div>}

    {tab === 'templates' && <div className="library-body"><div className="library-heading"><h3>Componentes Salvos</h3><p>Reutilize elementos em qualquer página.</p></div>{templates.length ? templates.map(t => <button className="template-card" key={t.id} onClick={() => addTemplate(t.id)}><strong>{t.name}</strong><small>{t.type} · {new Date(t.createdAt).toLocaleDateString('pt-BR')}</small></button>) : <div className="empty-library">Selecione um bloco e use “Salvar como template”.</div>}</div>}

    {tab === 'sandbox' && <div className="library-body"><div className="library-heading"><h3>Sandbox</h3><p>Versões paralelas sem afetar produção.</p></div><button className="library-primary" onClick={() => createSandbox(`Teste ${sandboxes.length + 1}`)}><Plus size={15} /> Nova versão paralela</button>{sandboxes.map(s => <button key={s.id} className={`sandbox-card ${s.id === activeSandboxId ? 'active' : ''}`} onClick={() => switchSandbox(s.id)}><strong>{s.name}</strong><small>{s.id === activeSandboxId ? 'Em edição' : 'Abrir rascunho'} · {new Date(s.createdAt).toLocaleDateString('pt-BR')}</small></button>)}</div>}

    {tab === 'history' && <div className="library-body"><div className="library-heading"><h3>Histórico Visual</h3><p>Ações e snapshots automáticos.</p></div>{snapshots.length ? <><h4 className="subheading">Snapshots</h4>{snapshots.map(s => <div className="history-card" key={s.id}><div><strong>{s.label}</strong><small>{new Date(s.at).toLocaleString('pt-BR')}</small></div><button onClick={() => restoreSnapshot(s.id)}><RotateCcw size={14} /></button></div>)}</> : null}<h4 className="subheading">Atividade</h4>{activity.slice(0, 40).map(a => <div className="activity-row" key={a.id}><span>{new Date(a.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><div><strong>{a.label}</strong><small>{a.action}</small></div></div>)}</div>}

    {tab === 'versions' && <div className="library-body"><div className="library-heading"><h3>Time Machine</h3><p>Versões publicadas e arquivadas.</p></div>{versions.map(v => <div className="version-card" key={v.id}><div><strong>Versão {v.number}</strong><small>{v.label}</small><small>{new Date(v.at).toLocaleString('pt-BR')}</small></div><div className="version-actions"><button onClick={() => restoreVersion(v.id)} title="Restaurar para rascunho"><RotateCcw size={14} /></button><button onClick={() => duplicateVersionToSandbox(v.id, `Versão ${v.number} - cópia`)} title="Duplicar em sandbox"><Copy size={14} /></button></div></div>)}</div>}
  </aside>
}

function DropZone({ id, parentId, index, position }: { id: string; parentId: string | null; index: number; position: 'before' | 'after' | 'inside' | 'empty' }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { kind: 'dropzone', parentId, index, position } })
  return <div ref={setNodeRef} className={`drop-zone drop-${position} ${isOver ? 'over' : ''}`}><span>{position === 'inside' ? 'Inserir dentro' : position === 'before' ? 'Inserir acima' : position === 'after' ? 'Inserir abaixo' : 'Solte aqui'}</span></div>
}

function BlockActions({ block }: { block: BuilderBlock }) {
  const duplicate = useEditorStore(s => s.duplicateBlock)
  const remove = useEditorStore(s => s.deleteBlock)
  const toggleHidden = useEditorStore(s => s.toggleHidden)
  const toggleLocked = useEditorStore(s => s.toggleLocked)
  const copyStyle = useEditorStore(s => s.copyStyle)
  const pasteStyle = useEditorStore(s => s.pasteStyle)
  return <div className="block-actions"><button onClick={e => { e.stopPropagation(); duplicate(block.id) }} title="Duplicar"><Copy size={14} /></button><button onClick={e => { e.stopPropagation(); toggleHidden(block.id) }} title="Ocultar"><EyeOff size={14} /></button><button onClick={e => { e.stopPropagation(); toggleLocked(block.id) }} title="Bloquear">{block.locked ? <Unlock size={14} /> : <Lock size={14} />}</button><button onClick={e => { e.stopPropagation(); copyStyle(block.id) }} title="Copiar estilo">C</button><button onClick={e => { e.stopPropagation(); pasteStyle(block.id) }} title="Colar estilo">P</button><button className="danger" onClick={e => { e.stopPropagation(); remove(block.id) }} title="Excluir"><Trash2 size={14} /></button></div>
}

function SortableBlock({ block }: { block: BuilderBlock }) {
  const doc = useEditorStore(s => s.history.present)
  const selectedId = useEditorStore(s => s.selectedBlockId)
  const selectBlock = useEditorStore(s => s.selectBlock)
  const device = useEditorStore(s => s.device)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: block.locked, data: { kind: 'block', blockId: block.id } })
  const children = doc.blocks.filter(b => b.parentId === block.id).sort((a, b) => a.order - b.order)
  const peers = doc.blocks.filter(b => b.parentId === block.parentId).sort((a, b) => a.order - b.order)
  const peerIndex = peers.findIndex(b => b.id === block.id)
  const selected = selectedId === block.id
  const hiddenOnDevice = block.hiddenOn[device]

  return <>
    <DropZone id={`drop:${block.id}:before`} parentId={block.parentId} index={peerIndex} position="before" />
    <div ref={setNodeRef} className={`builder-block ${selected ? 'selected' : ''} ${block.locked ? 'locked' : ''} ${block.hidden ? 'globally-hidden' : ''} ${hiddenOnDevice ? 'device-hidden' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .35 : undefined }} onClick={e => { e.stopPropagation(); selectBlock(block.id) }}>
      <div className="block-label"><button className="drag-grip" {...attributes} {...listeners} disabled={block.locked}><GripVertical size={14} /></button><span>{block.name}</span>{block.locked ? <Lock size={12} /> : null}<button className="three-dots" onClick={e => { e.stopPropagation(); selectBlock(block.id) }}><MoreVertical size={15} /></button></div>
      {selected ? <BlockActions block={block} /> : null}
      <BlockContent block={block} document={doc} device={device}>{nestingTypes.includes(block.type) ? <div className="nested-slot"><DropZone id={`drop:${block.id}:inside-start`} parentId={block.id} index={0} position="inside" /><SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>{children.map(child => <SortableBlock key={child.id} block={child} />)}</SortableContext><DropZone id={`drop:${block.id}:inside-end`} parentId={block.id} index={children.length} position="inside" /></div> : null}</BlockContent>
    </div>
    <DropZone id={`drop:${block.id}:after`} parentId={block.parentId} index={peerIndex + 1} position="after" />
  </>
}

function Canvas() {
  const doc = useEditorStore(s => s.history.present)
  const device = useEditorStore(s => s.device)
  const select = useEditorStore(s => s.selectBlock)
  const roots = doc.blocks.filter(b => b.parentId === null).sort((a, b) => a.order - b.order)
  return <main className="builder-canvas-wrap" onClick={() => select(null)}><div className={`device-frame device-${device}`}><PortalSurface document={doc} device={device}><DropZone id="drop:root:start" parentId={null} index={0} position="empty" /><SortableContext items={roots.map(b => b.id)} strategy={verticalListSortingStrategy}>{roots.map(block => <SortableBlock key={block.id} block={block} />)}</SortableContext><DropZone id="drop:root:end" parentId={null} index={roots.length} position="empty" /></PortalSurface></div></main>
}

export function BuilderWorkspace() {
  const addBlock = useEditorStore(s => s.addBlock)
  const moveBlock = useEditorStore(s => s.moveBlock)
  const [activeLabel, setActiveLabel] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    setActiveLabel(String(data?.label || data?.blockId || 'Bloco'))
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveLabel('')
    const over = event.over
    if (!over) return
    const target = over.data.current
    if (target?.kind !== 'dropzone') return
    const active = event.active.data.current
    if (active?.kind === 'library') {
      addBlock(active.type as BlockType, target.parentId ?? null)
      const newId = useEditorStore.getState().selectedBlockId
      if (newId) moveBlock(newId, target.parentId ?? null, Number(target.index || 0))
      return
    }
    if (active?.kind === 'block') moveBlock(String(active.blockId), target.parentId ?? null, Number(target.index || 0))
  }

  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}><div className="builder-workspace"><LeftLibrary /><Canvas /><PropertiesPanel /></div><DragOverlay>{activeLabel ? <div className="drag-overlay"><GripVertical size={16} />{activeLabel}</div> : null}</DragOverlay></DndContext>
}
