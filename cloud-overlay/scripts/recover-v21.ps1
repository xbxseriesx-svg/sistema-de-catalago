$ErrorActionPreference = 'Stop'

$ordered = @(
  'v21-final/chunks/00.b64','v21-final/chunks/00_tail.b64','v21-final/chunks/01.b64','v21-final/chunks/02.b64',
  'v21-final/chunks/03.b64','v21-final/chunks/04.b64','v21-final/chunks/05.b64','v21-final/chunks/06_07.b64',
  'v21-final/chunks/08_09.b64','v21-final/chunks/10_11.b64','v21-final/chunks/12_13.b64','v21-final/chunks/14.b64',
  'v21-final/chunks/15.b64','v21-final/chunks/16.b64','v21-final/chunks/17.b64','v21-final/chunks/18.b64'
)

$pieces = @()
foreach ($part in $ordered) {
  if (-not (Test-Path $part)) { throw "Chunk ausente: $part" }
  $s = (Get-Content $part -Raw) -replace '\s',''
  if ($part -like '*10_11*' -or $part -like '*12_13*') {
    if ($s.Length -lt 16000) { throw "Chunk curto: $part ($($s.Length))" }
    $s = $s.Substring(0,16000)
  }
  $pieces += $s
}

$b64 = $pieces -join ''
if ($b64.Length -ne 145988) { throw "Base64 v2.1 inesperado: $($b64.Length)" }

$zip = "$PWD\ASTERYON-v2.1-source.zip"
[IO.File]::WriteAllBytes($zip, [Convert]::FromBase64String($b64))
$sha = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
$expected = '1da8b5af54c658153e9a5e0d98cfda2418371bef732942a2b1d902ef1f4f5558'
if ($sha -ne $expected) { throw "SHA v2.1 inválido: $sha" }

Remove-Item app -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force app | Out-Null
Expand-Archive $zip app -Force

if (-not (Test-Path app/package.json)) { throw 'package.json não foi recuperado' }
if (-not (Test-Path app/src/App.tsx)) { throw 'src/App.tsx não foi recuperado' }
if (-not (Test-Path app/src/editor/TemplatesPanel.tsx)) { throw 'TemplatesPanel da v2.1 não foi recuperado' }

Write-Host "Editor v2.1 recuperado e validado. SHA256=$sha"
