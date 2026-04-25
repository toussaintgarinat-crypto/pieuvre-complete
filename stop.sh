#!/bin/bash
cd "$(dirname "$0")"
echo "Arrêt de Pieuvre Auto..."
docker compose down
echo "Arrêté."
