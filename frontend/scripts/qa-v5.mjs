import fs from 'node:fs';
const checks={
 'src/editor/types.ts':['1080p / Full HD','2K / QHD','4K / UHD'],
 'src/editor/components/Toolbar.tsx':['Aplicar 3 modos','Publicar','Salvar'],
 'src/editor/store.ts':['saveAllModes','applyCurrentFrameToAllModes','RESOLUTION_PRESETS','responsive.desktop'],
 'src/editor/components/NodeView.tsx':['object-contain','case "carousel"','case "promotion"'],
 'src/editor/usePersistence.ts':['850','saveRemoteDraft','asteryon:manual-save'],
 'src/editor/persistence.ts':['create_page_snapshot','publish_page','restore_page_snapshot','pages'],
 'src/routes/catalogo.tsx':['PublishedDocument'],
 'src/editor/components/MarketingPreview.tsx':['Carrossel','object-contain'],
};
for(const [file,needles] of Object.entries(checks)){const t=fs.readFileSync(file,'utf8');for(const n of needles)if(!t.includes(n))throw new Error(`${file}: ausente ${n}`)}
const all=fs.readdirSync('src/editor',{recursive:true}).filter(x=>String(x).endsWith('.ts')||String(x).endsWith('.tsx')).map(x=>fs.readFileSync(`src/editor/${x}`,'utf8')).join('\n');
if(/D1Database|R2Bucket|\.prepare\(/.test(all))throw new Error('Referência D1/R2 encontrada no editor V5');
console.log('QA V5 estrutural: OK');
