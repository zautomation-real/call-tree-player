$ErrorActionPreference = 'Stop'
$appUrl = 'http://127.0.0.1:4173/'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$serverScript = Join-Path $PSScriptRoot 'server.mjs'
$builtApp = Join-Path $PSScriptRoot 'dist\index.html'
$errorLog = Join-Path ([System.IO.Path]::GetTempPath()) "call-tree-player-$PID.err.log"

function Show-PlayerMessage([string]$message) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($message, 'Call Tree Player') | Out-Null
}

if (-not $nodeCommand) {
  Show-PlayerMessage ('Necesitas instalar Node.js 20 o posterior para iniciar la aplicaci{0}n.' -f [char]0xF3)
  exit 1
}

if (-not (Test-Path -LiteralPath $builtApp -PathType Leaf)) {
  Show-PlayerMessage (('Falta la versi{0}n compilada. Abre una terminal en esta carpeta y ejecuta:' -f [char]0xF3) + "`n`npnpm install`npnpm build")
  exit 1
}

$serverProcess = Start-Process -FilePath $nodeCommand.Source `
  -ArgumentList ('"{0}"' -f $serverScript) `
  -WorkingDirectory $PSScriptRoot `
  -WindowStyle Hidden `
  -RedirectStandardError $errorLog `
  -PassThru

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  try {
    Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
    Remove-Item -LiteralPath $errorLog -Force -ErrorAction SilentlyContinue
    Start-Process $appUrl
    exit 0
  } catch {
    if ($serverProcess.HasExited) { break }
    Start-Sleep -Milliseconds 250
  }
}

if (-not $serverProcess.HasExited) {
  Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
}

$detail = if (Test-Path -LiteralPath $errorLog) { (Get-Content -LiteralPath $errorLog -Raw).Trim() } else { '' }
Remove-Item -LiteralPath $errorLog -Force -ErrorAction SilentlyContinue
$message = 'No se pudo iniciar la aplicaci{0}n local.' -f [char]0xF3
if ($detail) { $message += "`n`nDetalle:`n$detail" }
Show-PlayerMessage $message
exit 1
