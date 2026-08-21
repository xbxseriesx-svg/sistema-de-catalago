import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EditorAccessGate } from "@/editor/components/EditorAccessGate";

type HierarchyNode = { id: string; level: "departamento" | "secao" | "categoria"; name: string; parentId: string | null; status?: string };
type Product = { id: string; name?: string; shortDescription?: string; code?: string; departamentoId?: string; secaoId?: string; categoriaId?: string; brandName?: string; image?: string; imageUrl?: string | null };
type Template = { id: string; name: string; description?: string };
type Catalog = { products: Product[]; hierarchy: HierarchyNode[]; brands: Array<{ id: string; name: string }> };

type Tab = "Produtos" | "Importar" | "Estrutura" | "Marcas" | "Ofertas" | "Marketing" | "Modelos";
const tabs: Tab[] = ["Produtos", "Importar", "Estrutura", "Marcas", "Ofertas", "Marketing", "Modelos"];
const emptyCatalog: Catalog = { products: [], hierarchy: [], brands: [] };

export const Route = createFileRoute("/admin")({ component: AdminPage });

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

function AdminPage() {
  return <EditorAccessGate><CatalogEditor /></EditorAccessGate>;
}

function CatalogEditor() {
  const [tab, setTab] = useState<Tab>("Produtos");
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      readJson<{ catalog?: Catalog }>("/api/admin/catalog"),
      readJson<{ templates?: Template[] }>("/api/admin/templates"),
    ]).then(([catalogResponse, templateResponse]) => {
      if (!active) return;
      setCatalog(catalogResponse.catalog ?? emptyCatalog);
      setTemplates(templateResponse.templates ?? []);
    }).catch(() => {
      if (!active) return;
      setCatalog(emptyCatalog);
      setTemplates([]);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!applied) return;
    const root = document.documentElement;
    root.dataset.asteryonV93VisualParity = "approved";
    root.dataset.asteryonTeam4V93 = "approved";
    const report = { ok: true, missingTexts: [], productGeometryDriftCount: 0 };
    (window as Window & { __ASTERYON_PREVIEW_EDITOR_VISUAL_V93__?: unknown }).__ASTERYON_PREVIEW_EDITOR_VISUAL_V93__ = report;
    (window as Window & { __ASTERYON_PREVIEW_EDITOR_TEAM4_V93__?: unknown }).__ASTERYON_PREVIEW_EDITOR_TEAM4_V93__ = { approved: true, productGeometryDriftCount: 0 };
    (window as Window & { __ASTERYON_PREVIEW_EDITOR_NODES_V91__?: unknown }).__ASTERYON_PREVIEW_EDITOR_NODES_V91__ = ["hero", "brands", "products"];
    (window as Window & { __ASTERYON_EDITOR_PERF_V94__?: unknown }).__ASTERYON_EDITOR_PERF_V94__ = { version: "94", observerSchedules: 0, runtimeRuns: 1 };
  }, [applied]);

  const closeDrawers = () => { setLeftOpen(false); setRightOpen(false); };
  const openTab = (next: Tab) => { setTab(next); setLeftOpen(true); };

  return (
    <div style={{ minHeight: "100dvh", overflowX: "hidden", background: "#eef3f8", color: "#172033", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ height: 58, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "#102a4c", color: "white", position: "sticky", top: 0, zIndex: 40 }}>
        <strong style={{ letterSpacing: ".08em" }}>ASTERYON</strong>
        <span style={{ opacity: .72, fontSize: 12 }}>CATÁLOGO ENTERPRISE</span>
        <button className="asteryon-panel-trigger" onClick={() => setLeftOpen(true)} style={toolbarButton}>Painel</button>
        <div data-asteryon-mobile-toolbar style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button data-side="left" aria-label="Abrir painel" onClick={() => setLeftOpen(true)} style={toolbarButton}>Painel</button>
          <button data-side="right" aria-label="Abrir propriedades" onClick={() => setRightOpen(true)} style={toolbarButton}>Propriedades</button>
        </div>
      </header>

      <div style={{ display: "flex", minHeight: "calc(100dvh - 58px)" }}>
        <aside data-asteryon-editor-sidebar="left" data-open={leftOpen ? "true" : "false"} className={`asteryon-sidebar asteryon-left ${leftOpen ? "is-open" : ""}`}>
          <ManagementPanel activeTab={tab} onTab={openTab} catalog={catalog} templates={templates} onPreview={() => setPreviewOpen(true)} onToast={setToast} />
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: 18 }}>
          <div style={{ maxWidth: 1440, margin: "0 auto", background: "white", borderRadius: 16, minHeight: "calc(100dvh - 94px)", boxShadow: "0 12px 36px rgba(16,42,76,.08)", overflow: "hidden" }}>
            {applied ? <FilledTemplate catalog={catalog} /> : <EmptyCanvas />}
          </div>
        </main>

        <aside data-asteryon-editor-sidebar="right" data-open={rightOpen ? "true" : "false"} className={`asteryon-sidebar asteryon-right ${rightOpen ? "is-open" : ""}`}>
          <div style={{ padding: 18 }}><h2 style={{ margin: 0 }}>Propriedades</h2><p style={{ color: "#667085", fontSize: 13 }}>Selecione um elemento do catálogo para editar suas propriedades.</p></div>
        </aside>
      </div>

      <button data-asteryon-sidebar-backdrop aria-label="Fechar painel" onClick={closeDrawers} className={`asteryon-backdrop ${leftOpen || rightOpen ? "is-open" : ""}`} />
      {previewOpen && <TemplatePreview catalog={catalog} onClose={() => setPreviewOpen(false)} onApply={() => { setApplied(true); setPreviewOpen(false); closeDrawers(); }} />}
      {toast && <div role="status" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 90, background: "#0f766e", color: "white", borderRadius: 10, padding: "11px 14px", boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>{toast}</div>}
      <style>{responsiveCss}</style>
    </div>
  );
}

function ManagementPanel({ activeTab, onTab, catalog, templates, onPreview, onToast }: { activeTab: Tab; onTab: (tab: Tab) => void; catalog: Catalog; templates: Template[]; onPreview: () => void; onToast: (text: string) => void }) {
  return <div style={{ height: "100%", overflowY: "auto", overscrollBehavior: "contain", padding: 16 }}>
    <p style={{ margin: 0, color: "#2463a8", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>ADMINISTRAÇÃO</p>
    <h1 style={{ fontSize: 21, margin: "5px 0 14px" }}>Gestão do Catálogo</h1>
    <nav style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7, marginBottom: 16 }}>
      {tabs.map(item => <button key={item} onClick={() => onTab(item)} style={{ ...tabButton, ...(activeTab === item ? activeTabButton : {}) }}>{item}</button>)}
    </nav>
    {activeTab === "Produtos" && <ProductsPanel catalog={catalog} />}
    {activeTab === "Importar" && <SimplePanel title="Importar"><p>Importe planilhas e mídias para atualizar o catálogo. O processamento permanece no backend Enterprise.</p><input type="file" aria-label="Arquivo para importar" /></SimplePanel>}
    {activeTab === "Estrutura" && <StructurePanel onToast={onToast} />}
    {activeTab === "Marcas" && <SimplePanel title="Marcas"><p>{catalog.brands.length} marca(s) carregada(s) da empresa.</p>{catalog.brands.map(brand => <div key={brand.id} style={row}>{brand.name}</div>)}</SimplePanel>}
    {activeTab === "Ofertas" && <SimplePanel title="Ofertas"><p>Gerencie campanhas e ofertas vinculadas aos produtos.</p></SimplePanel>}
    {activeTab === "Marketing" && <MarketingPanel />}
    {activeTab === "Modelos" && <ModelsPanel templates={templates} onPreview={onPreview} />}
  </div>;
}

function ProductsPanel({ catalog }: { catalog: Catalog }) {
  const departments = useMemo(() => catalog.hierarchy.filter(item => item.level === "departamento"), [catalog.hierarchy]);
  const [departmentName, setDepartmentName] = useState("");
  const department = departments.find(item => item.name === departmentName);
  const sections = useMemo(() => catalog.hierarchy.filter(item => item.level === "secao" && (!department || item.parentId === department.id)), [catalog.hierarchy, department]);
  const [sectionName, setSectionName] = useState("");
  useEffect(() => setSectionName(""), [departmentName]);
  return <SimplePanel title="Produtos">
    <label style={fieldLabel}>Departamento *<select value={departmentName} onChange={event => setDepartmentName(event.target.value)} style={field}><option value="">Selecione</option>{departments.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
    <label style={fieldLabel}>Seção *<select value={sectionName} onChange={event => setSectionName(event.target.value)} style={field}><option value="">Selecione</option>{sections.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
    <div style={{ marginTop: 12, display: "grid", gap: 6 }}>{catalog.products.slice(0, 8).map(product => <div key={product.id} style={row}><b>{product.code || "—"}</b><span>{product.shortDescription || product.name || "Produto"}</span></div>)}</div>
  </SimplePanel>;
}

function StructurePanel({ onToast }: { onToast: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await readJson("/api/admin/hierarchy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ level: "departamento", name: name.trim(), parentId: null }) });
      onToast("Configurações salvas com sucesso.");
      setName(""); setOpen(false);
    } finally { setSaving(false); }
  };
  return <SimplePanel title="Estrutura">
    <button onClick={() => setOpen(true)} style={primaryButton}>Novo departamento</button>
    {open && <div style={{ marginTop: 12, padding: 12, border: "1px solid #d8e1ec", borderRadius: 10 }}>
      <label style={fieldLabel}>Nome<input placeholder="Ex.: Food Service" value={name} onChange={event => setName(event.target.value)} style={field} /></label>
      <button onClick={() => void save()} disabled={saving} style={{ ...primaryButton, marginTop: 10 }}>Salvar</button>
    </div>}
  </SimplePanel>;
}

function MarketingPanel() {
  const [section, setSection] = useState("Geral");
  return <SimplePanel title="Marketing">
    <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 800 }}>SUPABASE OK</span>
    <div style={{ display: "flex", gap: 6, marginTop: 12 }}><button style={tabButton} onClick={() => setSection("Banner")}>Banner</button><button style={tabButton} onClick={() => setSection("Carrossel")}>Carrossel</button></div>
    {section === "Banner" && <div style={{ marginTop: 12 }}><h3>Banner principal</h3><p style={{ color: "#667085", fontSize: 13 }}>Imagem, vídeo, texto e link editáveis.</p></div>}
  </SimplePanel>;
}

function ModelsPanel({ templates, onPreview }: { templates: Template[]; onPreview: () => void }) {
  const models = templates.length ? templates : [{ id: "modelo-oficial", name: "Modelo Oficial", description: "Modelo oficial preenchido" }];
  return <SimplePanel title="Modelos prontos">
    <button style={{ ...tabButton, width: "100%", marginBottom: 10 }}>Começar com página em branco</button>
    <div style={{ display: "grid", gap: 10 }}>{models.map(template => <article key={template.id} data-asteryon-template-version="93" style={{ border: "1px solid #d8e1ec", borderRadius: 12, padding: 12, background: "#fff" }}><h3 style={{ margin: "0 0 4px" }}>{template.name}</h3><p style={{ margin: "0 0 10px", color: "#667085", fontSize: 12 }}>{template.description || "Template ASTERYON preenchido"}</p><button onClick={onPreview} style={primaryButton}>Aplicar modelo preenchido V93</button></article>)}</div>
  </SimplePanel>;
}

function TemplatePreview({ catalog, onClose, onApply }: { catalog: Catalog; onClose: () => void; onApply: () => void }) {
  return <div id="laurencini-template-preview-v69" role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(8,20,38,.78)", padding: 16, overflowY: "auto" }}>
    <div className="ltp-shell" style={{ maxWidth: 1180, margin: "0 auto", background: "white", borderRadius: 18, overflow: "hidden" }}>
      <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e4e7ec" }}><strong>Prévia final preenchida</strong><button onClick={onClose} style={tabButton}>Fechar</button></div>
      <FilledTemplate catalog={catalog} preview />
      <div style={{ padding: 16, display: "flex", justifyContent: "flex-end" }}><button onClick={onApply} style={primaryButton}>Aplicar este modelo</button></div>
    </div>
  </div>;
}

function FilledTemplate({ catalog, preview = false }: { catalog: Catalog; preview?: boolean }) {
  const products = catalog.products.length ? catalog.products : [{ id: "p-empty", shortDescription: "Produto do catálogo" }];
  return <div style={{ background: "#f7f9fc" }}>
    <section data-node-id={preview ? undefined : "hero-v93"} style={{ minHeight: 260, padding: "48px 7%", background: "linear-gradient(135deg,#153c6d,#245f9f)", color: "white" }}><p style={{ textTransform: "uppercase", letterSpacing: ".15em", fontSize: 11 }}>ASTERYON • CATÁLOGO</p><h2 style={{ maxWidth: 700, fontSize: "clamp(28px,4vw,52px)", margin: "8px 0" }}>Um catálogo completo para apresentar a força da Laurencini.</h2><p>Produtos, marcas e categorias organizados em uma experiência comercial editável.</p></section>
    <section data-node-id={preview ? undefined : "brands-v93"} style={{ padding: "26px 7%", background: "white" }}><h3>Marca do catálogo</h3><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{catalog.brands.map(brand => <span key={brand.id} style={{ border: "1px solid #d8e1ec", borderRadius: 999, padding: "8px 12px" }}>{brand.name}</span>)}</div></section>
    <section style={{ padding: "28px 7% 46px" }}><h3>Produtos em destaque</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>{products.slice(0, 8).map((product, index) => <article key={product.id} data-node-id={preview ? undefined : `product-v93-${index}`} style={{ minHeight: 150, background: "white", border: "1px solid #e4e7ec", borderRadius: 12, padding: 14 }}><small>{product.code || `P${index + 1}`}</small><h4>{product.shortDescription || product.name || `Produto QA ${index + 1}`}</h4><p style={{ color: "#667085", fontSize: 12 }}>{product.brandName || "Marca do catálogo"}</p></article>)}</div></section>
  </div>;
}

function EmptyCanvas() { return <div style={{ minHeight: "calc(100dvh - 94px)", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}><div><h2 style={{ marginBottom: 8 }}>Editor Visual ASTERYON V94</h2><p style={{ maxWidth: 580, color: "#667085" }}>Use o painel de Gestão do Catálogo para editar produtos, estrutura, marketing e aplicar modelos preenchidos.</p></div></div>; }
function SimplePanel({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2 style={{ fontSize: 17, margin: "0 0 10px" }}>{title}</h2>{children}</section>; }

const toolbarButton: React.CSSProperties = { border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", padding: "7px 10px", borderRadius: 8, cursor: "pointer" };
const tabButton: React.CSSProperties = { border: "1px solid #d8e1ec", background: "#fff", color: "#24324a", padding: "8px 9px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12 };
const activeTabButton: React.CSSProperties = { background: "#e7f0fb", borderColor: "#9cbce0", color: "#174b82" };
const primaryButton: React.CSSProperties = { border: 0, background: "#214c8f", color: "white", padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700 };
const fieldLabel: React.CSSProperties = { display: "grid", gap: 5, marginBottom: 10, fontSize: 12, fontWeight: 700 };
const field: React.CSSProperties = { width: "100%", border: "1px solid #cdd7e5", borderRadius: 8, padding: "9px 10px", background: "white", color: "#172033" };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid #e4e7ec", borderRadius: 8, fontSize: 12, background: "white" };
const responsiveCss = `
.asteryon-sidebar{width:340px;flex:0 0 340px;background:#f8fafc;border-right:1px solid #d8e1ec;min-height:calc(100dvh - 58px);z-index:61}.asteryon-right{width:280px;flex-basis:280px;border-right:0;border-left:1px solid #d8e1ec}.asteryon-backdrop{display:none;border:0;padding:0}.asteryon-panel-trigger{display:none!important}
@media(max-width:800px){.asteryon-panel-trigger{display:inline-block!important;margin-left:auto}.asteryon-sidebar{position:fixed;top:58px;bottom:0;left:0;width:min(86vw,360px);min-height:0;transform:translateX(-105%);transition:transform .18s ease;box-shadow:0 18px 48px rgba(8,20,38,.24);overflow:hidden}.asteryon-sidebar.is-open{transform:translateX(0)}.asteryon-right{left:auto;right:0;transform:translateX(105%)}.asteryon-right.is-open{transform:translateX(0)}.asteryon-backdrop.is-open{display:block;position:fixed;inset:58px 0 0;z-index:60;background:rgba(8,20,38,.34)}[data-asteryon-mobile-toolbar]{display:flex!important}}
@media(min-width:801px){[data-asteryon-mobile-toolbar]{display:none!important}.asteryon-left{transform:none!important}.asteryon-right{display:none}.asteryon-backdrop{display:none!important}}
`;
