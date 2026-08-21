import { useEditor } from "../store";
import { frameOf } from "../geometry";
import type { EditorNode } from "../types";
import { uploadEditorMedia } from "../persistence";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-[10px] uppercase tracking-wider text-ed-muted">{label}</span>
      <div className="flex w-[132px] shrink-0 items-center gap-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded border border-ed-border bg-ed-surface px-1.5 py-1 text-[11px] text-ed-ink outline-none focus:border-ed-accent";

function Num({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      className={inputCls}
      value={Math.round(value)}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ed-border px-3 py-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ed-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

const TEXT_TYPES = ["text", "heading", "paragraph", "productName", "productBrand", "productPrice"];
const BUTTON_TYPES = ["button", "productButton"];
const IMAGE_TYPES = ["image", "productImage"];
const MARKETING_MEDIA = ["banner", "hero", "carousel", "promotion", "video"];

export function PropertiesPanel() {
  const doc = useEditor((s) => s.doc);
  const device = useEditor((s) => s.device);
  const mode = useEditor((s) => s.mode);
  const selection = useEditor((s) => s.selection);
  const updateFrame = useEditor((s) => s.updateFrame);
  const updateNode = useEditor((s) => s.updateNode);
  const updateStyle = useEditor((s) => s.updateStyle);
  const updateProps = useEditor((s) => s.updateProps);
  const commit = useEditor((s) => s.commit);
  const applyCurrentFrameToAllModes = useEditor((s) => s.applyCurrentFrameToAllModes);

  const node: EditorNode | undefined =
    selection.length === 1 ? doc.nodes[selection[0]!] : doc.nodes[doc.rootId];
  if (!node) return null;
  const isPage = node.id === doc.rootId;
  const f = frameOf(node, device);
  const st = node.styles;
  const pro = mode === "pro";

  const style = (patch: Record<string, unknown>) => {
    commit();
    updateStyle(node.id, patch);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-ed-border px-3 py-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-ed-muted">
          {selection.length > 1 ? "Múltipla seleção" : node.type}
        </p>
        <p className="truncate text-sm font-semibold text-ed-ink">
          {selection.length > 1 ? `${selection.length} elementos` : node.name}
        </p>
      </div>

      {!isPage && (
        <Section title={`Posição · ${device}`}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <Num value={f.x} onChange={(v) => updateFrame(node.id, { x: v })} />
            </Field>
            <Field label="Y">
              <Num value={f.y} onChange={(v) => updateFrame(node.id, { y: v })} />
            </Field>
            <Field label="L">
              <Num value={f.width} onChange={(v) => updateFrame(node.id, { width: v })} />
            </Field>
            <Field label="A">
              <Num value={f.height} onChange={(v) => updateFrame(node.id, { height: v })} />
            </Field>
          </div>
          {pro && (
            <>
              <Field label="Rotação">
                <Num value={node.rotation} onChange={(v) => updateNode(node.id, { rotation: v })} />
              </Field>
              <Field label="zIndex">
                <Num value={node.zIndex} onChange={(v) => updateNode(node.id, { zIndex: v })} />
              </Field>
            </>
          )}
          <Field label="Opacidade">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={node.opacity}
              onChange={(e) => updateNode(node.id, { opacity: Number(e.target.value) })}
              className="w-full accent-ed-accent"
            />
          </Field>
        </Section>
      )}

      {!isPage && (
        <div className="border-b border-ed-border px-3 pb-3">
          <button className="w-full rounded border border-ed-accent/50 bg-ed-accent/10 px-2 py-1.5 text-[10px] font-semibold text-ed-ink" onClick={applyCurrentFrameToAllModes}>
            Salvar ajuste atual em todos os modos
          </button>
        </div>
      )}

      {isPage && (
        <Section title="Página">
          <Field label="Fundo">
            <input
              type="color"
              className="h-6 w-full rounded border border-ed-border bg-transparent"
              value={String(st["background"] ?? "#ffffff")}
              onChange={(e) => style({ background: e.target.value })}
            />
          </Field>
          <Field label="Gradiente">
            <input
              className={inputCls}
              placeholder="linear-gradient(...)"
              onBlur={(e) => e.target.value && style({ background: e.target.value })}
            />
          </Field>
          <Field label="Largura">
            <Num value={f.width} onChange={(v) => updateFrame(node.id, { width: v })} />
          </Field>
          <Field label="Altura">
            <Num value={f.height} onChange={(v) => updateFrame(node.id, { height: v })} />
          </Field>
        </Section>
      )}

      {TEXT_TYPES.includes(node.type) && (
        <Section title="Texto">
          <Field label="Conteúdo">
            <input
              className={inputCls}
              value={String(node.props["text"] ?? "")}
              onChange={(e) => updateProps(node.id, { text: e.target.value })}
            />
          </Field>
          <Field label="Tamanho">
            <Num value={Number(st["fontSize"] ?? 16)} onChange={(v) => style({ fontSize: v })} />
          </Field>
          <Field label="Peso">
            <select
              className={inputCls}
              value={String(st["fontWeight"] ?? 400)}
              onChange={(e) => style({ fontWeight: Number(e.target.value) })}
            >
              {[300, 400, 500, 600, 700, 800].map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cor">
            <input
              type="color"
              className="h-6 w-full rounded border border-ed-border bg-transparent"
              value={String(st["color"] ?? "#0f172a")}
              onChange={(e) => style({ color: e.target.value })}
            />
          </Field>
          <Field label="Alinhar">
            <div className="flex w-full gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => style({ textAlign: a })}
                  className={`flex-1 rounded border px-1 py-0.5 text-[10px] ${
                    st["textAlign"] === a
                      ? "border-ed-accent text-ed-ink"
                      : "border-ed-border text-ed-muted"
                  }`}
                >
                  {a[0]?.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>
          {pro && (
            <>
              <Field label="Entrelinha">
                <Num
                  value={Number(st["lineHeight"] ?? 1.3) * 100}
                  onChange={(v) => style({ lineHeight: v / 100 })}
                />
              </Field>
              <Field label="Sombra">
                <input
                  className={inputCls}
                  placeholder="0 2px 8px #0003"
                  value={String(st["textShadow"] ?? "")}
                  onChange={(e) => updateStyle(node.id, { textShadow: e.target.value })}
                />
              </Field>
            </>
          )}
        </Section>
      )}

      {IMAGE_TYPES.includes(node.type) && (
        <Section title="Imagem">
          <Field label="URL">
            <input
              className={inputCls}
              value={String(node.props["src"] ?? "")}
              onChange={(e) => updateProps(node.id, { src: e.target.value })}
            />
          </Field>
          <Field label="Radius">
            <Num value={Number(st["radius"] ?? 10)} onChange={(v) => style({ radius: v })} />
          </Field>
          <Field label="Borda">
            <Num
              value={Number(st["borderWidth"] ?? 0)}
              onChange={(v) => style({ borderWidth: v })}
            />
          </Field>
          <Field label="Sombra">
            <input
              className={inputCls}
              placeholder="0 10px 30px #0002"
              value={String(st["shadow"] ?? "")}
              onChange={(e) => updateStyle(node.id, { shadow: e.target.value })}
            />
          </Field>
        </Section>
      )}

      {BUTTON_TYPES.includes(node.type) && (
        <Section title="Botão">
          <Field label="Rótulo">
            <input
              className={inputCls}
              value={String(node.props["label"] ?? "")}
              onChange={(e) => updateProps(node.id, { label: e.target.value })}
            />
          </Field>
          <Field label="Fundo">
            <input
              type="color"
              className="h-6 w-full rounded border border-ed-border bg-transparent"
              value={String(st["background"] ?? "#1f6feb")}
              onChange={(e) => style({ background: e.target.value })}
            />
          </Field>
          <Field label="Texto">
            <input
              type="color"
              className="h-6 w-full rounded border border-ed-border bg-transparent"
              value={String(st["color"] ?? "#ffffff")}
              onChange={(e) => style({ color: e.target.value })}
            />
          </Field>
          <Field label="Radius">
            <Num value={Number(st["radius"] ?? 10)} onChange={(v) => style({ radius: v })} />
          </Field>
          {pro && (
            <Field label="Hover">
              <input
                className={inputCls}
                placeholder="#1852c9"
                value={String(st["hoverBackground"] ?? "")}
                onChange={(e) => updateStyle(node.id, { hoverBackground: e.target.value })}
              />
            </Field>
          )}
        </Section>
      )}

      {!isPage && !TEXT_TYPES.includes(node.type) && !BUTTON_TYPES.includes(node.type) && (
        <Section title="Aparência">
          <Field label="Fundo">
            <input
              type="color"
              className="h-6 w-full rounded border border-ed-border bg-transparent"
              value={String(st["background"] ?? "#ffffff")}
              onChange={(e) => style({ background: e.target.value })}
            />
          </Field>
          <Field label="Radius">
            <Num value={Number(st["radius"] ?? 0)} onChange={(v) => style({ radius: v })} />
          </Field>
        </Section>
      )}

      {MARKETING_MEDIA.includes(node.type) && (
        <Section title="Mídia / Marketing">
          {["image","productImage","video","banner","hero"].includes(node.type) && <>
            <Field label="URL">
              <input className={inputCls} value={String(node.props["src"] ?? "")} onChange={(e)=>updateProps(node.id,{src:e.target.value})}/>
            </Field>
            <Field label="Upload">
              <input type="file" className="w-full text-[9px] text-ed-muted" accept={node.type === "video" ? "video/*" : "image/*"} onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;try{const url=await uploadEditorMedia(file,node.type,node.id);commit();updateProps(node.id,{src:url})}catch(err){window.alert(err instanceof Error?err.message:"Falha no upload")}}}/>
            </Field>
          </>}
          {node.type === "carousel" && <>
            <Field label="Slides">
              <textarea className={`${inputCls} min-h-20`} placeholder="1 URL por linha" value={((node.props["images"] as string[]|undefined)??[]).join("\n")} onChange={(e)=>updateProps(node.id,{images:e.target.value.split(/\n+/).map(v=>v.trim()).filter(Boolean)})}/>
            </Field>
            <Field label="Upload">
              <input type="file" className="w-full text-[9px] text-ed-muted" accept="image/*" multiple onChange={async(e)=>{const files=Array.from(e.target.files??[]);if(!files.length)return;try{const urls=[];for(const file of files)urls.push(await uploadEditorMedia(file,node.type,node.id));commit();updateProps(node.id,{images:[...((node.props["images"] as string[]|undefined)??[]),...urls]})}catch(err){window.alert(err instanceof Error?err.message:"Falha no upload")}}}/>
            </Field>
            <Field label="Intervalo">
              <Num value={Number(node.props["interval"] ?? 5000)} onChange={(v)=>updateProps(node.id,{interval:Math.max(2000,v)})}/>
            </Field>
          </>}
          {node.type === "promotion" && <>
            <Field label="Ação"><input className={inputCls} value={String(node.props["href"]??"")} onChange={e=>updateProps(node.id,{href:e.target.value})}/></Field>
            <Field label="Botão"><input className={inputCls} value={String(node.props["label"]??"")} onChange={e=>updateProps(node.id,{label:e.target.value})}/></Field>
          </>}
          {["image","productImage","video","banner","hero","carousel"].includes(node.type) && <Field label="Ajuste"><select className={inputCls} value={String(node.props["fit"]??"contain")} onChange={e=>updateProps(node.id,{fit:e.target.value})}><option value="contain">Sem corte (contain)</option><option value="cover">Preencher (cover)</option></select></Field>}
        </Section>
      )}

      {pro && !isPage && (
        <Section title="Responsivo">
          <p className="text-[10px] leading-relaxed text-ed-muted">
            Geometria independente por dispositivo. Edite com o dispositivo ativo na barra superior;
            desktop é a base herdada.
          </p>
        </Section>
      )}
    </div>
  );
}
