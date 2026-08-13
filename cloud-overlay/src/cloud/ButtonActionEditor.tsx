import type { EditorNode } from '../editor/types';
import { useEditor } from '../editor/store';

export function ButtonActionEditor({node}:{node:EditorNode}){
  const {dispatch}=useEditor();
  const prop=(key:string,value:unknown)=>dispatch({type:'UPDATE_NODE_PROP',id:node.id,key,value});
  const style=(key:string,value:unknown)=>dispatch({type:'UPDATE_NODE_STYLE',id:node.id,key,value});
  const type=String(node.props?.actionType||'none');
  return <div className="mt-3 space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">Alinhamento e função</div>
    <select value={String(node.styles.justifyContent||'center')} onChange={e=>{style('display','flex');style('justifyContent',e.target.value);style('textAlign',e.target.value==='flex-start'?'left':e.target.value==='flex-end'?'right':'center')}} className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px]"><option value="flex-start">Esquerda</option><option value="center">Centro</option><option value="flex-end">Direita</option></select>
    <select value={type} onChange={e=>prop('actionType',e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px]"><option value="none">Sem ação</option><option value="url">Abrir link ou página</option><option value="section">Ir para seção</option><option value="top">Voltar ao topo</option></select>
    {type!=='none'&&type!=='top'&&<input value={String(node.props?.actionValue||'')} onChange={e=>prop('actionValue',e.target.value)} placeholder="Destino" className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px]"/>}
    {type==='url'&&<select value={String(node.props?.actionTarget||'same')} onChange={e=>prop('actionTarget',e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px]"><option value="same">Mesma aba</option><option value="new">Nova aba</option></select>}
  </div>;
}
