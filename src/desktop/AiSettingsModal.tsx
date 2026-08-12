import React, { useEffect, useState } from 'react'
import { CheckCircle2, Download, FileSearch, Loader2, Play, RefreshCw, ShieldCheck, Wifi, X } from 'lucide-react'
import { getDesktopAiDiagnostics, getDesktopAiStatus, installOllama, openOllamaLog, pullOllamaModel, saveDesktopAiSettings, startOllama, testDesktopAi, type DesktopAiDiagnostics, type DesktopAiStatus } from './client'
import './desktop.css'

type Props={open:boolean;onClose:()=>void;onConfigured?:(status:DesktopAiStatus)=>void}
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms))

export function AiSettingsModal({open,onClose,onConfigured}:Props){
  const [status,setStatus]=useState<DesktopAiStatus|null>(null)
  const [diagnostics,setDiagnostics]=useState<DesktopAiDiagnostics|null>(null)
  const [textModel,setTextModel]=useState('qwen3:4b')
  const [loading,setLoading]=useState(false)
  const [progress,setProgress]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [showDiagnostics,setShowDiagnostics]=useState(false)

  const refresh=async()=>{const next=await getDesktopAiStatus();setStatus(next);if(next){setTextModel(next.textModel||'qwen3:4b');onConfigured?.(next)};if(showDiagnostics){try{setDiagnostics(await getDesktopAiDiagnostics())}catch{}}return next}
  const refreshDiagnostics=async()=>{try{setDiagnostics(await getDesktopAiDiagnostics())}catch(err){setError(err instanceof Error?err.message:'Falha ao carregar diagnóstico.')}}
  useEffect(()=>{if(open)void refresh()},[open])
  if(!open)return null

  const prepare=async()=>{
    setLoading(true);setError('');setMessage('')
    try{
      setProgress('Salvando o modelo selecionado…');await saveDesktopAiSettings({textModel})
      let st=await getDesktopAiStatus()
      if(!st?.ollamaRunning){
        setProgress('Procurando e iniciando o Ollama instalado…')
        try{await startOllama()}catch{
          setProgress('Ollama não encontrado ativo. Iniciando instalação gratuita…');await installOllama()
          for(let i=0;i<90;i++){await wait(2000);st=await getDesktopAiStatus();if(st?.ollamaRunning)break}
          if(!st?.ollamaRunning)throw new Error('O Ollama ainda não iniciou. Se o instalador estiver aberto, conclua a instalação. Depois clique em Preparar IA novamente.')
        }
      }
      setProgress(`Baixando ${textModel}. Na primeira vez pode levar vários minutos…`);await pullOllamaModel(textModel)
      setProgress('Executando uma conversa real para validar o modelo…');await saveDesktopAiSettings({textModel});const test=await testDesktopAi()
      setMessage(test.message);setProgress('');await refresh();if(showDiagnostics)await refreshDiagnostics()
    }catch(err){setProgress('');setError(err instanceof Error?err.message:'Falha ao preparar a IA local.');setShowDiagnostics(true);await refreshDiagnostics()}
    finally{setLoading(false)}
  }

  const stateLabel=!status?'Verificando…':status.setupState==='ready'?'IA local pronta e testada':status.setupState==='test-required'?'Modelo instalado · falta autoteste':status.setupState==='model-missing'?'Ollama ativo · modelo ausente':'Ollama não detectado'
  const ready=status?.setupState==='ready'&&status.configured

  return <><div className="desktop-modal-backdrop" onClick={onClose}/><section className="desktop-ai-settings" role="dialog" aria-modal="true" aria-label="Configuração da IA local">
    <header><div><ShieldCheck size={22}/><div><strong>ASTERYON AI Local · Gratuita</strong><span>Ollama no Windows 11 · sem API Key e sem créditos</span></div></div><button onClick={onClose}><X size={20}/></button></header>
    <div className="desktop-setting-status"><div className={ready?'ok':'pending'}>{ready?<CheckCircle2 size={18}/>:loading?<Loader2 className="desktop-spin" size={18}/>:<RefreshCw size={18}/>}<span>{stateLabel}</span></div><small>{ready?`Modelo validado: ${status?.textModel}${status?.ollamaVersion?` · Ollama ${status.ollamaVersion}`:''}`:'A geração só é liberada depois que serviço, modelo e uma resposta real forem validados.'}</small></div>
    <div className="desktop-model-grid"><label>Modelo local<select value={textModel} onChange={e=>setTextModel(e.target.value)} disabled={loading}><option value="qwen3:4b">Qwen3 4B · recomendado</option><option value="qwen3:8b">Qwen3 8B · melhor qualidade</option><option value="gemma3:4b">Gemma 3 4B · leve</option><option value="llama3.2:3b">Llama 3.2 3B · muito leve</option></select></label><label>Modelos encontrados<input readOnly value={(status?.models||[]).join(', ')||'Nenhum modelo baixado'}/></label></div>
    <div className="desktop-capabilities"><span><Wifi size={15}/>Pesquisa web opcional e controlada</span><span>✓ Temas, layouts, campanhas, textos e análise UX/UI</span><span>✓ Sem cobrança por consulta</span><span>✓ Gerar → Preview → Aprovar → Aplicar ao Rascunho</span></div>
    <button className="desktop-prepare-ai" onClick={prepare} disabled={loading}>{loading?<Loader2 className="desktop-spin" size={17}/>:ready?<RefreshCw size={17}/>:<Download size={17}/>} {loading?'Preparando IA…':ready?'Revalidar IA':'Preparar IA automaticamente'}</button>
    {progress?<div className="desktop-setting-progress"><Loader2 className="desktop-spin" size={16}/>{progress}</div>:null}
    {error?<div className="desktop-setting-error">{error}</div>:null}{message?<div className="desktop-setting-success"><CheckCircle2 size={16}/>{message}</div>:null}

    <details className="desktop-advanced"><summary>Opções avançadas</summary><div><button onClick={()=>void installOllama()} disabled={loading}><Download size={15}/>Instalar Ollama</button><button onClick={()=>void startOllama()} disabled={loading}><Play size={15}/>Iniciar serviço</button><button onClick={()=>void pullOllamaModel(textModel)} disabled={loading||!status?.ollamaRunning}><Download size={15}/>Baixar modelo</button><button onClick={()=>void testDesktopAi().then(r=>setMessage(r.message)).catch(e=>setError(e.message))} disabled={loading||!status?.ollamaRunning}><RefreshCw size={15}/>Executar autoteste</button></div></details>

    <div className="desktop-diagnostics-toggle"><button onClick={async()=>{const next=!showDiagnostics;setShowDiagnostics(next);if(next)await refreshDiagnostics()}}><FileSearch size={15}/>{showDiagnostics?'Ocultar diagnóstico':'Diagnóstico da IA'}</button></div>
    {showDiagnostics?<section className="desktop-diagnostics">
      <div className="diagnostic-grid"><span>API local</span><strong className={diagnostics?.ollamaRunning?'good':'bad'}>{diagnostics?.ollamaRunning?'Respondendo':'Sem resposta'}</strong><span>Versão Ollama</span><strong>{diagnostics?.ollamaVersion||'—'}</strong><span>Executável</span><strong className={diagnostics?.binaryDetected?'good':'bad'}>{diagnostics?.binaryDetected?'Encontrado':'Não detectado'}</strong><span>Modelo selecionado</span><strong>{diagnostics?.selectedModel||textModel}</strong><span>Modelo instalado</span><strong className={diagnostics?.selectedInstalled?'good':'bad'}>{diagnostics?.selectedInstalled?'Sim':'Não'}</strong><span>Autoteste</span><strong className={diagnostics?.validated?'good':'bad'}>{diagnostics?.validated?'Aprovado':'Pendente'}</strong></div>
      {diagnostics?.binaryPath?<small>Executável: {diagnostics.binaryPath}</small>:null}
      {diagnostics?.lastError?<div className="diagnostic-error"><strong>Último erro · {diagnostics.lastError.stage}</strong><span>{diagnostics.lastError.message}</span></div>:null}
      {diagnostics?.serverLogTail?<details className="diagnostic-log"><summary>Últimas linhas do server.log</summary><pre>{diagnostics.serverLogTail}</pre></details>:<p className="diagnostic-empty">Nenhum log do servidor encontrado ainda.</p>}
      <div className="diagnostic-actions"><button onClick={()=>void refreshDiagnostics()}><RefreshCw size={14}/>Atualizar</button><button onClick={()=>void openOllamaLog()}><FileSearch size={14}/>Abrir pasta do log</button></div>
    </section>:null}
    <footer><button onClick={onClose}>Fechar</button></footer>
  </section></>
}
