param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
$resolved = Resolve-Path -LiteralPath $BackupFile

Get-Content -LiteralPath $resolved -Raw | docker compose `
  -f (Join-Path $project "docker-compose.production.yml") exec -T postgres `
  psql -U shenlun -d shenlun

Write-Host "恢复完成"
