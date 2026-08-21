import { useEffect, useRef } from "react";
import { useEditor } from "./store";
import { loadLocalDraft, loadRemoteDraft, saveLocalDraft, saveRemoteDraft, type SavedEditorPayload } from "./persistence";

function payload(): SavedEditorPayload {
  const s = useEditor.getState();
  return { schemaVersion: 5, doc: s.doc, resolution: s.resolution, savedAt: new Date().toISOString() };
}

export async function forceEditorSave() {
  const p = payload();
  const s = useEditor.getState();
  s.markSaveState("saving");
  saveLocalDraft(p);
  try {
    await saveRemoteDraft(p);
    s.markSaveState("saved", p.savedAt);
  } catch (error) {
    console.error("ASTERYON autosave", error);
    // Local persistence still succeeded; mark error so the UI makes the remote failure visible.
    s.markSaveState("error", p.savedAt);
  }
}

export function useEditorPersistence() {
  const hydrated = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const local = loadLocalDraft();
      if (local && !cancelled) useEditor.getState().replaceDocument(local.doc, local.resolution);
      try {
        const remote = await loadRemoteDraft();
        if (remote && !cancelled) useEditor.getState().replaceDocument(remote.doc, remote.resolution);
      } catch (error) {
        console.warn("Rascunho remoto indisponível; usando cache local.", error);
      } finally {
        hydrated.current = true;
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const unsub = useEditor.subscribe((state, prev) => {
      if (!hydrated.current || state.doc === prev.doc) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void forceEditorSave(), 850);
    });
    const manual = () => void forceEditorSave();
    window.addEventListener("asteryon:manual-save", manual);
    return () => {
      unsub();
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("asteryon:manual-save", manual);
    };
  }, []);
}
