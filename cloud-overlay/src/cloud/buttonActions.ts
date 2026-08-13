import type { EditorNode } from '../editor/types';

export type NodeActionType='none'|'url'|'scroll'|'whatsapp'|'phone'|'email'|'top'|'product-info';
export interface ResolvedNodeAction{type:NodeActionType;value:string;message:string;target:string;inferred:boolean}

function normalize(value:unknown){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function has(text:string,...terms:string[]){return terms.some(term=>text.includes(normalize(term)))}
function base(node:EditorNode,type:NodeActionType,value='',inferred=false):ResolvedNodeAction{return{type,value,message:String(node.props?.actionMessage||'').trim(),target:String(node.props?.actionTarget||'same'),inferred}}

export function inferAnchorId(node:EditorNode):string{
  const explicit=String(node.props?.anchorId||'').trim().replace(/^#/,'');
  if(explicit)return explicit;
  const text=normalize(`${node.name||''} ${node.props?.text||''}`);
  if(has(text,'contato','fale conosco','falar com representante','pre cadastro','pré cadastro','cadastro comercial','solicite contato','atendimento'))return 'contato';
  if(has(text,'depoimento','testemunho','quem compra','clientes falam'))return 'depoimentos';
  if(has(text,'como comprar','como funciona','passo a passo','abastecimento comercial'))return 'como-comprar';
  if(has(text,'quem somos','institucional','sobre a empresa','nossa historia','nossa história','historia','história','tradição'))return 'quem-somos';
  if(has(text,'promocao','promoção','promocoes','promoções','oferta','ofertas','quinzena','campanha de volume'))return 'promocoes';
  if(has(text,'catalogo','catálogo','setores','produtos','mix completo','estrutura automatica','estrutura automática','destaques do d1','vitrine','departamento','categorias'))return 'catalogo';
  return '';
}

export function resolveNodeAction(node:EditorNode):ResolvedNodeAction{
  const explicit=String(node.props?.actionType||'none') as NodeActionType;
  const explicitValue=String(node.props?.actionValue||'').trim();
  const productId=String(node.props?.productId||'').trim();
  if(explicit!=='none'){
    if(explicit==='product-info'&&(productId||explicitValue))return base(node,'product-info',explicitValue||productId,false);
    if(explicit==='top')return base(node,'top','',false);
    if(explicit==='scroll'&&explicitValue)return base(node,'scroll',explicitValue,false);
    if(explicit==='url'&&explicitValue&&(explicitValue.startsWith('/')||explicitValue.startsWith('#')||/^https?:\/\//i.test(explicitValue)))return base(node,'url',explicitValue,false);
    if(explicit==='whatsapp'&&/\d/.test(explicitValue))return base(node,'whatsapp',explicitValue,false);
    if(explicit==='phone'&&/\d/.test(explicitValue))return base(node,'phone',explicitValue,false);
    if(explicit==='email'&&explicitValue.includes('@'))return base(node,'email',explicitValue,false);
  }
  if(node.type!=='button'&&node.type!=='productbutton')return base(node,'none','',false);
  if(productId)return base(node,'product-info',productId,true);
  const label=normalize(`${node.props?.text||''} ${node.name||''}`);
  if(has(label,'area do lojista','área do lojista','abrir editor','entrar','login','administracao','administração'))return base(node,'url','/admin',true);
  if(has(label,'whatsapp')){const configured=String(node.props?.whatsapp||node.props?.phone||'').trim();return configured?base(node,'whatsapp',configured,true):base(node,'scroll','#contato',true)}
  if(has(label,'telefone','ligar')){const configured=String(node.props?.phone||'').trim();return configured?base(node,'phone',configured,true):base(node,'scroll','#contato',true)}
  if(has(label,'email','e-mail')){const configured=String(node.props?.email||'').trim();return configured?base(node,'email',configured,true):base(node,'scroll','#contato',true)}
  if(has(label,'falar com representante','fale com representante','solicitar contato','solicite contato','enviar solicitacao','enviar solicitação','pre cadastro','pré cadastro','quero comprar','comprar agora','fale conosco','contato'))return base(node,'scroll','#contato',true);
  if(has(label,'depoimentos','avaliacoes','avaliações'))return base(node,'scroll','#depoimentos',true);
  if(has(label,'como comprar','como funciona'))return base(node,'scroll','#como-comprar',true);
  if(has(label,'quem somos','saiba mais','nossa historia','nossa história'))return base(node,'scroll','#quem-somos',true);
  if(has(label,'promocoes','promoções','ofertas','ver ofertas'))return base(node,'scroll','#promocoes',true);
  if(has(label,'setores','catalogo','catálogo','ver produtos','ver catalogo','ver catálogo','catalogo completo','catálogo completo','explorar','conhecer produtos','mix completo'))return base(node,'scroll','#catalogo',true);
  if(has(label,'voltar ao topo','inicio','início'))return base(node,'top','',true);
  if(has(label,'informacoes','informações','detalhes','ver produto','adicionar a minha cotacao','adicionar à minha cotação'))return base(node,'scroll','#catalogo',true);
  return base(node,'scroll','#catalogo',true);
}

function scrollToAnchor(value:string){
  const id=String(value||'').replace(/^#/,'').trim();if(!id)return false;
  const target=document.getElementById(id)||Array.from(document.querySelectorAll<HTMLElement>('[data-catalog-anchor]')).find(item=>item.dataset.catalogAnchor===id);
  if(target){target.scrollIntoView({behavior:'smooth',block:'start'});return true}
  const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  if(id==='contato'){window.scrollTo({top:max,behavior:'smooth'});return true}
  if(id==='catalogo'){window.scrollTo({top:Math.min(max,Math.max(window.innerHeight*.8,480)),behavior:'smooth'});return true}
  if(id==='promocoes'){window.scrollTo({top:Math.min(max,Math.max(window.innerHeight*1.6,900)),behavior:'smooth'});return true}
  window.scrollTo({top:0,behavior:'smooth'});return true;
}

async function previewProductInfo(productId:string){
  try{
    const response=await fetch('/api/admin/catalog',{credentials:'same-origin'});if(!response.ok)throw new Error('Falha ao consultar produto');
    const payload=await response.json();const catalog=payload?.catalog||{};const product=(catalog.products||[]).find((item:any)=>String(item.id)===productId);if(!product)throw new Error('Produto não encontrado');
    const hierarchy=new Map((catalog.hierarchy||[]).map((item:any)=>[String(item.id),String(item.name||'')]));const brands=new Map((catalog.brands||[]).map((item:any)=>[String(item.id),String(item.name||'')]));const ncm=product.ncm||product.technical?.NCM||'—';
    const lines=[product.shortDescription||product.name||'Produto',`Código: ${product.code||'—'}`,`EAN: ${product.ean||'—'}`,`NCM: ${ncm}`,`Embalagem: ${product.packaging||product.embalagem||'—'}`,`Unidade: ${product.unit||'—'}`,`Marca: ${brands.get(String(product.brandId||''))||product.brandName||'—'}`,`Departamento: ${hierarchy.get(String(product.departamentoId||''))||product.departamentoName||'—'}`,`Seção: ${hierarchy.get(String(product.secaoId||''))||product.secaoName||'—'}`,`Categoria: ${hierarchy.get(String(product.categoriaId||''))||product.categoriaName||'—'}`];window.alert(lines.join('\n'));
  }catch(error){window.alert(error instanceof Error?error.message:'Não foi possível abrir as informações do produto.')}
}

export function executeNodeAction(node:EditorNode):boolean{
  if(typeof window==='undefined')return false;
  const action=resolveNodeAction(node);const {type,value,message,target}=action;
  if(type==='scroll')return scrollToAnchor(value);
  if(type==='url'){if(value.startsWith('#'))return scrollToAnchor(value);if(target==='new')window.open(value,'_blank','noopener,noreferrer');else window.location.assign(value);return true}
  if(type==='whatsapp'){const digits=value.replace(/\D/g,'');if(!digits)return scrollToAnchor('#contato');window.open(`https://wa.me/${digits}${message?`?text=${encodeURIComponent(message)}`:''}`,'_blank','noopener,noreferrer');return true}
  if(type==='phone'){const phone=value.replace(/[^\d+]/g,'');if(!phone)return scrollToAnchor('#contato');window.location.href=`tel:${phone}`;return true}
  if(type==='email'){if(!value.includes('@'))return scrollToAnchor('#contato');window.location.href=`mailto:${value}${message?`?subject=${encodeURIComponent(message)}`:''}`;return true}
  if(type==='top'){window.scrollTo({top:0,behavior:'smooth'});return true}
  if(type==='product-info'){const id=value||String(node.props?.productId||'').trim();if(!id)return scrollToAnchor('#catalogo');window.dispatchEvent(new CustomEvent('asteryon:product-info',{detail:{productId:id}}));if(window.location.pathname==='/admin'||window.location.pathname.startsWith('/admin/'))void previewProductInfo(id);return true}
  return false;
}
