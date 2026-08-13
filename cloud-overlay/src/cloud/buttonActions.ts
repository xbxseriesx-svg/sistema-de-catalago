import type { EditorNode } from '../editor/types';

export function executeNodeAction(node:EditorNode):boolean{
  if(typeof window==='undefined')return false;
  const type=String(node.props?.actionType||'none');
  const value=String(node.props?.actionValue||'').trim();
  const target=String(node.props?.actionTarget||'same');
  if(type==='url'){
    if(!value||!(value.startsWith('/')||value.startsWith('#')||/^https?:\/\//i.test(value)))return false;
    if(target==='new')window.open(value,'_blank','noopener,noreferrer');else window.location.assign(value);
    return true;
  }
  if(type==='section'){
    if(!value)return false;
    const candidates=Array.from(document.querySelectorAll<HTMLElement>('[data-public-node-id], [data-node-id]'));
    const found=candidates.find(el=>el.dataset.publicNodeId===value||el.dataset.nodeId===value||el.dataset.publicNodeName===value||el.dataset.nodeName===value);
    if(!found)return false;
    found.scrollIntoView({behavior:'smooth',block:'start'});return true;
  }
  if(type==='top'){window.scrollTo({top:0,behavior:'smooth'});return true}
  return false;
}
