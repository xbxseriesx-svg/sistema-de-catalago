import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActivityEntry, BuilderBlock, Device, EditorDocument, PublishedVersion, Sandbox, SavedTemplate, Snapshot } from './types'
import { clone, defaultDocument, makeBlock, uid } from './defaults'

interface HistoryState {
  past: EditorDocument[]
  present: EditorDocument
  future: EditorDocument[]
}

interface EditorState {
  history: HistoryState
  published: EditorDocument
  selectedBlockId: string | null
  device: Device
  activity: ActivityEntry[]
  snapshots: Snapshot[]
  versions: PublishedVersion[]
  sandboxes: Sandbox[]
  activeSandboxId: string
  templates: SavedTemplate[]
  styleClipboard: BuilderBlock['style'] | null
  actionCount: number
  publishDialogOpen: boolean
  previewMode: boolean
  scheduledAt: string | null

  selectBlock: (id: string | null) => void
  setDevice: (device: Device) => void
  setPreviewMode: (value: boolean) => void
  setPublishDialogOpen: (value: boolean) => void
  addBlock: (type: BuilderBlock['type'], parentId?: string | null) => void
  addBlockFromTemplate: (templateId: string, parentId?: string | null) => void
  updateBlock: (id: string, patch: Partial<BuilderBlock>, label?: string) => void
  updateBlockProps: (id: string, patch: Record<string, unknown>, label?: string) => void
  updateBlockStyle: (id: string, patch: Partial<BuilderBlock['style']>, label?: string) => void
  updateDeviceStyle: (id: string, device: Device, patch: Record<string, unknown>, label?: string) => void
  deleteBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  moveBlock: (id: string, parentId: string | null, index: number) => void
  toggleHidden: (id: string) => void
  toggleLocked: (id: string) => void
  copyStyle: (id: string) => void
  pasteStyle: (id: string) => void
  saveAsTemplate: (id: string, name?: string) => void
  undo: () => void
  redo: () => void
  createSnapshot: (label: string) => void
  restoreSnapshot: (id: string) => void
  restoreActivityPoint: (index: number) => void
  updateDesignSystem: (patch: Partial<EditorDocument['designSystem']>, label?: string) => void
  updateIdentity: (patch: Partial<EditorDocument['identity']>, label?: string) => void
  updateTheme: (patch: Partial<EditorDocument['theme']>, label?: string) => void
  publishNow: (label?: string) => void
  schedulePublish: (isoDate: string) => void
  processScheduled: () => void
  restoreVersion: (versionId: string) => void
  duplicateVersionToSandbox: (versionId: string, name: string) => void
  createSandbox: (name: string) => void
  switchSandbox: (id: string) => void
  renameSandbox: (id: string, name: string) => void
  saveDraft: () => void
}

const normalizeOrders = (blocks: BuilderBlock[], parentId: string | null) => {
  const peers = blocks.filter(b => b.parentId === parentId).sort((a, b) => a.order - b.order)
  peers.forEach((b, index) => { b.order = index })
}

const descendantIds = (blocks: BuilderBlock[], id: string): string[] => {
  const children = blocks.filter(b => b.parentId === id)
  return children.flatMap(child => [child.id, ...descendantIds(blocks, child.id)])
}

const logEntry = (action: string, label: string, blockId?: string): ActivityEntry => ({
  id: uid('log'), at: new Date().toISOString(), action, label, blockId,
})

const initialSandbox: Sandbox = {
  id: 'production-draft',
  name: 'Produção',
  createdAt: new Date().toISOString(),
  document: clone(defaultDocument),
}

export const useEditorStore = create<EditorState>()(persist((set, get) => {
  const commit = (next: EditorDocument, action: string, label: string, blockId?: string) => {
    const current = get()
    next.updatedAt = new Date().toISOString()
    next.status = 'draft'
    const newCount = current.actionCount + 1
    const automaticSnapshot = newCount % 25 === 0
      ? [{ id: uid('snap'), at: new Date().toISOString(), label: `Snapshot automático · ${newCount} ações`, document: clone(next) }, ...current.snapshots].slice(0, 40)
      : current.snapshots

    const sandboxes = current.sandboxes.map(s => s.id === current.activeSandboxId ? { ...s, document: clone(next) } : s)
    set({
      history: { past: [...current.history.past, clone(current.history.present)].slice(-100), present: next, future: [] },
      activity: [logEntry(action, label, blockId), ...current.activity].slice(0, 200),
      snapshots: automaticSnapshot,
      sandboxes,
      actionCount: newCount,
    })
  }

  return {
    history: { past: [], present: clone(defaultDocument), future: [] },
    published: { ...clone(defaultDocument), status: 'published' },
    selectedBlockId: null,
    device: 'desktop',
    activity: [],
    snapshots: [],
    versions: [{ id: 'v1', number: 1, at: new Date().toISOString(), status: 'published', label: 'Versão inicial', document: { ...clone(defaultDocument), status: 'published' } }],
    sandboxes: [initialSandbox],
    activeSandboxId: initialSandbox.id,
    templates: [],
    styleClipboard: null,
    actionCount: 0,
    publishDialogOpen: false,
    previewMode: false,
    scheduledAt: null,

    selectBlock: id => set({ selectedBlockId: id }),
    setDevice: device => set({ device }),
    setPreviewMode: value => set({ previewMode: value }),
    setPublishDialogOpen: value => set({ publishDialogOpen: value }),

    addBlock: (type, parentId = null) => {
      const doc = clone(get().history.present)
      const block = makeBlock(type, undefined, parentId)
      block.order = doc.blocks.filter(b => b.parentId === parentId).length
      doc.blocks.push(block)
      commit(doc, 'CREATE_BLOCK', `Novo bloco: ${block.name}`, block.id)
      set({ selectedBlockId: block.id })
    },

    addBlockFromTemplate: (templateId, parentId = null) => {
      const template = get().templates.find(t => t.id === templateId)
      if (!template) return
      const doc = clone(get().history.present)
      const block = clone(template.block)
      block.id = uid(block.type)
      block.parentId = parentId
      block.order = doc.blocks.filter(b => b.parentId === parentId).length
      block.meta = { ...block.meta, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, status: 'draft' }
      doc.blocks.push(block)
      commit(doc, 'CREATE_BLOCK', `Template inserido: ${template.name}`, block.id)
      set({ selectedBlockId: block.id })
    },

    updateBlock: (id, patch, label = 'Bloco atualizado') => {
      const doc = clone(get().history.present)
      const index = doc.blocks.findIndex(b => b.id === id)
      if (index < 0 || doc.blocks[index].locked) return
      doc.blocks[index] = {
        ...doc.blocks[index], ...patch,
        meta: { ...doc.blocks[index].meta, updatedAt: new Date().toISOString(), version: doc.blocks[index].meta.version + 1, status: 'draft' },
      }
      commit(doc, 'UPDATE_PROPERTY', label, id)
    },

    updateBlockProps: (id, patch, label = 'Conteúdo atualizado') => {
      const block = get().history.present.blocks.find(b => b.id === id)
      if (!block || block.locked) return
      get().updateBlock(id, { props: { ...block.props, ...patch } }, label)
    },

    updateBlockStyle: (id, patch, label = 'Estilo atualizado') => {
      const block = get().history.present.blocks.find(b => b.id === id)
      if (!block || block.locked) return
      get().updateBlock(id, { style: { ...block.style, ...patch } }, label)
    },

    updateDeviceStyle: (id, device, patch, label = 'Layout responsivo atualizado') => {
      const block = get().history.present.blocks.find(b => b.id === id)
      if (!block || block.locked) return
      get().updateBlock(id, { style: { ...block.style, [device]: { ...block.style[device], ...patch } } }, label)
    },

    deleteBlock: id => {
      const doc = clone(get().history.present)
      const block = doc.blocks.find(b => b.id === id)
      if (!block || block.locked) return
      const ids = new Set([id, ...descendantIds(doc.blocks, id)])
      doc.blocks = doc.blocks.filter(b => !ids.has(b.id))
      normalizeOrders(doc.blocks, block.parentId)
      commit(doc, 'DELETE_BLOCK', `Bloco removido: ${block.name}`, id)
      set({ selectedBlockId: null })
    },

    duplicateBlock: id => {
      const doc = clone(get().history.present)
      const source = doc.blocks.find(b => b.id === id)
      if (!source) return
      const copy = clone(source)
      copy.id = uid(copy.type)
      copy.name = `${copy.name} (cópia)`
      copy.order = source.order + 1
      copy.meta = { ...copy.meta, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, status: 'draft' }
      doc.blocks.filter(b => b.parentId === source.parentId && b.order > source.order).forEach(b => b.order += 1)
      doc.blocks.push(copy)
      commit(doc, 'DUPLICATE_BLOCK', `Bloco duplicado: ${source.name}`, copy.id)
      set({ selectedBlockId: copy.id })
    },

    moveBlock: (id, parentId, index) => {
      const doc = clone(get().history.present)
      const block = doc.blocks.find(b => b.id === id)
      if (!block || block.locked || id === parentId) return
      const oldParent = block.parentId
      const illegalParent = descendantIds(doc.blocks, id).includes(parentId || '')
      if (illegalParent) return
      block.parentId = parentId
      const peers = doc.blocks.filter(b => b.parentId === parentId && b.id !== id).sort((a, b) => a.order - b.order)
      peers.splice(Math.max(0, Math.min(index, peers.length)), 0, block)
      peers.forEach((peer, i) => { peer.order = i })
      normalizeOrders(doc.blocks, oldParent)
      commit(doc, 'MOVE_BLOCK', `Bloco movido: ${block.name}`, id)
    },

    toggleHidden: id => {
      const block = get().history.present.blocks.find(b => b.id === id)
      if (!block) return
      get().updateBlock(id, { hidden: !block.hidden }, block.hidden ? 'Bloco exibido' : 'Bloco ocultado')
    },

    toggleLocked: id => {
      const doc = clone(get().history.present)
      const block = doc.blocks.find(b => b.id === id)
      if (!block) return
      block.locked = !block.locked
      block.meta.updatedAt = new Date().toISOString()
      commit(doc, 'UPDATE_PROPERTY', block.locked ? 'Bloco bloqueado' : 'Bloco desbloqueado', id)
    },

    copyStyle: id => {
      const block = get().history.present.blocks.find(b => b.id === id)
      if (block) set({ styleClipboard: clone(block.style) })
    },

    pasteStyle: id => {
      const clipboard = get().styleClipboard
      if (!clipboard) return
      get().updateBlockStyle(id, clone(clipboard), 'Estilo colado')
    },

    saveAsTemplate: (id, name) => {
      const block = get().history.present.blocks.find(b => b.id === id)
      if (!block) return
      const template: SavedTemplate = { id: uid('tpl'), name: name || block.name, type: block.type, createdAt: new Date().toISOString(), block: clone(block) }
      set(s => ({ templates: [template, ...s.templates] }))
    },

    undo: () => {
      const { history, activeSandboxId, sandboxes } = get()
      if (!history.past.length) return
      const previous = clone(history.past[history.past.length - 1])
      set({
        history: { past: history.past.slice(0, -1), present: previous, future: [clone(history.present), ...history.future].slice(0, 100) },
        sandboxes: sandboxes.map(s => s.id === activeSandboxId ? { ...s, document: clone(previous) } : s),
        activity: [logEntry('UNDO', 'Desfazer'), ...get().activity],
      })
    },

    redo: () => {
      const { history, activeSandboxId, sandboxes } = get()
      if (!history.future.length) return
      const next = clone(history.future[0])
      set({
        history: { past: [...history.past, clone(history.present)].slice(-100), present: next, future: history.future.slice(1) },
        sandboxes: sandboxes.map(s => s.id === activeSandboxId ? { ...s, document: clone(next) } : s),
        activity: [logEntry('REDO', 'Refazer'), ...get().activity],
      })
    },

    createSnapshot: label => set(s => ({ snapshots: [{ id: uid('snap'), at: new Date().toISOString(), label, document: clone(s.history.present) }, ...s.snapshots].slice(0, 40) })),

    restoreSnapshot: id => {
      const snapshot = get().snapshots.find(s => s.id === id)
      if (!snapshot) return
      commit(clone(snapshot.document), 'RESTORE_SNAPSHOT', `Snapshot restaurado: ${snapshot.label}`)
    },

    restoreActivityPoint: index => {
      const past = get().history.past
      if (index < 0 || index >= past.length) return
      const doc = clone(past[index])
      commit(doc, 'RESTORE_HISTORY', 'Histórico visual restaurado')
    },

    updateDesignSystem: (patch, label = 'Design System atualizado') => {
      const doc = clone(get().history.present)
      doc.designSystem = { ...doc.designSystem, ...patch }
      commit(doc, 'CHANGE_THEME', label)
    },

    updateIdentity: (patch, label = 'Identidade visual atualizada') => {
      const doc = clone(get().history.present)
      doc.identity = { ...doc.identity, ...patch }
      commit(doc, 'UPDATE_PROPERTY', label)
    },

    updateTheme: (patch, label = 'Tema atualizado') => {
      const doc = clone(get().history.present)
      doc.theme = { ...doc.theme, ...patch }
      commit(doc, 'CHANGE_THEME', label)
    },

    publishNow: (label = 'Publicação manual') => {
      const state = get()
      const document = { ...clone(state.history.present), status: 'published' as const, updatedAt: new Date().toISOString() }
      const nextNumber = (state.versions[0]?.number || 0) + 1
      const version: PublishedVersion = { id: uid('version'), number: nextNumber, at: new Date().toISOString(), status: 'published', label, document: clone(document) }
      set({
        published: document,
        versions: [version, ...state.versions].map((v, i) => i === 0 ? v : { ...v, status: 'archived' }).slice(0, 60),
        publishDialogOpen: false,
        scheduledAt: null,
        activity: [logEntry('PUBLISH', `Versão ${nextNumber} publicada`), ...state.activity],
      })
    },

    schedulePublish: isoDate => {
      const doc = clone(get().history.present)
      doc.status = 'scheduled'
      set({ scheduledAt: isoDate, publishDialogOpen: false, history: { ...get().history, present: doc }, activity: [logEntry('SCHEDULE', `Publicação agendada para ${new Date(isoDate).toLocaleString('pt-BR')}`), ...get().activity] })
    },

    processScheduled: () => {
      const scheduledAt = get().scheduledAt
      if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) get().publishNow('Publicação agendada')
    },

    restoreVersion: versionId => {
      const version = get().versions.find(v => v.id === versionId)
      if (!version) return
      const doc = clone(version.document)
      doc.status = 'draft'
      commit(doc, 'RESTORE_VERSION', `Versão ${version.number} restaurada para rascunho`)
    },

    duplicateVersionToSandbox: (versionId, name) => {
      const version = get().versions.find(v => v.id === versionId)
      if (!version) return
      const sandbox: Sandbox = { id: uid('sandbox'), name, createdAt: new Date().toISOString(), document: { ...clone(version.document), id: uid('doc'), status: 'draft' } }
      set(s => ({ sandboxes: [...s.sandboxes, sandbox] }))
    },

    createSandbox: name => {
      const sandbox: Sandbox = { id: uid('sandbox'), name, createdAt: new Date().toISOString(), document: { ...clone(get().history.present), id: uid('doc'), status: 'draft' } }
      set(s => ({ sandboxes: [...s.sandboxes, sandbox] }))
    },

    switchSandbox: id => {
      const sandbox = get().sandboxes.find(s => s.id === id)
      if (!sandbox) return
      set({ activeSandboxId: id, history: { past: [], present: clone(sandbox.document), future: [] }, selectedBlockId: null })
    },

    renameSandbox: (id, name) => set(s => ({ sandboxes: s.sandboxes.map(sb => sb.id === id ? { ...sb, name } : sb) })),
    saveDraft: () => get().createSnapshot('Rascunho salvo manualmente'),
  }
}, {
  name: 'asteryon-editor-pro',
  partialize: state => ({
    history: state.history,
    published: state.published,
    activity: state.activity,
    snapshots: state.snapshots,
    versions: state.versions,
    sandboxes: state.sandboxes,
    activeSandboxId: state.activeSandboxId,
    templates: state.templates,
    actionCount: state.actionCount,
    scheduledAt: state.scheduledAt,
  }),
}))
