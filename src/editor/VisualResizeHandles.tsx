import React, { useRef, useState } from 'react'
import { Move } from 'lucide-react'
import { useEditorStore } from './store'
import type { BuilderBlock, Device } from './types'

type Handle = 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw'
type Props = { block: BuilderBlock; device: Device; children: React.ReactNode }
const minWidthFor=(type:BuilderBlock['type'])=>['button','text','search'].includes(type)?48:80
const minHeightFor=(type:BuilderBlock['type'])=>['button','text','search'].includes(type)?28:40
const snap=(value:number,size:number,enabled:boolean)=>enabled?Math.round(value/size)*size:Math.round(value)

export function VisualResizeHandles({block,device,children}:Props){
  const shellRef=useRef<HTMLDivElement>(null)
  const updateDeviceStyle=useEditorStore(s=>s.updateDeviceStyle)
  const canvas=useEditorStore(s=>s.history.present.canvas)
  const d=block.style[device]||{}
  const free=d.positionMode==='free'
  const [preview,setPreview]=useState<{width?:number;height?:number;dx?:number;dy?:number}|null>(null)
  const gridSize=Math.max(1,Number(canvas?.gridSize||8)), snapEnabled=Boolean(canvas?.snapToGrid)

  const startResize=(handle:Handle,event:React.PointerEvent<HTMLButtonElement>)=>{
    event.preventDefault();event.stopPropagation()
    const shell=shellRef.current;if(!shell)return
    const startX=event.clientX,startY=event.clientY,rect=shell.getBoundingClientRect()
    const startWidth=rect.width,startHeight=rect.height,startPosX=Number(d.x||0),startPosY=Number(d.y||0)
    let last={width:startWidth,height:startHeight,dx:0,dy:0}
    const move=(p:PointerEvent)=>{
      const rawDx=p.clientX-startX,rawDy=p.clientY-startY
      let width=startWidth,height=startHeight,dx=0,dy=0
      if(handle.includes('e')) width=Math.max(minWidthFor(block.type),startWidth+rawDx)
      if(handle.includes('s')) height=Math.max(minHeightFor(block.type),startHeight+rawDy)
      if(handle.includes('w')){width=Math.max(minWidthFor(block.type),startWidth-rawDx);dx=startWidth-width}
      if(handle.includes('n')){height=Math.max(minHeightFor(block.type),startHeight-rawDy);dy=startHeight-height}
      width=snap(width,gridSize,snapEnabled);height=snap(height,gridSize,snapEnabled);dx=snap(dx,gridSize,snapEnabled);dy=snap(dy,gridSize,snapEnabled)
      last={width,height,dx,dy};setPreview(last)
    }
    const up=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)
      const patch:Record<string,unknown>={width:`${Math.max(minWidthFor(block.type),last.width)}px`,height:Math.max(minHeightFor(block.type),last.height)}
      if(free && (handle.includes('w')||handle.includes('n'))){patch.x=snap(startPosX+last.dx,gridSize,snapEnabled);patch.y=snap(startPosY+last.dy,gridSize,snapEnabled)}
      updateDeviceStyle(block.id,device,patch,'Elemento redimensionado livremente');setPreview(null)
    }
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true})
  }

  const startMove=(event:React.PointerEvent<HTMLButtonElement>)=>{
    if(!free)return
    event.preventDefault();event.stopPropagation()
    const startX=event.clientX,startY=event.clientY,x=Number(d.x||0),y=Number(d.y||0)
    let last={dx:0,dy:0}
    const move=(p:PointerEvent)=>{last={dx:p.clientX-startX,dy:p.clientY-startY};setPreview(prev=>({...prev,dx:last.dx,dy:last.dy}))}
    const up=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)
      updateDeviceStyle(block.id,device,{x:snap(x+last.dx,gridSize,snapEnabled),y:snap(y+last.dy,gridSize,snapEnabled)},'Elemento movido livremente');setPreview(null)
    }
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true})
  }

  const currentWidth=preview?.width||shellRef.current?.getBoundingClientRect().width||parseFloat(String(d.width||0))||0
  const currentHeight=preview?.height||shellRef.current?.getBoundingClientRect().height||Number(d.height||d.minHeight||0)
  const shellStyle:React.CSSProperties={
    width:preview?.width?`${preview.width}px`:undefined,
    height:preview?.height?`${preview.height}px`:undefined,
    transform:preview&&(preview.dx||preview.dy)?`translate(${preview.dx||0}px,${preview.dy||0}px)`:undefined,
  }

  return <div ref={shellRef} className={`visual-resize-shell freedom-resize ${free?'free-mode':'flow-mode'}`} style={shellStyle} onClick={e=>e.stopPropagation()}>
    <div className="visual-resize-content">{children}</div>
    <div className="visual-size-badge">W {Math.round(currentWidth)||'auto'} · H {Math.round(currentHeight)||'auto'}{free?` · X ${Math.round(Number(d.x||0)+(preview?.dx||0))} · Y ${Math.round(Number(d.y||0)+(preview?.dy||0))}`:''}</div>
    {free?<button type="button" className="free-move-handle" aria-label="Mover elemento" title="Arraste para mover" onPointerDown={startMove}><Move size={14}/> Mover</button>:null}
    {(['n','ne','e','se','s','sw','w','nw'] as Handle[]).map(handle=><button key={handle} type="button" className={`resize-handle resize-${handle}`} aria-label={`Redimensionar ${handle}`} onPointerDown={e=>startResize(handle,e)}/>)}
  </div>
}
