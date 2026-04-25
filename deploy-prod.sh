#!/bin/bash
# ====================================================================
# PIEUVRE AUTO - Script Déploiement Production
# ====================================================================

set -e

echo "═══════════════════════════════════════════════"
echo "🚀 Déploiement Production - Pieuvre Auto"
echo "═══════════════════════════════════════════════"

# Vérifier .env
if [ ! -f .env ]; then
    echo "⚠️ Fichier .env manquant, copie de .env.production.example"
    cp .env.production.example .env
    echo "⚠️ Veuillez modifier .env avec vos mots de passe"
    exit 1
fi

# Charger les variables
source .env

# Build des images
echo "📦 Build des images..."
docker-compose -f docker-compose.production.yml build

# Démarrage
echo "▶ Démarrage des services..."
docker-compose -f docker-compose.production.yml up -d

# Attendre que la DB soit prête
echo "⏳ Attente de PostgreSQL..."
sleep 5

# Vérifications
echo "🔍 Vérifications..."

# Check API
if curl -s http://localhost:${API_PORT:-3001}/health > /dev/null; then
    echo "  ✓ API OK"
else
    echo "  ✕ API Erreur"
fi

# Check Frontend
if curl -s http://localhost:${WEB_PORT:-3000} > /dev/null; then
    echo "  ✓ Frontend OK"
else
    echo "  ✕ Frontend Erreur"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "🎉 Déploiement terminé!"
echo "═══════════════════════════════════════════════"
echo "Frontend: http://localhost:${WEB_PORT:-3000}"
echo "API:      http://localhost:${API_PORT:-3001}"
echo "Health:   http://localhost:${API_PORT:-3001}/health"
echo ""
echo "Commandes utiles:"
echo "  docker-compose logs -f       # Voir les logs"
echo "  docker-compose down          # Arrêter"
echo "  docker-compose restart       # Redémarrer"
echo "═══════════════════════════════════════════════"