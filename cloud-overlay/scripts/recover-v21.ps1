$ErrorActionPreference = 'Stop'
$groups = @(
  @('v21-final/chunks/00.b64','v21-final/chunks/00_tail.b64'),
  @('v21-final/chunks/01.b64'), @('v21-final/chunks/02.b64'), @('v21-final/chunks/03.b64'),
  @('v21-final/chunks/04.b64'), @('v21-final/chunks/05.b64'), @('v21-final/chunks/06_07.b64'),
  @('v21-final/chunks/08_09.b64'), @('v21-final/chunks/10_11.b64'), @('v21-final/chunks/12_13.b64'),
  @('v21-final/chunks/14.b64'), @('v21-final/chunks/15.b64'), @('v21-final/chunks/16.b64'),
  @('v21-final/chunks/17.b64'), @('v21-final/chunks/18.b64')
)
$all = [System.Collections.Generic.List[byte]]::new()
for ($i=0; $i -lt $groups.Count; $i++) {
  $s = ($groups[$i] | ForEach-Object { ((Get-Content $_ -Raw) -replace '\s','') }) -join ''
  $best = $null
  for ($cut=0; $cut -le 300; $cut++) {
    $len = $s.Length - $cut
    $len -= ($len % 4)
    if ($len -le 0) { break }
    try {
      $candidate = [Convert]::FromBase64String($s.Substring(0,$len))
      if ($candidate.Length -eq 6000 -or ($i -eq $groups.Count-1 -and $candidate.Length -gt 1000)) { $best=$candidate; break }
    } catch {}
  }
  if (-not $best) { throw "Cannot recover group $i" }
  if ($i -lt $groups.Count-1 -and $best.Length -ne 6000) { throw "Group $i wrong length $($best.Length)" }
  $all.AddRange($best)
}
$bytes = $all.ToArray()
if ($bytes.Length -lt 100000) { throw "Recovered source too small: $($bytes.Length)" }
if (-not ($bytes[-22] -eq 0x50 -and $bytes[-21] -eq 0x4b -and $bytes[-20] -eq 0x05 -and $bytes[-19] -eq 0x06)) {
  $eocd = [Convert]::FromBase64String('UEsFBgAAAAAUABQAZAUAAEKqAQAAAA==')
  $tmp = New-Object byte[] ($bytes.Length + $eocd.Length)
  [Array]::Copy($bytes,0,$tmp,0,$bytes.Length)
  [Array]::Copy($eocd,0,$tmp,$bytes.Length,$eocd.Length)
  $bytes=$tmp
}
[IO.File]::WriteAllBytes("$PWD\ASTERYON-v2.1-source.zip",$bytes)
New-Item -ItemType Directory -Force app | Out-Null
Expand-Archive "$PWD\ASTERYON-v2.1-source.zip" app -Force
Write-Host "Editor v2.1 recuperado: $($bytes.Length) bytes"
