import React, { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Wifi, X } from 'lucide-react'
import { getDesktopAiStatus, saveDesktopAiSettings, testDesktopAi, type DesktopAiStatus } from './client'
import './desktop.css'

type Props = {
  open: boolean
  onClose: () => void
  onConfigured?: (status: DesktopAiStatus) => void
}

export function AiSettingsModal({ open, onClose, onConfigured }: Props) {
  const [status, setStatus] = useState<DesktopAiStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [textModel, setTextModel] = useState('gpt-5.6-luna')
  const [imageModel, setImageModel] = useState('gpt-image-2')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    void getDesktopAiStatus().then(next => {
      setStatus(next)
      if (next) {
        setTextModel(next.textModel || 'gpt-5.6-luna')
        setImageModel(next.imageModel || 'gpt-image-2')
      }
    })
  }, [open])

  if (!open) return null

  const save = async () => {
    setLoading(true); setError(''); setMessage('')
    try {
      await saveDesktopAiSettings({ apiKey: apiKey.trim() || undefined, textModel, imageModel })
      const tested = await testDesktopAi()
      const next = await getDesktopAiStatus()
      if (next) { setStatus(next); onConfigured?.(next) }
      setApiKey('')
      setMessage(`Conexão confirmada com ${tested.textModel}. Pesquisa online e geração de imagens estão liberadas.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível configurar a IA.')
    } finally { setLoading(false) }
  }

  return <>
    <div className="desktop-modal-backdrop" onClick={onClose} />
    <section className="desktop-ai-settings" role="dialog" aria-modal="true" aria-label="Configuração da IA">
      <header><div><ShieldCheck size={22} /><div><strong>Configuração segura da IA</strong><span>ASTERYON Desktop · Windows 11</span></div></div><button onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
      <div className="desktop-setting-status">
        <div className={status?.configured ? 'ok' : 'pending'}>{status?.configured ? <CheckCircle2 size={18} /> : <KeyRound size={18} />}<span>{status?.configured ? 'Chave configurada e protegida pelo Windows' : 'Informe uma API Key da OpenAI'}</span></div>
        <small>A chave não é gravada no código nem no GitHub. O Electron usa a proteção criptográfica do Windows para armazená-la.</small>
      </div>
      <label>API Key da OpenAI<input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={status?.configured ? 'Deixe vazio para manter a chave atual' : 'sk-...'} autoComplete="off" /></label>
      <div className="desktop-model-grid">
        <label>Modelo de texto<select value={textModel} onChange={e => setTextModel(e.target.value)}><option value="gpt-5.6-luna">GPT-5.6 Luna · econômico</option><option value="gpt-5.6-terra">GPT-5.6 Terra · equilibrado</option><option value="gpt-5.6-sol">GPT-5.6 Sol · máxima qualidade</option></select></label>
        <label>Modelo de imagem<select value={imageModel} onChange={e => setImageModel(e.target.value)}><option value="gpt-image-2">GPT Image 2</option></select></label>
      </div>
      <div className="desktop-capabilities"><span><Wifi size={15} /> Pesquisa web permitida pelas regras ASTERYON</span><span>✓ Temas, layouts, campanhas e textos</span><span>✓ Geração real de banners, fundos e artes</span><span>✓ Aplicação somente após Preview + Aprovação</span></div>
      {error ? <div className="desktop-setting-error">{error}</div> : null}
      {message ? <div className="desktop-setting-success"><CheckCircle2 size={16} />{message}</div> : null}
      <footer><button onClick={onClose}>Fechar</button><button className="primary" onClick={save} disabled={loading || (!status?.configured && !apiKey.trim())}>{loading ? <Loader2 className="desktop-spin" size={17} /> : <KeyRound size={17} />}{loading ? 'Testando conexão…' : 'Salvar e testar'}</button></footer>
    </section>
  </>
}
