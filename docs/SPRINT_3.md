# Sprint 3 — Mémoire client / dossier

## Objectif
Permettre à chaque client et à chaque chantier d’avoir sa propre mémoire de symboles, règles OCR et préférences d’étiquetage.

Le principe d’héritage est :

```
dossier/chantier > client > global
```

Quand une règle existe aux trois niveaux, celle du chantier l’emporte.

---

## ✅ Déjà implémenté

### Base de données
- `ocr_type_mappings` est devenue hiérarchique avec `id_client` et `id_chantier`.
- Contrainte d’unicité tenant compte du contexte : `UNIQUE(id_client, id_chantier, ocr_type_element, ocr_code_symbol)`.
- Nouvelles colonnes sur `clients` et `chantiers` :
  - `preferences_etiquettes` (JSONB)
  - `memoire_ocr_active` (boolean)
- Migration `pieuvre-database/migrations/003_add_memoire_client_dossier.sql` créée.
- `pieuvre-database/schema.sql` mis à jour.

### Backend
- `pieuvre-api/services/ocrMappings.js`
  - `getEffectiveMappings(id_client, id_chantier)` applique l’héritage.
  - `determineCircuitTypeFromMappings` accepte un contexte.
- `pieuvre-api/services/circuitBuilder.js`
  - `buildCircuitsFromDevices` accepte `context: { id_client, id_chantier }`.
- `pieuvre-api/routes/scans.js`
  - `POST /api/scans/:id/calculer` passe le contexte au circuit builder.
- `pieuvre-api/routes/ocrMappings.js`
  - `GET /api/ocr-mappings?id_client=X&id_chantier=Y` retourne les mappings effectifs.
  - `POST /api/ocr-mappings` accepte `id_client` ou `id_chantier` (pas les deux).
- `pieuvre-api/routes/clients.js`
  - `GET /api/clients/:id/preferences`
  - `PUT /api/clients/:id/preferences`
- `pieuvre-api/routes/chantiers.js`
  - `GET /api/chantiers/:id/preferences`
  - `PUT /api/chantiers/:id/preferences`
- `pieuvre-api/routes/etiquettes.js`
  - `/api/etiquettes/generer/:calculId` applique les préférences chantier/client pour le mode, le format et le regroupement.
- `pieuvre-api/services/calculService.js`
  - `getChantierProfil` récupère aussi les préférences étiquettes.

### Frontend
- Nouvelle page `pieuvre-frontend/src/pages/MemoireClient.jsx` accessible sur `/memoire`.
- Sélection client / chantier.
- Gestion des mappings OCR personnalisés (CRUD).
- Édition des préférences d’étiquetage (mode, format, regroupement, activation mémoire OCR).
- `App.jsx` et `utils/api.js` mis à jour.
- Styles ajoutés dans `index.css`.

---

## ✅ Terminé

### 3. Robustesse
- [x] Gérer le cas où `id_chantier` est fourni mais pas `id_client` dans `getEffectiveMappings`.
- [x] Vérifier que la suppression d’un client supprime bien ses mappings (`ON DELETE CASCADE`).
- [x] Ajouter une validation empêchant qu’un mapping soit créé sur un chantier d’un autre client.

### 2. Données initiales
- [x] Ajouter un client exemple avec `preferences_etiquettes` et `memoire_ocr_active = true`.
- [x] Ajouter un mapping OCR client d’exemple dans `schema.sql`.

### 4. Expérience utilisateur
- [x] Afficher un indicateur visuel sur la page Mémoire quand une règle vient du client ou du chantier.
- [x] Permettre de dupliquer les mappings d’un client vers un nouveau chantier.
- [x] Ajouter une prévisualisation du résultat OCR avant calcul.

### 5. Documentation
- [x] Mettre à jour `docs/MEMORY.md` (roadmap).
- [x] Mettre à jour `docs/memory/QUICKREF.md` (commandes et endpoints).
- [x] Créer / mettre à jour `docs/api/endpoints.md`.

### 6. Plugin AutoCAD
- [x] Réfléchir à l’impact sur le plugin : voir section "Impact plugin AutoCAD" ci-dessous.

---

## ✅ Validé via le Sprint 4

Les tests d’intégration et la validation Docker ont été réalisés dans le **Sprint 4 — Validation Docker et tests end-to-end** (`docs/SPRINT_4.md`).

Tous les points ont été validés :
- Docker Desktop démarré, conteneurs reconstruits.
- Migration `003` (et `002`) appliquée.
- Scan OCR mock + calcul depuis scan OK.
- Génération PDF d’étiquettes avec préférences client/chantier OK.
- Héritage chantier > client > global vérifié.
- Frontend `/memoire` testé avec Playwright.

---

## Impact plugin AutoCAD

Le plugin AutoCAD actuel (dans `pieuvre-autocad-plugin/`) lit les symboles et calcule les circuits localement ou les envoie à l’API. Avec la mémoire client/dossier :

1. **Lecture des plans** : si le plugin détecte des symboles personnalisés (`P16`, `PC`, etc.), il devrait interroger `/api/ocr-mappings?id_client=X&id_chantier=Y` pour obtenir les mappings effectifs et transformer les symboles en types de circuits Pieuvre.
2. **Envoi des circuits** : le plugin peut continuer à envoyer directement des circuits typés (`P`, `L`, `VD`, etc.) ; la mémoire OCR n’est alors pas nécessaire.
3. **Préférences étiquettes** : lors de la génération d’étiquettes ou de bon de coupe depuis le plugin, il est recommandé de récupérer les préférences du chantier via `/api/chantiers/:id/preferences` pour utiliser le bon mode d’étiquetage et le bon regroupement.

**Recommandation** : ajouter une option dans le plugin "Utiliser la mémoire client/dossier" qui, si activée, récupère les mappings et préférences du chantier courant avant tout calcul.

---

## Commandes clés

```bash
# Lancer l’infra (quand Docker sera disponible)
./start.sh

# Appliquer la migration 003 sur une base existante
docker exec -i pieuvre-db psql -U pieuvre_user -d pieuvre_db < pieuvre-database/migrations/003_add_memoire_client_dossier.sql

# Lister les mappings effectifs pour un client
curl "http://localhost:3001/api/ocr-mappings?id_client=1"

# Lister les mappings effectifs pour un chantier (hérite du client + global)
curl "http://localhost:3001/api/ocr-mappings?id_client=1&id_chantier=1"

# Créer un mapping client
curl -X POST http://localhost:3001/api/ocr-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "id_client": 1,
    "ocr_type_element": "prise",
    "ocr_code_symbol": "P16",
    "circuit_type_code": "P",
    "description": "Le client appelle ses prises P16",
    "priority": 110
  }'

# Définir les préférences étiquettes d’un client
curl -X PUT http://localhost:3001/api/clients/1/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "preferences_etiquettes": {
      "mode_etiquetage": "machine",
      "config_id": 2,
      "regroupement": {"ordre": ["type", "section", "gaine"]}
    },
    "memoire_ocr_active": true
  }'

# Activer la mémoire sur un chantier (override client)
curl -X PUT http://localhost:3001/api/chantiers/1/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "preferences_etiquettes": {
      "mode_etiquetage": "atelier",
      "regroupement": {"ordre": ["logement", "boite"]}
    },
    "memoire_ocr_active": true
  }'
```

---

## Notes

- Les modifications backend/frontend du Sprint 3 sont en place, testées unitairement **et validées en conditions réelles** via le Sprint 4.
- Les fichiers modifiés doivent être commités ensemble.
