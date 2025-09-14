# 🚀 OpenAI Proxy - Production Guide

## 📋 Загальна інформація

**Надійний OpenAI-сумісний проксі для GitHub Models API**
- **Порт**: 4000
- **Endpoint**: `http://localhost:4000`
- **PM2 процес**: `openai-proxy`
- **Активних моделей**: 30 з 58 (52% success rate)

## 🔧 Керування сервісом

### Запуск/перезапуск
```bash
# Перезапуск проксі
pm2 restart openai-proxy

# Статус
pm2 status

# Логи
pm2 logs openai-proxy

# Моніторинг
pm2 monit
```

### Перевірка здоров'я
```bash
# Базова перевірка
curl http://localhost:4000/health

# Детальна готовність
curl http://localhost:4000/ready

# Список моделей
curl http://localhost:4000/v1/models
```

## 🎯 PRODUCTION-READY запити

### ✅ Найнадійніші моделі для продакшену

#### 1. Швидкі та стабільні (рекомендовано)
```bash
# Mistral 3B - найшвидша (45 req/min)
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "mistral-ai/ministral-3b",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "max_tokens": 150,
    "temperature": 0.7
  }'

# OpenAI GPT-4.1 Mini - надійна
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "openai/gpt-4.1-mini",
    "messages": [
      {"role": "user", "content": "Explain quantum computing in simple terms"}
    ],
    "max_tokens": 200,
    "temperature": 0.5
  }'

# Mistral Small - збалансована (40 req/min)
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "mistral-ai/mistral-small-2503",
    "messages": [
      {"role": "user", "content": "Write a Python function to calculate fibonacci"}
    ],
    "max_tokens": 300
  }'
```

#### 2. Потужні моделі для складних завдань
```bash
# Meta Llama 405B - найпотужніша
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "meta/meta-llama-3.1-405b-instruct",
    "messages": [
      {"role": "user", "content": "Analyze this complex business problem and provide strategic recommendations"}
    ],
    "max_tokens": 500,
    "temperature": 0.3
  }'

# Mistral Large - для аналітики
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "mistral-ai/mistral-large-2411",
    "messages": [
      {"role": "user", "content": "Perform detailed financial analysis of the following data"}
    ],
    "max_tokens": 800
  }'
```

#### 3. Спеціалізовані моделі
```bash
# Програмування - Codestral
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "mistral-ai/codestral-2501",
    "messages": [
      {"role": "user", "content": "Write a REST API in Node.js with authentication"}
    ],
    "max_tokens": 1000
  }'

# Логічні завдання - Phi-4 Reasoning
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "microsoft/phi-4-reasoning",
    "messages": [
      {"role": "user", "content": "Solve this logic puzzle step by step"}
    ],
    "max_tokens": 400
  }'

# Мультимодальні завдання - Vision
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "meta/llama-3.2-11b-vision-instruct",
    "messages": [
      {"role": "user", "content": "Describe what you see in this image"}
    ],
    "max_tokens": 300
  }'
```

### 🔄 Streaming запити
```bash
# Streaming відповідь
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "mistral-ai/ministral-3b",
    "messages": [
      {"role": "user", "content": "Tell me a story"}
    ],
    "stream": true,
    "max_tokens": 500
  }'
```

## 📊 Повний список всіх 58 моделей

### ✅ АКТИВНІ МОДЕЛІ (30) - готові до продакшену

#### **AI21 Labs** (2/2 активні)
- ✅ `ai21-labs/ai21-jamba-1.5-large` - 8 req/min
- ✅ `ai21-labs/ai21-jamba-1.5-mini` - 25 req/min

#### **Cohere** (2/4 активні)
- ✅ `cohere/cohere-command-a` - 15 req/min
- ✅ `cohere/cohere-command-r-08-2024` - 10 req/min
- ❌ `cohere/cohere-command-r-plus-08-2024` - Rate limited
- ❌ `cohere/cohere-embed-v3-english` - 404 Not Found
- ❌ `cohere/cohere-embed-v3-multilingual` - 404 Not Found

#### **Core42** (1/1 активна)
- ✅ `core42/jais-30b-chat` - 6 req/min

#### **DeepSeek** (2/3 активні)
- ❌ `deepseek/deepseek-r1` - Error
- ✅ `deepseek/deepseek-r1-0528` - 1 req/min
- ✅ `deepseek/deepseek-v3-0324` - 1 req/min

#### **Meta/Llama** (6/6 активні) 🏆
- ✅ `meta/llama-3.2-11b-vision-instruct` - 6 req/min
- ✅ `meta/llama-3.2-90b-vision-instruct` - 3 req/min
- ✅ `meta/llama-3.3-70b-instruct` - 4 req/min
- ✅ `meta/llama-4-maverick-17b-128e-instruct-fp8` - 5 req/min
- ✅ `meta/llama-4-scout-17b-16e-instruct` - 5 req/min
- ✅ `meta/meta-llama-3.1-405b-instruct` - 2 req/min
- ✅ `meta/meta-llama-3.1-8b-instruct` - 30 req/min

#### **Microsoft** (6/14 активні)
- ✅ `microsoft/mai-ds-r1` - 5 req/min
- ❌ `microsoft/phi-3-medium-128k-instruct` - 404 Unknown model
- ❌ `microsoft/phi-3-medium-4k-instruct` - 404 Unknown model
- ❌ `microsoft/phi-3-mini-128k-instruct` - 404 Unknown model
- ❌ `microsoft/phi-3-mini-4k-instruct` - 404 Unknown model
- ❌ `microsoft/phi-3-small-128k-instruct` - 404 Unknown model
- ❌ `microsoft/phi-3-small-8k-instruct` - 404 Unknown model
- ❌ `microsoft/phi-3.5-mini-instruct` - 404 Unknown model
- ❌ `microsoft/phi-3.5-moe-instruct` - 404 Unknown model
- ❌ `microsoft/phi-3.5-vision-instruct` - 404 Unknown model
- ✅ `microsoft/phi-4` - 8 req/min
- ✅ `microsoft/phi-4-mini-instruct` - 22 req/min
- ✅ `microsoft/phi-4-mini-reasoning` - 10 req/min
- ✅ `microsoft/phi-4-multimodal-instruct` - 10 req/min
- ✅ `microsoft/phi-4-reasoning` - 6 req/min

#### **Mistral AI** (6/6 активні) 🏆
- ✅ `mistral-ai/codestral-2501` - 8 req/min
- ✅ `mistral-ai/ministral-3b` - 45 req/min 🚀
- ✅ `mistral-ai/mistral-large-2411` - 6 req/min
- ✅ `mistral-ai/mistral-medium-2505` - 18 req/min
- ✅ `mistral-ai/mistral-nemo` - 14 req/min
- ✅ `mistral-ai/mistral-small-2503` - 40 req/min

#### **OpenAI** (2/12 активні)
- ❌ `openai/gpt-4.1` - Rate limited
- ✅ `openai/gpt-4.1-mini` - 30 req/min
- ✅ `openai/gpt-4.1-nano` - 45 req/min
- ❌ `openai/gpt-4o` - Rate limited
- ❌ `openai/gpt-4o-mini` - Error
- ❌ `openai/gpt-5` - 400 Unavailable
- ❌ `openai/gpt-5-chat` - 400 Unavailable
- ❌ `openai/gpt-5-mini` - 400 Unavailable
- ❌ `openai/gpt-5-nano` - 400 Unavailable
- ❌ `openai/o1` - 403 Forbidden
- ❌ `openai/o1-mini` - 403 Forbidden
- ❌ `openai/o1-preview` - 403 Forbidden
- ❌ `openai/o3` - 403 Forbidden
- ❌ `openai/o3-mini` - 403 Forbidden
- ❌ `openai/o4-mini` - 400 Unavailable
- ❌ `openai/text-embedding-3-large` - Wrong endpoint (use /v1/embeddings)
- ❌ `openai/text-embedding-3-small` - Wrong endpoint (use /v1/embeddings)

#### **xAI** (2/2 активні)
- ✅ `xai/grok-3` - 6 req/min
- ✅ `xai/grok-3-mini` - 18 req/min

## 🛡️ Захист та надійність

### Активні механізми захисту
- ✅ **Rate Limiting**: 30 req/min per API key
- ✅ **DDoS Protection**: 100 req/min per IP
- ✅ **Circuit Breakers**: Auto-disable failed models
- ✅ **Queue System**: 100 requests, 8 concurrent
- ✅ **Retry Logic**: 3 attempts with exponential backoff
- ✅ **Request Validation**: Max 10MB request size

### Моніторинг
```bash
# Метрики Prometheus
curl http://localhost:4000/metrics

# Статус черги
curl http://localhost:4000/ready

# Adaptive rate limits
curl http://localhost:4000/v1/rate-limits/observed
```

## 🚀 Production Deployment

### Рекомендовані налаштування
```bash
# Environment variables
export NODE_ENV=production
export PORT=4000
export UPSTREAM_MAX_CONCURRENT=8
export QUEUE_MAX_LENGTH=100
export RATE_LIMIT_PER_MINUTE=30
export RETRY_ATTEMPTS=3
```

### Load Balancing
Для високого навантаження розгорніть кілька інстансів:
```bash
# PM2 cluster mode
pm2 start ecosystem.config.js --env production
pm2 scale openai-proxy 4  # 4 instances
```

## 📈 Рекомендації використання

### Для різних сценаріїв:

**Чат-боти та швидкі відповіді:**
- `mistral-ai/ministral-3b` (45 req/min)
- `openai/gpt-4.1-nano` (45 req/min)

**Бізнес-аналітика:**
- `mistral-ai/mistral-small-2503` (40 req/min)
- `meta/meta-llama-3.1-8b-instruct` (30 req/min)

**Складні завдання:**
- `meta/meta-llama-3.1-405b-instruct` (2 req/min)
- `mistral-ai/mistral-large-2411` (6 req/min)

**Програмування:**
- `mistral-ai/codestral-2501` (8 req/min)

**Логічні завдання:**
- `microsoft/phi-4-reasoning` (6 req/min)
- `deepseek/deepseek-v3-0324` (1 req/min)

## ⚠️ Важливі примітки

1. **Rate Limits**: Деякі моделі мають денні ліміти
2. **Embedding моделі**: Використовуйте `/v1/embeddings` endpoint
3. **o1/o3 серія**: Потребує спеціальних дозволів
4. **GPT-5**: Ще не випущені публічно
5. **Phi-3.x**: Тимчасово недоступні (404 errors)

## 🔧 Troubleshooting

### Часті помилки:
```bash
# 404 Unknown model - використовуйте активні моделі
# 429 Rate limit - зменшіть частоту запитів
# 403 Forbidden - модель потребує спеціальних дозволів
# 500 Circuit breaker - модель тимчасово недоступна
```

### Логи:
```bash
# Реальний час
pm2 logs openai-proxy --lines 100

# Файли логів
tail -f logs/openai-proxy-out.log
tail -f logs/openai-proxy-error.log
```

---

**✅ Проксі готовий до продакшену з 30 надійними моделями!**
