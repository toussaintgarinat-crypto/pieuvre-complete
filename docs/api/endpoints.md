# Pieuvre Auto - Documentation API

## Base URL

```
http://localhost:3001/api
```

---

## Mémoire client / dossier (Sprint 3)

### Mappings OCR

#### Lister les mappings effectifs

```http
GET /ocr-mappings?id_client=1&id_chantier=1
```

Retourne les mappings actifs pour un contexte donné, en appliquant l’héritage :
**chantier > client > global**.

Si `id_chantier` est fourni sans `id_client`, le client du chantier est résolu automatiquement.

**Réponse :**

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "id_client": null,
      "id_chantier": 1,
      "ocr_type_element": "prise",
      "ocr_code_symbol": "PC",
      "circuit_type_code": "P",
      "circuit_libelle": "Prise",
      "description": "Prise spécifique chantier",
      "priority": 120,
      "actif": true,
      "_scopeLevel": 3
    }
  ]
}
```

#### Créer un mapping

```http
POST /ocr-mappings
```

**Body client :**

```json
{
  "id_client": 1,
  "ocr_type_element": "prise",
  "ocr_code_symbol": "P16",
  "circuit_type_code": "P",
  "description": "Le client appelle ses prises P16",
  "priority": 110,
  "conditions": { "requires_code": true }
}
```

**Body chantier :**

```json
{
  "id_chantier": 1,
  "ocr_type_element": "prise",
  "ocr_code_symbol": "PC",
  "circuit_type_code": "P",
  "priority": 120
}
```

Règles :

- Un mapping ne peut être lié qu’à un seul niveau (global, client **ou** chantier).
- Le client ou le chantier doit exister.
- Si un `id_chantier` est fourni, il doit appartenir au client indiqué (lorsqu’un client est également fourni dans un contexte de permission).

#### Modifier un mapping

```http
PUT /ocr-mappings/:id
```

Champs modifiables : `id_client`, `id_chantier`, `ocr_type_element`, `ocr_code_symbol`, `circuit_type_code`, `description`, `conditions`, `priority`, `actif`.

#### Supprimer un mapping

```http
DELETE /ocr-mappings/:id
```

#### Dupliquer les mappings client vers un chantier

```http
POST /ocr-mappings/duplicate
```

**Body :**

```json
{
  "id_client": 1,
  "id_chantier": 2
}
```

Copie tous les mappings actifs du client vers le chantier spécifié. Le chantier doit appartenir au client.

#### Prévisualiser la résolution OCR

```http
POST /ocr-mappings/preview
```

**Body :**

```json
{
  "devices": [
    { "type_element": "prise", "code_symbol": "P16" },
    { "type_element": "lumiere", "code_symbol": "L" }
  ],
  "context": {
    "id_client": 1,
    "id_chantier": 1
  }
}
```

Retourne le type de circuit résolu selon la mémoire active.

**Réponse :**

```json
{
  "success": true,
  "data": {
    "type_resolu": "prise",
    "devices": [...]
  }
}
```

---

### Préférences client / chantier

#### Client

```http
GET    /clients/:id/preferences
PUT    /clients/:id/preferences
```

**Body PUT :**

```json
{
  "preferences_etiquettes": {
    "mode_etiquetage": "machine",
    "config_id": 2,
    "regroupement": { "ordre": ["type", "section", "gaine"] }
  },
  "memoire_ocr_active": true
}
```

#### Chantier (override client)

```http
GET    /chantiers/:id/preferences
PUT    /chantiers/:id/preferences
```

**Body PUT :**

```json
{
  "preferences_etiquettes": {
    "mode_etiquetage": "atelier",
    "regroupement": { "ordre": ["logement", "boite"] }
  },
  "memoire_ocr_active": true
}
```

---

## Scans et OCR (Sprint 1)

### Uploader un plan

```http
POST /scans/upload
Content-Type: multipart/form-data
```

Champs : `fichier`, `id_chantier`, `id_client`, `methode_scan`.

### Traiter un scan

```http
POST /scans/process/:id
```

### Calculer un bon de coupe depuis un scan

```http
POST /scans/:id/calculer
```

**Body :**

```json
{
  "id_chantier": 1,
  "options": { "maxPrisesParCircuit": 8, "useRAG": true }
}
```

Le contexte client/chantier est automatiquement transmis au `circuitBuilder` pour appliquer la mémoire OCR.

---

## Calculs (Sprint 2)

### Calculer un bon de coupe

```http
POST /calculs/compute
```

**Body :**

```json
{
  "id_chantier": 1,
  "circuits": [
    { "type": "P", "longueur": 15, "nb_points": 3, "logement": "Lg1", "numero_boite": 1 }
  ],
  "mode_production": "derivation"
}
```

---

## Étiquettes (Sprint 2)

### Générer le PDF d’étiquettes

```http
GET /etiquettes/generer/:calculId?mode_etiquetage=atelier&regroupement={"ordre":["logement","boite"]}&config_id=2
```

Les préférences client/chantier sont appliquées automatiquement si aucun paramètre explicite n’est fourni.

---

## Impression ruban continu (Sprint 2)

### Sessions

```http
POST   /impression/sessions
GET    /impression/sessions
GET    /impression/sessions/:id
PUT    /impression/sessions/:id/marquer
PUT    /impression/sessions/:id/annuler
GET    /impression/calcul/:id/etiquettes
```

---

## Codes d’erreur communs

| Statut | Signification |
|--------|---------------|
| 400    | Paramètres invalides ou requis manquants |
| 403    | Action non autorisée (ex: chantier d’un autre client) |
| 404    | Ressource introuvable |
| 409    | Conflit d’unicité (mapping déjà existant pour ce contexte) |
| 500    | Erreur serveur |
