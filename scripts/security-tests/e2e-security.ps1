# End-to-end security checks for the Tujjar Market API (dev environment).
# Creates a temporary buyer (0900000300), enables admin TOTP for the test, then cleans both up.

$ErrorActionPreference = "Continue"
$Api = "http://localhost:4000"
$Web = "http://localhost:3000"
# Built by scripts\build-totp-helper.ps1
$Totp = Join-Path $env:TEMP "tj-totp\auth\totp.js"
if (-not (Test-Path $Totp)) { throw "Run scripts\build-totp-helper.ps1 first" }
$Tmp = Join-Path $env:TEMP "tj-e2e"
[IO.Directory]::CreateDirectory($Tmp) | Out-Null
$Utf8 = New-Object Text.UTF8Encoding $false
$results = New-Object System.Collections.Generic.List[string]

function Check([string]$name, [bool]$ok, [string]$detail = "") {
  $mark = if ($ok) { "PASS" } else { "FAIL" }
  $results.Add(("{0}  {1}{2}" -f $mark, $name, $(if ($detail) { " | $detail" } else { "" })))
}

function Req {
  param([string]$Method = "GET", [string]$Path, [string]$Client = "web", $Body = $null,
        [string]$Jar = "", [string]$Origin = $Web, [switch]$NoClient)
  $hdr = Join-Path $Tmp "headers.txt"; $out = Join-Path $Tmp "body.txt"
  $a = @("-s", "-X", $Method, "-D", $hdr, "-o", $out, "-w", "%{http_code}")
  if (-not $NoClient) { $a += @("-H", "X-Client: $Client") }
  if ($Origin) { $a += @("-H", "Origin: $Origin") }
  if ($Jar) { $a += @("-b", $Jar, "-c", $Jar) }
  if ($null -ne $Body) {
    $bf = Join-Path $Tmp "request.json"
    [IO.File]::WriteAllText($bf, ($Body | ConvertTo-Json -Depth 5), $Utf8)
    $a += @("-H", "Content-Type: application/json", "--data-binary", "@$bf")
  }
  $code = & curl.exe @a "$Api$Path"
  $text = if (Test-Path $out) { [IO.File]::ReadAllText($out, [Text.Encoding]::UTF8) } else { "" }
  $json = $null; try { if ($text) { $json = $text | ConvertFrom-Json } } catch {}
  [pscustomobject]@{ Code = [int]$code; Json = $json; Text = $text; Headers = [IO.File]::ReadAllText($hdr) }
}

function TotpCode([string]$secret) { (node -e "const t=require(process.argv[1]);console.log(t.hotp(t.base32Decode(process.argv[2]),t.currentStep()))" $Totp $secret).Trim() }

$webJar = Join-Path $Tmp "web.jar"; $merJar = Join-Path $Tmp "merchant.jar"; $admJar = Join-Path $Tmp "admin.jar"
foreach ($j in @($webJar, $merJar, $admJar)) { if (Test-Path $j) { [IO.File]::Delete($j) } }

# ---------- security headers ----------
$r = Req -Path "/categories"
Check "API sends CSP default-src 'none'" ($r.Headers -match "Content-Security-Policy: default-src 'none'")
Check "API sends X-Content-Type-Options nosniff" ($r.Headers -match "X-Content-Type-Options: nosniff")
Check "API hides X-Powered-By" (-not ($r.Headers -match "X-Powered-By"))

# ---------- CSRF ----------
$r = Req -Method POST -Path "/auth/login" -Body @{ phone = "0900000100"; password = "x" } -NoClient
Check "POST without X-Client is rejected" ($r.Code -eq 403) "got $($r.Code)"
$r = Req -Method POST -Path "/auth/login" -Body @{ phone = "0900000100"; password = "x" } -Origin "https://evil.example"
Check "POST from foreign Origin is rejected" ($r.Code -eq 403) "got $($r.Code)"

# ---------- buyer registration with OTP + terms ----------
$phone = "0900000300"
$r = Req -Method POST -Path "/auth/otp" -Body @{ phone = $phone; purpose = "REGISTER" }
$devCode = $r.Json.devCode
Check "OTP issued (dev echo)" ($r.Code -eq 200 -and $devCode -match '^\d{6}$') "got $($r.Code)"
$r = Req -Method POST -Path "/auth/otp" -Body @{ phone = $phone; purpose = "REGISTER" }
Check "OTP resend within 60s is throttled" ($r.Code -eq 429) "got $($r.Code)"

$base = @{ name = "مشتري اختبار"; phone = $phone; password = "Test@2026x"; otpCode = $devCode; acceptTerms = $true }
$noTerms = $base.Clone(); $noTerms.acceptTerms = $false
$r = Req -Method POST -Path "/auth/register/buyer" -Body $noTerms
Check "Registration without accepting terms is rejected" ($r.Code -eq 400) "$($r.Code) $($r.Json.message)"
$weak = $base.Clone(); $weak.password = "12345678"
$r = Req -Method POST -Path "/auth/register/buyer" -Body $weak
Check "Weak password is rejected" ($r.Code -eq 400) "$($r.Code) $($r.Json.message)"
$wrong = $base.Clone(); $wrong.otpCode = $(if ($devCode -eq "000000") { "111111" } else { "000000" })
$r = Req -Method POST -Path "/auth/register/buyer" -Body $wrong
Check "Wrong OTP code is rejected" ($r.Code -eq 400) "$($r.Code) $($r.Json.message)"
$r = Req -Method POST -Path "/auth/register/buyer" -Body $base -Jar $webJar
Check "Registration with valid OTP succeeds" ($r.Code -eq 201) "got $($r.Code) $($r.Json.message)"
Check "Access cookie is HttpOnly + SameSite=Lax" ($r.Headers -match "tj_web_at=[^;]+;.*HttpOnly" -and $r.Headers -match "tj_web_at=[^\r\n]*SameSite=Lax")
Check "Refresh cookie is scoped to /auth" ($r.Headers -match "tj_web_rt=[^\r\n]*Path=/auth")
Check "Token is not returned in the response body" (-not ($r.Text -match "accessToken|refreshToken"))

# ---------- interface separation ----------
$r = Req -Path "/auth/me" -Jar $webJar
Check "Buyer session works on the buyer interface" ($r.Code -eq 200 -and $r.Json.role -eq "BUYER") "got $($r.Code)"
$r = Req -Path "/merchant/stats" -Client "merchant" -Jar $webJar
Check "Buyer session cannot open the merchant interface" ($r.Code -eq 401) "got $($r.Code)"
$r = Req -Path "/admin/overview" -Client "admin" -Jar $webJar
Check "Buyer session cannot open the admin interface" ($r.Code -eq 401) "got $($r.Code)"

# ---------- refresh rotation + reuse detection ----------
$oldJar = Join-Path $Tmp "web-old.jar"; Copy-Item $webJar $oldJar -Force
$r = Req -Method POST -Path "/auth/refresh" -Jar $webJar
Check "Refresh rotates the session" ($r.Code -eq 200 -and $r.Headers -match "tj_web_rt=") "got $($r.Code)"
"   (waiting 31s to pass the rotation grace window...)"
Start-Sleep -Seconds 31
$r = Req -Method POST -Path "/auth/refresh" -Jar $oldJar
Check "Replaying an old refresh token is rejected" ($r.Code -eq 401) "got $($r.Code)"
$r = Req -Method POST -Path "/auth/refresh" -Jar $webJar
Check "Token reuse revokes the whole session family" ($r.Code -eq 401) "got $($r.Code)"

# fresh buyer session for the remaining checks
$r = Req -Method POST -Path "/auth/login" -Body @{ phone = $phone; password = "Test@2026x" } -Jar $webJar
Check "Buyer can sign in again after revocation" ($r.Code -eq 200) "got $($r.Code)"

# ---------- reports ----------
$product = (Req -Path "/products?store=bahsa-mobile&pageSize=1").Json.items[0].id
$r = Req -Method POST -Path "/reports" -Body @{ productId = $product; reason = "معلومات مضللة"; details = "e2e" }
Check "Anonymous report is rejected" ($r.Code -eq 401) "got $($r.Code)"
$r = Req -Method POST -Path "/reports" -Body @{ productId = $product; reason = "معلومات مضللة"; details = "e2e" } -Jar $webJar
Check "Signed-in buyer can report" ($r.Code -eq 204) "got $($r.Code) $($r.Json.message)"
$r = Req -Method POST -Path "/reports" -Body @{ productId = $product; reason = "معلومات مضللة"; details = "e2e" } -Jar $webJar
Check "Duplicate open report is rejected" ($r.Code -eq 409) "got $($r.Code)"

# ---------- merchant + upload ----------
$r = Req -Method POST -Path "/auth/login" -Client "merchant" -Body @{ phone = "0900000100"; password = "Tujjar@2026" } -Jar $merJar
Check "Merchant signs in to merchant interface" ($r.Code -eq 200) "got $($r.Code)"
$r = Req -Path "/merchant/stats" -Client "merchant" -Jar $merJar
Check "Merchant reaches merchant endpoints" ($r.Code -eq 200) "got $($r.Code)"
Add-Type -AssemblyName System.Drawing
$png = Join-Path $Tmp "photo.png"; $bmp = New-Object Drawing.Bitmap 1200, 900; $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::FromArgb(184, 110, 20)); $g.Dispose(); $bmp.Save($png, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
$up = curl.exe -s -H "X-Client: merchant" -H "Origin: $Web" -b $merJar -c $merJar -F "file=@$png;type=image/png" "$Api/merchant/media" | ConvertFrom-Json
Check "Image upload is re-encoded to WebP" ($up.url -match '\.webp$') "$($up.url)"
if ($up.url) { $ct = curl.exe -s -o NUL -w "%{content_type}" $up.url; Check "Stored image served as image/webp" ($ct -eq "image/webp") $ct }
$fake = Join-Path $Tmp "fake.png"; [IO.File]::WriteAllText($fake, "<script>alert(1)</script>")
$bad = curl.exe -s -H "X-Client: merchant" -H "Origin: $Web" -b $merJar -F "file=@$fake;type=image/png" "$Api/merchant/media"
Check "Non-image disguised as PNG is rejected" ($bad -match '"statusCode":400') $bad.Substring(0, [Math]::Min(80, $bad.Length))

# ---------- admin two-factor ----------
$r = Req -Method POST -Path "/auth/login" -Client "admin" -Body @{ phone = "0900000001"; password = "Admin@2026" } -Jar $admJar
Check "Admin signs in and is told to set up 2FA" ($r.Code -eq 200 -and $r.Json.user.mustSetupTotp -eq $true) "got $($r.Code)"
$r = Req -Path "/admin/overview" -Client "admin" -Jar $admJar
Check "Admin actions blocked until 2FA is enabled" ($r.Code -eq 403 -and $r.Json.code -eq "MFA_REQUIRED") "got $($r.Code)"
$setup = (Req -Method POST -Path "/auth/totp/setup" -Client "admin" -Jar $admJar).Json
Check "TOTP setup returns a secret" ($setup.secret -match '^[A-Z2-7]{32}$')
$r = Req -Method POST -Path "/auth/totp/enable" -Client "admin" -Body @{ code = "000000" } -Jar $admJar
Check "Wrong TOTP code is rejected" ($r.Code -eq 400) "got $($r.Code)"
$r = Req -Method POST -Path "/auth/totp/enable" -Client "admin" -Body @{ code = (TotpCode $setup.secret) } -Jar $admJar
Check "Valid TOTP enables 2FA" ($r.Code -eq 200 -and $r.Json.user.mfa -eq $true) "got $($r.Code) $($r.Json.message)"
$r = Req -Path "/admin/overview" -Client "admin" -Jar $admJar
Check "Admin actions allowed after 2FA" ($r.Code -eq 200) "got $($r.Code)"
$r = Req -Path "/admin/reports?status=OPEN" -Client "admin" -Jar $admJar
$rep = @($r.Json.items | Where-Object { $_.details -eq "e2e" })[0]
Check "Admin sees reporter name and phone" ($rep.reporter.name -eq "مشتري اختبار" -and $rep.reporter.phone -eq "963900000300")
$r = Req -Path "/admin/audit-logs?pageSize=100" -Client "admin" -Jar $admJar
$actions = @($r.Json.items | ForEach-Object { $_.action })
Check "Audit log records registration, reports, 2FA and token reuse" (($actions -contains "user.register") -and ($actions -contains "report.create") -and ($actions -contains "auth.totp_enabled") -and ($actions -contains "auth.refresh_token_reuse")) (($actions | Select-Object -Unique) -join ",")

Req -Method POST -Path "/auth/logout" -Client "admin" -Jar $admJar | Out-Null
$r = Req -Path "/admin/overview" -Client "admin" -Jar $admJar
Check "Logged-out admin session is rejected" ($r.Code -eq 401) "got $($r.Code)"
$r = Req -Method POST -Path "/auth/login" -Client "admin" -Body @{ phone = "0900000001"; password = "Admin@2026" } -Jar $admJar
Check "Admin login now requires the TOTP code" ($r.Code -eq 401 -and $r.Json.code -eq "TOTP_REQUIRED") "got $($r.Code)"

# ---------- account lockout (last: it uses the remaining login budget) ----------
for ($i = 1; $i -le 5; $i++) { $last = Req -Method POST -Path "/auth/login" -Body @{ phone = $phone; password = "wrong-pass-$i" } }
Check "Failed logins return 401" ($last.Code -eq 401) "got $($last.Code)"
$r = Req -Method POST -Path "/auth/login" -Body @{ phone = $phone; password = "Test@2026x" }
Check "Account locks after 5 failures, even with the right password" ($r.Code -eq 429) "$($r.Code) $($r.Json.message)"

# ---------- cleanup ----------
'DELETE FROM "User" WHERE phone = ''963900000300''; UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE phone = ''963900000001''; DELETE FROM "Session";' |
  docker exec -i tujjar_postgres psql -U tujjar -d tujjar_db -q | Out-Null

""
$results
""
"{0} passed, {1} failed" -f @($results | Where-Object { $_ -like "PASS*" }).Count, @($results | Where-Object { $_ -like "FAIL*" }).Count
