import React from 'react'
import type { BuilderBlock, Device, EditorDocument } from './types'
import { BlockContent, PortalSurface } from './BlockRenderer'

const nestingTypes: BuilderBlock['type'][] = ['frame','container','row','column','header','hero','banner','carousel','card','showcase','promotion','category','brand','distribution','footer']

function VisitorBlock({ block, document, device }: { block: BuilderBlock; document: EditorDocument; device: Device }) {
  if (block.hidden || block.hiddenOn[device]) return null
  const children = document.blocks.filter(b => b.parentId === block.id).sort((a, b) => a.order - b.order)
  const d = block.style[device] || {}
  const content = <BlockContent block={block} document={document} device={device}>{nestingTypes.includes(block.type) ? <div style={{position:'relative',minHeight:120}}>{children.map(child => <VisitorBlock key={child.id} block={child} document={document} device={device} />)}</div> : null}</BlockContent>
  return <div className="visitor-free-block" style={{position:'absolute',left:d.x||0,top:d.y||0,width:d.width||'auto',minHeight:d.minHeight,height:d.height,zIndex:d.zIndex||1,transform:d.rotate?`rotate(${d.rotate}deg)`:undefined}}>{content}</div>
}

export function DocumentPreview({ document, device = 'desktop', visitorMode = true }: { document: EditorDocument; device?: Device; visitorMode?: boolean }) {
  const roots = document.blocks.filter(b => b.parentId === null).sort((a, b) => (a.style[device]?.zIndex||0) - (b.style[device]?.zIndex||0))
  const config = document.canvas?.[device] || { width: device==='desktop'?1440:device==='tablet'?834:390, height:1600 }
  const canvas = document.canvas
  return <PortalSurface document={document} device={device} visitorMode={visitorMode}><div className="visitor-canvas-stage" style={{position:'relative',width:config.width,minHeight:config.height,margin:'0 auto',background:canvas?.gradient||canvas?.background||document.designSystem.pageBackground,backgroundImage:canvas?.backgroundImage?`url(${canvas.backgroundImage})`:canvas?.gradient||undefined,backgroundSize:canvas?.backgroundSize,backgroundPosition:canvas?.backgroundPosition,backgroundRepeat:'no-repeat'}}>{roots.map(block => <VisitorBlock key={block.id} block={block} document={document} device={device} />)}</div></PortalSurface>
}
