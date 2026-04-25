#!/bin/bash
# Démarre Pieuvre Auto (nécessite Docker Desktop)

echo "Démarrage de Pieuvre Auto..."

# Vérifier que Docker est disponible
if ! command -v docker &> /dev/null; then
    echo "ERREUR: Docker n'est pas installé."
    echo "Installez Docker Desktop sur https://www.docker.com/products/docker-desktop/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "ERREUR: Docker n'est pas démarré. Ouvrez Docker Desktop et réessayez."
    exit 1
fi

# Aller dans le dossier du script (utile si lancé depuis un autre dossier)
cd "$(dirname "$0")"

# Construire et démarrer
docker compose up -d --build

echo ""
echo "Pieuvre Auto est démarré !"
echo "Ouvrez votre navigateur sur : http://localhost"
echo ""
echo "Pour arrêter : ./stop.sh"
