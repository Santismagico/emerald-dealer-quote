$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$environmentFile = Join-Path $projectRoot '.env.local'

if (-not (Test-Path -LiteralPath $environmentFile)) {
  throw 'Falta .env.local con la identidad del proyecto de pruebas.'
}

foreach ($line in Get-Content -LiteralPath $environmentFile -Encoding utf8) {
  $trimmed = $line.Trim()
  if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
  $parts = $trimmed.Split('=', 2)
  if ($parts.Count -ne 2 -or $parts[0] -notmatch '^[A-Z0-9_]+$') { continue }
  [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
}

$secureKey = Read-Host 'Pega la clave secreta del proyecto DE PRUEBAS (no se mostrara ni se guardara)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
$plainKey = $null

try {
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ([string]::IsNullOrWhiteSpace($plainKey) -or $plainKey.Length -lt 20) {
    throw 'La clave no tiene un formato valido.'
  }

  [Environment]::SetEnvironmentVariable('SUPABASE_SECRET_KEY', $plainKey, 'Process')
  Push-Location $projectRoot
  try {
    & npm.cmd run security:n6
    if ($LASTEXITCODE -ne 0) { throw "N6 se detuvo con codigo $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
} finally {
  [Environment]::SetEnvironmentVariable('SUPABASE_SECRET_KEY', $null, 'Process')
  $plainKey = $null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
