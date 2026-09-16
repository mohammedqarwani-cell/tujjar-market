# End-to-end checks for notifications, Web Push subscriptions, store follows, favorites and campaigns (dev environment).
# Creates a temporary buyer (0900000700) and two products in "brocade-alsham", enables admin TOTP for the test,
# then cleans everything up. Restart the API first so rate limits are fresh. Save with a UTF-8 BOM (Arabic text).

$ErrorActionPreference = "Continue"
$Api = "http://localhost:4000"
$Origins = @{ web = "http://localhost:3000"; merchant = "http://localhost:3001"; admin = "http://localhost:3002" }
$Totp = Join-Path $env:TEMP "tj-totp\auth\totp.js"
if (-not (Test-Path $Totp)) { throw "Run scripts\build-totp-helper.ps1 first" }
$Tmp = Join-Path $env:TEMP "tj-e2e-notifications"
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
  if (Test-Path $out) { [IO.File]::Delete($out) }
  $a = @("-s", "-X", $Method, "-o", $out, "-w", "%{http_code}", "-H", "X-Client: $Client", "-H", "Origin: $($Origins[$Client])")
  if ($Jar) { $a += @("-b", $Jar, "-c", $Jar) }
  if ($null -ne $Body) {
    $bf = Join-Path $Tmp "request.json"
    [IO.File]::WriteAllText($bf, ($Body | ConvertTo-Json -Depth 6), $Utf8)
    $a += @("-H", "Content-Type: application/json", "--data-binary", "@$bf")
  }
  $code = & curl.exe @a "$Api$Path"
  $text = if (Test-Path $out) { [IO.File]::ReadAllText($out, [Text.Encoding]::UTF8) } else { "" }
  $json = $null; try { if ($text) { $json = $text | ConvertFrom-Json } } catch {}
  [pscustomobject]@{ Code = [int]$code; Json = $json; Text = $text }
}

function TotpCode([string]$secret) { (node -e "const t=require(process.argv[1]);console.log(t.hotp(t.base32Decode(process.argv[2]),t.currentStep()))" $Totp $secret).Trim() }
function Sql([string]$query) { $query | docker exec -i tujjar_postgres psql -U tujjar -d tujjar_db -q -t -A }
function Inbox([string]$jar, [string]$client = "web") { @((Req -Path "/notifications?pageSize=50" -Client $client -Jar $jar).Json.items) }

$StoreSlug = "brocade-alsham"
$Phone = "0900000700"
$BuyerE164 = "963900000700"
$buyJar = Join-Path $Tmp "buyer.jar"; $merJar = Join-Path $Tmp "merchant.jar"; $admJar = Join-Path $Tmp "admin.jar"
foreach ($j in @($buyJar, $merJar, $admJar)) { if (Test-Path $j) { [IO.File]::Delete($j) } }

$startedAt = (Sql "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS');").Trim()
$Reset = 'DELETE FROM "User" WHERE phone = ''963900000700''; UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE phone = ''963900000001''; DELETE FROM "Product" WHERE title LIKE ''e2e-notify%'';'
Sql $Reset | Out-Null

# ---------- account and inbox ----------
$r = Req -Path "/notifications/push/key"
Check "The Web Push public key is published" ($r.Code -eq 200 -and $r.Json.publicKey.Length -gt 80) "got $($r.Code)"
$r = Req -Path "/notifications"
Check "The inbox needs a session" ($r.Code -eq 401) "got $($r.Code)"

$otp = (Req -Method POST -Path "/auth/otp" -Body @{ phone = $Phone; purpose = "REGISTER" }).Json.devCode
$r = Req -Method POST -Path "/auth/register/buyer" -Body @{ name = "Notify Tester"; phone = $Phone; password = "Test@2026x"; otpCode = $otp; acceptTerms = $true } -Jar $buyJar
Start-Sleep -Seconds 2
$inbox = Inbox $buyJar
$unread = (Req -Path "/notifications/unread-count" -Jar $buyJar).Json.unread
Check "A new buyer gets a welcome notification" ($r.Code -eq 201 -and ($inbox | Where-Object { $_.type -eq "welcome" }) -and $unread -ge 1) "register $($r.Code), unread=$unread"

$r = Req -Method POST -Path "/notifications/read" -Body @{} -Jar $buyJar
Check "Marking all as read clears the counter" ($r.Code -eq 200 -and $r.Json.unread -eq 0) "unread=$($r.Json.unread)"

$prefs = (Req -Path "/notifications/preferences" -Jar $buyJar).Json.categories
$keys = @($prefs | ForEach-Object { $_.key }) -join ","
Check "Buyers get their own notification categories" ($keys -eq "ACCOUNT,FAVORITES,FOLLOWING,PROMOTIONS,INVITES") $keys
$r = Req -Method PUT -Path "/notifications/preferences" -Body @{ prefs = @{ ACCOUNT = @{ inApp = $false; push = $false } } } -Jar $buyJar
$account = @($r.Json.categories | Where-Object { $_.key -eq "ACCOUNT" })[0]
Check "Account notices can't be removed from the app, but their push can" ($r.Code -eq 200 -and $account.inApp -and -not $account.push) "inApp=$($account.inApp) push=$($account.push)"
$r = Req -Method PUT -Path "/notifications/preferences" -Body @{ prefs = @{ MODERATION = @{ push = $false } } } -Jar $buyJar
Check "A buyer can't set staff categories" ($r.Code -eq 400) "got $($r.Code)"

# ---------- push subscriptions ----------
$keysBody = @{ p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"; auth = "tBHItJI5svbpez7KI4CCXg" }
$r = Req -Method POST -Path "/notifications/push/subscribe" -Body @{ endpoint = "http://127.0.0.1:9000/steal"; keys = $keysBody } -Jar $buyJar
$r2 = Req -Method POST -Path "/notifications/push/subscribe" -Body @{ endpoint = "https://attacker.example/push/abc"; keys = $keysBody } -Jar $buyJar
Check "Push endpoints must belong to a real push service (no SSRF)" ($r.Code -eq 400 -and $r2.Code -eq 400) "http=$($r.Code) other=$($r2.Code)"
$endpoint = "https://fcm.googleapis.com/fcm/send/e2e-notify-test-device"
$r = Req -Method POST -Path "/notifications/push/subscribe" -Body @{ endpoint = $endpoint; keys = $keysBody } -Jar $buyJar
$stored = (Sql "SELECT audience FROM ""PushSubscription"" WHERE endpoint = '$endpoint';").Trim()
Check "A device subscribes for its own interface" ($r.Code -eq 200 -and $stored -eq "web") "got $($r.Code) audience=$stored"
$r = Req -Method POST -Path "/notifications/push/unsubscribe" -Body @{ endpoint = $endpoint } -Jar $buyJar
$left = (Sql "SELECT count(*) FROM ""PushSubscription"" WHERE endpoint = '$endpoint';").Trim()
Check "A device can unsubscribe" ($r.Code -eq 200 -and $left -eq "0") "left=$left"

# ---------- follows and favorites ----------
$r = Req -Method POST -Path "/stores/$StoreSlug/follow" -Jar $buyJar
Check "A buyer follows a store" ($r.Code -eq 200 -and $r.Json.following -and $r.Json.followers -ge 1) "got $($r.Code)"
$r = Req -Method POST -Path "/stores/$StoreSlug/follow"
Check "Following needs a buyer session" ($r.Code -eq 401) "got $($r.Code)"
$following = @((Req -Path "/me/following" -Jar $buyJar).Json | ForEach-Object { $_.slug })
Check "Followed stores are listed in the account" ($following -contains $StoreSlug) ($following -join ",")

$r = Req -Method POST -Path "/auth/login" -Client "merchant" -Body @{ phone = "0900000100"; password = "Tujjar@2026" } -Jar $merJar
$mine = @((Req -Path "/merchant/products?pageSize=100" -Client "merchant" -Jar $merJar).Json.items)
$fixed = @($mine | Where-Object { $_.priceType -eq "FIXED" -and $_.price -and $_.status -eq "ACTIVE" -and $_.inStock })[0]
$r = Req -Method POST -Path "/me/favorites/sync" -Body @{ ids = @($fixed.id, "not-a-product") } -Jar $buyJar
$favIds = @($r.Json | ForEach-Object { $_.id })
Check "Device favorites merge into the account (unknown ids ignored)" ($r.Code -eq 200 -and $favIds.Count -eq 1 -and $favIds[0] -eq $fixed.id) "count=$($favIds.Count)"

# ---------- catalogue activity ----------
$full = (Req -Path "/merchant/products/$($fixed.id)" -Client "merchant" -Jar $merJar).Json
function ProductBody($p, $overrides) {
  $b = @{ title = $p.title; description = $p.description; categoryId = $p.categoryId; priceType = $p.priceType; price = $p.price; oldPrice = $p.oldPrice; currency = $p.currency; condition = $p.condition; inStock = $p.inStock; images = @($p.images) }
  if (-not $b.description) { $b.Remove("description") }
  if (-not $b.oldPrice) { $b.Remove("oldPrice") }
  foreach ($k in $overrides.Keys) { $b[$k] = $overrides[$k] }
  $b
}

$new1 = Req -Method POST -Path "/merchant/products" -Client "merchant" -Body @{ title = "e2e-notify one"; categoryId = $full.categoryId; priceType = "FIXED"; price = 1000; currency = "SYP"; condition = "NEW"; inStock = $true; images = @() } -Jar $merJar
$new2 = Req -Method POST -Path "/merchant/products" -Client "merchant" -Body @{ title = "e2e-notify two"; categoryId = $full.categoryId; priceType = "FIXED"; price = 2000; currency = "SYP"; condition = "NEW"; inStock = $true; images = @() } -Jar $merJar
Start-Sleep -Seconds 3
$newItems = @(Inbox $buyJar | Where-Object { $_.type -eq "product.new" })
Check "Followers hear about new products, grouped per store per day" ($new1.Code -eq 201 -and $new2.Code -eq 201 -and $newItems.Count -eq 1 -and $newItems[0].count -eq 2 -and $newItems[0].category -eq "FOLLOWING") "items=$($newItems.Count) count=$($newItems[0].count)"

$lower = [int]([math]::Floor($full.price * 0.8))
$r = Req -Method PATCH -Path "/merchant/products/$($fixed.id)" -Client "merchant" -Body (ProductBody $full @{ price = $lower; oldPrice = $full.price }) -Jar $merJar
Start-Sleep -Seconds 3
$inbox = Inbox $buyJar
$drop = @($inbox | Where-Object { $_.type -eq "product.price_drop" })[0]
$offer = @($inbox | Where-Object { $_.type -eq "product.offer" })
Check "A price drop reaches buyers who saved the product" ($r.Code -eq 200 -and $drop -and $drop.category -eq "FAVORITES" -and $drop.url -eq "/products/$($fixed.id)") "patch $($r.Code)"
Check "Someone who saved the product isn't told twice about the same offer" ($offer.Count -eq 0) "offers=$($offer.Count)"

$r = Req -Method PATCH -Path "/merchant/products/$($fixed.id)" -Client "merchant" -Body (ProductBody $full @{ price = $lower; oldPrice = $full.price; inStock = $false }) -Jar $merJar
$r = Req -Method PATCH -Path "/merchant/products/$($fixed.id)" -Client "merchant" -Body (ProductBody $full @{ price = $lower; oldPrice = $full.price; inStock = $true }) -Jar $merJar
Start-Sleep -Seconds 3
$restock = @(Inbox $buyJar | Where-Object { $_.type -eq "product.restocked" })
Check "A restock reaches buyers who saved the product" ($restock.Count -eq 1) "restocks=$($restock.Count)"

# Turning a category off in the app hides new notifications of that kind
Req -Method POST -Path "/notifications/read" -Body @{} -Jar $buyJar | Out-Null
Req -Method PUT -Path "/notifications/preferences" -Body @{ prefs = @{ FAVORITES = @{ inApp = $false; push = $false } } } -Jar $buyJar | Out-Null
$r = Req -Method PATCH -Path "/merchant/products/$($fixed.id)" -Client "merchant" -Body (ProductBody $full @{ price = $lower - 1; oldPrice = $full.price }) -Jar $merJar
Start-Sleep -Seconds 3
$unread = (Req -Path "/notifications/unread-count" -Jar $buyJar).Json.unread
Check "A category switched off doesn't reach the inbox" ($r.Code -eq 200 -and $unread -eq 0) "unread=$unread"
Req -Method PUT -Path "/notifications/preferences" -Body @{ prefs = @{ FAVORITES = @{ inApp = $true; push = $true } } } -Jar $buyJar | Out-Null

# ---------- privacy between accounts ----------
$buyerNote = @(Inbox $buyJar)[0]
Sql "UPDATE ""Notification"" SET ""readAt"" = NULL WHERE id = '$($buyerNote.id)';" | Out-Null
$before = (Req -Path "/notifications/unread-count" -Jar $buyJar).Json.unread
Req -Method POST -Path "/notifications/read" -Client "merchant" -Body @{ ids = @($buyerNote.id) } -Jar $merJar | Out-Null
$after = (Req -Path "/notifications/unread-count" -Jar $buyJar).Json.unread
$merchantSees = @(Inbox $merJar "merchant" | Where-Object { $_.id -eq $buyerNote.id }).Count
Check "Accounts can neither read nor mark each other's notifications" ($before -ge 1 -and $after -eq $before -and $merchantSees -eq 0) "before=$before after=$after"

# ---------- reviews and replies ----------
Req -Method POST -Path "/track/contact" -Body @{ storeSlug = $StoreSlug; channel = "WHATSAPP" } -Jar $buyJar | Out-Null
Sql "UPDATE ""StoreContact"" SET ""firstContactAt"" = now() - interval '1 hour' WHERE ""buyerId"" = (SELECT id FROM ""User"" WHERE phone = '$BuyerE164');" | Out-Null
$review = Req -Method POST -Path "/stores/$StoreSlug/reviews" -Body @{ rating = 4; comment = "Good fabric" } -Jar $buyJar
Start-Sleep -Seconds 2
$merchantNew = @(Inbox $merJar "merchant" | Where-Object { $_.type -eq "review.new" })
Check "The merchant hears about a new review" ($review.Code -eq 201 -and $merchantNew.Count -ge 1 -and $merchantNew[0].category -eq "REVIEWS") "reviews=$($merchantNew.Count)"
$r = Req -Method PATCH -Path "/merchant/reviews/$($review.Json.id)/reply" -Client "merchant" -Body @{ reply = "Thank you for visiting" } -Jar $merJar
Start-Sleep -Seconds 2
$reply = @(Inbox $buyJar | Where-Object { $_.type -eq "review.replied" })
Check "The buyer hears when the merchant replies" ($r.Code -eq 200 -and $reply.Count -eq 1 -and $reply[0].url -eq "/stores/$StoreSlug#reviews") "replies=$($reply.Count)"

# ---------- staff queues, report outcomes, store status ----------
$r = Req -Method POST -Path "/auth/login" -Client "admin" -Body @{ phone = "0900000001"; password = "Admin@2026" } -Jar $admJar
$setup = (Req -Method POST -Path "/auth/totp/setup" -Client "admin" -Jar $admJar).Json
$r = Req -Method POST -Path "/auth/totp/enable" -Client "admin" -Body @{ code = (TotpCode $setup.secret) } -Jar $admJar
Check "Admin signs in with two-factor" ($r.Code -eq 200) "got $($r.Code)"

$product = @((Req -Path "/products?pageSize=3").Json.items)[0]
$r = Req -Method POST -Path "/reports" -Body @{ productId = $product.id; reason = "معلومات مضللة"; details = "e2e-notify report" } -Jar $buyJar
Start-Sleep -Seconds 2
$queue = @(Inbox $admJar "admin" | Where-Object { $_.type -eq "report.created" })
Check "Moderators hear about new reports" ($r.Code -eq 204 -and $queue.Count -ge 1 -and $queue[0].category -eq "MODERATION") "report $($r.Code), queue=$($queue.Count)"
$rep = @((Req -Path "/admin/reports?status=OPEN&pageSize=100" -Client "admin" -Jar $admJar).Json.items | Where-Object { $_.details -eq "e2e-notify report" })[0]
Req -Method PATCH -Path "/admin/reports/$($rep.id)" -Client "admin" -Body @{ status = "DISMISSED" } -Jar $admJar | Out-Null
Start-Sleep -Seconds 2
$outcome = @(Inbox $buyJar | Where-Object { $_.type -eq "report.dismissed" })
Check "The reporter hears the outcome of their report" ($outcome.Count -eq 1) "outcomes=$($outcome.Count)"

$storeId = (Sql "SELECT id FROM ""Store"" WHERE slug = '$StoreSlug';").Trim()
Req -Method PATCH -Path "/admin/stores/$storeId/status" -Client "admin" -Body @{ status = "SUSPENDED" } -Jar $admJar | Out-Null
$r = Req -Method PATCH -Path "/admin/stores/$storeId/status" -Client "admin" -Body @{ status = "ACTIVE" } -Jar $admJar
Start-Sleep -Seconds 2
$types = @(Inbox $merJar "merchant" | ForEach-Object { $_.type })
Check "The merchant hears when their store is suspended and reactivated" ($r.Code -eq 200 -and $types -contains "store.suspended" -and $types -contains "store.reactivated") ($types -join ",")

# ---------- campaigns ----------
$r = Req -Method POST -Path "/admin/campaigns" -Client "admin" -Body @{ category = "PROMOTIONS"; audience = "BUYERS"; title = "Offers"; body = "Seasonal offers"; url = "https://evil.example/login" } -Jar $admJar
$r2 = Req -Method POST -Path "/admin/campaigns" -Client "admin" -Body @{ category = "PROMOTIONS"; audience = "BUYERS"; title = "Offers"; body = "Seasonal offers"; url = "//evil.example" } -Jar $admJar
Check "Campaign links must stay inside the platform" ($r.Code -eq 400 -and $r2.Code -eq 400) "absolute=$($r.Code) protocol-relative=$($r2.Code)"
$r = Req -Method GET -Path "/admin/campaigns" -Client "merchant" -Jar $merJar
Check "Merchants can't reach campaigns" ($r.Code -eq 401 -or $r.Code -eq 403) "got $($r.Code)"
$estimate = (Req -Path "/admin/campaigns/estimate?audience=BUYERS" -Client "admin" -Jar $admJar).Json.recipients
$r = Req -Method POST -Path "/admin/campaigns" -Client "admin" -Body @{ category = "PROMOTIONS"; audience = "BUYERS"; title = "e2e-notify campaign"; body = "Seasonal offers in Damascus markets"; url = "/search?offers=1" } -Jar $admJar
$campaignId = $r.Json.id
Start-Sleep -Seconds 4
$got = @(Inbox $buyJar | Where-Object { $_.type -eq "campaign" -and $_.title -eq "e2e-notify campaign" })
$campaign = @((Req -Path "/admin/campaigns" -Client "admin" -Jar $admJar).Json.items | Where-Object { $_.id -eq $campaignId })[0]
Check "A campaign reaches its audience once and reports delivery" ($r.Code -eq 201 -and $got.Count -eq 1 -and $campaign.status -eq "SENT" -and $campaign.recipients -eq $estimate -and $campaign.delivered -ge 1) "status=$($campaign.status) recipients=$($campaign.recipients) delivered=$($campaign.delivered)"
$merchantGot = @(Inbox $merJar "merchant" | Where-Object { $_.type -eq "campaign" -and $_.title -eq "e2e-notify campaign" }).Count
Check "A buyers' campaign doesn't reach merchants" ($merchantGot -eq 0) "merchant=$merchantGot"

$actions = @((Req -Path "/admin/audit-logs?pageSize=100" -Client "admin" -Jar $admJar).Json.items | ForEach-Object { $_.action })
Check "Sending a campaign is recorded in the audit log" ($actions -contains "campaign.created") ""

# ---------- cleanup ----------
$restore = ProductBody $full @{}
Req -Method PATCH -Path "/merchant/products/$($fixed.id)" -Client "merchant" -Body $restore -Jar $merJar | Out-Null
Sql ("DELETE FROM ""Notification"" WHERE ""createdAt"" >= '$startedAt' OR ""updatedAt"" >= '$startedAt'; DELETE FROM ""Campaign"" WHERE title LIKE 'e2e-notify%'; " + $Reset + ' DELETE FROM "Session";') | Out-Null
$reviewRecalc = 'UPDATE "Store" s SET "ratingAvg" = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM "Review" r WHERE r."storeId" = s.id AND r.status = ''PUBLISHED''), 0), "ratingCount" = (SELECT count(*) FROM "Review" r WHERE r."storeId" = s.id AND r.status = ''PUBLISHED'');'
Sql $reviewRecalc | Out-Null

""
$results
""
"{0} passed, {1} failed" -f @($results | Where-Object { $_ -like "PASS*" }).Count, @($results | Where-Object { $_ -like "FAIL*" }).Count
