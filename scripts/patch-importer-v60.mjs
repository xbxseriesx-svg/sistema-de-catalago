import { readFile, writeFile } from 'node:fs/promises';

const assetPath = 'public/assets/index-V60Excel.js';
const source = await readFile(assetPath, 'utf8');
const start = source.indexOf('function TY(e)');
const end = source.indexOf('function _Y(e,t)', start);

if (start < 0 || end < 0) throw new Error('Bundle incompatível com o patch do importador V60.');

const oldRegion = source.slice(start, end);
const newRegion = `function TY(e){const t=Jt(e,["codigo","código","cod produto","codigo produto","código produto","codproduto","sku","code"]),a=Jt(e,["descricao","descrição","descricao do produto","descrição do produto","produto","nome"]),r=Jt(e,["departamento","descricao do departamento","descrição do departamento","nome do departamento","department"]),n=Jt(e,["secao","seção","descricao da secao","descrição da seção","nome da secao","nome da seção","section"]),i=Jt(e,["categoria","nome da categoria","descricao da categoria","descrição da categoria","category"]);if(!t||!a||!r||!n||!i)return null;
const o=Jt(e,["ean","gtin","codigo barras","código de barras","unidade venda ean","unidade venda ean8 upc12 ean13 e dun14"]),s=Jt(e,["ncm"]),d=Jt(e,["embalagem"]),h=Jt(e,["unidade","unit","un","descricao da unidade","descrição da unidade"])||"UN",u=Jt(e,["embalagem master"]),p=Jt(e,["descricao da unidade_1","descrição da unidade_1","descricao da unidade 1","descrição da unidade 1","unidade master descricao","descrição unidade master"]),f=Jt(e,["ncm excecao","ncm + exceção","ncm + excecao"]),y=Jt(e,["unidade master ean","unidade master ean8 upc12 ean13 e dun14"]),x=GA(Jt(e,["preco","preço","valor"])),k=GA(Jt(e,["preco promocional","preço promocional","promo"])),C=GA(Jt(e,["estoque","stock","saldo"])),v={};for(const[g,m]of Object.entries(e)){const S=String(m??"").trim();S&&(v[g]=S)}const b={NCM:s,"NCM + Exceção":f,Embalagem:d,"Descrição da unidade":h,"Embalagem Master":u,"Descrição da unidade Master":p,"Unidade Venda EAN":o,"Unidade Master EAN":y};return{code:t,name:a,shortDescription:a,longDescription:Jt(e,["descricao longa","descrição longa","detalhes"])||a,ean:o,ncm:s,packaging:d,unit:h,price:x,promoPrice:k,stock:C,brandName:Jt(e,["marca","brand"]),departamentoName:r,secaoName:n,categoriaName:i,technical:b,attributes:{...v,embalagemMaster:u,unidadeMaster:p,ncmExcecao:f,unidadeVendaEan:o,unidadeMasterEan:y},sourceColumns:v,tags:[],status:/inativ/i.test(Jt(e,["status","situacao"]))?"inativo":"ativo",priceMode:x!==null?"valor":"consulte"}}
`;

if (oldRegion === newRegion) {
  console.log('Patch do importador V60 já aplicado.');
} else {
  const updated = source
    .slice(0, start)
    .concat(newRegion, source.slice(end))
    .replace(
      /Obrigatórios: Código, Descrição, Departamento, Seção e Categoria\. Departamento aceita somente [\s\S]*?A marca é criada\/vinculada automaticamente\./,
      'Obrigatórios: Código, Descrição, Descrição do departamento, Descrição da seção e Nome da categoria. A hierarquia e a marca são criadas/vinculadas automaticamente.',
    );
  await writeFile(assetPath, updated);
  console.log('Patch do importador V60 aplicado.');
}
