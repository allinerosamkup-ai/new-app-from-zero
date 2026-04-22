$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$html = Join-Path $root "post.html"
$out = Join-Path $root "airia-pinned-post-final.png"
$raw = Join-Path $root "_airia-pinned-post-raw.png"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (-not (Test-Path $chrome)) {
  $chrome = (& npx print-chrome-path).Trim()
}

$cacheBust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$url = "file:///" + ($html -replace "\\", "/") + "?v=$cacheBust"
if (Test-Path $raw) {
  Remove-Item -Force $raw
}

& $chrome `
  --headless=new `
  --disable-gpu `
  --disable-crash-reporter `
  --hide-scrollbars `
  --allow-file-access-from-files `
  --window-size=1096,1445 `
  --force-device-scale-factor=1 `
  --screenshot="$raw" `
  "$url"

for ($i = 0; $i -lt 100; $i++) {
  if (Test-Path $raw) {
    try {
      $stream = [System.IO.File]::Open($raw, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
      $stream.Close()
      break
    } catch {
      Start-Sleep -Milliseconds 100
    }
  } else {
    Start-Sleep -Milliseconds 100
  }
}

if (-not (Test-Path $raw)) {
  throw "Chrome did not write the raw screenshot."
}

Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::FromFile($raw)
$rect = New-Object System.Drawing.Rectangle 0, 0, 1080, 1350
$cropped = $bitmap.Clone($rect, $bitmap.PixelFormat)
$bitmap.Dispose()

if (Test-Path $out) {
  Remove-Item -Force $out
}

$cropped.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$cropped.Dispose()
Remove-Item -Force $raw
