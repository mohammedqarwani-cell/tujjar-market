# Prints docs\designs\tujjar-market-designs.html to PDF with headless Microsoft Edge.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$html = Join-Path $root "docs\designs\tujjar-market-designs.html"
$pdf = Join-Path $root "docs\designs\tujjar-market-designs.pdf"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { throw "Microsoft Edge not found at $edge" }
if (Test-Path $pdf) { Remove-Item $pdf }

$profile = Join-Path $env:TEMP "tj-edge-pdf"
[IO.Directory]::CreateDirectory($profile) | Out-Null
$url = "file:///" + ($html -replace '\\', '/')

$p = Start-Process -FilePath $edge -PassThru -WindowStyle Hidden -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-first-run", "--user-data-dir=$profile",
  "--no-pdf-header-footer", "--virtual-time-budget=30000", "--print-to-pdf=$pdf", $url
)
if (-not $p.WaitForExit(300000)) { $p.Kill(); throw "Edge timed out" }
"PDF written: {0} ({1:N0} bytes)" -f $pdf, (Get-Item $pdf).Length
