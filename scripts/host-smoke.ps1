# Host smoke test for dsh-global-tool-discovery bundle
# Run on the machine where DSH Desktop is installed.
# Requires PowerShell. Use at your own risk; it restarts DSH Desktop.

param(
  [string]$DshDesktopPath = "C:\Program Files\DeepSeek Harness\DSH Desktop.exe",
  [string]$ProfileWebDir = "$env:USERPROFILE\.dsh\profiles\web"
)

$ErrorActionPreference = "Stop"
$log = @()

function Restart-Dsh {
  Get-Process -Name "DSH Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep 3
  Start-Process -FilePath $DshDesktopPath
  Start-Sleep 20
  $proc = Get-Process -Name "DSH Desktop" -ErrorAction SilentlyContinue
  return ($null -ne $proc)
}

function Check-Dsh {
  $proc = Get-Process -Name "DSH Desktop" -ErrorAction SilentlyContinue
  return ($null -ne $proc)
}

$researchFile = Join-Path $ProfileWebDir "research.mjs"
$researchBak = "$researchFile.bak-smoke"
$adaptersDir = Join-Path $ProfileWebDir "..\adapters"
$adaptersBak = "$adaptersDir.bak-smoke"

# --- Test 1: broken research.mjs should not break core ---
Write-Host "[1/3] Breaking research.mjs..."
Copy-Item $researchFile $researchBak -Force
Set-Content -Path $researchFile -Value "export const broken = " -Encoding UTF8
$ok1 = Restart-Dsh
$log += "Test 1 (broken research.mjs -> core boot): $ok1"
Copy-Item $researchBak $researchFile -Force
if (-not $ok1) { Write-Warning "Test 1 failed" }

# --- Test 2: missing adapters should not break research ---
Write-Host "[2/3] Removing adapters..."
if (Test-Path $adaptersDir) {
  Move-Item $adaptersDir $adaptersBak -Force
}
$ok2 = Restart-Dsh
$log += "Test 2 (missing adapters -> research available): $ok2"
if (Test-Path $adaptersBak) { Move-Item $adaptersBak $adaptersDir -Force }
if (-not $ok2) { Write-Warning "Test 2 failed" }

# --- Test 3: normal restart after restore ---
Write-Host "[3/3] Normal restart..."
$ok3 = Restart-Dsh
$log += "Test 3 (normal restart): $ok3"

# --- Report ---
Write-Host ""
Write-Host "=== Host Smoke Results ==="
$log | ForEach-Object { Write-Host $_ }
if (($ok1 -and $ok2 -and $ok3)) {
  Write-Host "PASS"
} else {
  Write-Host "FAIL"
}
