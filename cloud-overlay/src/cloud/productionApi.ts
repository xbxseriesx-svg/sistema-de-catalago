export interface BrandProfile {
  id:string;name:string;slug:string;status:'active'|'inactive';description:string;logoUrl:string;bannerUrl:string;website:string;sortOrder:number;featured:boolean;catalogUrl?:string;featuredProductIds?:string[];launches?:unknown[];
}
export interface MarketingConfig {
  banner:{active:boolean;mediaType:'image'|'video';mediaUrl:string;title:string;subtitle:string;link:string;autoplay:boolean;loop:boolean;muted:boolean};
  videoBanner:{active:boolean;mediaUrl:string;title:string;subtitle:string;autoplay:boolean;loop:boolean;muted:boolean;controls:boolean};
  carousel:{active:boolean;speed:1|1.5|2;loop:boolean;autoplay:boolean;manual:boolean;items:Array<{id:string;url:string;link:string;alt:string}>};
  theme:{mode:'light'|'dark'|'custom';primary:string;secondary:string;background:string;surface:string;text:string};
}
export const DEFAULT_MARKETING:MarketingConfig={banner:{active:false,mediaType:'image',mediaUrl:'',title:'',subtitle:'',link:'',autoplay:true,loop:true,muted:true},videoBanner:{active:false,mediaUrl:'',title:'',subtitle:'',autoplay:true,loop:true,muted:true,controls:false},carousel:{active:false,speed:1,loop:true,autoplay:true,manual:true,items:[]},theme:{mode:'light',primary:'#2563eb',secondary:'#f59e0b',background:'#ffffff',surface:'#f4f4f5',text:'#18181b'}};

async function req<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(path,{...init,credentials:'same-origin',headers:{...(init.body?{'content-type':'application/json'}:{}),...(init.headers||{})}});const payload=await response.json().catch(()=>({ok:false,error:{message:`HTTP ${response.status}`}}));if(!response.ok||payload?.ok===false)throw new Error(payload?.error?.message||`HTTP ${response.status}`);return payload as T}
async function fileBase64(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error(`Não foi possível ler ${file.name}`));reader.onload=()=>resolve(String(reader.result||''));reader.readAsDataURL(file)})}

export const productionApi={
  listBrands:(publicOnly=false)=>req<{ok:true;brands:BrandProfile[]}>(publicOnly?'/api/public/brands':'/api/admin/brands'),
  createBrand:(input:Partial<BrandProfile>&{name:string})=>req<{ok:true;brand:BrandProfile}>('/api/admin/brands',{method:'POST',body:JSON.stringify(input)}),
  updateBrand:(id:string,input:Partial<BrandProfile>&{name:string})=>req<{ok:true;brand:BrandProfile}>(`/api/admin/brands/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(input)}),
  deleteBrand:(id:string)=>req<{ok:true;id:string}>(`/api/admin/brands/${encodeURIComponent(id)}`,{method:'DELETE'}),
  bulkBrands:(brands:unknown[])=>req<{ok:true;inserted:number;updated:number;ignored:number;errors:string[];brands:BrandProfile[]}>('/api/admin/brands/bulk',{method:'POST',body:JSON.stringify({brands})}),
  createHierarchy:(input:{level:'secao'|'categoria';name:string;parentId:string;sortOrder?:number})=>req<{ok:true;id:string}>('/api/admin/hierarchy',{method:'POST',body:JSON.stringify(input)}),
  updateHierarchy:(id:string,input:{name:string;status?:'active'|'inactive';sortOrder?:number})=>req<{ok:true;id:string}>(`/api/admin/hierarchy/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(input)}),
  deleteHierarchy:(id:string)=>req<{ok:true;id:string}>(`/api/admin/hierarchy/${encodeURIComponent(id)}`,{method:'DELETE'}),
  setProductStatus:(id:string,status:'active'|'inactive')=>req<{ok:true;id:string;status:string}>(`/api/admin/products/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({status})}),
  deleteProduct:(id:string)=>req<{ok:true;id:string;code:string}>(`/api/admin/products/${encodeURIComponent(id)}`,{method:'DELETE'}),
  getMarketing:(publicOnly=false)=>req<{ok:true;marketing:MarketingConfig}>(publicOnly?'/api/public/marketing':'/api/admin/marketing').then(r=>r.marketing),
  saveMarketing:(marketing:MarketingConfig)=>req<{ok:true;marketing:MarketingConfig}>('/api/admin/marketing',{method:'PUT',body:JSON.stringify({marketing})}).then(r=>r.marketing),
  uploadMedia:async(file:File,kind:string,entityKey?:string)=>{const dataBase64=await fileBase64(file);return req<{ok:true;mediaKey:string;url:string;deduplicated:boolean;byteSize:number}>('/api/admin/media',{method:'POST',body:JSON.stringify({filename:file.name,contentType:file.type||'application/octet-stream',dataBase64,kind,entityKey})})},
  deleteMedia:(mediaKey:string)=>req<{ok:true;mediaKey:string}>(`/api/admin/media/${encodeURIComponent(mediaKey)}`,{method:'DELETE'}),
};
