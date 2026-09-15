# Compiles the API's TOTP and crypto helpers to plain JavaScript in %TEMP%\tj-totp,
# so the security tests and the screenshot script can generate valid two-factor codes.
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $env:TEMP "tj-totp"
$tsc = Join-Path $root "apps\web\node_modules\.bin\tsc.cmd"
if (-not (Test-Path $tsc)) { throw "TypeScript not found: run npm install in apps\web first" }

# Type errors about Node typings are expected here; the JavaScript is still emitted.
& $tsc (Join-Path $root "apps\api\src\auth\totp.ts") --outDir $out --module commonjs --target es2022 `
  --esModuleInterop --skipLibCheck --rootDir (Join-Path $root "apps\api\src") 2>&1 | Out-Null

$helper = Join-Path $out "auth\totp.js"
if (Test-Path $helper) { "Built $helper" } else { throw "Build failed: $helper was not created" }
