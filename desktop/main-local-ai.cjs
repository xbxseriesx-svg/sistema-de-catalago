const { app, BrowserWindow, Menu, shell } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const HOST = '127.0.0.1'
const OLLAMA = 'http://127.0.0.1:11434'
let mainWindow = null
let server = null
let baseUrl = ''
let lastAiError = null

const json = (res, status, body) => { const data=Buffer.from(JSON.stringify(body)); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(data) }
const readBody = req => new Promise((resolve,reject)=>{ const chunks=[]; let size=0; req.on('data',c=>{size+=c.length;if(size>8*1024*1024){reject(new Error('Requisição acima do limite local.'));req.destroy();return}chunks.push(c)}); req.on('end',()=>{try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{})}catch{reject(new Error('JSON inválido.'))}}); req.on('error',reject) })
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms))
function userDir(){const dir=path.join(app.getPath('userData'),'local-data');fs.mkdirSync(dir,{recursive:true});return dir}
function settingsPath(){return path.join(userDir(),'local-ai.json')}
function loadSettings(){try{return JSON.parse(fs.readFileSync(settingsPath(),'utf8'))}catch{return {model:'qwen3:4b',research:true,validatedModel:'',validatedAt:''}}}
function saveSettings(next){fs.writeFileSync(settingsPath(),JSON.stringify(next,null,2),'utf8')}
function normalizeModel(value){return String(value||'').trim().toLowerCase()}
function modelInstalled(models,selected){const target=normalizeModel(selected);return models.some(name=>{const current=normalizeModel(name);return current===target||(!target.includes(':')&&current===`${target}:latest`)})}
function localAppData(){return process.env.LOCALAPPDATA || path.join(app.getPath('home'),'AppData','Local')}
function ollamaProgramDir(){return path.join(localAppData(),'Programs','Ollama')}
function ollamaBinaryCandidates(){return [path.join(ollamaProgramDir(),'ollama.exe'),path.join(ollamaProgramDir(),'ollama app.exe'),path.join(ollamaProgramDir(),'Ollama.exe')]}
function findOllamaBinary(){return ollamaBinaryCandidates().find(file=>fs.existsSync(file)) || ''}
function serverLogPath(){return path.join(localAppData(),'Ollama','server.log')}
function readLogTail(file,maxChars=10000){try{const text=fs.readFileSync(file,'utf8');return text.slice(-maxChars)}catch{return ''}}
function recordAiError(error,stage='unknown'){lastAiError={at:new Date().toISOString(),stage,message:error?.message||String(error)}}

async function ollamaTags(){const r=await fetch(`${OLLAMA}/api/tags`,{signal:AbortSignal.timeout(3500)});if(!r.ok)throw new Error(`Ollama respondeu ${r.status} ao listar modelos.`);return r.json()}
async function ollamaVersion(){try{const r=await fetch(`${OLLAMA}/api/version`,{signal:AbortSignal.timeout(3000)});if(!r.ok)return'';const data=await r.json();return String(data.version||'')}catch{return''}}
async function ollamaReady(){try{const data=await ollamaTags();return {ok:true,models:(data.models||[]).map(m=>m.name),version:await ollamaVersion()}}catch{return {ok:false,models:[],version:''}}}
function runDetached(command,args=[]){const child=spawn(command,args,{detached:true,stdio:'ignore',windowsHide:true});child.on('error',error=>recordAiError(error,'spawn'));child.unref();return true}
function startDetectedOllama(){const binary=findOllamaBinary();if(binary){const base=path.basename(binary).toLowerCase();if(base==='ollama.exe')runDetached(binary,['serve']);else runDetached(binary,[]);return binary}try{runDetached('ollama',['serve']);return 'PATH:ollama'}catch{return''}}
async function waitForOllama(maxSeconds=35){for(let i=0;i<maxSeconds;i++){const ready=await ollamaReady();if(ready.ok)return ready;await sleep(1000)}return {ok:false,models:[],version:''}}

async function installOllama(){
  const active=await ollamaReady();if(active.ok)return {ok:true,message:`Ollama já está ativo${active.version?` · v${active.version}`:''}.`}
  const existing=findOllamaBinary();if(existing){startDetectedOllama();const ready=await waitForOllama(20);if(ready.ok)return {ok:true,message:`Ollama encontrado e iniciado em ${existing}.`}}
  try{runDetached('winget',['install','-e','--id','Ollama.Ollama','--accept-package-agreements','--accept-source-agreements']);return {ok:true,message:'Instalação do Ollama iniciada pelo Windows. O ASTERYON continuará verificando até o serviço local aparecer.'}}
  catch(error){recordAiError(error,'install-ollama');await shell.openExternal('https://ollama.com/download/windows');return {ok:true,message:'Não foi possível iniciar o winget. A página oficial do Ollama foi aberta para instalação.'}}
}
async function ensureOllamaRunning(){
  let ready=await ollamaReady();if(ready.ok)return ready
  startDetectedOllama();ready=await waitForOllama(25);if(ready.ok)return ready
  const binary=findOllamaBinary(),log=readLogTail(serverLogPath(),3500)
  const hint=binary?`Executável encontrado em ${binary}, mas a API local não respondeu.`:'O executável do Ollama não foi encontrado na instalação padrão nem no PATH.'
  const error=new Error(`${hint} Abra Configuração da IA > Diagnóstico. ${log?'O log local contém detalhes adicionais.':''}`);recordAiError(error,'ensure-running');throw error
}
async function pullModel(model){
  const safe=String(model||'qwen3:4b').replace(/[^a-zA-Z0-9:._-]/g,'');if(!safe)throw new Error('Modelo inválido.')
  await ensureOllamaRunning();const current=await ollamaReady();if(modelInstalled(current.models,safe))return {ok:true,message:`O modelo ${safe} já está instalado.`}
  try{
    const r=await fetch(`${OLLAMA}/api/pull`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:safe,stream:false}),signal:AbortSignal.timeout(60*60*1000)})
    const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||`Falha HTTP ${r.status} ao baixar ${safe}.`)
    const after=await ollamaReady();if(!modelInstalled(after.models,safe))throw new Error(`O download terminou, mas o modelo ${safe} não apareceu em /api/tags.`)
    return {ok:true,message:`Modelo ${safe} baixado e encontrado no Ollama.`}
  }catch(error){recordAiError(error,'pull-model');throw error}
}

function stripHtml(s=''){return s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
async function webResearch(query){const q=encodeURIComponent(String(query||'').slice(0,500));try{const r=await fetch(`https://html.duckduckgo.com/html/?q=${q}`,{headers:{'User-Agent':'Mozilla/5.0 ASTERYON/1.6'},signal:AbortSignal.timeout(10000)});if(!r.ok)return[];const html=await r.text(),out=[];const re=/<a rel="nofollow" class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))&&out.length<5)out.push({title:stripHtml(m[1]),snippet:stripHtml(m[2])});return out}catch{return[]}}
function parseJson(text){const clean=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();try{return JSON.parse(clean)}catch{}const a=clean.indexOf('{'),b=clean.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(clean.slice(a,b+1));throw new Error('A IA respondeu, mas o JSON estruturado não pôde ser validado.')}
const intents=['theme','background','layout','landing','catalog-structure','copy','banner','campaign','image','design-audit','improve','identity','suggestions']
function sanitize(raw,researchUsed){return {intent:intents.includes(raw?.intent)?raw.intent:'suggestions',title:String(raw?.title||'Proposta ASTERYON AI').slice(0,200),summary:String(raw?.summary||'').slice(0,2500),structured:raw?.structured&&typeof raw.structured==='object'?raw.structured:{},findings:Array.isArray(raw?.findings)?raw.findings.slice(0,12):[],imagePrompt:raw?.imagePrompt?String(raw.imagePrompt).slice(0,5000):'',editorPatch:raw?.editorPatch&&typeof raw.editorPatch==='object'?raw.editorPatch:{},enhancedPrompt:String(raw?.enhancedPrompt||'').slice(0,5000),researchUsed}}
async function chatLocal(model,messages,timeout=240000){
  try{const r=await fetch(`${OLLAMA}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages,stream:false,format:'json',think:false,keep_alive:'10m',options:{temperature:0.35,num_ctx:8192}}),signal:AbortSignal.timeout(timeout)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||`Falha no Ollama (${r.status}).`);if(!data?.message?.content)throw new Error('O Ollama respondeu sem conteúdo.');return data}catch(error){recordAiError(error,'chat');throw error}
}
async function generateProposal(body){
  const s=loadSettings(),status=await ensureOllamaRunning(),model=String(s.model||'qwen3:4b')
  if(!modelInstalled(status.models,model))throw new Error(`O modelo ${model} não está instalado. Use Preparar IA.`)
  if(normalizeModel(s.validatedModel)!==normalizeModel(model))throw new Error(`O modelo ${model} ainda não foi validado. Use Preparar IA para executar o autoteste.`)
  const researchRequested=Boolean(body?.researchRequested),research=researchRequested?await webResearch(body?.prompt):[],context=body?.context||{}
  const system=`Você é ASTERYON AI, assistente local de design, UX, branding, marketing e catálogo digital. Trabalhe SOMENTE no rascunho. Nunca publique. Nunca altere preços ou produtos reais automaticamente. Gere conteúdo original e não copie textos, logos, imagens ou layouts. Pesquisa web, quando houver, é apenas inspiração. Preserve a hierarquia do catálogo; apenas Promoções podem misturar estruturas. Priorize acessibilidade, performance, SEO e mobile. Não gere código executável. Retorne SOMENTE JSON com: intent, title, summary, structured, findings, imagePrompt, enhancedPrompt, editorPatch. editorPatch pode conter apenas designSystem, theme e alterações seguras em blocos existentes; sem URLs, imagens externas, HTML ou código.`
  const inspiration=research.length?`\nINSPIRAÇÃO WEB RESUMIDA (não copiar):\n${research.map((r,i)=>`${i+1}. ${r.title}: ${r.snippet}`).join('\n')}`:''
  const prompt=`PEDIDO:\n${String(body?.prompt||'').slice(0,10000)}\n\nCONTEXTO DO RASCUNHO:\n${JSON.stringify({pageName:context.pageName,theme:context.theme,designSystem:context.designSystem,blockTypes:context.blockTypes,selectedBlock:context.selectedBlock}).slice(0,18000)}${inspiration}`
  const data=await chatLocal(model,[{role:'system',content:system},{role:'user',content:prompt}]);return sanitize(parseJson(data?.message?.content||''),research.length>0)
}
async function testAi(){
  const s=loadSettings(),st=await ensureOllamaRunning(),model=String(s.model||'qwen3:4b');if(!modelInstalled(st.models,model))throw new Error(`O modelo ${model} ainda não está instalado.`)
  const data=await chatLocal(model,[{role:'user',content:'Responda SOMENTE com este JSON: {"status":"ASTERYON_OK"}'}],180000),parsed=parseJson(data?.message?.content||'')
  if(parsed?.status!=='ASTERYON_OK')throw new Error('O modelo respondeu, mas o autoteste ASTERYON não foi confirmado.')
  saveSettings({...s,validatedModel:model,validatedAt:new Date().toISOString()});lastAiError=null
  return {ok:true,message:`IA local pronta e testada: Ollama ${st.version||''} + ${model}`.trim(),textModel:model,imageModel:'briefing-local'}
}
async function diagnostics(){
  const s=loadSettings(),st=await ollamaReady(),model=String(s.model||'qwen3:4b'),binary=findOllamaBinary(),logFile=serverLogPath(),selectedInstalled=st.ok&&modelInstalled(st.models,model),validated=selectedInstalled&&normalizeModel(s.validatedModel)===normalizeModel(model)
  return {ollamaRunning:st.ok,ollamaVersion:st.version||'',binaryDetected:Boolean(binary),binaryPath:binary||'',programDir:ollamaProgramDir(),models:st.models,selectedModel:model,selectedInstalled,validated,validatedAt:s.validatedAt||'',serverLogPath:logFile,serverLogTail:readLogTail(logFile,8000),lastError:lastAiError}
}
function contentType(file){const ext=path.extname(file).toLowerCase();return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.json':'application/json'})[ext]||'application/octet-stream'}
async function handler(req,res){
  try{
    const url=new URL(req.url,`http://${HOST}`)
    if(url.pathname==='/api/desktop/status'&&req.method==='GET'){const s=loadSettings(),st=await ollamaReady(),model=String(s.model||'qwen3:4b'),selectedInstalled=st.ok&&modelInstalled(st.models,model),configured=selectedInstalled&&normalizeModel(s.validatedModel)===normalizeModel(model),setupState=!st.ok?'ollama-offline':!selectedInstalled?'model-missing':!configured?'test-required':'ready';return json(res,200,{desktop:true,configured,encryptionAvailable:true,textModel:model,imageModel:'briefing-local',onlineResearch:true,imageGeneration:false,dataPath:userDir(),provider:'ollama',ollamaRunning:st.ok,ollamaVersion:st.version,models:st.models,setupState,binaryDetected:Boolean(findOllamaBinary()),validatedAt:s.validatedAt||''})}
    if(url.pathname==='/api/desktop/diagnostics'&&req.method==='GET')return json(res,200,await diagnostics())
    if(url.pathname==='/api/desktop/open-ollama-log'&&req.method==='POST'){const file=serverLogPath();if(fs.existsSync(file))shell.showItemInFolder(file);else shell.openPath(path.dirname(file));return json(res,200,{ok:true})}
    if(url.pathname==='/api/desktop/settings'&&req.method==='POST'){const body=await readBody(req),previous=loadSettings(),model=String(body.textModel||body.model||'qwen3:4b'),same=normalizeModel(previous.model)===normalizeModel(model),next={...previous,model,research:true,validatedModel:same?previous.validatedModel:'',validatedAt:same?previous.validatedAt:''};saveSettings(next);const st=await ollamaReady(),installed=st.ok&&modelInstalled(st.models,next.model),configured=installed&&normalizeModel(next.validatedModel)===normalizeModel(next.model);return json(res,200,{ok:true,configured,textModel:next.model,imageModel:'briefing-local'})}
    if(url.pathname==='/api/desktop/install-ollama'&&req.method==='POST')return json(res,200,await installOllama())
    if(url.pathname==='/api/desktop/start-ollama'&&req.method==='POST'){startDetectedOllama();const st=await waitForOllama(25);if(!st.ok)throw new Error('O Ollama foi iniciado, mas a API local não respondeu. Consulte Diagnóstico.');return json(res,200,{ok:true,message:`Ollama ativo${st.version?` · v${st.version}`:''}.`})}
    if(url.pathname==='/api/desktop/pull-model'&&req.method==='POST'){const body=await readBody(req);return json(res,200,await pullModel(body.model))}
    if(url.pathname==='/api/desktop/test-ai'&&req.method==='POST')return json(res,200,await testAi())
    if(url.pathname==='/api/ai/proposal'&&req.method==='POST')return json(res,200,await generateProposal(await readBody(req)))
    if(url.pathname==='/api/ai/image'&&req.method==='POST')return json(res,501,{error:'Geração gráfica local ainda não está instalada. O ASTERYON cria briefing original de imagem nesta versão.'})
    const dist=path.join(app.getAppPath(),'dist');let relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');if(!relative||relative==='admin'||relative.startsWith('admin/'))relative='index.html';let file=path.join(dist,relative);if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(dist,'index.html');const data=fs.readFileSync(file)
    res.writeHead(200,{'Content-Type':contentType(file),'Content-Length':data.length,'Cache-Control':file.endsWith('index.html')?'no-store':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self' data: blob:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; script-src 'self'; connect-src 'self' http://127.0.0.1:11434 https://html.duckduckgo.com; frame-src 'self'; object-src 'none'; base-uri 'self'"});return res.end(data)
  }catch(error){recordAiError(error,'http-handler');console.error(error);return json(res,500,{error:error?.message||'Erro local do ASTERYON.'})}
}
function startServer(){return new Promise((resolve,reject)=>{server=http.createServer(handler);server.on('error',reject);server.listen(0,HOST,()=>{const a=server.address();baseUrl=`http://${HOST}:${a.port}`;resolve(baseUrl)})})}
function createWindow(){mainWindow=new BrowserWindow({width:1540,height:960,minWidth:1120,minHeight:720,backgroundColor:'#101827',autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});mainWindow.loadURL(`${baseUrl}/admin`);mainWindow.on('closed',()=>mainWindow=null)}
app.whenReady().then(async()=>{Menu.setApplicationMenu(null);await startServer();createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
app.on('before-quit',()=>{if(server)server.close()})
