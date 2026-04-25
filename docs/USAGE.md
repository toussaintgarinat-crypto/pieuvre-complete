# Pieuvre Auto - Documentation Complète

## Introduction

**Pieuvre Auto** est une application de gestion des câbles électriques pour le bâtiment, conforme à la norme NF C 15-100. Elle permet de :

- Gérer les clients avec leurs préférences (gaines refusées, section des prises)
- Créer des chantiers (bâtiments, étages, logements)
- Définir les circuits électriques (prises, lumières, VMC, etc.)
- Calculer automatiquement le diamètre minimal des gaines
- Générer des étiquettes PDF pour le chantier
- Suivre le stock de câbles et gaines

---

## Installation

### Prérequis

- Node.js 18+
- PostgreSQL 16+

### Étapes

```bash
# 1. Cloner le projet
git clone https://github.com/votre-repo/pieuvre-auto.git
cd pieuvre-auto

# 2. Installer les dépendances
cd pieuvre-api && npm install
cd ../pieuvre-frontend && npm install

# 3. Configurer la base de données
cp pieuvre-api/.env.example pieuvre-api/.env
# Éditer .env avec vos paramètres

# 4. Créer la base de données
psql -U postgres -c "CREATE DATABASE pieuvre_db;"
psql -U postgres -d pieuvre_db -f pieuvre-database/schema.sql

# 5. Démarrer l'API
cd pieuvre-api && npm run dev

# 6. Démarrer le frontend (autre terminal)
cd pieuvre-frontend && npm run dev
```

L'application est accessible sur :
- Frontend : http://localhost:3000
- API : http://localhost:3001

---

## Architecture

### Base de données

| Table | Description |
|-------|-------------|
| `clients` | Clients avec préférences NF C 15-100 |
| `chantiers` | Chantiers (bâtiments, étages, logements) |
| `circuits` | Circuits électriques |
| `calculs` | Calculs de dimensionnement |
| `config_etiquette` | Configurations d'étiquettes |
| `types_circuits` | Types de circuits (P, L, VD, etc.) |
| `stock` | Inventaire câbles/gaines |

### API Endpoints

```
GET    /api/clients          # Liste clients
POST   /api/clients          # Créer client
GET    /api/clients/:id     # Get client
PUT    /api/clients/:id     # Modifier client
DELETE /api/clients/:id     # Supprimer client

GET    /api/chantiers       # Liste chantiers
POST   /api/chantiers      # Créer chantier
GET    /api/chantiers/:id  # Get chantier
PUT    /api/chantiers/:id  # Modifier chantier
DELETE /api/chantiers/:id  # Supprimer chantier

GET    /api/calculs        # Liste calculs
POST   /api/calculs       # Créer calcul
GET    /api/calculs/:id   # Get calcul avec résultats
DELETE /api/calculs/:id   # Supprimer calcul

GET    /api/etiquettes/config         # Liste configurations
POST   /api/etiquettes/config      # Créer config
GET    /api/etiquettes/generer/:id  # Générer PDF
```

---

## Utilisation

### 1. Clients

Créer un client avec ses préférences :

- **Nom** : Nom du client
- **Email** : Contact email
- **Téléphone** : Contact téléphonique
- **Section prises par défaut** : 1.5mm² ou 2.5mm²
- **Gaines refusées** : Liste des Ø refusés (ex: [16, 20])

**Exemple curl :**
```bash
curl -X POST http://localhost:3001/api/clients \
  -H "Content-Type: application/json" \
  -d '{"nom": "Bouygues Construction", "section_prises_par_defaut": 1.5, "gaines_refusees": [16]}'
```

### 2. Chantiers

Créer un chantier associé à un client :

- **Nom** : Nom du chantier
- **Client** : ID du client
- **Bâtiment** : A, B, C...
- **Étage** : RDC, 1, 2...
- **Lot** : 101, 102...

**Exemple curl :**
```bash
curl -X POST http://localhost:3001/api/chantiers \
  -H "Content-Type: application/json" \
  -d '{"nom": "Résidence ABC", "id_client": 1, "batiment": "A", "etage": "1", "appartement": "101"}'
```

### 3. Circuits

Définir les circuits d'un calcul :

```json
{
  "type": "P",
  "nb_prises": 6,
  "section_fils": 2.5,
  "longueur": 15,
  "etage": "1",
  "logement": "101",
  "numero_boite": 1
}
```

Types disponibles :
| Code | Description | Category |
|------|------------|----------|
| P | Prise électrique | prise |
| L | Lumière | lumier |
| VD | Va-et-vient | lumier |
| DA | Double allumage | lumier |
| TEL | Telérupeur | spec |
| BS | Bloc secours | spec |
| VMC | VMC | spec |
| VR | Volet roulant | spec |
| LL | Lave-linge | appareil |
| LV | Lave-vaisselle | appareil |
| PG | Prise extérieur | exterieur |

### 4. Calculs

Créer un calcul :

```bash
curl -X POST http://localhost:3001/api/calculs \
  -H "Content-Type: application/json" \
  -d '{
    "id_chantier": 1,
    "utilisateur": "Jean Dupont",
    "marge": 0.15,
    "circuits": [...]
  }'
```

L'API retourne le calcul avec :
- `gaines` : Liste des gaines avec diamètres
- `longueurs` : Longueurs avec marges
- `bon_de_coupe` : Données pour les étiquettes

### 5. Étiquettes

Générer un PDF d'étiquettes :

```bash
# Avec config par défaut
curl http://localhost:3001/api/etiquettes/generer/1 -o etiquettes.pdf

# Avec config spécifique
curl "http://localhost:3001/api/etiquettes/generer/1?config_id=2" -o etiquettes.pdf
```

Configurations disponibles :
| Nom | Dimensions | Par ligne |
|-----|------------|----------|
| Standard 70x35 | 70×35mm | 3 |
| Compact 50x25 | 50×25mm | 4 |
| Grand 100x50 | 100×50mm | 2 |
| Avery L7160 | 99×34mm | 3 |

---

## Norme NF C 15-100

### Taux de remplissage

- **Remplissage maximal** : 40% (1/3 de la surface)
- Formule : `surface_gaine = surface_cables / 0.4`

### Prises électriques

- **Maximum 8 prises** par circuit
- Au-delà, créer plusieurs circuits
- Section 1.5mm² ou 2.5mm² selon client

### Gaines

- **Diamètres standards** : Ø16, 20, 25, 32, 40, 50, 63mm
- **Minimum** : Ø16mm
- Certains clients refusent Ø16mm → adaptation automatique

---

## Algorithmes

### calculateMinGaineDiameter

```javascript
// Surface totale des câbles
totalSurface = cables.reduce((sum, cable) => {
  diameter = getCableDiameter(cable.section);
  surface = π × (diameter/2)²;
  return sum + surface;
});

// Surface nécessaire (40% remplissage)
requiredSurface = totalSurface / 0.4;

// Diamètre correspondant
requiredDiameter = 2 × √(requiredSurface / π);

// Trouver le premier Ø disponible >= required
return sortedDiameters.find(d => d >= requiredDiameter);
```

### applyMarge

```javascript
function applyMarge(longueur, marge, longueurMin = 1) {
  return Math.max(longueur × (1 + marge), longueurMin);
}
```

---

## Développement

### Tests

```bash
cd pieuvre-api && npm test
```

### Docker

```bash
# Build et démarrage
docker-compose up -d

# Logs
docker-compose logs -f

# Arrêt
docker-compose down
```

---

## License

MIT - Toussaint Garinat