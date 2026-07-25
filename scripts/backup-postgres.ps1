param(
  [string]$OutputDirectory = ".\backups"
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
$target = Join-Path $project $OutputDirectory
New-Item -ItemType Directory -Force -Path $target | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $target "shenlun-$stamp.sql"

docker compose -f (Join-Path $project "docker-compose.production.yml") exec -T postgres `
  pg_dump -U shenlun -d shenlun | Set-Content -LiteralPath $file -Encoding utf8

Write-Host "备份已写入 $file"
