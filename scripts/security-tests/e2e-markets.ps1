# End-to-end checks for the Damascus pilot rollout: governorate status, market and category management,
# geofences and merchant interest. Restores every change it makes. Restart the API first (rate limits).

$ErrorActionPreference = "Continue"
$Api = "http://localhost:4000"
$Origins = @{ web = "http://localhost:3000"; merchant = "http://localhost:3001"; admin = "http://localhost:3002" }
# Built by scripts\build-totp-helper.ps1
$Totp = Join-Path $env:TEMP "tj-totp\auth\totp.js"
if (-not (Test-Path $Totp)) { throw "Run scripts\build-totp-helper.ps1 first" }
$Tmp = Join-Path $env:TEMP "tj-e2e-markets"
[IO.Directory]::CreateDirectory($Tmp) | Out-Null
$Utf8 = New-Object Text.UTF8Encoding $false
$results = New-Object System.Collections.Generic.List[string]

function Check([string]$name, [bool]$ok, [string]$detail = "") {
  $mark = if ($ok) { "PASS" } else { "FAIL" }
  $results.Add(("{0}  {1}{2}" -f $mark, $name, $(if ($detail) { " | $detail" } else { "" })))
}

function Req {
  param([string]$Method = "GET", [string]$Path, [string]$Client = "web", $Body = $null, [string]$Jar = "")
  $out = Join-Path $Tmp "body.txt"
  $a = @("-s", "-X", $Method, "-o", $out, "-w", "%{http_code}", "-H", "X-Client: $Client", "-H", "Origin: $($Origins[$Client])")
  if ($Jar) { $a += @("-b", $Jar, "-c", $Jar) }
  if ($null -ne $Body) {
    $bf = Join-Path $Tmp "request.json"
    [IO.File]::WriteAllText($bf, ($Body | ConvertTo-Json -Depth 5), $Utf8)
    $a += @("-H", "Content-Type: application/json", "--data-binary", "@$bf")
  }
  $code = & curl.exe @a "$Api$Path"
  $text = if (Test-Path $out) { [IO.File]::ReadAllText($out, [Text.Encoding]::UTF8) } else { "" }
  $json = $null; try { if ($text) { $json = $text | ConvertFrom-Json } } catch {}
  [pscustomobject]@{ Code = [int]$code; Json = $json; Text = $text }
}

function TotpCode([string]$secret) { (node -e "const t=require(process.argv[1]);console.log(t.hotp(t.base32Decode(process.argv[2]),t.currentStep()))" $Totp $secret).Trim() }
function Sql([string]$query) { $query | docker exec -i tujjar_postgres psql -U tujjar -d tujjar_db -q -t -A }

$Reset = 'DELETE FROM "MerchantInterest" WHERE phone = ''963900000500''; DELETE FROM "Market" WHERE slug LIKE ''e2e-%''; DELETE FROM "Category" WHERE slug LIKE ''e2e-%''; UPDATE "Governorate" SET status = ''ACTIVE'' WHERE slug = ''aleppo''; UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE phone = ''963900000001'';'
Sql $Reset | Out-Null

$merJar = Join-Path $Tmp "merchant.jar"; $admJar = Join-Path $Tmp "admin.jar"
foreach ($j in @($merJar, $admJar)) { if (Test-Path $j) { [IO.File]::Delete($j) } }

# ---------- public view ----------
$govs = (Req -Path "/governorates").Json
$damascus = @($govs | Where-Object { $_.slug -eq "damascus" })[0]
$idlib = @($govs | Where-Object { $_.slug -eq "idlib" })[0]
$aleppo = @($govs | Where-Object { $_.slug -eq "aleppo" })[0]
$category = @((Req -Path "/categories").Json)[0]
Check "Governorates expose their rollout status" ($damascus.status -eq "ACTIVE" -and $idlib.status -eq "COMING_SOON") "$($damascus.status) $($idlib.status)"
Check "Damascus lists its markets" (@($damascus.markets).Count -ge 16) "markets=$(@($damascus.markets).Count)"

# ---------- coming soon: registration closed, interest open ----------
$otp = (Req -Method POST -Path "/auth/otp" -Client "merchant" -Body @{ phone = "0900000500"; purpose = "REGISTER" }).Json.devCode
$registration = @{
  name = "Soon Merchant"; phone = "0900000500"; password = "Test@2026x"; otpCode = $otp; acceptTerms = $true; attestTruth = $true
  storeName = "E2E Soon Shop"; governorateId = $idlib.id; categoryId = $category.id
}
$r = Req -Method POST -Path "/auth/register/merchant" -Client "merchant" -Body $registration
Check "Stores can't register in a coming-soon governorate" ($r.Code -eq 400) "got $($r.Code)"

$interest = @{ governorateId = $idlib.id; name = "Soon Merchant"; phone = "0900000500"; storeName = "E2E Soon Shop"; categoryId = $category.id }
$r = Req -Method POST -Path "/interest" -Client "merchant" -Body $interest
Check "Merchant registers interest in a coming-soon governorate" ($r.Code -eq 204) "got $($r.Code) $($r.Json.message)"
$r = Req -Method POST -Path "/interest" -Client "merchant" -Body $interest
$rows = (Sql 'SELECT count(*) FROM "MerchantInterest" WHERE phone = ''963900000500'';').Trim()
Check "Repeating the request is accepted without a duplicate" ($r.Code -eq 204 -and $rows -eq "1") "got $($r.Code) rows=$rows"
$bad = $interest.Clone(); $bad.phone = "12345"
Check "Interest with an invalid phone is refused" ((Req -Method POST -Path "/interest" -Client "merchant" -Body $bad).Code -eq 400)
$open = $interest.Clone(); $open.governorateId = $damascus.id
Check "Interest isn't collected for an open governorate" ((Req -Method POST -Path "/interest" -Client "merchant" -Body $open).Code -eq 400)

# ---------- sign-ins ----------
$r = Req -Method POST -Path "/auth/login" -Client "merchant" -Body @{ phone = "0900000100"; password = "Tujjar@2026" } -Jar $merJar
Check "Merchant session can't manage markets" ((Req -Path "/admin/markets" -Client "admin" -Jar $merJar).Code -eq 401)
$r = Req -Method POST -Path "/auth/login" -Client "admin" -Body @{ phone = "0900000001"; password = "Admin@2026" } -Jar $admJar
$setup = (Req -Method POST -Path "/auth/totp/setup" -Client "admin" -Jar $admJar).Json
$r = Req -Method POST -Path "/auth/totp/enable" -Client "admin" -Body @{ code = (TotpCode $setup.secret) } -Jar $admJar
Check "Admin signs in with two-factor" ($r.Code -eq 200) "got $($r.Code)"

# ---------- merchant interest follow-up ----------
$g = @((Req -Path "/admin/governorates" -Client "admin" -Jar $admJar).Json | Where-Object { $_.slug -eq "idlib" })[0]
Check "Admin sees new interest per governorate" ($g.newInterests -ge 1) "newInterests=$($g.newInterests)"
$item = @((Req -Path "/admin/interests?gov=idlib&status=new" -Client "admin" -Jar $admJar).Json.items | Where-Object { $_.phone -eq "963900000500" })[0]
Check "Interest list shows the merchant's details" ($item.storeName -eq "E2E Soon Shop" -and $item.category.name) "$($item.storeName)"
$r = Req -Method PATCH -Path "/admin/interests/$($item.id)" -Client "admin" -Body @{ contacted = $true } -Jar $admJar
Check "Interest can be marked as contacted" ($r.Code -eq 200 -and $r.Json.contactedAt) "got $($r.Code)"

# ---------- markets ----------
$marketBody = @{ governorateId = $damascus.id; name = "E2E Test Market"; slug = "e2e-test-market"; description = "e2e" }
$r = Req -Method POST -Path "/admin/markets" -Client "admin" -Body $marketBody -Jar $admJar
Check "Admin creates a market" ($r.Code -eq 201 -and $r.Json.slug -eq "e2e-test-market") "got $($r.Code) $($r.Json.message)"
$market = $r.Json
$again = $marketBody.Clone(); $again.slug = "e2e-test-market-2"
Check "A duplicate market name in the same governorate is refused" ((Req -Method POST -Path "/admin/markets" -Client "admin" -Body $again -Jar $admJar).Code -eq 409)
$publicMarkets = @(@((Req -Path "/governorates").Json | Where-Object { $_.slug -eq "damascus" })[0].markets | Where-Object { $_.slug -eq "e2e-test-market" })
Check "The new market appears on the public site" ($publicMarkets.Count -eq 1)
$r = Req -Method PATCH -Path "/admin/markets/$($market.id)" -Client "admin" -Body @{ isActive = $false } -Jar $admJar
Check "A disabled market is hidden from the public site" ($r.Code -eq 200 -and (Req -Path "/markets/e2e-test-market").Code -eq 404) "got $($r.Code)"

$r = Req -Method PATCH -Path "/admin/markets/$($market.id)/geofence" -Client "admin" -Body @{ latitude = 40.5; longitude = 36.3; radiusMeters = 300; status = "DRAFT" } -Jar $admJar
Check "A geofence outside Syria is refused" ($r.Code -eq 400) "got $($r.Code)"
$r = Req -Method PATCH -Path "/admin/markets/$($market.id)/geofence" -Client "admin" -Body @{ latitude = 33.51; longitude = 36.30; radiusMeters = 10; status = "DRAFT" } -Jar $admJar
Check "A tiny geofence radius is refused" ($r.Code -eq 400) "got $($r.Code)"
$r = Req -Method PATCH -Path "/admin/markets/$($market.id)/geofence" -Client "admin" -Body @{ latitude = 33.5113; longitude = 36.3035; radiusMeters = 300; status = "DRAFT" } -Jar $admJar
Check "A draft geofence is saved" ($r.Code -eq 200 -and $r.Json.geofenceStatus -eq "DRAFT" -and $r.Json.radiusMeters -eq 300) "got $($r.Code)"
$r = Req -Path "/admin/markets/$($market.id)/geofence-suggestion" -Client "admin" -Jar $admJar
Check "Geofence suggestion waits for enough verified shops" ($r.Code -eq 200 -and $null -eq $r.Json.suggestion -and $r.Json.required -eq 3) "samples=$($r.Json.samples)"
$r = Req -Method DELETE -Path "/admin/markets/$($market.id)" -Client "admin" -Jar $admJar
Check "An empty market can be deleted" ($r.Code -eq 204) "got $($r.Code)"
$hamidiyah = @($damascus.markets | Where-Object { $_.slug -eq "al-hamidiyah" })[0]
Check "A market with stores can't be deleted" ((Req -Method DELETE -Path "/admin/markets/$($hamidiyah.id)" -Client "admin" -Jar $admJar).Code -eq 409)

# ---------- categories ----------
$r = Req -Method POST -Path "/admin/categories" -Client "admin" -Body @{ name = "E2E Category"; icon = "*"; slug = "e2e-category" } -Jar $admJar
Check "Admin creates a category" ($r.Code -eq 201) "got $($r.Code) $($r.Json.message)"
$newCategory = $r.Json
Check "The new category appears publicly" (@((Req -Path "/categories").Json | Where-Object { $_.slug -eq "e2e-category" }).Count -eq 1)
$r = Req -Method PATCH -Path "/admin/categories/$($newCategory.id)" -Client "admin" -Body @{ isActive = $false } -Jar $admJar
Check "A disabled category is hidden publicly" ($r.Code -eq 200 -and @((Req -Path "/categories").Json | Where-Object { $_.slug -eq "e2e-category" }).Count -eq 0)
$product = @{ title = "E2E disabled category"; categoryId = $newCategory.id; priceType = "FIXED"; price = 1000; currency = "SYP"; condition = "NEW"; inStock = $true; images = @() }
$r = Req -Method POST -Path "/merchant/products" -Client "merchant" -Body $product -Jar $merJar
Check "A disabled category can't be used for new products" ($r.Code -eq 400) "got $($r.Code)"
$used = @((Req -Path "/admin/categories" -Client "admin" -Jar $admJar).Json | Where-Object { $_.productsCount -gt 0 })[0]
Check "A category with products can't be deleted" ((Req -Method DELETE -Path "/admin/categories/$($used.id)" -Client "admin" -Jar $admJar).Code -eq 409)
Check "An empty category can be deleted" ((Req -Method DELETE -Path "/admin/categories/$($newCategory.id)" -Client "admin" -Jar $admJar).Code -eq 204)

# ---------- governorate rollout ----------
$r = Req -Method PATCH -Path "/admin/governorates/$($aleppo.id)/status" -Client "admin" -Body @{ status = "COMING_SOON" } -Jar $admJar
Check "Admin moves a governorate back to coming soon" ($r.Code -eq 200 -and $r.Json.status -eq "COMING_SOON") "got $($r.Code)"
$total = (Req -Path "/stores?gov=aleppo").Json.total
$storeCode = (Req -Path "/stores/shahba-soap").Code
Check "Its stores disappear from the public site" ($total -eq 0 -and $storeCode -eq 404) "total=$total store=$storeCode"
$r = Req -Method PATCH -Path "/admin/governorates/$($aleppo.id)/status" -Client "admin" -Body @{ status = "ACTIVE" } -Jar $admJar
Check "Reopening the governorate brings its stores back" ($r.Code -eq 200 -and (Req -Path "/stores/shahba-soap").Code -eq 200)

$actions = @((Req -Path "/admin/audit-logs?pageSize=100" -Client "admin" -Jar $admJar).Json.items | ForEach-Object { $_.action })
$expected = @("interest.created", "interest.contacted", "market.created", "market.updated", "market.geofence_set", "market.deleted", "category.created", "category.updated", "category.deleted", "governorate.status_changed")
$missing = @($expected | Where-Object { $actions -notcontains $_ })
Check "Audit log records rollout, market, category and interest changes" ($missing.Count -eq 0) "missing: $($missing -join ',')"

# ---------- cleanup ----------
Sql ($Reset + ' DELETE FROM "Session";') | Out-Null

""
$results
""
"{0} passed, {1} failed" -f @($results | Where-Object { $_ -like "PASS*" }).Count, @($results | Where-Object { $_ -like "FAIL*" }).Count
