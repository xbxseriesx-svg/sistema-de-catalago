import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignStartHorizontal, AlignStartVertical, AlignEndVertical,
  Copy, Eye, Grid3x3, Group, Magnet, Monitor, Redo2, Save, Send, Smartphone, Sparkles, Tablet, Trash2, Undo2, Ungroup, Camera,
} from "lucide-react";
import { useAi } from "../ai/aiStore";
import { useEditor } from "../store";
import type { Device, ResolutionPreset } from "../types";
import { RESOLUTION_PRESETS } from "../types";
import { forceEditorSave } from "../usePersistence";
import { createRemoteSnapshot, publishRemotePage } from "../persistence";
import { SessionControl } from "./SessionControl";
import { VersionHistory } from "./VersionHistory";

const btn="inline-flex h-7 items-center gap-1.5 rounded-md border border-ed-border px-2 text-[11px] font-medium text-ed-muted transition-colors hover:border-ed-accent hover:text-ed-ink disabled:opacity-40";
const active="border-ed-accent bg-ed-accent/15 text-ed-ink";

export function Toolbar(){
 const s=useEditor(); const aiOpen=useAi(a=>a.open); const setAiOpen=useAi(a=>a.setOpen); const devices:[Device,typeof Monitor][]=[["desktop",Monitor],["tablet",Tablet],["mobile",Smartphone]];
 const status=s.saveState==="saving"?"Salvando…":s.saveState==="error"?"Local salvo · servidor pendente":s.saveState==="saved"?"Salvo":"Rascunho";
 const zoomFor:Record<ResolutionPreset,number>={"1366x768":.62,"1440x900":.58,"1080p":.45,"2k":.34,"4k":.23};
 return <header className="flex h-12 items-center gap-2 border-b border-ed-border bg-ed-panel px-3">
  <div className="flex items-center gap-2 pr-2"><div className="grid h-6 w-6 place-items-center rounded bg-ed-accent text-[11px] font-black text-white">A</div><span className="text-xs font-semibold tracking-[0.18em] text-ed-ink">ASTERYON V94</span><span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">{status}</span></div>
  <div className="mx-1 h-5 w-px bg-ed-border"/><button className={btn} onClick={s.undo} disabled={!s.past.length}><Undo2 size={13}/></button><button className={btn} onClick={s.redo} disabled={!s.future.length}><Redo2 size={13}/></button>
  <div className="mx-1 h-5 w-px bg-ed-border"/><div className="flex gap-1">{devices.map(([d,Icon])=><button key={d} onClick={()=>s.setDevice(d)} className={`${btn} ${s.device===d?active:""}`} title={d}><Icon size={13}/></button>)}</div>
  {s.device==="desktop"&&<select className="h-7 rounded-md border border-ed-border bg-ed-surface px-2 text-[10px] text-ed-ink" value={s.resolution} onChange={e=>{const r=e.target.value as ResolutionPreset;s.setResolution(r);s.setZoom(zoomFor[r])}}>{(Object.entries(RESOLUTION_PRESETS) as [ResolutionPreset,{label:string}][]).map(([key,v])=><option value={key} key={key}>{v.label}</option>)}</select>}
  <button className={`${btn} ${s.saveAllModes?active:""}`} onClick={()=>s.setSaveAllModes(!s.saveAllModes)} title="Quando ativo, posição e tamanho são replicados nos 3 modos">3 modos</button>
  <button className={btn} onClick={s.applyCurrentFrameToAllModes} disabled={s.selection.length!==1} title="Salvar ajuste atual em todos os modos">Aplicar 3 modos</button>
  <div className="mx-1 h-5 w-px bg-ed-border"/><button className={`${btn} ${s.snap?active:""}`} onClick={()=>s.toggle("snap")}><Magnet size={13}/>Snap</button><button className={`${btn} ${s.grid?active:""}`} onClick={()=>s.toggle("grid")}><Grid3x3 size={13}/>Grade</button>
  <button className={btn} onClick={s.group} disabled={s.selection.length<2}><Group size={13}/></button><button className={btn} onClick={s.ungroup} disabled={!s.selection.length}><Ungroup size={13}/></button><button className={btn} onClick={s.duplicate} disabled={!s.selection.length}><Copy size={13}/></button><button className={btn} onClick={()=>s.remove()} disabled={!s.selection.length}><Trash2 size={13}/></button>
  <div className="hidden 2xl:flex gap-1">{([['left',AlignStartVertical],['hcenter',AlignCenterVertical],['right',AlignEndVertical],['top',AlignStartHorizontal],['vcenter',AlignCenterHorizontal],['bottom',AlignEndHorizontal]] as const).map(([op,Icon])=><button key={op} className={btn} onClick={()=>s.align(op)} disabled={!s.selection.length}><Icon size={13}/></button>)}</div>
  <div className="ml-auto flex items-center gap-2"><button className={`${btn} ${aiOpen?active:""}`} onClick={()=>setAiOpen(!aiOpen)}><Sparkles size={13}/>AI</button><VersionHistory/><SessionControl/><button className={btn} onClick={()=>void forceEditorSave()}><Save size={13}/>Salvar</button><button className={btn} onClick={async()=>{await forceEditorSave();try{await createRemoteSnapshot('Snapshot manual');s.markSaveState('saved',new Date().toISOString())}catch(e){console.warn(e)}}}><Camera size={13}/></button><button className={`${btn} ${s.preview?active:""}`} onClick={()=>s.toggle('preview')}><Eye size={13}/>Preview</button><button className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-600 px-2 text-[11px] font-semibold text-white hover:bg-emerald-500" onClick={async()=>{await forceEditorSave();try{await publishRemotePage();s.markSaveState('saved',new Date().toISOString())}catch(e){s.markSaveState('error');console.error(e)}}}><Send size={13}/>Publicar</button></div>
 </header>;
}
