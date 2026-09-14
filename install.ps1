param(
  [string]$InstallPath = "$HOME\theta-workplace"
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 18 veya daha yeni bir sürüm gerekli: https://nodejs.org'
}

New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
Copy-Item -Path "$PSScriptRoot\*" -Destination $InstallPath -Recurse -Force -Exclude 'node_modules','data'
Set-Location $InstallPath
New-Item -ItemType Directory -Force -Path "$InstallPath\data" | Out-Null
Write-Host "theta-workplace kuruldu: $InstallPath"
Write-Host "Başlatmak için: npm start"
Write-Host "Tailscale modu için: npm run start:tailscale"
