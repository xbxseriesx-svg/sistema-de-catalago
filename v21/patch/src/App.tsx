import { useState, useEffect, useCallback } from 'react';
import { EditorProvider, useEditor } from './editor/store';
import { Toolbar } from './editor/Toolbar';
import { Canvas } from './editor/Canvas';
import { LayersPanel } from './editor/LayersPanel';
import { PropertiesPanel } from './editor/PropertiesPanel';
import { ElementsPanel } from './editor/ElementsPanel';
import { CatalogPanel } from './editor/CatalogPanel';
import { HistoryPanel } from './editor/HistoryPanel';
import { TemplatesPanel } from './editor/TemplatesPanel';
import { SelectionBreadcrumb } from './editor/SelectionBreadcrumb';
import type { GuideLine } from './editor/smartGuides';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Layers,
  Box,
  PackageSearch,
  History,
  LayoutTemplate,
} from 'lucide-react';

type LeftTab = 'elements' | 'templates' | 'layers' | 'catalog' | 'history';

const LEFT_MIN = 270;
const LEFT_MAX = 560;
const RIGHT_MIN = 270;
const RIGHT_MAX = 560;

function readPanelWidth(key: string, fallback: number) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? Number(raw) : fallback;
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function EditorShell() {
  const { state } = useEditor();
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [leftTab, setLeftTab] = useState<LeftTab>('elements');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(() => readPanelWidth('asteryon.ui.leftWidth', 350));
  const [rightWidth, setRightWidth] = useState(() => readPanelWidth('asteryon.ui.rightWidth', 330));

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.overflow = '';
      document.body.style.userSelect = '';
    };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem('asteryon.ui.leftWidth', String(leftWidth)); } catch {}
  }, [leftWidth]);

  useEffect(() => {
    try { window.localStorage.setItem('asteryon.ui.rightWidth', String(rightWidth)); } catch {}
  }, [rightWidth]);

  const beginResize = useCallback((side: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = side === 'left' ? leftWidth : rightWidth;
    const min = side === 'left' ? LEFT_MIN : RIGHT_MIN;
    const max = side === 'left' ? LEFT_MAX : RIGHT_MAX;

    const onMove = (event: PointerEvent) => {
      const delta = event.clientX - startX;
      const next = side === 'left' ? startWidth + delta : startWidth - delta;
      const width = Math.min(max, Math.max(min, next));
      if (side === 'left') setLeftWidth(width);
      else setRightWidth(width);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [leftWidth, rightWidth]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Toolbar />
      {!state.previewMode && <SelectionBreadcrumb />}

      {state.previewMode ? (
        <div className="flex flex-1 overflow-hidden bg-zinc-950">
          <Canvas guides={guides} setGuides={setGuides} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {leftPanelOpen && (
            <>
              <div className="flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-900" style={{ width: leftWidth }}>
                <div className="flex min-h-10 overflow-x-auto border-b border-zinc-800 [scrollbar-width:thin]">
                  <Tab active={leftTab === 'elements'} onClick={() => setLeftTab('elements')} icon={<Box size={13} />} label="Elementos" />
                  <Tab active={leftTab === 'templates'} onClick={() => setLeftTab('templates')} icon={<LayoutTemplate size={13} />} label="Modelos" />
                  <Tab active={leftTab === 'layers'} onClick={() => setLeftTab('layers')} icon={<Layers size={13} />} label="Camadas" />
                  <Tab active={leftTab === 'catalog'} onClick={() => setLeftTab('catalog')} icon={<PackageSearch size={13} />} label="Catálogo" />
                  <Tab active={leftTab === 'history'} onClick={() => setLeftTab('history')} icon={<History size={13} />} label="Histórico" />
                </div>
                <div className="flex-1 overflow-hidden">
                  {leftTab === 'elements' ? <ElementsPanel /> : leftTab === 'templates' ? <TemplatesPanel /> : leftTab === 'layers' ? <LayersPanel /> : leftTab === 'catalog' ? <CatalogPanel /> : <HistoryPanel />}
                </div>
                <div className="flex items-center border-t border-zinc-800">
                  <button
                    onClick={() => setLeftPanelOpen(false)}
                    className="flex flex-1 items-center justify-center gap-2 py-2 text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300"
                  >
                    <PanelLeftClose size={14} /> Ocultar painel
                  </button>
                  <span className="pr-3 text-[9px] tabular-nums text-zinc-700">{Math.round(leftWidth)}px</span>
                </div>
              </div>
              <ResizeHandle side="left" onPointerDown={(e) => beginResize('left', e)} />
            </>
          )}

          {!leftPanelOpen && (
            <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-zinc-800 py-2">
              <IconButton onClick={() => setLeftPanelOpen(true)} title="Mostrar painel"><PanelLeftOpen size={16} /></IconButton>
              <IconButton onClick={() => { setLeftPanelOpen(true); setLeftTab('elements'); }} title="Elementos"><Box size={16} /></IconButton>
              <IconButton onClick={() => { setLeftPanelOpen(true); setLeftTab('templates'); }} title="Modelos"><LayoutTemplate size={16} /></IconButton>
              <IconButton onClick={() => { setLeftPanelOpen(true); setLeftTab('layers'); }} title="Camadas"><Layers size={16} /></IconButton>
              <IconButton onClick={() => { setLeftPanelOpen(true); setLeftTab('catalog'); }} title="Catálogo"><PackageSearch size={16} /></IconButton>
              <IconButton onClick={() => { setLeftPanelOpen(true); setLeftTab('history'); }} title="Histórico"><History size={16} /></IconButton>
            </div>
          )}

          <Canvas guides={guides} setGuides={setGuides} />

          {rightPanelOpen ? (
            <>
              <ResizeHandle side="right" onPointerDown={(e) => beginResize('right', e)} />
              <div className="flex shrink-0 flex-col" style={{ width: rightWidth }}>
                <PropertiesPanel />
                <div className="flex items-center border-l border-t border-zinc-800">
                  <span className="pl-3 text-[9px] tabular-nums text-zinc-700">{Math.round(rightWidth)}px</span>
                  <button
                    onClick={() => setRightPanelOpen(false)}
                    className="flex flex-1 items-center justify-center gap-2 py-2 text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300"
                  >
                    <PanelRightClose size={14} /> Ocultar propriedades
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex w-10 shrink-0 flex-col items-center border-l border-zinc-800 py-2">
              <IconButton onClick={() => setRightPanelOpen(true)} title="Mostrar propriedades"><PanelRightOpen size={16} /></IconButton>
            </div>
          )}
        </div>
      )}

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-950 px-3 text-[10px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span>Dispositivo: <span className="capitalize text-zinc-300">{state.device}</span></span>
          <span>Modo: <span className="text-zinc-300">{state.mode === 'beginner' ? 'Simples' : 'Profissional'}</span></span>
          <span>Grade: <span className={state.gridEnabled ? 'text-green-400' : 'text-zinc-600'}>{state.gridEnabled ? 'ATIVA' : 'DESATIVADA'}</span></span>
          <span>Guias: <span className={state.smartGuidesEnabled ? 'text-green-400' : 'text-zinc-600'}>{state.smartGuidesEnabled ? 'ATIVAS' : 'DESATIVADAS'}</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span>{state.selectedIds.length} selecionado(s)</span>
          <span>Zoom: {Math.round(state.zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

function ResizeHandle({ side, onPointerDown }: { side: 'left' | 'right'; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      title="Arraste para ajustar a largura do painel"
      className={`group relative z-40 w-1 shrink-0 cursor-col-resize bg-zinc-950 hover:bg-blue-500/40 ${side === 'right' ? 'border-l border-zinc-800' : 'border-r border-zinc-800'}`}
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-blue-400" />
    </div>
  );
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-[68px] flex-1 items-center justify-center gap-1 whitespace-nowrap px-2 py-2 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
        active ? 'border-b-2 border-blue-500 bg-zinc-900/50 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {icon} <span>{label}</span>
    </button>
  );
}

function IconButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
      {children}
    </button>
  );
}

export default function App() {
  return (
    <EditorProvider>
      <EditorShell />
    </EditorProvider>
  );
}
