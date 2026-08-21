import { useEffect } from "react";
import { useEditor } from "./store";

/** Global keyboard model for the editor. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (typing) {
        if (e.key === "Escape") s.setEditing(null);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        window.dispatchEvent(new Event("asteryon:manual-save"));
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") return e.preventDefault(), s.redo();
      if (mod && e.key.toLowerCase() === "d") return e.preventDefault(), s.duplicate();
      if (mod && e.key.toLowerCase() === "g")
        return e.preventDefault(), e.shiftKey ? s.ungroup() : s.group();
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        return s.setSelection(s.doc.nodes[s.doc.rootId]?.children ?? []);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selection.length) {
          e.preventDefault();
          s.remove();
        }
        return;
      }
      if (e.key === "Escape") return s.select(null);
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const map: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const d = map[e.key];
        if (d) s.nudge(d[0], d[1]);
        return;
      }
      if (e.key === "]") return s.order("forward");
      if (e.key === "[") return s.order("backward");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
