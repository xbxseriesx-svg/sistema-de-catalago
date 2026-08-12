import React, { useEffect, useMemo, useState } from 'react'
import {
  Bot, Check, CheckCircle2, ClipboardCheck, Eye, Image as ImageIcon, LayoutTemplate,
  Loader2, Megaphone, Palette, Search, Settings, ShieldCheck, Sparkles, Type, WandSparkles, X,
} from 'lucide-react'
import { AiSettingsModal } from '../desktop/AiSettingsModal'
import { getDesktopAiStatus, type DesktopAiStatus } from '../desktop/client'
import { DocumentPreview } from '../editor/DocumentPreview'
import { useEditorStore } from '../editor/store'
import { applyAsteryonAiDraft } from './apply'
import { requestAsteryonAiProposal } from './client'
import { cloneProposalWithStage } from './engine'
import { ASTERYON_AI_ALLOWED_RESEARCH_SCOPES, ASTERYON_AI_POLICY } from './policy'
import type { AsteryonAiProposal } from './types'
import './asteryon-ai.css'

type Props = { open: boolean; onClose: () => void }

const quickPrompts = [
  { icon:<Palette size={15}/>, label:'Tema', prompt:'Crie um tema Festa Junina Premium para o catálogo' },
  { icon:<LayoutTemplate size={15}/>, label:'Layout', prompt:'Crie uma home moderna para distribuidora de alimentos' },
  { icon:<Megaphone size={15}/>, label:'Campanha', prompt:'Criar campanha Dia das Crianças com banner, CTA, vitrines e cards' },
  { icon:<Type size={15}/>, label:'Texto', prompt:'Criar banner para chocolates premium com título, subtítulo e CTA' },
  { icon:<ImageIcon size={15}/>, label:'Imagem', prompt:'Criar briefing original para uma imagem de hero de chocolate premium elegante' },
  { icon:<Search size={15}/>, label:'Analisar', prompt:'Analisar página atual e verificar contraste, tipografia, mobile, espaçamento, acessibilidade e SEO' },
]

const formatIntent = (intent: AsteryonAiProposal['intent']) => ({
  theme:'Tema', background:'Plano de fundo', layout:'Layout', landing:'Landing page', 'catalog-structure':'Estrutura de catálogo',
  copy:'Texto', banner:'Banner', campaign:'Campanha', image:'Imagem', 'design-audit':'Análise', improve:'Melhoria', identity:'Identidade visual', suggestions:'Sugestões',
}[intent])

export function AsteryonAI({ open, onClose }: Props) {
  const document = useEditorStore(s=>s.history.present)
  const device = useEditorStore(s=>s.device)
  const selectedBlockId = useEditorStore(s=>s.selectedBlockId)
  const [prompt,setPrompt] = useState('')
  const [proposal,setProposal] = useState<AsteryonAiProposal|null>(null)
  const [loading,setLoading] = useState(false)
  const [previewOpen,setPreviewOpen] = useState(false)
  const [researchRequested,setResearchRequested] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [desktopStatus,setDesktopStatus] = useState<DesktopAiStatus|null>(null)
  const [settingsOpen,setSettingsOpen] = useState(false)
  const prettyJson = useMemo(()=>proposal?JSON.stringify(proposal.structured,null,2):'',[proposal])

  const refreshStatus = () => void getDesktopAiStatus().then(status=>setDesktopStatus(status))
  useEffect(()=>{ if(!open)return; void getDesktopAiStatus().then(status=>{ setDesktopStatus(status); if(status && !status.configured)setSettingsOpen(true) }) },[open])
  if(!open)return null

  const aiReady = Boolean(desktopStatus?.configured && desktopStatus?.ollamaRunning)
  const statusText = !desktopStatus ? 'Verificando IA local…'
    : !desktopStatus.ollamaRunning ? 'Ollama não detectado'
    : !desktopStatus.configured ? `Ollama ativo · baixe o modelo ${desktopStatus.textModel}`
    : `Ollama ativo · ${desktopStatus.textModel} · IA local pronta`

  const generate = async()=>{
    const text=prompt.trim(); if(!text)return
    if(desktopStatus && !aiReady){ setSettingsOpen(true); setError('A IA local ainda não está pronta. Instale/ative o Ollama e baixe o modelo antes de gerar.'); return }
    setLoading(true); setError(''); setNotice('')
    try{
      const result=await requestAsteryonAiProposal(text,document,researchRequested,selectedBlockId)
      setProposal({...result,research:{...result.research,requested:researchRequested,allowedScopes:ASTERYON_AI_ALLOWED_RESEARCH_SCOPES}})
      if(result.source==='safe-local-engine') setNotice('O Ollama não respondeu e o motor interno de contingência assumiu. Abra Configurações da IA para verificar o modelo.')
    }catch(err){ setError(err instanceof Error?err.message:'Não foi possível gerar a proposta.') }
    finally{ setLoading(false); refreshStatus() }
  }

  const openPreview=()=>{ if(!proposal?.previewDocument)return; setProposal(cloneProposalWithStage(proposal,'previewed')); setPreviewOpen(true) }
  const approve=()=>{ if(!proposal)return; setProposal(cloneProposalWithStage(proposal,'approved')); setNotice('Proposta aprovada. Agora ela pode ser aplicada exclusivamente ao rascunho.') }
  const apply=()=>{ if(!proposal||proposal.stage!=='approved'||!proposal.previewDocument||!proposal.canApply)return; applyAsteryonAiDraft(proposal.previewDocument,proposal.title); setProposal(cloneProposalWithStage(proposal,'applied')); setNotice('Aplicado ao rascunho. A versão publicada não foi alterada.') }

  return <>
    <div className="ai-backdrop" onClick={onClose}/>
    <aside className="asteryon-ai-panel" aria-label="ASTERYON AI">
      <header className="ai-header">
        <div className="ai-brand-icon"><Sparkles size={20}/></div>
        <div className="ai-heading"><strong>ASTERYON AI</strong><span>Ollama local · UX · Marketing · Conteúdo</span></div>
        <button className="ai-close" onClick={()=>setSettingsOpen(true)} aria-label="Configurar IA" title="Configurar IA"><Settings size={19}/></button>
        <button className="ai-close" onClick={onClose} aria-label="Fechar ASTERYON AI"><X size={20}/></button>
      </header>

      <div className="ai-safety-bar"><ShieldCheck size={16}/><div><strong>Modo Rascunho Protegido</strong><span>IA nunca publica nem altera produção diretamente.</span></div></div>
      <div className="ai-research-note">Status: {statusText}</div>

      <section className="ai-compose">
        <label htmlFor="asteryon-ai-prompt">Descreva o que deseja criar ou melhorar</label>
        <textarea id="asteryon-ai-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ex.: Crie um tema Natal Luxo com aparência premium, elegante e leve no mobile." rows={5}/>
        <div className="ai-quick-prompts">{quickPrompts.map(item=><button key={item.label} onClick={()=>setPrompt(item.prompt)}>{item.icon}<span>{item.label}</span></button>)}</div>
        <label className="ai-research-toggle"><input type="checkbox" checked={researchRequested} onChange={e=>setResearchRequested(e.target.checked)}/><span><Search size={14}/> Pesquisa web gratuita somente como inspiração</span></label>
        {researchRequested?<div className="ai-research-note">Permitido: tendências, datas comemorativas, paletas, branding, marketing, UX/UI, campanhas e padrões visuais. O conteúdo externo nunca é aplicado diretamente.</div>:null}
        <button className="ai-generate" onClick={generate} disabled={!prompt.trim()||loading||(desktopStatus!==null&&!aiReady)}>{loading?<Loader2 className="ai-spin" size={17}/>:<WandSparkles size={17}/>} {loading?'Gerando proposta…':aiReady?'Gerar':'Configurar IA para gerar'}</button>
      </section>

      {error?<div className="ai-error">{error}</div>:null}
      {notice?<div className="ai-notice"><CheckCircle2 size={15}/>{notice}</div>:null}

      {proposal?<section className="ai-result">
        <div className="ai-result-head"><div><span className="ai-intent-badge">{formatIntent(proposal.intent)}</span><h3>{proposal.title}</h3><p>{proposal.summary}</p><small>Origem: {proposal.source==='desktop-ollama'?`Ollama · ${desktopStatus?.textModel||'modelo local'}`:proposal.source==='supabase-provider'?'Provider online':'Motor interno de contingência'}</small></div><span className={`ai-stage ai-stage-${proposal.stage}`}>{proposal.stage==='generated'?'Gerado':proposal.stage==='previewed'?'Preview':proposal.stage==='approved'?'Aprovado':'Aplicado'}</span></div>
        <div className="ai-flow">{ASTERYON_AI_POLICY.flow.map((step,index)=>{ const stageIndex=proposal.stage==='generated'?0:proposal.stage==='previewed'?1:proposal.stage==='approved'?2:3; return <div className={index<=stageIndex?'active':''} key={step}><span>{index<stageIndex?<Check size={12}/>:index+1}</span><small>{step}</small></div> })}</div>
        {proposal.findings?.length?<div className="ai-findings">{proposal.findings.map((finding,index)=><article className={`ai-finding ai-${finding.severity}`} key={`${finding.area}-${index}`}><div><strong>{finding.title}</strong><span>{finding.area}</span></div><p>{finding.description}</p><small>{finding.suggestion}</small></article>)}</div>:null}
        {proposal.imagePrompt?<div className="ai-image-brief"><ImageIcon size={17}/><div><strong>Briefing de imagem original</strong><p>{proposal.imagePrompt}</p><small>Geração gráfica local ainda não está instalada nesta versão leve. Este briefing pode ser usado futuramente no módulo opcional de imagem local.</small></div></div>:null}
        <details className="ai-json"><summary><Bot size={15}/> Saída estruturada JSON</summary><pre>{prettyJson}</pre></details>
        <div className="ai-guardrails"><ShieldCheck size={15}/><div><strong>Garantias desta proposta</strong><span>Produção tocada: não · Publicação automática: não · Aprovação obrigatória: sim · Pesquisa web: {proposal.research.used?'usada com restrições':'não usada'}</span></div></div>
        <div className="ai-actions"><button onClick={openPreview} disabled={!proposal.previewDocument||proposal.stage==='applied'}><Eye size={16}/> Preview</button><button onClick={approve} disabled={!proposal.canApply||proposal.stage==='approved'||proposal.stage==='applied'}><ClipboardCheck size={16}/> Aprovar</button><button className="ai-apply" onClick={apply} disabled={proposal.stage!=='approved'||!proposal.canApply}><CheckCircle2 size={16}/> Aplicar ao Rascunho</button></div>
      </section>:<section className="ai-empty"><Bot size={34}/><h3>Seu copiloto criativo local</h3><p>Crie temas, layouts, campanhas, textos, briefings de imagem e análises sem publicação automática.</p></section>}
    </aside>
    <AiSettingsModal open={settingsOpen} onClose={()=>{setSettingsOpen(false);refreshStatus()}} onConfigured={setDesktopStatus}/>
    {previewOpen&&proposal?.previewDocument?<div className="ai-preview-overlay"><div className="ai-preview-toolbar"><div><Sparkles size={17}/><strong>Preview ASTERYON AI</strong><span>{proposal.title}</span></div><div className="ai-preview-status"><ShieldCheck size={14}/>Rascunho isolado</div><button onClick={()=>setPreviewOpen(false)}><X size={18}/> Fechar</button></div><div className={`ai-preview-frame ai-preview-${device}`}><DocumentPreview document={proposal.previewDocument} device={device} visitorMode/></div></div>:null}
  </>
}
