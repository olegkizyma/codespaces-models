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

.PHONY: chat stop restart status logs test models install clean help openai models-json models-count install-openai install-all install-stop

# Основна команда - запустити чат
chat: require-deps
	@echo "$(BLUE)🔄 Запуск AI чату на порту $(PORT)...$(NC)"
	@$(MAKE) -s stop-if-running
	@$(MAKE) -s start-server
	@$(MAKE) -s wait-health

# Строгий OpenAI API режим (без TTS та веб-інтерфейсу)
openai: require-deps
	@echo "$(BLUE)🔄 Запуск строгого OpenAI API на порту $(PORT)...$(NC)"
	@$(MAKE) -s stop-all-services
	@$(MAKE) -s start-openai-server
	@$(MAKE) -s wait-health

# Зупинити сервер
stop: stop-if-running
	@echo "$(GREEN)✅ Сервер зупинено$(NC)"

# Перезапустити сервер
restart: stop chat

# Перезапустити з TTS та ngrok (інтерактивно)
restart-tts: stop
	@echo "$(BLUE)🔄 Запуск AI чату з TTS проксируванням...$(NC)"
	@$(MAKE) -s start-tts-server
	@$(MAKE) -s wait-tts-ready
	@echo ""
	@echo "$(GREEN)🎉 Сервер готовий з TTS підтримкою!$(NC)"
	@echo "$(BLUE)🌐 Простий чат з усіма 24 моделями: http://127.0.0.1:$(PORT)$(NC)"
	@echo "$(BLUE)🤖 Підтримка OpenAI, Microsoft, AI21, Cohere, Meta, Mistral$(NC)"
	@echo "$(BLUE)🔊 TTS доступний: http://127.0.0.1:$(PORT)/tts?text=привіт$(NC)"
	@echo ""
	@echo "$(YELLOW)🚀 Запуск ngrok для публічного доступу...$(NC)"
	@$(MAKE) -s start-ngrok-interactive

start-tts-server:
	@echo "$(BLUE)🚀 Запускаю сервер з TTS проксируванням на порту $(PORT)...$(NC)"
	@cd "$(SCRIPT_DIR)" && nohup env PORT="$(PORT)" ENABLE_TTS_PROXY=true TTS_PROXY_TARGET="http://127.0.0.1:8080" node server.js >> "$(LOG_FILE)" 2>&1 & echo $$! > "$(PID_FILE)"
	@echo "$(GREEN)✅ Запущено з PID $$(cat $(PID_FILE))$(NC)"

wait-tts-ready:
	@echo "$(BLUE)🔍 Перевіряю готовність сервера з TTS...$(NC)"
	@for i in $$(seq 1 30); do \
		if curl -fsS --max-time 3 "http://127.0.0.1:$(PORT)$(HEALTH_PATH)" >/dev/null 2>&1; then \
			echo "$(GREEN)✅ Health OK$(NC)"; \
			if curl -fsS --max-time 3 "http://127.0.0.1:$(PORT)/simple.html" >/dev/null 2>&1; then \
				echo "$(GREEN)✅ Simple chat OK$(NC)"; \
			fi; \
			if curl -fsS --max-time 3 "http://127.0.0.1:$(PORT)/tts" >/dev/null 2>&1; then \
				echo "$(GREEN)✅ TTS proxy OK$(NC)"; \
			else \
				echo "$(YELLOW)⚠️  TTS proxy недоступний (контейнер не запущений?)$(NC)"; \
			fi; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "$(RED)❌ Сервер не відповідає після 30 секунд$(NC)"; \
	exit 1

start-ngrok-interactive:
	@echo "$(BLUE)🌐 Запуск ngrok тунелю для порту $(PORT)...$(NC)"
	@pkill -f "ngrok http" 2>/dev/null || true
	@sleep 2
	@echo "$(BLUE)🚀 Створюю тунель ngrok...$(NC)"
	@cd "$(SCRIPT_DIR)" && nohup ngrok http $(PORT) --log=stdout > ngrok.log 2>&1 & echo $$! > ngrok.pid
	@sleep 4
	@if curl -s http://127.0.0.1:4040/api/tunnels > /dev/null 2>&1; then \
		url=$$(curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import json,sys; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url']) if data['tunnels'] else print('')" 2>/dev/null); \
		if [ -n "$$url" ]; then \
			echo "$(GREEN)✅ Ngrok запущено!$(NC)"; \
			echo "$(BLUE)🌐 Публічний URL: $$url$(NC)"; \
			echo "$(BLUE)🔗 API: $$url/v1/chat/completions$(NC)"; \
			echo "$(BLUE)🔊 TTS: $$url/tts?text=привіт$(NC)"; \
		fi; \
	fi
	@echo ""
	@echo "$(GREEN)🔍 Переходжу в режим моніторингу запитів (Ctrl+C для виходу):$(NC)"
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo ""
	@trap 'echo "$(YELLOW)🛑 Завершую моніторинг...$(NC)"; exit 0' INT; \
	if [ -f "$(LOG_FILE)" ]; then \
		tail -f "$(LOG_FILE)"; \
	else \
		echo "$(YELLOW)⏳ Очікую створення логу server.log...$(NC)"; \
		while [ ! -f "$(LOG_FILE)" ]; do sleep 1; done; \
		tail -f "$(LOG_FILE)"; \
	fi

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

# Показати моделі у JSON форматі
models-json:
	@echo "$(BLUE)🤖 Список моделей (JSON):$(NC)"
	@curl -s -X GET "http://127.0.0.1:$(PORT)/v1/models" \
		-H "Authorization: Bearer dummy-key" | \
		python3 -m json.tool || \
		echo "$(YELLOW)⚠️  Не вдалося отримати список моделей. Чи запущений сервер?$(NC)"

# Підрахувати кількість доступних моделей
models-count:
	@echo "$(BLUE)🤖 Кількість доступних моделей:$(NC)"
	@count=$$(curl -s -X GET "http://127.0.0.1:$(PORT)/v1/models" \
		-H "Authorization: Bearer dummy-key" | \
		python3 -c "import json,sys; data=json.load(sys.stdin); print(len(data['data']))" 2>/dev/null); \
	if [ -n "$$count" ]; then \
		echo "$(GREEN)✅ Загалом доступно: $$count моделей$(NC)"; \
		curl -s -X GET "http://127.0.0.1:$(PORT)/v1/models" \
			-H "Authorization: Bearer dummy-key" | \
			python3 -c "import json,sys; data=json.load(sys.stdin); providers={}; [providers.update({m['owned_by']: providers.get(m['owned_by'], 0) + 1}) for m in data['data']]; [print(f\"  📊 {p.upper()}: {c} моделей\") for p,c in sorted(providers.items())]" 2>/dev/null; \
	else \
		echo "$(YELLOW)⚠️  Не вдалося отримати список моделей. Чи запущений сервер?$(NC)"; \
	fi

# Встановити глобально
install:
	@echo "$(BLUE)🔧 Встановлення глобального доступу...$(NC)"
	@if [ ! -d "/usr/local/bin" ]; then \
		echo "$(RED)❌ /usr/local/bin не існує$(NC)"; \
		exit 1; \
	fi
	@echo '#!/usr/bin/env bash' > /tmp/aichat
	@echo 'cd "$(SCRIPT_DIR)" && make chat "$$@"' | sed "s|$(SCRIPT_DIR)|$(SCRIPT_DIR)|" >> /tmp/aichat
	@chmod +x /tmp/aichat
	@sudo mv /tmp/aichat /usr/local/bin/aichat
	@echo "$(GREEN)✅ Встановлено! Тепер можна використовувати команду 'aichat' з будь-якої папки$(NC)"

# Встановити глобальну команду для строгого OpenAI API
install-openai:
	@echo "$(BLUE)🔧 Встановлення глобального OpenAI API доступу...$(NC)"
	@if [ ! -d "/usr/local/bin" ]; then \
		echo "$(RED)❌ /usr/local/bin не існує$(NC)"; \
		exit 1; \
	fi
	@echo '#!/usr/bin/env bash' > /tmp/ai-openai
	@echo 'cd "$(SCRIPT_DIR)" && make openai "$$@"' | sed "s|$(SCRIPT_DIR)|$(SCRIPT_DIR)|" >> /tmp/ai-openai
	@chmod +x /tmp/ai-openai
	@sudo mv /tmp/ai-openai /usr/local/bin/ai-openai
	@echo "$(GREEN)✅ Встановлено! Тепер можна використовувати команду 'ai-openai' з будь-якої папки$(NC)"
	@echo "$(BLUE)📋 Використання: ai-openai$(NC)"
	@echo "$(BLUE)🌐 Запустить строгий OpenAI API на http://127.0.0.1:$(PORT)$(NC)"

# Встановити глобальну команду для зупинення сервера
install-stop:
	@echo "$(BLUE)🔧 Встановлення глобальної команди зупинення...$(NC)"
	@if [ ! -d "/usr/local/bin" ]; then \
		echo "$(RED)❌ /usr/local/bin не існує$(NC)"; \
		exit 1; \
	fi
	@echo '#!/usr/bin/env bash' > /tmp/ai-stop
	@echo 'cd "$(SCRIPT_DIR)" && make stop "$$@"' | sed "s|$(SCRIPT_DIR)|$(SCRIPT_DIR)|" >> /tmp/ai-stop
	@chmod +x /tmp/ai-stop
	@sudo mv /tmp/ai-stop /usr/local/bin/ai-stop
	@echo "$(GREEN)✅ Встановлено! Тепер можна використовувати команду 'ai-stop' з будь-якої папки$(NC)"

# Встановити всі глобальні команди
install-all: install install-openai install-stop
	@echo "$(GREEN)✅ Усі команди встановлено:$(NC)"
	@echo "  $(BLUE)🎨 aichat$(NC) - повний чат з TTS та веб-інтерфейсом"
	@echo "  $(BLUE)🤖 ai-openai$(NC) - строгий OpenAI API без додаткових сервісів"
	@echo "  $(BLUE)🛑 ai-stop$(NC) - зупинення сервера з будь-якої папки"
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
	@echo "  make openai        Строгий OpenAI API (без TTS та веб-інтерфейсу)"
	@echo "  make stop          Зупинити сервер"
	@echo "  make restart       Перезапустити сервер"
	@echo "  make status        Перевірити статус сервера"
	@echo "  make logs          Показати логи сервера"
	@echo "  make test          Швидкий тест API"
	@echo "  make models        Показати список доступних AI моделей"
	@echo "  make models-json   Показати моделі у JSON форматі"
	@echo "  make models-count  Підрахувати кількість моделей за провайдерами"
	@echo "  make install       Встановити 'aichat' глобально"
	@echo "  make install-openai Встановити 'ai-openai' глобально"
	@echo "  make install-all   Встановити обидві глобальні команди"
	@echo "  make clean         Очистити тимчасові файли"
	@echo "  make watchdog      Запустити watchdog автоперезапуск"
	@echo "  make help          Показати цю довідку"
	@echo ""
	@echo "$(YELLOW)Режими роботи:$(NC)"
	@echo "  🌐 chat    - Повнофункціональний з веб-інтерфейсом та TTS"
	@echo "  🤖 openai  - Тільки OpenAI API endpoints (/v1/models, /v1/chat/completions)"
	@echo ""
	@echo "$(YELLOW)Глобальні команди (після install):$(NC)"
	@echo "  aichat       - Запуск повного чату з будь-якої папки"
	@echo "  ai-openai    - Запуск строгого OpenAI API з будь-якої папки"  
	@echo "  ai-stop      - Зупинення сервера з будь-якої папки"
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

# Зупинити всі сервіси (сервер, ngrok, TTS)
stop-all-services:
	@echo "$(YELLOW)🛑 Зупиняю всі сервіси...$(NC)"
	@# Зупиняємо основний сервер
	@$(MAKE) -s stop-if-running
	@# Зупиняємо ngrok
	@ngrok_pids=$$(pgrep -f ngrok 2>/dev/null || true); \
	if [ -n "$$ngrok_pids" ]; then \
		echo "$(YELLOW)🔌 Зупиняю ngrok: $$ngrok_pids$(NC)"; \
		kill $$ngrok_pids 2>/dev/null || true; \
		sleep 2; \
	fi
	@# Зупиняємо TTS сервіс (порт 8080)
	@tts_pids=$$(lsof -t -nP -iTCP:8080 -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$tts_pids" ]; then \
		echo "$(YELLOW)🔊 Зупиняю TTS сервіс: $$tts_pids$(NC)"; \
		kill $$tts_pids 2>/dev/null || true; \
		sleep 2; \
	fi
	@echo "$(GREEN)✅ Всі сервіси зупинено$(NC)"

# Запустити сервер в строгому OpenAI API режимі
start-openai-server:
	@echo "$(BLUE)🚀 Запускаю строгий OpenAI API сервер на порту $(PORT)...$(NC)"
	@cd "$(SCRIPT_DIR)" && nohup env PORT="$(PORT)" STRICT_OPENAI_API=1 ENABLE_TTS_PROXY=0 node server.js >> "$(LOG_FILE)" 2>&1 & echo $$! > "$(PID_FILE)"
	@if [ -f "$(PID_FILE)" ]; then \
		echo "$(GREEN)✅ Запущено з PID $$(cat $(PID_FILE)) (строгий режим)$(NC)"; \
	fi

wait-health:
	@echo "$(BLUE)🔍 Перевіряю готовність сервера...$(NC)"
	@attempts=$(MAX_WAIT_HEALTH); \
	health_url="http://127.0.0.1:$(PORT)$(HEALTH_PATH)"; \
	simple_url="http://127.0.0.1:$(PORT)$(SIMPLE_CHAT_PATH)"; \
	models_url="http://127.0.0.1:$(PORT)/v1/models"; \
	for i in $$(seq 1 $$attempts); do \
		if curl -fsS --max-time 3 "$$health_url" >/dev/null 2>&1; then \
			echo "$(GREEN)✅ Health OK$(NC)"; \
			if curl -fsS --max-time 3 "$$simple_url" >/dev/null 2>&1; then \
				echo "$(GREEN)✅ Simple chat OK$(NC)"; \
				echo ""; \
				echo "$(GREEN)🎉 Сервер готовий!$(NC)"; \
				echo "$(BLUE)🌐 Простий чат з усіма 24 моделями: http://127.0.0.1:$(PORT)$(NC)"; \
			elif curl -fsS --max-time 3 -H "Authorization: Bearer dummy-key" "$$models_url" >/dev/null 2>&1; then \
				echo "$(GREEN)✅ OpenAI API OK$(NC)"; \
				echo ""; \
				echo "$(GREEN)🎉 Строгий OpenAI API сервер готовий!$(NC)"; \
				echo "$(BLUE)🤖 Доступні endpoint'и:$(NC)"; \
				echo "$(BLUE)  • GET  /v1/models$(NC)"; \
				echo "$(BLUE)  • POST /v1/chat/completions$(NC)"; \
				echo "$(BLUE)  • GET  /health$(NC)"; \
				echo "$(YELLOW)⚠️   TTS та веб-інтерфейс відключені$(NC)"; \
			else \
				echo "$(GREEN)✅ Сервер готовий!$(NC)"; \
			fi; \
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

watchdog:
	@echo "$(BLUE)🛡️ Запуск watchdog (автовідновлення)$(NC)"
	@[ -x "$(SCRIPT_DIR)/watchdog.sh" ] || { echo "$(YELLOW)⚠️ watchdog.sh не виконуваний — додаю права$(NC)"; chmod +x "$(SCRIPT_DIR)/watchdog.sh"; }
	@nohup "$(SCRIPT_DIR)/watchdog.sh" >/dev/null 2>&1 & echo "$(GREEN)✅ Watchdog запущено (PID $$!)$(NC)"
