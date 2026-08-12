import type { EditorDocument, PublishedVersion, Sandbox, SavedTemplate, Snapshot } from '../editor/types'
import { supabase } from './supabase'

export interface RemoteDraft {
  id: string
  pageId: string
  sandboxId: string
  status: 'draft' | 'preview' | 'scheduled'
  document: EditorDocument
  revision: number
  scheduledAt: string | null
}

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  return supabase
}

export const editorRepository = {
  async loadPublishedPage(companyId: string, slug = 'home'): Promise<EditorDocument | null> {
    const client = requireClient()
    const { data: page, error: pageError } = await client
      .from('site_pages')
      .select('published_version_id')
      .eq('company_id', companyId)
      .eq('slug', slug)
      .maybeSingle()
    if (pageError) throw pageError
    if (!page?.published_version_id) return null
    const { data, error } = await client
      .from('site_versions')
      .select('document')
      .eq('id', page.published_version_id)
      .single()
    if (error) throw error
    return data.document as EditorDocument
  },

  async loadDraft(pageId: string, sandboxId: string): Promise<RemoteDraft | null> {
    const client = requireClient()
    const { data, error } = await client
      .from('site_drafts')
      .select('id,page_id,sandbox_id,status,document,revision,scheduled_at')
      .eq('page_id', pageId)
      .eq('sandbox_id', sandboxId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      id: data.id,
      pageId: data.page_id,
      sandboxId: data.sandbox_id,
      status: data.status,
      document: data.document as EditorDocument,
      revision: data.revision,
      scheduledAt: data.scheduled_at,
    }
  },

  async saveDraft(draftId: string, document: EditorDocument, expectedRevision: number) {
    const client = requireClient()
    const { data, error } = await client
      .from('site_drafts')
      .update({ document, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
      .eq('id', draftId)
      .eq('revision', expectedRevision)
      .select('revision')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Conflito de edição: este rascunho foi atualizado em outra sessão.')
    return Number(data.revision)
  },

  async publishDraft(draftId: string, userId?: string): Promise<string> {
    const client = requireClient()
    const { data, error } = await client.rpc('publish_site_draft', { p_draft_id: draftId, p_user_id: userId ?? null })
    if (error) throw error
    return String(data)
  },

  async scheduleDraft(draftId: string, scheduledAt: string) {
    const client = requireClient()
    const { error } = await client.from('site_drafts').update({ status: 'scheduled', scheduled_at: scheduledAt }).eq('id', draftId)
    if (error) throw error
  },

  async listVersions(pageId: string): Promise<PublishedVersion[]> {
    const client = requireClient()
    const { data, error } = await client.from('site_versions').select('id,version_number,published_at,status,document').eq('page_id', pageId).order('version_number', { ascending: false })
    if (error) throw error
    return (data || []).map(row => ({ id: row.id, number: Number(row.version_number), at: row.published_at, status: row.status, label: `Versão ${row.version_number}`, document: row.document as EditorDocument }))
  },

  async saveSnapshot(companyId: string, pageId: string, sandboxId: string, snapshot: Snapshot, triggerType: 'manual' | 'actions_25' | 'timer_5m' | 'restore' = 'manual') {
    const client = requireClient()
    const { error } = await client.from('editor_snapshots').insert({ company_id: companyId, page_id: pageId, sandbox_id: sandboxId, label: snapshot.label, trigger_type: triggerType, document: snapshot.document })
    if (error) throw error
  },

  async listSandboxes(pageId: string): Promise<Sandbox[]> {
    const client = requireClient()
    const { data, error } = await client.from('site_sandboxes').select('id,name,created_at,site_drafts(document)').eq('page_id', pageId).order('created_at')
    if (error) throw error
    return (data || []).map(row => ({ id: row.id, name: row.name, createdAt: row.created_at, document: ((row.site_drafts as unknown as Array<{ document: EditorDocument }>)?.[0]?.document) as EditorDocument }))
  },

  async saveTemplate(companyId: string, template: SavedTemplate) {
    const client = requireClient()
    const { error } = await client.from('component_templates').insert({ company_id: companyId, name: template.name, block_type: template.type, block: template.block })
    if (error) throw error
  },
}
