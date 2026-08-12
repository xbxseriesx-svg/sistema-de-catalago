import React from 'react'
import type { BuilderBlock, Device, EditorDocument } from './types'
import { BlockContent, PortalSurface } from './BlockRenderer'

const nestingTypes: BuilderBlock['type'][] = ['container', 'row', 'column']

function VisitorBlock({ block, document, device }: { block: BuilderBlock; document: EditorDocument; device: Device }) {
  if (block.hidden || block.hiddenOn[device]) return null
  const children = document.blocks.filter(b => b.parentId === block.id).sort((a, b) => a.order - b.order)
  return <BlockContent block={block} document={document} device={device}>{nestingTypes.includes(block.type) ? children.map(child => <VisitorBlock key={child.id} block={child} document={document} device={device} />) : null}</BlockContent>
}

export function DocumentPreview({ document, device = 'desktop', visitorMode = true }: { document: EditorDocument; device?: Device; visitorMode?: boolean }) {
  const roots = document.blocks.filter(b => b.parentId === null).sort((a, b) => a.order - b.order)
  return <PortalSurface document={document} device={device} visitorMode={visitorMode}>{roots.map(block => <VisitorBlock key={block.id} block={block} document={document} device={device} />)}</PortalSurface>
}
