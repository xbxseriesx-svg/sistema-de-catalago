import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AiPanel } from "@/editor/components/AiPanel";
import { Canvas } from "@/editor/components/Canvas";
import { ElementsPanel } from "@/editor/components/ElementsPanel";
import { LayersPanel } from "@/editor/components/LayersPanel";
import { PropertiesPanel } from "@/editor/components/PropertiesPanel";
import { SelectionBreadcrumb } from "@/editor/components/SelectionBreadcrumb";
import { Toolbar } from "@/editor/components/Toolbar";
import { MarketingPreview } from "@/editor/components/MarketingPreview";
import { EditorAccessGate } from "@/editor/components/EditorAccessGate";
import { useShortcuts } from "@/editor/useShortcuts";
import { useEditorPersistence } from "@/editor/usePersistence";

export const Route = createFileRoute("/")({
  component: EditorPage,
});

function EditorPage() {
  useShortcuts();
  useEditorPersistence();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <EditorAccessGate>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-ed-bg text-ed-ink">
        <h1 className="sr-only">Editor Visual ASTERYON V94</h1>
        <Toolbar />
        <SelectionBreadcrumb />
        <MarketingPreview />
        <div className="flex min-h-0 flex-1">
          <aside className="flex min-h-0 w-60 shrink-0 flex-col border-r border-ed-border bg-ed-panel">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ElementsPanel />
            </div>
            <div className="h-[42%] min-h-0 overflow-y-auto overscroll-contain border-t border-ed-border">
              <LayersPanel />
            </div>
          </aside>
          <main className="relative min-w-0 flex-1">{mounted ? <Canvas /> : null}</main>
          <aside className="min-h-0 w-64 shrink-0 overflow-y-auto overscroll-contain border-l border-ed-border bg-ed-panel">
            <PropertiesPanel />
          </aside>
          {mounted ? <AiPanel /> : null}
        </div>
      </div>
    </EditorAccessGate>
  );
}
