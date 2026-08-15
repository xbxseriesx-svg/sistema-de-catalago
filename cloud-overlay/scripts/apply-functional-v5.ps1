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
Copy-Item cloud-overlay/src/editor/utils.ts app/src/editor/utils.ts -Force

# Corrige a navegação para uma promoção específica. A ação do editor já gerava
# ?promocao=<id>, porém a vitrine pública antiga ignorava esse parâmetro.
$catalogPath = 'app/src/public/PublicCatalogV3.tsx'
$catalog = [IO.File]::ReadAllText($catalogPath)
$catalogNeedle = "if(!offers.length)return null;const map=new Map(products.map(item=>[String(item.id),item]));return <section"
$catalogReplacement = "if(!offers.length)return null;const params=new URLSearchParams(window.location.search),requestedPromotion=params.get('promocao')||'',requestedView=params.get('view')||'';const selectedOffer=requestedPromotion?offers.find(offer=>String(offer.id)===requestedPromotion):null;const visibleOffers=selectedOffer?[selectedOffer]:offers;const map=new Map(products.map(item=>[String(item.id),item]));return <section data-promotion-view={requestedView||undefined}"
if (-not $catalog.Contains($catalogNeedle)) { throw 'Não foi possível localizar a vitrine de promoções para a correção V5.' }
$catalog = $catalog.Replace($catalogNeedle, $catalogReplacement)
$catalog = $catalog.Replace('{offers.map(offer=>', '{visibleOffers.map(offer=>')
[IO.File]::WriteAllText($catalogPath, $catalog, [Text.UTF8Encoding]::new($false))

# Faz as ações "adicionar promoção ao pedido" e "adicionar promoção à cotação"
# executarem uma ação real em vez de somente trocar a URL.
$actionsPath = 'app/src/cloud/buttonActions.ts'
$actions = [IO.File]::ReadAllText($actionsPath)
$actionsNeedle = @'
if(PROMOTION_ACTIONS.has(type)){if(!id)return false;return go(`/?promocao=${encodeURIComponent(id)}&view=${encodeURIComponent(type.replace('promotion-',''))}#promocoes`,target)}
'@.Trim()
$actionsReplacement = @'
if(PROMOTION_ACTIONS.has(type)){if(!id){notice('Selecione uma promoção.');return false}if(type==='promotion-order-add'){saveStored('asteryon.promotionOrder',id);notice('Promoção adicionada ao pedido.');return true}if(type==='promotion-quote'){saveStored('asteryon.promotionQuote',id);notice('Promoção adicionada à cotação.');return true}return go(`/?promocao=${encodeURIComponent(id)}&view=${encodeURIComponent(type.replace('promotion-',''))}#promocoes`,target)}
'@.Trim()
if (-not $actions.Contains($actionsNeedle)) { throw 'Não foi possível localizar as ações de promoção para a correção V5.' }
$actions = $actions.Replace($actionsNeedle, $actionsReplacement)
[IO.File]::WriteAllText($actionsPath, $actions, [Text.UTF8Encoding]::new($false))

$required = @(
  'app/src/editor/Toolbar.tsx',
  'app/src/editor/Canvas.tsx',
  'app/src/editor/utils.ts',
  'app/src/editor/PropertiesPanel.tsx',
  'app/src/editor/store.tsx',
  'app/src/public/PublicCatalogV3.tsx',
  'app/src/cloud/buttonActions.ts'
)
foreach ($file in $required) {
  if (-not (Test-Path $file)) { throw "Arquivo funcional V5 ausente: $file" }
}

$utils = [IO.File]::ReadAllText('app/src/editor/utils.ts')
if (-not $utils.Contains("if (device === 'desktop')")) { throw 'Correção da fonte única Desktop não foi aplicada.' }
if (-not ([IO.File]::ReadAllText($catalogPath).Contains("params.get('promocao')"))) { throw 'Filtro de promoção não foi aplicado.' }
if (-not ([IO.File]::ReadAllText($actionsPath).Contains('asteryon.promotionOrder'))) { throw 'Ação de promoção para pedido não foi aplicada.' }

Write-Host 'Camada funcional V5 aplicada: autosave D1, responsividade, resoluções, Marketing e ações de promoção.'
