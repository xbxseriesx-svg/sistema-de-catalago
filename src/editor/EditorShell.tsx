import React, { useEffect, useState } from 'react'
import { Eye, FileUp, Monitor, Redo2, Rocket, Save, Smartphone, Sparkles, Tablet, Undo2, X } from 'lucide-react'
import { AsteryonAI } from '../ai/AsteryonAI'
import { ImportPanel } from '../catalog/ImportPanel'
import { AsteryonMark } from '../components/AsteryonMark'
import { BuilderWorkspace } from './BuilderWorkspace'
import { DocumentPreview } from './DocumentPreview'
import { PublishDialog } from './PublishDialog'
import { useEditorStore } from './store'
import type { Device } from './types'

export function EditorShell() {
  const history = useEditorStore(s => s.history)
  const device = useEditorStore(s => s.device)
  const setDevice = useEditorStore(s => s.setDevice)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const saveDraft = useEditorStore(s => s.saveDraft)
  const setPreviewMode = useEditorStore(s => s.setPreviewMode)
  const previewMode = useEditorStore(s => s.previewMode)
  const setPublishDialogOpen = useEditorStore(s => s.setPublishDialogOpen)
  const createSnapshot = useEditorStore(s => s.createSnapshot)
  const processScheduled = useEditorStore(s => s.processScheduled)
  const sandboxes = useEditorStore(s => s.sandboxes)
  const activeSandboxId = useEditorStore(s => s.activeSandboxId)
  const switchSandbox = useEditorStore(s => s.switchSandbox)
  const scheduledAt = useEditorStore(s => s.scheduledAt)
  const [aiOpen, setAiOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redo(); else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  useEffect(() => {
    const snapshotTimer = window.setInterval(() => createSnapshot('Snapshot automático · 5 minutos'), 5 * 60 * 1000)
    const scheduleTimer = window.setInterval(processScheduled, 30 * 1000)
    return () => { window.clearInterval(snapshotTimer); window.clearInterval(scheduleTimer) }
  }, [createSnapshot, processScheduled])

  const devices: Array<{ id: Device; icon: React.ReactNode; label: string }> = [
    { id: 'desktop', icon: <Monitor size={17} />, label: 'Desktop' },
    { id: 'tablet', icon: <Tablet size={17} />, label: 'Tablet' },
    { id: 'mobile', icon: <Smartphone size={17} />, label: 'Mobile' },
  ]

  return <div className="editor-app">
    <header className="editor-topbar">
      <div className="editor-brand"><AsteryonMark size={30} /><div><strong>ASTERYON</strong><small>EDITOR VISUAL PRO</small></div></div>
      <div className="topbar-page"><span>Rascunho</span><strong>{history.present.name}</strong><select value={activeSandboxId} onChange={e => switchSandbox(e.target.value)}>{sandboxes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{scheduledAt ? <small>Agendado: {new Date(scheduledAt).toLocaleString('pt-BR')}</small> : null}</div>
      <div className="topbar-scroll-zone">
        <div className="topbar-devices">{devices.map(item => <button key={item.id} className={device === item.id ? 'active' : ''} onClick={() => setDevice(item.id)} title={item.label}>{item.icon}<span>{item.label}</span></button>)}</div>
        <div className="topbar-actions">
          <button className="topbar-ai" onClick={() => setAiOpen(true)} title="Abrir ASTERYON AI"><Sparkles size={17} /><span>ASTERYON AI</span></button>
          <button onClick={() => setImportOpen(true)} title="Importar Excel e imagens"><FileUp size={17} /><span>Importar</span></button>
          <button disabled={!history.past.length} onClick={undo} title="Desfazer (Ctrl+Z)"><Undo2 size={17} /><span>Undo</span></button>
          <button disabled={!history.future.length} onClick={redo} title="Refazer (Ctrl+Shift+Z)"><Redo2 size={17} /><span>Redo</span></button>
          <button onClick={saveDraft}><Save size={17} /><span>Salvar</span></button>
          <button onClick={() => setPreviewMode(true)}><Eye size={17} /><span>Preview</span></button>
          <button className="topbar-publish" onClick={() => setPublishDialogOpen(true)}><Rocket size={17} /><span>Publicar</span></button>
        </div>
      </div>
    </header>

    <BuilderWorkspace />
    <PublishDialog />
    <AsteryonAI open={aiOpen} onClose={() => setAiOpen(false)} />
    <ImportPanel open={importOpen} onClose={() => setImportOpen(false)} />

    {previewMode ? <div className="visitor-preview-overlay"><div className="visitor-preview-top"><div><strong>Modo Visitante</strong><span>Visualização limpa e idêntica ao portal público do rascunho.</span></div><button onClick={() => setPreviewMode(false)}><X /> Fechar</button></div><div className={`visitor-preview-frame preview-${device}`}><DocumentPreview document={history.present} device={device} visitorMode /></div></div> : null}
  </div>
}
