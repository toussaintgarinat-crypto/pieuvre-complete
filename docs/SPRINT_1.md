# Sprint 1 - OCR + RAG NFC 15-100

## Objectif
Passer de la saisie manuelle des circuits à la lecture automatique des plans et à l'enrichissement par la norme NF C 15-100.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Plan      │────▶│  pieuvre    │────▶│  Modèle Vision  │
│ (jpg/pdf/   │     │    API      │     │ (OpenAI/Claude/ │
│  dwg/dxf)   │     │  /api/scans │     │     Gemini)     │
└─────────────┘     └──────┬──────┘     └─────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  PostgreSQL │
                    │  + pgvector │
                    │ normes_*    │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────────┐
                    │   circuit   │────▶│  RAG (search)   │
                    │   Builder   │     │  section/gaine  │
                    └──────┬──────┘     └─────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   calcul    │
                    │   service   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Bon de coupe│
                    └─────────────┘
```

## Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `pieuvre-api/services/rag.js` | Génération d'embeddings et recherche sémantique |
| `pieuvre-api/routes/rag.js` | Endpoints `/api/rag/*` |
| `pieuvre-api/services/ocr.js` | Appels aux modèles de vision |
| `pieuvre-api/services/circuitBuilder.js` | Construction de circuits depuis OCR |
| `pieuvre-api/services/calculService.js` | Logique de calcul partagée |
| `pieuvre-ocr/` | Microservice OCR dans Docker Compose |
| `pieuvre-database/migrations/001_add_rag.sql` | Migration pour bases existantes |

## Configuration

Copier et compléter les clés API dans `.env.docker` (ou `.env`) :

### Option A - OpenAI direct
```bash
# RAG
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
RAG_MOCK_MODE=false

# OCR
VISION_PROVIDER=openai
VISION_API_KEY=sk-...
VISION_MODEL=gpt-4o-mini
VISION_MOCK_MODE=false
```

### Option B - OpenRouter (OpenAI, Anthropic, Google via un seul compte)
```bash
# RAG
EMBEDDING_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small

# OCR
VISION_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
VISION_MODEL=openai/gpt-4o-mini
# Autres modèles disponibles :
# VISION_MODEL=anthropic/claude-3.5-sonnet
# VISION_MODEL=google/gemini-1.5-flash
```

Pour tester sans clé API :

```bash
RAG_MOCK_MODE=true
VISION_MOCK_MODE=true
```

## Utilisation

### 1. Démarrer l'infrastructure

```bash
./start.sh
# ou
docker compose up -d --build
```

### 2. Vectoriser les documents

```bash
curl -X POST http://localhost:3001/api/rag/seed
```

### 3. Uploader un plan

```bash
curl -X POST http://localhost:3001/api/scans/upload \
  -F "fichier=@mon-plan.jpg" \
  -F "id_chantier=1" \
  -F "id_client=1"
```

### 4. Traiter le scan

```bash
curl -X POST http://localhost:3001/api/scans/process/1
```

### 5. Calculer depuis le scan

```bash
curl -X POST http://localhost:3001/api/scans/1/calculer \
  -H "Content-Type: application/json" \
  -d '{"id_chantier": 1}'
```

## Mapping OCR configurable

La correspondance entre les dispositifs détectés par OCR et les types de circuits est entièrement configurable via l'API.

### Modèle de données

Table `ocr_type_mappings` :

| Champ | Description |
|-------|-------------|
| `ocr_type_element` | Type détecté par OCR (prise, lumiere, interrupteur...) |
| `ocr_code_symbol` | Code détecté (P, L, VD, P20...) |
| `circuit_type_code` | Type de circuit Pieuvre (P, L, VD, DA...) |
| `conditions` | Règles JSON : `min_count`, `max_count`, `nearby_types`, `requires_code` |
| `priority` | Priorité de la règle (la plus haute gagne) |
| `actif` | Active ou non la règle |

### Endpoints

```bash
# Lister les mappings
GET /api/ocr-mappings

# Types de circuits disponibles
GET /api/ocr-mappings/types-circuits

# Créer un mapping personnalisé
POST /api/ocr-mappings
{
  "ocr_type_element": "prise",
  "ocr_code_symbol": "P20",
  "circuit_type_code": "P",
  "description": "Prise 20A traitée comme prise standard",
  "priority": 110
}

# Modifier un mapping
PUT /api/ocr-mappings/:id

# Supprimer un mapping
DELETE /api/ocr-mappings/:id
```

### Exemple : ajouter un nouveau type détecté

Ton OCR détecte un nouveau symbole `PORTAIL` pour un portail électrique. Tu veux le traiter comme un circuit extérieur :

```bash
# 1. Créer le type de circuit (si nécessaire)
# 2. Créer le mapping OCR
curl -X POST http://localhost:3001/api/ocr-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "ocr_type_element": "exterieur",
    "ocr_code_symbol": "PORTAIL",
    "circuit_type_code": "PG",
    "description": "Portail électrique traité comme prise extérieure",
    "priority": 110
  }'
```

### Algorithme de détermination

Pour chaque groupe de dispositifs détectés :

1. Recherche d'un mapping avec `ocr_code_symbol` exact (priorité haute)
2. Si aucun, recherche d'un mapping avec `ocr_type_element`
3. Vérification des conditions (`requires_code`, `min_count`, `max_count`, `nearby_types`)
4. Sélection du mapping avec la plus haute priorité
5. Retour du `type_calcul` associé au circuit (ex: `prise`, `lumiere`, `va-et-vient`)

## Points d'attention

- **Longueurs estimées** : les longueurs sont estimées à partir des positions des dispositifs sur l'image, avec un facteur d'échelle par défaut (`SCALE_FACTOR = 0.05`). Ce facteur devra être calibré selon les plans réels.
- **PDF** : si le PDF contient du texte, il est analysé en mode texte. L'analyse vision d'images de pages PDF nécessite une conversion (hors scope Sprint 1).
- **CAD** : les fichiers DWG/DXF sont lus en mode texte (extraction de chaînes). L'intégration d'un vrai parseur CAD est prévue pour un sprint ultérieur.
- **Clés API** : les appels aux modèles de vision et d'embeddings sont facturés par le fournisseur. Le mode mock permet de valider le flux sans coût.

## Prochaines améliorations

- Calibrage automatique de l'échelle des plans.
- Conversion PDF → image pour analyse vision réelle.
- Parseur DWG/DXF natif (ex: via `dxf-parser`).
- Interface frontend de gestion des mappings OCR.
- Interface frontend de visualisation des dispositifs détectés.
