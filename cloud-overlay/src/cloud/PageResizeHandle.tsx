import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { EditorNode, ResponsiveRect } from '../editor/types';
import { useEditor } from '../editor/store';
import { responsivePatch } from '../editor/utils';

export function PageResizeHandle({page,pageRect,effectivePageHeight}:{page:EditorNode;pageRect:ResponsiveRect;effectivePageHeight:number}){
  const {state,dispatch}=useEditor();
  const [resizing,setResizing]=useState(false);
  if(state.previewMode)return null;
  const begin=(event:ReactPointerEvent<HTMLDivElement>)=>{
    event.preventDefault();event.stopPropagation();
    const startY=event.clientY,startHeight=pageRect.height,minHeight=480;
    setResizing(true);dispatch({type:'CHECKPOINT'});
    const onMove=(pointer:PointerEvent)=>{
      const delta=(pointer.clientY-startY)/Math.max(state.zoom,0.1);
      const height=Math.min(50000,Math.max(minHeight,Math.round((startHeight+delta)/10)*10));
      dispatch({type:'UPDATE_NODE',id:page.id,changes:{...responsivePatch(page,state.device,{height}),props:{...(page.props||{}),autoExtend:false}},skipHistory:true});
    };
    const onUp=()=>{setResizing(false);window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp)};
    window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp,{once:true});
  };
  return <div onPointerDown={begin} title="Arraste para aumentar ou diminuir a altura da página" style={{position:'absolute',left:0,top:Math.max(0,effectivePageHeight-7),width:pageRect.width,height:14,cursor:'ns-resize',zIndex:100000,pointerEvents:'auto'}}>
    <div style={{position:'absolute',left:0,right:0,top:6,height:2,backgroundColor:resizing?'#3b82f6':'rgba(59,130,246,0.45)',boxShadow:resizing?'0 0 0 3px rgba(59,130,246,0.12)':'none'}}/>
    <span style={{position:'absolute',right:12,top:-20,borderRadius:6,background:'rgba(24,24,27,0.94)',border:'1px solid rgba(63,63,70,0.9)',padding:'3px 7px',color:resizing?'#93c5fd':'#a1a1aa',fontSize:10,pointerEvents:'none'}}>↕ Arraste a borda · {Math.round(pageRect.height)}px</span>
  </div>;
}
