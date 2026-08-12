import React, { useState } from 'react'
import { FileSpreadsheet, Images, RefreshCw, Upload, X } from 'lucide-react'
import { importProductImages, importSpreadsheet, loadImportedProducts, type ImportSummary } from './imports'

export function ImportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  if (!open) return null

  return <>
    <div className="import-backdrop" onClick={onClose} />
    <aside className="import-panel">
      <header><div><strong>Importação de Produtos</strong><span>Excel/CSV + imagens vinculadas pelo código</span></div><button onClick={onClose}><X size={20}/></button></header>
      <section>
        <h3><FileSpreadsheet size={18}/> Planilha de produtos</h3>
        <p>O ASTERYON agora reconhece diretamente a estrutura da planilha de produtos enviada, inclusive cabeçalhos repetidos como <b>Marca</b> e <b>Descrição da unidade</b>.</p>
        <div className="import-note"><span><b>Mapeamento principal:</b> Código, Descrição, Fornecedor, Nome do fornecedor, Departamento, Seção, Código/Descrição da Marca, Código/Nome da Categoria, Embalagem de venda, Unidade de venda, Embalagem Master, Unidade Master, NCM + Exceção, NCM, EAN/DUN de venda e EAN/DUN Master.</span></div>
        <label className="import-action"><Upload size={17}/> Selecionar planilha<input type="file" accept=".xlsx,.xls,.csv" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return; setBusy(true); setSummary(null); setMessage('Lendo e validando a planilha…')
          try {
            const r = await importSpreadsheet(file)
            setSummary(r)
            setMessage(`Concluído: ${r.imported} novos, ${r.updated} atualizados, ${r.skipped} ignorados de ${r.totalRows} linhas.${r.errors.length ? ' ' + r.errors.join(' | ') : ''}`)
          }
          catch (err) { setMessage(err instanceof Error ? err.message : 'Falha na importação.') }
          finally { setBusy(false); e.currentTarget.value = '' }
        }}/></label>
        <small>{loadImportedProducts().length} produtos importados salvos localmente.</small>
        {summary ? <div className="import-summary-card"><strong>{summary.profile}</strong><span>{summary.mappedFields.length} campos mapeados</span><p>{summary.mappedFields.join(' · ')}</p></div> : null}
      </section>
      <section>
        <h3><Images size={18}/> Imagens dos produtos</h3>
        <p>Selecione várias imagens. O nome deve começar com o código do produto: <b>32.png</b>, <b>32_2.jpg</b> ou <b>32-1.webp</b>.</p>
        <label className="import-action"><Images size={17}/> Selecionar imagens<input type="file" accept="image/*" multiple onChange={async e => {
          const files = e.target.files; if (!files?.length) return; setBusy(true); setMessage('Vinculando imagens…')
          try { const r = await importProductImages(files); setMessage(`Imagens vinculadas: ${r.linked}.${r.unmatched.length ? ' Sem produto correspondente: ' + r.unmatched.slice(0,12).join(', ') : ''}`) }
          catch (err) { setMessage(err instanceof Error ? err.message : 'Falha ao vincular imagens.') }
          finally { setBusy(false); e.currentTarget.value = '' }
        }}/></label>
      </section>
      <div className="import-note"><RefreshCw size={16}/><span>Hierarquia importada: <b>Departamento → Seção → Categoria</b>. A marca fica separada. O fornecedor é preservado com código e nome e também alimenta a dimensão Distribuição. NCM com zero à esquerda é preservado; EAN/DUN igual a zero é tratado como vazio.</span></div>
      {message ? <div className="import-message">{busy ? '⏳ ' : '✓ '}{message}</div> : null}
    </aside>
  </>
}
