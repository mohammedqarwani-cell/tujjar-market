# End-to-end checks for tiered merchant verification (dev environment).
# Creates a temporary merchant (0900000400), enables admin TOTP for the test, then cleans everything up,
# including the encrypted evidence in the private bucket. Restart the API first so rate limits are fresh.

$ErrorActionPreference = "Continue"
$Api = "http://localhost:4000"
$Origins = @{ web = "http://localhost:3000"; merchant = "http://localhost:3001"; admin = "http://localhost:3002" }
# Built by scripts\build-totp-helper.ps1
$Totp = Join-Path $env:TEMP "tj-totp\auth\totp.js"
if (-not (Test-Path $Totp)) { throw "Run scripts\build-totp-helper.ps1 first" }
$ApiDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..\apps\api")).Path
$EnvFile = Join-Path $ApiDir ".env"
$Tmp = Join-Path $env:TEMP "tj-e2e-verify"
[IO.Directory]::CreateDirectory($Tmp) | Out-Null
$Utf8 = New-Object Text.UTF8Encoding $false
$results = New-Object System.Collections.Generic.List[string]

function Check([string]$name, [bool]$ok, [string]$detail = "") {
  $mark = if ($ok) { "PASS" } else { "FAIL" }
  $results.Add(("{0}  {1}{2}" -f $mark, $name, $(if ($detail) { " | $detail" } else { "" })))
}

function Req {
  param([string]$Method = "GET", [string]$Path, [string]$Client = "web", $Body = $null, [string]$Jar = "")
  $hdr = Join-Path $Tmp "headers.txt"; $out = Join-Path $Tmp "body.txt"
  $a = @("-s", "-X", $Method, "-D", $hdr, "-o", $out, "-w", "%{http_code}", "-H", "X-Client: $Client", "-H", "Origin: $($Origins[$Client])")
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

function Upload([string]$Path, [string]$Jar, [string[]]$Parts) {
  $out = Join-Path $Tmp "upload.txt"
  $a = @("-s", "-o", $out, "-w", "%{http_code}", "-H", "X-Client: merchant", "-H", "Origin: $($Origins.merchant)", "-b", $Jar, "-c", $Jar)
  foreach ($p in $Parts) { $a += @("-F", $p) }
  $code = & curl.exe @a "$Api$Path"
  $text = [IO.File]::ReadAllText($out, [Text.Encoding]::UTF8)
  $json = $null; try { $json = $text | ConvertFrom-Json } catch {}
  [pscustomobject]@{ Code = [int]$code; Json = $json; Text = $text }
}

function TotpCode([string]$secret) { (node -e "const t=require(process.argv[1]);console.log(t.hotp(t.base32Decode(process.argv[2]),t.currentStep()))" $Totp $secret).Trim() }
function Sql([string]$query) { $query | docker exec -i tujjar_postgres psql -U tujjar -d tujjar_db -q -t -A }

# Reads (or deletes) the objects stored for a store in the private bucket, straight from MinIO
$probe = @'
const { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const [envFile, storeId, mode] = process.argv.slice(2);
process.loadEnvFile(envFile);
const s3 = new S3Client({
  region: 'us-east-1', endpoint: process.env.MINIO_ENDPOINT, forcePathStyle: true,
  credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY, secretAccessKey: process.env.MINIO_SECRET_KEY },
});
const Bucket = process.env.MINIO_PRIVATE_BUCKET || 'kyc';
(async () => {
  const list = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `stores/${storeId}/` }));
  const out = { count: list.KeyCount || 0, readable: 0 };
  for (const { Key } of list.Contents || []) {
    if (mode === 'delete') { await s3.send(new DeleteObjectCommand({ Bucket, Key })); continue; }
    const body = Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket, Key }))).Body.transformToByteArray());
    const jpeg = body[0] === 0xff && body[1] === 0xd8;
    const png = body.readUInt32BE(0) === 0x89504e47;
    const mp4 = body.subarray(4, 8).toString('latin1') === 'ftyp';
    if (jpeg || png || mp4) out.readable++;
  }
  console.log(JSON.stringify(out));
})().catch((e) => console.log(JSON.stringify({ error: e.message })));
'@
$probeFile = Join-Path $Tmp "kyc-probe.cjs"
[IO.File]::WriteAllText($probeFile, $probe, $Utf8)
$env:NODE_PATH = Join-Path $ApiDir "node_modules"
function KycObjects([string]$storeId, [string]$mode = "") { (node $probeFile $EnvFile $storeId $mode) | ConvertFrom-Json }

# ---------- test files ----------
Add-Type -AssemblyName System.Drawing
function NewPng([string]$name, [int]$w, [int]$h) {
  $p = Join-Path $Tmp $name
  $bmp = New-Object Drawing.Bitmap $w, $h; $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::FromArgb(40, 120, 90)); $g.Dispose()
  $bmp.Save($p, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); $p
}
$idFront = NewPng "id-front.png" 1000 640
$idBack = NewPng "id-back.png" 1000 640
$selfie = NewPng "selfie.png" 800 1000
$fakeImage = Join-Path $Tmp "fake.png"; [IO.File]::WriteAllText($fakeImage, "<script>alert(1)</script>")
$video = Join-Path $Tmp "shop.mp4"
$bytes = New-Object byte[] 4096
$header = [byte[]]((0, 0, 0, 0x18) + [byte[]][Text.Encoding]::ASCII.GetBytes("ftypmp42"))
[Array]::Copy($header, $bytes, $header.Length); [IO.File]::WriteAllBytes($video, $bytes)
$fakeVideo = Join-Path $Tmp "fake.mp4"; [IO.File]::WriteAllText($fakeVideo, "this is plain text, not a video")

$Invariant = [Globalization.CultureInfo]::InvariantCulture
function LocationParts([double]$lat, [double]$lng, [int]$accuracy, [datetime]$at, [string]$file = $video) {
  $iso = $at.ToUniversalTime().ToString("yyyy-MM-dd'T'HH':'mm':'ss'Z'", $Invariant)
  @("video=@$file;type=video/mp4", "latitude=$lat", "longitude=$lng", "accuracy=$accuracy", "capturedAt=$iso")
}
$identityParts = @("idFront=@$idFront;type=image/png", "idBack=@$idBack;type=image/png", "selfie=@$selfie;type=image/png")

$merJar = Join-Path $Tmp "merchant.jar"; $admJar = Join-Path $Tmp "admin.jar"; $buyJar = Join-Path $Tmp "buyer.jar"
foreach ($j in @($merJar, $admJar, $buyJar)) { if (Test-Path $j) { [IO.File]::Delete($j) } }
# Leftovers from an interrupted earlier run
Sql 'DELETE FROM "User" WHERE phone = ''963900000400''; UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE phone = ''963900000001'';' | Out-Null

# ---------- registration with attestation ----------
$damascus = @((Req -Path "/governorates").Json | Where-Object { $_.slug -eq "damascus" })[0]
$hamidiyah = @($damascus.markets | Where-Object { $_.slug -eq "al-hamidiyah" })[0]
$buzuriyah = @($damascus.markets | Where-Object { $_.slug -eq "al-buzuriyah" })[0]
$category = @((Req -Path "/categories").Json)[0]
$phone = "0900000400"
$otp = (Req -Method POST -Path "/auth/otp" -Client "merchant" -Body @{ phone = $phone; purpose = "REGISTER" }).Json.devCode
$registration = @{
  name = "Verify Test Owner"; phone = $phone; password = "Test@2026x"; otpCode = $otp; acceptTerms = $true
  storeName = "E2E Verify Shop"; governorateId = $damascus.id; marketId = $hamidiyah.id; categoryId = $category.id
}
$r = Req -Method POST -Path "/auth/register/merchant" -Client "merchant" -Body $registration
Check "A store can't be opened without the truth attestation" ($r.Code -eq 400) "got $($r.Code)"
$registration.attestTruth = $true
$r = Req -Method POST -Path "/auth/register/merchant" -Client "merchant" -Body $registration -Jar $merJar
Check "Merchant registers with the attestation" ($r.Code -eq 201) "got $($r.Code) $($r.Json.message)"
$storeId = $r.Json.user.store.id; $storeSlug = $r.Json.user.store.slug

# ---------- level 0: registered ----------
$v = (Req -Path "/merchant/verification" -Client "merchant" -Jar $merJar).Json
Check "New store starts at REGISTERED with a 10-product limit" ($v.level -eq "REGISTERED" -and $v.productLimit -eq 10) "$($v.level) $($v.productLimit)"
Check "Identity is the only step open" ($v.identity.canSubmit -and -not $v.location.canSubmit)
Check "Public store page shows the REGISTERED level" ((Req -Path "/stores/$storeSlug").Json.verificationLevel -eq "REGISTERED")

$product = @{ title = "E2E product"; categoryId = $category.id; priceType = "FIXED"; price = 1000; currency = "SYP"; condition = "NEW"; inStock = $true; images = @() }
$codes = @(); for ($i = 1; $i -le 10; $i++) { $product.title = "E2E product $i"; $codes += (Req -Method POST -Path "/merchant/products" -Client "merchant" -Body $product -Jar $merJar).Code }
Check "Unverified store lists 10 products" (@($codes | Where-Object { $_ -eq 201 }).Count -eq 10) ($codes -join ",")
$r = Req -Method POST -Path "/merchant/products" -Client "merchant" -Body $product -Jar $merJar
Check "11th product is refused until identity is verified" ($r.Code -eq 403 -and $r.Json.code -eq "PRODUCT_LIMIT") "got $($r.Code)"

# ---------- level 1: identity evidence ----------
$r = Upload "/merchant/verification/location" $merJar (LocationParts 33.5113 36.3035 20 (Get-Date))
Check "Shop video is refused before identity is verified" ($r.Code -eq 400) "got $($r.Code)"
$r = Upload "/merchant/verification/identity" $merJar @("idFront=@$idFront;type=image/png", "idBack=@$idBack;type=image/png")
Check "Identity needs the ID front, back and selfie" ($r.Code -eq 400) "got $($r.Code)"
$r = Upload "/merchant/verification/identity" $merJar @("idFront=@$fakeImage;type=image/png", "idBack=@$idBack;type=image/png", "selfie=@$selfie;type=image/png")
Check "Non-image disguised as an ID photo is refused" ($r.Code -eq 400) "got $($r.Code)"
$r = Upload "/merchant/verification/identity" $merJar $identityParts
Check "Identity evidence is accepted for review" ($r.Code -eq 201 -and $r.Json.status -eq "PENDING") "got $($r.Code) $($r.Json.message)"
$r = Upload "/merchant/verification/identity" $merJar $identityParts
Check "A second request while one is pending is refused" ($r.Code -eq 409) "got $($r.Code)"

$r = Req -Method POST -Path "/auth/login" -Body @{ phone = "0900000200"; password = "Buyer@2026" } -Jar $buyJar
$r = Req -Path "/merchant/verification" -Client "merchant" -Jar $buyJar
Check "Buyer session can't open merchant verification" ($r.Code -eq 401) "got $($r.Code)"
$r = Req -Path "/admin/verifications" -Client "admin" -Jar $merJar
Check "Merchant session can't open the review queue" ($r.Code -eq 401) "got $($r.Code)"

# ---------- private, encrypted storage ----------
$anonymous = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:9000/kyc/"
Check "Private bucket refuses anonymous access" ($anonymous -eq "403") "got $anonymous"
$k = KycObjects $storeId
Check "Evidence is stored encrypted (nothing readable as JPEG/PNG/MP4)" ($k.count -eq 3 -and $k.readable -eq 0) "objects=$($k.count) readable=$($k.readable) $($k.error)"

# ---------- review ----------
$r = Req -Method POST -Path "/auth/login" -Client "admin" -Body @{ phone = "0900000001"; password = "Admin@2026" } -Jar $admJar
$setup = (Req -Method POST -Path "/auth/totp/setup" -Client "admin" -Jar $admJar).Json
$r = Req -Method POST -Path "/auth/totp/enable" -Client "admin" -Body @{ code = (TotpCode $setup.secret) } -Jar $admJar
Check "Reviewer signs in with two-factor" ($r.Code -eq 200) "got $($r.Code)"

$queue = Req -Path "/admin/verifications?status=PENDING&kind=IDENTITY" -Client "admin" -Jar $admJar
$request = @($queue.Json.items | Where-Object { $_.store.id -eq $storeId })[0]
Check "Request appears in the review queue" ($null -ne $request)
Check "Queue lists attached files without storage keys" (@($request.files).Count -eq 3 -and -not ($queue.Text -match '"key"')) "files=$(@($request.files).Count)"

$fileHeaders = Join-Path $Tmp "file-headers.txt"; $fileBody = Join-Path $Tmp "id-front.bin"
$code = curl.exe -s -D $fileHeaders -o $fileBody -w "%{http_code}" -H "X-Client: admin" -H "Origin: $($Origins.admin)" -b $admJar "$Api/admin/verifications/$($request.id)/files/idFront"
$headersText = [IO.File]::ReadAllText($fileHeaders); $fileBytes = [IO.File]::ReadAllBytes($fileBody)
Check "Reviewer receives the decrypted ID photo" ($code -eq "200" -and $headersText -match "Content-Type: image/jpeg" -and $fileBytes[0] -eq 0xFF -and $fileBytes[1] -eq 0xD8) "got $code"
Check "Evidence responses are never cached" ($headersText -match "Cache-Control: no-store")
$code = curl.exe -s -o NUL -w "%{http_code}" -H "X-Client: admin" -H "Origin: $($Origins.admin)" -b $admJar "$Api/admin/verifications/$($request.id)/files/__proto__"
Check "Unknown file slots return 404" ($code -eq "404") "got $code"

$r = Req -Method PATCH -Path "/admin/verifications/$($request.id)" -Client "admin" -Body @{ decision = "REJECT" } -Jar $admJar
Check "Rejecting needs a reason for the merchant" ($r.Code -eq 400) "got $($r.Code)"
$r = Req -Method PATCH -Path "/admin/verifications/$($request.id)" -Client "admin" -Body @{ decision = "APPROVE" } -Jar $admJar
Check "Identity approved" ($r.Code -eq 200 -and $r.Json.level -eq "IDENTITY") "got $($r.Code) $($r.Json.level)"
$r = Req -Method PATCH -Path "/admin/verifications/$($request.id)" -Client "admin" -Body @{ decision = "APPROVE" } -Jar $admJar
Check "A decided request can't be decided again" ($r.Code -eq 409) "got $($r.Code)"
$v = (Req -Path "/merchant/verification" -Client "merchant" -Jar $merJar).Json
Check "Store is now IDENTITY with a 50-product limit" ($v.level -eq "IDENTITY" -and $v.productLimit -eq 50) "$($v.level) $($v.productLimit)"
$r = Req -Method POST -Path "/merchant/products" -Client "merchant" -Body $product -Jar $merJar
Check "11th product is allowed after identity verification" ($r.Code -eq 201) "got $($r.Code)"

# ---------- level 2: shop video with GPS ----------
# Seeded geofences are drafts that never refuse anyone; confirm Hamidiyah's so the boundary is enforced
$r = Req -Method PATCH -Path "/admin/markets/$($hamidiyah.id)/geofence" -Client "admin" -Body @{ latitude = 33.5113; longitude = 36.3035; radiusMeters = 400; status = "CONFIRMED" } -Jar $admJar
Check "Admin confirms the market geofence" ($r.Code -eq 200 -and $r.Json.geofenceStatus -eq "CONFIRMED") "got $($r.Code)"
$r = Upload "/merchant/verification/location" $merJar (LocationParts 33.5113 36.3035 20 (Get-Date).AddHours(-2))
Check "An old recording is refused" ($r.Code -eq 400) "got $($r.Code)"
$r = Upload "/merchant/verification/location" $merJar (LocationParts 33.5113 36.3035 500 (Get-Date))
Check "Imprecise GPS is refused" ($r.Code -eq 400) "got $($r.Code)"
$r = Upload "/merchant/verification/location" $merJar (LocationParts 33.5300 36.2800 20 (Get-Date))
Check "Video recorded outside the market geofence is refused" ($r.Code -eq 400 -and $r.Json.message -match "\d{3,}") "got $($r.Code)"
$r = Upload "/merchant/verification/location" $merJar (LocationParts 33.5113 36.3035 20 (Get-Date) $fakeVideo)
Check "A non-video file is refused" ($r.Code -eq 400) "got $($r.Code)"
$r = Upload "/merchant/verification/location" $merJar (LocationParts 33.5113 36.3035 20 (Get-Date))
Check "Shop video inside the market is accepted for review" ($r.Code -eq 201) "got $($r.Code) $($r.Json.message)"

$queue = Req -Path "/admin/verifications?status=PENDING&kind=LOCATION" -Client "admin" -Jar $admJar
$request = @($queue.Json.items | Where-Object { $_.store.id -eq $storeId })[0]
Check "Reviewer sees the automatic GPS check" ($request.geoCheck -eq "INSIDE" -and $null -ne $request.distanceMeters) "$($request.geoCheck) $($request.distanceMeters) m"
$r = Req -Method PATCH -Path "/admin/verifications/$($request.id)" -Client "admin" -Body @{ decision = "APPROVE" } -Jar $admJar
Check "Shop verification approved" ($r.Code -eq 200 -and $r.Json.level -eq "LOCATION") "got $($r.Code) $($r.Json.level)"
$v = (Req -Path "/merchant/verification" -Client "merchant" -Jar $merJar).Json
Check "Shop verification expires in about a year" ($v.expiresAt -and ([datetime]$v.expiresAt - (Get-Date)).TotalDays -gt 360) "$($v.expiresAt)"
Check "Public store page shows the verified shop" ((Req -Path "/stores/$storeSlug").Json.verificationLevel -eq "LOCATION")

# ---------- continuous controls ----------
$update = @{ name = "E2E Verify Shop"; governorateId = $damascus.id; marketId = $buzuriyah.id; whatsapp = $phone; hasDelivery = $false }
$r = Req -Method PATCH -Path "/merchant/store" -Client "merchant" -Body $update -Jar $merJar
$v = (Req -Path "/merchant/verification" -Client "merchant" -Jar $merJar).Json
Check "Moving the store to another market removes shop verification" ($r.Code -eq 200 -and $v.level -eq "IDENTITY" -and -not $v.expiresAt) "got $($r.Code) $($v.level)"
$r = Req -Method PATCH -Path "/admin/stores/$storeId/level" -Client "admin" -Body @{ level = "LOCATION"; note = "e2e manual raise" } -Jar $admJar
Check "Admins can't raise a level without the merchant's evidence" ($r.Code -eq 400) "got $($r.Code)"
$r = Req -Method PATCH -Path "/admin/stores/$storeId/level" -Client "admin" -Body @{ level = "PREMIUM"; note = "e2e field visit" } -Jar $admJar
Check "Premium needs a verified shop first" ($r.Code -eq 400) "got $($r.Code)"

for ($i = 1; $i -le 3; $i++) {
  Req -Method POST -Path "/reports" -Body @{ storeSlug = $storeSlug; reason = "معلومات مضللة"; details = "e2e-verify $i" } -Jar $buyJar | Out-Null
  $open = @((Req -Path "/admin/reports?status=OPEN&pageSize=100" -Client "admin" -Jar $admJar).Json.items | Where-Object { $_.details -eq "e2e-verify $i" })[0]
  Req -Method PATCH -Path "/admin/reports/$($open.id)" -Client "admin" -Body @{ status = "RESOLVED" } -Jar $admJar | Out-Null
  if ($i -eq 2) {
    $v = (Req -Path "/merchant/verification" -Client "merchant" -Jar $merJar).Json
    Check "Two confirmed reports don't suspend the badge" (-not $v.badgeSuspended -and $v.level -eq "IDENTITY") "$($v.level)"
  }
}
$v = (Req -Path "/merchant/verification" -Client "merchant" -Jar $merJar).Json
Check "Third confirmed report suspends the badge automatically" ($v.badgeSuspended -and $v.level -eq "REGISTERED" -and $v.earnedLevel -eq "IDENTITY") "$($v.level) earned=$($v.earnedLevel)"
$r = Req -Method PATCH -Path "/admin/stores/$storeId/badge" -Client "admin" -Body @{ note = "e2e restore after review" } -Jar $admJar
$v = (Req -Path "/merchant/verification" -Client "merchant" -Jar $merJar).Json
Check "Admin restores the badge after review" ($r.Code -eq 200 -and -not $v.badgeSuspended -and $v.level -eq "IDENTITY") "got $($r.Code) $($v.level)"

$actions = @((Req -Path "/admin/audit-logs?pageSize=100" -Client "admin" -Jar $admJar).Json.items | ForEach-Object { $_.action })
$expected = @("verification.submitted", "verification.file_viewed", "verification.approved", "verification.geo_rejected", "store.verification_reset", "store.badge_suspended", "store.badge_restored")
$missing = @($expected | Where-Object { $actions -notcontains $_ })
Check "Audit log records submissions, file views, decisions, geofence refusals and badge changes" ($missing.Count -eq 0) "missing: $($missing -join ',')"

# ---------- cleanup ----------
Req -Method PATCH -Path "/admin/markets/$($hamidiyah.id)/geofence" -Client "admin" -Body @{ latitude = 33.5113; longitude = 36.3035; radiusMeters = 400; status = "DRAFT" } -Jar $admJar | Out-Null
KycObjects $storeId "delete" | Out-Null
Sql 'DELETE FROM "User" WHERE phone = ''963900000400''; UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE phone = ''963900000001''; DELETE FROM "Session";' | Out-Null
$k = KycObjects $storeId
Check "Cleanup removed the test store's evidence" ($k.count -eq 0) "objects=$($k.count)"

""
$results
""
"{0} passed, {1} failed" -f @($results | Where-Object { $_ -like "PASS*" }).Count, @($results | Where-Object { $_ -like "FAIL*" }).Count
