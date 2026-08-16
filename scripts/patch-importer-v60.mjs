import { readFile, writeFile } from 'node:fs/promises';

const assetPath = 'public/assets/index-V60Excel.js';
const original = await readFile(assetPath, 'utf8');
let source = original;

function replaceLiteral(from, to) {
  if (source.includes(from)) source = source.split(from).join(to);
}

// Mantém o patch V60 de compatibilidade das colunas da planilha.
const start = source.indexOf('function TY(e)');
const end = source.indexOf('function _Y(e,t)', start);

if (start < 0 || end < 0) throw new Error('Bundle incompatível com o patch do importador V60.');

const oldRegion = source.slice(start, end);
const newRegion = `function TY(e){const t=Jt(e,["codigo","código","cod produto","codigo produto","código produto","codproduto","sku","code"]),a=Jt(e,["descricao","descrição","descricao do produto","descrição do produto","produto","nome"]),r=Jt(e,["departamento","descricao do departamento","descrição do departamento","nome do departamento","department"]),n=Jt(e,["secao","seção","descricao da secao","descrição da seção","nome da secao","nome da seção","section"]),i=Jt(e,["categoria","nome da categoria","descricao da categoria","descrição da categoria","category"]);if(!t||!a||!r||!n||!i)return null;
const o=Jt(e,["ean","gtin","codigo barras","código de barras","unidade venda ean","unidade venda ean8 upc12 ean13 e dun14"]),s=Jt(e,["ncm"]),d=Jt(e,["embalagem"]),h=Jt(e,["unidade","unit","un","descricao da unidade","descrição da unidade"])||"UN",u=Jt(e,["embalagem master"]),p=Jt(e,["descricao da unidade_1","descrição da unidade_1","descricao da unidade 1","descrição da unidade 1","unidade master descricao","descrição unidade master"]),f=Jt(e,["ncm excecao","ncm + exceção","ncm + excecao"]),y=Jt(e,["unidade master ean","unidade master ean8 upc12 ean13 e dun14"]),x=GA(Jt(e,["preco","preço","valor"])),k=GA(Jt(e,["preco promocional","preço promocional","promo"])),C=GA(Jt(e,["estoque","stock","saldo"])),v={};for(const[g,m]of Object.entries(e)){const S=String(m??"").trim();S&&(v[g]=S)}const b={NCM:s,"NCM + Exceção":f,Embalagem:d,"Descrição da unidade":h,"Embalagem Master":u,"Descrição da unidade Master":p,"Unidade Venda EAN":o,"Unidade Master EAN":y};return{code:t,name:a,shortDescription:a,longDescription:Jt(e,["descricao longa","descrição longa","detalhes"])||a,ean:o,ncm:s,packaging:d,unit:h,price:x,promoPrice:k,stock:C,brandName:Jt(e,["marca","brand"]),departamentoName:r,secaoName:n,categoriaName:i,technical:b,attributes:{...v,embalagemMaster:u,unidadeMaster:p,ncmExcecao:f,unidadeVendaEan:o,unidadeMasterEan:y},sourceColumns:v,tags:[],status:/inativ/i.test(Jt(e,["status","situacao"]))?"inativo":"ativo",priceMode:x!==null?"valor":"consulte"}}
`;

if (oldRegion !== newRegion) {
  source = source.slice(0, start).concat(newRegion, source.slice(end));
}

source = source.replace(
  /Obrigatórios: Código, Descrição, Departamento, Seção e Categoria\. Departamento aceita somente [\s\S]*?A marca é criada\/vinculada automaticamente\./,
  'Obrigatórios: Código, Descrição, Descrição do departamento, Descrição da seção e Nome da categoria. A hierarquia e a marca são criadas/vinculadas automaticamente.',
);

// V61/V62: o botão Imagens da Gestão do Catálogo abre o importador dedicado.
const legacyImageControl = /l\.jsxs\("label",\{className:`flex cursor-pointer items-center justify-center gap-2 rounded bg-zinc-800 py-2 text-\[10px\] font-bold \$\{t\?"pointer-events-none opacity-50":""\}`,children:\[l\.jsx\(Xc,\{size:12\}\),"Imagens",l\.jsx\("input",\{hidden:!0,type:"file",accept:"image\/\*",multiple:!0,onChange:o\}\)\]\}\)/;
const v62ImageControl = 'l.jsxs("a",{href:"/importar-imagens.html",className:`flex cursor-pointer items-center justify-center gap-2 rounded bg-zinc-800 py-2 text-[10px] font-bold ${t?"pointer-events-none opacity-50":""}`,children:[l.jsx(Xc,{size:12}),"Imagens"]})';

if (legacyImageControl.test(source)) {
  source = source.replace(legacyImageControl, v62ImageControl);
} else if (!source.includes('href:"/importar-imagens.html"')) {
  throw new Error('Não foi possível localizar o botão Imagens para aplicar o vínculo V62.');
}

replaceLiteral(
  'A imagem é otimizada sem distorção e associada pelo Código ou EAN.',
  'Planilha importa os dados dos produtos. Imagens abre o importador V62 em lote, com seleção de pasta, conversão WebP, Supabase Storage e vínculo pelo Código.',
);

// V62: progresso verdadeiro do Excel por lote. O backend recebe no máximo 300
// produtos por requisição, então a barra representa exatamente o lote em curso.
const crStart = source.indexOf('function CR(){');
const crEnd = source.indexOf('const JF=', crStart);
if (crStart < 0 || crEnd < 0) throw new Error('Componente de importação CR não encontrado.');
let cr = source.slice(crStart, crEnd);

if (!cr.includes('asteryon:import-progress')) {
  const readingNeedle = 'a(!0);try{const p=EI(';
  if (!cr.includes(readingNeedle)) throw new Error('Marcador de leitura da planilha não encontrado.');
  cr = cr.replace(
    readingNeedle,
    'a(!0),window.dispatchEvent(new CustomEvent("asteryon:import-progress",{detail:{mode:"excel",stage:"reading",file:h.name,processed:0,total:0,currentItems:[]}}));try{const p=EI(',
  );

  const readyPattern = /if\(!x\.length\)throw new Error\("Nenhum produto válido\.[^"]*"\);let k=0,C=0,v=0;/;
  if (!readyPattern.test(cr)) throw new Error('Marcador de validação da planilha não encontrado.');
  cr = cr.replace(readyPattern, (match) => {
    const base = match.replace(/let k=0,C=0,v=0;$/, '');
    return `${base}window.dispatchEvent(new CustomEvent("asteryon:import-progress",{detail:{mode:"excel",stage:"ready",file:h.name,processed:0,total:x.length,currentItems:x.slice(0,5).map(B=>({code:B.code,name:B.name||B.shortDescription||""}))}}));let k=0,C=0,v=0;`;
  });

  const loopNeedle = 'for(let m=0;m<x.length;m+=300){const S=await Qe.bulkProducts(x.slice(m,m+300),h.name,"spreadsheet");k+=S.inserted,C+=S.updated,v+=S.ignored,g.push(...(S.errors||[]).slice(0,5))}';
  if (!cr.includes(loopNeedle)) throw new Error('Loop de lotes da planilha não encontrado.');
  cr = cr.replace(
    loopNeedle,
    'for(let m=0;m<x.length;m+=300){const S=x.slice(m,m+300);window.dispatchEvent(new CustomEvent("asteryon:import-progress",{detail:{mode:"excel",stage:"importing",file:h.name,processed:m,total:x.length,currentItems:S.slice(0,5).map(B=>({code:B.code,name:B.name||B.shortDescription||""}))}}));const B=await Qe.bulkProducts(S,h.name,"spreadsheet");k+=B.inserted,C+=B.updated,v+=B.ignored,g.push(...(B.errors||[]).slice(0,5)),window.dispatchEvent(new CustomEvent("asteryon:import-progress",{detail:{mode:"excel",stage:"importing",file:h.name,processed:Math.min(m+S.length,x.length),total:x.length,currentItems:S.slice(-5).map(H=>({code:H.code,name:H.name||H.shortDescription||""}))}}))}',
  );

  const reloadNeedle = '}await e.reloadCatalog(),n(`Planilha processada:';
  if (!cr.includes(reloadNeedle)) throw new Error('Marcador de recarga após planilha não encontrado.');
  cr = cr.replace(
    reloadNeedle,
    '}window.dispatchEvent(new CustomEvent("asteryon:import-progress",{detail:{mode:"excel",stage:"refreshing",file:h.name,processed:x.length,total:x.length,currentItems:[]}})),await e.reloadCatalog(),window.dispatchEvent(new CustomEvent("asteryon:import-progress",{detail:{mode:"excel",stage:"complete",file:h.name,processed:x.length,total:x.length,currentItems:[]}})),n(`Planilha processada:',
  );

  const catchNeedle = '}catch(p){n(p instanceof Error?p.message:"Falha na importação.")}finally{a(!1)}}';
  if (!cr.includes(catchNeedle)) throw new Error('Tratamento de erro da planilha não encontrado.');
  cr = cr.replace(
    catchNeedle,
    '}catch(p){const f=p instanceof Error?p.message:"Falha na importação.";window.dispatchEvent(new CustomEvent("asteryon:import-progress",{detail:{mode:"excel",stage:"error",file:h.name,processed:0,total:0,currentItems:[],message:f}})),n(f)}finally{a(!1)}}',
  );

  source = source.slice(0, crStart).concat(cr, source.slice(crEnd));
}

// Limpeza de textos legados: D1 não é mais o banco do sistema. Não fazemos
// substituição global porque nomes técnicos de compatibilidade legada ainda são
// necessários para ler mídias antigas enquanto elas são migradas para Storage.
const supabaseTextReplacements = [
  ['Marketing carregado do D1.', 'Marketing carregado do Supabase.'],
  ['Configuração gravada e recarregada do D1 com normalização aplicada.', 'Configuração gravada e recarregada do Supabase com normalização aplicada.'],
  ['Salvando e validando no D1...', 'Salvando e validando no Supabase...'],
  ['Mídia enviada, vinculada e confirmada no D1.', 'Mídia enviada, vinculada e confirmada no Supabase.'],
  ['D1 OK', 'SUPABASE OK'],
  ['Os produtos cadastrados no D1 serão preservados e vinculados ao novo modelo. Deseja continuar?', 'Os produtos cadastrados no Supabase serão preservados e vinculados ao novo modelo. Deseja continuar?'],
  ['Modelo aplicado com produtos já cadastrados no D1.', 'Modelo aplicado com produtos já cadastrados no Supabase.'],
  ['Modelo atualizado no D1.', 'Modelo atualizado no Supabase.'],
  ['os produtos do D1 são vinculados às vitrines.', 'os produtos do Supabase são vinculados às vitrines.'],
  ['produtos do D1 são vinculados às vitrines.', 'produtos do Supabase são vinculados às vitrines.'],
  ['D1 · v', 'Supabase · v'],
  ['Conectando ao ASTERYON D1', 'Conectando ao ASTERYON'],
  ['Produto D1 ', 'Produto catálogo '],
  ['Produto do D1 ', 'Produto do catálogo '],
  ['Destaques do D1', 'Destaques do catálogo'],
  ['Vitrine automática do D1', 'Vitrine automática do catálogo'],
  ['Preenchido automaticamente pelo catálogo D1.', 'Preenchido automaticamente pelo catálogo Supabase.'],
  ['vinculados ao D1.', 'vinculados ao Supabase.'],
  ['vinculadas ao D1.', 'vinculadas ao Supabase.'],
  ['dados do Lovable dentro do canvas Bolt', 'Catálogo Supabase dentro do editor ASTERYON'],
  ['tags:["Figma","B2B","D1","hierarquia"]', 'tags:["Figma","B2B","Supabase","hierarquia"]'],
  ['tags:["atacado","vitrine","D1"]', 'tags:["atacado","vitrine","Supabase"]'],
];
for (const [from, to] of supabaseTextReplacements) replaceLiteral(from, to);

if (source === original) {
  console.log('Patches V62 do catálogo já aplicados.');
} else {
  await writeFile(assetPath, source);
  console.log('Patches V62 do catálogo aplicados.');
}
