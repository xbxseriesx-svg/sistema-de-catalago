import React, { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Blocks, Box, Clock3, Copy, Eye, GitCompareArrows, GripVertical, History, Layers3, Lock,
  MoreVertical, Plus, RotateCcw, Search, Trash2, Unlock, GitBranch, X, ZoomIn, ZoomOut,
  ArrowUpToLine, ArrowDownToLine,
} from 'lucide-react'
import { blockLibrary } from './defaults'
import { useEditorStore } from './store'
import type { BlockType, BuilderBlock, Device } from './types'
import { BlockContent, PortalSurface } from './BlockRenderer'
import { DocumentPreview } from './DocumentPreview'
import { PropertiesPanel } from './PropertiesPanel'
import { VisualResizeHandles } from './VisualResizeHandles'

const nestingTypes: BlockType[] = ['frame','container','row','column','header','hero','banner','carousel','card','showcase','promotion','category','brand','distribution','footer']

const defaultBox: Record<BlockType, { width: number; minHeight: number }> = {
  frame:{width:620,minHeight:320}, container:{width:760,minHeight:320}, row:{width:760,minHeight:220}, column:{width:380,minHeight:340},
  header:{width:1120,minHeight:90}, search:{width:520,minHeight:48}, hero:{width:900,minHeight:380}, banner:{width:780,minHeight:230}, carousel:{width:900,minHeight:260},
  card:{width:340,minHeight:260}, product:{width:290,minHeight:390}, showcase:{width:1040,minHeight:520}, category:{width:900,minHeight:260}, brand:{width:900,minHeight:260}, distribution:{width:900,minHeight:260}, promotion:{width:1040,minHeight:520},
  text:{width:360,minHeight:48}, button:{width:190,minHeight:46}, image:{width:380,minHeight:240}, video:{width:580,minHeight:340}, gallery:{width:760,minHeight:360}, faq:{width:580,minHeight:260}, form:{width:580,minHeight:360}, footer:{width:1120,minHeight:190}, map:{width:580,minHeight:300}, html:{width:580,minHeight:240},
}

const snap = (value:number, enabled:boolean, size:number) => enabled ? Math.max(0, Math.round(value / Math.max(1,size)) * Math.max(1,size)) : Math.max(0, Math.round(value))

function freePositionFor(type:BlockType, device:Device, x:number, y:number, zIndex:number) {
  const box = defaultBox[type] || { width: 360, minHeight: 120 }
  const maxWidth = device === 'mobile' ? 350 : device === 'tablet' ? 760 : box.width
  return { positionMode:'free' as const, width:`${Math.min(box.width,maxWidth)}px`, minHeight:box.minHeight, x, y, zIndex, rotate:0 }
}

function insertFree(type:BlockType, x?:number, y?:number) {
  const state = useEditorStore.getState()
  state.addBlock(type)
  const id = useEditorStore.getState().selectedBlockId
  if (!id) return
  const fresh = useEditorStore.getState()
  const device = fresh.device
  const doc = fresh.history.present
  const count = doc.blocks.filter(b=>b.parentId===null).length
  const canvas = doc.canvas[device]
  const box = defaultBox[type] || {width:360,minHeight:120}
  const px = x ?? Math.max(16, Math.min(canvas.width - Math.min(box.width, canvas.width - 32) - 16, 32 + ((count - 1) % 7) * 24))
  const py = y ?? 32 + ((count - 1) % 12) * 32
  fresh.updateDeviceStyle(id, device, freePositionFor(type,device,px,py,count+2), 'Elemento inserido livremente na página')
}

function LibraryItem({type,label,description}:{type:BlockType;label:string;description:string}) {
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:`library:${type}`,data:{kind:'library',type,label}})
  return <button ref={setNodeRef} className="library-item hostinger-library-item" style={{transform:CSS.Translate.toString(transform),opacity:isDragging?.45:1}} onClick={()=>insertFree(type)} {...attributes} {...listeners}>
    <span className="library-icon"><Box size={17}/></span><span><strong>{label}</strong><small>{description}</small></span><GripVertical size={16}/>
  </button>
}

function LeftLibrary() {
  const [tab,setTab]=useState<'blocks'|'templates'|'sandbox'|'history'|'versions'>('blocks')
  const [query,setQuery]=useState('')
  const [versionInspect,setVersionInspect]=useState<{versionId:string;mode:'view'|'compare'}|null>(null)
  const templates=useEditorStore(s=>s.templates),addTemplate=useEditorStore(s=>s.addBlockFromTemplate)
  const sandboxes=useEditorStore(s=>s.sandboxes),activeSandboxId=useEditorStore(s=>s.activeSandboxId),createSandbox=useEditorStore(s=>s.createSandbox),switchSandbox=useEditorStore(s=>s.switchSandbox)
  const activity=useEditorStore(s=>s.activity),snapshots=useEditorStore(s=>s.snapshots),restoreSnapshot=useEditorStore(s=>s.restoreSnapshot)
  const versions=useEditorStore(s=>s.versions),published=useEditorStore(s=>s.published),device=useEditorStore(s=>s.device),restoreVersion=useEditorStore(s=>s.restoreVersion),duplicateVersionToSandbox=useEditorStore(s=>s.duplicateVersionToSandbox)
  const groups=useMemo(()=>{const filtered=blockLibrary.filter(i=>`${i.label} ${i.description} ${i.group}`.toLowerCase().includes(query.toLowerCase()));return filtered.reduce<Record<string,typeof filtered>>((acc,item)=>{(acc[item.group]||=[]).push(item);return acc},{})},[query])
  const inspectedVersion=versionInspect?versions.find(v=>v.id===versionInspect.versionId):null
  return <>
    <aside className="builder-library hostinger-library">
      <div className="library-tabs">
        <button className={tab==='blocks'?'active':''} onClick={()=>setTab('blocks')} title="Elementos"><Blocks size={17}/></button>
        <button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')} title="Templates"><Layers3 size={17}/></button>
        <button className={tab==='sandbox'?'active':''} onClick={()=>setTab('sandbox')} title="Sandbox"><GitBranch size={17}/></button>
        <button className={tab==='history'?'active':''} onClick={()=>setTab('history')} title="Histórico"><History size={17}/></button>
        <button className={tab==='versions'?'active':''} onClick={()=>setTab('versions')} title="Time Machine"><Clock3 size={17}/></button>
      </div>
      {tab==='blocks'?<div className="library-body"><div className="library-heading"><h3>Adicionar elementos</h3><p>Arraste qualquer item diretamente para qualquer ponto da página. Clique para inserir e depois mova livremente.</p></div><label className="library-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar elemento..."/></label>{Object.entries(groups).map(([group,items])=><div key={group} className="library-group"><h4>{group}</h4>{items.map(item=><LibraryItem key={item.type} {...item}/>)}</div>)}</div>:null}
      {tab==='templates'?<div className="library-body"><div className="library-heading"><h3>Componentes salvos</h3><p>Reutilize elementos em qualquer página.</p></div>{templates.length?templates.map(t=><button className="template-card" key={t.id} onClick={()=>{addTemplate(t.id);const id=useEditorStore.getState().selectedBlockId;if(id){const s=useEditorStore.getState();s.updateDeviceStyle(id,s.device,{positionMode:'free',x:40,y:40},'Template inserido livremente')}}}><strong>{t.name}</strong><small>{t.type} · {new Date(t.createdAt).toLocaleDateString('pt-BR')}</small></button>):<div className="empty-library">Nenhum template salvo.</div>}</div>:null}
      {tab==='sandbox'?<div className="library-body"><div className="library-heading"><h3>Sandbox</h3><p>Versões paralelas sem tocar na produção.</p></div><button className="library-primary" onClick={()=>createSandbox(`Teste ${sandboxes.length+1}`)}><Plus size={15}/>Nova versão paralela</button>{sandboxes.map(s=><button key={s.id} className={`sandbox-card ${s.id===activeSandboxId?'active':''}`} onClick={()=>switchSandbox(s.id)}><strong>{s.name}</strong><small>{s.id===activeSandboxId?'Em edição':'Abrir'} · {new Date(s.createdAt).toLocaleDateString('pt-BR')}</small></button>)}</div>:null}
      {tab==='history'?<div className="library-body"><div className="library-heading"><h3>Histórico</h3><p>Snapshots e ações do rascunho.</p></div>{snapshots.map(s=><div className="history-card" key={s.id}><div><strong>{s.label}</strong><small>{new Date(s.at).toLocaleString('pt-BR')}</small></div><button onClick={()=>restoreSnapshot(s.id)}><RotateCcw size={14}/></button></div>)}<h4 className="subheading">Atividade</h4>{activity.slice(0,40).map(a=><div className="activity-row" key={a.id}><span>{new Date(a.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span><div><strong>{a.label}</strong><small>{a.action}</small></div></div>)}</div>:null}
      {tab==='versions'?<div className="library-body"><div className="library-heading"><h3>Time Machine</h3><p>Compare e restaure versões publicadas.</p></div>{versions.map(v=><div className="version-card" key={v.id}><div><strong>Versão {v.number}</strong><small>{v.label}</small></div><div className="version-actions"><button onClick={()=>setVersionInspect({versionId:v.id,mode:'view'})}><Eye size={14}/></button><button onClick={()=>setVersionInspect({versionId:v.id,mode:'compare'})}><GitCompareArrows size={14}/></button><button onClick={()=>restoreVersion(v.id)}><RotateCcw size={14}/></button><button onClick={()=>duplicateVersionToSandbox(v.id,`Versão ${v.number} - cópia`)}><Copy size={14}/></button></div></div>)}</div>:null}
    </aside>
    {versionInspect&&inspectedVersion?<div className="version-inspect-backdrop" onClick={()=>setVersionInspect(null)}><div className={`version-inspect-dialog ${versionInspect.mode}`} onClick={e=>e.stopPropagation()}><div className="version-inspect-head"><div><span>TIME MACHINE</span><h3>{versionInspect.mode==='compare'?`Comparar Versão ${inspectedVersion.number}`:`Visualizar Versão ${inspectedVersion.number}`}</h3></div><button onClick={()=>setVersionInspect(null)}><X size={18}/></button></div>{versionInspect.mode==='view'?<div className="version-single-preview"><DocumentPreview document={inspectedVersion.document} device={device} visitorMode/></div>:<div className="version-compare-grid"><div><strong>PUBLICADO ATUAL</strong><div className="version-mini-preview"><DocumentPreview document={published} device={device} visitorMode/></div></div><div><strong>VERSÃO {inspectedVersion.number}</strong><div className="version-mini-preview"><DocumentPreview document={inspectedVersion.document} device={device} visitorMode/></div></div></div>}</div></div>:null}
  </>
}

function FreeBlock({block,onContextMenu}:{block:BuilderBlock;onContextMenu:(event:React.MouseEvent,block:BuilderBlock)=>void}) {
  const doc=useEditorStore(s=>s.history.present),selectedId=useEditorStore(s=>s.selectedBlockId),select=useEditorStore(s=>s.selectBlock),device=useEditorStore(s=>s.device)
  const d=block.style[device]||{}
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:`canvas-block:${block.id}`,disabled:block.locked,data:{kind:'canvas-block',blockId:block.id}})
  const selected=selectedId===block.id
  const children=doc.blocks.filter(b=>b.parentId===block.id).sort((a,b)=>a.order-b.order)
  const content=<BlockContent block={block} document={doc} device={device}>{nestingTypes.includes(block.type)?<div className="hostinger-nested-stage">{children.map(child=><FreeBlock key={child.id} block={child} onContextMenu={onContextMenu}/>)}</div>:null}</BlockContent>
  const x=Number(d.x||0),y=Number(d.y||0)
  const style:React.CSSProperties={position:'absolute',left:x,top:y,width:d.width||'auto',minHeight:d.minHeight,zIndex:d.zIndex||1,transform:`translate3d(${transform?.x||0}px,${transform?.y||0}px,0)${d.rotate?` rotate(${d.rotate}deg)`:''}`,opacity:isDragging?.55:undefined}
  return <div ref={setNodeRef} className={`hostinger-free-block ${selected?'selected':''} ${block.locked?'locked':''}`} style={style} onClick={e=>{e.stopPropagation();select(block.id)}} onContextMenu={e=>onContextMenu(e,block)}>
    <button className="hostinger-drag-handle" title="Arraste para mover" {...attributes} {...listeners}><GripVertical size={15}/><span>{block.name}</span>{block.locked?<Lock size={12}/>:null}</button>
    {selected&&!block.locked?<VisualResizeHandles block={block} device={device}>{content}</VisualResizeHandles>:content}
  </div>
}

function CanvasStage({zoom,onContextMenu}:{zoom:number;onContextMenu:(event:React.MouseEvent,block:BuilderBlock)=>void}) {
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device),select=useEditorStore(s=>s.selectBlock)
  const {setNodeRef,isOver}=useDroppable({id:'hostinger-canvas',data:{kind:'canvas'}})
  const config=doc.canvas[device]
  const roots=doc.blocks.filter(b=>b.parentId===null).sort((a,b)=>(a.style[device]?.zIndex||0)-(b.style[device]?.zIndex||0))
  const background=doc.canvas.gradient||doc.canvas.background
  return <div className="hostinger-canvas-viewport" onClick={()=>select(null)}>
    <div className="hostinger-device-shell" style={{width:config.width,transform:`scale(${zoom})`,transformOrigin:'top center'}}>
      <PortalSurface document={doc} device={device}>
        <div ref={setNodeRef} data-asteryon-hostinger-canvas className={`hostinger-canvas-stage ${doc.canvas.showGrid?'show-grid':''} ${isOver?'drag-over':''}`} style={{height:config.height,background,backgroundImage:doc.canvas.backgroundImage?`url(${doc.canvas.backgroundImage})`:doc.canvas.gradient||undefined,backgroundSize:doc.canvas.backgroundSize,backgroundPosition:doc.canvas.backgroundPosition}}>
          {roots.length===0?<div className="hostinger-empty-hint"><strong>Página livre</strong><span>Arraste qualquer elemento do painel esquerdo para qualquer ponto desta área.</span></div>:null}
          {roots.map(block=><FreeBlock key={block.id} block={block} onContextMenu={onContextMenu}/>)}
        </div>
      </PortalSurface>
    </div>
  </div>
}

function CanvasToolbar({zoom,setZoom}:{zoom:number;setZoom:(v:number)=>void}) {
  const device=useEditorStore(s=>s.device),doc=useEditorStore(s=>s.history.present)
  return <div className="hostinger-canvas-toolbar"><span>{device} · {doc.canvas[device].width}px</span><button onClick={()=>setZoom(Math.max(.3,zoom-.1))}><ZoomOut size={14}/></button><strong>{Math.round(zoom*100)}%</strong><button onClick={()=>setZoom(Math.min(1.8,zoom+.1))}><ZoomIn size={14}/></button><button onClick={()=>setZoom(1)}>100%</button></div>
}

export function HostingerCanvasWorkspace() {
  const device=useEditorStore(s=>s.device),updateD=useEditorStore(s=>s.updateDeviceStyle),duplicate=useEditorStore(s=>s.duplicateBlock),remove=useEditorStore(s=>s.deleteBlock),toggleLocked=useEditorStore(s=>s.toggleLocked)
  const [zoom,setZoom]=useState(1)
  const [activeLabel,setActiveLabel]=useState('')
  const [menu,setMenu]=useState<{x:number;y:number;blockId:string}|null>(null)
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:4}}))
  const onContextMenu=(event:React.MouseEvent,block:BuilderBlock)=>{event.preventDefault();event.stopPropagation();useEditorStore.getState().selectBlock(block.id);setMenu({x:event.clientX,y:event.clientY,blockId:block.id})}
  const onDragStart=(event:DragStartEvent)=>{const d=event.active.data.current;setActiveLabel(String(d?.label||d?.blockId||'Elemento'));setMenu(null)}
  const onDragEnd=(event:DragEndEvent)=>{
    setActiveLabel('')
    const data=event.active.data.current
    if(!data)return
    const doc=useEditorStore.getState().history.present
    const config=doc.canvas[device]
    const grid=doc.canvas.gridSize||8
    const snapping=Boolean(doc.canvas.snapToGrid)
    if(data.kind==='canvas-block'){
      const id=String(data.blockId)
      const block=doc.blocks.find(b=>b.id===id);if(!block)return
      const d=block.style[device]||{}
      const nextX=snap(Number(d.x||0)+event.delta.x/zoom,snapping,grid)
      const nextY=snap(Number(d.y||0)+event.delta.y/zoom,snapping,grid)
      updateD(id,device,{positionMode:'free',x:Math.min(Math.max(0,nextX),Math.max(0,config.width-40)),y:Math.min(Math.max(0,nextY),Math.max(0,config.height-40))},'Elemento movido livremente na página')
      return
    }
    if(data.kind==='library'){
      const over=event.over?.data.current
      if(over?.kind!=='canvas')return
      const stage=document.querySelector<HTMLElement>('[data-asteryon-hostinger-canvas]')
      const translated=event.active.rect.current.translated
      if(!stage||!translated){insertFree(data.type as BlockType);return}
      const rect=stage.getBoundingClientRect()
      const x=snap((translated.left-rect.left)/zoom,snapping,grid)
      const y=snap((translated.top-rect.top)/zoom,snapping,grid)
      insertFree(data.type as BlockType,Math.min(x,config.width-40),Math.min(y,config.height-40))
    }
  }
  const menuBlock=menu?useEditorStore.getState().history.present.blocks.find(b=>b.id===menu.blockId):null
  const maxZ=Math.max(1,...useEditorStore.getState().history.present.blocks.map(b=>Number(b.style[device]?.zIndex||1)))
  return <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <div className="builder-workspace hostinger-workspace">
      <LeftLibrary/>
      <main className="hostinger-canvas-wrap" onContextMenu={e=>e.preventDefault()}><CanvasToolbar zoom={zoom} setZoom={setZoom}/><CanvasStage zoom={zoom} onContextMenu={onContextMenu}/></main>
      <PropertiesPanel/>
    </div>
    <DragOverlay>{activeLabel?<div className="drag-overlay hostinger-drag-overlay"><GripVertical size={16}/>{activeLabel}</div>:null}</DragOverlay>
    {menu&&menuBlock?<div className="hostinger-context-menu" style={{left:menu.x,top:menu.y}} onClick={e=>e.stopPropagation()}>
      <button onClick={()=>{duplicate(menuBlock.id);setMenu(null)}}><Copy size={14}/>Duplicar</button>
      <button onClick={()=>{updateD(menuBlock.id,device,{positionMode:'free',zIndex:maxZ+1},'Elemento trazido para frente');setMenu(null)}}><ArrowUpToLine size={14}/>Trazer para frente</button>
      <button onClick={()=>{updateD(menuBlock.id,device,{positionMode:'free',zIndex:1},'Elemento enviado para trás');setMenu(null)}}><ArrowDownToLine size={14}/>Enviar para trás</button>
      <button onClick={()=>{toggleLocked(menuBlock.id);setMenu(null)}}>{menuBlock.locked?<Unlock size={14}/>:<Lock size={14}/>}{menuBlock.locked?'Desbloquear':'Bloquear'}</button>
      <button className="danger" onClick={()=>{remove(menuBlock.id);setMenu(null)}}><Trash2 size={14}/>Excluir</button>
    </div>:null}
  </DndContext>
}
