# Account lockout check, run against a freshly started API (in-memory rate limits reset).
# Uses the seeded demo buyer 0900000200 and unlocks it afterwards. ASCII only (PowerShell 5.1 safe).

$Api = "http://localhost:4000"
$Tmp = Join-Path $env:TEMP "tj-e2e"
[IO.Directory]::CreateDirectory($Tmp) | Out-Null
$results = New-Object System.Collections.Generic.List[string]

function Check([string]$name, [bool]$ok, [string]$detail = "") {
  $mark = if ($ok) { "PASS" } else { "FAIL" }
  $results.Add(("{0}  {1}{2}" -f $mark, $name, $(if ($detail) { " | $detail" } else { "" })))
}

function Login([string]$password) {
  $bf = Join-Path $Tmp "lockout.json"
  [IO.File]::WriteAllText($bf, (@{ phone = "0900000200"; password = $password } | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
  $out = Join-Path $Tmp "lockout-body.txt"
  $code = curl.exe -s -o $out -w "%{http_code}" -X POST -H "X-Client: web" -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data-binary "@$bf" "$Api/auth/login"
  [pscustomobject]@{ Code = [int]$code; Body = [IO.File]::ReadAllText($out, [Text.Encoding]::UTF8) }
}

function Sql([string]$query) {
  ($query | docker exec -i tujjar_postgres psql -U tujjar -d tujjar_db -t -A) -join "`n"
}

# Start from a clean state
Sql 'UPDATE "User" SET "failedLogins" = 0, "lockedUntil" = NULL WHERE phone = ''963900000200'';' | Out-Null

$codes = @()
for ($i = 1; $i -le 4; $i++) { $codes += (Login "wrong-password-$i").Code }
Check "Failures 1-4 return 401" (@($codes | Where-Object { $_ -ne 401 }).Count -eq 0) ($codes -join ",")
$failed = Sql 'SELECT "failedLogins" FROM "User" WHERE phone = ''963900000200'';'
Check "Failed attempts are counted" ($failed.Trim() -eq "4") "failedLogins=$($failed.Trim())"

$fifth = Login "wrong-password-5"
Check "Fifth failure returns 401" ($fifth.Code -eq 401) "got $($fifth.Code)"
$locked = Sql 'SELECT "lockedUntil" IS NOT NULL AND "lockedUntil" > now() + interval ''14 minutes'' FROM "User" WHERE phone = ''963900000200'';'
Check "Account is locked for about 15 minutes" ($locked.Trim() -eq "t") "lockedUntil set=$($locked.Trim())"

$correct = Login "Buyer@2026"
Check "Correct password is refused while locked" ($correct.Code -eq 429) "got $($correct.Code)"
Check "Refusal is the lockout, not the IP rate limit" (-not ($correct.Body -match "ThrottlerException")) ($correct.Body.Length.ToString() + " bytes")

$audit = Sql 'SELECT count(*) FROM "AuditLog" a JOIN "User" u ON u.id = a."actorId" WHERE u.phone = ''963900000200'' AND a.action = ''auth.account_locked'';'
Check "Lockout is written to the audit log" ([int]$audit.Trim() -ge 1) "entries=$($audit.Trim())"

# Unlock and confirm normal login works again
Sql 'UPDATE "User" SET "failedLogins" = 0, "lockedUntil" = NULL WHERE phone = ''963900000200'';' | Out-Null
$after = Login "Buyer@2026"
Check "Login works again after unlock" ($after.Code -eq 200) "got $($after.Code)"
Sql 'DELETE FROM "Session" WHERE "userId" = (SELECT id FROM "User" WHERE phone = ''963900000200'');' | Out-Null

""
$results
""
"{0} passed, {1} failed" -f @($results | Where-Object { $_ -like "PASS*" }).Count, @($results | Where-Object { $_ -like "FAIL*" }).Count
