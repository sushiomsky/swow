SHELL := /bin/bash

.PHONY: setup up down restart logs ps pull

setup:
	@if [ ! -f .env ]; then cp .env.example .env; fi
	@echo "Environment ready. Edit .env if needed."

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose down && docker compose up -d --build

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

pull:
	git pull --rebase && docker compose up -d --build
