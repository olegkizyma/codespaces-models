#!/usr/bin/env bash
# Demo script showing OpenAI API compatibility
# Демонстрація повної сумісності з OpenAI API

echo "🚀 AI Chat OpenAI API Compatibility Demo"
echo "========================================"

SERVER="http://127.0.0.1:3010"
AUTH_HEADER="Authorization: Bearer fake-key"

echo ""
echo "🔌 Перевіряю з'єднання з сервером..."
if ! curl -s "$SERVER/health" > /dev/null; then
    echo "❌ Сервер не відповідає. Запустіть: aichat"
    exit 1
fi
echo "✅ Сервер працює"

echo ""
echo "📋 1. Список доступних моделей (GET /v1/models):"
echo "curl -H '$AUTH_HEADER' $SERVER/v1/models"
echo ""
curl -s -H "$AUTH_HEADER" "$SERVER/v1/models" | python3 -m json.tool --compact | head -3
echo "... (скорочено)"

echo ""
echo ""
echo "💬 2. Звичайний чат (POST /v1/chat/completions):"
cat << 'EOF'
curl -X POST http://127.0.0.1:3010/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-key" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Привіт!"}],
    "temperature": 0.7
  }'
EOF
echo ""
echo "📤 Відповідь сервера:"
curl -s -X POST "$SERVER/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Привіт! Відповідь має бути короткою."}],
    "temperature": 0.7,
    "max_tokens": 50
  }' | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    message = data['choices'][0]['message']['content']
    print(f'💭 Відповідь: {message}')
    print(f'📊 Модель: {data[\"model\"]}')
    print(f'🔢 Токени: {data[\"usage\"][\"total_tokens\"]}')
except:
    print('❌ Помилка парсингу відповіді')
"

echo ""
echo ""
echo "🌊 3. Streaming чат (stream=true):"
cat << 'EOF'
curl -X POST http://127.0.0.1:3010/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Лічи до 5"}],
    "stream": true
  }' --no-buffer
EOF
echo ""
echo "📤 Streaming відповідь:"
curl -s -X POST "$SERVER/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Лічи від 1 до 3"}],
    "stream": true,
    "max_tokens": 30
  }' --no-buffer | head -10

echo ""
echo ""
echo "🤖 4. Тест різних моделей:"

models=("gpt-4o-mini" "Phi-3-mini-4k-instruct" "Meta-Llama-3.1-8B-Instruct")

for model in "${models[@]}"; do
    echo ""
    echo "🔬 Тестую модель: $model"
    curl -s -X POST "$SERVER/v1/chat/completions" \
      -H "Content-Type: application/json" \
      -H "$AUTH_HEADER" \
      -d "{
        \"model\": \"$model\",
        \"messages\": [{\"role\": \"user\", \"content\": \"Привіт! Як справи?\"}],
        \"max_tokens\": 30
      }" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    message = data['choices'][0]['message']['content']
    print(f'   💭 {message[:100]}...')
except Exception as e:
    print(f'   ❌ Помилка: {e}')
"
done

echo ""
echo ""
echo "✅ Демонстрація завершена!"
echo ""
echo "💡 Ваш AI Chat сервер повністю сумісний з OpenAI API!"
echo "🌐 Веб інтерфейс: http://127.0.0.1:3010"
echo "📚 Документація OpenAI: https://platform.openai.com/docs/api-reference"
echo ""
echo "🚀 Швидкі команди:"
echo "   aichat         - запустити сервер"
echo "   aichat models  - показати моделі"  
echo "   aichat test    - швидкий тест"
echo "   aichat stop    - зупинити сервер"
