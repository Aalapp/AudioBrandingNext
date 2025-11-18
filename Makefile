.PHONY: help migrate migrate-deploy seed reset up down restart clean

help:
	@echo "Available commands:"
	@echo "  make migrate       - Run database migrations (dev mode)"
	@echo "  make migrate-deploy - Deploy migrations (production mode)"
	@echo "  make seed          - Seed database with test data"
	@echo "  make reset         - Reset database (WARNING: deletes all data)"
	@echo "  make up            - Start all services (docker-compose)"
	@echo "  make down          - Stop all services"
	@echo "  make restart       - Restart all services"
	@echo "  make clean         - Remove all volumes and containers"

migrate:
	npm run db:migrate

migrate-deploy:
	npm run db:migrate:deploy

seed:
	npm run db:seed

reset:
	npm run db:reset

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose down && docker-compose up -d

clean:
	docker-compose down -v

