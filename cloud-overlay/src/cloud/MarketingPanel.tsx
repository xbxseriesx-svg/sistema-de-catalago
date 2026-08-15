import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, BadgePercent, Eye, ImagePlus, MonitorPlay, Palette, Plus, Save, Trash2, Upload, Video, X } from 'lucide-react';
import { DEFAULT_MARKETING, productionApi, type MarketingConfig } from './productionApi';
import { OffersPanel } from './OffersPanel';
import { PublicMarketingV3 } from '../public/PublicMarketingV3';

const C = 'w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-[10px] text-zinc-100 outline-none focus:border-pink-500';
const B = 'flex items-center justify-center gap-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-[9px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white';
type Tab = 'banner' | 'video' | 'carousel' | 'promotions' | 'theme';

function emit(name: 'asteryon:marketing-live' | 'asteryon:marketing-updated', config: MarketingConfig) {
  window.dispatchEvent(new CustomEvent(name, { detail: config }));
}

export function MarketingPanel() {
  const [config, setConfig] = useState<MarketingConfig>(DEFAULT_MARKETING);
  const [saved, setSaved] = useState<MarketingConfig>(DEFAULT_MARKETING);
  const [tab, setTab] = useState<Tab>('banner');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Carregando configurações de Marketing...');
  const [preview, setPreview] = useState(false);

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(saved), [config, saved]);

  useEffect(() => {
    let active = true;
    productionApi.getMarketing()
      .then(value => {
        if (!active) return;
        setConfig(value);
        setSaved(value);
        setMessage('Marketing carregado do D1.');
        emit('asteryon:marketing-updated', value);
      })
      .catch(error => active && setMessage(error instanceof Error ? error.message : 'Falha ao carregar Marketing.'));
    return () => { active = false; };
  }, []);

  const patch = (key: keyof MarketingConfig, value: Record<string, unknown>) => {
    setConfig(prev => {
      const next = { ...prev, [key]: { ...(prev as any)[key], ...value } } as MarketingConfig;
      emit('asteryon:marketing-live', next);
      return next;
    });
  };

  const persist = async (next: MarketingConfig, successMessage = 'Configurações salvas com sucesso.') => {
    const written = await productionApi.saveMarketing(next);
    const verified = await productionApi.getMarketing();
    setConfig(verified);
    setSaved(verified);
    emit('asteryon:marketing-updated', verified);
    if (JSON.stringify(written) !== JSON.stringify(verified)) {
      setMessage('Configuração gravada e recarregada do D1 com normalização aplicada.');
    } else {
      setMessage(successMessage);
    }
    return verified;
  };

  const save = async () => {
    setBusy(true);
    setMessage('Salvando e validando no D1...');
    try {
      await persist(config);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar Marketing.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setConfig(saved);
    emit('asteryon:marketing-live', saved);
    setMessage('Alterações não salvas foram descartadas.');
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>, kind: 'banner' | 'video' | 'carousel') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(`Enviando ${file.name}...`);
    try {
      let next = config;
      if (kind === 'banner') {
        const isVideo = file.type.startsWith('video/');
        const media = await productionApi.uploadMedia(file, isVideo ? 'marketing-video' : 'marketing-banner', 'main');
        next = { ...config, banner: { ...config.banner, mediaUrl: media.url, mediaType: isVideo ? 'video' : 'image' } };
      } else if (kind === 'video') {
        const media = await productionApi.uploadMedia(file, 'marketing-video', 'video-banner');
        next = { ...config, videoBanner: { ...config.videoBanner, mediaUrl: media.url } };
      } else {
        const id = crypto.randomUUID();
        const media = await productionApi.uploadMedia(file, 'carousel-image', id);
        next = { ...config, carousel: { ...config.carousel, items: [...config.carousel.items, { id, url: media.url, link: '', alt: file.name }] } };
      }
      emit('asteryon:marketing-live', next);
      setConfig(next);
      await persist(next, 'Mídia enviada, vinculada e confirmada no D1.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha no upload.');
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => setConfig(prev => {
    const items = [...prev.carousel.items];
    const target = index + direction;
    if (target < 0 || target >= items.length) return prev;
    [items[index], items[target]] = [items[target], items[index]];
    const next = { ...prev, carousel: { ...prev.carousel, items } };
    emit('asteryon:marketing-live', next);
    return next;
  });

  const remove = (index: number) => setConfig(prev => {
    const next = { ...prev, carousel: { ...prev.carousel, items: prev.carousel.items.filter((_, i) => i !== index) } };
    emit('asteryon:marketing-live', next);
    return next;
  });

  return <div className="rounded-xl border border-zinc-800 bg-zinc-900">
    <div className="border-b border-zinc-800 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2"><MonitorPlay size={14} className="text-pink-400"/><div><h3 className="text-xs font-bold text-zinc-100">Marketing</h3><p className="text-[9px] text-zinc-500">Banner, vídeo, carrossel, promoções e identidade visual.</p></div></div>
        <span className={`rounded-full px-2 py-1 text-[8px] font-black ${dirty ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{dirty ? 'PENDENTE' : 'D1 OK'}</span>
      </div>
      {message && <div className="mt-2 rounded border border-zinc-800 bg-zinc-950 p-2 text-[9px] text-zinc-300">{message}</div>}
      <div className="mt-3 grid grid-cols-5 gap-1">{([['banner','Banner',ImagePlus],['video','Vídeo',Video],['carousel','Carrossel',MonitorPlay],['promotions','Promoções',BadgePercent],['theme','Tema',Palette]] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded text-[8px] font-bold ${tab === id ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-200'}`}><Icon size={11}/>{label}</button>)}</div>
    </div>

    {tab === 'promotions' ? <div className="p-2"><OffersPanel/></div> : <div className="p-3">
      {tab === 'banner' && <Banner config={config} patch={patch} upload={upload} busy={busy}/>} 
      {tab === 'video' && <VideoBanner config={config} patch={patch} upload={upload} busy={busy}/>} 
      {tab === 'carousel' && <Carousel config={config} patch={patch} upload={upload} busy={busy} move={move} remove={remove}/>} 
      {tab === 'theme' && <Theme config={config} patch={patch}/>} 
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button disabled={busy || !dirty} onClick={() => void save()} className="flex items-center justify-center gap-1 rounded bg-pink-600 py-2 text-[10px] font-bold text-white disabled:opacity-40"><Save size={11}/>Salvar</button>
        <button disabled={busy || !dirty} onClick={cancel} className={`${B} disabled:opacity-40`}><X size={11}/>Cancelar</button>
        <button onClick={() => setPreview(v => !v)} className={`${B} ${preview ? 'border-pink-500 text-pink-300' : ''}`}><Eye size={11}/>{preview ? 'Fechar prévia' : 'Prévia'}</button>
      </div>
      {preview && <Preview config={config}/>} 
    </div>}
  </div>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/50 px-2 py-2 text-[9px] text-zinc-400"><span>{label}</span><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="accent-pink-500"/></label>;
}

function Banner({ config, patch, upload, busy }: { config: MarketingConfig; patch: any; upload: any; busy: boolean }) {
  const b = config.banner;
  return <div><Title icon={<ImagePlus size={12}/>} text="Banner principal"/>
    <div className="mt-2 grid grid-cols-2 gap-2"><Toggle label="Ativo" value={b.active} onChange={v => patch('banner', { active: v })}/><select className={C} value={b.mediaType} onChange={e => patch('banner', { mediaType: e.target.value })}><option value="image">Imagem</option><option value="video">Vídeo</option></select></div>
    <label className={`${B} mt-2 cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><Upload size={11}/>Importar imagem ou vídeo<input hidden type="file" accept="image/*,video/*" onChange={e => upload(e, 'banner')}/></label>
    {b.mediaUrl && <MediaPreview url={b.mediaUrl} video={b.mediaType === 'video'}/>}<input className={`${C} mt-2`} value={b.title} onChange={e => patch('banner', { title: e.target.value })} placeholder="Título"/><input className={`${C} mt-2`} value={b.subtitle} onChange={e => patch('banner', { subtitle: e.target.value })} placeholder="Subtítulo"/><input className={`${C} mt-2`} value={b.link} onChange={e => patch('banner', { link: e.target.value })} placeholder="Link"/>
    {b.mediaType === 'video' && <div className="mt-2 grid grid-cols-3 gap-1"><Toggle label="Auto" value={b.autoplay} onChange={v => patch('banner', { autoplay: v })}/><Toggle label="Loop" value={b.loop} onChange={v => patch('banner', { loop: v })}/><Toggle label="Mudo" value={b.muted} onChange={v => patch('banner', { muted: v })}/></div>}
  </div>;
}

function VideoBanner({ config, patch, upload, busy }: { config: MarketingConfig; patch: any; upload: any; busy: boolean }) {
  const v = config.videoBanner;
  return <div><Title icon={<Video size={12}/>} text="Banner de vídeo"/><Toggle label="Ativar vídeo" value={v.active} onChange={value => patch('videoBanner', { active: value })}/><label className={`${B} mt-2 cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><Upload size={11}/>Upload de vídeo<input hidden type="file" accept="video/*" onChange={e => upload(e, 'video')}/></label>{v.mediaUrl && <MediaPreview url={v.mediaUrl} video/>}<input className={`${C} mt-2`} value={v.title} onChange={e => patch('videoBanner', { title: e.target.value })} placeholder="Título"/><input className={`${C} mt-2`} value={v.subtitle} onChange={e => patch('videoBanner', { subtitle: e.target.value })} placeholder="Subtítulo"/><div className="mt-2 grid grid-cols-2 gap-1"><Toggle label="Reprodução automática" value={v.autoplay} onChange={value => patch('videoBanner', { autoplay: value })}/><Toggle label="Loop infinito" value={v.loop} onChange={value => patch('videoBanner', { loop: value })}/><Toggle label="Áudio mudo" value={v.muted} onChange={value => patch('videoBanner', { muted: value })}/><Toggle label="Controles" value={v.controls} onChange={value => patch('videoBanner', { controls: value })}/></div></div>;
}

function Carousel({ config, patch, upload, busy, move, remove }: { config: MarketingConfig; patch: any; upload: any; busy: boolean; move: (index: number, direction: -1 | 1) => void; remove: (index: number) => void }) {
  const c = config.carousel;
  return <div><Title icon={<MonitorPlay size={12}/>} text="Carrossel"/><div className="mt-2 grid grid-cols-2 gap-2"><Toggle label="Ativo" value={c.active} onChange={v => patch('carousel', { active: v })}/><select className={C} value={String(c.speed)} onChange={e => patch('carousel', { speed: Number(e.target.value) })}><option value="1">1x</option><option value="1.5">1,5x</option><option value="2">2x</option></select></div><div className="mt-2 grid grid-cols-3 gap-1"><Toggle label="Loop" value={c.loop} onChange={v => patch('carousel', { loop: v })}/><Toggle label="Auto" value={c.autoplay} onChange={v => patch('carousel', { autoplay: v })}/><Toggle label="Manual" value={c.manual} onChange={v => patch('carousel', { manual: v })}/></div><label className={`${B} mt-2 cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><Plus size={11}/>Adicionar imagem<input hidden type="file" accept="image/*" onChange={e => upload(e, 'carousel')}/></label>
    {c.items.length === 0 && <div className="mt-2 rounded border border-dashed border-zinc-700 p-3 text-center text-[9px] text-zinc-500">Nenhuma imagem no carrossel.</div>}
    <div className="mt-2 space-y-1">{c.items.map((item, index) => <div key={item.id} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950/50 p-2"><img src={item.url} alt={item.alt} className="h-12 w-16 rounded bg-white object-contain"/><div className="min-w-0 flex-1"><input className={C} value={item.alt} onChange={e => patch('carousel', { items: c.items.map((x, i) => i === index ? { ...x, alt: e.target.value } : x) })} placeholder="Descrição"/><input className={`${C} mt-1`} value={item.link} onChange={e => patch('carousel', { items: c.items.map((x, i) => i === index ? { ...x, link: e.target.value } : x) })} placeholder="Link"/></div><div className="grid gap-1"><button disabled={index === 0} onClick={() => move(index, -1)} className="text-zinc-500 disabled:opacity-20"><ArrowUp size={11}/></button><button disabled={index === c.items.length - 1} onClick={() => move(index, 1)} className="text-zinc-500 disabled:opacity-20"><ArrowDown size={11}/></button><button onClick={() => remove(index)} className="text-red-400"><Trash2 size={11}/></button></div></div>)}</div>
  </div>;
}

function Theme({ config, patch }: { config: MarketingConfig; patch: any }) {
  const t = config.theme;
  const colors = [['primary','Cor principal'],['secondary','Cor secundária'],['background','Fundo'],['surface','Superfície'],['text','Texto']] as const;
  return <div><Title icon={<Palette size={12}/>} text="Tema e cores"/><select className={`${C} mt-2`} value={t.mode} onChange={e => { const mode = e.target.value as MarketingConfig['theme']['mode']; if (mode === 'light') patch('theme', { mode, background: '#ffffff', surface: '#f4f4f5', text: '#18181b' }); else if (mode === 'dark') patch('theme', { mode, background: '#09090b', surface: '#18181b', text: '#fafafa' }); else patch('theme', { mode }); }}><option value="light">Claro</option><option value="dark">Escuro</option><option value="custom">Personalizado</option></select><div className="mt-2 grid grid-cols-2 gap-2">{colors.map(([key,label]) => <label key={key} className="rounded border border-zinc-800 bg-zinc-950/50 p-2"><span className="mb-1 block text-[9px] text-zinc-500">{label}</span><div className="flex items-center gap-2"><input type="color" value={t[key]} onChange={e => patch('theme', { mode: 'custom', [key]: e.target.value })} className="h-9 w-11 cursor-pointer rounded border-0 bg-transparent"/><input className={C} value={t[key]} onChange={e => patch('theme', { mode: 'custom', [key]: e.target.value })}/></div></label>)}</div><div className="mt-3 rounded-lg p-4" style={{ background: t.background, color: t.text, border: `1px solid ${t.primary}` }}><div className="font-bold" style={{ color: t.primary }}>Visualização em tempo real</div><p className="mt-1 text-xs">As cores abaixo são as mesmas usadas pela prévia e pelo Marketing público.</p><button className="mt-3 rounded px-3 py-2 text-xs font-bold text-white" style={{ background: t.primary }}>Botão principal</button></div></div>;
}

function Preview({ config }: { config: MarketingConfig }) {
  const hasContent = config.banner.active || config.videoBanner.active || (config.carousel.active && config.carousel.items.length > 0);
  return <div className="mt-3 overflow-hidden rounded-lg border border-pink-500/30 shadow-inner" style={{ background: config.theme.background, color: config.theme.text }}>
    <div className="flex items-center justify-between border-b border-black/10 px-2 py-1.5 text-[8px] font-black uppercase"><span>Pré-visualização ao vivo</span><span style={{ color: config.theme.primary }}>Tema: {config.theme.mode}</span></div>
    <div className="max-h-[520px] overflow-y-auto" onClick={event => event.preventDefault()}>
      {hasContent ? <PublicMarketingV3 config={config}/> : <div className="p-5 text-center text-[10px] opacity-60">Ative um Banner, Banner de Vídeo ou Carrossel para visualizar o resultado.</div>}
    </div>
  </div>;
}

function MediaPreview({ url, video = false }: { url: string; video?: boolean }) {
  return <div className="mt-2 overflow-hidden rounded border border-zinc-800 bg-black">{video ? <video src={url} controls playsInline className="max-h-40 w-full object-contain"/> : <img src={url} alt="Prévia" className="max-h-40 w-full bg-white object-contain"/>}</div>;
}

function Title({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-300">{icon}{text}</div>;
}
