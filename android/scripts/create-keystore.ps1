<#
.SYNOPSIS
    One-time bootstrap of the Android signing key for a Bubblewrap app.

.DESCRIPTION
    Creates the keystore, prints the certificate SHA-256 fingerprint, writes the
    matching .well-known/assetlinks.json, and prints the `gh secret set` commands
    the "Android APK (TWA)" workflow needs.

    Run this ONCE per app and keep the keystore forever: Android refuses to
    update an installed app that was signed with a different key.

.EXAMPLE
    ./android/scripts/create-keystore.ps1 -AppId tms
#>
[CmdletBinding()]
param(
    # App id as listed in android/apps.json
    [string]$AppId = 'tms',
    # Where the keystore and generated secrets are written (git-ignored)
    [string]$OutDir = (Join-Path $PSScriptRoot '..\..\.keys')
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$appsFile = Join-Path $repoRoot 'android\apps.json'
$app = (Get-Content $appsFile -Raw | ConvertFrom-Json) | Where-Object { $_.id -eq $AppId }
if (-not $app) {
    throw "No app with id '$AppId' in android/apps.json"
}

$twaManifest = Get-Content (Join-Path $repoRoot "$($app.dir)\twa-manifest.json") -Raw | ConvertFrom-Json
$alias = $twaManifest.signingKey.alias

# keytool ships with the JDK
$keytool = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\keytool.exe")) {
    "$env:JAVA_HOME\bin\keytool.exe"
} elseif (Get-Command keytool -ErrorAction SilentlyContinue) {
    (Get-Command keytool).Source
} else {
    throw 'keytool not found. Install a JDK 17 (e.g. winget install EclipseAdoptium.Temurin.17.JDK) or set JAVA_HOME.'
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$keystore = Join-Path $OutDir "$AppId.keystore"
if (Test-Path $keystore) {
    throw "$keystore already exists. Delete it only if you are certain no released build was signed with it."
}

# 32 hex chars of entropy, used for both the store and the key password
$bytes = [byte[]]::new(16)
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = -join ($bytes | ForEach-Object { $_.ToString('x2') })

Write-Host "Creating keystore for $($app.packageId) (alias: $alias)" -ForegroundColor Cyan
& $keytool -genkeypair -keystore $keystore -alias $alias `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $password -keypass $password `
    -dname "CN=$($app.displayName), O=TDF Jewellery, C=IN"
if ($LASTEXITCODE -ne 0) { throw 'keytool -genkeypair failed' }

$certInfo = & $keytool -list -v -keystore $keystore -alias $alias -storepass $password
$fingerprint = ($certInfo | Select-String 'SHA256:' | Select-Object -First 1) -replace '.*SHA256:\s*', ''

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore))
$base64File = Join-Path $OutDir "$AppId.keystore.base64"
# WriteAllText writes UTF-8 without a BOM; Set-Content -Encoding utf8 would add
# one on PowerShell 5.1 and the secret would then fail to base64-decode in CI.
[IO.File]::WriteAllText($base64File, $base64)

$assetlinks = @(
    @{
        relation = @('delegate_permission/common.handle_all_urls')
        target   = @{
            namespace                = 'android_app'
            package_name             = $app.packageId
            sha256_cert_fingerprints = @($fingerprint)
        }
    }
)
$assetlinksFile = Join-Path $OutDir "$AppId-assetlinks.json"
# -InputObject, not the pipeline: piping a single-element array unwraps it on
# PowerShell 5.1 and assetlinks.json must be a JSON array.
[IO.File]::WriteAllText($assetlinksFile, (ConvertTo-Json -InputObject $assetlinks -Depth 5))

$host_ = ([Uri]$app.manifestUrl).Host

Write-Host ''
Write-Host 'Keystore created.' -ForegroundColor Green
Write-Host "  keystore    : $keystore"
Write-Host "  password    : $password"
Write-Host "  base64      : $base64File"
Write-Host "  assetlinks  : $assetlinksFile"
Write-Host "  SHA-256     : $fingerprint"
Write-Host ''
Write-Host '1) Back up the keystore + password somewhere permanent (password manager).' -ForegroundColor Yellow
Write-Host '   Losing them means you can never ship an update to installed apps.' -ForegroundColor Yellow
Write-Host ''
Write-Host '2) Add the repository secrets:' -ForegroundColor Yellow
Write-Host "   gh secret set $($app.keystoreSecret) < `"$base64File`""
Write-Host "   gh secret set $($app.keystorePasswordSecret) --body `"$password`""
Write-Host "   gh secret set $($app.keyPasswordSecret) --body `"$password`""
Write-Host ''
Write-Host "3) Serve the assetlinks file at https://$host_/.well-known/assetlinks.json" -ForegroundColor Yellow
Write-Host "   (Next.js: copy it to public/.well-known/assetlinks.json and redeploy)." -ForegroundColor Yellow
Write-Host '   Without it the app still works, but Chrome shows a URL bar at the top.' -ForegroundColor Yellow
