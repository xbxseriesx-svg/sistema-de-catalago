import { clone, uid } from '../editor/defaults'
import { useEditorStore } from '../editor/store'
import type { EditorDocument } from '../editor/types'
import { ensureDraftOnly } from './engine'

export function applyAsteryonAiDraft(document: EditorDocument, label: string) {
  const state = useEditorStore.getState()
  const next = ensureDraftOnly(document)
  const now = new Date().toISOString()

  useEditorStore.setState({
    history: {
      past: [...state.history.past, clone(state.history.present)].slice(-100),
      present: next,
      future: [],
    },
    sandboxes: state.sandboxes.map(sandbox => sandbox.id === state.activeSandboxId ? { ...sandbox, document: clone(next) } : sandbox),
    selectedBlockId: null,
    actionCount: state.actionCount + 1,
    activity: [{
      id: uid('log'),
      at: now,
      action: 'AI_APPLY_DRAFT',
      label: `ASTERYON AI · ${label}`,
    }, ...state.activity].slice(0, 200),
  })
}
