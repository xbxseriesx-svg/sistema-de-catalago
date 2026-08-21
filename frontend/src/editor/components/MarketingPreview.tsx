import { useEffect, useMemo, useState } from "react";
import { useEditor } from "../store";

export function MarketingPreview() {
  const doc=useEditor(s=>s.doc);
  const marketing=useMemo(()=>Object.values(doc.nodes).filter(n=>["banner","hero","carousel"].includes(n.type)),[doc]);
  const carousel=marketing.find(n=>n.type==="carousel");
  const banner=marketing.find(n=>n.type==="banner"||n.type==="hero");
  const images=(carousel?.props["images"] as string[]|undefined)??[];
  const [idx,setIdx]=useState(0);
  const autoplay=carousel?.props["autoplay"]!==false;
  const interval=Number(carousel?.props["interval"]??5000);
  useEffect(()=>{if(!carousel||!autoplay||images.length<2)return;const t=window.setInterval(()=>setIdx(i=>(i+1)%images.length),Math.max(2000,interval));return()=>window.clearInterval(t)},[carousel?.id,autoplay,interval,images.length]);
  if(!banner&&!carousel)return null;
  return <div className="border-b border-ed-border bg-ed-panel px-3 py-2"><div className="mx-auto flex max-w-[920px] items-stretch gap-2">
    {banner&&<div className="relative min-h-16 flex-1 overflow-hidden rounded-lg border border-ed-border bg-ed-surface">{banner.props["src"]?<img className="h-20 w-full object-contain" src={String(banner.props["src"])} alt="Banner"/>:<div className="grid h-20 place-items-center text-[10px] uppercase tracking-widest text-ed-muted">Banner / Hero</div>}<span className="absolute bottom-1 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">Marketing</span></div>}
    {carousel&&<div className="relative min-h-16 flex-1 overflow-hidden rounded-lg border border-ed-border bg-ed-surface">{images.length?<img className="h-20 w-full object-contain" src={images[idx%images.length]} alt="Carrossel"/>:<div className="grid h-20 place-items-center text-[10px] uppercase tracking-widest text-ed-muted">Carrossel · adicione imagens</div>}{images.length>1&&<><button className="absolute left-1 top-1/2 -translate-y-1/2 rounded bg-black/60 px-2 text-white" onClick={()=>setIdx(i=>(i-1+images.length)%images.length)}>‹</button><button className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-black/60 px-2 text-white" onClick={()=>setIdx(i=>(i+1)%images.length)}>›</button></>}</div>}
  </div></div>;
}
