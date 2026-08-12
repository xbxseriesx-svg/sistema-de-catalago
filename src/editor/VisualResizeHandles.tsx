import React, { useRef } from 'react'
import { useEditorStore } from './store'
import type { BuilderBlock, Device } from './types'

type Axis = 'x' | 'y' | 'xy'

type Props = {
  block: BuilderBlock
  device: Device
  children: React.ReactNode
}

const minWidthFor = (type: BuilderBlock['type']) => ['button','text'].includes(type) ? 80 : 140
const minHeightFor = (type: BuilderBlock['type']) => ['button','text'].includes(type) ? 34 : 60

export function VisualResizeHandles({ block, device, children }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const updateDeviceStyle = useEditorStore(s => s.updateDeviceStyle)
  const width = block.style[device]?.width || '100%'

  const startResize = (axis: Axis, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const shell = shellRef.current
    if (!shell) return

    const startX = event.clientX
    const startY = event.clientY
    const rect = shell.getBoundingClientRect()
    const parentWidth = shell.parentElement?.getBoundingClientRect().width || rect.width
    const startWidth = rect.width
    const startHeight = rect.height
    const minWidth = minWidthFor(block.type)
    const minHeight = minHeightFor(block.type)

    const move = (pointer: PointerEvent) => {
      if (axis === 'x' || axis === 'xy') {
        const next = Math.max(minWidth, Math.min(parentWidth, startWidth + pointer.clientX - startX))
        updateDeviceStyle(block.id, device, { width: `${Math.round(next)}px` }, 'Largura ajustada visualmente')
      }
      if (axis === 'y' || axis === 'xy') {
        const next = Math.max(minHeight, startHeight + pointer.clientY - startY)
        updateDeviceStyle(block.id, device, { minHeight: Math.round(next) }, 'Altura ajustada visualmente')
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const fitWidth = (value: string) => {
    updateDeviceStyle(block.id, device, { width: value }, `Largura ${value}`)
  }

  const displayWidth = width === 'auto' ? 'Auto' : width

  return <div ref={shellRef} className="visual-resize-shell" style={{ width }} onClick={e => e.stopPropagation()}>
    {children}
    <div className="visual-size-badge">{displayWidth} × {block.style[device]?.minHeight || 'auto'}</div>
    <div className="visual-width-presets" onPointerDown={e => e.stopPropagation()}>
      <button type="button" onClick={() => fitWidth('auto')}>Auto</button>
      <button type="button" onClick={() => fitWidth('50%')}>50%</button>
      <button type="button" onClick={() => fitWidth('75%')}>75%</button>
      <button type="button" onClick={() => fitWidth('100%')}>100%</button>
    </div>
    <button type="button" className="resize-handle resize-right" aria-label="Ajustar largura" onPointerDown={e => startResize('x', e)} />
    <button type="button" className="resize-handle resize-bottom" aria-label="Ajustar altura" onPointerDown={e => startResize('y', e)} />
    <button type="button" className="resize-handle resize-corner" aria-label="Ajustar largura e altura" onPointerDown={e => startResize('xy', e)} />
  </div>
}
