import { useState } from 'react';
import { useEditor } from './store';
import { getResponsiveRect, responsivePatch } from './utils';
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Grid3x3,
  Magnet,
  Ruler,
  Eye,
  Download,
  Upload,
  Sparkles,
  Zap,
  MousePointer2,
  Save,
  Rocket,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react';

export function Toolbar() {
  const { state, dispatch, getNode, saveDraft, publish, cloud } = useEditor();
  const [busyAction, setBusyAction] = useState<'save' | 'publish' | null>(null);
  const [actionError, setActionError] = useState('');

  const handleSave = async () => {
    setBusyAction('save'); setActionError('');
    try { await saveDraft(); } catch (err) { setActionError(err instanceof Error ? err.message : 'Falha ao salvar'); } finally { setBusyAction(null); }
  };

  const handlePublish = async () => {
    if (!window.confirm('Publicar este rascunho no site público agora?')) return;
    setBusyAction('publish'); setActionError('');
    try { await publish(); } catch (err) { setActionError(err instanceof Error ? err.message : 'Falha ao publicar'); } finally { setBusyAction(null); }
  };

  const handleExport = () => {
    const data = JSON.stringify({ nodes: state.nodes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asteryon-page-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result as string);
            if (data.nodes && Array.isArray(data.nodes)) {
              dispatch({ type: 'REPLACE_NODES', nodes: data.nodes });
            }
          } catch {
            // ignore parse errors
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const pageNode = state.nodes.find((node) => node.type === 'page');
  const currentPageRect = pageNode ? getResponsiveRect(pageNode, state.device) : { x: 0, y: 0, width: 1440, height: 5200 };
  const resolutionOptions = state.device === 'desktop'
    ? [
        { width: 1366, label: 'HD · 1366 × 768' },
        { width: 1440, label: 'Desktop · 1440 × 900' },
        { width: 1920, label: '1080p / Full HD · 1920 × 1080' },
        { width: 2560, label: '2K / QHD · 2560 × 1440' },
        { width: 3840, label: '4K / UHD · 3840 × 2160' },
      ]
    : state.device === 'tablet'
      ? [{ width: 768, label: 'Tablet · 768 × 1024' }, { width: 834, label: 'Tablet · 834 × 1112' }]
      : [{ width: 360, label: 'Mobile · 360 × 800' }, { width: 390, label: 'Mobile · 390 × 844' }, { width: 430, label: 'Mobile · 430 × 932' }];

  const setPageWidth = (width: number) => {
    if (!pageNode) return;
    dispatch({ type: 'UPDATE_NODE', id: pageNode.id, changes: responsivePatch(pageNode, state.device, { width }) });
  };

  const selectedNodes = state.selectedIds.map((id) => getNode(id)).filter((n): n is NonNullable<typeof n> => n !== null);

  const alignSelected = (type: string) => {
    if (selectedNodes.length < 2) return;
    const rects = selectedNodes.map((n) => ({ node: n, rect: getResponsiveRect(n, state.device) }));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { rect } of rects) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }
    const updates = rects.map(({ node: n, rect }) => {
      let x = rect.x, y = rect.y;
      if (type === 'left') x = minX;
      if (type === 'hcenter') x = (minX + maxX) / 2 - rect.width / 2;
      if (type === 'right') x = maxX - rect.width;
      if (type === 'top') y = minY;
      if (type === 'vcenter') y = (minY + maxY) / 2 - rect.height / 2;
      if (type === 'bottom') y = maxY - rect.height;
      return { id: n.id, changes: responsivePatch(n, state.device, { x: Math.round(x), y: Math.round(y) }) };
    });
    dispatch({ type: 'UPDATE_NODES', updates });
  };

  const distributeSelected = (axis: 'h' | 'v') => {
    if (selectedNodes.length < 3) return;
    const items = selectedNodes.map((node) => ({ node, rect: getResponsiveRect(node, state.device) }));
    const sorted = [...items].sort((a, b) => (axis === 'h' ? a.rect.x - b.rect.x : a.rect.y - b.rect.y));
    const first = sorted[0].rect;
    const last = sorted[sorted.length - 1].rect;
    const totalSpace = axis === 'h' ? last.x + last.width - first.x : last.y + last.height - first.y;
    const totalSize = sorted.reduce((sum, item) => sum + (axis === 'h' ? item.rect.width : item.rect.height), 0);
    const gap = (totalSpace - totalSize) / (sorted.length - 1);
    let pos = axis === 'h' ? first.x : first.y;
    const updates = sorted.map(({ node, rect }) => {
      const changes = axis === 'h'
        ? responsivePatch(node, state.device, { x: Math.round(pos) })
        : responsivePatch(node, state.device, { y: Math.round(pos) });
      pos += (axis === 'h' ? rect.width : rect.height) + gap;
      return { id: node.id, changes };
    });
    dispatch({ type: 'UPDATE_NODES', updates });
  };

  const canAlign = selectedNodes.length >= 2;
  const canDistribute = selectedNodes.length >= 3;

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-3 [scrollbar-width:thin]">
      <div className="flex items-center gap-2 pr-3 mr-1 border-r border-zinc-800">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-bold text-white leading-none tracking-tight">ASTERYON</div>
          <div className="text-[9px] text-zinc-500 leading-none mt-0.5 uppercase tracking-widest">Editor Unificado V4</div>
        </div>
      </div>

      <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
        <DeviceBtn active={state.device === 'desktop'} onClick={() => dispatch({ type: 'SET_DEVICE', device: 'desktop' })} icon={<Monitor size={15} />} title="Desktop" />
        <DeviceBtn active={state.device === 'tablet'} onClick={() => dispatch({ type: 'SET_DEVICE', device: 'tablet' })} icon={<Tablet size={15} />} title="Tablet" />
        <DeviceBtn active={state.device === 'mobile'} onClick={() => dispatch({ type: 'SET_DEVICE', device: 'mobile' })} icon={<Smartphone size={15} />} title="Mobile" />
      </div>

      <select
        value={String(Math.round(currentPageRect.width))}
        onChange={(e) => setPageWidth(Number(e.target.value))}
        title="Resolução de edição do site; a altura da página continua automática"
        className="h-8 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[10px] font-semibold text-zinc-300 outline-none hover:border-zinc-700"
      >
        {resolutionOptions.map((option) => <option key={option.width} value={option.width}>{option.label}</option>)}
      </select>

      <div className="w-px h-6 bg-zinc-800" />
      <ToolbarBtn onClick={() => dispatch({ type: 'UNDO' })} icon={<Undo2 size={16} />} title="Desfazer (Ctrl+Z)" disabled={state.history.past.length === 0} />
      <ToolbarBtn onClick={() => dispatch({ type: 'REDO' })} icon={<Redo2 size={16} />} title="Refazer (Ctrl+Y)" disabled={state.history.future.length === 0} />
      <div className="w-px h-6 bg-zinc-800" />
      <ToolbarBtn onClick={() => dispatch({ type: 'TOGGLE_GRID' })} icon={<Grid3x3 size={16} />} title="Mostrar/ocultar grade" active={state.gridEnabled} />
      <ToolbarBtn onClick={() => dispatch({ type: 'TOGGLE_SNAP' })} icon={<Magnet size={16} />} title="Ativar/desativar encaixe" active={state.snapEnabled} />
      <ToolbarBtn onClick={() => dispatch({ type: 'TOGGLE_SMART_GUIDES' })} icon={<Ruler size={16} />} title="Ativar/desativar guias inteligentes" active={state.smartGuidesEnabled} />

      {(canAlign || canDistribute) && (
        <>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="flex items-center gap-0.5">
            <ToolbarBtn onClick={() => alignSelected('left')} icon={<AlignHorizontalJustifyStart size={15} />} title="Alinhar à esquerda" disabled={!canAlign} small />
            <ToolbarBtn onClick={() => alignSelected('hcenter')} icon={<AlignHorizontalJustifyCenter size={15} />} title="Centralizar horizontal" disabled={!canAlign} small />
            <ToolbarBtn onClick={() => alignSelected('right')} icon={<AlignHorizontalJustifyEnd size={15} />} title="Alinhar à direita" disabled={!canAlign} small />
            <ToolbarBtn onClick={() => alignSelected('top')} icon={<AlignVerticalJustifyStart size={15} />} title="Alinhar ao topo" disabled={!canAlign} small />
            <ToolbarBtn onClick={() => alignSelected('vcenter')} icon={<AlignVerticalJustifyCenter size={15} />} title="Centralizar vertical" disabled={!canAlign} small />
            <ToolbarBtn onClick={() => alignSelected('bottom')} icon={<AlignVerticalJustifyEnd size={15} />} title="Alinhar à base" disabled={!canAlign} small />
            {canDistribute && (
              <>
                <div className="w-px h-4 bg-zinc-800 mx-0.5" />
                <ToolbarBtn onClick={() => distributeSelected('h')} icon={<AlignHorizontalDistributeCenter size={15} />} title="Distribuir horizontalmente" disabled={!canDistribute} small />
                <ToolbarBtn onClick={() => distributeSelected('v')} icon={<AlignVerticalDistributeCenter size={15} />} title="Distribuir verticalmente" disabled={!canDistribute} small />
              </>
            )}
          </div>
        </>
      )}

      <div className="flex-1" />
      <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
        <button onClick={() => dispatch({ type: 'SET_MODE', mode: 'beginner' })} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${state.mode === 'beginner' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}><MousePointer2 size={13} /> Simples</button>
        <button onClick={() => dispatch({ type: 'SET_MODE', mode: 'professional' })} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${state.mode === 'professional' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}><Zap size={13} /> Pro</button>
      </div>
      <div className="w-px h-6 bg-zinc-800" />

      {cloud.enabled && <div className={`hidden max-w-44 truncate text-[9px] lg:block ${cloud.error || actionError ? 'text-red-300' : cloud.loading ? 'text-amber-300' : 'text-emerald-400'}`} title={actionError || cloud.error || ''}>{actionError || cloud.error || (cloud.loading ? 'Carregando D1...' : `D1 · revisão ${cloud.revision ?? '—'}`)}</div>}

      <button onClick={() => void handleSave()} title="Salvar rascunho" className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"><Save size={14} /> {busyAction === 'save' ? 'Salvando...' : 'Salvar'}</button>
      <button onClick={() => dispatch({ type: 'TOGGLE_PREVIEW' })} title="Visualizar como visitante" className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${state.previewMode ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}><Eye size={14} /> {state.previewMode ? 'Sair do Preview' : 'Preview'}</button>
      <button onClick={() => void handlePublish()} title="Publicar versão atual" className="flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[11px] font-bold text-white transition-colors hover:bg-emerald-500"><Rocket size={14} /> {busyAction === 'publish' ? 'Publicando...' : 'Publicar'}</button>
      <div className="w-px h-6 bg-zinc-800" />
      <ToolbarBtn onClick={handleImport} icon={<Upload size={16} />} title="Importar projeto JSON" />
      <ToolbarBtn onClick={handleExport} icon={<Download size={16} />} title="Exportar projeto JSON" />
    </div>
  );
}

function DeviceBtn({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) {
  return <button onClick={onClick} title={title} className={`px-2.5 py-1.5 rounded-md transition-colors ${active ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>{icon}</button>;
}
function ToolbarBtn({ onClick, icon, title, disabled, active, small }: { onClick: () => void; icon: React.ReactNode; title: string; disabled?: boolean; active?: boolean; small?: boolean }) {
  return <button onClick={onClick} disabled={disabled} title={title} className={`${small ? 'w-7 h-7' : 'w-8 h-8'} flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${active ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>{icon}</button>;
}
