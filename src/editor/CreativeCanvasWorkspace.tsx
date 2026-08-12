import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  AlignCenter, Box, BringToFront, ChevronDown, ChevronRight, Circle, Copy, Eye, EyeOff, FileClock, GripVertical,
  Group, Image as ImageIcon, Layers3, Lock, Monitor, MousePointer2, Plus, Redo2, Search, SendToBack, Square,
  Type, Ungroup, Unlock, Video, ZoomIn, ZoomOut, Trash2, BoxSelect, LayoutTemplate, Package, Columns3, Code2,
} from 'lucide-react'
import { getCatalogProducts } from '../catalog/data'
import { BlockContent, PortalSurface } from './BlockRenderer'
import { clone, makeBlock, uid } from './defaults'
import { CreativePropertiesPanel } from './CreativePropertiesPanel'
import { useEditorStore } from './store'
import type { BlockType, BuilderBlock, Device, EditorDocument } from './types'
import { VisualResizeHandles } from './VisualResizeHandles'
import './creative-editor.css'

type LibraryKind='text'|'image'|'button'|'video'|'shape'|'section'|'header'|'footer'|'product-atomic'|'showcase-atomic'|'category-atomic'|'html'
type LeftTab='add'|'layers'|'history'
type EditorMode='simple'|'advanced'
type Point={x:number;y:number}
type Rect={x:number;y:number;width:number;height:number}

type LibraryItemDef={kind:LibraryKind;label:string;description:string;group:'Básico'|'Layout'|'Catálogo'|'Avançado';icon:React.ReactNode;simple?:boolean}

const LIBRARY:LibraryItemDef[]=[
  {kind:'text',label:'Texto',description:'Clique na página e comece a digitar.',group:'Básico',icon:<Type size={18}/>,simple:true},
  {kind:'image',label:'Imagem',description:'Imagem livre e redimensionável.',group:'Básico',icon:<ImageIcon size={18}/>,simple:true},
  {kind:'button',label:'Botão',description:'Botão com texto e link.',group:'Básico',icon:<Square size={18}/>,simple:true},
  {kind:'video',label:'Vídeo',description:'Vídeo livre no canvas.',group:'Básico',icon:<Video size={18}/>,simple:true},
  {kind:'shape',label:'Forma',description:'Retângulo para fundos e composições.',group:'Básico',icon:<Circle size={18}/>,simple:true},
  {kind:'section',label:'Seção',description:'Agrupador opcional para organizar objetos.',group:'Layout',icon:<Box size={18}/>},
  {kind:'header',label:'Cabeçalho',description:'Modelo desmontável feito de objetos comuns.',group:'Layout',icon:<LayoutTemplate size={18}/>},
  {kind:'footer',label:'Rodapé',description:'Modelo desmontável e totalmente editável.',group:'Layout',icon:<Columns3 size={18}/>},
  {kind:'product-atomic',label:'Produto',description:'Produto criado como objetos independentes.',group:'Catálogo',icon:<Package size={18}/>,simple:true},
  {kind:'showcase-atomic',label:'Vitrine',description:'Vitrine desmontável com produtos atômicos.',group:'Catálogo',icon:<Columns3 size={18}/>},
  {kind:'category-atomic',label:'Categoria',description:'Navegação de categoria como composição livre.',group:'Catálogo',icon:<Layers3 size={18}/>},
  {kind:'html',label:'HTML',description:'Bloco avançado isolado.',group:'Avançado',icon:<Code2 size={18}/>},
]

const px=(value?:string)=>Number.parseFloat(String(value||'0'))||0
const h=(b:BuilderBlock,d:Device)=>Number(b.style[d]?.height||b.style[d]?.minHeight||40)
const w=(b:BuilderBlock,d:Device)=>px(b.style[d]?.width)||160
const pos=(b:BuilderBlock,d:Device)=>({x:Number(b.style[d]?.x||0),y:Number(b.style[d]?.y||0)})

function commitDocument(next:EditorDocument,label:string,selectedId?:string|null){
  const state=useEditorStore.getState(),current=state.history.present
  next.updatedAt=new Date().toISOString();next.status='draft'
  useEditorStore.setState({
    history:{past:[...state.history.past,clone(current)].slice(-100),present:next,future:[]},
    sandboxes:state.sandboxes.map(s=>s.id===state.activeSandboxId?{...s,document:clone(next)}:s),
    selectedBlockId:selectedId===undefined?state.selectedBlockId:selectedId,
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

function textBlock(text:string,parentId:string|null,x:number,y:number,width=260,height=48,fontSize=20,weight=400,color='#172230'){
  const b=setBox(makeBlock('text'),parentId,x,y,width,height,4)
  b.props={text,tag:'p'};b.style.fontWeight=weight;b.style.color=color
  b.style.desktop.fontSize=fontSize;b.style.tablet.fontSize=fontSize;b.style.mobile.fontSize=Math.max(12,Math.min(fontSize,32))
  return b
}
function imageBlock(src:string,parentId:string|null,x:number,y:number,width:number,height:number){const b=setBox(makeBlock('image'),parentId,x,y,width,height,2);b.props={src,alt:'Imagem',fit:'cover'};b.style.borderRadius=12;return b}
function buttonBlock(label:string,parentId:string|null,x:number,y:number,width=170,height=46){const b=setBox(makeBlock('button'),parentId,x,y,width,height,5);b.props={label,link:'#',target:'_self'};b.style.background='#0B5D3B';b.style.color='#FFFFFF';b.style.borderRadius=10;b.style.fontWeight=600;b.style.desktop.fontSize=14;b.style.tablet.fontSize=14;b.style.mobile.fontSize=14;return b}
function shapeBlock(parentId:string|null,x:number,y:number,width:number,height:number,color='#FFFFFF'){const b=setBox(makeBlock('card'),parentId,x,y,width,height,1);b.name='Forma';b.props={editorRole:'shape',showDefaultContent:false};b.style.background=color;b.style.borderRadius=18;b.style.borderWidth=0;return b}
function groupBlock(name:string,parentId:string|null,x:number,y:number,width:number,height:number,role='group'){const b=setBox(makeBlock('frame'),parentId,x,y,width,height,2);b.name=name;b.props={editorRole:role,showDefaultContent:false};b.style.background='transparent';b.style.borderWidth=0;b.style.borderRadius=0;return b}

function atomicProductBlocks(parentId:string|null,x:number,y:number,productIndex=0,z=2){
  const products=getCatalogProducts(),product=products[productIndex%Math.max(1,products.length)]
  const group=groupBlock(product?.name||'Produto',parentId,x,y,290,410,'atomic-product');group.style.desktop.zIndex=z;group.style.tablet.zIndex=z;group.style.mobile.zIndex=z
  const bg=shapeBlock(group.id,0,0,290,410,'#FFFFFF');bg.style.shadow='0 10px 28px rgba(15,23,42,.10)';bg.style.borderWidth=1;bg.style.borderColor='#E4E9EF'
  const img=imageBlock(product?.image||'',group.id,14,14,262,205)
  const brand=textBlock(product?.brand||'Marca',group.id,16,232,250,24,12,600,'#6B7280')
  const name=textBlock(product?.name||'Nome do produto',group.id,16,258,255,52,18,700,'#172230')
  const price=textBlock(product?.price?`R$ ${product.price}`:'Consulte',group.id,16,318,180,30,18,700,'#0B5D3B')
  const button=buttonBlock('Ver informações',group.id,16,355,165,40)
  ;[img,brand,name,price,button].forEach(b=>{b.props={...b.props,bindingProductCode:product?.code||'',bindingSource:'catalog'}})
  return [group,bg,img,brand,name,price,button]
}

function buildTemplate(kind:LibraryKind,x:number,y:number,parentId:string|null=null):BuilderBlock[]{
  if(kind==='text')return [setBox(textBlock('Digite seu texto',parentId,x,y,300,50,24,500),parentId,x,y,300,50,4)]
  if(kind==='image')return [imageBlock('',parentId,x,y,360,240)]
  if(kind==='button')return [buttonBlock('Clique aqui',parentId,x,y,170,46)]
  if(kind==='video'){const b=setBox(makeBlock('video'),parentId,x,y,520,300,2);b.props={url:'',autoplay:false,muted:true};return[b]}
  if(kind==='shape')return [shapeBlock(parentId,x,y,320,180,'#E9EEF4')]
  if(kind==='html'){const b=setBox(makeBlock('html'),parentId,x,y,520,240,2);return[b]}
  if(kind==='section'){const g=groupBlock('Seção',parentId,x,y,760,360,'group');g.style.background='rgba(255,255,255,.4)';g.style.borderWidth=1;g.style.borderColor='#CBD5E1';g.style.borderRadius=18;return[g]}
  if(kind==='product-atomic')return atomicProductBlocks(parentId,x,y,0)
  if(kind==='showcase-atomic'){
    const group=groupBlock('Vitrine',parentId,x,y,970,520,'atomic-showcase')
    const title=textBlock('Produtos em destaque',group.id,0,0,500,52,30,700)
    const a=atomicProductBlocks(group.id,0,76,0,2),b=atomicProductBlocks(group.id,330,76,1,3),c=atomicProductBlocks(group.id,660,76,2,4)
    return [group,title,...a,...b,...c]
  }
  if(kind==='category-atomic'){
    const group=groupBlock('Categorias',parentId,x,y,720,210,'group')
    const title=textBlock('Categorias',group.id,0,0,300,44,28,700)
    const products=getCatalogProducts(),categories=Array.from(new Set(products.map(p=>p.category).filter(Boolean))).slice(0,3)
    const cards=categories.flatMap((cat,i)=>{const s=shapeBlock(group.id,i*230,65,210,120,'#FFFFFF');s.style.borderWidth=1;s.style.borderColor='#E2E8F0';const t=textBlock(cat,group.id,i*230+16,105,175,38,18,600);return[s,t]})
    return[group,title,...cards]
  }
  if(kind==='header'){
    const group=groupBlock('Cabeçalho',parentId,x,y,1050,96,'group');group.style.background='#FFFFFF';group.style.shadow='0 4px 18px rgba(15,23,42,.08)'
    const brand=textBlock('ASTERYON',group.id,24,27,180,40,24,800,'#0B5D3B')
    const search=shapeBlock(group.id,270,22,430,52,'#F7F9FB');search.name='Fundo da pesquisa';search.style.borderRadius=12;search.style.borderWidth=1;search.style.borderColor='#DCE4EC'
    const placeholder=textBlock('Buscar produtos...',group.id,310,35,270,28,14,400,'#7B8794')
    const nav=textBlock('Catálogo     Promoções     Marcas',group.id,755,35,270,28,14,600,'#253244')
    return[group,brand,search,placeholder,nav]
  }
  if(kind==='footer'){
    const group=groupBlock('Rodapé',parentId,x,y,1050,180,'group');group.style.background='#081527';group.style.borderRadius=18
    const brand=textBlock('ASTERYON',group.id,30,34,220,44,26,800,'#FFFFFF')
    const info=textBlock('Catálogo Digital · Sua empresa, seus produtos, sua identidade.',group.id,30,88,540,40,14,400,'#D9E2EC')
    const links=textBlock('Contato     Privacidade     Sobre',group.id,690,62,320,35,14,600,'#FFFFFF')
    return[group,brand,info,links]
  }
  return[]
}

function addTemplate(kind:LibraryKind,x:number,y:number){
  const state=useEditorStore.getState(),doc=clone(state.history.present),blocks=buildTemplate(kind,x,y,null)
  if(!blocks.length)return null
  const maxZ=Math.max(1,...doc.blocks.filter(b=>b.parentId===null).map(b=>Number(b.style[state.device]?.zIndex||1)))
  const root=blocks[0];root.style[state.device]={...root.style[state.device],zIndex:maxZ+1}
  doc.blocks.push(...blocks)
  commitDocument(doc,`Adicionado: ${root.name}`,root.id)
  return root.id
}

function groupSelected(ids:string[],setIds:(v:string[])=>void){
  if(ids.length<2)return
  const state=useEditorStore.getState(),device=state.device,doc=clone(state.history.present),items=ids.map(id=>doc.blocks.find(b=>b.id===id)).filter(Boolean) as BuilderBlock[]
  if(items.length<2)return
  const parent=items[0].parentId;if(items.some(b=>b.parentId!==parent))return
  const minX=Math.min(...items.map(b=>pos(b,device).x)),minY=Math.min(...items.map(b=>pos(b,device).y))
  const maxX=Math.max(...items.map(b=>pos(b,device).x+w(b,device))),maxY=Math.max(...items.map(b=>pos(b,device).y+h(b,device)))
  const g=groupBlock('Grupo',parent,minX,minY,Math.max(40,maxX-minX),Math.max(40,maxY-minY),'group')
  const maxZ=Math.max(...items.map(b=>Number(b.style[device]?.zIndex||1)));g.style[device]={...g.style[device],zIndex:maxZ}
  items.forEach(item=>{const d=item.style[device]||{};item.parentId=g.id;item.style[device]={...d,x:Number(d.x||0)-minX,y:Number(d.y||0)-minY}})
  doc.blocks.push(g);commitDocument(doc,'Objetos agrupados',g.id);setIds([g.id])
}

function ungroupSelected(id:string|null,setIds:(v:string[])=>void){
  if(!id)return
  const state=useEditorStore.getState(),device=state.device,doc=clone(state.history.present),group=doc.blocks.find(b=>b.id===id)
  if(!group||group.type!=='frame'||!group.props.editorRole)return
  const base=pos(group,device),children=doc.blocks.filter(b=>b.parentId===group.id)
  children.forEach(child=>{const d=child.style[device]||{};child.parentId=group.parentId;child.style[device]={...d,x:base.x+Number(d.x||0),y:base.y+Number(d.y||0),zIndex:Number(group.style[device]?.zIndex||1)+Number(d.zIndex||1)}})
  doc.blocks=doc.blocks.filter(b=>b.id!==group.id);commitDocument(doc,'Grupo desfeito',children[0]?.id||null);setIds(children.map(c=>c.id))
}

function moveDepth(id:string,mode:'front'|'back'|'top'|'bottom'){
  const state=useEditorStore.getState(),block=state.history.present.blocks.find(b=>b.id===id);if(!block)return
  const device=state.device,siblings=state.history.present.blocks.filter(b=>b.parentId===block.parentId&&b.id!==id),levels=siblings.map(b=>Number(b.style[device]?.zIndex||1)),current=Number(block.style[device]?.zIndex||1),min=levels.length?Math.min(...levels):1,max=levels.length?Math.max(...levels):1
  const z=mode==='top'?max+1:mode==='bottom'?Math.max(1,min-1):mode==='front'?current+1:Math.max(1,current-1)
  state.updateDeviceStyle(id,device,{zIndex:z},mode==='top'?'Trazido para o topo':mode==='bottom'?'Enviado para o fundo':mode==='front'?'Trazido para frente':'Enviado para trás')
}

function reorderLayers(dragId:string,targetId:string){
  if(dragId===targetId)return
  const state=useEditorStore.getState(),device=state.device,doc=clone(state.history.present),drag=doc.blocks.find(b=>b.id===dragId),target=doc.blocks.find(b=>b.id===targetId)
  if(!drag||!target||drag.parentId!==target.parentId)return
  const siblings=doc.blocks.filter(b=>b.parentId===drag.parentId).sort((a,b)=>Number(b.style[device]?.zIndex||1)-Number(a.style[device]?.zIndex||1))
  const from=siblings.findIndex(b=>b.id===dragId),to=siblings.findIndex(b=>b.id===targetId);if(from<0||to<0)return
  const [item]=siblings.splice(from,1);siblings.splice(to,0,item)
  siblings.forEach((b,index)=>{b.style[device]={...b.style[device],zIndex:siblings.length-index}})
  commitDocument(doc,'Ordem das camadas alterada',dragId)
}

function MiniMap({document,device}:{document:EditorDocument;device:Device}){
  const config=document.canvas[device],roots=document.blocks.filter(b=>b.parentId===null).slice(0,18),sx=180/config.width,sy=105/config.height
  return <div className="creative-history-thumb" style={{background:document.canvas.background||'#fff'}}>{roots.map(b=>{const p=pos(b,device);return <span key={b.id} style={{left:p.x*sx,top:p.y*sy,width:Math.max(5,w(b,device)*sx),height:Math.max(4,h(b,device)*sy),opacity:(b.style.opacity??100)/100}}/>})}</div>
}

function LibraryItem({item,onClick}:{item:LibraryItemDef;onClick:()=>void}){
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:`creative-library:${item.kind}`,data:{kind:'library',libraryKind:item.kind,label:item.label}})
  return <button ref={setNodeRef} className="creative-library-item" style={{transform:CSS.Translate.toString(transform),opacity:isDragging?.45:1}} onClick={onClick} {...attributes} {...listeners}><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><GripVertical size={15}/></button>
}

function LayerRow({block,depth,selected,onSelect,onRename}:{block:BuilderBlock;depth:number;selected:boolean;onSelect:(id:string)=>void;onRename:(id:string,name:string)=>void}){
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device),toggleLocked=useEditorStore(s=>s.toggleLocked),toggleHidden=useEditorStore(s=>s.toggleHidden)
  const [expanded,setExpanded]=useState(true),[editing,setEditing]=useState(false),[name,setName]=useState(block.name)
  const children=doc.blocks.filter(b=>b.parentId===block.id).sort((a,b)=>Number(b.style[device]?.zIndex||1)-Number(a.style[device]?.zIndex||1))
  return <><div className={`creative-layer-row ${selected?'selected':''}`} draggable onDragStart={e=>e.dataTransfer.setData('text/asteryon-layer',block.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/asteryon-layer');if(id)reorderLayers(id,block.id)}} style={{paddingLeft:8+depth*14}} onClick={()=>onSelect(block.id)}>
    <button className="layer-expand" onClick={e=>{e.stopPropagation();setExpanded(v=>!v)}}>{children.length?(expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>):<span/>}</button><GripVertical size={13}/>
    {editing?<input autoFocus value={name} onClick={e=>e.stopPropagation()} onChange={e=>setName(e.target.value)} onBlur={()=>{setEditing(false);if(name.trim())onRename(block.id,name.trim())}} onKeyDown={e=>{if(e.key==='Enter'){(e.currentTarget as HTMLInputElement).blur()}if(e.key==='Escape'){setName(block.name);setEditing(false)}}}/>:<span className="layer-name" onDoubleClick={e=>{e.stopPropagation();setEditing(true);setName(block.name)}}>{block.name}</span>}
    <button onClick={e=>{e.stopPropagation();toggleLocked(block.id)}}>{block.locked?<Lock size={13}/>:<Unlock size={13}/>}</button><button onClick={e=>{e.stopPropagation();toggleHidden(block.id)}}>{block.hidden?<EyeOff size={13}/>:<Eye size={13}/>}</button>
  </div>{expanded?children.map(child=><LayerRow key={child.id} block={child} depth={depth+1} selected={selected&&child.id===block.id} onSelect={onSelect} onRename={onRename}/>):null}</>
}

function CreativeObject({block,selectedIds,setSelectedIds,editingTextId,setEditingTextId,onContextMenu}:{block:BuilderBlock;selectedIds:string[];setSelectedIds:(ids:string[])=>void;editingTextId:string|null;setEditingTextId:(id:string|null)=>void;onContextMenu:(e:React.MouseEvent,b:BuilderBlock)=>void}){
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device),selectStore=useEditorStore(s=>s.selectBlock),updateProps=useEditorStore(s=>s.updateBlockProps)
  const d=block.style[device]||{},selected=selectedIds.includes(block.id),primary=selectedIds[selectedIds.length-1]===block.id
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:`creative-object:${block.id}`,disabled:block.locked||editingTextId===block.id,data:{kind:'object',blockId:block.id}})
  if(block.hidden||block.hiddenOn[device])return null
  const children=doc.blocks.filter(b=>b.parentId===block.id).sort((a,b)=>Number(a.style[device]?.zIndex||1)-Number(b.style[device]?.zIndex||1))
  const groupRole=String(block.props.editorRole||'')
  const isGroup=block.type==='frame'&&Boolean(groupRole)
  const isShape=groupRole==='shape'
  const choose=(event:React.MouseEvent)=>{event.stopPropagation();const next=event.shiftKey?(selected?selectedIds.filter(id=>id!==block.id):[...selectedIds,block.id]):[block.id];setSelectedIds(next);selectStore(next[next.length-1]||null)}
  const baseStyle:React.CSSProperties={position:'absolute',left:Number(d.x||0),top:Number(d.y||0),width:d.width||'auto',height:d.height,minHeight:d.minHeight,zIndex:d.zIndex||1,transform:`translate3d(${transform?.x||0}px,${transform?.y||0}px,0)${d.rotate?` rotate(${d.rotate}deg)`:''}`,opacity:isDragging?.55:(block.style.opacity??100)/100}
  const visualStyle:React.CSSProperties={width:'100%',height:'100%',minHeight:'inherit',background:block.style.gradient||block.style.background,color:block.style.color,border:`${block.style.borderWidth||0}px solid ${block.style.borderColor||'transparent'}`,borderRadius:block.style.borderRadius,boxShadow:block.style.shadow==='global'?doc.designSystem.shadow:block.style.shadow,fontFamily:block.style.fontFamily||doc.designSystem.primaryFont,fontWeight:block.style.fontWeight,fontSize:d.fontSize,lineHeight:block.style.lineHeight,letterSpacing:block.style.letterSpacing,textAlign:d.textAlign}
  let content:React.ReactNode
  if(block.type==='text')content=<div className={`creative-inline-text ${editingTextId===block.id?'editing':''}`} style={visualStyle} contentEditable={editingTextId===block.id} suppressContentEditableWarning onDoubleClick={e=>{e.stopPropagation();setEditingTextId(block.id);selectStore(block.id);setSelectedIds([block.id]);requestAnimationFrame(()=>{const el=e.currentTarget;el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=window.getSelection();s?.removeAllRanges();s?.addRange(r)})}} onBlur={e=>{updateProps(block.id,{text:e.currentTarget.innerText},'Texto editado diretamente');setEditingTextId(null)}}>{String(block.props.text||'')}</div>
  else if(block.type==='button')content=<div className="creative-button-object" style={visualStyle}>{String(block.props.label||'Botão')}</div>
  else if(block.type==='image')content=block.props.src?<img className="creative-image-object" src={String(block.props.src)} alt={String(block.props.alt||'')} style={{...visualStyle,objectFit:String(block.props.fit||'cover') as React.CSSProperties['objectFit']}}/>:<div className="creative-image-placeholder" style={visualStyle}><ImageIcon size={28}/><span>Imagem</span><small>Selecione e escolha um arquivo</small></div>
  else if(isShape)content=<div style={visualStyle}/>
  else if(isGroup)content=<div className="creative-group-stage" style={visualStyle}>{children.map(child=><CreativeObject key={child.id} block={child} selectedIds={selectedIds} setSelectedIds={setSelectedIds} editingTextId={editingTextId} setEditingTextId={setEditingTextId} onContextMenu={onContextMenu}/>)}</div>
  else content=<BlockContent block={block} document={doc} device={device}/>
  const wrapped=primary&&!block.locked&&editingTextId!==block.id?<VisualResizeHandles block={block} device={device}>{content}</VisualResizeHandles>:content
  return <div ref={setNodeRef} data-creative-object={block.id} className={`creative-object ${selected?'selected':''} ${primary?'primary':''} ${block.locked?'locked':''}`} style={baseStyle} onClick={choose} onDoubleClick={e=>{if(block.type==='text')return;e.stopPropagation();choose(e)}} onContextMenu={e=>onContextMenu(e,block)} {...attributes} {...listeners}>{wrapped}{selected&&!primary?<span className="creative-secondary-outline"/>:null}</div>
}

export function CreativeCanvasWorkspace(){
  const doc=useEditorStore(s=>s.history.present),device=useEditorStore(s=>s.device),selectStore=useEditorStore(s=>s.selectBlock),updateD=useEditorStore(s=>s.updateDeviceStyle),duplicate=useEditorStore(s=>s.duplicateBlock),remove=useEditorStore(s=>s.deleteBlock),toggleLocked=useEditorStore(s=>s.toggleLocked),toggleHidden=useEditorStore(s=>s.toggleHidden),restoreSnapshot=useEditorStore(s=>s.restoreSnapshot),updateBlock=useEditorStore(s=>s.updateBlock)
  const [leftTab,setLeftTab]=useState<LeftTab>('add'),[mode,setMode]=useState<EditorMode>('simple'),[query,setQuery]=useState(''),[zoom,setZoom]=useState(.72),[selectedIds,setSelectedIdsState]=useState<string[]>([]),[editingTextId,setEditingTextId]=useState<string|null>(null),[pendingTool,setPendingTool]=useState<LibraryKind|null>(null),[activeLibrary,setActiveLibrary]=useState<LibraryKind|null>(null),[context,setContext]=useState<{x:number;y:number;id:string}|null>(null),[stackPicker,setStackPicker]=useState<{x:number;y:number;ids:string[]}|null>(null),[guides,setGuides]=useState<{x?:number;y?:number}>({}),[marquee,setMarquee]=useState<{start:Point;current:Point}|null>(null),[lastPointer,setLastPointer]=useState<Point>({x:80,y:80})
  const stageRef=useRef<HTMLDivElement>(null)
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:4}}))
  const {setNodeRef:setDropRef,isOver}=useDroppable({id:'creative-canvas',data:{kind:'canvas'}})
  const selectedId=selectedIds[selectedIds.length-1]||null
  const selectedBlock=selectedId?doc.blocks.find(b=>b.id===selectedId):null
  const config=doc.canvas[device]
  const roots=doc.blocks.filter(b=>b.parentId===null).sort((a,b)=>Number(a.style[device]?.zIndex||1)-Number(b.style[device]?.zIndex||1))
  const visibleLibrary=useMemo(()=>LIBRARY.filter(i=>(mode==='advanced'||i.simple)&&`${i.label} ${i.description} ${i.group}`.toLowerCase().includes(query.toLowerCase())),[mode,query])
  const groups=useMemo(()=>visibleLibrary.reduce<Record<string,LibraryItemDef[]>>((acc,item)=>{(acc[item.group]||=[]).push(item);return acc},{}),[visibleLibrary])
  const setSelectedIds=(ids:string[])=>{const unique=Array.from(new Set(ids));setSelectedIdsState(unique);selectStore(unique[unique.length-1]||null)}

  useEffect(()=>{if(selectedId&&!doc.blocks.some(b=>b.id===selectedId))setSelectedIds([])},[doc.blocks.length])

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable="true"]'))return
      const mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase()
      if(mod&&key==='d'){event.preventDefault();selectedIds.forEach(id=>duplicate(id));return}
      if(mod&&key==='g'){event.preventDefault();if(event.shiftKey)ungroupSelected(selectedId,setSelectedIds);else groupSelected(selectedIds,setSelectedIds);return}
      if(mod&&event.key===']'&&selectedId){event.preventDefault();moveDepth(selectedId,'front');return}
      if(mod&&event.key==='['&&selectedId){event.preventDefault();moveDepth(selectedId,'back');return}
      if((event.key==='Delete'||event.key==='Backspace')&&selectedIds.length){event.preventDefault();selectedIds.forEach(id=>remove(id));setSelectedIds([]);return}
      if(event.key==='Escape'){setEditingTextId(null);setPendingTool(null);setSelectedIds([]);return}
      if(event.key==='Enter'&&selectedBlock?.type==='text'){event.preventDefault();setEditingTextId(selectedBlock.id);return}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selectedIds.length){event.preventDefault();const amount=event.shiftKey?10:1;selectedIds.forEach(id=>{const b=useEditorStore.getState().history.present.blocks.find(x=>x.id===id);if(!b||b.locked)return;const d=b.style[device]||{},dx=event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0,dy=event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0;updateD(id,device,{x:Number(d.x||0)+dx,y:Number(d.y||0)+dy},'Objeto movido pelo teclado')})}
    }
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
  },[selectedIds,selectedId,selectedBlock,device])

  const canvasPoint=(event:{clientX:number;clientY:number})=>{const rect=stageRef.current?.getBoundingClientRect();if(!rect)return{x:0,y:0};return{x:Math.max(0,(event.clientX-rect.left)/zoom),y:Math.max(0,(event.clientY-rect.top)/zoom)}}
  const insert=(kind:LibraryKind,p?:Point)=>{if(kind==='text'&&!p){setPendingTool('text');return}const point=p||{x:Math.max(24,Math.min(config.width-380,80+roots.length*18)),y:Math.max(24,80+roots.length*28)},id=addTemplate(kind,point.x,point.y);if(id){setSelectedIds([id]);if(kind==='text'){setEditingTextId(id);setTimeout(()=>{const el=document.querySelector(`[data-creative-object="${id}"] .creative-inline-text`) as HTMLElement|null;el?.focus()},40)}}setPendingTool(null)}

  const onDragStart=(event:DragStartEvent)=>{const data=event.active.data.current;if(data?.kind==='library')setActiveLibrary(data.libraryKind as LibraryKind);setContext(null);setStackPicker(null)}
  const onDragMove=(event:DragMoveEvent)=>{
    const data=event.active.data.current;if(data?.kind!=='object')return
    const b=doc.blocks.find(x=>x.id===data.blockId);if(!b)return
    const d=b.style[device]||{},nx=Number(d.x||0)+event.delta.x/zoom,ny=Number(d.y||0)+event.delta.y/zoom,bw=w(b,device),bh=h(b,device)
    const siblings=doc.blocks.filter(x=>x.parentId===b.parentId&&x.id!==b.id),threshold=7
    let gx: number|undefined,gy:number|undefined
    for(const s of siblings){const sp=pos(s,device),sw=w(s,device),sh=h(s,device);const xs=[sp.x,sp.x+sw/2,sp.x+sw],ys=[sp.y,sp.y+sh/2,sp.y+sh],mineX=[nx,nx+bw/2,nx+bw],mineY=[ny,ny+bh/2,ny+bh];if(gx===undefined&&mineX.some(a=>xs.some(c=>Math.abs(a-c)<threshold)))gx=xs.find(c=>mineX.some(a=>Math.abs(a-c)<threshold));if(gy===undefined&&mineY.some(a=>ys.some(c=>Math.abs(a-c)<threshold)))gy=ys.find(c=>mineY.some(a=>Math.abs(a-c)<threshold));if(gx!==undefined&&gy!==undefined)break}
    }
    if(Math.abs(nx+ bw/2-config.width/2)<threshold)gx=config.width/2
    setGuides({x:gx,y:gy})
  }
  const onDragEnd=(event:DragEndEvent)=>{
    const data=event.active.data.current
    if(data?.kind==='library'&&event.over?.id==='creative-canvas'){insert(data.libraryKind as LibraryKind,lastPointer)}
    if(data?.kind==='object'){const id=String(data.blockId),b=useEditorStore.getState().history.present.blocks.find(x=>x.id===id);if(b&&!b.locked){const d=b.style[device]||{};updateD(id,device,{x:Math.max(0,Number(d.x||0)+event.delta.x/zoom),y:Math.max(0,Number(d.y||0)+event.delta.y/zoom)},'Objeto movido')}}
    setActiveLibrary(null);setGuides({})
  }

  const onCanvasPointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(e.button!==0)return
    const p=canvasPoint(e);setLastPointer(p);setContext(null);setStackPicker(null)
    if(pendingTool){e.preventDefault();insert(pendingTool,p);return}
    if(e.target!==e.currentTarget)return
    setMarquee({start:p,current:p});if(!e.shiftKey)setSelectedIds([])
  }
  const onCanvasPointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{const p=canvasPoint(e);setLastPointer(p);if(marquee)setMarquee(m=>m?{...m,current:p}:m)}
  const onCanvasPointerUp=()=>{
    if(!marquee)return
    const x=Math.min(marquee.start.x,marquee.current.x),y=Math.min(marquee.start.y,marquee.current.y),width=Math.abs(marquee.current.x-marquee.start.x),height=Math.abs(marquee.current.y-marquee.start.y)
    if(width>4||height>4){const ids=roots.filter(b=>{const p=pos(b,device),bw=w(b,device),bh=h(b,device);return p.x<x+width&&p.x+bw>x&&p.y<y+height&&p.y+bh>y}).map(b=>b.id);setSelectedIds(ids)}
    setMarquee(null)
  }
  const onOverlapCapture=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(pendingTool||e.button!==0)return
    const nodes=document.elementsFromPoint(e.clientX,e.clientY),ids:Array<string>=[]
    nodes.forEach(node=>{const el=(node as HTMLElement).closest?.('[data-creative-object]') as HTMLElement|null;const id=el?.dataset.creativeObject;if(id&&!ids.includes(id))ids.push(id)})
    if(ids.length>1){const p=canvasPoint(e);setStackPicker({x:p.x,y:p.y,ids:ids.slice(0,8)})}
  }
  const onContextMenu=(e:React.MouseEvent,b:BuilderBlock)=>{e.preventDefault();e.stopPropagation();setSelectedIds([b.id]);setContext({x:e.clientX,y:e.clientY,id:b.id})}

  const marqueeRect=marquee?{left:Math.min(marquee.start.x,marquee.current.x),top:Math.min(marquee.start.y,marquee.current.y),width:Math.abs(marquee.current.x-marquee.start.x),height:Math.abs(marquee.current.y-marquee.start.y)}:null

  return <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}>
    <div className="creative-workspace">
      <aside className="creative-left">
        <div className="creative-left-tabs"><button className={leftTab==='add'?'active':''} onClick={()=>setLeftTab('add')} title="Adicionar"><Plus size={18}/></button><button className={leftTab==='layers'?'active':''} onClick={()=>setLeftTab('layers')} title="Camadas"><Layers3 size={18}/></button><button className={leftTab==='history'?'active':''} onClick={()=>setLeftTab('history')} title="Histórico"><FileClock size={18}/></button></div>
        {leftTab==='add'?<div className="creative-left-body"><div className="creative-mode-switch"><button className={mode==='simple'?'active':''} onClick={()=>setMode('simple')}>Iniciante</button><button className={mode==='advanced'?'active':''} onClick={()=>setMode('advanced')}>Avançado</button></div><div className="creative-panel-title"><strong>Adicionar</strong><small>{mode==='simple'?'Só o essencial para criar rápido.':'Todos os objetos disponíveis.'}</small></div><label className="creative-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar..."/></label>{Object.entries(groups).map(([group,items])=><section className="creative-library-group" key={group}><h4>{group}</h4>{items.map(item=><LibraryItem key={item.kind} item={item} onClick={()=>insert(item.kind)}/>)}</section>)}</div>:null}
        {leftTab==='layers'?<div className="creative-left-body"><div className="creative-panel-title"><strong>Camadas</strong><small>Arraste para reorganizar. Duplo clique para renomear.</small></div><div className="creative-layer-toolbar"><button disabled={selectedIds.length<2} onClick={()=>groupSelected(selectedIds,setSelectedIds)}><Group size={15}/>Agrupar</button><button disabled={!selectedId} onClick={()=>ungroupSelected(selectedId,setSelectedIds)}><Ungroup size={15}/>Desagrupar</button></div><div className="creative-layer-tree">{[...roots].sort((a,b)=>Number(b.style[device]?.zIndex||1)-Number(a.style[device]?.zIndex||1)).map(b=><LayerRow key={b.id} block={b} depth={0} selected={selectedIds.includes(b.id)} onSelect={id=>setSelectedIds([id])} onRename={(id,name)=>updateBlock(id,{name},'Camada renomeada')}/>)}</div></div>:null}
        {leftTab==='history'?<div className="creative-left-body"><div className="creative-panel-title"><strong>Histórico visual</strong><small>Restaure um estado anterior com um clique.</small></div><article className="creative-history-card current"><MiniMap document={doc} device={device}/><div><strong>Versão atual</strong><small>Agora</small></div></article>{useEditorStore.getState().snapshots.slice(0,12).map(s=><article className="creative-history-card" key={s.id}><MiniMap document={s.document} device={device}/><div><strong>{s.label}</strong><small>{new Date(s.at).toLocaleString('pt-BR')}</small></div><button onClick={()=>{restoreSnapshot(s.id);setSelectedIds([])}}>Restaurar</button></article>)}</div>:null}
      </aside>

      <main className="creative-center">
        <div className="creative-canvas-toolbar"><div><MousePointer2 size={15}/><span>{pendingTool==='text'?'Clique na página para inserir texto':'Selecionar e mover'}</span></div><div className="creative-shortcuts"><span>Ctrl+D Duplicar</span><span>Ctrl+G Agrupar</span><span>Ctrl+[ ] Camadas</span></div><div><button onClick={()=>setZoom(v=>Math.max(.25,v-.1))}><ZoomOut size={15}/></button><strong>{Math.round(zoom*100)}%</strong><button onClick={()=>setZoom(v=>Math.min(1.6,v+.1))}><ZoomIn size={15}/></button><button onClick={()=>setZoom(1)}>100%</button></div></div>
        <div className="creative-viewport">
          <div className="creative-device-shell" style={{width:config.width,height:config.height,transform:`scale(${zoom})`,transformOrigin:'top center'}}>
            <PortalSurface document={doc} device={device}>
              <div ref={node=>{stageRef.current=node;setDropRef(node)}} data-asteryon-hostinger-canvas data-creative-canvas className={`creative-stage ${doc.canvas.showGrid?'show-grid':''} ${isOver?'drag-over':''}`} style={{width:config.width,height:config.height,background:doc.canvas.gradient||doc.canvas.background,backgroundImage:doc.canvas.backgroundImage?`url(${doc.canvas.backgroundImage})`:doc.canvas.gradient||undefined,backgroundSize:doc.canvas.backgroundSize,backgroundPosition:doc.canvas.backgroundPosition}} onPointerDownCapture={onOverlapCapture} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onDoubleClick={e=>{if(e.target===e.currentTarget)insert('text',canvasPoint(e))}}>
                {!roots.length?<div className="creative-empty"><div><Plus size={28}/></div><strong>Página em branco</strong><span>Adicione Texto, Imagem, Produto ou Botão para começar.</span><small>Duplo clique em uma área vazia cria um texto.</small></div>:null}
                {roots.map(block=><CreativeObject key={block.id} block={block} selectedIds={selectedIds} setSelectedIds={setSelectedIds} editingTextId={editingTextId} setEditingTextId={setEditingTextId} onContextMenu={onContextMenu}/>) }
                {guides.x!==undefined?<span className="creative-guide vertical" style={{left:guides.x}}/>:null}{guides.y!==undefined?<span className="creative-guide horizontal" style={{top:guides.y}}/>:null}
                {marqueeRect?<span className="creative-marquee" style={marqueeRect}/>:null}
                {stackPicker?<div className="creative-stack-picker" style={{left:stackPicker.x+8,top:stackPicker.y+8}}><small>Objetos nesta área</small>{stackPicker.ids.map(id=>{const b=doc.blocks.find(x=>x.id===id);return b?<button key={id} onClick={e=>{e.stopPropagation();setSelectedIds([id]);setStackPicker(null)}}>{b.name}</button>:null})}</div>:null}
              </div>
            </PortalSurface>
          </div>
        </div>
      </main>

      <CreativePropertiesPanel selectedId={selectedId}/>
    </div>

    {context&&selectedBlock?<div className="creative-context" style={{left:context.x,top:context.y}} onMouseLeave={()=>setContext(null)}><button onClick={()=>{if(selectedBlock.type==='text')setEditingTextId(selectedBlock.id);setContext(null)}}><Type size={15}/>Editar</button><button onClick={()=>{duplicate(selectedBlock.id);setContext(null)}}><Copy size={15}/>Duplicar <kbd>Ctrl+D</kbd></button><button onClick={()=>{moveDepth(selectedBlock.id,'top');setContext(null)}}><BringToFront size={15}/>Trazer para o topo</button><button onClick={()=>{moveDepth(selectedBlock.id,'bottom');setContext(null)}}><SendToBack size={15}/>Enviar para o fundo</button><button disabled={selectedIds.length<2} onClick={()=>{groupSelected(selectedIds,setSelectedIds);setContext(null)}}><Group size={15}/>Agrupar</button><button onClick={()=>{toggleLocked(selectedBlock.id);setContext(null)}}>{selectedBlock.locked?<Unlock size={15}/>:<Lock size={15}/>} {selectedBlock.locked?'Desbloquear':'Bloquear'}</button><button onClick={()=>{toggleHidden(selectedBlock.id);setContext(null)}}>{selectedBlock.hidden?<Eye size={15}/>:<EyeOff size={15}/>} {selectedBlock.hidden?'Mostrar':'Ocultar'}</button><button className="danger" onClick={()=>{remove(selectedBlock.id);setSelectedIds([]);setContext(null)}}><Trash2 size={15}/>Excluir</button></div>:null}

    <DragOverlay>{activeLibrary?<div className="creative-drag-overlay"><BoxSelect size={18}/><strong>{LIBRARY.find(i=>i.kind===activeLibrary)?.label||'Objeto'}</strong></div>:null}</DragOverlay>
  </DndContext>
}
