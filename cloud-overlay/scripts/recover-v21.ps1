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
if ($b64.Length -ne 145988) { throw "Base64 v2.1 inesperado: $($b64.Length)" }
$zip = "$PWD\ASTERYON-v2.1-source.zip"
[IO.File]::WriteAllBytes($zip, [Convert]::FromBase64String($b64))
$sha = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
$expected = 'e4cd3ea64539ced75ae51a5370e5812ec69d07d772ac56ff40fcf21b6aceeeb2'
if ($sha -ne $expected) { throw "SHA v2.1 inválido: $sha" }

Remove-Item app -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force app | Out-Null
Expand-Archive $zip app -Force
if (-not (Test-Path app/package.json)) { throw 'package.json não recuperado' }
if (-not (Test-Path app/src/editor/TemplatesPanel.tsx)) { throw 'TemplatesPanel v2.1 não recuperado' }
Write-Host "Editor v2.1 recuperado. SHA256=$sha"
