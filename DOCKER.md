# 🐳 Docker - Pieuvre Auto

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## 🚀 Quick Start

```bash
# 1. Cloner le projet et aller dans le dossier
cd pieuvre-complete

# 2. Construction et démarrage
docker-compose up -d

# 3. Vérifier le statut
docker-compose ps

# 4. Accéder à l'API
curl http://localhost:3001/health
```

## 📦 Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Base de données |
| API | 3001 | Backend Node.js |

## 🔧 Commandes

```bash
# Démarrer
make up          # ou docker-compose up -d

# Arrêter
make down        # ou docker-compose down

# Logs
make logs        # ou docker-compose logs -f

# Statut
make ps          # ou docker-compose ps

# Nettoyer (supprime aussi les données)
make clean

# Shell dans le conteneur API
make shell-api

# Shell dans la base de données
make shell-db
```

## 🔐 Identifiants par défaut

| Service | Variable | Valeur |
|---------|----------|--------|
| PostgreSQL DB | POSTGRES_DB | pieuvre_db |
| PostgreSQL User | POSTGRES_USER | pieuvre_user |
| PostgreSQL Password | POSTGRES_PASSWORD | pieuvre_pass |

## 🌐 URLs

- **API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **PostgreSQL**: localhost:5432

## 🔄 Réinitialiser la base

```bash
# Supprimer le volume et recréer
docker-compose down -v
docker-compose up -d
```

## 🔧 Variables d'environnement

Copier `.env.docker` et adapter si besoin :

```bash
cp .env.docker .env
```

## 🛠️ Développement

Pour le développement avec hot-reload :

```bash
# Modifier docker-compose.yml pour ajouter:
# volumes:
#   - ./pieuvre-api:/app
#   - /app/node_modules
```

## ⚠️ Notes

- Le schéma SQL est automatiquement exécuté au premier lancement
- Les données sont persistées dans un volume Docker
- Pour une production, sécuriser les mots de passe