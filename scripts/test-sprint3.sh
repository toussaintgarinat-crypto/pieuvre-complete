#!/usr/bin/env bash
# ====================================================================
# SCRIPT DE TEST - Sprint 3 : Mémoire client / dossier
# Nécessite Docker Compose démarré avec ./start.sh
# ====================================================================

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
CLIENT_ID="${CLIENT_ID:-5}"   # DEMO - Mémoire OCR
CHANTIER_ID="${CHANTIER_ID:-5}" # Démo Mémoire - Appartement T3

echo "════════════════════════════════════════════════════════════"
echo "🧪 Tests Sprint 3 - Mémoire client / dossier"
echo "API: $API_URL"
echo "════════════════════════════════════════════════════════════"

# ------------------------------------------------------------------
# 1. Healthcheck
# ------------------------------------------------------------------
echo ""
echo "1️⃣  Healthcheck API"
if curl -fsS "$API_URL/health" >/dev/null 2>&1; then
  echo "   ✅ API accessible"
else
  echo "   ❌ API inaccessible sur $API_URL"
  echo "   💡 Lancez ./start.sh puis réessayez."
  exit 1
fi

# ------------------------------------------------------------------
# 2. Migration appliquée (vérifie les colonnes)
# ------------------------------------------------------------------
echo ""
echo "2️⃣  Vérification migration 003"
MIGRATION_OK=$(docker exec -i pieuvre-db psql -U pieuvre_user -d pieuvre_db -tAc "
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_name IN ('clients', 'chantiers')
    AND column_name IN ('preferences_etiquettes', 'memoire_ocr_active')
" 2>/dev/null || echo "0")

if [ "$MIGRATION_OK" = "4" ]; then
  echo "   ✅ Colonnes preferences_etiquettes / memoire_ocr_active présentes"
else
  echo "   ⚠️  Migration non détectée ou incomplète ($MIGRATION_OK/4 colonnes)"
  echo "   🚀 Application de la migration..."
  docker exec -i pieuvre-db psql -U pieuvre_user -d pieuvre_db < pieuvre-database/migrations/003_add_memoire_client_dossier.sql
fi

# ------------------------------------------------------------------
# 3. Client démo avec mémoire active
# ------------------------------------------------------------------
echo ""
echo "3️⃣  Vérification client démo (id=$CLIENT_ID)"
CLIENT_MEMOIRE=$(curl -fsS "$API_URL/api/clients/$CLIENT_ID/preferences" | jq -r '.data.memoire_ocr_active' 2>/dev/null || echo "false")
if [ "$CLIENT_MEMOIRE" = "true" ]; then
  echo "   ✅ Mémoire OCR active sur le client démo"
else
  echo "   ⚠️  Mémoire OCR inactive sur le client démo"
fi

# ------------------------------------------------------------------
# 4. Mapping P16 -> P pour le client démo
# ------------------------------------------------------------------
echo ""
echo "4️⃣  Vérification mapping P16 -> P (client)"
MAPPING_P16=$(curl -fsS "$API_URL/api/ocr-mappings?id_client=$CLIENT_ID" | jq -r '.data[] | select(.ocr_code_symbol == "P16") | .circuit_type_code' 2>/dev/null || true)
if [ "$MAPPING_P16" = "P" ]; then
  echo "   ✅ Mapping P16 -> P trouvé"
else
  echo "   ❌ Mapping P16 -> P non trouvé"
fi

# ------------------------------------------------------------------
# 5. Héritage chantier > client > global
# ------------------------------------------------------------------
echo ""
echo "5️⃣  Test héritage chantier > client > global"
# Créer un mapping chantier P16 -> P15 (override client)
CHANTIER_MAP=$(curl -fsS -X POST "$API_URL/api/ocr-mappings" \
  -H "Content-Type: application/json" \
  -d "{\"id_chantier\": $CHANTIER_ID, \"ocr_type_element\": \"prise\", \"ocr_code_symbol\": \"P16\", \"circuit_type_code\": \"P15\", \"priority\": 120}" 2>/dev/null || true)

echo "   Création mapping chantier P16 -> P15: $(echo "$CHANTIER_MAP" | jq -r '.success' 2>/dev/null || echo 'erreur')"

# Vérifier que le chantier l'emporte
RESOLU=$(curl -fsS -X POST "$API_URL/api/ocr-mappings/preview" \
  -H "Content-Type: application/json" \
  -d "{\"devices\":[{\"type_element\":\"prise\",\"code_symbol\":\"P16\"}],\"context\":{\"id_client\":$CLIENT_ID,\"id_chantier\":$CHANTIER_ID}}" | jq -r '.data.type_resolu' 2>/dev/null || echo "")

if [ "$RESOLU" = "P15" ]; then
  echo "   ✅ Héritage chantier respecté (P16 -> P15)"
else
  echo "   ❌ Héritage non respecté (attendu P15, obtenu ${RESOLU:-vide})"
fi

# Nettoyage du mapping chantier de test
CHANTIER_MAP_ID=$(echo "$CHANTIER_MAP" | jq -r '.data.id' 2>/dev/null || true)
if [ -n "$CHANTIER_MAP_ID" ] && [ "$CHANTIER_MAP_ID" != "null" ]; then
  curl -fsS -X DELETE "$API_URL/api/ocr-mappings/$CHANTIER_MAP_ID" >/dev/null 2>&1 || true
  echo "   🧹 Mapping chantier de test supprimé"
fi

# ------------------------------------------------------------------
# 6. Duplication client -> chantier
# ------------------------------------------------------------------
echo ""
echo "6️⃣  Test duplication mappings client -> chantier"
DUPLI=$(curl -fsS -X POST "$API_URL/api/ocr-mappings/duplicate" \
  -H "Content-Type: application/json" \
  -d "{\"id_client\": $CLIENT_ID, \"id_chantier\": $CHANTIER_ID}" 2>/dev/null || true)

echo "   $(echo "$DUPLI" | jq -r '.message' 2>/dev/null || echo 'erreur')"

# ------------------------------------------------------------------
# 7. Scan OCR mock
# ------------------------------------------------------------------
echo ""
echo "7️⃣  Test scan OCR en mode mock"
# Trouver un plan de test
PLAN=$(find plans-test -type f \( -name '*.jpg' -o -name '*.png' -o -name '*.pdf' \) | head -n 1 || true)
if [ -z "$PLAN" ]; then
  echo "   ⚠️  Aucun plan image/PDF trouvé dans plans-test/"
else
  SCAN=$(curl -fsS -X POST "$API_URL/api/scans/upload" \
    -F "fichier=@$PLAN" \
    -F "id_client=$CLIENT_ID" \
    -F "id_chantier=$CHANTIER_ID" 2>/dev/null || true)
  SCAN_ID=$(echo "$SCAN" | jq -r '.data.id' 2>/dev/null || true)
  if [ -n "$SCAN_ID" ] && [ "$SCAN_ID" != "null" ]; then
    echo "   ✅ Scan uploadé (id=$SCAN_ID)"
    # Forcer le mode mock via la variable d'environnement côté API si configuré
    CALC=$(curl -fsS -X POST "$API_URL/api/scans/$SCAN_ID/calculer" \
      -H "Content-Type: application/json" \
      -d "{\"id_chantier\": $CHANTIER_ID}" 2>/dev/null || true)
    NB_CIRCUITS=$(echo "$CALC" | jq -r '.data.nb_circuits' 2>/dev/null || echo "")
    if [ -n "$NB_CIRCUITS" ]; then
      echo "   ✅ Calcul depuis scan effectué ($NB_CIRCUITS circuits)"
    else
      echo "   ⚠️  Calcul depuis scan sans résultat (vérifiez VISION_MOCK_MODE)"
    fi
  else
    echo "   ❌ Échec upload scan"
  fi
fi

# ------------------------------------------------------------------
# 8. Génération PDF étiquettes
# ------------------------------------------------------------------
echo ""
echo "8️⃣  Test génération PDF étiquettes avec préférences client/chantier"
CALCULS=$(curl -fsS "$API_URL/api/calculs" 2>/dev/null || true)
CALCUL_ID=$(echo "$CALCULS" | jq -r ".data[] | select(.id_chantier == $CHANTIER_ID) | .id" 2>/dev/null | head -n 1 || true)
if [ -n "$CALCUL_ID" ] && [ "$CALCUL_ID" != "null" ]; then
  HTTP_STATUS=$(curl -fsS -o /tmp/etiquettes-test.pdf -w "%{http_code}" "$API_URL/api/etiquettes/generer/$CALCUL_ID" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ PDF étiquettes généré (/tmp/etiquettes-test.pdf)"
  else
    echo "   ❌ Échec génération PDF (status $HTTP_STATUS)"
  fi
else
  echo "   ⚠️  Aucun calcul existant pour le chantier $CHANTIER_ID"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🏁 Fin des tests Sprint 3"
echo "════════════════════════════════════════════════════════════"
