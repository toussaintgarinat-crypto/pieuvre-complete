# Pieuvre Auto

Système de gestion des pieuvres électriques pour installateurs.  
Calcul automatique des bons de coupe (fils + gaines), gestion du stock, suivi des chantiers et génération d'étiquettes — le tout intégré directement dans AutoCAD.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  AutoCAD (Windows)                                          │
│  Plugin C# → commandes PIEUVRE / PIEUVRESTOCK / PIEUVRECALC │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP :3001
┌───────────────────────▼─────────────────────────────────────┐
│  Docker (même machine ou serveur local)                     │
│                                                             │
│  ┌──────────────────┐    ┌─────────────────────────────┐   │
│  │  nginx  :80      │    │  API Node.js  :3001          │   │
│  │  Frontend React  │◄──►│  Express + PostgreSQL        │   │
│  └──────────────────┘    └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

| Composant | Technologie | Port |
|---|---|---|
| Interface web | React + Vite (servi par nginx) | 80 |
| API backend | Node.js / Express | 3001 |
| Service OCR | Node.js | 3002 |
| Base de données | PostgreSQL 16 + pgvector | interne Docker |
| Plugin AutoCAD | C# .NET Framework 4.8 | — |

---

## Prérequis

- **Docker Desktop** (Mac, Windows ou Linux) → https://www.docker.com/products/docker-desktop/
- Pour compiler le plugin AutoCAD : Windows + Visual Studio (ou Build Tools) + AutoCAD **2023, 2024 ou 2025**

---

## Démarrage rapide

### 1. Cloner ou copier le projet

```bash
git clone <url-du-repo> pieuvre-complete
cd pieuvre-complete
```

### 2. Configurer l'environnement (optionnel mais recommandé)

Pour tester sans clé API (mode mock OCR + RAG) :

```bash
cp .env.docker.example .env.docker
```

Le fichier `.env.docker` est ignoré par Git. Par défaut, l'exemple active `VISION_MOCK_MODE=true` et `RAG_MOCK_MODE=true`.

Pour utiliser de vraies clés API (OpenAI ou OpenRouter), modifiez `.env.docker` avant le démarrage.

### 3. Démarrer le serveur

**Mac / Linux :**
```bash
chmod +x start.sh
./start.sh
```

**Windows (PowerShell ou CMD) :**
```cmd
docker compose up -d --build
```

### 4. Accéder à l'application

- **Interface web** → http://localhost
- **API** → http://localhost:3001/health

### 5. Arrêter

```bash
./stop.sh
# ou
docker compose down
```

### Mise à jour d'une base existante

Si vous partez d'une base existante, appliquez les migrations dans l'ordre :

```bash
docker exec -i pieuvre-db psql -U pieuvre_user -d pieuvre_db < pieuvre-database/migrations/001_add_rag.sql
docker exec -i pieuvre-db psql -U pieuvre_user -d pieuvre_db < pieuvre-database/migrations/002_add_sprint2.sql
docker exec -i pieuvre-db psql -U pieuvre_user -d pieuvre_db < pieuvre-database/migrations/003_add_memoire_client_dossier.sql
```

---

## Plugin AutoCAD

### Compilation (AutoCAD 2023, 2024 ou 2025)

Le projet détecte automatiquement la version d'AutoCAD installée — aucun chemin à modifier à la main.

**Option A — Script PowerShell (recommandé)**

```powershell
cd pieuvre-autocad-plugin

# Détection automatique (demande si plusieurs versions installées)
.\build.ps1

# Forcer une version précise
.\build.ps1 -Version 2023
.\build.ps1 -Version 2024
.\build.ps1 -Version 2025

# Compiler pour toutes les versions installées
.\build.ps1 -Version all
```

Le script trouve MSBuild automatiquement et produit un `.dll` par version dans :
```
bin\Release\AutoCAD2023\PieuvreAutoCAD.dll
bin\Release\AutoCAD2024\PieuvreAutoCAD.dll
bin\Release\AutoCAD2025\PieuvreAutoCAD.dll
```

**Option B — Visual Studio**

1. Ouvrir `pieuvre-autocad-plugin/PieuvrePlugin.csproj`
2. Restaurer les packages NuGet (`Newtonsoft.Json`)
3. Build → Release

Le `.csproj` cherche automatiquement AutoCAD 2023, puis 2024, puis 2025.  
Pour forcer une version : `msbuild /p:AutoCADPath="C:\Program Files\Autodesk\AutoCAD 2025"`  
Ou via variable d'environnement : `AUTOCAD_PATH=C:\Program Files\Autodesk\AutoCAD 2025`

**Compatibilité des versions**

| Version AutoCAD | DLL de compilation | DLL fournie au runtime | Compatibilité |
|---|---|---|---|
| 2023 | `AutoCAD 2023\acdbmgd.dll` | AutoCAD 2023 | ✅ |
| 2024 | `AutoCAD 2024\acdbmgd.dll` | AutoCAD 2024 | ✅ |
| 2025 | `AutoCAD 2025\acdbmgd.dll` | AutoCAD 2025 | ✅ |
| LT (toutes) | — | — | ❌ (AutoCAD LT ne supporte pas NETLOAD) |

> Le plugin affiche la version d'AutoCAD détectée au chargement (`PIEUVREINFO` pour vérifier).

### Installation dans AutoCAD

1. Copier `PieuvreAutoCAD.dll` et `Newtonsoft.Json.dll` dans un dossier fixe, par exemple `C:\PieuvreAutoCAD\`
2. Dans AutoCAD, taper la commande `NETLOAD`
3. Sélectionner `PieuvreAutoCAD.dll`
4. Le plugin se charge — message de confirmation dans la console AutoCAD

**Pour le charger automatiquement** : ajouter le chemin dans *Options → Fichiers → Applications chargées automatiquement*.

### Configuration (`C:\PieuvreAutoCAD\config.json`)

Créé automatiquement au premier chargement :

```json
{
  "api_url": "http://localhost:3001",
  "default_user": "VotreNomWindows"
}
```

Si le serveur Docker tourne sur une **autre machine** du réseau :
```json
{
  "api_url": "http://192.168.1.50:3001",
  "default_user": "Jean"
}
```

### Commandes disponibles dans AutoCAD

| Commande | Description |
|---|---|
| `PIEUVRE` | Ouvre l'interface principale (sélection client/chantier, saisie circuits, calcul, sauvegarde) |
| `PIEUVRESTOCK` | Affiche le stock de fils et gaines dans la console AutoCAD |
| `PIEUVRECALC` | Calcul rapide avec le dernier profil utilisé |
| `PIEUVREINFO` | Affiche la version et l'URL API configurée |

---

## Interface web

Accessible sur **http://localhost** une fois Docker démarré.

| Page | Rôle |
|---|---|
| Dashboard | Vue d'ensemble, alertes stock, activité récente |
| Clients | Gestion des profils clients (sections, couleurs préférées) |
| Chantiers | Suivi des chantiers par client |
| Calculs | Historique de tous les bons de coupe |
| Étiquettes | Génération PDF des étiquettes de pieuvres |
| Mémoire | Personnalisation OCR et préférences par client/chantier |
| Stock | Consultation et mise à jour du stock fils/gaines |
| Config | Paramètres de l'application |
| Scan | Import/scan de plans |

---

## Workflow typique

```
1. Ouvrir le plan DWG dans AutoCAD
2. Taper PIEUVRE
3. Sélectionner le client puis le chantier
4. Saisir les circuits dans la grille :
   - Numéro  (P1, L1, VD1...)
   - Type    (Prise, Lumière, Va-et-vient...)
   - Longueur en mètres
5. Cliquer "Calculer" → bon de coupe généré automatiquement
6. Vérifier les alertes (stock insuffisant, substitutions de couleur)
7. Cliquer "Sauvegarder" → historique enregistré en base
8. Aller sur http://localhost → Étiquettes → imprimer les étiquettes PDF
```

---

## Données initiales

La base de données est pré-remplie avec :
- 4 clients types (Bouygues, Vinci, Eiffage, Particuliers)
- 4 chantiers d'exemple
- Stock de fils (sections 1.5, 2.5 et 6 mm²) et gaines (Ø16 à Ø63)
- Types de circuits NF C 15-100 (P, L, VD, DA, TEL, BS, VMC, VR, CUIS...)

---

## Structure du projet

```
pieuvre-complete/
├── docker-compose.yml          ← Lance les 3 conteneurs (nginx, API, PostgreSQL)
├── Dockerfile.api              ← Image Docker pour l'API Node.js
├── Dockerfile.frontend         ← Image Docker pour le frontend React (nginx)
├── nginx.conf                  ← Config nginx (proxy /api → backend)
├── start.sh                    ← Script de démarrage (Mac/Linux)
├── stop.sh                     ← Script d'arrêt
│
├── pieuvre-api/                ← Backend Node.js / Express
│   ├── server.js               ← Point d'entrée, routes montées
│   ├── db/postgres.js          ← Pool de connexions PostgreSQL
│   ├── routes/                 ← Une route par ressource
│   │   ├── calculs.js          ← POST /compute + CRUD calculs
│   │   ├── clients.js
│   │   ├── chantiers.js
│   │   ├── stock.js
│   │   ├── etiquettes.js
│   │   └── ...
│   └── utils/algorithms.js     ← Calcul bon de coupe (NF C 15-100)
│
├── pieuvre-frontend/           ← Interface React (Vite)
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       └── utils/api.js
│
├── pieuvre-database/
│   └── schema.sql              ← Schéma PostgreSQL + données initiales
│
└── pieuvre-autocad-plugin/     ← Plugin AutoCAD C# (.NET 4.8)
    ├── PieuvrePlugin.csproj    ← Auto-détecte AutoCAD 2023/2024/2025
    ├── build.ps1               ← Script de compilation multi-versions
    ├── PluginMain.cs           ← Commandes PIEUVRE, PIEUVRESTOCK...
    ├── Core/
    │   ├── ApiClient.cs        ← Appels HTTP vers l'API
    │   └── Configuration.cs    ← config.json + détection version AutoCAD
    ├── Models/DataModels.cs    ← Modèles de données
    ├── UI/
    │   └── MainForm.cs         ← Formulaire principal (WinForms)
    └── Properties/
        └── AssemblyInfo.cs
```

---

## Déploiement sur clé USB

1. Copier le dossier `pieuvre-complete/` sur la clé
2. Sur la machine cible : installer **Docker Desktop** et le démarrer
3. Ouvrir un terminal dans le dossier, exécuter `./start.sh`
4. Ouvrir `http://localhost`

Les données sont persistées dans un volume Docker nommé `postgres_data` — elles survivent aux redémarrages.

**Sauvegarde des données :**
```bash
docker exec pieuvre-db pg_dump -U pieuvre_user pieuvre_db > backup.sql
```

**Restauration :**
```bash
docker exec -i pieuvre-db psql -U pieuvre_user pieuvre_db < backup.sql
```

---

## Développement local (sans Docker)

**API :**
```bash
cd pieuvre-api
cp .env.example .env   # adapter DB_HOST=localhost
npm install
npm run dev            # nodemon sur :3001
```

**Frontend :**
```bash
cd pieuvre-frontend
npm install
npm run dev            # Vite sur :3000, proxy /api → :3001
```

**Base de données :** PostgreSQL local requis, initialiser avec `pieuvre-database/schema.sql`.

---

## Variables d'environnement API

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | 3001 | Port de l'API |
| `DB_HOST` | postgres | Hôte PostgreSQL |
| `DB_PORT` | 5432 | Port PostgreSQL |
| `DB_NAME` | pieuvre_db | Nom de la base |
| `DB_USER` | pieuvre_user | Utilisateur |
| `DB_PASSWORD` | pieuvre_pass | Mot de passe |
| `WEB_URL` | http://localhost | URL frontend (CORS) |

---

## Algorithme de calcul (NF C 15-100)

Le calcul du bon de coupe suit ces étapes :

1. **Expansion des circuits** : chaque circuit (type + longueur) est converti en conducteurs détaillés (Phase, Neutre, Terre, Navettes)
2. **Vérification doublage prises** : max 8 prises par circuit
3. **Mutualisation des terres** : optimisation par regroupement de gaines
4. **Application des marges** : 10 % fils, 10 % gaines par défaut (configurables par client/chantier)
5. **Vérification stock** : détection ruptures, substitutions de couleurs respectant les normes
6. **Calcul des gaines** : diamètre minimum selon taux de remplissage 40 %

---

## Licence

Projet privé — Toussaint Garinat
