$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project

if (-not (Test-Path -LiteralPath "node_modules")) {
  npm install
}

$env:WRANGLER_LOG_PATH = ".wrangler/logs"
npm run dev
