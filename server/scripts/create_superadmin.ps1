$envText = Get-Content -Path "$PSScriptRoot/../.env" -Raw
$lines = $envText -split "\r?\n"
$map = @{}
foreach ($l in $lines) {
  if ($l -match '^([^=]+)=(.*)$') { $map[$matches[1]] = $matches[2].Trim('"') }
}
$url = $map['SUPABASE_URL']
$key = $map['SUPABASE_SERVICE_ROLE_KEY']
$email = $map['SUPERADMIN_EMAIL']
$pass = $map['SUPERADMIN_PASSWORD']
$body = @{ email = $email; password = $pass; email_confirm = $true; user_metadata = @{ role = 'SUPERADMIN' } } | ConvertTo-Json
Write-Host "Creating user $email at $url"
try {
  $res1 = Invoke-RestMethod -Uri ($url + '/auth/v1/admin/users') -Method Post -Headers @{ Authorization = 'Bearer ' + $key; apikey = $key; 'Content-Type' = 'application/json' } -Body $body -UseBasicParsing
  Write-Host "Created user:" (ConvertTo-Json $res1)
  # insert profile row
  $profileBody = @{ id = $res1.id; email = $email; role = 'SUPERADMIN' } | ConvertTo-Json
  $res2 = Invoke-RestMethod -Uri ($url + '/rest/v1/profiles') -Method Post -Headers @{ Authorization = 'Bearer ' + $key; apikey = $key; 'Content-Type' = 'application/json'; Prefer = 'return=representation' } -Body $profileBody -UseBasicParsing
  Write-Host "Profile insert:" (ConvertTo-Json $res2)
} catch {
  Write-Host "Error:" $_.Exception.Message
}
