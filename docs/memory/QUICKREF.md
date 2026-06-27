# MEMORY - Résumé Rapide

## Démarrage Rapide

```bash
# 1. Docker PostgreSQL (si pas démarré)
docker start pieuvre-postgres

# 2. API
cd pieuvre-api && npm start

# 3. Frontend (si besoin)
cd pieuvre-frontend && npm run dev
```

## URLs

| Service | URL |
|---------|-----|
| API | http://localhost:3001 |
| Health | http://localhost:3001/health |
| Frontend | http://localhost:3000 |
| PostgreSQL | localhost:5432 ( Docker) |

## Variables d'environnement (pieuvre-api/.env)

```
DB_HOST=localhost
DB_NAME=pieuvre_db
DB_USER=postgres
DB_PASSWORD=p0stgres
PORT=3001
```

## Tables principales

| Table | Usage |
|-------|-------|
| `clients` | Profils clients avec préférences |
| `chantiers` | Chantiers/bâtiments |
| `calculs` | Calculs de pieuvres |
| `stock_couleurs` | Stock fils |
| `stock_gaines` | Stock gaines |
| `impression_sessions` | Sessions ruban continu |
| `impression_historique` | Traçabilité impressions |

## Endpoints Impression Ruban Continu

```bash
# Lister sessions actives
GET    /api/impression/sessions/actives

# Détails session + historique
GET    /api/impression/sessions/:id

# Démarrer nouvelle session
POST   /api/impression/sessions
{
  "id_calcul": 2,
  "utilisateur": "Jean",
  "filtre_type": "logement",
  "filtre_valeur": "Lg1",
  "etiquettes": ["L-1", "P-5", "VR-7"]
}

# Marquer étiquettes coupées (après changement rouleau)
PUT    /api/impression/sessions/:id/marquer
{
  "etiquettes_code": ["L-1", "P-5"],
  "action": "decoupee",
  "utilisateur": "Jean"
}

# Filtrer étiquettes par calcul
GET    /api/impression/calcul/:id/etiquettes?filtre_type=logement&filtre_valeur=Lg1
```

## Workflow Impression

```
1. POST /sessions → Crée session
2. Imprimer les étiquettes du ruban
3. ✂️ Couper
4. PUT /sessions/:id/marquer → {action: "decoupee"}
5. 🔄 Ruban fini ? → Changer rouleau → Continuer session
6. ✅ Session terminée automatiquement quand tout coupé
```

## Tables pour étiquetage

- Filtre par **chantier** → Toutes les boîtes
- Filtre par **logement** → Toutes les boîtes d'un logement
- Filtre par **boîte** → Une seule boîte

## Modes de production

| Mode | Description |
|------|-------------|
| `direct` | Tableau → appareil |
| `derivation` | Tableau → boîte de dérivation → appareils |

## Modes d'étiquetage

| Mode | Description |
|------|-------------|
| `atelier` | Par boîte d'encastrement |
| `machine` | Par type / section / gaine |

## Endpoints Sprint 2

```bash
# Calcul avec mode de production
POST /api/calculs/compute
{ "id_chantier": 1, "circuits": [...], "mode_production": "derivation" }

# Générer PDF étiquettes
GET /api/etiquettes/generer/:calculId?mode_etiquetage=atelier&regroupement={"ordre":["logement","boite"]}

# Session impression
POST /api/impression/sessions
GET  /api/impression/sessions
GET  /api/impression/sessions/:id
PUT  /api/impression/sessions/:id/marquer
PUT  /api/impression/sessions/:id/annuler
GET  /api/impression/calcul/:id/etiquettes?filtre_type=logement&filtre_valeur=Lg1
```

## Endpoints Sprint 3 — Mémoire client / dossier

```bash
# Mappings OCR effectifs (héritage : chantier > client > global)
GET /api/ocr-mappings?id_client=1&id_chantier=1

# Créer un mapping client
POST /api/ocr-mappings
{ "id_client": 1, "ocr_type_element": "prise", "ocr_code_symbol": "P16", "circuit_type_code": "P", "priority": 110 }

# Créer un mapping chantier
POST /api/ocr-mappings
{ "id_chantier": 1, "ocr_type_element": "prise", "ocr_code_symbol": "PC", "circuit_type_code": "P", "priority": 120 }

# Dupliquer les mappings client vers un chantier
POST /api/ocr-mappings/duplicate
{ "id_client": 1, "id_chantier": 2 }

# Prévisualiser la résolution OCR avec la mémoire active
POST /api/ocr-mappings/preview
{
  "devices": [
    { "type_element": "prise", "code_symbol": "P16" },
    { "type_element": "lumiere", "code_symbol": "L" }
  ],
  "context": { "id_client": 1, "id_chantier": 1 }
}

# Préférences étiquettes / OCR client
GET    /api/clients/:id/preferences
PUT    /api/clients/:id/preferences
{ "preferences_etiquettes": {"mode_etiquetage":"machine","config_id":2,"regroupement":{"ordre":["type","section","gaine"]}}, "memoire_ocr_active": true }

# Préférences étiquettes / OCR chantier (override client)
GET    /api/chantiers/:id/preferences
PUT    /api/chantiers/:id/preferences
{ "preferences_etiquettes": {"mode_etiquetage":"atelier","regroupement":{"ordre":["logement","boite"]}}, "memoire_ocr_active": true }

# Appliquer la migration 003 sur une base existante
docker exec -i pieuvre-db psql -U pieuvre_user -d pieuvre_db < pieuvre-database/migrations/003_add_memoire_client_dossier.sql
```

## ⚠️ TODO: Types de boîtes

> Différents types de boîtes existent selon le support (placo, béton, bois, etc.)
> À intégrer dans le module étiquetage.
> Voir aussi: formats d'étiquettes selon fabricant (Avery, Dymo, Brother)

## Structure fichiers

```
pieuvre-complete/
├── plans-test/              # Plans DWG de test
│   ├── EXE_Plan PC.dwg
│   ├── Plan Eclairage.dwg
│   ├── etiquettes-demo.html # Demo visuelle
│   └── PIEUVRE_BON_COUPE_ETIQUETTES.pdf
├── pieuvre-api/
│   ├── routes/impression.js # Gestion ruban continu
│   └── utils/algorithms.js  # Algorithmes pieuvre
└── pieuvre-database/
    └── schema.sql
```

## Problèmes courants

| Erreur | Solution |
|--------|----------|
| Connection refused | `docker start pieuvre-postgres` |
| CORS error | Vérifier WEB_URL dans .env |
| Table not found | Vérifier import schema.sql |
| Route 404 | Redémarrer l'API |

Pour plus de détails : voir docs/USAGE.md et MEMORY.md