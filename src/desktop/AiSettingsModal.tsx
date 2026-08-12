import React, { useEffect, useState } from 'react'
import { CheckCircle2, Download, Loader2, RefreshCw, ShieldCheck, Wifi, X } from 'lucide-react'
import { getDesktopAiStatus, installOllama, pullOllamaModel, saveDesktopAiSettings, testDesktopAi, type DesktopAiStatus } from './client'
import './desktop.css'

type Props = { open: boolean; onClose: () => void; onConfigured?: (status: DesktopAiStatus) => void }

export function AiSettingsModal({ open, onClose, onConfigured }: Props) {
  const [status, setStatus] = useState<DesktopAiStatus | null>(null)
  const [textModel, setTextModel] = useState('qwen3:4b')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = async () => { const next = await getDesktopAiStatus(); setStatus(next); if(next){ setTextModel(next.textModel || 'qwen3:4b'); onConfigured?.(next) } }
  useEffect(() => { if(open) void refresh() }, [open])
  if (!open) return null

  const run = async (fn: () => Promise<{message?:string}>) => {
    setLoading(true); setError(''); setMessage('')
    try { const r = await fn(); if(r.message) setMessage(r.message); await refresh() }
    catch(err){ setError(err instanceof Error ? err.message : 'Falha ao configurar IA local.') }
    finally{ setLoading(false) }
  }

  return <>
    <div className="desktop-modal-backdrop" onClick={onClose} />
    <section className="desktop-ai-settings" role="dialog" aria-modal="true" aria-label="Configuração da IA local">
      <header><div><ShieldCheck size={22}/><div><strong>ASTERYON AI Local · Gratuita</strong><span>Ollama no Windows 11 · sem API Key e sem créditos</span></div></div><button onClick={onClose}><X size={20}/></button></header>
      <div className="desktop-setting-status"><div className={status?.ollamaRunning?'ok':'pending'}>{status?.ollamaRunning?<CheckCircle2 size={18}/>:<RefreshCw size={18}/>}<span>{status?.ollamaRunning?'Ollama ativo no computador':'Ollama ainda não detectado'}</span></div><small>Os prompts e análises ficam no seu computador. A Internet só é usada quando a opção de pesquisa estiver marcada.</small></div>
      <div className="desktop-model-grid">
        <label>Modelo local<select value={textModel} onChange={e=>setTextModel(e.target.value)}><option value="qwen3:4b">Qwen3 4B · leve/recomendado</option><option value="qwen3:8b">Qwen3 8B · melhor qualidade</option><option value="gemma3:4b">Gemma 3 4B · leve</option><option value="llama3.2:3b">Llama 3.2 3B · muito leve</option></select></label>
        <label>Modelos encontrados<input readOnly value={(status?.models || []).join(', ') || 'Nenhum modelo baixado'} /></label>
      </div>
      <div className="desktop-capabilities"><span><Wifi size={15}/> Pesquisa web gratuita e controlada</span><span>✓ Temas, layouts, campanhas, textos e análise UX/UI</span><span>✓ Sem cobrança por consulta</span><span>✓ Gerar → Preview → Aprovar → Aplicar ao Rascunho</span></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>run(installOllama)} disabled={loading}><Download size={16}/> Instalar Ollama</button>
        <button onClick={()=>run(()=>pullOllamaModel(textModel))} disabled={loading || !status?.ollamaRunning}><Download size={16}/> Baixar modelo</button>
        <button onClick={()=>run(async()=>{ await saveDesktopAiSettings({textModel}); return testDesktopAi() })} disabled={loading || !status?.ollamaRunning}><RefreshCw size={16}/> Salvar e testar</button>
      </div>
      {error ? <div className="desktop-setting-error">{error}</div> : null}
      {message ? <div className="desktop-setting-success"><CheckCircle2 size={16}/>{message}</div> : null}
      <footer><button onClick={onClose}>Fechar</button></footer>
    </section>
  </>
}
