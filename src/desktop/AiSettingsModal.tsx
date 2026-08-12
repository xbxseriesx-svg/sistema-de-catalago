import React, { useEffect, useState } from 'react'
import { CheckCircle2, Download, Loader2, RefreshCw, ShieldCheck, Wifi, X } from 'lucide-react'
import { getDesktopAiStatus, installOllama, pullOllamaModel, saveDesktopAiSettings, testDesktopAi, type DesktopAiStatus } from './client'
import './desktop.css'

type Props={open:boolean;onClose:()=>void;onConfigured?:(status:DesktopAiStatus)=>void}
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms))

export function AiSettingsModal({open,onClose,onConfigured}:Props){
  const [status,setStatus]=useState<DesktopAiStatus|null>(null);const [textModel,setTextModel]=useState('qwen3:4b');const [loading,setLoading]=useState(false);const [progress,setProgress]=useState('');const [message,setMessage]=useState('');const [error,setError]=useState('')
  const refresh=async()=>{const next=await getDesktopAiStatus();setStatus(next);if(next){setTextModel(next.textModel||'qwen3:4b');onConfigured?.(next)}return next}
  useEffect(()=>{if(open)void refresh()},[open]);if(!open)return null

  const prepare=async()=>{
    setLoading(true);setError('');setMessage('')
    try{
      setProgress('Salvando o modelo selecionado…');await saveDesktopAiSettings({textModel})
      let st=await getDesktopAiStatus()
      if(!st?.ollamaRunning){
        setProgress('Instalando/ativando o Ollama…');await installOllama()
        for(let i=0;i<60;i++){await wait(2000);st=await getDesktopAiStatus();if(st?.ollamaRunning)break}
        if(!st?.ollamaRunning)throw new Error('O Ollama ainda não iniciou. Conclua a instalação, abra “Ollama” pelo Menu Iniciar e clique novamente em Preparar IA.')
      }
      setProgress(`Baixando ${textModel}. Na primeira vez isso pode levar alguns minutos…`);await pullOllamaModel(textModel)
      setProgress('Executando teste real do modelo…');await saveDesktopAiSettings({textModel});const test=await testDesktopAi()
      setMessage(test.message);setProgress('');await refresh()
    }catch(err){setProgress('');setError(err instanceof Error?err.message:'Falha ao preparar a IA local.')}
    finally{setLoading(false)}
  }

  const stateLabel=!status?'Verificando…':status.setupState==='ready'?'IA local pronta':status.setupState==='model-missing'?'Ollama ativo · modelo ausente':'Ollama não detectado'
  return <><div className="desktop-modal-backdrop" onClick={onClose}/><section className="desktop-ai-settings" role="dialog" aria-modal="true" aria-label="Configuração da IA local">
    <header><div><ShieldCheck size={22}/><div><strong>ASTERYON AI Local · Gratuita</strong><span>Ollama no Windows 11 · sem API Key e sem créditos</span></div></div><button onClick={onClose}><X size={20}/></button></header>
    <div className="desktop-setting-status"><div className={status?.configured?'ok':'pending'}>{status?.configured?<CheckCircle2 size={18}/>:loading?<Loader2 className="desktop-spin" size={18}/>:<RefreshCw size={18}/>}<span>{stateLabel}</span></div><small>{status?.configured?`Modelo testado: ${status.textModel}`:'O ASTERYON só libera a geração depois de confirmar que o modelo está realmente instalado e respondendo.'}</small></div>
    <div className="desktop-model-grid"><label>Modelo local<select value={textModel} onChange={e=>setTextModel(e.target.value)} disabled={loading}><option value="qwen3:4b">Qwen3 4B · recomendado</option><option value="qwen3:8b">Qwen3 8B · melhor qualidade</option><option value="gemma3:4b">Gemma 3 4B · leve</option><option value="llama3.2:3b">Llama 3.2 3B · muito leve</option></select></label><label>Modelos encontrados<input readOnly value={(status?.models||[]).join(', ')||'Nenhum modelo baixado'}/></label></div>
    <div className="desktop-capabilities"><span><Wifi size={15}/> Pesquisa web opcional e controlada</span><span>✓ Temas, layouts, campanhas, textos e análise UX/UI</span><span>✓ Sem cobrança por consulta</span><span>✓ Gerar → Preview → Aprovar → Aplicar ao Rascunho</span></div>
    <button className="desktop-prepare-ai" onClick={prepare} disabled={loading}>{loading?<Loader2 className="desktop-spin" size={17}/>:<Download size={17}/>} {loading?'Preparando IA…':status?.configured?'Revalidar IA':'Preparar IA automaticamente'}</button>
    {progress?<div className="desktop-setting-progress"><Loader2 className="desktop-spin" size={16}/>{progress}</div>:null}
    <details className="desktop-advanced"><summary>Opções avançadas</summary><div><button onClick={()=>void installOllama()} disabled={loading}><Download size={15}/> Instalar Ollama</button><button onClick={()=>void pullOllamaModel(textModel)} disabled={loading||!status?.ollamaRunning}><Download size={15}/> Baixar somente modelo</button><button onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/> Atualizar status</button></div></details>
    {error?<div className="desktop-setting-error">{error}</div>:null}{message?<div className="desktop-setting-success"><CheckCircle2 size={16}/>{message}</div>:null}
    <footer><button onClick={onClose}>Fechar</button></footer>
  </section></>
}
