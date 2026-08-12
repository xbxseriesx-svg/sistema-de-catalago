import { hasSupabase, supabase } from '../lib/supabase'
import type { EditorDocument } from '../editor/types'
import { generateAsteryonAiProposal } from './engine'
import type { AsteryonAiProposal } from './types'

const isProposal = (value: unknown): value is AsteryonAiProposal => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AsteryonAiProposal>
  return Boolean(candidate.id && candidate.intent && candidate.title && candidate.structured && candidate.requiresApproval === true && candidate.productionTouched === false)
}

export async function requestAsteryonAiProposal(prompt: string, document: EditorDocument): Promise<AsteryonAiProposal> {
  if (hasSupabase && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('asteryon-ai', {
        body: {
          prompt,
          context: {
            pageId: document.pageId,
            pageName: document.name,
            theme: document.theme,
            designSystem: document.designSystem,
            blockTypes: document.blocks.map(block => block.type),
          },
          constraints: {
            draftOnly: true,
            autoPublish: false,
            productionWrite: false,
            executableCode: false,
            copyProtectedContent: false,
          },
        },
      })
      if (!error && isProposal(data)) return { ...data, source: 'supabase-provider', productionTouched: false, requiresApproval: true }
    } catch {
      // O provider é opcional. Em caso de indisponibilidade, o motor local seguro assume.
    }
  }

  return generateAsteryonAiProposal(prompt, document)
}
