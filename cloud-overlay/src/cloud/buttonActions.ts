import type { EditorNode } from '../editor/types';

export function executeNodeAction(node:EditorNode):boolean{
  if(typeof window==='undefined')return false;
  const type=String(node.props?.actionType||'none');
  const value=String(node.props?.actionValue||'').trim();
  const message=String(node.props?.actionMessage||'').trim();
  const target=String(node.props?.actionTarget||'same');
  if(type==='url'){
    if(!value||!(value.startsWith('/')||value.startsWith('#')||/^https?:\/\//i.test(value)))return false;
    if(target==='new')window.open(value,'_blank','noopener,noreferrer');else window.location.assign(value);
    return true;
  }
  if(type==='whatsapp'){
    const digits=value.replace(/\D/g,'');if(!digits)return false;
    window.open(`https://wa.me/${digits}${message?`?text=${encodeURIComponent(message)}`:''}`,'_blank','noopener,noreferrer');return true;
  }
  if(type==='phone'){
    const phone=value.replace(/[^\d+]/g,'');if(!phone)return false;window.location.href=`tel:${phone}`;return true;
  }
  if(type==='email'){
    if(!value||!value.includes('@'))return false;window.location.href=`mailto:${value}${message?`?subject=${encodeURIComponent(message)}`:''}`;return true;
  }
  if(type==='top'){window.scrollTo({top:0,behavior:'smooth'});return true}
  return false;
}
