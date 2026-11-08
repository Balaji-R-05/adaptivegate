# Updates an existing self-hosted install to the latest release - pulls the
# newest images (compose.selfhosted.yml always points at `:latest`),
# applies any new database migrations, then restarts with the new images.
# Safe to re-run anytime; it never touches .env or regenerates secrets.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$Compose = @('docker', 'compose', '-f', 'compose.selfhosted.yml')

if (-not (Test-Path .env)) {
  throw ".env not found - run .\setup.ps1 first."
}

function Get-EnvValue($name) {
  $line = Get-Content .env | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if ($null -eq $line) { return '' }
  return ($line -replace "^$name=", '')
}

Write-Host "Pulling latest images..."
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
$PostgresPassword = Get-EnvValue 'POSTGRES_PASSWORD'

Write-Host "Applying any new database schema changes..."
docker run --rm --network $Network `
  -e "DATABASE_URL=postgresql://postgres:$PostgresPassword@db:5432/postgres" `
  ghcr.io/balaji-r-05/adaptivegate-server:latest `
  pnpm --filter @adaptivegate/db run db:migrate

Write-Host "Starting server and dashboard with the new images..."
& $Compose[0] $Compose[1..($Compose.Length - 1)] up -d server dashboard

Write-Host ""
Write-Host "Updated to the latest release."
