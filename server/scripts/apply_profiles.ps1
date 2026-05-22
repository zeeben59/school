$sqlPath = Join-Path $PSScriptRoot '..\sql\create_profiles.sql'
if (-not (Test-Path $sqlPath)) { Write-Error "SQL file not found at $sqlPath"; exit 1 }

$envPath = Join-Path $PSScriptRoot '..\.env'
if (-not (Test-Path $envPath)) { Write-Error ".env not found in server folder"; exit 1 }

$content = Get-Content -Path $envPath -Raw
$map = @{}
foreach ($l in $content -split "`n") { if ($l -match '^([^=]+)=(.*)$') { $map[$matches[1]] = $matches[2].Trim('"') } }

$direct = $map['DIRECT_URL']
if ($direct) {
  Write-Host "Found DIRECT_URL in .env - attempting to apply SQL via psql."
  Write-Host "If you don't have psql installed, install it or paste the SQL into Supabase SQL editor."
  $sql = Get-Content -Path $sqlPath -Raw
  $tmp = [System.IO.Path]::GetTempFileName()
  Set-Content -Path $tmp -Value $sql -Encoding UTF8
  try {
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psql) { Write-Host "psql not found in PATH. Please install psql or use Supabase SQL editor."; exit 2 }
    & psql $direct -f $tmp
    if ($LASTEXITCODE -eq 0) { Write-Host "SQL applied successfully."; exit 0 } else { Write-Error "psql exited with code $LASTEXITCODE"; exit $LASTEXITCODE }
  } finally { Remove-Item -Path $tmp -ErrorAction SilentlyContinue }
} else {
  Write-Host "No DIRECT_URL found. To create the profiles table, paste the SQL shown below into the Supabase SQL editor (Dashboard -> SQL)."
  Write-Host "----- BEGIN SQL -----"
  Get-Content -Path $sqlPath
  Write-Host "-----  END SQL  -----"
  exit 0
}
