$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$html = Join-Path $root "carousel.html"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (-not (Test-Path $chrome)) {
  $chrome = (& npx print-chrome-path).Trim()
}

for ($i = 1; $i -le 6; $i++) {
  $out = Join-Path $root ("airia-carousel-{0:00}.png" -f $i)
  $url = "file:///" + ($html -replace "\\", "/") + "?slide=$i"
  & $chrome `
    --headless=new `
    --disable-gpu `
    --disable-crash-reporter `
    --hide-scrollbars `
    --allow-file-access-from-files `
    --window-size=1080,1350 `
    --force-device-scale-factor=1 `
    --screenshot="$out" `
    "$url"
}
