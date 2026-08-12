import React, { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock, Check, GitCompareArrows, Rocket, X } from 'lucide-react'
import { useEditorStore } from './store'
import { DocumentPreview } from './DocumentPreview'

const scheduleSchema = z.object({
  scheduledAt: z.string().min(1, 'Informe data e hora'),
})
type ScheduleData = z.infer<typeof scheduleSchema>

function jsonEqual(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }

export function PublishDialog() {
  const open = useEditorStore(s => s.publishDialogOpen)
  const close = useEditorStore(s => s.setPublishDialogOpen)
  const draft = useEditorStore(s => s.history.present)
  const published = useEditorStore(s => s.published)
  const publishNow = useEditorStore(s => s.publishNow)
  const schedulePublish = useEditorStore(s => s.schedulePublish)
  const device = useEditorStore(s => s.device)
  const { register, handleSubmit, formState: { errors } } = useForm<ScheduleData>({ resolver: zodResolver(scheduleSchema) })

  const summary = useMemo(() => {
    const oldMap = new Map(published.blocks.map(b => [b.id, b]))
    const newMap = new Map(draft.blocks.map(b => [b.id, b]))
    const created = draft.blocks.filter(b => !oldMap.has(b.id))
    const removed = published.blocks.filter(b => !newMap.has(b.id))
    const modified = draft.blocks.filter(b => {
      const old = oldMap.get(b.id)
      return old ? !jsonEqual({ props: old.props, style: old.style, hidden: old.hidden, hiddenOn: old.hiddenOn, parentId: old.parentId, order: old.order }, { props: b.props, style: b.style, hidden: b.hidden, hiddenOn: b.hiddenOn, parentId: b.parentId, order: b.order }) : false
    })
    const banners = modified.filter(b => ['hero', 'banner', 'carousel'].includes(b.type)).length + created.filter(b => ['hero', 'banner', 'carousel'].includes(b.type)).length
    const showcases = created.filter(b => b.type === 'showcase').length
    const themeChanged = !jsonEqual(published.theme, draft.theme)
    const footerChanged = modified.some(b => b.type === 'footer') || created.some(b => b.type === 'footer') || removed.some(b => b.type === 'footer')
    const designChanged = !jsonEqual(published.designSystem, draft.designSystem)
    const identityChanged = !jsonEqual(published.identity, draft.identity)
    return { created, removed, modified, banners, showcases, themeChanged, footerChanged, designChanged, identityChanged }
  }, [draft, published])

  if (!open) return null

  const onSchedule = (data: ScheduleData) => schedulePublish(new Date(data.scheduledAt).toISOString())

  return <div className="dialog-backdrop"><div className="publish-dialog"><div className="dialog-head"><div><span className="dialog-kicker"><GitCompareArrows size={16} /> Comparação de publicação</span><h2>Publicado x Novo Rascunho</h2><p>Nada será alterado no portal público até a confirmação.</p></div><button onClick={() => close(false)}><X /></button></div>
    <div className="change-summary">
      <h3>Resumo de Alterações</h3>
      <div className="change-grid">
        <span><Check /> {summary.banners} banners modificados/criados</span>
        <span><Check /> {summary.modified.length} blocos atualizados</span>
        <span><Check /> {summary.created.length} novos blocos</span>
        <span><Check /> {summary.removed.length} blocos removidos</span>
        <span><Check /> {summary.showcases} novas vitrines</span>
        <span><Check /> Tema {summary.themeChanged ? 'alterado' : 'sem alteração'}</span>
        <span><Check /> Rodapé {summary.footerChanged ? 'alterado' : 'sem alteração'}</span>
        <span><Check /> Design System {summary.designChanged ? 'alterado' : 'sem alteração'}</span>
        <span><Check /> Identidade {summary.identityChanged ? 'alterada' : 'sem alteração'}</span>
      </div>
    </div>
    <div className="compare-grid">
      <div><div className="compare-label">PUBLICADO</div><div className="compare-preview"><DocumentPreview document={published} device={device} /></div></div>
      <div><div className="compare-label new">NOVO RASCUNHO</div><div className="compare-preview"><DocumentPreview document={draft} device={device} /></div></div>
    </div>
    <div className="publish-actions">
      <form onSubmit={handleSubmit(onSchedule)} className="schedule-form"><CalendarClock size={18} /><input type="datetime-local" {...register('scheduledAt')} /><button type="submit">Agendar</button>{errors.scheduledAt ? <small>{errors.scheduledAt.message}</small> : null}</form>
      <button className="publish-now" onClick={() => publishNow()}><Rocket size={18} /> Publicar agora</button>
    </div>
  </div></div>
}
