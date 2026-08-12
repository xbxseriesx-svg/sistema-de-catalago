import React from 'react'
import type { BuilderBlock, Device, EditorDocument } from './types'
import { BlockContent, PortalSurface, positionStyleForBlock } from './BlockRenderer'

const nestingTypes: BuilderBlock['type'][] = ['frame','container','row','column','header','hero','banner','carousel','card','showcase','promotion','category','brand','distribution','footer']

function VisitorBlock({ block, document, device }: { block: BuilderBlock; document: EditorDocument; device: Device }) {
  if (block.hidden || block.hiddenOn[device]) return null
  const children = document.blocks.filter(b => b.parentId === block.id).sort((a, b) => a.order - b.order)
  const content = <BlockContent block={block} document={document} device={device}>{nestingTypes.includes(block.type) ? children.map(child => <VisitorBlock key={child.id} block={child} document={document} device={device} />) : null}</BlockContent>
  return <div className={block.style[device]?.positionMode === 'free' ? 'visitor-free-block' : 'visitor-flow-block'} style={positionStyleForBlock(block, device)}>{content}</div>
}

export function DocumentPreview({ document, device = 'desktop', visitorMode = true }: { document: EditorDocument; device?: Device; visitorMode?: boolean }) {
  const roots = document.blocks.filter(b => b.parentId === null).sort((a, b) => a.order - b.order)
  const config = document.canvas?.[device]
  return <PortalSurface document={document} device={device} visitorMode={visitorMode}><div className="visitor-canvas-stage" style={{ position:'relative', minHeight:config?.height || 1600 }}>{roots.map(block => <VisitorBlock key={block.id} block={block} document={document} device={device} />)}</div></PortalSurface>
}
