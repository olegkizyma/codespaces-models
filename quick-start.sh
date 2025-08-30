#!/bin/bash

# 🚀 ШВИДКИЙ СТАРТ
# Все що потрібно для початку роботи з OpenAI LLM Proxy

echo "🚀 OpenAI LLM Proxy - Швидкий старт"
echo "=========================================="

# Перевірка Git
if [ ! -d ".git" ]; then
    echo "❌ Помилка: Запустіть скрипт у каталозі проекту"
    exit 1
fi

# Встановлення залежностей
echo "📦 Встановлення залежностей..."
npm install --silent

# Перевірка .env файлу
if [ ! -f ".env" ]; then
    echo "⚙️  Створення .env файлу..."
    if [ ! -f ".env.example" ]; then
        cat > .env << EOF
# GitHub Models API Configuration
GITHUB_TOKEN=your_github_token_here
OPENAI_BASE_URL=https://models.github.ai/inference

# Server Configuration  
PORT=3010
HOST=localhost

# Optional: Enable debug logging
DEBUG=false
EOF
    else
        cp .env.example .env
    fi
    echo "📝 Створено .env файл - додайте ваш GITHUB_TOKEN!"
fi

# Зробити скрипти виконуваними
echo "🔧 Налаштування дозволів..."
chmod +x tools.sh *.mjs 2>/dev/null || true

# Генерація прикладів
echo "📚 Генерація прикладів коду..."
node code-generator.mjs 2>/dev/null || echo "⚠️  Запустіть 'node code-generator.mjs' після налаштування"

echo ""
echo "✅ Швидкий старт завершено!"
echo ""
echo "🔥 НАСТУПНІ КРОКИ:"
echo ""
echo "1️⃣  Додайте GitHub токен у .env файл:"
echo "   GITHUB_TOKEN=ваш_токен_тут"
echo ""
echo "2️⃣  Запустіть сервер:"
echo "   ./tools.sh start"
echo "   # або npm start"
echo ""
echo "3️⃣  Протестуйте моделі:"
echo "   ./tools.sh test"
echo "   # інтерактивне тестування"
echo ""
echo "4️⃣  Бенчмарк продуктивності:"
echo "   ./tools.sh benchmark"
echo ""
echo "📚 Документація:"
echo "   - README.md     # Основна документація" 
echo "   - TOOLS.md      # Інструменти розробки"
echo "   - QUICKSTART.md # Детальна інструкція"
echo ""
echo "🌐 Сервер буде доступний на: http://localhost:3010"
echo "🧪 Веб-інтерфейс: http://localhost:3010/web"
echo ""
echo "💡 Підказка: Використовуйте './tools.sh' для перегляду всіх команд"
