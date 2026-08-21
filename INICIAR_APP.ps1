$ErrorActionPreference = 'Stop'
$appUrl = 'http://127.0.0.1:4173/'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCommand) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show('Necesitas instalar Node.js 20 o posterior para iniciar la aplicación.', 'Call Tree Player') | Out-Null
  exit 1
}

Start-Process -FilePath $nodeCommand.Source `
  -ArgumentList (Join-Path $PSScriptRoot 'server.mjs') `
  -WorkingDirectory $PSScriptRoot `
  -WindowStyle Hidden

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  try {
    Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
    Start-Process $appUrl
    exit 0
  } catch {
    Start-Sleep -Milliseconds 250
  }
}

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show('No se pudo iniciar la aplicación local.', 'Call Tree Player') | Out-Null
exit 1
