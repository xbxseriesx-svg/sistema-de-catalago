import { readFile, writeFile } from 'node:fs/promises';

const assetPath = 'public/assets/index-V60Excel.js';
const original = await readFile(assetPath, 'utf8');
let source = original;

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

// V61: o botão Imagens da Gestão do Catálogo deve abrir o importador dedicado.
// O fluxo antigo carregava imagens dentro do mesmo componente da planilha e não
// oferecia seleção de pasta, o que é inadequado para a carga de vários GB.
const legacyImageControl = /l\.jsxs\("label",\{className:`flex cursor-pointer items-center justify-center gap-2 rounded bg-zinc-800 py-2 text-\[10px\] font-bold \$\{t\?"pointer-events-none opacity-50":""\}`,children:\[l\.jsx\(Xc,\{size:12\}\),"Imagens",l\.jsx\("input",\{hidden:!0,type:"file",accept:"image\/\*",multiple:!0,onChange:o\}\)\]\}\)/;
const v61ImageControl = 'l.jsxs("a",{href:"/importar-imagens.html",target:"_blank",rel:"noopener noreferrer",className:`flex cursor-pointer items-center justify-center gap-2 rounded bg-zinc-800 py-2 text-[10px] font-bold ${t?"pointer-events-none opacity-50":""}`,children:[l.jsx(Xc,{size:12}),"Imagens"]})';

if (legacyImageControl.test(source)) {
  source = source.replace(legacyImageControl, v61ImageControl);
} else if (!source.includes('href:"/importar-imagens.html"')) {
  throw new Error('Não foi possível localizar o botão Imagens para aplicar o vínculo V61.');
}

source = source.replace(
  'A imagem é otimizada sem distorção e associada pelo Código ou EAN.',
  'Planilha importa os dados dos produtos. Imagens abre o importador V61 em lote, com seleção de pasta, conversão WebP e vínculo pelo Código.',
);

if (source === original) {
  console.log('Patches V60/V61 do importador já aplicados.');
} else {
  await writeFile(assetPath, source);
  console.log('Patches V60/V61 do importador aplicados.');
}
