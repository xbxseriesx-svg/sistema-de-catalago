import { useEffect, useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import { listRemoteSnapshots, loadRemoteDraft, restoreRemoteSnapshot } from "../persistence";
import { useEditor } from "../store";

export function VersionHistory() {
  const [open,setOpen]=useState(false); const [items,setItems]=useState<Array<{id:string;label:string|null;revision:number;created_at:string}>>([]); const [busy,setBusy]=useState(false);
  const load=async()=>{try{setItems(await listRemoteSnapshots() as typeof items)}catch{setItems([])}};
  useEffect(()=>{if(open) void load()},[open]);
  return <><button className="inline-flex h-7 items-center gap-1.5 rounded-md border border-ed-border px-2 text-[11px] text-ed-muted hover:text-ed-ink" onClick={()=>setOpen(true)} title="Histórico"><History size={13}/></button>{open&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/60" onMouseDown={()=>setOpen(false)}><div className="max-h-[70vh] w-[520px] overflow-auto rounded-xl border border-ed-border bg-ed-panel p-4" onMouseDown={e=>e.stopPropagation()}><div className="mb-3 flex justify-between"><b className="text-sm">Histórico e rollback</b><button onClick={()=>setOpen(false)}><X size={16}/></button></div>{items.length===0?<p className="text-xs text-ed-muted">Nenhum snapshot remoto disponível.</p>:<div className="grid gap-2">{items.map(i=><div key={i.id} className="flex items-center justify-between rounded-lg border border-ed-border bg-ed-surface p-2"><div><b className="block text-xs">{i.label||`Revisão ${i.revision}`}</b><span className="text-[10px] text-ed-muted">{new Date(i.created_at).toLocaleString('pt-BR')}</span></div><button disabled={busy} className="inline-flex items-center gap-1 rounded border border-ed-border px-2 py-1 text-[10px]" onClick={async()=>{if(!confirm('Restaurar esta versão? Um snapshot de segurança será criado antes.'))return;setBusy(true);try{await restoreRemoteSnapshot(i.id);const remote=await loadRemoteDraft();if(remote)useEditor.getState().replaceDocument(remote.doc,remote.resolution);setOpen(false);}finally{setBusy(false)}}}><RotateCcw size={12}/>Restaurar</button></div>)}</div>}</div></div>}</>;
}
