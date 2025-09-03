#!/usr/bin/env bash
set -Eeuo pipefail

# restart_server.sh — безпечний перезапуск OpenAI proxy сервера з простим чатом
# - Зупиняє процес, що слухає порт (за замовчуванням 3010)
# - Запускає сервер у фоні через `node server.js`
# - Записує лог в server.log та PID в server.pid
# - Робить health-check /health
# - Перевіряє статичні файли для простого чату з 24 AI моделями
#
# Використання:
#   ./restart_server.sh               # перезапуск на порту 3010
#   PORT=3011 ./restart_server.sh     # використати порт із оточення
#   ./restart_server.sh -p 3012       # вказати порт прапором
#   ./restart_server.sh -d            # debug режим з детальними логами
#
# Вимоги: lsof, curl, node

PORT="${PORT:-3010}"
LOG_FILE="server.log"
PID_FILE="server.pid"
HEALTH_PATH="/health"
SIMPLE_CHAT_PATH="/simple.html"
MAX_WAIT_KILL=5        # сек
MAX_WAIT_HEALTH=30     # число спроб
HEALTH_DELAY=0.5       # сек між спробами
DEBUG_MODE=false       # детальні логи

usage() {
  echo "Usage: $0 [-p PORT] [-d] [-h]" >&2
  echo "  -p PORT   Використати вказаний порт (за замовчуванням: 3010)" >&2
  echo "  -d        Увімкнути debug режим" >&2
  echo "  -h        Показати цю довідку" >&2
}

while getopts ":p:dh" opt; do
  case "$opt" in
    p) PORT="$OPTARG" ;;
    d) DEBUG_MODE=true ;;
    h) usage; exit 0 ;;
    :) echo "Option -$OPTARG requires an argument" >&2; usage; exit 2 ;;
    \?) echo "Unknown option: -$OPTARG" >&2; usage; exit 2 ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Помилка: необхідна команда '$1' не знайдена" >&2
    echo "Спробуйте встановити її:" >&2
    case "$1" in
      lsof) echo "  brew install lsof  # на macOS" >&2 ;;
      curl) echo "  brew install curl  # на macOS" >&2 ;;
      node) echo "  brew install node  # на macOS або https://nodejs.org" >&2 ;;
    esac
    exit 127
  }
}

require_cmd lsof
require_cmd curl
require_cmd node

debug_log() {
  if [[ "$DEBUG_MODE" == "true" ]]; then
    echo "[DEBUG] $*" >&2
  fi
}

get_listen_pids() {
  # Виводить PID(и), що слухають вказаний порт
  debug_log "Шукаю процеси на порту $PORT"
  lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

kill_pids() {
  local pids=("$@")
  [[ ${#pids[@]} -eq 0 ]] && return 0
  echo "🛑 Зупиняю процес(и) на порту $PORT: ${pids[*]}"
  kill "${pids[@]}" 2>/dev/null || true

  local waited=0
  while [[ $waited -lt $MAX_WAIT_KILL ]]; do
    sleep 1
    waited=$((waited+1))
    local still
    still=$(get_listen_pids)
    if [[ -z "$still" ]]; then
      debug_log "Процеси зупинено за $waited сек"
      break
    fi
    debug_log "Очікування зупинки... ($waited/$MAX_WAIT_KILL)"
  done

  local still
  still=$(get_listen_pids)
  if [[ -n "$still" ]]; then
    echo "⚡ Примусове завершення: $still"
    kill -9 $still 2>/dev/null || true
  fi
}

start_server() {
  echo "🚀 Запускаю сервер на порту $PORT..."
  
  # Перевіряємо наявність server.js
  if [[ ! -f "server.js" ]]; then
    echo "❌ Файл server.js не знайдено в поточній директорії" >&2
    exit 1
  fi
  
  # Перевіряємо наявність public/simple.html
  if [[ ! -f "public/simple.html" ]]; then
    echo "❌ Файл public/simple.html не знайдено - простий чат не працюватиме" >&2
    exit 1
  fi
  
  # Очищуємо старий лог при debug режимі
  if [[ "$DEBUG_MODE" == "true" ]]; then
    > "$LOG_FILE"
    debug_log "Очистив лог файл $LOG_FILE"
  fi
  
  # Запускаємо сервер
  debug_log "Команда: nohup node server.js"
  nohup env PORT="$PORT" node server.js >> "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  echo "✅ Запущено з PID $pid (лог: $LOG_FILE, pid: $PID_FILE)"
}

wait_health() {
  local attempts=$MAX_WAIT_HEALTH
  local health_url="http://127.0.0.1:$PORT$HEALTH_PATH"
  local simple_url="http://127.0.0.1:$PORT$SIMPLE_CHAT_PATH"
  
  echo "🔍 Перевіряю готовність сервера..."
  
  for ((i=1; i<=attempts; i++)); do
    debug_log "Спроба $i/$attempts: перевіряю $health_url"
    
    if curl -fsS --max-time 3 "$health_url" >/dev/null 2>&1; then
      echo "✅ Health OK at $health_url"
      
      # Додаткова перевірка простого чату
      if curl -fsS --max-time 3 "$simple_url" >/dev/null 2>&1; then
        echo "✅ Simple chat OK at $simple_url"
      else
        echo "⚠️  Simple chat недоступний at $simple_url"
      fi
      
      echo ""
      echo "🎉 Сервер готовий!"
      echo "� Простий чат з усіма 24 моделями: http://127.0.0.1:$PORT"
      echo "🤖 Підтримка OpenAI, Microsoft, AI21, Cohere, Meta, Mistral"
      
      return 0
    fi
    
    if ((i % 5 == 0)); then
      echo "⏳ Очікую запуск сервера... ($i/$attempts спроб)"
    fi
    
    sleep "$HEALTH_DELAY"
  done
  
  echo "❌ Сервер не відповідає після $attempts спроб ($health_url)" >&2
  echo "💡 Перевірте логи: tail -f $LOG_FILE" >&2
  return 1
}

main() {
  echo "🔄 Перезапуск сервера (порт $PORT)..."
  
  if [[ "$DEBUG_MODE" == "true" ]]; then
    echo "🐛 Debug режим увімкнено"
  fi

  # 1) Зупинити, якщо є
  # macOS bash 3.x сумісність: немає mapfile/readarray
  pids_str="$(get_listen_pids)"
  if [[ -n "$pids_str" ]]; then
    # Розбити рядок PID-ів у масив
    IFS=$' \t\r\n' read -r -a pids <<< "$pids_str"
    kill_pids "${pids[@]}"
  else
    echo "ℹ️  Немає процесів на порту $PORT"
  fi

  # 2) Старт
  start_server

  # 3) Health-check
  wait_health || {
    echo "❌ Не вдалося запустити сервер" >&2
    
    # Показуємо останні помилки з логу
    if [[ -f "$LOG_FILE" ]]; then
      echo "📋 Останні помилки з логу:"
      tail -n 10 "$LOG_FILE" | grep -E "(error|Error|ERROR)" || echo "Помилок у логах не знайдено"
    fi
    
    return 1
  }

  # 4) Показати останні рядки логу
  if [[ -f "$LOG_FILE" ]]; then
    echo ""
    echo "📋 Останні 5 рядків логу:"
    tail -n 5 "$LOG_FILE" || true
  fi
  
  echo ""
  echo "🎯 Швидкий тест з усіма моделями:"
  echo "curl -X POST http://127.0.0.1:$PORT/v1/chat/completions -H 'Content-Type: application/json' -d '{\"messages\":[{\"role\":\"user\",\"content\":\"Тест простого чату з 24 моделями!\"}], \"model\":\"gpt-4o-mini\"}'"
}

main "$@"
