import type { EditorDocument } from '../editor/types'

export type DesktopAiStatus = {
  desktop: boolean
  configured: boolean
  encryptionAvailable: boolean
  textModel: string
  imageModel: string
  onlineResearch: boolean
  imageGeneration: boolean
  dataPath?: string
}

export type DesktopRemoteProposal = {
  intent: string
  title: string
  summary: string
  structured: Record<string, unknown>
  findings?: Array<Record<string, unknown>>
  imagePrompt?: string
  editorPatch?: Record<string, unknown>
  enhancedPrompt?: string
  researchUsed?: boolean
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || `Falha local (${response.status}).`)
  return data as T
}

export async function getDesktopAiStatus(): Promise<DesktopAiStatus | null> {
  try {
    return await api<DesktopAiStatus>('/api/desktop/status')
  } catch {
    return null
  }
}

export async function saveDesktopAiSettings(input: { apiKey?: string; textModel: string; imageModel: string }) {
  return api<{ ok: boolean; configured: boolean; textModel: string; imageModel: string }>('/api/desktop/settings', {
    method: 'POST', body: JSON.stringify(input),
  })
}

export async function testDesktopAi() {
  return api<{ ok: boolean; message: string; textModel: string; imageModel: string }>('/api/desktop/test-ai', {
    method: 'POST', body: '{}',
  })
}

export async function requestDesktopAiProposal(prompt: string, document: EditorDocument, researchRequested: boolean, selectedBlockId?: string | null) {
  const selected = selectedBlockId ? document.blocks.find(block => block.id === selectedBlockId) : undefined
  return api<DesktopRemoteProposal>('/api/ai/proposal', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      researchRequested,
      context: {
        pageId: document.pageId,
        pageName: document.name,
        theme: document.theme,
        designSystem: document.designSystem,
        blockTypes: document.blocks.map(block => block.type),
        selectedBlock: selected ? { type: selected.type, name: selected.name, props: selected.props, style: selected.style } : null,
      },
    }),
  })
}

export async function generateDesktopAiImage(prompt: string, size: '1024x1024' | '1024x1536' | '1536x1024' | 'auto' = '1536x1024', quality: 'low' | 'medium' | 'high' | 'auto' = 'medium') {
  return api<{ url: string; fileName: string; prompt: string }>('/api/ai/image', {
    method: 'POST', body: JSON.stringify({ prompt, size, quality }),
  })
}
