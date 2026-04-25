# ====================================================================
# Makefile - Commandes Docker pour Pieuvre Auto
# ====================================================================

# Couleurs
GREEN = \033[0;32m
YELLOW = \033[0;33m
BLUE = \033[0;34m
NC = \033[0m

.PHONY: help build up down restart logs ps clean

help:
	@echo ""
	@echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
	@echo "${GREEN}  PIEUVRE AUTO - Commandes Docker${NC}"
	@echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
	@echo ""
	@echo "  ${YELLOW}make build${NC}        - Construire les images Docker"
	@echo "  ${YELLOW}make up${NC}           - Démarrer les conteneurs"
	@echo "  ${YELLOW}make down${NC}         - Arrêter les conteneurs"
	@echo "  ${YELLOW}make restart${NC}      - Redémarrer les conteneurs"
	@echo "  ${YELLOW}make logs${NC}         - Voir les logs"
	@echo "  ${YELLOW}make ps${NC}           - Voir le statut des conteneurs"
	@echo "  ${YELLOW}make clean${NC}        - Supprimer les conteneurs et volumes"
	@echo "  ${YELLOW}make init-db${NC}      - Initialiser la base de données"
	@echo "  ${YELLOW}make shell-api${NC}    - Ouvrir un shell dans le conteneur API"
	@echo ""
	@echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
	@echo ""

build:
	@echo "${GREEN}Construction des images Docker...${NC}"
	docker-compose build

up:
	@echo "${GREEN}Démarrage des services...${NC}"
	docker-compose up -d
	@echo ""
	@echo "${GREEN}Services démarrés:${NC}"
	@docker-compose ps

down:
	@echo "${YELLOW}Arrêt des services...${NC}"
	docker-compose down

restart: down up

logs:
	docker-compose logs -f

ps:
	docker-compose ps

clean:
	@echo "${YELLOW}Suppression des conteneurs et volumes...${NC}"
	docker-compose down -v
	@echo "${GREEN}Nettoyage terminé${NC}"

init-db:
	@echo "${GREEN}Initialisation de la base de données...${NC}"
	docker-compose exec -T postgres psql -U pieuvre_user -d pieuvre_db -f /docker-entrypoint-initdb.d/schema.sql

shell-api:
	docker-compose exec api sh

shell-db:
	docker-compose exec postgres psql -U pieuvre_user -d pieuvre_db

health:
	@echo "${GREEN}Vérification de la santé des services...${NC}"
	@curl -s http://localhost:3001/health || echo "${YELLOW}API non accessible${NC}"

# Alias
start: up
stop: down