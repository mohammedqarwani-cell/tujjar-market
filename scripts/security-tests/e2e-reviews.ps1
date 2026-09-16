# End-to-end checks for store reviews and reporter credibility (dev environment).
# Creates a temporary buyer (0900000600), enables admin TOTP for the test, then cleans everything up.
# Restart the API first so rate limits are fresh. Save with a UTF-8 BOM (the report reason is Arabic).

$ErrorActionPreference = "Continue"
$Api = "http://localhost:4000"
$Origins = @{ web = "http://localhost:3000"; merchant = "http://localhost:3001"; admin = "http://localhost:3002" }
# Built by scripts\build-totp-helper.ps1
$Totp = Join-Path $env:TEMP "tj-totp\auth\totp.js"
if (-not (Test-Path $Totp)) { throw "Run scripts\build-totp-helper.ps1 first" }
$Tmp = Join-Path $env:TEMP "tj-e2e-reviews"
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

$Store = "brocade-alsham"
$OtherStore = "abu-fouad-spices"
$Phone = "0900000600"
$BuyerE164 = "963900000600"
$buyJar = Join-Path $Tmp "buyer.jar"; $merJar = Join-Path $Tmp "merchant.jar"; $admJar = Join-Path $Tmp "admin.jar"
foreach ($j in @($buyJar, $merJar, $admJar)) { if (Test-Path $j) { [IO.File]::Delete($j) } }

$Recalc = 'UPDATE "Store" s SET "ratingAvg" = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM "Review" r WHERE r."storeId" = s.id AND r.status = ''PUBLISHED''), 0), "ratingCount" = (SELECT count(*) FROM "Review" r WHERE r."storeId" = s.id AND r.status = ''PUBLISHED'');'
$Reset = 'DELETE FROM "User" WHERE phone = ''963900000600''; UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE phone = ''963900000001''; UPDATE "Store" SET whatsapp = ''963900000101'' WHERE slug = ''abu-fouad-spices'';'
Sql ($Reset + $Recalc) | Out-Null

# ---------- buyer account ----------
$otp = (Req -Method POST -Path "/auth/otp" -Body @{ phone = $Phone; purpose = "REGISTER" }).Json.devCode
$r = Req -Method POST -Path "/auth/register/buyer" -Body @{ name = "Review Tester"; phone = $Phone; password = "Test@2026x"; otpCode = $otp; acceptTerms = $true } -Jar $buyJar
Check "Temporary buyer registers" ($r.Code -eq 201) "got $($r.Code) $($r.Json.message)"

$baseline = (Req -Path "/stores/$Store/reviews").Json.summary.count
Check "Public review list works" ($null -ne $baseline) "published before test: $baseline"

# ---------- only buyers who contacted the store ----------
$mine = (Req -Path "/stores/$Store/reviews/mine" -Jar $buyJar).Json
Check "Without a contact the buyer can't review" (-not $mine.canReview -and $mine.reason -eq "NO_CONTACT") "$($mine.reason)"
$r = Req -Method POST -Path "/stores/$Store/reviews" -Body @{ rating = 5 } -Jar $buyJar
Check "Posting a review without a contact is refused" ($r.Code -eq 403 -and $r.Json.code -eq "NO_CONTACT") "got $($r.Code)"

$r = Req -Method POST -Path "/track/contact" -Body @{ storeSlug = $Store; channel = "WHATSAPP" }
$mine = (Req -Path "/stores/$Store/reviews/mine" -Jar $buyJar).Json
Check "An anonymous contact doesn't unlock reviewing" ($r.Code -eq 204 -and $mine.reason -eq "NO_CONTACT") "track $($r.Code), $($mine.reason)"

$r = Req -Method POST -Path "/track/contact" -Body @{ storeSlug = $Store; channel = "WHATSAPP" } -Jar $buyJar
$mine = (Req -Path "/stores/$Store/reviews/mine" -Jar $buyJar).Json
Check "A signed-in contact is remembered, but reviewing waits 30 minutes" ($r.Code -eq 204 -and $mine.reason -eq "TOO_SOON" -and $mine.availableAt) "track $($r.Code), $($mine.reason)"
$r = Req -Method POST -Path "/stores/$Store/reviews" -Body @{ rating = 5 } -Jar $buyJar
Check "Reviewing right after the contact is refused" ($r.Code -eq 403 -and $r.Json.code -eq "TOO_SOON") "got $($r.Code)"

Sql "UPDATE ""StoreContact"" SET ""firstContactAt"" = now() - interval '1 hour' WHERE ""buyerId"" = (SELECT id FROM ""User"" WHERE phone = '$BuyerE164');" | Out-Null
$mine = (Req -Path "/stores/$Store/reviews/mine" -Jar $buyJar).Json
Check "After the waiting time the buyer can review" ($mine.canReview) "$($mine.reason)"

# ---------- writing a review ----------
$r = Req -Method POST -Path "/stores/$Store/reviews" -Body @{ rating = 6 } -Jar $buyJar
Check "A rating outside 1-5 is refused" ($r.Code -eq 400) "got $($r.Code)"
$r = Req -Method POST -Path "/stores/$Store/reviews" -Body @{ rating = 5; comment = "Great quality and an honest seller" } -Jar $buyJar
Check "A clean review is published immediately" ($r.Code -eq 201 -and $r.Json.status -eq "PUBLISHED") "got $($r.Code) $($r.Json.status)"
$reviewId = $r.Json.id
$list = Req -Path "/stores/$Store/reviews"
$item = @($list.Json.items | Where-Object { $_.id -eq $reviewId })[0]
Check "Public list shows it with a masked name and no phone" ($list.Json.summary.count -eq $baseline + 1 -and $item.author -eq "Review T." -and -not ($list.Text -match $BuyerE164)) "author=$($item.author)"
$storeInfo = (Req -Path "/stores/$Store").Json
Check "The store rating includes the review" ($storeInfo.ratingCount -eq $baseline + 1 -and $storeInfo.ratingAvg -gt 0) "count=$($storeInfo.ratingCount) avg=$($storeInfo.ratingAvg)"

$r = Req -Method POST -Path "/stores/$Store/reviews" -Body @{ rating = 4; comment = "Good, delivery was a bit slow" } -Jar $buyJar
$count = (Req -Path "/stores/$Store/reviews").Json.summary.count
Check "Posting again edits the same review (one per buyer)" ($r.Code -eq 201 -and $r.Json.id -eq $reviewId -and $count -eq $baseline + 1) "count=$count"

$r = Req -Method POST -Path "/stores/$Store/reviews" -Body @{ rating = 1; comment = "Call me instead on 0944 123 456" } -Jar $buyJar
$count = (Req -Path "/stores/$Store/reviews").Json.summary.count
Check "A review with a phone number is held for moderation" ($r.Json.status -eq "UNDER_REVIEW" -and $count -eq $baseline) "status=$($r.Json.status) count=$count"

$r = Req -Method POST -Path "/stores/$Store/reviews" -Client "web" -Body @{ rating = 5 } -Jar $merJar
Check "A request without a buyer session is refused" ($r.Code -eq 401) "got $($r.Code)"

# ---------- merchant ----------
$r = Req -Method POST -Path "/auth/login" -Client "merchant" -Body @{ phone = "0900000100"; password = "Tujjar@2026" } -Jar $merJar
$mlist = Req -Path "/merchant/reviews" -Client "merchant" -Jar $merJar
$mitem = @($mlist.Json.items | Where-Object { $_.id -eq $reviewId })[0]
Check "Merchant sees the review with a masked name only" ($mitem -and $mitem.author -eq "Review T." -and -not ($mlist.Text -match $BuyerE164)) "status=$($mitem.status)"
$r = Req -Method PATCH -Path "/merchant/reviews/$reviewId/reply" -Client "merchant" -Body @{ reply = "Thanks, we will contact you" } -Jar $merJar
Check "Merchant can't reply to a review under moderation" ($r.Code -eq 400) "got $($r.Code)"
$r = Req -Method POST -Path "/merchant/reviews/$reviewId/flag" -Client "merchant" -Body @{ reason = "This person never bought from us" } -Jar $merJar
Check "Merchant can ask for moderation" ($r.Code -eq 200 -and $r.Json.flagOpen) "got $($r.Code)"
$r = Req -Method POST -Path "/merchant/reviews/$reviewId/flag" -Client "merchant" -Body @{ reason = "Asking again for the same review" } -Jar $merJar
Check "A second request for the same review is refused" ($r.Code -eq 409) "got $($r.Code)"

# ---------- moderation ----------
$r = Req -Method POST -Path "/auth/login" -Client "admin" -Body @{ phone = "0900000001"; password = "Admin@2026" } -Jar $admJar
$setup = (Req -Method POST -Path "/auth/totp/setup" -Client "admin" -Jar $admJar).Json
$r = Req -Method POST -Path "/auth/totp/enable" -Client "admin" -Body @{ code = (TotpCode $setup.secret) } -Jar $admJar
Check "Moderator signs in with two-factor" ($r.Code -eq 200) "got $($r.Code)"
$ov = (Req -Path "/admin/overview" -Client "admin" -Jar $admJar).Json
Check "Dashboard counts reviews to moderate" ($ov.reviewsToModerate -ge 1) "reviewsToModerate=$($ov.reviewsToModerate)"
$alist = Req -Path "/admin/reviews?status=UNDER_REVIEW" -Client "admin" -Jar $admJar
$aitem = @($alist.Json.items | Where-Object { $_.id -eq $reviewId })[0]
Check "Moderator sees the author's phone and the contact evidence" ($aitem.buyer.phone -eq $BuyerE164 -and $aitem.contact.contacts -ge 1 -and $aitem.moderationNote) "contacts=$($aitem.contact.contacts)"
$r = Req -Method PATCH -Path "/admin/reviews/$reviewId" -Client "admin" -Body @{ status = "HIDDEN" } -Jar $admJar
Check "Hiding a review needs a reason" ($r.Code -eq 400) "got $($r.Code)"
$r = Req -Method PATCH -Path "/admin/reviews/$reviewId" -Client "admin" -Body @{ status = "PUBLISHED"; note = "Checked with the buyer" } -Jar $admJar
$count = (Req -Path "/stores/$Store/reviews").Json.summary.count
Check "Publishing clears the merchant flag and counts the review again" ($r.Code -eq 200 -and -not $r.Json.flagOpen -and $count -eq $baseline + 1) "count=$count"
$r = Req -Method PATCH -Path "/merchant/reviews/$reviewId/reply" -Client "merchant" -Body @{ reply = "Thanks, we will contact you" } -Jar $merJar
$item = @((Req -Path "/stores/$Store/reviews").Json.items | Where-Object { $_.id -eq $reviewId })[0]
Check "Merchant reply is shown publicly under the review" ($r.Code -eq 200 -and $item.merchantReply) "got $($r.Code)"

$r = Req -Method DELETE -Path "/stores/$Store/reviews/mine" -Jar $buyJar
$count = (Req -Path "/stores/$Store/reviews").Json.summary.count
$storeAfter = (Req -Path "/stores/$Store").Json
Check "Buyer can delete their review and the rating updates" ($r.Code -eq 204 -and $count -eq $baseline -and $storeAfter.ratingCount -eq $baseline) "count=$count"

# ---------- a merchant can't review their own shop ----------
Sql "UPDATE ""Store"" SET whatsapp = '$BuyerE164' WHERE slug = '$OtherStore';" | Out-Null
Req -Method POST -Path "/track/contact" -Body @{ storeSlug = $OtherStore; channel = "CALL" } -Jar $buyJar | Out-Null
Sql "UPDATE ""StoreContact"" SET ""firstContactAt"" = now() - interval '1 hour' WHERE ""buyerId"" = (SELECT id FROM ""User"" WHERE phone = '$BuyerE164');" | Out-Null
$mine = (Req -Path "/stores/$OtherStore/reviews/mine" -Jar $buyJar).Json
Check "A shop using the buyer's number can't be reviewed by that buyer" (-not $mine.canReview -and $mine.reason -eq "OWN_STORE") "$($mine.reason)"
Sql "UPDATE ""Store"" SET whatsapp = '963900000101' WHERE slug = '$OtherStore';" | Out-Null

# ---------- reporter credibility ----------
$products = @((Req -Path "/products?pageSize=6").Json.items | ForEach-Object { $_.id })
$reportIds = @()
for ($i = 0; $i -lt 5; $i++) {
  Req -Method POST -Path "/reports" -Body @{ productId = $products[$i]; reason = "معلومات مضللة"; details = "e2e-credibility $i" } -Jar $buyJar | Out-Null
}
$open = @((Req -Path "/admin/reports?status=OPEN&pageSize=100" -Client "admin" -Jar $admJar).Json.items | Where-Object { $_.details -like "e2e-credibility*" })
Check "Five reports reach the moderators" ($open.Count -eq 5) "open=$($open.Count)"
Check "A new reporter starts at 50% credibility" ($open[0].reporter.credibility -eq 50) "credibility=$($open[0].reporter.credibility)"
foreach ($rep in $open) { Req -Method PATCH -Path "/admin/reports/$($rep.id)" -Client "admin" -Body @{ status = "DISMISSED" } -Jar $admJar | Out-Null }
$dismissed = @((Req -Path "/admin/reports?status=DISMISSED&pageSize=100" -Client "admin" -Jar $admJar).Json.items | Where-Object { $_.details -like "e2e-credibility*" })[0]
Check "Dismissals lower credibility and pause reporting" ($dismissed.reporter.reportsDismissed -eq 5 -and $dismissed.reporter.credibility -lt 20 -and $dismissed.reporter.blocked) "credibility=$($dismissed.reporter.credibility) blocked=$($dismissed.reporter.blocked)"
$r = Req -Method POST -Path "/reports" -Body @{ productId = $products[5]; reason = "معلومات مضللة"; details = "e2e-credibility blocked" } -Jar $buyJar
Check "A paused reporter can't file new reports" ($r.Code -eq 403) "got $($r.Code)"

$actions = @((Req -Path "/admin/audit-logs?pageSize=100" -Client "admin" -Jar $admJar).Json.items | ForEach-Object { $_.action })
$expected = @("review.created", "review.updated", "review.flagged", "review.published", "review.replied", "review.deleted", "user.reporting_blocked")
$missing = @($expected | Where-Object { $actions -notcontains $_ })
Check "Audit log records reviews, moderation and the reporting pause" ($missing.Count -eq 0) "missing: $($missing -join ',')"

# ---------- cleanup ----------
Sql ($Reset + $Recalc + ' DELETE FROM "Session";') | Out-Null

""
$results
""
"{0} passed, {1} failed" -f @($results | Where-Object { $_ -like "PASS*" }).Count, @($results | Where-Object { $_ -like "FAIL*" }).Count
