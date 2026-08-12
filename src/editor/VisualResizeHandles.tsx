import React, { useRef } from 'react'
import { Move } from 'lucide-react'
import { useEditorStore } from './store'
import type { BuilderBlock, Device } from './types'

type Axis = 'x' | 'y' | 'xy'
type Props = { block: BuilderBlock; device: Device; children: React.ReactNode }

const minWidthFor = (type: BuilderBlock['type']) => ['button','text','search'].includes(type) ? 80 : 120
const minHeightFor = (type: BuilderBlock['type']) => ['button','text','search'].includes(type) ? 34 : 56

export function VisualResizeHandles({ block, device, children }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const updateDeviceStyle = useEditorStore(s => s.updateDeviceStyle)
  const d = block.style[device] || {}
  const width = d.width || '100%'
  const free = d.positionMode === 'free'

  const startResize = (axis: Axis, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation()
    const shell = shellRef.current
    if (!shell) return
    const startX = event.clientX; const startY = event.clientY
    const rect = shell.getBoundingClientRect(); const parentWidth = shell.parentElement?.getBoundingClientRect().width || rect.width
    const startWidth = rect.width; const startHeight = rect.height
    const move = (pointer: PointerEvent) => {
      const patch: Record<string, unknown> = {}
      if (axis === 'x' || axis === 'xy') patch.width = `${Math.round(Math.max(minWidthFor(block.type), Math.min(parentWidth, startWidth + pointer.clientX - startX)))}px`
      if (axis === 'y' || axis === 'xy') patch.minHeight = Math.round(Math.max(minHeightFor(block.type), startHeight + pointer.clientY - startY))
      updateDeviceStyle(block.id, device, patch, 'Tamanho ajustado visualmente')
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true })
  }

  const startMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!free) return
    event.preventDefault(); event.stopPropagation()
    const startX = event.clientX; const startY = event.clientY; const x = Number(d.x || 0); const y = Number(d.y || 0)
    const move = (pointer: PointerEvent) => updateDeviceStyle(block.id, device, { x: Math.round(x + pointer.clientX - startX), y: Math.round(y + pointer.clientY - startY) }, 'Elemento movido no canvas livre')
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true })
  }

  const fitWidth = (value: string) => updateDeviceStyle(block.id, device, { width: value }, `Largura ${value}`)

  return <div ref={shellRef} className={`visual-resize-shell ${free ? 'free-mode' : 'flow-mode'}`} style={{ width }} onClick={e => e.stopPropagation()}>
    {children}
    <div className="visual-size-badge">{width === 'auto' ? 'Auto' : width} × {d.minHeight || 'auto'}{free ? ` · X ${d.x || 0} Y ${d.y || 0}` : ''}</div>
    <div className="visual-width-presets" onPointerDown={e => e.stopPropagation()}>
      <button type="button" onClick={() => fitWidth('auto')}>Auto</button><button type="button" onClick={() => fitWidth('25%')}>25%</button><button type="button" onClick={() => fitWidth('33%')}>33%</button><button type="button" onClick={() => fitWidth('50%')}>50%</button><button type="button" onClick={() => fitWidth('66%')}>66%</button><button type="button" onClick={() => fitWidth('75%')}>75%</button><button type="button" onClick={() => fitWidth('100%')}>100%</button>
    </div>
    {free ? <button type="button" className="free-move-handle" aria-label="Mover elemento" title="Arraste para mover livremente" onPointerDown={startMove}><Move size={15} /> Mover</button> : null}
    <button type="button" className="resize-handle resize-right" aria-label="Ajustar largura" onPointerDown={e => startResize('x', e)} />
    <button type="button" className="resize-handle resize-bottom" aria-label="Ajustar altura" onPointerDown={e => startResize('y', e)} />
    <button type="button" className="resize-handle resize-corner" aria-label="Ajustar largura e altura" onPointerDown={e => startResize('xy', e)} />
  </div>
}
