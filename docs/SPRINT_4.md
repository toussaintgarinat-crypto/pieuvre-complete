# Sprint 4 — Validation Docker et tests end-to-end

## Objectif
Valider en conditions réelles tout le travail du Sprint 3 (mémoire client / dossier) : migration, OCR mock, génération d’étiquettes et héritage des mappings.

## Contexte
Les développements du Sprint 3 sont terminés et testés unitairement, mais n’ont pas pu être validés avec Docker Desktop (non démarré pendant la session).
Ce Sprint 4 regroupe les tests d’intégration et end-to-end nécessaires avant de considérer la mémoire client/dossier comme totalement livrée.

---

## ✅ Résultats des tests

### 1. Infrastructure
- [x] Docker Desktop relancé.
- [x] Conteneurs reconstruits et démarrés via `docker compose up -d --build`.
- [x] API (`http://localhost:3001/health`) et frontend (`http://localhost`) répondent.

### 2. Migration
- [x] Migration `003` appliquée sur la base existante.
- [x] Colonnes `preferences_etiquettes` et `memoire_ocr_active` présentes sur `clients` et `chantiers`.
- [x] Clés étrangères `ON DELETE CASCADE` vérifiées sur `ocr_type_mappings`.
- [x] Migration `002` également appliquée (colonne `mode_production` manquante sur `chantiers`).

### 3. Données initiales
- [x] Client démo `DEMO - Mémoire OCR` créé avec `memoire_ocr_active = true`.
- [x] Chantier démo `Démo Mémoire - Appartement T3` créé.
- [x] Mapping client `P16 → P` présent.

### 4. API Mémoire client / dossier
- [x] `GET /api/ocr-mappings?id_client=5` retourne les mappings effectifs.
- [x] `GET /api/ocr-mappings?id_client=5&id_chantier=5` retourne l’héritage complet.
- [x] Héritage chantier > client > global vérifié via `POST /api/ocr-mappings/preview`.
- [x] Duplication client → chantier testée (`POST /api/ocr-mappings/duplicate`).
- [x] Prévisualisation OCR testée avec contexte client/chantier.

### 5. OCR et calcul depuis un scan
- [x] `VISION_MOCK_MODE=true` et `RAG_MOCK_MODE=true` activés dans `.env.docker`.
- [x] Upload PDF via `POST /api/scans/upload` OK.
- [x] Traitement OCR via `POST /api/scans/process/2` OK (9 éléments, 4 circuits).
- [x] Calcul depuis scan via `POST /api/scans/2/calculer` OK (3 circuits, bon de coupe généré).

### 6. Étiquettes
- [x] Bug corrigé dans `pieuvre-api/routes/etiquettes.js` (variable `prefs` utilisée avant sa déclaration).
- [x] PDF d’étiquettes généré en mode atelier par défaut.
- [x] PDF d’étiquettes généré en mode machine avec regroupement personnalisé.
- [x] Préférences client/chantier appliquées.

### 7. Frontend
- [x] Page `/memoire` accessible et fonctionnelle.
- [x] Sélection client/chantier OK.
- [x] Badges d’origine `GLOBAL` / `CHANTIER` visibles.
- [x] Bouton de duplication et prévisualisation OCR testés via Playwright.
- [x] Screenshot final : `/tmp/memoire-final.png`.

---

## Script de test

Le script `scripts/test-sprint3.sh` automatise la plupart des vérifications. Pour le lancer :

```bash
./scripts/test-sprint3.sh
```

---

## Bugs corrigés durant le Sprint 4

1. **`pieuvre-api/routes/etiquettes.js`** : la variable `prefs` était utilisée avant sa déclaration dans `GET /etiquettes/generer/:calculId`. Déplacement du bloc de récupération de configuration après la résolution des préférences.
2. **Doublons de mappings globaux** : nettoyage de `ocr_type_mappings` pour éviter les lignes en double (probablement dû à des exécutions répétées de `schema.sql`).
3. **Migration `002` manquante** : application nécessaire car la colonne `chantiers.mode_production` était absente.

---

## Critères d’acceptation

- [x] Tous les tests fonctionnels passent.
- [x] L’héritage chantier > client > global est vérifié.
- [x] Le scan OCR mock fonctionne et produit un bon de coupe.
- [x] Le PDF d’étiquettes respecte les préférences client/chantier.
- [x] Aucune erreur 500 bloquante dans les logs API.

---

## Notes

- Le Sprint 3 est désormais validé en conditions réelles et peut être considéré comme clos.
- Les conteneurs Docker sont opérationnels avec `VISION_MOCK_MODE=true` et `RAG_MOCK_MODE=true`.
- Pour revenir à un fonctionnement avec clés API réelles, modifier `.env.docker` et reconstruire les conteneurs.
