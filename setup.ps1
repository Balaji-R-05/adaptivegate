# One-command setup for the self-hosted stack. Needs only Docker - no
# Node/pnpm on your machine, since every step below runs inside a container.
# Because server/dashboard run as Docker services here (not `pnpm dev`), the
# addresses written into .env use Docker's internal service names (db, auth,
# gateway) instead of localhost. See docs/self-hosting.md for details.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$Compose = @('docker', 'compose', '-f', 'compose.selfhosted.yml')

if (-not (Test-Path .env)) {
  Write-Host "Creating .env from .env.example..."
  Copy-Item .env.example .env
}

function Get-EnvValue($name) {
  $line = Get-Content .env | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if ($null -eq $line) { return '' }
  return ($line -replace "^$name=", '')
}

function Set-EnvValue($name, $value) {
  $content = Get-Content .env
  if ($content -match "^$name=") {
    $content = $content -replace "^$name=.*", "$name=$value"
    Set-Content .env $content -Encoding utf8
  } else {
    Add-Content .env "$name=$value" -Encoding utf8
  }
}

function New-RandomHex($bytes) {
  docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes($bytes).toString('hex'))"
}

if ([string]::IsNullOrEmpty((Get-EnvValue 'JWT_SECRET'))) {
  Write-Host "Generating JWT_SECRET..."
  Set-EnvValue 'JWT_SECRET' (New-RandomHex 32)
}
if ([string]::IsNullOrEmpty((Get-EnvValue 'POSTGRES_PASSWORD'))) {
  Write-Host "Generating POSTGRES_PASSWORD..."
  Set-EnvValue 'POSTGRES_PASSWORD' (New-RandomHex 16)
}
if ([string]::IsNullOrEmpty((Get-EnvValue 'SITE_URL'))) {
  Set-EnvValue 'SITE_URL' 'http://localhost:5173'
}

$PostgresPassword = Get-EnvValue 'POSTGRES_PASSWORD'
$JwtSecret = Get-EnvValue 'JWT_SECRET'

# The server runs as a Docker container here, so it reaches the gateway by
# its container name (gateway:8000), not localhost.
Set-EnvValue 'SUPABASE_URL' 'http://gateway:8000'
Set-EnvValue 'DATABASE_URL' "postgresql://postgres:$PostgresPassword@db:5432/postgres"

$env:JWT_SECRET = $JwtSecret
$env:POSTGRES_PASSWORD = $PostgresPassword
$env:SITE_URL = Get-EnvValue 'SITE_URL'
$env:SUPABASE_URL = Get-EnvValue 'SUPABASE_URL'

Write-Host "Pulling images..."
& $Compose[0] $Compose[1..($Compose.Length - 1)] pull

Write-Host "Starting db, auth, gateway..."
& $Compose[0] $Compose[1..($Compose.Length - 1)] up -d db auth gateway

Write-Host "Waiting for db, auth, gateway to report healthy..."
function Wait-Healthy($service) {
  while ($true) {
    $id = (& $Compose[0] $Compose[1..($Compose.Length - 1)] ps -q $service)
    if ([string]::IsNullOrEmpty($id)) {
      Write-Host "`n$service failed to start. Logs:"
      & $Compose[0] $Compose[1..($Compose.Length - 1)] logs $service
      throw "$service container is not running - see logs above."
    }
    $status = docker inspect -f '{{.State.Health.Status}}' $id
    if ($status -eq 'healthy') { return }
    Start-Sleep -Seconds 2
  }
}
Wait-Healthy 'db'
Wait-Healthy 'auth'

$ProjectName = Split-Path -Leaf (Get-Location)
$Network = "${ProjectName}_default"

if ([string]::IsNullOrEmpty((Get-EnvValue 'SUPABASE_ANON_KEY'))) {
  Write-Host "Generating Supabase keys..."
  # Using "pnpm --filter ... exec" instead of "npx" - npx can't find tsx
  # from the image's root folder, only pnpm knows where it's installed.
  $KeysOutput = docker run --rm --network $Network ghcr.io/balaji-r-05/adaptivegate-server:latest `
    pnpm --filter @adaptivegate/server exec tsx scripts/generate-supabase-keys.ts -- $JwtSecret
  $AnonKey = ($KeysOutput | Where-Object { $_ -match '^SUPABASE_ANON_KEY=' }) -replace '^SUPABASE_ANON_KEY=', ''
  $ServiceRoleKey = ($KeysOutput | Where-Object { $_ -match '^SUPABASE_SERVICE_ROLE_KEY=' }) -replace '^SUPABASE_SERVICE_ROLE_KEY=', ''
  Set-EnvValue 'SUPABASE_ANON_KEY' $AnonKey
  Set-EnvValue 'SUPABASE_SERVICE_ROLE_KEY' $ServiceRoleKey
}

Write-Host "Applying database schema..."
docker run --rm --network $Network `
  -e "DATABASE_URL=postgresql://postgres:$PostgresPassword@db:5432/postgres" `
  ghcr.io/balaji-r-05/adaptivegate-server:latest `
  pnpm --filter @adaptivegate/db run db:migrate

Write-Host "Starting server and dashboard..."
& $Compose[0] $Compose[1..($Compose.Length - 1)] up -d server dashboard

Write-Host ""
Write-Host "Done. Open http://localhost:5173 and sign up with email/password."
Start-Process "http://localhost:5173"
