# Pieuvre Auto - Base de Connaissances

Ce dossier contient toute la documentation et connaissances du système Pieuvre Auto.

## Structure

```
docs/
├── USAGE.md                    # Guide d'utilisation principal
├── MEMORY.md                   # ← Ce fichier (point d'entrée)
├── memory/
│   ├── QUICKREF.md             # Résumé rapide (commandes, URLs)
│   └── conversations/          # Historique conversations (futur)
├── api/
│   ├── endpoints.md            # Documentation API
│   └── errors.md               # Codes erreur
└── knowledge/                  # À développer
    └── normes/
```

## Nouvelles fonctionnalités (v1.1)

### Impression Ruban Continu

Système de gestion d'impression avec reprise après changement de rouleau.

| Table | Rôle |
|-------|------|
| `impression_sessions` | Session d'impression en cours |
| `impression_historique` | Traçabilité (qui a coupé quoi, quand) |

**Filtres disponibles :**
- `chantier` → Toutes les étiquettes
- `logement` → Un seul logement (Lg1, Lg2, etc.)
- `boite` → Une seule boîte (L-1, P-5, VR-7, etc.)

### TODO: Types de boîtes

> Différents types de boîtes existent selon le support (placo, béton, bois, etc.)
> À intégrer dans le module étiquetage.

**Types à prendre en compte :**
- Boîte placo (scelléement standard)
- Boîte béton (maçonnée)
- Boîte bois (maison ossature)
- Boîte extérieure (IP)

> Chaque type peut nécessiter un format d'étiquette différent.

## Docker

```bash
# PostgreSQL
docker start pieuvre-postgres
docker stop pieuvre-postgres

# Logs
docker logs pieuvre-postgres

# Connexion directe
docker exec -it pieuvre-postgres psql -U postgres -d pieuvre_db
```

## Fichiers de test

```
plans-test/                          # Plans et démos
├── *.dwg                            # Plans AutoCAD (AJBTP)
├── etiquettes-demo.html             # Démonstration visuelle
└── PIEUVRE_BON_COUPE_ETIQUETTES.pdf # PDF double exemplaire
```

## Roadmap - Sprints

### Sprint 1 : OCR + RAG NFC 15-100 (Option B) ✅ MVP IMPLEMENTÉ

Objectif : passer de la saisie manuelle à la lecture automatique des plans.

**1.1 Infrastructure RAG** ✅
- Extension `pgvector` activée (image `pgvector/pgvector:pg16`).
- Tables `normes_documents` et `normes_chunks` créées.
- Service `pieuvre-api/services/rag.js` et routes `/api/rag/*` pour recherche, seed et gestion des documents.
- Données initiales NFC 15-100 insérées (sections, max prises, gaines).

**1.2 OCR / Vision des plans** ✅
- Microservice `pieuvre-ocr` ajouté dans Docker Compose.
- Service `pieuvre-api/services/ocr.js` avec support OpenAI, Anthropic et Google.
- Routes `detectFromImage()`, `detectFromPDF()`, `detectFromCAD()` branchées dans `pieuvre-api/routes/scans.js`.
- Retour structuré : `{ type_element, code_symbol, position_x, position_y, label, confiance }`.
- Modes mock disponibles (`VISION_MOCK_MODE=true`, `RAG_MOCK_MODE=true`) pour tester sans clé API.

**1.3 Branchement sur le calcul** ✅
- Service `pieuvre-api/services/circuitBuilder.js` transforme les dispositifs en `circuits[]`.
- Table `ocr_type_mappings` + service `pieuvre-api/services/ocrMappings.js` pour déterminer le type de circuit de manière configurable.
- Routes `/api/ocr-mappings/*` pour CRUD des règles OCR → circuit (permet d'ajouter/modifier les types détectés sans toucher au code).
- Le RAG est interrogé pour enrichir chaque circuit (section, conducteurs, gaine, contraintes).
- Route `POST /api/scans/:id/calculer` calcule directement le bon de coupe depuis un scan.
- Service `pieuvre-api/services/calculService.js` partagé avec `/api/calculs/compute`.

**Commandes clés :**
```bash
# Vectoriser les documents de référence
curl -X POST http://localhost:3001/api/rag/seed

# Uploader un plan
curl -X POST -F "fichier=@plan.jpg" -F "id_chantier=1" http://localhost:3001/api/scans/upload

# Traiter le scan (id retourné)
curl -X POST http://localhost:3001/api/scans/process/1

# Calculer le bon de coupe depuis le scan
curl -X POST http://localhost:3001/api/scans/1/calculer \
  -H "Content-Type: application/json" \
  -d '{"id_chantier": 1}'
```

### Sprint 2 : Modes de production et étiquetage ✅ IMPLEMENTÉ

Objectif : gérer les deux modes de fabrication des pieuvres et les deux modes d'impression des étiquettes.

Voir `docs/SPRINT_2.md` (à créer si besoin) ou le détail dans `docs/SPRINT_1.md` historique.

### Sprint 3 : Mémoire client / dossier ✅ IMPLEMENTÉ

Objectif : chaque client et chaque chantier peut avoir ses propres symboles OCR et préférences d’étiquetage.

**Fichier de référence :** `docs/SPRINT_3.md`

**Ce qui est en place :**
- Tables `ocr_type_mappings` hiérarchiques (global, client, chantier) avec `ON DELETE CASCADE`.
- Colonnes `preferences_etiquettes` et `memoire_ocr_active` sur `clients` et `chantiers`.
- Backend : services, routes et héritage chantier > client > global.
  - `getEffectiveMappings` résout automatiquement le client depuis le chantier.
  - Validation métier : existence client/chantier, cohérence cross-client.
  - Endpoints `POST /api/ocr-mappings/duplicate` et `POST /api/ocr-mappings/preview`.
- Frontend : page `/memoire` pour gérer mappings et préférences.
  - Badges d’origine (global / client / chantier).
  - Bouton de duplication client → chantier.
  - Prévisualisation OCR interactive.
- Migration `003_add_memoire_client_dossier.sql`.
- Données initiales d’exemple (client `DEMO - Mémoire OCR`, chantier et mapping `P16 → P`).
- Documentation API dans `docs/api/endpoints.md`.

**Validation restante :**
- Tests Docker (migration, scan OCR mock, génération étiquettes) — voir **Sprint 4** (`docs/SPRINT_4.md`).

### Sprint 4 : Validation Docker et tests end-to-end ✅ TERMINÉ

Objectif : valider le Sprint 3 en conditions réelles.

**Fichier de référence :** `docs/SPRINT_4.md`

**Résultats :**
- Migration 003 (et 002) appliquées avec succès.
- Données démo insérées.
- API : mappings effectifs, héritage chantier > client > global, duplication, prévisualisation OCR validés.
- OCR mock + calcul depuis scan fonctionnels.
- PDF d’étiquettes générés avec préférences client/chantier.
- Frontend `/memoire` testé avec Playwright.
- Bugs corrigés : `routes/etiquettes.js` (ordre d’initialisation `prefs`), doublons mappings globaux.

**Script :**
```bash
./scripts/test-sprint3.sh
```


**2.1 Modes de production des circuits ✅**
- **Direct** : tableau → appareil (circuit dédié).
- **Alimentation + dérivation** : tableau → boîte de dérivation → appareils.
- Champs `mode_production` et `longueur_derivation_m` sur `chantiers` et `calculs`.
- Logique de dérivation dans `pieuvre-api/utils/algorithms.js` et `services/calculService.js`.

**2.2 Modes de fabrication / étiquetage ✅**
- **À l'atelier (par boîte)** : étiquettes regroupées par boîte d'encastrement.
- **À la machine (par type / section / gaine)** : étiquettes regroupées pour optimiser la découpe.
- Paramètre `mode_etiquetage` dans `calculs` et query param sur `/api/etiquettes/generer/:calculId`.

**2.3 Choix de regroupement ✅**
L'utilisateur peut choisir l'ordre de sortie des étiquettes :
- Par logement (Lg1, Lg2…)
- Par boîte (Lg1-B1, Lg1-B2…)
- Par type / section / gaine
- Stocké en JSON dans `calculs.regroupement`.

**2.4 Tables d'impression ruban continu ✅**
- `impression_sessions` : session avec mode, regroupement, progression.
- `impression_historique` : traçabilité des actions (imprimée, découpée, ignorée).
- Routes `/api/impression/*` fonctionnelles.

**2.5 Impact modules concernés**
- `pieuvre-api/routes/calculs.js` : mode de production / étiquetage.
- `pieuvre-api/routes/chantiers.js` : mode de production du chantier.
- `pieuvre-api/routes/etiquettes.js` : mode d'étiquetage, regroupement, PDF.
- `pieuvre-api/routes/impression.js` : sessions d'impression par mode.
- `pieuvre-frontend/src/pages/Etiquettes.jsx` : interface de choix du mode.
- `pieuvre-frontend/src/pages/Calculs.jsx` : saisie des circuits + mode.
- `pieuvre-frontend/src/pages/Chantiers.jsx` : configuration du mode de production.

**Commandes clés :**
```bash
# Calculer en mode dérivation
curl -X POST http://localhost:3001/api/calculs/compute \
  -H "Content-Type: application/json" \
  -d '{
    "id_chantier": 1,
    "circuits": [{"type":"P","longueur":15,"nb_points":3,"logement":"Lg1","numero_boite":1}],
    "mode_production": "derivation"
  }'

# Générer étiquettes mode machine regroupées par type/section/gaine
curl "http://localhost:3001/api/etiquettes/generer/1?mode_etiquetage=machine&regroupement={%22ordre%22:[%22type%22,%22section%22,%22gaine%22]}"

# Démarrer une session d'impression
curl -X POST http://localhost:3001/api/impression/sessions \
  -H "Content-Type: application/json" \
  -d '{"id_calcul":1,"utilisateur":"Jean","filtre_type":"logement","filtre_valeur":"Lg1","etiquettes":["P-1","L-1"]}'
```

## Maintenance

- Mettre à jour QUICKREF.md pour les commandes récentes
- Ajouter les nouveaux endpoints dans api/endpoints.md
- Mettre à jour les sprints ci-dessus au fur et à mesure de l'avancement