const { app, BrowserWindow, Menu, shell } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn, execFile } = require('child_process')

const HOST = '127.0.0.1'
let mainWindow = null
let server = null
let baseUrl = ''

const json = (res, status, body) => {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff' })
  res.end(data)
}
const readBody = req => new Promise((resolve,reject) => {
  const chunks=[]; let size=0
  req.on('data', c => { size += c.length; if(size>8*1024*1024){ reject(new Error('Requisição acima do limite local.')); req.destroy(); return } chunks.push(c) })
  req.on('end',()=>{ try{ resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) }catch{ reject(new Error('JSON inválido.')) } })
  req.on('error',reject)
})
function userDir(){ const dir=path.join(app.getPath('userData'),'local-data'); fs.mkdirSync(dir,{recursive:true}); return dir }
function settingsPath(){ return path.join(userDir(),'local-ai.json') }
function loadSettings(){ try{return JSON.parse(fs.readFileSync(settingsPath(),'utf8'))}catch{return {model:'qwen3:4b',research:true}} }
function saveSettings(next){ fs.writeFileSync(settingsPath(),JSON.stringify(next,null,2),'utf8') }

async function ollamaTags(){
  const r = await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(2500)})
  if(!r.ok) throw new Error('Ollama indisponível.')
  return r.json()
}
async function ollamaReady(){ try{ const data=await ollamaTags(); return {ok:true,models:(data.models||[]).map(m=>m.name)} }catch{return {ok:false,models:[]} } }
function runDetached(command,args=[]){
  const child=spawn(command,args,{detached:true,stdio:'ignore',windowsHide:false}); child.unref(); return true
}
async function installOllama(){
  try{ runDetached('winget',['install','-e','--id','Ollama.Ollama','--accept-package-agreements','--accept-source-agreements']); return {ok:true,message:'Instalação do Ollama iniciada pelo Windows. Aguarde concluir e depois clique em Verificar.'} }
  catch{ await shell.openExternal('https://ollama.com/download/windows'); return {ok:true,message:'Abri a página oficial do Ollama. Instale e depois volte ao ASTERYON.'} }
}
async function pullModel(model){
  const safe = String(model||'qwen3:4b').replace(/[^a-zA-Z0-9:._-]/g,'')
  if(!safe) throw new Error('Modelo inválido.')
  try{ runDetached('ollama',['pull',safe]); return {ok:true,message:`Download do modelo ${safe} iniciado. O tamanho pode ser de alguns GB.`} }
  catch{ throw new Error('Ollama não encontrado no PATH. Conclua a instalação e reinicie o ASTERYON.') }
}

function stripHtml(s=''){ return s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim() }
async function webResearch(query){
  const q=encodeURIComponent(String(query||'').slice(0,500))
  try{
    const r=await fetch(`https://html.duckduckgo.com/html/?q=${q}`,{headers:{'User-Agent':'Mozilla/5.0 ASTERYON/1.2'},signal:AbortSignal.timeout(8000)})
    if(!r.ok) return []
    const html=await r.text(); const out=[]
    const re=/<a rel="nofollow" class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
    let m; while((m=re.exec(html)) && out.length<5) out.push({title:stripHtml(m[1]),snippet:stripHtml(m[2])})
    return out
  }catch{return []}
}
function parseJson(text){ const clean=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim(); try{return JSON.parse(clean)}catch{} const a=clean.indexOf('{'), b=clean.lastIndexOf('}'); if(a>=0&&b>a)return JSON.parse(clean.slice(a,b+1)); throw new Error('A IA local não retornou JSON válido.') }
const intents=['theme','background','layout','landing','catalog-structure','copy','banner','campaign','image','design-audit','improve','identity','suggestions']
function sanitize(raw,researchUsed){ return { intent:intents.includes(raw?.intent)?raw.intent:'suggestions', title:String(raw?.title||'Proposta ASTERYON AI').slice(0,200), summary:String(raw?.summary||'').slice(0,2500), structured:raw?.structured&&typeof raw.structured==='object'?raw.structured:{}, findings:Array.isArray(raw?.findings)?raw.findings.slice(0,12):[], imagePrompt:raw?.imagePrompt?String(raw.imagePrompt).slice(0,5000):'', editorPatch:raw?.editorPatch&&typeof raw.editorPatch==='object'?raw.editorPatch:{}, enhancedPrompt:String(raw?.enhancedPrompt||'').slice(0,5000), researchUsed } }
async function generateProposal(body){
  const s=loadSettings(); const status=await ollamaReady(); if(!status.ok) throw new Error('Ollama não está ativo. Abra Configuração da IA e instale/verifique o motor local.')
  const model=String(s.model||'qwen3:4b'); if(!status.models.some(m=>m===model || m.startsWith(model.split(':')[0]+':'))) throw new Error(`Modelo ${model} ainda não está instalado. Clique em Baixar modelo.`)
  const researchRequested=Boolean(body?.researchRequested); const research=researchRequested?await webResearch(body?.prompt):[]
  const context=body?.context||{}
  const system=`Você é ASTERYON AI, assistente local de design, UX, branding, marketing e catálogo digital. Trabalhe SOMENTE no rascunho. Nunca publique. Nunca altere preços ou produtos reais automaticamente. Gere conteúdo original e não copie textos, logos, imagens ou layouts. Pesquisa web, quando houver, é apenas inspiração. Preserve a hierarquia do catálogo; apenas Promoções podem misturar estruturas. Priorize acessibilidade, performance, SEO e mobile. Não gere código executável. Retorne SOMENTE JSON com: intent, title, summary, structured, findings, imagePrompt, enhancedPrompt, editorPatch. editorPatch pode conter apenas designSystem, theme e alterações seguras em blocos existentes; sem URLs, imagens externas, HTML ou código.`
  const inspiration=research.length?`\nINSPIRAÇÃO WEB RESUMIDA (não copiar; apenas tendências):\n${research.map((r,i)=>`${i+1}. ${r.title}: ${r.snippet}`).join('\n')}`:''
  const prompt=`PEDIDO:\n${String(body?.prompt||'').slice(0,10000)}\n\nCONTEXTO DO RASCUNHO:\n${JSON.stringify({pageName:context.pageName,theme:context.theme,designSystem:context.designSystem,blockTypes:context.blockTypes,selectedBlock:context.selectedBlock}).slice(0,16000)}${inspiration}`
  const r=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:prompt}],stream:false,format:'json',options:{temperature:0.5}}),signal:AbortSignal.timeout(180000)})
  const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data?.error||`Falha no Ollama (${r.status}).`)
  return sanitize(parseJson(data?.message?.content||''),research.length>0)
}
async function testAi(){ const s=loadSettings(); const st=await ollamaReady(); if(!st.ok) throw new Error('Ollama não está em execução.'); return {ok:true,message:`Ollama ativo. Modelos: ${st.models.join(', ')||'nenhum'}`,textModel:s.model,imageModel:'não configurado'} }
function contentType(file){ const ext=path.extname(file).toLowerCase(); return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.json':'application/json'})[ext]||'application/octet-stream' }
async function handler(req,res){
  try{
    const url=new URL(req.url,`http://${HOST}`)
    if(url.pathname==='/api/desktop/status'&&req.method==='GET'){ const s=loadSettings(), st=await ollamaReady(); return json(res,200,{desktop:true,configured:st.ok&&st.models.length>0,encryptionAvailable:true,textModel:s.model||'qwen3:4b',imageModel:'local-opcional',onlineResearch:true,imageGeneration:false,dataPath:userDir(),provider:'ollama',ollamaRunning:st.ok,models:st.models}) }
    if(url.pathname==='/api/desktop/settings'&&req.method==='POST'){ const body=await readBody(req); const next={...loadSettings(),model:String(body.textModel||body.model||'qwen3:4b'),research:true}; saveSettings(next); const st=await ollamaReady(); return json(res,200,{ok:true,configured:st.ok&&st.models.length>0,textModel:next.model,imageModel:'local-opcional'}) }
    if(url.pathname==='/api/desktop/install-ollama'&&req.method==='POST') return json(res,200,await installOllama())
    if(url.pathname==='/api/desktop/pull-model'&&req.method==='POST'){ const body=await readBody(req); return json(res,200,await pullModel(body.model)) }
    if(url.pathname==='/api/desktop/test-ai'&&req.method==='POST') return json(res,200,await testAi())
    if(url.pathname==='/api/ai/proposal'&&req.method==='POST') return json(res,200,await generateProposal(await readBody(req)))
    if(url.pathname==='/api/ai/image'&&req.method==='POST') return json(res,501,{error:'Geração local de imagens não está incluída nesta versão leve. O ASTERYON gera o briefing original; ComfyUI poderá ser conectado como módulo opcional.'})
    const dist=path.join(app.getAppPath(),'dist'); let relative=decodeURIComponent(url.pathname).replace(/^\/+/, ''); if(!relative||relative==='admin'||relative.startsWith('admin/'))relative='index.html'; let file=path.join(dist,relative); if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(dist,'index.html'); const data=fs.readFileSync(file)
    res.writeHead(200,{'Content-Type':contentType(file),'Content-Length':data.length,'Cache-Control':file.endsWith('index.html')?'no-store':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self' data: blob:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; script-src 'self'; connect-src 'self' http://127.0.0.1:11434 https://html.duckduckgo.com; frame-src 'self'; object-src 'none'; base-uri 'self'"}); return res.end(data)
  }catch(error){ console.error(error); return json(res,500,{error:error?.message||'Erro local do ASTERYON.'}) }
}
function startServer(){ return new Promise((resolve,reject)=>{ server=http.createServer(handler); server.on('error',reject); server.listen(0,HOST,()=>{ const a=server.address(); baseUrl=`http://${HOST}:${a.port}`; resolve(baseUrl) }) }) }
function createWindow(){ mainWindow=new BrowserWindow({width:1540,height:960,minWidth:1120,minHeight:720,backgroundColor:'#101827',autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}}); mainWindow.loadURL(`${baseUrl}/admin`); mainWindow.on('closed',()=>mainWindow=null) }
app.whenReady().then(async()=>{ Menu.setApplicationMenu(null); await startServer(); createWindow(); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()}) })
app.on('window-all-closed',()=>{ if(process.platform!=='darwin')app.quit() })
app.on('before-quit',()=>{ if(server)server.close() })
