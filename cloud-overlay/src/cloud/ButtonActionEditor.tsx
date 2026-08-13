import type { EditorNode } from '../editor/types';
import { useEditor } from '../editor/store';

const inputClass='w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-200 outline-none focus:border-blue-500';

export function ButtonActionEditor({node}:{node:EditorNode}){
  const {dispatch}=useEditor();
  const prop=(key:string,value:unknown)=>dispatch({type:'UPDATE_NODE_PROP',id:node.id,key,value});
  const style=(key:string,value:unknown)=>dispatch({type:'UPDATE_NODE_STYLE',id:node.id,key,value});
  const type=String(node.props?.actionType||'none');
  return <div className="mt-3 space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">Alinhamento e função</div>
    <label className="block"><span className="mb-1 block text-[9px] text-zinc-500">Alinhamento do texto</span><select value={String(node.styles.justifyContent||'center')} onChange={e=>{style('display','flex');style('alignItems','center');style('justifyContent',e.target.value);style('textAlign',e.target.value==='flex-start'?'left':e.target.value==='flex-end'?'right':'center')}} className={inputClass}><option value="flex-start">Esquerda</option><option value="center">Centro</option><option value="flex-end">Direita</option></select></label>
    <label className="block"><span className="mb-1 block text-[9px] text-zinc-500">Função ao clicar</span><select value={type} onChange={e=>prop('actionType',e.target.value)} className={inputClass}><option value="none">Sem função</option><option value="url">Abrir link / página</option><option value="whatsapp">Abrir WhatsApp</option><option value="phone">Ligar</option><option value="email">Enviar e-mail</option><option value="top">Voltar ao topo</option></select></label>
    {type!=='none'&&type!=='top'&&<label className="block"><span className="mb-1 block text-[9px] text-zinc-500">Destino</span><input value={String(node.props?.actionValue||'')} onChange={e=>prop('actionValue',e.target.value)} placeholder={type==='url'?'/pagina, #secao ou https://...':type==='whatsapp'?'5527999999999':type==='email'?'contato@empresa.com.br':'+55 27 99999-9999'} className={inputClass}/></label>}
    {(type==='whatsapp'||type==='email')&&<label className="block"><span className="mb-1 block text-[9px] text-zinc-500">Mensagem / assunto</span><input value={String(node.props?.actionMessage||'')} onChange={e=>prop('actionMessage',e.target.value)} className={inputClass}/></label>}
    {type==='url'&&<label className="block"><span className="mb-1 block text-[9px] text-zinc-500">Abrir em</span><select value={String(node.props?.actionTarget||'same')} onChange={e=>prop('actionTarget',e.target.value)} className={inputClass}><option value="same">Mesma aba</option><option value="new">Nova aba</option></select></label>}
    <p className="text-[9px] leading-relaxed text-zinc-500">Você define a função do botão aqui e pode testar no Preview antes de publicar.</p>
  </div>;
}
