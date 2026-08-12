import React, { useState } from 'react'
import { FileSpreadsheet, Images, RefreshCw, Upload, X } from 'lucide-react'
import { importProductImages, importSpreadsheet, loadImportedProducts } from './imports'

export function ImportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!open) return null

  return <>
    <div className="import-backdrop" onClick={onClose} />
    <aside className="import-panel">
      <header><div><strong>Importação de teste</strong><span>Excel/CSV + imagens por código do produto</span></div><button onClick={onClose}><X size={20}/></button></header>
      <section>
        <h3><FileSpreadsheet size={18}/> Produtos</h3>
        <p>Importe .xlsx, .xls ou .csv. O sistema reconhece colunas como Código, Descrição, Marca, Departamento, Categoria, Seção, Subcategoria, Distribuição e Preço.</p>
        <label className="import-action"><Upload size={17}/> Selecionar planilha<input type="file" accept=".xlsx,.xls,.csv" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return; setBusy(true); setMessage('Importando planilha…')
          try { const r = await importSpreadsheet(file); setMessage(`Concluído: ${r.imported} novos, ${r.updated} atualizados, ${r.skipped} ignorados.${r.errors.length ? ' ' + r.errors.join(' | ') : ''}`) }
          catch (err) { setMessage(err instanceof Error ? err.message : 'Falha na importação.') }
          finally { setBusy(false); e.currentTarget.value = '' }
        }}/></label>
        <small>{loadImportedProducts().length} produtos importados salvos localmente.</small>
      </section>
      <section>
        <h3><Images size={18}/> Imagens</h3>
        <p>Selecione várias imagens. O nome deve começar com o código: <b>10001.png</b>, <b>10001_2.jpg</b> ou <b>10001-1.webp</b>.</p>
        <label className="import-action"><Images size={17}/> Selecionar imagens<input type="file" accept="image/*" multiple onChange={async e => {
          const files = e.target.files; if (!files?.length) return; setBusy(true); setMessage('Vinculando imagens…')
          try { const r = await importProductImages(files); setMessage(`Imagens vinculadas: ${r.linked}.${r.unmatched.length ? ' Sem produto correspondente: ' + r.unmatched.slice(0,12).join(', ') : ''}`) }
          catch (err) { setMessage(err instanceof Error ? err.message : 'Falha ao vincular imagens.') }
          finally { setBusy(false); e.currentTarget.value = '' }
        }}/></label>
      </section>
      <div className="import-note"><RefreshCw size={16}/><span>Após importar, as vitrines inteligentes passam a usar os produtos locais. Promoções continuam sendo a única área autorizada a misturar caminhos diferentes.</span></div>
      {message ? <div className="import-message">{busy ? '⏳ ' : '✓ '}{message}</div> : null}
    </aside>
  </>
}
