import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (request) => {
  const secret = Deno.env.get('SCHEDULED_PUBLISH_SECRET')
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } })
  const now = new Date().toISOString()

  const { data: drafts, error } = await supabase
    .from('site_drafts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(100)

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

  const results: Array<{ id: string; ok: boolean; versionId?: string; error?: string }> = []
  for (const draft of drafts || []) {
    const { data, error: publishError } = await supabase.rpc('publish_site_draft', { p_draft_id: draft.id, p_user_id: null })
    results.push({ id: draft.id, ok: !publishError, versionId: publishError ? undefined : String(data), error: publishError?.message })
  }

  return Response.json({ ok: true, processed: results.length, results })
})
