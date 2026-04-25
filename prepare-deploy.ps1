# ============================================================
# Pieuvre Auto — Préparation du dossier de déploiement (clé USB)
#
# Lancer depuis la racine du projet sur une machine Windows
# avec AutoCAD 2023, 2024 ou 2025 installé.
#
# Usage :
#   .\prepare-deploy.ps1                   → détection automatique
#   .\prepare-deploy.ps1 -AcadVersion 2024 → forcer une version
#   .\prepare-deploy.ps1 -OutputDir D:\cle → sortie directement sur la clé
# ============================================================

param(
    [string]$AcadVersion = "auto",
    [string]$OutputDir   = ".\dist"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ============================================================
# 1. Compilation du plugin AutoCAD
# ============================================================
Write-Host ""
Write-Host "=== Étape 1/3 : Compilation du plugin AutoCAD ===" -ForegroundColor Cyan

Push-Location pieuvre-autocad-plugin
try {
    & .\build.ps1 -Version $AcadVersion -Config Release
    if ($LASTEXITCODE -ne 0) { throw "build.ps1 a échoué." }
}
finally {
    Pop-Location
}

# Trouver le DLL le plus récent produit
$dlls = Get-ChildItem "pieuvre-autocad-plugin\bin\Release\AutoCAD*\PieuvreAutoCAD.dll" `
        -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
if (-not $dlls) {
    Write-Host "ERREUR : PieuvreAutoCAD.dll introuvable après compilation." -ForegroundColor Red
    exit 1
}
$dllPath = $dlls[0].FullName
Write-Host "DLL compilé : $dllPath" -ForegroundColor Green

# Trouver Newtonsoft.Json.dll (restauré par NuGet)
$newtonsoftSearch = Get-ChildItem "pieuvre-autocad-plugin\packages\Newtonsoft.Json*\lib\*\Newtonsoft.Json.dll" `
                    -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $newtonsoftSearch) {
    Write-Host "ATTENTION : Newtonsoft.Json.dll introuvable. Copiez-le manuellement dans dist\plugin-autocad\" -ForegroundColor Yellow
}

# ============================================================
# 2. Assemblage du dossier dist/
# ============================================================
Write-Host ""
Write-Host "=== Étape 2/3 : Assemblage du dossier de déploiement ===" -ForegroundColor Cyan

if (Test-Path $OutputDir) {
    Remove-Item $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null
$absOut = (Resolve-Path $OutputDir).Path

# ----------------------------------------------------------
# 2a. Application web (Docker)
# ----------------------------------------------------------
$webDest = Join-Path $absOut "web"
New-Item -ItemType Directory -Path $webDest | Out-Null

$webItems = @(
    "docker-compose.yml",
    "Dockerfile.api",
    "Dockerfile.frontend",
    "nginx.conf",
    "start.sh",
    "stop.sh",
    "pieuvre-api",
    "pieuvre-frontend",
    "pieuvre-database"
)
foreach ($item in $webItems) {
    if (Test-Path $item) {
        Copy-Item $item (Join-Path $webDest (Split-Path $item -Leaf)) -Recurse -Force -Exclude @("node_modules", ".env", ".env.*")
    }
}

# Supprimer les node_modules éventuellement copiés
Get-ChildItem $webDest -Recurse -Directory -Filter "node_modules" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# start.bat / stop.bat pour Windows
@'
@echo off
echo Démarrage de Pieuvre Auto...
docker compose up -d --build
if %errorlevel% equ 0 (
    echo.
    echo  OK - Interface web : http://localhost
    echo  OK - API           : http://localhost:3001/health
    echo.
    echo Appuyez sur une touche pour fermer cette fenetre.
) else (
    echo.
    echo  ERREUR - Verifiez que Docker Desktop est bien demarré.
    echo.
)
pause > nul
'@ | Set-Content (Join-Path $webDest "start.bat") -Encoding UTF8

@'
@echo off
echo Arrêt de Pieuvre Auto...
docker compose down
echo Arrêté.
pause > nul
'@ | Set-Content (Join-Path $webDest "stop.bat") -Encoding UTF8

# ----------------------------------------------------------
# 2b. Plugin AutoCAD
# ----------------------------------------------------------
$pluginDest = Join-Path $absOut "plugin-autocad"
New-Item -ItemType Directory -Path $pluginDest | Out-Null

Copy-Item $dllPath $pluginDest
if ($newtonsoftSearch) {
    Copy-Item $newtonsoftSearch.FullName $pluginDest
}

# config.json par défaut
@'
{
  "api_url": "http://localhost:3001",
  "default_user": "MonPrenom"
}
'@ | Set-Content (Join-Path $pluginDest "config.json") -Encoding UTF8

# Installeur (double-clic sur le poste cible)
@"
@echo off
echo.
echo =====================================================
echo   Pieuvre Auto - Installation plugin AutoCAD
echo =====================================================
echo.

set DEST=C:\PieuvreAutoCAD

if not exist "%DEST%" (
    echo Creation du dossier %DEST%...
    mkdir "%DEST%"
)

echo Copie des fichiers...
copy /Y "%~dp0PieuvreAutoCAD.dll"  "%DEST%\" > nul
copy /Y "%~dp0Newtonsoft.Json.dll" "%DEST%\" > nul

if not exist "%DEST%\config.json" (
    copy /Y "%~dp0config.json" "%DEST%\" > nul
    echo.
    echo  IMPORTANT : Editez le fichier de configuration :
    echo    %DEST%\config.json
    echo.
    echo    - api_url     : adresse du serveur Pieuvre
    echo      (ex: http://192.168.1.50:3001 si serveur sur autre machine)
    echo    - default_user : votre prenom
)

echo.
echo =====================================================
echo   Installation terminee !
echo =====================================================
echo.
echo   Dans AutoCAD :
echo   1. Tapez la commande : NETLOAD
echo   2. Selectionnez     : %DEST%\PieuvreAutoCAD.dll
echo.
echo   Pour charger automatiquement a chaque demarrage :
echo   Options -> Fichiers -> Applications chargees automatiquement
echo   -> Ajouter : %DEST%\PieuvreAutoCAD.dll
echo.
pause
"@ | Set-Content (Join-Path $pluginDest "INSTALLER-PLUGIN.bat") -Encoding UTF8

# ----------------------------------------------------------
# 2c. LISEZ-MOI à la racine du dist
# ----------------------------------------------------------
@"
╔══════════════════════════════════════════════════════════╗
║              PIEUVRE AUTO — Clé USB                      ║
╚══════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────┐
│  DOSSIER  web/                                          │
│  Application web (interface + calculs + stock)          │
├─────────────────────────────────────────────────────────┤
│  Prérequis : Docker Desktop installé et démarré         │
│  Téléchargement : https://www.docker.com/products/      │
│                   docker-desktop/                       │
│                                                         │
│  Windows  → double-cliquer  start.bat                  │
│  Mac/Linux → terminal       ./start.sh                 │
│                                                         │
│  Interface web → http://localhost                       │
│  API           → http://localhost:3001/health           │
│                                                         │
│  Pour arrêter → stop.bat  ou  ./stop.sh                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  DOSSIER  plugin-autocad/                               │
│  Plugin à installer dans AutoCAD                        │
├─────────────────────────────────────────────────────────┤
│  Prérequis : AutoCAD 2023, 2024 ou 2025                 │
│                                                         │
│  1. Double-cliquer  INSTALLER-PLUGIN.bat                │
│  2. Ouvrir AutoCAD                                      │
│  3. Taper la commande : NETLOAD                         │
│  4. Sélectionner : C:\PieuvreAutoCAD\PieuvreAutoCAD.dll │
│                                                         │
│  Commandes disponibles dans AutoCAD :                   │
│    PIEUVRE       → Interface principale                 │
│    PIEUVRESTOCK  → Consulter le stock                   │
│    PIEUVRECALC   → Calcul rapide                        │
│    PIEUVREINFO   → Version et configuration             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  CONFIGURATION (si le serveur est sur une autre machine)│
├─────────────────────────────────────────────────────────┤
│  Éditer : C:\PieuvreAutoCAD\config.json                 │
│  {                                                      │
│    "api_url": "http://192.168.1.50:3001",               │
│    "default_user": "Votre Prénom"                       │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
"@ | Set-Content (Join-Path $absOut "LISEZ-MOI.txt") -Encoding UTF8

# ============================================================
# 3. Résumé
# ============================================================
Write-Host ""
Write-Host "=== Étape 3/3 : Résumé ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dossier prêt : $absOut" -ForegroundColor Green
Write-Host ""

function Show-Tree {
    param([string]$Path, [int]$Depth = 0)
    Get-ChildItem $Path | ForEach-Object {
        $indent = "  " * $Depth
        if ($_.PSIsContainer) {
            Write-Host "$indent$($_.Name)/" -ForegroundColor Yellow
            if ($Depth -lt 2) { Show-Tree $_.FullName ($Depth + 1) }
        } else {
            $size = if ($_.Length -gt 1MB) { "{0:N1} MB" -f ($_.Length / 1MB) }
                    elseif ($_.Length -gt 1KB) { "{0:N0} KB" -f ($_.Length / 1KB) }
                    else { "$($_.Length) B" }
            Write-Host "$indent$($_.Name)  ($size)"
        }
    }
}
Show-Tree $absOut

Write-Host ""
Write-Host "Copiez le dossier 'dist\' sur votre clé USB." -ForegroundColor Yellow
Write-Host "Sur chaque poste cible :"
Write-Host "  - Application web    → web\start.bat  (nécessite Docker)"
Write-Host "  - Plugin AutoCAD     → plugin-autocad\INSTALLER-PLUGIN.bat"
Write-Host ""
