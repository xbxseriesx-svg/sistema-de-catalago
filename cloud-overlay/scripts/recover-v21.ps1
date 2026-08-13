$ErrorActionPreference = 'Stop'

$ordered = @(
  'v21-final/chunks/00.b64','v21-final/chunks/00_tail.b64','v21-final/chunks/01.b64','v21-final/chunks/02.b64',
  'v21-final/chunks/03.b64','v21-final/chunks/04.b64','v21-final/chunks/05.b64','v21-final/chunks/06_07.b64',
  'v21-final/chunks/08_09.b64','v21-final/chunks/10_11.b64','v21-final/chunks/12_13.b64','v21-final/chunks/14.b64',
  'v21-final/chunks/15.b64','v21-final/chunks/16.b64','v21-final/chunks/17.b64','v21-final/chunks/18.b64'
)

$pieces = @()
foreach ($part in $ordered) {
  $s = (Get-Content $part -Raw) -replace '\s',''
  if ($part -like '*10_11*' -or $part -like '*12_13*') { $s = $s.Substring(0,16000) }
  $pieces += $s
}
$b64 = $pieces -join ''
if ($b64.Length -ne 145988) { throw "Unexpected base64 length: $($b64.Length)" }
[IO.File]::WriteAllBytes("$PWD\source-recovered.zip", [Convert]::FromBase64String($b64))
Write-Host "Recovered archive SHA256=$((Get-FileHash "$PWD\source-recovered.zip" -Algorithm SHA256).Hash.ToLower())"

New-Item -ItemType Directory -Force app | Out-Null
& 7z x source-recovered.zip -oapp -y '-x!package-lock.json' '-x!.gitignore' '-x!tsconfig.node.json' '-x!tsconfig.app.json' '-x!.bolt/*'
if ($LASTEXITCODE -gt 1) { throw "7-Zip extraction failed with exit code $LASTEXITCODE" }

@'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
'@ | Set-Content app/tsconfig.node.json -Encoding UTF8

@'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
'@ | Set-Content app/tsconfig.app.json -Encoding UTF8

if (-not (Test-Path app/package.json)) { throw 'package.json missing after recovery' }
if (-not (Test-Path app/src/App.tsx)) { throw 'src/App.tsx missing after recovery' }
if (-not (Test-Path app/src/editor/TemplatesPanel.tsx)) { throw 'TemplatesPanel.tsx missing after recovery' }

# Restaura importação do catálogo no painel.
$catalogPath = 'app/src/editor/CatalogPanel.tsx'
$catalog = Get-Content $catalogPath -Raw
$catalog = $catalog.Replace("import { useEditor } from './store';", "import { useEditor } from './store';`nimport { CatalogImportPanel } from '../cloud/CatalogImportPanel';")
$catalog = $catalog.Replace("        <div className=\"relative\">`n          <Search size={13}", "        <CatalogImportPanel />`n        <div className=\"relative\">`n          <Search size={13}")
Set-Content $catalogPath $catalog -Encoding UTF8

# Torna a altura da página ajustável pela borda inferior.
$canvasPath = 'app/src/editor/Canvas.tsx'
$canvas = Get-Content $canvasPath -Raw
$canvas = $canvas.Replace("import { getResponsiveRect, responsivePatch } from './utils';", "import { getResponsiveRect, responsivePatch } from './utils';`nimport { PageResizeHandle } from '../cloud/PageResizeHandle';")
$canvas = $canvas.Replace("const effectivePageHeight = Math.max(pageRect.height, contentBottom + 480, viewportHeight * 2);", "const autoExtend = page?.props?.autoExtend !== false;`n  const effectivePageHeight = autoExtend ? Math.max(pageRect.height, contentBottom + 120, 480) : Math.max(pageRect.height, 480);")
$canvas = $canvas.Replace("        {!state.previewMode && displayPage && Array.from", "        {page && !state.previewMode && <PageResizeHandle page={page} pageRect={pageRect} effectivePageHeight={effectivePageHeight} />}`n`n        {!state.previewMode && displayPage && Array.from")
Set-Content $canvasPath $canvas -Encoding UTF8

# Adiciona configuração de função aos botões.
$propertiesPath = 'app/src/editor/PropertiesPanel.tsx'
$properties = Get-Content $propertiesPath -Raw
$properties = $properties.Replace("} from 'lucide-react';", "} from 'lucide-react';`nimport { ButtonActionEditor } from '../cloud/ButtonActionEditor';")
$properties = $properties.Replace("      {mode === 'professional' && (`n        <>", "      <ButtonActionEditor node={node} />`n      {mode === 'professional' && (`n        <>")
Set-Content $propertiesPath $properties -Encoding UTF8

# Centraliza corretamente o texto dos botões nos templates.
$contentPath = 'app/src/editor/nodeContent.tsx'
$content = Get-Content $contentPath -Raw
$oldTextBlock = @'
  if (isTextTypeRenderer(type)) {
    const text = (props.text as string) || '';
    if (isEditing) {
      return text;
    }
    return <span style={{ display: 'block', width: '100%', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{text}</span>;
  }
'@
$newTextBlock = @'
  if (type === 'button' || type === 'productbutton') {
    const text = (props.text as string) || '';
    if (isEditing) return text;
    return <span style={{ display: 'flex', width: '100%', height: '100%', boxSizing: 'border-box', alignItems: (node.styles.alignItems as React.CSSProperties['alignItems']) || 'center', justifyContent: (node.styles.justifyContent as React.CSSProperties['justifyContent']) || 'center', textAlign: (node.styles.textAlign as React.CSSProperties['textAlign']) || 'center', padding: '0 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</span>;
  }
  if (isTextTypeRenderer(type)) {
    const text = (props.text as string) || '';
    if (isEditing) {
      return text;
    }
    return <span style={{ display: 'block', width: '100%', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{text}</span>;
  }
'@
if (-not $content.Contains($oldTextBlock)) { throw 'Bloco de texto esperado não encontrado em nodeContent.tsx' }
$content = $content.Replace($oldTextBlock, $newTextBlock)
Set-Content $contentPath $content -Encoding UTF8

Write-Host 'ASTERYON Editor v2.1 recovered with catalog UX adjustments.'
