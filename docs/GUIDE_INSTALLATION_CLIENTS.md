# 🖥️ GUIDE D'INSTALLATION CLIENTS (Postes AutoCAD)

Ce guide détaille l'installation du plugin Pieuvre Auto sur chaque poste équipé d'AutoCAD.

---

## 📋 Prérequis

### Sur chaque poste client :

- **AutoCAD** : Version 2020 ou supérieure (AutoCAD, AutoCAD LT, BricsCAD)
- **.NET Framework** : Version 4.8 (généralement déjà installé avec Windows 10/11)
- **Accès réseau** : Connexion au serveur Pieuvre (http://IP_SERVEUR:3001)
- **Droits** : Administrateur pour l'installation initiale

---

## 🔧 COMPILATION DU PLUGIN (une seule fois)

**Note** : Cette étape est à faire UNE SEULE FOIS, sur un poste de développement, pour générer le fichier `PieuvreAutoCAD.dll`. Ce fichier sera ensuite distribué à tous les postes clients.

### Option A : Avec Visual Studio

1. Installer **Visual Studio 2022 Community** (gratuit) :
   ```
   https://visualstudio.microsoft.com/fr/downloads/
   ```

2. Ouvrir le projet :
   - Lancer Visual Studio
   - "Fichier" → "Ouvrir" → "Projet/Solution"
   - Sélectionner `PieuvrePlugin.csproj`

3. Ajuster les références AutoCAD :
   - Dans l'Explorateur de solutions, développer "Références"
   - Clic droit sur chaque référence AutoCAD (acdbmgd, acmgd, AcCui)
   - Propriétés → Modifier le chemin selon votre version d'AutoCAD
   - Exemple pour AutoCAD 2024 :
     ```
     C:\Program Files\Autodesk\AutoCAD 2024\acdbmgd.dll
     C:\Program Files\Autodesk\AutoCAD 2024\acmgd.dll
     C:\Program Files\Autodesk\AutoCAD 2024\AcCui.dll
     ```

4. Compiler :
   - Menu "Générer" → "Générer la solution"
   - Ou appuyer sur **Ctrl+Shift+B**

5. Récupérer le .dll compilé :
   ```
   pieuvre-autocad-plugin\bin\Release\PieuvreAutoCAD.dll
   ```

### Option B : Avec Visual Studio Code + .NET CLI

1. Installer .NET SDK 8 :
   ```
   https://dotnet.microsoft.com/download
   ```

2. Compiler :
   ```cmd
   cd pieuvre-autocad-plugin
   dotnet build -c Release
   ```

3. Le .dll se trouve dans :
   ```
   bin\Release\net48\PieuvreAutoCAD.dll
   ```

---

## 📦 INSTALLATION SUR CHAQUE POSTE CLIENT

### Étape 1 : Copier le plugin

1. Créer le répertoire du plugin :
   ```
   C:\Program Files\Autodesk\AutoCAD 2024\Plug-ins\PieuvreAuto\
   ```
   
   **Ajuster selon votre version d'AutoCAD !**

2. Copier les fichiers :
   ```
   PieuvreAutoCAD.dll         → dans le dossier Plug-ins\PieuvreAuto\
   Newtonsoft.Json.dll        → dans le même dossier
   ```

### Étape 2 : Créer le fichier de configuration

1. Créer le répertoire de configuration :
   ```cmd
   mkdir C:\PieuvreAutoCAD
   ```

2. Créer le fichier `C:\PieuvreAutoCAD\config.json` :
   ```json
   {
     "api_url": "http://192.168.1.50:3001",
     "default_user": "nom_utilisateur"
   }
   ```

   **Remplacer** :
   - `192.168.1.50` par l'IP réelle de votre serveur
   - `nom_utilisateur` par le nom de l'utilisateur du poste

### Étape 3 : Chargement dans AutoCAD

#### Option A : Chargement manuel (pour tester)

1. Lancer AutoCAD

2. Taper la commande :
   ```
   NETLOAD
   ```

3. Naviguer vers :
   ```
   C:\Program Files\Autodesk\AutoCAD 2024\Plug-ins\PieuvreAuto\PieuvreAutoCAD.dll
   ```

4. Sélectionner et valider

5. Vous devriez voir :
   ```
   ╔════════════════════════════════════════════╗
   ║  Pieuvre Auto v1.0.0                       ║
   ║  Plugin chargé avec succès                 ║
   ║  Commandes disponibles :                   ║
   ║  - PIEUVRE       : Interface principale    ║
   ║  - PIEUVRESTOCK  : Consulter le stock      ║
   ║  - PIEUVRECALC   : Calcul rapide           ║
   ╚════════════════════════════════════════════╝
   ```

6. Tester :
   ```
   PIEUVRESTOCK
   ```

#### Option B : Chargement automatique (recommandé)

Pour que le plugin se charge automatiquement au démarrage d'AutoCAD :

1. Créer un fichier `acad.lsp` dans :
   ```
   C:\Program Files\Autodesk\AutoCAD 2024\Support\acad.lsp
   ```

2. Contenu :
   ```lisp
   (command "NETLOAD" "C:\\Program Files\\Autodesk\\AutoCAD 2024\\Plug-ins\\PieuvreAuto\\PieuvreAutoCAD.dll")
   (princ "\nPieuvre Auto chargé automatiquement.\n")
   (princ)
   ```

3. Redémarrer AutoCAD

**Alternative : Utiliser APPLOAD**

1. Taper `APPLOAD`
2. Naviguer vers le .dll
3. Cliquer sur "Charger"
4. Cliquer sur "Contenu" → "Éléments de démarrage"
5. Ajouter le .dll à la liste
6. Valider

---

## ✅ VÉRIFICATION DE L'INSTALLATION

### Test 1 : Commandes disponibles

Dans AutoCAD, taper :
```
PIEUVREINFO
```

Résultat attendu :
```
╔════════════════════════════════════════════╗
║  Pieuvre Auto v1.0.0                       ║
╠════════════════════════════════════════════╣
║  API URL : http://192.168.1.50:3001        ║
║  Utilisateur : votre_nom                   ║
...
```

### Test 2 : Connexion API

Taper :
```
PIEUVRESTOCK
```

Si ça fonctionne, vous devriez voir le stock en temps réel.

Si erreur de connexion :
```
❌ Impossible de se connecter à l'API Pieuvre.

URL configurée : http://192.168.1.50:3001

Vérifiez que :
1. Le serveur est démarré
2. L'URL dans config.json est correcte
3. Votre réseau fonctionne
```

### Test 3 : Interface complète

Taper :
```
PIEUVRE
```

L'interface graphique devrait s'ouvrir avec :
- Liste des clients
- Stock en temps réel
- Options de calcul

---

## 🔄 MISE À JOUR DU PLUGIN

Quand une nouvelle version du plugin est disponible :

1. Fermer AutoCAD sur tous les postes

2. Remplacer `PieuvreAutoCAD.dll` par la nouvelle version

3. Redémarrer AutoCAD

4. Vérifier la version avec `PIEUVREINFO`

---

## 🐛 DÉPANNAGE

### Le plugin ne se charge pas

**Erreur : "Impossible de charger l'assembly"**

Causes possibles :
1. .NET Framework 4.8 pas installé
   ```cmd
   # Vérifier
   reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release
   ```
   Si pas installé :
   ```
   https://dotnet.microsoft.com/download/dotnet-framework/net48
   ```

2. Fichiers bloqués par Windows
   - Clic droit sur `PieuvreAutoCAD.dll`
   - Propriétés → Débloquer

3. Chemin incorrect
   - Vérifier que le chemin du .dll est correct dans NETLOAD

### "Impossible de se connecter à l'API"

1. Tester la connexion réseau :
   ```cmd
   ping 192.168.1.50
   ```

2. Tester l'API depuis un navigateur :
   ```
   http://192.168.1.50:3001/health
   ```

3. Vérifier le fichier `config.json` :
   - Chemin : `C:\PieuvreAutoCAD\config.json`
   - Format JSON valide
   - URL correcte

4. Vérifier le pare-feu :
   - Autoriser AutoCAD dans le pare-feu Windows
   - Autoriser les connexions sortantes sur le port 3001

### Le stock ne s'affiche pas

1. Vérifier que le serveur est démarré

2. Vérifier les données en base :
   ```sql
   psql -U postgres -d pieuvre_db -c "SELECT COUNT(*) FROM stock_couleurs;"
   ```

3. Consulter les logs du serveur

### Interface graphique ne s'ouvre pas

1. Vérifier les erreurs dans la console AutoCAD

2. S'assurer que les DLL Windows Forms sont présentes

3. Redémarrer AutoCAD en mode admin

---

## 📝 DÉSINSTALLATION

Pour désinstaller le plugin :

1. Supprimer le répertoire :
   ```
   C:\Program Files\Autodesk\AutoCAD 2024\Plug-ins\PieuvreAuto\
   ```

2. Supprimer la configuration :
   ```
   C:\PieuvreAutoCAD\
   ```

3. Si chargement auto configuré, retirer du fichier `acad.lsp`

---

## 🎯 DÉPLOIEMENT MASSIF

Pour déployer sur plusieurs postes :

### Option 1 : Script PowerShell

Créer `install-pieuvre.ps1` :

```powershell
# Configuration
$pluginSource = "\\serveur\share\PieuvreAuto"
$autocadVersion = "2024"
$serverUrl = "http://192.168.1.50:3001"

# Copier le plugin
$pluginDest = "C:\Program Files\Autodesk\AutoCAD $autocadVersion\Plug-ins\PieuvreAuto"
New-Item -ItemType Directory -Force -Path $pluginDest
Copy-Item "$pluginSource\*.dll" -Destination $pluginDest

# Créer la config
$configDir = "C:\PieuvreAutoCAD"
New-Item -ItemType Directory -Force -Path $configDir

$config = @{
    api_url = $serverUrl
    default_user = $env:USERNAME
} | ConvertTo-Json

Set-Content -Path "$configDir\config.json" -Value $config

Write-Host "Installation terminée !" -ForegroundColor Green
```

Exécuter sur chaque poste :
```powershell
powershell -ExecutionPolicy Bypass -File install-pieuvre.ps1
```

### Option 2 : GPO (Active Directory)

1. Créer un partage réseau avec les fichiers du plugin

2. Créer un script de démarrage qui :
   - Copie les DLL
   - Crée la config
   - Configure le chargement auto

3. Déployer via GPO sur l'OU contenant les postes AutoCAD

---

## 📞 SUPPORT

En cas de problème :

1. Vérifier les logs AutoCAD
2. Consulter `C:\PieuvreAutoCAD\` pour les configs
3. Tester la connexion réseau au serveur
4. Contacter l'administrateur système

---

## 🎉 FÉLICITATIONS !

Le plugin Pieuvre Auto est maintenant installé et opérationnel !

Consultez le **MANUEL_UTILISATEUR.md** pour apprendre à l'utiliser au quotidien.
