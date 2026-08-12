import type { EditorDocument } from '../editor/types'

export type AsteryonAiIntent =
  | 'theme'
  | 'background'
  | 'layout'
  | 'landing'
  | 'catalog-structure'
  | 'copy'
  | 'banner'
  | 'campaign'
  | 'image'
  | 'design-audit'
  | 'improve'
  | 'identity'
  | 'suggestions'

export type AsteryonAiStage = 'generated' | 'previewed' | 'approved' | 'applied'

export interface AsteryonAiFinding {
  severity: 'info' | 'warning' | 'critical'
  area: 'contrast' | 'typography' | 'mobile' | 'spacing' | 'hierarchy' | 'accessibility' | 'seo' | 'performance'
  title: string
  description: string
  suggestion: string
}

export interface AsteryonAiProposal {
  id: string
  intent: AsteryonAiIntent
  stage: AsteryonAiStage
  title: string
  summary: string
  createdAt: string
  source: 'safe-local-engine' | 'supabase-provider'
  prompt: string
  structured: Record<string, unknown>
  findings?: AsteryonAiFinding[]
  imagePrompt?: string
  previewDocument?: EditorDocument
  canApply: boolean
  requiresApproval: true
  productionTouched: false
  research: {
    requested: boolean
    used: boolean
    allowedScopes: string[]
    note: string
  }
}
