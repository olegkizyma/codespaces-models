# 🎉 Успішне налаштування OpenAI API + TTS з українською локалізацією

## 📋 Загальна інформація

**Дата налаштування:** 3 вересня 2025  
**Статус:** ✅ Повністю працює  
**Підтримувані моделі:** 58 AI моделей від 6 провайдерів  
**TTS підтримка:** ✅ Українські голоси (Наталія, Анатолій)  
**Публічний доступ:** ✅ Ngrok тунелювання  

## 🚀 Швидкий запуск

### Запуск з будь-якої папки
```bash
# Перезапуск з TTS та ngrok
aichat restart

# Альтернативний запуск
cd /Users/dev/Documents/NIMDA/codespaces-models
make restart
```

### Запуск TTS контейнера
```bash
docker run --rm -d -p 8080:8080 --platform linux/amd64 --name tts nagard/tts
```

## 🌐 Доступні URL

### Поточний публічний URL (ngrok)
- **Базовий URL:** `https://6817a4efdf3a.ngrok-free.app` (змінюється при кожному перезапуску)
- **API ендпоінти:** `/v1/*` та `/api/*` (алиаси)
- **TTS ендпоінт:** `/tts`

### Локальні URL
- **API сервер:** `http://127.0.0.1:3010`
- **TTS контейнер:** `http://127.0.0.1:8080`
- **Веб інтерфейс:** `http://127.0.0.1:3010/simple.html`

## 🤖 OpenAI-сумісний API

### Доступні ендпоінти

#### Список моделей
```bash
# Локально
curl http://127.0.0.1:3010/v1/models

# Через ngrok
curl https://ваш-ngrok-url.app/v1/models
curl https://ваш-ngrok-url.app/api/models  # алиас
```

#### Chat Completions
```bash
# Базовий запит
curl -X POST https://ваш-ngrok-url.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role":"user","content":"Привіт!"}],
    "temperature": 0.7,
    "max_tokens": 100
  }'

# Стрімінг
curl -N https://ваш-ngrok-url.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini", 
    "messages": [{"role":"user","content":"Привіт!"}],
    "stream": true
  }'
```

### Підтримувані моделі (58 штук)

#### OpenAI
- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `openai/gpt-5`
- `openai/gpt-5-mini`
- `openai/o1`
- `openai/o1-mini`
- `openai/o3-mini`

#### Microsoft
- `microsoft/phi-3-mini-4k-instruct`
- `microsoft/phi-3-medium-4k-instruct`
- `microsoft/phi-4`
- `microsoft/phi-4-mini-instruct`

#### Meta (Llama)
- `meta/llama-3.3-70b-instruct`
- `meta/meta-llama-3.1-405b-instruct`
- `meta/meta-llama-3.1-8b-instruct`

#### Mistral AI
- `mistral-ai/mistral-large-2411`
- `mistral-ai/mistral-small-2503`
- `mistral-ai/mistral-nemo`

#### AI21 Labs
- `ai21-labs/ai21-jamba-1.5-large`
- `ai21-labs/ai21-jamba-1.5-mini`

#### Cohere
- `cohere/cohere-command-r-08-2024`
- `cohere/cohere-command-r-plus-08-2024`

*[Повний список 58 моделей доступний через /v1/models]*

## 🔊 Українська TTS

### Успішно налаштовано
- ✅ **Контейнер:** `nagard/tts` з платформою `linux/amd64`
- ✅ **Українські голоси:** Наталія (natalia), Анатолій (anatol)
- ✅ **Проксування:** Через `/tts` ендпоінт
- ✅ **URL-кодування:** Підтримка українських символів

### Приклади використання

#### Локальні запити
```bash
# Голос Наталії
curl 'http://127.0.0.1:3010/tts?text=%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82&voice=natalia' \
  --output audio.wav

# Голос Анатолія (за замовчуванням)  
curl 'http://127.0.0.1:3010/tts?text=%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82&voice=anatol' \
  --output audio.wav

# З налаштуваннями гучності
curl 'http://127.0.0.1:3010/tts?text=%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82&voice=natalia&scale=1.5' \
  --output audio.wav
```

#### Через ngrok
```bash
curl 'https://ваш-ngrok-url.app/tts?text=%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82&voice=natalia' \
  --output audio.wav
```

### Параметри TTS

| Параметр | Опис | Приклади |
|----------|------|----------|
| `text` | Текст для озвучки (URL-кодований) | `%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82` |
| `voice` | Голос (натал\|анатол) | `natalia`, `anatol` |
| `scale` | Гучність (0-2+) | `0.5`, `1.0`, `1.5`, `2.0` |
| `name` | Назва файлу | `my_audio`, `ukraine_voice` |

### Кодування українського тексту

**Python приклад:**
```python
import urllib.parse
text = "Привіт! Це українська озвучка."
encoded_text = urllib.parse.quote(text, safe='')
print(f"http://127.0.0.1:3010/tts?text={encoded_text}&voice=natalia")
```

**JavaScript приклад:**
```javascript
const text = "Привіт! Це українська озвучка.";
const encodedText = encodeURIComponent(text);
const url = `http://127.0.0.1:3010/tts?text=${encodedText}&voice=natalia`;
```

## 🛠️ Налаштування та конфігурація

### Змінні оточення
```bash
# Основні
PORT=3010
OPENAI_BASE_URL=https://models.github.ai/inference
GITHUB_TOKEN=ваш_токен

# TTS
ENABLE_TTS_PROXY=true
TTS_PROXY_TARGET=http://127.0.0.1:8080

# Проксі (опціонально)
PROXY_AUTH_MODE=env
PROXY_SERVER_KEY=

# Строгий режим (для API-only)
STRICT_OPENAI_API=false
```

### Docker команди
```bash
# TTS контейнер
docker run --rm -d -p 8080:8080 --platform linux/amd64 --name tts nagard/tts

# Перевірка статусу
docker ps | grep tts
docker logs tts
```

## 🎯 Тестування

### Перевірка працездатності
```bash
# Health check
curl http://127.0.0.1:3010/health

# Список моделей
curl http://127.0.0.1:3010/v1/models | jq '.data | length'

# Тест TTS
curl 'http://127.0.0.1:3010/tts?text=%D1%82%D0%B5%D1%81%D1%82&voice=natalia' \
  --output test.wav && afplay test.wav
```

### Аналіз проблем
```bash
# Логи сервера
tail -f /Users/dev/Documents/NIMDA/codespaces-models/server.log

# Статус портів
lsof -i :3010
lsof -i :8080

# Процеси
ps aux | grep "node server.js"
ps aux | grep ngrok
```

## 📱 Інтеграція з клієнтами

### Open WebUI
- **URL:** `http://host.docker.internal:3010/v1`
- **Key:** Залишити пустим або вказати PROXY_SERVER_KEY
- **Prefix ID:** Вимкнути

### Python OpenAI SDK
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://ваш-ngrok-url.app/v1",
    api_key="dummy-key"  # або PROXY_SERVER_KEY
)

response = client.chat.completions.create(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Привіт!"}]
)
```

### Node.js OpenAI SDK
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'https://ваш-ngrok-url.app/v1',
    apiKey: 'dummy-key'
});

const response = await openai.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [{ role: 'user', content: 'Привіт!' }]
});
```

## 🔧 Команди управління

### Глобальні команди (з будь-якої папки)
```bash
aichat restart    # Перезапуск з TTS та ngrok
aichat stop       # Зупинити сервер  
aichat status     # Перевірити статус
aichat logs       # Показати логи
aichat models     # Список моделей
aichat test       # Тест API
aichat ngrok      # Запустити тільки ngrok
aichat help       # Довідка
```

### Make команди (в папці проекту)
```bash
make restart      # Перезапуск з TTS та ngrok
make chat         # Звичайний запуск
make stop         # Зупинити
make status       # Статус
make logs         # Логи
make clean        # Очистити тимчасові файли
```

## 📊 Статистика

### Підтримувані провайдери
- **OpenAI:** 13 моделей
- **Microsoft:** 10 моделей  
- **Meta:** 5 моделей
- **Mistral AI:** 9 моделей
- **AI21 Labs:** 2 моделі
- **Cohere:** 5 моделей
- **Core42:** 1 модель
- **DeepSeek:** 3 моделі
- **XAI:** 2 моделі

### Функціональність
- ✅ Chat Completions
- ✅ Streaming
- ✅ Embeddings  
- ✅ Models listing
- ✅ Error handling
- ✅ Rate limiting
- ✅ Usage logging
- ✅ TTS проксування
- ✅ Ngrok тунелювання

## 🚨 Важливі зауваги

### Rate Limits
- GitHub Models API: 150 запитів на день на модель
- При досягненні ліміту: `"Rate limit of 150 per 86400s exceeded"`

### Безпека
- Для публічного ngrok рекомендується встановити `PROXY_SERVER_KEY`
- Не публікуйте GITHUB_TOKEN у відкритих репозиторіях

### Платформа
- TTS контейнер вимагає `--platform linux/amd64` на Apple Silicon
- На ARM64 без цього параметра можуть бути "Malformed HTTP request"

## 🎉 Результат

**Повністю робоча система з:**
- 🤖 58 AI моделей через єдиний API  
- 🔊 Українська TTS з 2 голосами
- 🌐 Публічний доступ через ngrok
- 🛡️ Проксування з обробкою помилок
- 📱 Сумісність з OpenAI SDK
- ⚡ Швидкий запуск однією командою

**Готово до використання в продакшені!** 🚀
