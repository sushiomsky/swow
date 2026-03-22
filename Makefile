SHELL := /bin/bash

.PHONY: setup up down restart logs ps pull agent-list agent-quality agent-smoke agent-performance agent-ux agent-design agent-ops agent-release

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

agent-list:
	bash scripts/agents/run-agent.sh list

agent-quality:
	bash scripts/agents/run-agent.sh quality

agent-smoke:
	bash scripts/agents/run-agent.sh smoke

agent-performance:
	bash scripts/agents/run-agent.sh performance

agent-ux:
	bash scripts/agents/run-agent.sh ux

agent-design:
	bash scripts/agents/run-agent.sh design

agent-ops:
	bash scripts/agents/run-agent.sh ops

agent-release:
	bash scripts/agents/run-agent.sh release
