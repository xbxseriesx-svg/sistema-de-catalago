const { app, BrowserWindow, safeStorage, Menu, shell } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const HOST = '127.0.0.1'
let mainWindow = null
let server = null
let baseUrl = ''

const json = (res, status, body) => {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(data)
}

const readBody = req => new Promise((resolve, reject) => {
  const chunks = []
  let size = 0
  req.on('data', chunk => {
    size += chunk.length
    if (size > 8 * 1024 * 1024) {
      reject(new Error('Requisição acima do limite local.'))
      req.destroy()
      return
    }
    chunks.push(chunk)
  })
  req.on('end', () => {
    try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) }
    catch { reject(new Error('JSON inválido.')) }
  })
  req.on('error', reject)
})

function userDir() {
  const dir = path.join(app.getPath('userData'), 'local-data')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
function settingsPath() { return path.join(userDir(), 'settings.json') }
function generatedDir() {
  const dir = path.join(userDir(), 'generated-images')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))
  } catch {
    return { textModel: 'gpt-5.6-luna', imageModel: 'gpt-image-2', encryptedKey: '' }
  }
}
function saveSettings(next) {
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 })
}
function getApiKey() {
  const stored = loadSettings()
  if (!stored.encryptedKey) return ''
  if (!safeStorage.isEncryptionAvailable()) throw new Error('A proteção de credenciais do Windows não está disponível.')
  return safeStorage.decryptString(Buffer.from(stored.encryptedKey, 'base64'))
}
function setApiKey(apiKey, textModel, imageModel) {
  const current = loadSettings()
  const next = {
    ...current,
    textModel: String(textModel || current.textModel || 'gpt-5.6-luna'),
    imageModel: String(imageModel || current.imageModel || 'gpt-image-2'),
  }
  if (apiKey) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Não foi possível proteger a chave usando o Windows.')
    next.encryptedKey = safeStorage.encryptString(String(apiKey).trim()).toString('base64')
  }
  saveSettings(next)
  return next
}

async function openAiRequest(endpoint, payload) {
  const key = getApiKey()
  if (!key) throw new Error('Configure a API Key da OpenAI no ASTERYON AI.')
  const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Falha na OpenAI (${response.status}).`
    throw new Error(message)
  }
  return data
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text
  const parts = []
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text)
    }
  }
  return parts.join('\n').trim()
}

function parseJsonFromModel(text) {
  const clean = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try { return JSON.parse(clean) } catch {}
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1))
  throw new Error('A IA não retornou uma proposta estruturada válida.')
}

const allowedIntents = ['theme','background','layout','landing','catalog-structure','copy','banner','campaign','image','design-audit','improve','identity','suggestions']

function sanitizeRemoteProposal(raw, researchRequested) {
  const intent = allowedIntents.includes(raw?.intent) ? raw.intent : 'suggestions'
  const findings = Array.isArray(raw?.findings) ? raw.findings.slice(0, 12).map(item => ({
    severity: ['info','warning','critical'].includes(item?.severity) ? item.severity : 'info',
    area: ['contrast','typography','mobile','spacing','hierarchy','accessibility','seo','performance'].includes(item?.area) ? item.area : 'hierarchy',
    title: String(item?.title || 'Sugestão').slice(0, 160),
    description: String(item?.description || '').slice(0, 1200),
    suggestion: String(item?.suggestion || '').slice(0, 1200),
  })) : []
  return {
    intent,
    title: String(raw?.title || 'Proposta ASTERYON AI').slice(0, 200),
    summary: String(raw?.summary || '').slice(0, 2500),
    structured: raw?.structured && typeof raw.structured === 'object' ? raw.structured : {},
    findings,
    imagePrompt: raw?.imagePrompt ? String(raw.imagePrompt).slice(0, 5000) : '',
    editorPatch: raw?.editorPatch && typeof raw.editorPatch === 'object' ? raw.editorPatch : {},
    enhancedPrompt: String(raw?.enhancedPrompt || '').slice(0, 5000),
    researchUsed: Boolean(researchRequested),
  }
}

async function generateProposal(body) {
  const settings = loadSettings()
  const researchRequested = Boolean(body?.researchRequested)
  const context = body?.context || {}
  const system = `Você é ASTERYON AI, diretor de arte, UX, branding, marketing e conteúdo integrado ao ASTERYON Catálogo Digital.

REGRAS INEGOCIÁVEIS:
- Trabalhe SOMENTE sobre rascunhos. Nunca publique e nunca altere produção.
- Fluxo obrigatório: Gerar -> Preview -> Aprovar -> Aplicar ao Rascunho.
- Não altere preços, produtos reais ou dados destrutivos automaticamente.
- Gere conteúdo original. Não copie textos, slogans, logos, banners, imagens ou layouts de terceiros.
- Quando pesquisa web estiver habilitada, use-a APENAS como inspiração para tendências visuais, datas comemorativas, paletas, branding, marketing, UX/UI, referências de campanhas e padrões modernos.
- Não inclua imagens ou URLs encontradas na web na proposta.
- Preserve a hierarquia do catálogo; somente Promoções podem misturar produtos de estruturas diferentes.
- Priorize acessibilidade, performance, SEO e mobile.
- Não gere HTML, JavaScript, CSS executável ou qualquer código.

Retorne SOMENTE um objeto JSON com:
{
  "intent": "theme|background|layout|landing|catalog-structure|copy|banner|campaign|image|design-audit|improve|identity|suggestions",
  "title": "...",
  "summary": "...",
  "structured": {},
  "findings": [{"severity":"info|warning|critical","area":"contrast|typography|mobile|spacing|hierarchy|accessibility|seo|performance","title":"...","description":"...","suggestion":"..."}],
  "imagePrompt": "prompt original para imagem quando fizer sentido",
  "enhancedPrompt": "descrição consolidada do que deve ser aplicado no editor",
  "editorPatch": {
    "designSystem": {"primaryColor":"#hex","secondaryColor":"#hex","accentColor":"#hex","pageBackground":"#hex","cardBackground":"#hex","primaryFont":"nome","secondaryFont":"nome","cardRadius":12,"buttonRadius":10,"borderColor":"#hex","shadow":"...","spacingUnit":8},
    "theme": {"name":"nome","enabled":true,"intensity":50,"particles":true,"animateDesktop":true,"animateMobile":true},
    "blocks": [{"type":"hero|banner|showcase|text|button|header|footer","index":0,"props":{},"style":{},"desktop":{},"tablet":{},"mobile":{}}]
  }
}
O editorPatch deve ser pequeno e conter apenas propriedades visuais ou textos originais. Nunca use backgroundImage, image, URL externa, html ou código.`

  const user = `PEDIDO DO ADMINISTRADOR:\n${String(body?.prompt || '').slice(0, 12000)}\n\nCONTEXTO DO RASCUNHO:\n${JSON.stringify({
    pageName: context.pageName,
    theme: context.theme,
    designSystem: context.designSystem,
    blockTypes: context.blockTypes,
    selectedBlock: context.selectedBlock,
  }).slice(0, 18000)}`

  const payload = {
    model: settings.textModel || 'gpt-5.6-luna',
    input: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (researchRequested) payload.tools = [{ type: 'web_search' }]
  const response = await openAiRequest('responses', payload)
  return sanitizeRemoteProposal(parseJsonFromModel(extractOutputText(response)), researchRequested)
}

async function generateImage(body) {
  const settings = loadSettings()
  const prompt = String(body?.prompt || '').trim()
  if (!prompt) throw new Error('Informe o que deseja gerar.')
  const safePrompt = `${prompt}\n\nCrie uma composição original para catálogo digital. Não reproduza logotipos, marcas registradas, personagens protegidos, layouts de sites ou obras de terceiros. Não inclua texto ilegível. Visual profissional, acessível e adequado a uso comercial.`
  const size = ['1024x1024','1024x1536','1536x1024','auto'].includes(body?.size) ? body.size : '1536x1024'
  const quality = ['low','medium','high','auto'].includes(body?.quality) ? body.quality : 'medium'
  const response = await openAiRequest('images/generations', {
    model: settings.imageModel || 'gpt-image-2',
    prompt: safePrompt,
    size,
    quality,
    output_format: 'png',
  })
  const encoded = response?.data?.[0]?.b64_json
  if (!encoded) throw new Error('A API não retornou os dados da imagem.')
  const file = `asteryon-ai-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`
  fs.writeFileSync(path.join(generatedDir(), file), Buffer.from(encoded, 'base64'))
  return { url: `/local-assets/${encodeURIComponent(file)}`, fileName: file, prompt: safePrompt }
}

async function testConnection() {
  const settings = loadSettings()
  const response = await openAiRequest('responses', {
    model: settings.textModel || 'gpt-5.6-luna',
    input: 'Responda apenas com: ASTERYON_OK',
  })
  const text = extractOutputText(response)
  return { ok: Boolean(text), message: text || 'Conexão realizada.', textModel: settings.textModel, imageModel: settings.imageModel }
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase()
  return ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon', '.json':'application/json' })[ext] || 'application/octet-stream'
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${HOST}`)
    if (url.pathname === '/api/desktop/status' && req.method === 'GET') {
      const settings = loadSettings()
      return json(res, 200, {
        desktop: true,
        configured: Boolean(settings.encryptedKey),
        encryptionAvailable: safeStorage.isEncryptionAvailable(),
        textModel: settings.textModel || 'gpt-5.6-luna',
        imageModel: settings.imageModel || 'gpt-image-2',
        onlineResearch: true,
        imageGeneration: true,
        dataPath: userDir(),
      })
    }
    if (url.pathname === '/api/desktop/settings' && req.method === 'POST') {
      const body = await readBody(req)
      const saved = setApiKey(body.apiKey, body.textModel, body.imageModel)
      return json(res, 200, { ok: true, configured: Boolean(saved.encryptedKey), textModel: saved.textModel, imageModel: saved.imageModel })
    }
    if (url.pathname === '/api/desktop/test-ai' && req.method === 'POST') return json(res, 200, await testConnection())
    if (url.pathname === '/api/ai/proposal' && req.method === 'POST') return json(res, 200, await generateProposal(await readBody(req)))
    if (url.pathname === '/api/ai/image' && req.method === 'POST') return json(res, 200, await generateImage(await readBody(req)))
    if (url.pathname.startsWith('/local-assets/') && req.method === 'GET') {
      const name = path.basename(decodeURIComponent(url.pathname.slice('/local-assets/'.length)))
      const file = path.join(generatedDir(), name)
      if (!fs.existsSync(file)) return json(res, 404, { error: 'Arquivo não encontrado.' })
      const data = fs.readFileSync(file)
      res.writeHead(200, { 'Content-Type': contentType(file), 'Content-Length': data.length, 'Cache-Control': 'private, max-age=31536000', 'X-Content-Type-Options': 'nosniff' })
      return res.end(data)
    }

    const dist = path.join(app.getAppPath(), 'dist')
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    if (!relative || relative === 'admin' || relative.startsWith('admin/')) relative = 'index.html'
    let file = path.join(dist, relative)
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
    const data = fs.readFileSync(file)
    res.writeHead(200, {
      'Content-Type': contentType(file),
      'Content-Length': data.length,
      'Cache-Control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'",
    })
    return res.end(data)
  } catch (error) {
    console.error(error)
    return json(res, 500, { error: error?.message || 'Erro local do ASTERYON.' })
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer(handler)
    server.on('error', reject)
    server.listen(0, HOST, () => {
      const address = server.address()
      baseUrl = `http://${HOST}:${address.port}`
      resolve(baseUrl)
    })
  })
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'ASTERYON', submenu: [
      { label: 'Portal Público', click: () => mainWindow?.loadURL(`${baseUrl}/`) },
      { label: 'Painel Administrativo', click: () => mainWindow?.loadURL(`${baseUrl}/admin`) },
      { type: 'separator' },
      { label: 'Sair', role: 'quit' },
    ]},
    { label: 'Visualizar', submenu: [
      { role: 'reload', label: 'Recarregar' },
      { role: 'togglefullscreen', label: 'Tela cheia' },
      { role: 'resetzoom', label: 'Zoom padrão' },
      { role: 'zoomin', label: 'Aumentar zoom' },
      { role: 'zoomout', label: 'Diminuir zoom' },
    ]},
    { label: 'Ajuda', submenu: [
      { label: 'Abrir pasta de dados locais', click: () => shell.openPath(userDir()) },
    ]},
  ])
}

async function createWindow() {
  await startServer()
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#07111f',
    title: 'ASTERYON Catálogo Digital',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })
  Menu.setApplicationMenu(buildMenu())
  await mainWindow.loadURL(`${baseUrl}/admin`)
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (!mainWindow) createWindow() })
app.on('before-quit', () => { try { server?.close() } catch {} })
