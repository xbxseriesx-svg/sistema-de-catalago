const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedResearchScopes = [
  'visual trends',
  'commemorative dates',
  'color palettes',
  'branding concepts',
  'marketing trends',
  'ux/ui trends',
  'campaign references',
  'modern visual patterns',
]

const systemPrompt = `
You are ASTERYON AI, a creative assistant for the ASTERYON Digital Catalog Visual Editor.

NON-NEGOTIABLE RULES:
1. Work only on drafts. Never publish and never mutate production.
2. Every change must follow Generate -> Preview -> Approve -> Apply to Draft.
3. Return original content. Never copy web text, slogans, logos, banners, images or site layouts.
4. Online research, when enabled by the provider, is inspiration-only and restricted to: ${allowedResearchScopes.join(', ')}.
5. Never generate executable code for the catalog system.
6. Never change prices automatically, never mutate real products without approval, and never delete data without confirmation.
7. Prioritize accessibility, performance, SEO, mobile usability and information hierarchy.
8. Use only ASTERYON-supported visual blocks.
9. Preserve catalog hierarchy. Only Promotions may mix products from different normal structures.
10. Return JSON only. Set requiresApproval=true and productionTouched=false.
`.trim()

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)

  let body: { prompt?: string; context?: unknown; constraints?: unknown; researchRequested?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const prompt = String(body.prompt || '').trim()
  if (!prompt || prompt.length > 6000) return json({ error: 'Prompt is required and must be under 6000 characters' }, 422)

  const forbiddenCodeRequest = /\b(gerar|criar|escreva|write|generate)\b[\s\S]{0,40}\b(codigo|code|javascript|typescript|react component|script executavel|executable script)\b/i.test(prompt)
  if (forbiddenCodeRequest) return json({
    error: 'ASTERYON AI não gera código executável. Posso gerar a estrutura visual equivalente usando blocos do editor.',
  }, 422)

  const providerUrl = Deno.env.get('ASTERYON_AI_PROVIDER_URL')
  const providerKey = Deno.env.get('ASTERYON_AI_PROVIDER_KEY')
  if (!providerUrl || !providerKey) return json({
    error: 'AI provider not configured',
    fallback: 'client-safe-local-engine',
  }, 503)

  const providerResponse = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${providerKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system: systemPrompt,
      prompt,
      context: body.context ?? {},
      constraints: body.constraints ?? {},
      research: {
        requested: Boolean(body.researchRequested),
        allowedScopes: allowedResearchScopes,
        inspirationOnly: true,
        protectedContentReuse: false,
      },
      responseFormat: 'json',
    }),
  })

  if (!providerResponse.ok) return json({ error: 'AI provider unavailable' }, 502)

  let proposal: Record<string, unknown>
  try {
    proposal = await providerResponse.json()
  } catch {
    return json({ error: 'AI provider returned invalid JSON' }, 502)
  }

  delete proposal.published
  delete proposal.production
  delete proposal.autoPublish
  delete proposal.executableCode

  return json({
    ...proposal,
    id: proposal.id || crypto.randomUUID(),
    stage: 'generated',
    source: 'supabase-provider',
    prompt,
    requiresApproval: true,
    productionTouched: false,
    canApply: proposal.canApply === true,
    research: {
      requested: Boolean(body.researchRequested),
      used: Boolean((proposal.research as Record<string, unknown> | undefined)?.used),
      allowedScopes: allowedResearchScopes,
      note: 'Research may only inspire original output; protected content cannot be copied.',
    },
  })
})
