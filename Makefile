# Makefile for AI Chat Server
# Підтримує запуск простого чату з 24 AI моделями з будь-якої папки
#
# Використання:
#   make chat          # запустити чат на порту 3010
#   make chat PORT=3011 # запустити на іншому порту  
#   make stop          # зупинити сервер
#   make restart       # перезапустити сервер
#   make status        # перевірити статус
#   make logs          # показати логи
#   make test          # швидкий тест API
#   make install       # встановити глобально

# Змінні
SCRIPT_DIR := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
PORT ?= 3010
LOG_FILE = $(SCRIPT_DIR)/server.log
PID_FILE = $(SCRIPT_DIR)/server.pid
HEALTH_PATH = /health
SIMPLE_CHAT_PATH = /simple.html
MAX_WAIT_KILL = 5
MAX_WAIT_HEALTH = 30
HEALTH_DELAY = 0.5

# Кольори для виводу
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
BLUE = \033[0;34m
NC = \033[0m # No Color

.PHONY: chat stop restart status logs test models install clean help

# Основна команда - запустити чат
chat: require-deps
	@echo "$(BLUE)🔄 Запуск AI чату на порту $(PORT)...$(NC)"
	@$(MAKE) -s stop-if-running
	@$(MAKE) -s start-server
	@$(MAKE) -s wait-health

# Зупинити сервер
stop: stop-if-running
	@echo "$(GREEN)✅ Сервер зупинено$(NC)"

# Перезапустити сервер
restart: stop chat

# Перевірити статус сервера
status:
	@echo "$(BLUE)📊 Статус сервера на порту $(PORT):$(NC)"
	@if lsof -i :$(PORT) >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Сервер працює$(NC)"; \
		if [ -f "$(PID_FILE)" ]; then \
			echo "📋 PID: $$(cat $(PID_FILE))"; \
		fi; \
		if curl -fsS --max-time 3 "http://127.0.0.1:$(PORT)$(HEALTH_PATH)" >/dev/null 2>&1; then \
			echo "$(GREEN)✅ Health check OK$(NC)"; \
		else \
			echo "$(YELLOW)⚠️  Health check failed$(NC)"; \
		fi; \
	else \
		echo "$(RED)❌ Сервер не працює$(NC)"; \
	fi

# Показати логи
logs:
	@if [ -f "$(LOG_FILE)" ]; then \
		echo "$(BLUE)📋 Останні 20 рядків логу:$(NC)"; \
		tail -n 20 "$(LOG_FILE)"; \
	else \
		echo "$(YELLOW)⚠️  Лог файл не знайдено: $(LOG_FILE)$(NC)"; \
	fi

# Швидкий тест API
test:
	@echo "$(BLUE)🧪 Тестування API...$(NC)"
	@curl -X POST "http://127.0.0.1:$(PORT)/v1/chat/completions" \
		-H 'Content-Type: application/json' \
		-d '{"messages":[{"role":"user","content":"Привіт! Тест чату з усіма моделями."}], "model":"gpt-4o-mini"}' \
		-w "\n$(GREEN)✅ Тест успішний!$(NC)\n" || \
		echo "$(RED)❌ Тест не вдався$(NC)"

# Показати список доступних моделей
models:
	@echo "$(BLUE)🤖 Список доступних AI моделей:$(NC)"
	@curl -s -X GET "http://127.0.0.1:$(PORT)/v1/models" \
		-H "Authorization: Bearer sk-test" | \
		python3 -c "import json,sys; data=json.load(sys.stdin); [print(f\"  {m['owned_by'].upper()}: {m['id']}\") for m in data['data']]" 2>/dev/null || \
		echo "$(YELLOW)⚠️  Не вдалося отримати список моделей. Чи запущений сервер?$(NC)"

# Встановити глобально
install:
	@echo "$(BLUE)🔧 Встановлення глобального доступу...$(NC)"
	@if [ ! -d "/usr/local/bin" ]; then \
		echo "$(RED)❌ /usr/local/bin не існує$(NC)"; \
		exit 1; \
	fi
	@echo '#!/usr/bin/env bash' > /tmp/aichat
	@echo 'cd "$(SCRIPT_DIR)" && make chat "$$@"' >> /tmp/aichat
	@chmod +x /tmp/aichat
	@sudo mv /tmp/aichat /usr/local/bin/aichat
	@echo "$(GREEN)✅ Встановлено! Тепер можна використовувати команду 'aichat' з будь-якої папки$(NC)"
	@echo "$(BLUE)💡 Приклади:$(NC)"
	@echo "  aichat            # запустити на порту 3010"
	@echo "  aichat PORT=3011  # запустити на порту 3011"

# Очистити тимчасові файли
clean:
	@echo "$(BLUE)🧹 Очищення тимчасових файлів...$(NC)"
	@rm -f "$(LOG_FILE)" "$(PID_FILE)"
	@echo "$(GREEN)✅ Очищено$(NC)"

# Показати довідку
help:
	@echo "$(BLUE)🤖 AI Chat Server - Простий чат з 24 AI моделями$(NC)"
	@echo ""
	@echo "$(YELLOW)Доступні команди:$(NC)"
	@echo "  make chat          Запустити чат сервер (за замовчуванням порт 3010)"
	@echo "  make chat PORT=N   Запустити на вказаному порту"
	@echo "  make stop          Зупинити сервер"
	@echo "  make restart       Перезапустити сервер"
	@echo "  make status        Перевірити статус сервера"
	@echo "  make logs          Показати логи сервера"
	@echo "  make test          Швидкий тест API"
	@echo "  make models        Показати список доступних AI моделей"
	@echo "  make install       Встановити глобально (команда 'aichat')"
	@echo "  make clean         Очистити тимчасові файли"
	@echo "  make help          Показати цю довідку"
	@echo ""
	@echo "$(YELLOW)Підтримувані моделі:$(NC)"
	@echo "  🤖 OpenAI: gpt-4o, gpt-4o-mini"
	@echo "  🏢 Microsoft: phi-3-mini-4k, phi-3-medium-4k"
	@echo "  📚 AI21: jamba-instruct"
	@echo "  🔄 Cohere: command-r, command-r-plus"
	@echo "  🦙 Meta: llama-3.1-405b, llama-3.1-70b, llama-3.1-8b"
	@echo "  🌟 Mistral: mistral-large, mistral-nemo, mistral-small"
	@echo ""
	@echo "$(GREEN)🌐 Веб інтерфейс: http://127.0.0.1:$(PORT)$(NC)"

# Внутрішні команди
require-deps:
	@command -v lsof >/dev/null 2>&1 || { echo "$(RED)❌ lsof не знайдено$(NC)"; exit 1; }
	@command -v curl >/dev/null 2>&1 || { echo "$(RED)❌ curl не знайдено$(NC)"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "$(RED)❌ node не знайдено$(NC)"; exit 1; }
	@if [ ! -f "$(SCRIPT_DIR)/server.js" ]; then \
		echo "$(RED)❌ server.js не знайдено в $(SCRIPT_DIR)$(NC)"; \
		exit 1; \
	fi
	@if [ ! -f "$(SCRIPT_DIR)/public/simple.html" ]; then \
		echo "$(RED)❌ public/simple.html не знайдено$(NC)"; \
		exit 1; \
	fi

stop-if-running:
	@pids=$$(lsof -t -nP -iTCP:$(PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "$(YELLOW)🛑 Зупиняю процес(и) на порту $(PORT): $$pids$(NC)"; \
		kill $$pids 2>/dev/null || true; \
		waited=0; \
		while [ $$waited -lt $(MAX_WAIT_KILL) ]; do \
			sleep 1; \
			waited=$$((waited+1)); \
			still=$$(lsof -t -nP -iTCP:$(PORT) -sTCP:LISTEN 2>/dev/null || true); \
			if [ -z "$$still" ]; then \
				break; \
			fi; \
		done; \
		still=$$(lsof -t -nP -iTCP:$(PORT) -sTCP:LISTEN 2>/dev/null || true); \
		if [ -n "$$still" ]; then \
			echo "$(YELLOW)⚡ Примусове завершення: $$still$(NC)"; \
			kill -9 $$still 2>/dev/null || true; \
		fi; \
	fi

start-server:
	@echo "$(BLUE)🚀 Запускаю сервер на порту $(PORT)...$(NC)"
	@cd "$(SCRIPT_DIR)" && nohup env PORT="$(PORT)" node server.js >> "$(LOG_FILE)" 2>&1 & echo $$! > "$(PID_FILE)"
	@if [ -f "$(PID_FILE)" ]; then \
		echo "$(GREEN)✅ Запущено з PID $$(cat $(PID_FILE))$(NC)"; \
	fi

wait-health:
	@echo "$(BLUE)🔍 Перевіряю готовність сервера...$(NC)"
	@attempts=$(MAX_WAIT_HEALTH); \
	health_url="http://127.0.0.1:$(PORT)$(HEALTH_PATH)"; \
	simple_url="http://127.0.0.1:$(PORT)$(SIMPLE_CHAT_PATH)"; \
	for i in $$(seq 1 $$attempts); do \
		if curl -fsS --max-time 3 "$$health_url" >/dev/null 2>&1; then \
			echo "$(GREEN)✅ Health OK$(NC)"; \
			if curl -fsS --max-time 3 "$$simple_url" >/dev/null 2>&1; then \
				echo "$(GREEN)✅ Simple chat OK$(NC)"; \
			fi; \
			echo ""; \
			echo "$(GREEN)🎉 Сервер готовий!$(NC)"; \
			echo "$(BLUE)🌐 Простий чат з усіма 24 моделями: http://127.0.0.1:$(PORT)$(NC)"; \
			echo "$(BLUE)🤖 Підтримка OpenAI, Microsoft, AI21, Cohere, Meta, Mistral$(NC)"; \
			exit 0; \
		fi; \
		if [ $$((i % 5)) -eq 0 ]; then \
			echo "$(YELLOW)⏳ Очікую запуск сервера... ($$i/$$attempts спроб)$(NC)"; \
		fi; \
		sleep $(HEALTH_DELAY); \
	done; \
	echo "$(RED)❌ Сервер не відповідає після $$attempts спроб$(NC)"; \
	echo "$(BLUE)💡 Перевірте логи: make logs$(NC)"; \
	exit 1

# За замовчуванням показати довідку
.DEFAULT_GOAL := help
