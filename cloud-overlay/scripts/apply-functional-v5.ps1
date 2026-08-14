$ErrorActionPreference = 'Stop'

$patchPath = 'cloud-overlay/patches/full-functional-v5.patch'
$patchText = [IO.File]::ReadAllText($patchPath).Replace("`r`n", "`n")
[IO.File]::WriteAllText($patchPath, $patchText, [Text.UTF8Encoding]::new($false))

git apply --directory=app --check --recount --whitespace=nowarn $patchPath
if ($LASTEXITCODE -ne 0) { throw 'O patch funcional V5 não é compatível com a fonte reconstruída.' }
git apply --directory=app --recount --whitespace=nowarn $patchPath
if ($LASTEXITCODE -ne 0) { throw 'Falha ao aplicar correções funcionais V5.' }

Copy-Item cloud-overlay/src/editor/Toolbar.tsx app/src/editor/Toolbar.tsx -Force
Copy-Item cloud-overlay/src/editor/Canvas.tsx app/src/editor/Canvas.tsx -Force

$required = @(
  'app/src/editor/Toolbar.tsx',
  'app/src/editor/Canvas.tsx',
  'app/src/editor/PropertiesPanel.tsx',
  'app/src/editor/store.tsx'
)
foreach ($file in $required) {
  if (-not (Test-Path $file)) { throw "Arquivo funcional V5 ausente: $file" }
}

Write-Host 'Camada funcional V5 aplicada: autosave D1, responsividade, resoluções e edição de Marketing.'
