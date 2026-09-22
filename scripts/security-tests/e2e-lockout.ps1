# Failed sign-in throttling, run against a freshly started API (in-memory rate limits reset) with no
# PROXY_SECRET set. Failures are counted per (phone, address), never on the account itself, so a
# public merchant phone can't be locked out by others. Uses the seeded demo buyer 0900000200 and
# cleans up afterwards. ASCII only (PowerShell 5.1 safe).

$Api = "http://localhost:4000"
$Tmp = Join-Path $env:TEMP "tj-e2e"
[IO.Directory]::CreateDirectory($Tmp) | Out-Null
$results = New-Object System.Collections.Generic.List[string]

function Check([string]$name, [bool]$ok, [string]$detail = "") {
  $mark = if ($ok) { "PASS" } else { "FAIL" }
  $results.Add(("{0}  {1}{2}" -f $mark, $name, $(if ($detail) { " | $detail" } else { "" })))
}

function Login([string]$phone, [string]$password) {
  $bf = Join-Path $Tmp "lockout.json"
  [IO.File]::WriteAllText($bf, (@{ phone = $phone; password = $password } | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
  $out = Join-Path $Tmp "lockout-body.txt"
  $code = curl.exe -s -o $out -w "%{http_code}" -X POST -H "X-Client: web" -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data-binary "@$bf" "$Api/auth/login"
  [pscustomobject]@{ Code = [int]$code; Body = [IO.File]::ReadAllText($out, [Text.Encoding]::UTF8) }
}

function Sql([string]$query) {
  ($query | docker exec -i tujjar_postgres psql -U tujjar -d tujjar_db -t -A) -join "`n"
}

# 0999000555 is a valid number with no account
$Reset = 'DELETE FROM "LoginFailure" WHERE phone IN (''963900000200'', ''963999000555'');'
Sql $Reset | Out-Null

$codes = @()
for ($i = 1; $i -le 5; $i++) { $codes += (Login "0900000200" "wrong-password-$i").Code }
Check "Failures 1-5 return 401" (@($codes | Where-Object { $_ -ne 401 }).Count -eq 0) ($codes -join ",")

$counted = Sql 'SELECT count(*) FROM "LoginFailure" WHERE phone = ''963900000200'';'
Check "Failures are counted per phone and address" ($counted.Trim() -eq "5") "rows=$($counted.Trim())"

$locked = Sql 'SELECT "lockedUntil" IS NULL FROM "User" WHERE phone = ''963900000200'';'
Check "The account itself is never locked" ($locked.Trim() -eq "t") "lockedUntil empty=$($locked.Trim())"

$correct = Login "0900000200" "Buyer@2026"
Check "This address is blocked, even with the right password" ($correct.Code -eq 429) "got $($correct.Code)"

# An unknown number gets exactly the same answers. The login route allows 10 calls per 15 minutes per
# address, so four earlier failures are written directly and only the boundary is exercised here
# (src/auth/login-throttle.spec.ts compares the whole sequence).
Sql 'INSERT INTO "LoginFailure" (id, phone, ip) SELECT md5(random()::text), ''963999000555'', ip FROM (SELECT DISTINCT ip FROM "LoginFailure" WHERE phone = ''963900000200'') a, generate_series(1, 4);' | Out-Null
$unknown = @((Login "0999000555" "wrong-password-5").Code, (Login "0999000555" "wrong-password-6").Code)
Check "An unregistered number is answered the same way" (($unknown -join ",") -eq "401,429") ($unknown -join ",")

# Clean up and confirm normal login works
Sql $Reset | Out-Null
$after = Login "0900000200" "Buyer@2026"
Check "Login works once the pair's failures are gone" ($after.Code -eq 200) "got $($after.Code)"
Sql 'DELETE FROM "Session" WHERE "userId" = (SELECT id FROM "User" WHERE phone = ''963900000200'');' | Out-Null

""
$results
""
"{0} passed, {1} failed" -f @($results | Where-Object { $_ -like "PASS*" }).Count, @($results | Where-Object { $_ -like "FAIL*" }).Count
