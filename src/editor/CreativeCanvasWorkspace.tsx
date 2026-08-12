import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Box, BoxSelect, BringToFront, ChevronDown, ChevronRight, Code2, Columns3, Copy, Eye, EyeOff,
  FileClock, GripVertical, Group, Image as ImageIcon, Layers3, Lock, MousePointer2, Package, Plus,
  Search, SendToBack, Square, Trash2, Type, Ungroup, Unlock, Video, ZoomIn, ZoomOut,
} from 'lucide-react'
import { getCatalogProducts } from '../catalog/data'
import { BlockContent, PortalSurface } from './BlockRenderer'
import { clone, makeBlock, uid } from './defaults'
import { CreativePropertiesPanel } from './CreativePropertiesPanel'
import { useEditorStore } from './store'
import type { BuilderBlock, Device, EditorDocument } from './types'
import { VisualResizeHandles } from './VisualResizeHandles'
import './creative-editor.css'

type LibraryKind = 'text'|'image'|'button'|'video'|'shape'|'section'|'header'|'footer'|'product'|'showcase'|'category'|'html'
type LeftTab = 'add'|'layers'|'history'
type Mode = 'simple'|'advanced'
type Point = { x:number; y:number }

type LibraryDef = {
  kind: LibraryKind
  label: string
  description: string
  group: 'Básico'|'Layout'|'Catálogo'|'Avançado'
  icon: React.ReactNode
  simple?: boolean
}

const LIBRARY: LibraryDef[] = [
  {kind:'text',label:'Texto',description:'Clique na página e digite.',group:'Básico',icon:<Type size={18}/>,simple:true},
  {kind:'image',label:'Imagem',description:'Imagem livre e redimensionável.',group:'Básico',icon:<ImageIcon size={18}/>,simple:true},
  {kind:'button',label:'Botão',description:'Botão independente.',group:'Básico',icon:<Square size={18}/>,simple:true},
  {kind:'video',label:'Vídeo',description:'Vídeo livre no canvas.',group:'Básico',icon:<Video size={18}/>,simple:true},
  {kind:'shape',label:'Forma',description:'Forma para composições.',group:'Básico',icon:<Box size={18}/>,simple:true},
  {kind:'section',label:'Seção',description:'Agrupador opcional.',group:'Layout',icon:<BoxSelect size={18}/>},
  {kind:'header',label:'Cabeçalho',description:'Modelo desmontável em objetos.',group:'Layout',icon:<Columns3 size={18}/>},
  {kind:'footer',label:'Rodapé',description:'Modelo desmontável em objetos.',group:'Layout',icon:<Columns3 size={18}/>},
  {kind:'product',label:'Produto',description:'Produto formado por objetos atômicos.',group:'Catálogo',icon:<Package size={18}/>,simple:true},
  {kind:'showcase',label:'Vitrine',description:'Vitrine livre e desmontável.',group:'Catálogo',icon:<Columns3 size={18}/>},
  {kind:'category',label:'Categoria',description:'Navegação em composição livre.',group:'Catálogo',icon:<Layers3 size={18}/>},
  {kind:'html',label:'HTML',description:'Objeto avançado isolado.',group:'Avançado',icon:<Code2 size={18}/>},
]

const widthOf=(b:BuilderBlock,d:Device)=>Number.parseFloat(String(b.style[d]?.width||'160'))||160
const heightOf=(b:BuilderBlock,d:Device)=>Number(b.style[d]?.height||b.style[d]?.minHeight||40)
const positionOf=(b:BuilderBlock,d:Device)=>({x:Number(b.style[d]?.x||0),y:Number(b.style[d]?.y||0)})

function commitDocument(next:EditorDocument,label:string,selectedId:string|null=null){
  const state=useEditorStore.getState()
  const current=state.history.present
  next.updatedAt=new Date().toISOString()
  next.status='draft'
  useEditorStore.setState({
    history:{past:[...state.history.past,clone(current)].slice(-100),present:next,future:[]},
    sandboxes:state.sandboxes.map(s=>s.id===state.activeSandboxId?{...s,document:clone(next)}:s),
    selectedBlockId:selectedId,
    activity:[{id:uid('log'),at:new Date().toISOString(),action:'CREATIVE_EDITOR',label,blockId:selectedId||undefined},...state.activity].slice(0,200),
  })
}

function setBox(block:BuilderBlock,parentId:string|null,x:number,y:number,width:number,height:number,z=2){
  block.parentId=parentId
  block.style.desktop={...block.style.desktop,positionMode:'free',x,y,width:`${width}px`,height,minHeight:height,zIndex:z}
  block.style.tablet={...block.style.tablet,positionMode:'free',x:Math.min(x,500),y,width:`${Math.min(width,760)}px`,height,minHeight:height,zIndex:z}
  block.style.mobile={...block.style.mobile,positionMode:'free',x:Math.min(x,24),y,width:`${Math.min(width,342)}px`,height,minHeight:height,zIndex:z}
  return block
}

function makeText(text:string,parentId:string|null,x:number,y:number,width=260,height=48,fontSize=20,weight=400,color='#172230'){
  const b=setBox(makeBlock('text'),parentId,x,y,width,height,4)
  b.props={text,tag:'p'}
  b.style.fontWeight=weight
  b.style.color=color
  b.style.desktop.fontSize=fontSize
  b.style.tablet.fontSize=fontSize
  b.style.mobile.fontSize=Math.max(12,Math.min(fontSize,32))
  return b
}
function makeImage(src:string,parentId:string|null,x:number,y:number,width:number,height:number){
  const b=setBox(makeBlock('image'),parentId,x,y,width,height,2)
  b.props={src,alt:'Imagem',fit:'cover'}
  b.style.borderRadius=12
  return b
}
function makeButton(label:string,parentId:string|null,x:number,y:number,width=170,height=46){
  const b=setBox(makeBlock('button'),parentId,x,y,width,height,5)
  b.props={label,link:'#',target:'_self'}
  b.style.background='#0B5D3B';b.style.color='#FFFFFF';b.style.borderRadius=10;b.style.fontWeight=600
  b.style.desktop.fontSize=14;b.style.tablet.fontSize=14;b.style.mobile.fontSize=14
  return b
}
function makeShape(parentId:string|null,x:number,y:number,width:number,height:number,color='#E9EEF4'){
  const b=setBox(makeBlock('card'),parentId,x,y,width,height,1)
  b.name='Forma';b.props={editorRole:'shape',showDefaultContent:false};b.style.background=color;b.style.borderWidth=0;b.style.borderRadius=18
  return b
}
function makeGroup(name:string,parentId:string|null,x:number,y:number,width:number,height:number,role='group'){
  const b=setBox(makeBlock('frame'),parentId,x,y,width,height,2)
  b.name=name;b.props={editorRole:role,showDefaultContent:false};b.style.background='transparent';b.style.borderWidth=0;b.style.borderRadius=0
  return b
}

function atomicProduct(parentId:string|null,x:number,y:number,index=0):BuilderBlock[]{
  const products=getCatalogProducts()
  const product=products[index%Math.max(1,products.length)]
  const group=makeGroup(product?.name||'Produto',parentId,x,y,290,410,'atomic-product')
  const bg=makeShape(group.id,0,0,290,410,'#FFFFFF')
  bg.style.shadow='0 10px 28px rgba(15,23,42,.10)';bg.style.borderWidth=1;bg.style.borderColor='#E4E9EF'
  const image=makeImage(product?.image||'',group.id,14,14,262,205)
  const brand=makeText(product?.brand||'Marca',group.id,16,232,250,24,12,600,'#6B7280')
  const name=makeText(product?.name||'Nome do produto',group.id,16,258,255,52,18,700,'#172230')
  const price=makeText(product?.price?`R$ ${product.price}`:'Consulte',group.id,16,318,180,30,18,700,'#0B5D3B')
  const button=makeButton('Ver informações',group.id,16,355,165,40)
  for(const child of [image,brand,name,price,button]) child.props={...child.props,bindingProductCode:product?.code||'',bindingSource:'catalog'}
  return [group,bg,image,brand,name,price,button]
}

function buildTemplate(kind:LibraryKind,x:number,y:number):BuilderBlock[]{
  if(kind==='text') return [makeText('Digite seu texto',null,x,y,300,50,24,500)]
  if(kind==='image') return [makeImage('',null,x,y,360,240)]
  if(kind==='button') return [makeButton('Clique aqui',null,x,y)]
  if(kind==='video'){const b=setBox(makeBlock('video'),null,x,y,520,300,2);b.props={url:'',autoplay:false,muted:true};return [b]}
  if(kind==='shape') return [makeShape(null,x,y,320,180)]
  if(kind==='html') return [setBox(makeBlock('html'),null,x,y,520,240,2)]
  if(kind==='section'){
    const group=makeGroup('Seção',null,x,y,760,360)
    group.style.background='rgba(255,255,255,.35)';group.style.borderWidth=1;group.style.borderColor='#CBD5E1';group.style.borderRadius=18
    return [group]
  }
  if(kind==='product') return atomicProduct(null,x,y,0)
  if(kind==='showcase'){
    const group=makeGroup('Vitrine',null,x,y,970,520,'atomic-showcase')
    const title=makeText('Produtos em destaque',group.id,0,0,500,52,30,700)
    const a=atomicProduct(group.id,0,76,0)
    const b=atomicProduct(group.id,330,76,1)
    const c=atomicProduct(group.id,660,76,2)
    return [group,title,...a,...b,...c]
  }
  if(kind==='category'){
    const group=makeGroup('Categorias',null,x,y,720,210)
    const title=makeText('Categorias',group.id,0,0,300,44,28,700)
    const categories=Array.from(new Set(getCatalogProducts().map(p=>p.category).filter(Boolean))).slice(0,3)
    const children:BuilderBlock[]=[]
    categories.forEach((category,i)=>{
      const shape=makeShape(group.id,i*230,65,210,120,'#FFFFFF');shape.style.borderWidth=1;shape.style.borderColor='#E2E8F0'
      children.push(shape,makeText(category,group.id,i*230+16,105,175,38,18,600))
    })
    return [group,title,...children]
  }
  if(kind==='header'){
    const group=makeGroup('Cabeçalho',null,x,y,1050,96)
    group.style.background='#FFFFFF';group.style.shadow='0 4px 18px rgba(15,23,42,.08)'
    const brand=makeText('ASTERYON',group.id,24,27,180,40,24,800,'#0B5D3B')
    const search=makeShape(group.id,270,22,430,52,'#F7F9FB');search.name='Fundo da pesquisa';search.style.borderWidth=1;search.style.borderColor='#DCE4EC';search.style.borderRadius=12
    const placeholder=makeText('Buscar produtos...',group.id,310,35,270,28,14,400,'#7B8794')
    const nav=makeText('Catálogo     Promoções     Marcas',group.id,755,35,270,28,14,600,'#253244')
    return [group,brand,search,placeholder,nav]
  }
  const group=makeGroup('Rodapé',null,x,y,1050,180)
  group.style.background='#081527';group.style.borderRadius=18
  return [group,makeText('ASTERYON',group.id,30,34,220,44,26,800,'#FFFFFF'),makeText('Catálogo Digital · Sua empresa, seus produtos, sua identidade.',group.id,30,88,540,40,14,400,'#D9E2EC'),makeText('Contato     Privacidade     Sobre',group.id,690,62,320,35,14,600,'#FFFFFF')]
}

function insertTemplate(kind:LibraryKind,point:Point){
  const state=useEditorStore.getState()
  const doc=clone(state.history.present)
  const blocks=buildTemplate(kind,point.x,point.y)
  if(!blocks.length) return null
  const maxZ=Math.max(1,...doc.blocks.filter(b=>b.parentId===null).map(b=>Number(b.style[state.device]?.zIndex||1)))
  blocks[0].style[state.device]={...blocks[0].style[state.device],zIndex:maxZ+1}
  doc.blocks.push(...blocks)
  commitDocument(doc,`Adicionado: ${blocks[0].name}`,blocks[0].id)
  return blocks[0].id
}

function groupObjects(ids:string[],setSelection:(ids:string[])=>void){
  if(ids.length<2) return
  const state=useEditorStore.getState(),device=state.device,doc=clone(state.history.present)
  const items=ids.map(id=>doc.blocks.find(b=>b.id===id)).filter(Boolean) as BuilderBlock[]
  if(items.length<2) return
  const parent=items[0].parentId
  if(items.some(b=>b.parentId!==parent)) return
  const minX=Math.min(...items.map(b=>positionOf(b,device).x)),minY=Math.min(...items.map(b=>positionOf(b,device).y))
  const maxX=Math.max(...items.map(b=>positionOf(b,device).x+widthOf(b,device))),maxY=Math.max(...items.map(b=>positionOf(b,device).y+heightOf(b,device)))
  const group=makeGroup('Grupo',parent,minX,minY,maxX-minX,maxY-minY)
  items.forEach(item=>{
    const d=item.style[device]||{}
    item.parentId=group.id
    item.style[device]={...d,x:Number(d.x||0)-minX,y:Number(d.y||0)-minY}
  })
  doc.blocks.push(group)
  commitDocument(doc,'Objetos agrupados',group.id)
  setSelection([group.id])
}

function ungroupObject(id:string|null,setSelection:(ids:string[])=>void){
  if(!id) return
  const state=useEditorStore.getState(),device=state.device,doc=clone(state.history.present),group=doc.blocks.find(b=>b.id===id)
  if(!group||group.type!=='frame'||!group.props.editorRole) return
  const base=positionOf(group,device),children=doc.blocks.filter(b=>b.parentId===group.id)
  children.forEach(child=>{
    const d=child.style[device]||{}
    child.parentId=group.parentId
    child.style[device]={...d,x:base.x+Number(d.x||0),y:base.y+Number(d.y||0)}
  })
  doc.blocks=doc.blocks.filter(b=>b.id!==group.id)
  commitDocument(doc,'Grupo desfeito',children[0]?.id||null)
  setSelection(children.map(c=>c.id))
}

function moveDepth(id:string,mode:'front'|'back'|'top'|'bottom'){
  const state=useEditorStore.getState(),block=state.history.present.blocks.find(b=>b.id===id)
  if(!block) return
  const device=state.device,siblings=state.history.present.blocks.filter(b=>b.parentId===block.parentId&&b.id!==id)
  const levels=siblings.map(b=>Number(b.style[device]?.zIndex||1)),current=Number(block.style[device]?.zIndex||1)
  const min=levels.length?Math.min(...levels):1,max=levels.length?Math.max(...levels):1
  const z=mode==='top'?max+1:mode==='bottom'?Math.max(1,min-1):mode==='front'?current+1:Math.max(1,current-1)
  state.updateDeviceStyle(id,device,{zIndex:z},'Camada alterada')
}

function reorderLayers(dragId:string,targetId:string){
  if(dragId===targetId) return
  const state=useEditorStore.getState(),device=state.device,doc=clone(state.history.present)
  const drag=doc.blocks.find(b=>b.id===dragId),target=doc.blocks.find(b=>b.id===targetId)
  if(!drag||!target||drag.parentId!==target.parentId) return
  const siblings=doc.blocks.filter(b=>b.parentId===drag.parentId).sort((a,b)=>Number(b.style[device]?.zIndex||1)-Number(a.style[device]?.zIndex||1))
  const from=siblings.findIndex(b=>b.id===dragId),to=siblings.findIndex(b=>b.id===targetId)
  const [item]=siblings.splice(from,1);siblings.splice(to,0,item)
  siblings.forEach((b,index)=>{b.style[device]={...b.style[device],zIndex:siblings.length-index}})
  commitDocument(doc,'Ordem das camadas alterada',dragId)
}

function LibraryItem({item,onClick}:{item:LibraryDef;onClick:()=>void}){
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:`library:${item.kind}`,data:{kind:'library',libraryKind:item.kind}})
  return <button ref={setNodeRef} className="creative-library-item" style={{transform:CSS.Translate.toString(transform),opacity:isDragging?.45:1}} onClick={onClick} {...attributes} {...listeners}><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><GripVertical size={15}/></button>
}

function LayerRow({block,depth,selection,onSelect}:{block:BuilderBlock;depth:number;selection:string[];onSelect:(id:string)=>void}){
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device),toggleLocked=useEditorStore(s=>s.toggleLocked),toggleHidden=useEditorStore(s=>s.toggleHidden),updateBlock=useEditorStore(s=>s.updateBlock)
  const [expanded,setExpanded]=useState(true),[editing,setEditing]=useState(false),[name,setName]=useState(block.name)
  const children=doc.blocks.filter(b=>b.parentId===block.id).sort((a,b)=>Number(b.style[device]?.zIndex||1)-Number(a.style[device]?.zIndex||1))
  return <>
    <div className={`creative-layer-row ${selection.includes(block.id)?'selected':''}`} style={{paddingLeft:8+depth*14}} draggable onDragStart={e=>e.dataTransfer.setData('text/asteryon-layer',block.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();reorderLayers(e.dataTransfer.getData('text/asteryon-layer'),block.id)}} onClick={()=>onSelect(block.id)}>
      <button className="layer-expand" onClick={e=>{e.stopPropagation();setExpanded(v=>!v)}}>{children.length?(expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>):<span/>}</button><GripVertical size={13}/>
      {editing?<input autoFocus value={name} onClick={e=>e.stopPropagation()} onChange={e=>setName(e.target.value)} onBlur={()=>{setEditing(false);if(name.trim())updateBlock(block.id,{name:name.trim()},'Camada renomeada')}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){setEditing(false);setName(block.name)}}}/>:<span className="layer-name" onDoubleClick={e=>{e.stopPropagation();setEditing(true)}}>{block.name}</span>}
      <button onClick={e=>{e.stopPropagation();toggleLocked(block.id)}}>{block.locked?<Lock size={13}/>:<Unlock size={13}/>}</button><button onClick={e=>{e.stopPropagation();toggleHidden(block.id)}}>{block.hidden?<EyeOff size={13}/>:<Eye size={13}/>}</button>
    </div>
    {expanded?children.map(child=><LayerRow key={child.id} block={child} depth={depth+1} selection={selection} onSelect={onSelect}/>):null}
  </>
}

function MiniMap({document,device}:{document:EditorDocument;device:Device}){
  const config=document.canvas[device],sx=180/config.width,sy=105/config.height
  return <div className="creative-history-thumb" style={{background:document.canvas.background||'#fff'}}>{document.blocks.filter(b=>b.parentId===null).slice(0,18).map(b=>{const p=positionOf(b,device);return <span key={b.id} style={{left:p.x*sx,top:p.y*sy,width:Math.max(5,widthOf(b,device)*sx),height:Math.max(4,heightOf(b,device)*sy)}}/>})}</div>
}

function CreativeObject({block,selection,setSelection,editingText,setEditingText,onContextMenu}:{block:BuilderBlock;selection:string[];setSelection:(ids:string[])=>void;editingText:string|null;setEditingText:(id:string|null)=>void;onContextMenu:(e:React.MouseEvent,b:BuilderBlock)=>void}){
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device),selectStore=useEditorStore(s=>s.selectBlock),updateProps=useEditorStore(s=>s.updateBlockProps)
  const d=block.style[device]||{},selected=selection.includes(block.id),primary=selection[selection.length-1]===block.id
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:`object:${block.id}`,disabled:block.locked||editingText===block.id,data:{kind:'object',blockId:block.id}})
  if(block.hidden||block.hiddenOn[device]) return null
  const children=doc.blocks.filter(b=>b.parentId===block.id).sort((a,b)=>Number(a.style[device]?.zIndex||1)-Number(b.style[device]?.zIndex||1))
  const role=String(block.props.editorRole||''),isGroup=block.type==='frame'&&Boolean(role),isShape=role==='shape'
  const choose=(event:React.MouseEvent)=>{event.stopPropagation();const next=event.shiftKey?(selected?selection.filter(id=>id!==block.id):[...selection,block.id]):[block.id];setSelection(next);selectStore(next[next.length-1]||null)}
  const outer:React.CSSProperties={position:'absolute',left:Number(d.x||0),top:Number(d.y||0),width:d.width||'auto',height:d.height,minHeight:d.minHeight,zIndex:d.zIndex||1,transform:`translate3d(${transform?.x||0}px,${transform?.y||0}px,0)${d.rotate?` rotate(${d.rotate}deg)`:''}`,opacity:isDragging?.55:(block.style.opacity??100)/100}
  const visual:React.CSSProperties={width:'100%',height:'100%',minHeight:'inherit',boxSizing:'border-box',background:block.style.gradient||block.style.background,color:block.style.color,border:`${block.style.borderWidth||0}px solid ${block.style.borderColor||'transparent'}`,borderRadius:block.style.borderRadius,boxShadow:block.style.shadow==='global'?doc.designSystem.shadow:block.style.shadow,fontFamily:block.style.fontFamily||doc.designSystem.primaryFont,fontWeight:block.style.fontWeight,fontSize:d.fontSize,lineHeight:block.style.lineHeight,letterSpacing:block.style.letterSpacing,textAlign:d.textAlign}
  let content:React.ReactNode
  if(block.type==='text') content=<div className={`creative-inline-text ${editingText===block.id?'editing':''}`} style={visual} contentEditable={editingText===block.id} suppressContentEditableWarning onDoubleClick={e=>{e.stopPropagation();setSelection([block.id]);selectStore(block.id);setEditingText(block.id);requestAnimationFrame(()=>e.currentTarget.focus())}} onBlur={e=>{updateProps(block.id,{text:e.currentTarget.innerText},'Texto editado diretamente');setEditingText(null)}}>{String(block.props.text||'')}</div>
  else if(block.type==='button') content=<div className="creative-button-object" style={visual}>{String(block.props.label||'Botão')}</div>
  else if(block.type==='image') content=block.props.src?<img className="creative-image-object" src={String(block.props.src)} alt={String(block.props.alt||'')} style={{...visual,objectFit:String(block.props.fit||'cover') as React.CSSProperties['objectFit']}}/>:<div className="creative-image-placeholder" style={visual}><ImageIcon size={28}/><span>Imagem</span><small>Escolha um arquivo no painel</small></div>
  else if(isShape) content=<div style={visual}/>
  else if(isGroup) content=<div className="creative-group-stage" style={visual}>{children.map(child=><CreativeObject key={child.id} block={child} selection={selection} setSelection={setSelection} editingText={editingText} setEditingText={setEditingText} onContextMenu={onContextMenu}/>)}</div>
  else content=<BlockContent block={block} document={doc} device={device}/>
  const body=primary&&!block.locked&&editingText!==block.id?<VisualResizeHandles block={block} device={device}>{content}</VisualResizeHandles>:content
  return <div ref={setNodeRef} data-creative-object={block.id} className={`creative-object ${selected?'selected':''} ${primary?'primary':''} ${block.locked?'locked':''}`} style={outer} onClick={choose} onContextMenu={e=>onContextMenu(e,block)} {...attributes} {...listeners}>{body}</div>
}

export function CreativeCanvasWorkspace(){
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device),selectStore=useEditorStore(s=>s.selectBlock),updateDevice=useEditorStore(s=>s.updateDeviceStyle),duplicate=useEditorStore(s=>s.duplicateBlock),remove=useEditorStore(s=>s.deleteBlock),toggleLocked=useEditorStore(s=>s.toggleLocked),toggleHidden=useEditorStore(s=>s.toggleHidden),restoreSnapshot=useEditorStore(s=>s.restoreSnapshot),snapshots=useEditorStore(s=>s.snapshots)
  const [tab,setTab]=useState<LeftTab>('add'),[mode,setMode]=useState<Mode>('simple'),[query,setQuery]=useState(''),[zoom,setZoom]=useState(.72),[selection,setSelectionState]=useState<string[]>([]),[editingText,setEditingText]=useState<string|null>(null),[tool,setTool]=useState<LibraryKind|null>(null),[dragLibrary,setDragLibrary]=useState<LibraryKind|null>(null),[lastPointer,setLastPointer]=useState<Point>({x:80,y:80}),[guides,setGuides]=useState<{x?:number;y?:number}>({}),[context,setContext]=useState<{x:number;y:number;id:string}|null>(null),[stack,setStack]=useState<{x:number;y:number;ids:string[]}|null>(null)
  const stageRef=useRef<HTMLDivElement>(null)
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:4}}))
  const {setNodeRef:setDropRef,isOver}=useDroppable({id:'creative-canvas'})
  const config=doc.canvas[device]
  const roots=doc.blocks.filter(b=>b.parentId===null).sort((a,b)=>Number(a.style[device]?.zIndex||1)-Number(b.style[device]?.zIndex||1))
  const selectedId=selection[selection.length-1]||null,selectedBlock=selectedId?doc.blocks.find(b=>b.id===selectedId):null
  const filtered=useMemo(()=>LIBRARY.filter(i=>(mode==='advanced'||i.simple)&&`${i.label} ${i.description} ${i.group}`.toLowerCase().includes(query.toLowerCase())),[mode,query])
  const libraryGroups=useMemo(()=>filtered.reduce<Record<string,LibraryDef[]>>((acc,item)=>{(acc[item.group]||=[]).push(item);return acc},{}),[filtered])
  const setSelection=(ids:string[])=>{const next=Array.from(new Set(ids));setSelectionState(next);selectStore(next[next.length-1]||null)}

  const pointFromEvent=(event:{clientX:number;clientY:number})=>{const rect=stageRef.current?.getBoundingClientRect();if(!rect)return{x:0,y:0};return{x:Math.max(0,(event.clientX-rect.left)/zoom),y:Math.max(0,(event.clientY-rect.top)/zoom)}}
  const insert=(kind:LibraryKind,point?:Point)=>{
    if(kind==='text'&&!point){setTool('text');return}
    const p=point||{x:70+roots.length*18,y:70+roots.length*26},id=insertTemplate(kind,p)
    if(id){setSelection([id]);if(kind==='text'){setEditingText(id);setTimeout(()=>{(document.querySelector(`[data-creative-object="${id}"] .creative-inline-text`) as HTMLElement|null)?.focus()},50)}}
    setTool(null)
  }

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement
      if(target.closest('input,textarea,select,[contenteditable="true"]')) return
      const mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase()
      if(mod&&key==='d'){event.preventDefault();selection.forEach(id=>duplicate(id));return}
      if(mod&&key==='g'){event.preventDefault();event.shiftKey?ungroupObject(selectedId,setSelection):groupObjects(selection,setSelection);return}
      if(mod&&event.key===']'&&selectedId){event.preventDefault();moveDepth(selectedId,'front');return}
      if(mod&&event.key==='['&&selectedId){event.preventDefault();moveDepth(selectedId,'back');return}
      if((event.key==='Delete'||event.key==='Backspace')&&selection.length){event.preventDefault();selection.forEach(id=>remove(id));setSelection([]);return}
      if(event.key==='Escape'){setEditingText(null);setTool(null);setSelection([]);return}
      if(event.key==='Enter'&&selectedBlock?.type==='text'){event.preventDefault();setEditingText(selectedBlock.id);return}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selection.length){event.preventDefault();const amount=event.shiftKey?10:1;selection.forEach(id=>{const block=useEditorStore.getState().history.present.blocks.find(b=>b.id===id);if(!block||block.locked)return;const d=block.style[device]||{},dx=event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0,dy=event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0;updateDevice(id,device,{x:Number(d.x||0)+dx,y:Number(d.y||0)+dy},'Objeto movido pelo teclado')})}
    }
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
  },[selection,selectedId,selectedBlock,device])

  const dragStart=(event:DragStartEvent)=>{const data=event.active.data.current;if(data?.kind==='library')setDragLibrary(data.libraryKind as LibraryKind);setContext(null);setStack(null)}
  const dragMove=(event:DragMoveEvent)=>{
    const data=event.active.data.current;if(data?.kind!=='object')return
    const block=doc.blocks.find(b=>b.id===data.blockId);if(!block)return
    const d=block.style[device]||{},nx=Number(d.x||0)+event.delta.x/zoom,ny=Number(d.y||0)+event.delta.y/zoom,bw=widthOf(block,device),bh=heightOf(block,device),threshold=7
    let gx:number|undefined,gy:number|undefined
    for(const sibling of doc.blocks.filter(b=>b.parentId===block.parentId&&b.id!==block.id)){
      const p=positionOf(sibling,device),sw=widthOf(sibling,device),sh=heightOf(sibling,device)
      const sx=[p.x,p.x+sw/2,p.x+sw],sy=[p.y,p.y+sh/2,p.y+sh],mx=[nx,nx+bw/2,nx+bw],my=[ny,ny+bh/2,ny+bh]
      if(gx===undefined)gx=sx.find(v=>mx.some(m=>Math.abs(m-v)<threshold))
      if(gy===undefined)gy=sy.find(v=>my.some(m=>Math.abs(m-v)<threshold))
      if(gx!==undefined&&gy!==undefined)break
    }
    if(Math.abs(nx+bw/2-config.width/2)<threshold)gx=config.width/2
    setGuides({x:gx,y:gy})
  }
  const dragEnd=(event:DragEndEvent)=>{
    const data=event.active.data.current
    if(data?.kind==='library'&&event.over?.id==='creative-canvas')insert(data.libraryKind as LibraryKind,lastPointer)
    if(data?.kind==='object'){
      const id=String(data.blockId),block=useEditorStore.getState().history.present.blocks.find(b=>b.id===id)
      if(block&&!block.locked){const d=block.style[device]||{};updateDevice(id,device,{x:Math.max(0,Number(d.x||0)+event.delta.x/zoom),y:Math.max(0,Number(d.y||0)+event.delta.y/zoom)},'Objeto movido')}
    }
    setDragLibrary(null);setGuides({})
  }

  const canvasPointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(e.button!==0)return
    const p=pointFromEvent(e);setLastPointer(p);setContext(null)
    if(tool){e.preventDefault();insert(tool,p);return}
    if(e.target===e.currentTarget&&!e.shiftKey)setSelection([])
  }
  const overlapCapture=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(tool||e.button!==0)return
    const ids:string[]=[]
    document.elementsFromPoint(e.clientX,e.clientY).forEach(node=>{const element=(node as HTMLElement).closest?.('[data-creative-object]') as HTMLElement|null;const id=element?.dataset.creativeObject;if(id&&!ids.includes(id))ids.push(id)})
    if(ids.length>1){const p=pointFromEvent(e);setStack({x:p.x+8,y:p.y+8,ids:ids.slice(0,8)})}else setStack(null)
  }
  const openContext=(e:React.MouseEvent,b:BuilderBlock)=>{e.preventDefault();e.stopPropagation();setSelection([b.id]);setContext({x:e.clientX,y:e.clientY,id:b.id})}

  return <DndContext sensors={sensors} onDragStart={dragStart} onDragMove={dragMove} onDragEnd={dragEnd}>
    <div className="creative-workspace">
      <aside className="creative-left">
        <div className="creative-left-tabs"><button className={tab==='add'?'active':''} onClick={()=>setTab('add')}><Plus size={18}/></button><button className={tab==='layers'?'active':''} onClick={()=>setTab('layers')}><Layers3 size={18}/></button><button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><FileClock size={18}/></button></div>
        {tab==='add'?<div className="creative-left-body"><div className="creative-mode-switch"><button className={mode==='simple'?'active':''} onClick={()=>setMode('simple')}>Iniciante</button><button className={mode==='advanced'?'active':''} onClick={()=>setMode('advanced')}>Avançado</button></div><div className="creative-panel-title"><strong>Adicionar</strong><small>{mode==='simple'?'Só o essencial para começar.':'Todos os objetos disponíveis.'}</small></div><label className="creative-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar..."/></label>{Object.entries(libraryGroups).map(([group,items])=><section className="creative-library-group" key={group}><h4>{group}</h4>{items.map(item=><LibraryItem key={item.kind} item={item} onClick={()=>insert(item.kind)}/>)}</section>)}</div>:null}
        {tab==='layers'?<div className="creative-left-body"><div className="creative-panel-title"><strong>Camadas</strong><small>Arraste para ordenar. Duplo clique para renomear.</small></div><div className="creative-layer-toolbar"><button disabled={selection.length<2} onClick={()=>groupObjects(selection,setSelection)}><Group size={15}/>Agrupar</button><button disabled={!selectedId} onClick={()=>ungroupObject(selectedId,setSelection)}><Ungroup size={15}/>Desagrupar</button></div><div className="creative-layer-tree">{[...roots].sort((a,b)=>Number(b.style[device]?.zIndex||1)-Number(a.style[device]?.zIndex||1)).map(block=><LayerRow key={block.id} block={block} depth={0} selection={selection} onSelect={id=>setSelection([id])}/>)}</div></div>:null}
        {tab==='history'?<div className="creative-left-body"><div className="creative-panel-title"><strong>Histórico visual</strong><small>Volte para um estado anterior.</small></div><article className="creative-history-card current"><MiniMap document={doc} device={device}/><div><strong>Versão atual</strong><small>Agora</small></div></article>{snapshots.slice(0,12).map(snapshot=><article className="creative-history-card" key={snapshot.id}><MiniMap document={snapshot.document} device={device}/><div><strong>{snapshot.label}</strong><small>{new Date(snapshot.at).toLocaleString('pt-BR')}</small></div><button onClick={()=>{restoreSnapshot(snapshot.id);setSelection([])}}>Restaurar</button></article>)}</div>:null}
      </aside>

      <main className="creative-center">
        <div className="creative-canvas-toolbar"><div><MousePointer2 size={15}/><span>{tool==='text'?'Clique na página para começar a digitar':'Selecionar e mover'}</span></div><div className="creative-shortcuts"><span>Ctrl+D Duplicar</span><span>Ctrl+G Agrupar</span><span>Ctrl+[ ] Camadas</span></div><div><button onClick={()=>setZoom(v=>Math.max(.25,v-.1))}><ZoomOut size={15}/></button><strong>{Math.round(zoom*100)}%</strong><button onClick={()=>setZoom(v=>Math.min(1.6,v+.1))}><ZoomIn size={15}/></button><button onClick={()=>setZoom(1)}>100%</button></div></div>
        <div className="creative-viewport">
          <div className="creative-device-shell" style={{width:config.width,height:config.height,transform:`scale(${zoom})`,transformOrigin:'top center'}}>
            <PortalSurface document={doc} device={device}>
              <div ref={node=>{stageRef.current=node;setDropRef(node)}} data-asteryon-hostinger-canvas data-creative-canvas className={`creative-stage ${doc.canvas.showGrid?'show-grid':''} ${isOver?'drag-over':''}`} style={{width:config.width,height:config.height,background:doc.canvas.gradient||doc.canvas.background,backgroundImage:doc.canvas.backgroundImage?`url(${doc.canvas.backgroundImage})`:doc.canvas.gradient||undefined,backgroundSize:doc.canvas.backgroundSize,backgroundPosition:doc.canvas.backgroundPosition}} onPointerDownCapture={overlapCapture} onPointerDown={canvasPointerDown} onPointerMove={e=>setLastPointer(pointFromEvent(e))} onDoubleClick={e=>{if(e.target===e.currentTarget)insert('text',pointFromEvent(e))}}>
                {!roots.length?<div className="creative-empty"><div><Plus size={28}/></div><strong>Página em branco</strong><span>Adicione Texto, Imagem, Produto ou Botão.</span><small>Duplo clique no vazio cria um texto.</small></div>:null}
                {roots.map(block=><CreativeObject key={block.id} block={block} selection={selection} setSelection={setSelection} editingText={editingText} setEditingText={setEditingText} onContextMenu={openContext}/>) }
                {guides.x!==undefined?<span className="creative-guide vertical" style={{left:guides.x}}/>:null}{guides.y!==undefined?<span className="creative-guide horizontal" style={{top:guides.y}}/>:null}
                {stack?<div className="creative-stack-picker" style={{left:stack.x,top:stack.y}}><small>Objetos nesta área</small>{stack.ids.map(id=>{const block=doc.blocks.find(b=>b.id===id);return block?<button key={id} onClick={e=>{e.stopPropagation();setSelection([id]);setStack(null)}}>{block.name}</button>:null})}</div>:null}
              </div>
            </PortalSurface>
          </div>
        </div>
      </main>

      <CreativePropertiesPanel selectedId={selectedId}/>
    </div>

    {context&&selectedBlock?<div className="creative-context" style={{left:context.x,top:context.y}} onMouseLeave={()=>setContext(null)}><button onClick={()=>{if(selectedBlock.type==='text')setEditingText(selectedBlock.id);setContext(null)}}><Type size={15}/>Editar</button><button onClick={()=>{duplicate(selectedBlock.id);setContext(null)}}><Copy size={15}/>Duplicar <kbd>Ctrl+D</kbd></button><button onClick={()=>{moveDepth(selectedBlock.id,'top');setContext(null)}}><BringToFront size={15}/>Trazer para o topo</button><button onClick={()=>{moveDepth(selectedBlock.id,'bottom');setContext(null)}}><SendToBack size={15}/>Enviar para o fundo</button><button disabled={selection.length<2} onClick={()=>{groupObjects(selection,setSelection);setContext(null)}}><Group size={15}/>Agrupar</button><button onClick={()=>{toggleLocked(selectedBlock.id);setContext(null)}}>{selectedBlock.locked?<Unlock size={15}/>:<Lock size={15}/>} {selectedBlock.locked?'Desbloquear':'Bloquear'}</button><button onClick={()=>{toggleHidden(selectedBlock.id);setContext(null)}}>{selectedBlock.hidden?<Eye size={15}/>:<EyeOff size={15}/>} {selectedBlock.hidden?'Mostrar':'Ocultar'}</button><button className="danger" onClick={()=>{remove(selectedBlock.id);setSelection([]);setContext(null)}}><Trash2 size={15}/>Excluir</button></div>:null}
    <DragOverlay>{dragLibrary?<div className="creative-drag-overlay"><BoxSelect size={18}/><strong>{LIBRARY.find(i=>i.kind===dragLibrary)?.label||'Objeto'}</strong></div>:null}</DragOverlay>
  </DndContext>
}
