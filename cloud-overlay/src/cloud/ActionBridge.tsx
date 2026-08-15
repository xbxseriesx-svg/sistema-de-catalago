import { useEffect } from 'react';
import { useEditor } from '../editor/store';

export function CloudActionBridge() {
  const { saveDraft, publish, cloud } = useEditor();
  useEffect(() => {
    if (!cloud.enabled) return;
    const click = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button') as HTMLButtonElement | null;
      const title = button?.getAttribute('title') || '';
      if (title === 'Salvar rascunho') {
        event.preventDefault(); event.stopImmediatePropagation(); void saveDraft().catch(e => alert(e instanceof Error ? e.message : 'Falha ao salvar'));
      }
      if (title === 'Publicar versão atual') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (confirm('Publicar este rascunho no site público agora?')) void publish().catch(e => alert(e instanceof Error ? e.message : 'Falha ao publicar'));
      }
    };
    const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopImmediatePropagation(); void saveDraft().catch(()=>{}); } };
    document.addEventListener('click', click, true); window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('click', click, true); window.removeEventListener('keydown', key, true); };
  }, [cloud.enabled, saveDraft, publish]);
  return null;
}
