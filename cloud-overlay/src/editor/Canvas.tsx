import { useRef, useCallback, useEffect, useState } from 'react';
import { useEditor } from './store';
import { NodeRenderer } from './NodeRenderer';
import type { GuideLine } from './smartGuides';
import { getResponsiveRect, responsivePatch } from './utils';
import { PageResizeHandle } from '../cloud/PageResizeHandle';

interface CanvasProps {
  guides: GuideLine[];
  setGuides: (g: GuideLine[]) => void;
}

export function Canvas({ guides, setGuides }: CanvasProps) {
  const { state, dispatch, getNode, saveDraft } = useEditor();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; x: number; y: number; width: number; height: number } | null>(null);
  const panState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const selectionState = useRef<{ startX: number; startY: number } | null>(null);
  const page = state.nodes.find((n) => n.type === 'page');
  const pageRect = page ? getResponsiveRect(page, state.device) : { x: 0, y: 0, width: 1440, height: 5200 };
  const viewportHeight = state.device === 'desktop'
    ? (pageRect.width >= 3840 ? 2160 : pageRect.width >= 2560 ? 1440 : pageRect.width >= 1900 ? 1080 : pageRect.width <= 1366 ? 768 : 900)
    : state.device === 'tablet'
      ? (pageRect.width <= 768 ? 1024 : 1112)
      : (pageRect.width <= 360 ? 800 : pageRect.width >= 430 ? 932 : 844);

  const contentBottom = (() => {
    if (!page?.children?.length) return 0;
    let bottom = 0;
    const walk = (nodes: typeof state.nodes, ox = 0, oy = 0) => {
      for (const node of nodes) {
        const r = getResponsiveRect(node, state.device);
        const ax = ox + r.x;
        const ay = oy + r.y;
        bottom = Math.max(bottom, ay + r.height);
        if (node.children?.length) walk(node.children, ax, ay);
      }
    };
    walk(page.children);
    return bottom;
  })();

  const autoExtend = page?.props?.autoExtend !== false;
  const effectivePageHeight = autoExtend ? Math.max(pageRect.height, contentBottom + 120, 480) : Math.max(pageRect.height, 480);

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const x = (screenX - rect.left - state.pan.x) / state.zoom;
      const y = (screenY - rect.top - state.pan.y) / state.zoom;
      return { x, y };
    },
    [state.pan, state.zoom]
  );

  useEffect(() => {
    if (!page || state.previewMode) return;
    if (page.props?.autoExtend === false) return;
    if (effectivePageHeight <= pageRect.height + 4) return;
    dispatch({
      type: 'UPDATE_NODE',
      id: page.id,
      changes: responsivePatch(page, state.device, { height: Math.ceil(effectivePageHeight / 100) * 100 }),
      skipHistory: true,
    });
  }, [page, pageRect.height, effectivePageHeight, state.device, state.previewMode, dispatch]);

  const displayPage = page
    ? state.device === 'desktop'
      ? { ...page, height: effectivePageHeight }
      : { ...page, responsive: { ...(page.responsive || {}), [state.device]: { ...pageRect, height: effectivePageHeight } } }
    : null;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (state.previewMode) return;
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true') {
      if (e.button === 1 || (e.button === 0 && (e.altKey || e.metaKey))) {
        setIsPanning(true);
        panState.current = { startX: e.clientX, startY: e.clientY, panX: state.pan.x, panY: state.pan.y };
        e.preventDefault();
        return;
      }
      if (e.button === 0) {
        dispatch({ type: 'CLEAR_SELECTION' });
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        selectionState.current = { startX: x, startY: y };
        setSelectionBox({ startX: x, startY: y, x, y, width: 0, height: 0 });
      }
    }
  }, [dispatch, screenToCanvas, state.pan, state.previewMode]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning && panState.current) {
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      dispatch({ type: 'SET_PAN', pan: { x: panState.current.panX + dx, y: panState.current.panY + dy } });
      return;
    }
    if (selectionState.current) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      const sx = selectionState.current.startX;
      const sy = selectionState.current.startY;
      const box = { startX: sx, startY: sy, x: Math.min(sx, x), y: Math.min(sy, y), width: Math.abs(x - sx), height: Math.abs(y - sy) };
      setSelectionBox(box);
      const selected: string[] = [];
      function collect(nodes: typeof state.nodes, ox = 0, oy = 0) {
        for (const n of nodes) {
          const r = getResponsiveRect(n, state.device);
          const ax = ox + r.x;
          const ay = oy + r.y;
          if (n.type !== 'page') {
            const intersects = !(box.x + box.width < ax || box.x > ax + r.width || box.y + box.height < ay || box.y > ay + r.height);
            if (intersects && !n.locked) selected.push(n.id);
          }
          if (n.children) collect(n.children, ax, ay);
        }
      }
      collect(state.nodes);
      if (selected.length > 0) dispatch({ type: 'SELECT', ids: selected });
    }
  }, [isPanning, screenToCanvas, dispatch, state.nodes, state.device]);

  const onPointerUp = useCallback(() => { setIsPanning(false); panState.current = null; selectionState.current = null; setSelectionBox(null); }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.min(Math.max(state.zoom * (1 + delta), 0.1), 5);
      const scale = newZoom / state.zoom;
      dispatch({ type: 'SET_PAN', pan: { x: mouseX - (mouseX - state.pan.x) * scale, y: mouseY - (mouseY - state.pan.y) * scale } });
      dispatch({ type: 'SET_ZOOM', zoom: newZoom });
    } else {
      dispatch({ type: 'SET_PAN', pan: { x: state.pan.x - e.deltaX, y: state.pan.y - e.deltaY } });
    }
  }, [state.zoom, state.pan, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.length > 0) { e.preventDefault(); dispatch({ type: 'REMOVE_NODES', ids: state.selectedIds }); }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault(); if (state.selectedIds.length > 0) dispatch({ type: 'DUPLICATE', ids: state.selectedIds });
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') dispatch({ type: 'COPY' });
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v') dispatch({ type: 'PASTE' });
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault(); const allIds: string[] = []; function collect(nodes: typeof state.nodes) { for (const n of nodes) { if (n.type !== 'page' && !n.locked) allIds.push(n.id); if (n.children) collect(n.children); } } collect(state.nodes); dispatch({ type: 'SELECT', ids: allIds });
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); dispatch({ type: 'REDO' }); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void saveDraft(); }
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault(); if (state.selectedIds.length === 1) { const n = getNode(state.selectedIds[0]); if (n && n.type === 'group') dispatch({ type: 'UNGROUP', groupId: n.id }); }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault(); if (state.selectedIds.length >= 2) import('./utils').then(({ uid }) => dispatch({ type: 'GROUP', ids: state.selectedIds, groupId: uid() }));
      } else if ((e.ctrlKey || e.metaKey) && e.key === ']') { e.preventDefault(); if (state.selectedIds.length) dispatch({ type: 'BRING_FORWARD', ids: state.selectedIds }); }
      else if ((e.ctrlKey || e.metaKey) && e.key === '[') { e.preventDefault(); if (state.selectedIds.length) dispatch({ type: 'SEND_BACKWARD', ids: state.selectedIds }); }
      else if (e.key === 'Escape') { dispatch({ type: 'CLEAR_SELECTION' }); dispatch({ type: 'SET_EDITING', id: null }); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (state.selectedIds.length > 0) {
          e.preventDefault(); const step = e.shiftKey ? 10 : 1; const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0; const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          const updates = state.selectedIds.map((id) => { const n = getNode(id); if (!n || n.locked) return { id, changes: {} }; const r = getResponsiveRect(n, state.device); return { id, changes: responsivePatch(n, state.device, { x: r.x + dx, y: r.y + dy }) }; });
          dispatch({ type: 'UPDATE_NODES', updates });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedIds, state.nodes, state.device, dispatch, getNode, saveDraft]);

  const guideLines = guides.length > 0 ? guides : [];
  return (
    <div ref={canvasRef} data-canvas-bg="true" className="relative overflow-hidden flex-1 select-none" style={{ backgroundColor: '#18181b', backgroundImage: state.showGrid ? `radial-gradient(circle, #27272a 1px, transparent 1px)` : 'none', backgroundSize: `${20 * state.zoom}px ${20 * state.zoom}px`, backgroundPosition: `${state.pan.x}px ${state.pan.y}px`, cursor: isPanning ? 'grabbing' : selectionBox ? 'crosshair' : 'default' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`, transformOrigin: '0 0' }}>
        {displayPage && <NodeRenderer node={displayPage} parentId={null} isAncestorSelected={false} guides={guides} setGuides={setGuides} />}
        {page && !state.previewMode && <PageResizeHandle page={page} pageRect={pageRect} effectivePageHeight={effectivePageHeight} />}
        {!state.previewMode && displayPage && Array.from({ length: Math.max(0, Math.ceil(effectivePageHeight / viewportHeight) - 1) }).map((_, index) => { const y = (index + 1) * viewportHeight; return <div key={`fold-${index}`} style={{ position: 'absolute', left: 0, top: y, width: pageRect.width, height: 0, borderTop: '1px dashed rgba(14,165,233,0.28)', pointerEvents: 'none', zIndex: 900 }}><span style={{ position: 'absolute', right: 10, top: -18, fontSize: 10, color: 'rgba(14,165,233,0.65)', background: 'rgba(24,24,27,0.84)', padding: '2px 6px', borderRadius: 4 }}>Dobra {index + 2} · {y}px</span></div>; })}
        {guideLines.map((g, i) => <div key={`guide-${i}`} style={g.type === 'vertical' ? { position: 'absolute', left: g.position, top: g.start - 2, width: 1, height: g.end - g.start + 4, backgroundColor: '#ec4899', pointerEvents: 'none', zIndex: 99999 } : { position: 'absolute', top: g.position, left: g.start - 2, height: 1, width: g.end - g.start + 4, backgroundColor: '#ec4899', pointerEvents: 'none', zIndex: 99999 }} />)}
        {selectionBox && <div style={{ position: 'absolute', left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height, border: '1px solid #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', pointerEvents: 'none', zIndex: 99998 }} />}
      </div>
      <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 8, alignItems: 'center', backgroundColor: 'rgba(24, 24, 27, 0.9)', border: '1px solid #3f3f46', borderRadius: 8, padding: '6px 10px', color: '#a1a1aa', fontSize: 12, fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom - 0.1 })} className="text-zinc-400 hover:text-white transition-colors w-5 h-5 flex items-center justify-center rounded"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg></button>
        <span className="text-white min-w-[42px] text-center cursor-pointer" onClick={() => { dispatch({ type: 'SET_ZOOM', zoom: 0.6 }); dispatch({ type: 'SET_PAN', pan: { x: 200, y: 100 } }); }}>{Math.round(state.zoom * 100)}%</span>
        <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom + 0.1 })} className="text-zinc-400 hover:text-white transition-colors w-5 h-5 flex items-center justify-center rounded"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14"/></svg></button>
        <div className="w-px h-4 bg-zinc-700" /><span className="text-zinc-500">{Math.round(pageRect.width)}px × página contínua · dobra {viewportHeight}px</span><div className="w-px h-4 bg-zinc-700" /><span className="text-zinc-500">Alt+arrastar para mover · Ctrl+rolagem para zoom</span>
      </div>
    </div>
  );
}
