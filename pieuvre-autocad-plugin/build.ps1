# ============================================================
# Pieuvre Auto — Script de build multi-versions AutoCAD
# Usage:
#   .\build.ps1                    → détection auto, demande si plusieurs versions
#   .\build.ps1 -Version 2023      → force AutoCAD 2023
#   .\build.ps1 -Version all       → compile pour toutes les versions installées
#   .\build.ps1 -Config Debug      → build Debug (Release par défaut)
# ============================================================

param(
    [string]$Version = "auto",
    [string]$Config  = "Release"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ============================================================
# 1. Chemins AutoCAD supportés
# ============================================================
$SupportedVersions = [ordered]@{
    "2023" = "C:\Program Files\Autodesk\AutoCAD 2023"
    "2024" = "C:\Program Files\Autodesk\AutoCAD 2024"
    "2025" = "C:\Program Files\Autodesk\AutoCAD 2025"
}

# ============================================================
# 2. Détecter les versions installées
# ============================================================
$Installed = [ordered]@{}
foreach ($ver in $SupportedVersions.Keys) {
    $dllPath = Join-Path $SupportedVersions[$ver] "acdbmgd.dll"
    if (Test-Path $dllPath) {
        $Installed[$ver] = $SupportedVersions[$ver]
    }
}

if ($Installed.Count -eq 0) {
    Write-Host ""
    Write-Host "ERREUR : Aucune version d'AutoCAD 2023/2024/2025 detectee." -ForegroundColor Red
    Write-Host "Chemins verifies :"
    foreach ($ver in $SupportedVersions.Keys) {
        Write-Host "  $($SupportedVersions[$ver])\acdbmgd.dll"
    }
    Write-Host ""
    Write-Host "Si AutoCAD est installe dans un autre dossier, utilisez :"
    Write-Host '  .\build.ps1 -Version 2024 (puis entrez le chemin manuellement)'
    exit 1
}

Write-Host ""
Write-Host "=== Pieuvre Auto — Build ===" -ForegroundColor Cyan
Write-Host "Versions AutoCAD detectees :" -ForegroundColor Green
foreach ($ver in $Installed.Keys) {
    Write-Host "  [AutoCAD $ver]  $($Installed[$ver])"
}
Write-Host ""

# ============================================================
# 3. Résoudre la version cible
# ============================================================
$BuildTargets = [ordered]@{}

if ($Version -eq "all") {
    $BuildTargets = $Installed
}
elseif ($Version -eq "auto") {
    if ($Installed.Count -eq 1) {
        $v = @($Installed.Keys)[0]
        $BuildTargets[$v] = $Installed[$v]
        Write-Host "Version unique detectee — compilation pour AutoCAD $v." -ForegroundColor Cyan
    }
    else {
        Write-Host "Plusieurs versions installees. Choisissez :" -ForegroundColor Yellow
        foreach ($v in $Installed.Keys) {
            Write-Host "  $v"
        }
        Write-Host "  all  (compiler pour toutes)"
        Write-Host ""
        $choice = Read-Host "Version cible"
        if ($choice -eq "all") {
            $BuildTargets = $Installed
        }
        elseif ($Installed.ContainsKey($choice)) {
            $BuildTargets[$choice] = $Installed[$choice]
        }
        else {
            Write-Host "ERREUR : Version '$choice' non reconnue." -ForegroundColor Red
            exit 1
        }
    }
}
else {
    # Version explicitement demandée
    if (-not $SupportedVersions.ContainsKey($Version)) {
        Write-Host "ERREUR : Version '$Version' non supportee. Valeurs valides : 2023, 2024, 2025, all." -ForegroundColor Red
        exit 1
    }
    if (-not $Installed.ContainsKey($Version)) {
        Write-Host "ERREUR : AutoCAD $Version non trouve a : $($SupportedVersions[$Version])" -ForegroundColor Red
        Write-Host ""
        Write-Host "Si AutoCAD est ailleurs, definissez la variable d'environnement :"
        Write-Host "  [System.Environment]::SetEnvironmentVariable('AUTOCAD_PATH', 'C:\votre\chemin', 'User')"
        exit 1
    }
    $BuildTargets[$Version] = $Installed[$Version]
}

# ============================================================
# 4. Trouver MSBuild
# ============================================================
function Find-MSBuild {
    # Essayer vswhere (le plus fiable)
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vswhere) {
        $vsPath = & $vswhere -latest -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" 2>$null | Select-Object -First 1
        if ($vsPath -and (Test-Path $vsPath)) { return $vsPath }
    }

    # Chemins courants Visual Studio 2022 / 2019 / Build Tools
    $candidates = @(
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }

    # Essayer msbuild dans le PATH
    $inPath = Get-Command msbuild -ErrorAction SilentlyContinue
    if ($inPath) { return $inPath.Source }

    return $null
}

$MSBuild = Find-MSBuild
if (-not $MSBuild) {
    Write-Host "ERREUR : MSBuild introuvable." -ForegroundColor Red
    Write-Host "Installez 'Visual Studio Build Tools' depuis :"
    Write-Host "  https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022"
    exit 1
}
Write-Host "MSBuild : $MSBuild" -ForegroundColor DarkGray

# ============================================================
# 5. Compiler pour chaque version cible
# ============================================================
$script:Successes = @()
$script:Failures  = @()

function Invoke-Build {
    param([string]$Ver, [string]$AcadPath)

    $outDir = ".\bin\$Config\AutoCAD$Ver\"
    Write-Host ""
    Write-Host "--- Compilation pour AutoCAD $Ver ---" -ForegroundColor Cyan
    Write-Host "    Chemin : $AcadPath"
    Write-Host "    Sortie : $outDir"
    Write-Host ""

    & $MSBuild "PieuvrePlugin.csproj" `
        /p:Configuration=$Config `
        /p:AutoCADPath="$AcadPath" `
        /p:OutDir="$outDir" `
        /v:minimal `
        /nologo

    if ($LASTEXITCODE -eq 0) {
        $dllPath = Join-Path $outDir "PieuvreAutoCAD.dll"
        Write-Host ""
        Write-Host "OK  AutoCAD $Ver → $dllPath" -ForegroundColor Green
        $script:Successes += "AutoCAD $Ver"
    }
    else {
        Write-Host ""
        Write-Host "ECHEC  AutoCAD $Ver" -ForegroundColor Red
        $script:Failures += "AutoCAD $Ver"
    }
}

foreach ($ver in $BuildTargets.Keys) {
    Invoke-Build -Ver $ver -AcadPath $BuildTargets[$ver]
}

# ============================================================
# 6. Résumé
# ============================================================
Write-Host ""
Write-Host "=== Résumé ===" -ForegroundColor Cyan
if ($script:Successes.Count -gt 0) {
    Write-Host "Succes :" -ForegroundColor Green
    foreach ($s in $script:Successes) { Write-Host "  $s → bin\$Config\$($s -replace ' ','')\PieuvreAutoCAD.dll" }
}
if ($script:Failures.Count -gt 0) {
    Write-Host "Echecs :" -ForegroundColor Red
    foreach ($f in $script:Failures) { Write-Host "  $f" }
}
Write-Host ""

if ($script:Failures.Count -gt 0) { exit 1 }
