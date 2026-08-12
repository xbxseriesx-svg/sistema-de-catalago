import React, { useRef, useState } from 'react'
import { Move } from 'lucide-react'
import { useEditorStore } from './store'
import type { BuilderBlock, Device } from './types'

type Handle = 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw'
type Props = { block: BuilderBlock; device: Device; children: React.ReactNode }
const minWidthFor=(type:BuilderBlock['type'])=>['button','text','search'].includes(type)?48:80
const minHeightFor=(type:BuilderBlock['type'])=>['button','text','search'].includes(type)?28:40
const round=(value:number)=>Math.round(value)

export function VisualResizeHandles({block,device,children}:Props){
  const shellRef=useRef<HTMLDivElement>(null)
  const updateDeviceStyle=useEditorStore(s=>s.updateDeviceStyle)
  const canvas=useEditorStore(s=>s.history.present.canvas)
  const d=block.style[device]||{}
  const free=d.positionMode==='free'
  const [preview,setPreview]=useState<{width?:number;height?:number;dx?:number;dy?:number}|null>(null)
  const canvasScale=()=>{
    const shell=shellRef.current
    const stage=shell?.closest('[data-asteryon-hostinger-canvas]') as HTMLElement|null
    if(!stage)return 1
    const logical=Math.max(1,Number(canvas?.[device]?.width||stage.offsetWidth||1))
    return Math.max(.1,stage.getBoundingClientRect().width/logical)
  }

  const startResize=(handle:Handle,event:React.PointerEvent<HTMLButtonElement>)=>{
    event.preventDefault();event.stopPropagation()
    const shell=shellRef.current;if(!shell)return
    const scale=canvasScale(),startX=event.clientX,startY=event.clientY,rect=shell.getBoundingClientRect()
    const startWidth=rect.width/scale,startHeight=rect.height/scale,startPosX=Number(d.x||0),startPosY=Number(d.y||0)
    let last={width:startWidth,height:startHeight,dx:0,dy:0}
    const move=(p:PointerEvent)=>{
      const rawDx=(p.clientX-startX)/scale,rawDy=(p.clientY-startY)/scale
      let width=startWidth,height=startHeight,dx=0,dy=0
      if(handle.includes('e')) width=Math.max(minWidthFor(block.type),startWidth+rawDx)
      if(handle.includes('s')) height=Math.max(minHeightFor(block.type),startHeight+rawDy)
      if(handle.includes('w')){width=Math.max(minWidthFor(block.type),startWidth-rawDx);dx=startWidth-width}
      if(handle.includes('n')){height=Math.max(minHeightFor(block.type),startHeight-rawDy);dy=startHeight-height}
      width=round(width);height=round(height);dx=round(dx);dy=round(dy)
      last={width,height,dx,dy};setPreview(last)
    }
    const up=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)
      const patch:Record<string,unknown>={positionMode:'free',width:`${Math.max(minWidthFor(block.type),last.width)}px`,height:Math.max(minHeightFor(block.type),last.height)}
      if(handle.includes('w')||handle.includes('n')){patch.x=round(startPosX+last.dx);patch.y=round(startPosY+last.dy)}
      updateDeviceStyle(block.id,device,patch,'Elemento redimensionado livremente');setPreview(null)
    }
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true})
  }

  const startMove=(event:React.PointerEvent<HTMLElement>)=>{
    if(!free)return
    const target=event.target as HTMLElement
    if(target.closest('button,input,textarea,select,a,[contenteditable="true"]'))return
    if(event.button!==0)return
    event.preventDefault();event.stopPropagation()
    const scale=canvasScale(),startX=event.clientX,startY=event.clientY,x=Number(d.x||0),y=Number(d.y||0)
    let last={dx:0,dy:0}
    const move=(p:PointerEvent)=>{last={dx:(p.clientX-startX)/scale,dy:(p.clientY-startY)/scale};setPreview(prev=>({...prev,dx:last.dx,dy:last.dy}))}
    const up=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)
      updateDeviceStyle(block.id,device,{positionMode:'free',x:round(x+last.dx),y:round(y+last.dy)},'Elemento movido livremente');setPreview(null)
    }
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true})
  }

  const scale=canvasScale()
  const currentWidth=preview?.width||(shellRef.current?.getBoundingClientRect().width||0)/scale||parseFloat(String(d.width||0))||0
  const currentHeight=preview?.height||(shellRef.current?.getBoundingClientRect().height||0)/scale||Number(d.height||d.minHeight||0)
  const shellStyle:React.CSSProperties={width:preview?.width?`${preview.width}px`:undefined,height:preview?.height?`${preview.height}px`:undefined,transform:preview&&(preview.dx||preview.dy)?`translate(${preview.dx||0}px,${preview.dy||0}px)`:undefined}

  return <div ref={shellRef} className={`visual-resize-shell freedom-resize ${free?'free-mode':'flow-mode'}`} style={shellStyle} onClick={e=>e.stopPropagation()} onPointerDown={startMove}>
    <div className="visual-resize-content">{children}</div>
    <div className="visual-size-badge">W {Math.round(currentWidth)||'auto'} · H {Math.round(currentHeight)||'auto'}{free?` · X ${Math.round(Number(d.x||0)+(preview?.dx||0))} · Y ${Math.round(Number(d.y||0)+(preview?.dy||0))}`:''}</div>
    {free?<button type="button" className="free-move-handle" aria-label="Mover elemento" title="Arraste para mover" onPointerDown={startMove}><Move size={14}/> Mover</button>:null}
    {(['n','ne','e','se','s','sw','w','nw'] as Handle[]).map(handle=><button key={handle} type="button" className={`resize-handle resize-${handle}`} aria-label={`Redimensionar ${handle}`} onPointerDown={e=>startResize(handle,e)}/>)}
  </div>
}
