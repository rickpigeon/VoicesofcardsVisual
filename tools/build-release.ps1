param([string]$Src, [string]$OutDir, [string]$Tag)
# Builds what the GitHub workflow would attach to a release:
#   module.json (download = this tag's zip) and module.zip (files at the zip root).
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = (Resolve-Path $Src).Path.TrimEnd('\')
New-Item -ItemType Directory -Force $OutDir | Out-Null

$json = Get-Content (Join-Path $root 'module.json') -Raw -Encoding UTF8
$m = $json | ConvertFrom-Json
$repo = $m.url
$newDownload = "$repo/releases/download/$Tag/module.zip"
$json = $json.Replace('"download": "' + $m.download + '"', '"download": "' + $newDownload + '"')
$utf8 = New-Object System.Text.UTF8Encoding($false)
$manifestOut = Join-Path $OutDir 'module.json'
[System.IO.File]::WriteAllText($manifestOut, $json, $utf8)

$zipOut = Join-Path $OutDir 'module.zip'
if (Test-Path $zipOut) { Remove-Item $zipOut -Force -Confirm:$false }
$include = @('scripts', 'styles', 'templates', 'lang', 'assets', 'sounds', 'README.md', 'LICENSE', 'CHANGELOG.md')
$zip = [System.IO.Compression.ZipFile]::Open($zipOut, 'Create')
try {
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $manifestOut, 'module.json', 'Optimal') | Out-Null
  foreach ($item in $include) {
    $p = Join-Path $root $item
    $files = if ((Get-Item $p).PSIsContainer) { Get-ChildItem $p -Recurse -File -Force } else { @(Get-Item $p) }
    foreach ($f in $files) {
      $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel, 'Optimal') | Out-Null
    }
  }
} finally { $zip.Dispose() }

$z = [System.IO.Compression.ZipFile]::OpenRead($zipOut)
"zip entries: $($z.Entries.Count) | backslashes: $(@($z.Entries | Where-Object { $_.FullName.Contains('\') }).Count) | module.json at root: $([bool]($z.Entries | Where-Object { $_.FullName -eq 'module.json' }))"
$z.Dispose()
"download in manifest: $((Get-Content $manifestOut -Raw | ConvertFrom-Json).download)"
Get-ChildItem $OutDir | Select-Object Name, Length
