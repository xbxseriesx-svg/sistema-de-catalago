import React, { useState } from 'react'
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Eye, EyeOff, ImagePlus, Lock, Unlock } from 'lucide-react'
import { clone, defaultCanvas } from './defaults'
import { useEditorStore } from './store'
import type { BuilderBlock, Device } from './types'

const FONTS=['Inter','Poppins','Roboto','Open Sans','Montserrat','Lato','Nunito','DM Sans','Work Sans','Rubik','Raleway','Quicksand','Source Sans 3','Archivo','PT Sans','Ubuntu','Merriweather','Lora','Playfair Display','Libre Baskerville','Cormorant Garamond','Bebas Neue','Oswald','Anton','Pacifico','Dancing Script','Great Vibes','Lobster']

const fileToDataUrl=(file:File)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(file)})
const numberFromWidth=(value?:string)=>Number.parseFloat(String(value||'0'))||0

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="creative-field"><span>{label}</span>{children}</label>}
function NumberField({label,value,onChange,min=-9999,max=99999,suffix}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;suffix?:string}){return <Field label={label}><div className="creative-number"><input type="number" value={Math.round(value)} min={min} max={max} onChange={e=>onChange(Math.max(min,Math.min(max,Number(e.target.value)||0)))}/>{suffix?<span>{suffix}</span>:null}</div></Field>}
function ColorField({label,value,onChange}:{label:string;value?:string;onChange:(v:string)=>void}){const safe=/^#[0-9a-f]{6}$/i.test(value||'')?value!:'#FFFFFF';return <Field label={label}><div className="creative-color"><input type="color" value={safe} onChange={e=>onChange(e.target.value)}/><input value={value||''} onChange={e=>onChange(e.target.value)} /></div></Field>}

function commitCanvas(patch:Record<string,unknown>,label:string){
  const state=useEditorStore.getState(),current=state.history.present,next=clone(current)
  next.canvas={...(next.canvas||clone(defaultCanvas)),...patch} as typeof next.canvas
  next.status='draft';next.updatedAt=new Date().toISOString()
  useEditorStore.setState({history:{past:[...state.history.past,clone(current)].slice(-100),present:next,future:[]},sandboxes:state.sandboxes.map(s=>s.id===state.activeSandboxId?{...s,document:clone(next)}:s),activity:[{id:`log_${Date.now()}`,at:new Date().toISOString(),action:'UPDATE_PAGE',label},...state.activity].slice(0,200)})
}

function moveLayer(block:BuilderBlock,mode:'front'|'top'|'back'|'bottom'){
  const state=useEditorStore.getState(),doc=state.history.present,device=state.device
  const siblings=doc.blocks.filter(b=>b.parentId===block.parentId&&b.id!==block.id)
  const values=siblings.map(b=>Number(b.style[device]?.zIndex||1))
  const current=Number(block.style[device]?.zIndex||1)
  const min=values.length?Math.min(...values):1,max=values.length?Math.max(...values):1
  const next=mode==='top'?max+1:mode==='bottom'?Math.max(1,min-1):mode==='front'?current+1:Math.max(1,current-1)
  state.updateDeviceStyle(block.id,device,{zIndex:next},mode==='top'?'Trazido para o topo':mode==='bottom'?'Enviado para o fundo':mode==='front'?'Trazido para frente':'Enviado para trás')
}

function PageProperties(){
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device)
  const canvas=doc.canvas||defaultCanvas
  const config=canvas[device]
  return <aside className="creative-properties"><div className="creative-properties-head"><div><small>PÁGINA</small><strong>{doc.name}</strong></div><span>Nenhum objeto selecionado</span></div>
    <section className="creative-property-section"><h3>Fundo</h3><ColorField label="Cor" value={canvas.background} onChange={v=>commitCanvas({background:v,gradient:''},'Cor do fundo alterada')}/><Field label="Gradiente"><input value={canvas.gradient||''} placeholder="Ex.: linear-gradient(...)" onChange={e=>commitCanvas({gradient:e.target.value},'Gradiente alterado')}/></Field><Field label="Imagem de fundo"><label className="creative-upload"><ImagePlus size={15}/>Escolher imagem<input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];if(f)commitCanvas({backgroundImage:await fileToDataUrl(f)},'Imagem de fundo alterada')}}/></label></Field></section>
    <section className="creative-property-section"><h3>Tamanho da página</h3><NumberField label="Largura" value={config.width} min={320} max={4000} suffix="px" onChange={v=>commitCanvas({[device]:{...config,width:v}},'Largura da página alterada')}/><NumberField label="Altura" value={config.height} min={500} max={20000} suffix="px" onChange={v=>commitCanvas({[device]:{...config,height:v}},'Altura da página alterada')}/></section>
    <section className="creative-property-section"><h3>Ajuda visual</h3><label className="creative-toggle"><input type="checkbox" checked={Boolean(canvas.showGrid)} onChange={e=>commitCanvas({showGrid:e.target.checked},'Grade visual alterada')}/><span>Mostrar grade</span></label><p className="creative-help">Guias de alinhamento aparecem durante o movimento, mas não prendem os objetos.</p></section>
  </aside>
}

export function CreativePropertiesPanel({selectedId}:{selectedId:string|null}){
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device)
  const updateStyle=useEditorStore(s=>s.updateBlockStyle),updateDevice=useEditorStore(s=>s.updateDeviceStyle),updateProps=useEditorStore(s=>s.updateBlockProps),updateBlock=useEditorStore(s=>s.updateBlock),toggleLocked=useEditorStore(s=>s.toggleLocked),toggleHidden=useEditorStore(s=>s.toggleHidden)
  const [advanced,setAdvanced]=useState(false)
  const block=selectedId?doc.blocks.find(b=>b.id===selectedId):null
  if(!block)return <PageProperties/>
  const d=block.style[device]||{}
  const width=numberFromWidth(d.width)
  const title=block.name||'Objeto'
  const isText=block.type==='text'
  const isButton=block.type==='button'
  const isImage=block.type==='image'
  const isShape=block.props.editorRole==='shape'
  const isGroup=block.props.editorRole==='group'||block.props.editorRole==='atomic-product'||block.props.editorRole==='atomic-showcase'||block.props.editorRole==='atomic-banner'
  const setStyle=(patch:Partial<BuilderBlock['style']>,label='Aparência alterada')=>updateStyle(block.id,patch,label)
  const setD=(patch:Record<string,unknown>,label='Posição alterada')=>updateDevice(block.id,device,patch,label)

  return <aside className="creative-properties"><div className="creative-properties-head"><div><small>OBJETO SELECIONADO</small><input className="creative-object-name" value={title} onChange={e=>updateBlock(block.id,{name:e.target.value},'Objeto renomeado')}/></div><span>{isGroup?'Grupo':isShape?'Forma':block.type}</span></div>
    <section className="creative-property-section"><h3>Aparência</h3>
      {(isText||isButton)?<><Field label="Fonte"><select value={block.style.fontFamily||''} onChange={e=>setStyle({fontFamily:e.target.value},'Fonte alterada')}><option value="">Fonte padrão</option>{FONTS.map(f=><option value={f} key={f}>{f}</option>)}</select></Field><NumberField label="Tamanho" value={Number(d.fontSize||16)} min={6} max={300} suffix="px" onChange={v=>setD({fontSize:v},'Tamanho do texto alterado')}/><ColorField label="Cor" value={block.style.color} onChange={v=>setStyle({color:v},'Cor do texto alterada')}/><Field label="Peso"><select value={block.style.fontWeight||400} onChange={e=>setStyle({fontWeight:Number(e.target.value)},'Peso do texto alterado')}><option value={300}>Leve</option><option value={400}>Normal</option><option value={500}>Médio</option><option value={600}>Seminegrito</option><option value={700}>Negrito</option><option value={800}>Extra negrito</option></select></Field></>:null}
      {(!isText||isShape||isButton||isGroup)?<ColorField label="Cor de fundo" value={block.style.background} onChange={v=>setStyle({background:v},'Cor de fundo alterada')}/>:null}
      <NumberField label="Transparência" value={100-Number(block.style.opacity??100)} min={0} max={100} suffix="%" onChange={v=>setStyle({opacity:100-v},'Transparência alterada')}/>
      <Field label="Sombra"><select value={block.style.shadow||'none'} onChange={e=>setStyle({shadow:e.target.value},'Sombra alterada')}><option value="none">Sem sombra</option><option value="0 6px 20px rgba(15,23,42,.12)">Suave</option><option value="0 12px 35px rgba(15,23,42,.20)">Média</option><option value="0 20px 55px rgba(15,23,42,.28)">Forte</option></select></Field>
      {(isShape||isGroup||isButton||isImage)?<NumberField label="Borda arredondada" value={Number(block.style.borderRadius||0)} min={0} max={300} suffix="px" onChange={v=>setStyle({borderRadius:v},'Borda arredondada alterada')}/>:null}
      {isText?<Field label="Texto"><textarea value={String(block.props.text||'')} onChange={e=>updateProps(block.id,{text:e.target.value},'Texto alterado')}/></Field>:null}
      {isButton?<Field label="Texto do botão"><input value={String(block.props.label||'')} onChange={e=>updateProps(block.id,{label:e.target.value},'Texto do botão alterado')}/></Field>:null}
      {isImage?<Field label="Imagem"><label className="creative-upload"><ImagePlus size={15}/>Trocar imagem<input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];if(f)updateProps(block.id,{src:await fileToDataUrl(f)},'Imagem alterada')}}/></label></Field>:null}
    </section>
    <section className="creative-property-section"><h3>Posição</h3><div className="creative-grid-2"><NumberField label="X" value={Number(d.x||0)} onChange={v=>setD({x:v},'Posição X alterada')}/><NumberField label="Y" value={Number(d.y||0)} onChange={v=>setD({y:v},'Posição Y alterada')}/><NumberField label="Largura" value={width} min={20} max={5000} suffix="px" onChange={v=>setD({width:`${v}px`},'Largura alterada')}/><NumberField label="Altura" value={Number(d.height||d.minHeight||40)} min={20} max={5000} suffix="px" onChange={v=>setD({height:v,minHeight:v},'Altura alterada')}/></div><NumberField label="Rotação" value={Number(d.rotate||0)} min={-360} max={360} suffix="°" onChange={v=>setD({rotate:v},'Rotação alterada')}/></section>
    <section className="creative-property-section"><h3>Camadas</h3><div className="creative-layer-actions"><button onClick={()=>moveLayer(block,'front')}><ArrowUp size={15}/>Frente</button><button onClick={()=>moveLayer(block,'top')}><ArrowUpToLine size={15}/>Topo</button><button onClick={()=>moveLayer(block,'back')}><ArrowDown size={15}/>Trás</button><button onClick={()=>moveLayer(block,'bottom')}><ArrowDownToLine size={15}/>Fundo</button></div><div className="creative-layer-actions"><button onClick={()=>toggleLocked(block.id)}>{block.locked?<Unlock size={15}/>:<Lock size={15}/>} {block.locked?'Desbloquear':'Bloquear'}</button><button onClick={()=>toggleHidden(block.id)}>{block.hidden?<Eye size={15}/>:<EyeOff size={15}/>} {block.hidden?'Mostrar':'Ocultar'}</button></div></section>
    <button className="creative-more" onClick={()=>setAdvanced(v=>!v)}>{advanced?'Ocultar opções extras':'Mais opções'}</button>
    {advanced?<section className="creative-property-section creative-advanced"><h3>Espaçamentos e borda</h3><NumberField label="Espaçamento interno" value={Number(d.paddingTop||0)} min={0} max={400} suffix="px" onChange={v=>setD({paddingTop:v,paddingRight:v,paddingBottom:v,paddingLeft:v},'Espaçamento interno alterado')}/><NumberField label="Espaçamento externo" value={Number(d.marginTop||0)} min={-400} max={400} suffix="px" onChange={v=>setD({marginTop:v,marginRight:v,marginBottom:v,marginLeft:v},'Espaçamento externo alterado')}/><NumberField label="Espessura da borda" value={Number(block.style.borderWidth||0)} min={0} max={30} suffix="px" onChange={v=>setStyle({borderWidth:v},'Borda alterada')}/><ColorField label="Cor da borda" value={block.style.borderColor} onChange={v=>setStyle({borderColor:v},'Cor da borda alterada')}/></section>:null}
  </aside>
}
