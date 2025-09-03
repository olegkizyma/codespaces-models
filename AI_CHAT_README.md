# 🤖 AI Чат з OpenAI SDK

Повнофункціональний чат-додаток, що використовує OpenAI SDK для взаємодії з вашим AI API сервером.

## 🌟 Особливості

- ✅ **Веб-інтерфейс**: Красивий, адаптивний чат з підтримкою різних моделей
- ✅ **OpenAI SDK**: Повна сумісність з офіційним OpenAI SDK (JavaScript/Node.js та Python)
- ✅ **Стрімінг**: Підтримка streaming відповідей у реальному часі
- ✅ **Багатомодельність**: Підтримка 58+ моделей від провайдерів: OpenAI, Microsoft, Meta, Mistral, AI21, Cohere
- ✅ **TTS**: Інтеграція з Text-to-Speech API
- ✅ **Історія розмов**: Автоматичне збереження контексту розмови
- ✅ **Адаптивний дизайн**: Оптимізовано для десктопу і мобільних пристроїв

## 🚀 Швидкий старт

### Веб-чат

1. Відкрийте файл `/webchat/index.html` у браузері
2. Оберіть модель зі списку
3. Починайте спілкуватися з AI!

### Node.js (OpenAI SDK)

```bash
# Базове тестування
node test-openai-sdk.mjs

# Інтерактивний чат
node test-openai-sdk.mjs --chat

# Тестування стрімінгу
node test-openai-sdk.mjs --stream

# Повний тест всіх функцій
node test-openai-sdk.mjs --full
```

### Python (OpenAI SDK)

```bash
# Базове тестування
python3 test-openai-sdk.py

# Інтерактивний чат
python3 test-openai-sdk.py --chat

# Тестування стрімінгу
python3 test-openai-sdk.py --stream

# Повний тест всіх функцій
python3 test-openai-sdk.py --full
```

## 📋 API Ендпоінти

**Базовий URL**: `https://8a42c760f69d.ngrok-free.app/v1`

### Chat Completions
```bash
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer dummy-key

{
  "model": "microsoft/phi-3-mini-4k-instruct",
  "messages": [
    {"role": "user", "content": "Привіт!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

### Streaming Chat
```bash
POST /v1/chat/completions
{
  "model": "microsoft/phi-3-mini-4k-instruct", 
  "messages": [...],
  "stream": true
}
```

### Models List
```bash
GET /v1/models
Authorization: Bearer dummy-key
```

### Text-to-Speech
```bash
GET /tts?text=Ваш%20текст%20для%20озвучення
```

## 🎯 Доступні моделі

### Microsoft Models
- `microsoft/phi-3-mini-4k-instruct` - Швидка, ефективна модель
- `microsoft/phi-3.5-mini-instruct` - Покращена версія Phi-3
- `microsoft/phi-4` - Найновіша модель Microsoft

### OpenAI Models  
- `openai/gpt-4o-mini` - Компактна версія GPT-4
- `openai/gpt-4o` - Повнорозмірна GPT-4 модель
- `openai/gpt-5` - Експериментальна GPT-5

### Meta Models
- `meta/llama-3.3-70b-instruct` - Потужна модель Llama
- `meta/llama-4-scout-17b-16e-instruct` - Нова Llama 4

### Mistral Models
- `mistral-ai/mistral-small-2503` - Компактна модель Mistral
- `mistral-ai/mistral-large-2411` - Великa модель Mistral

### Інші
- `ai21-labs/ai21-jamba-1.5-large` - AI21 Jamba
- `cohere/cohere-command-r-plus-08-2024` - Cohere Command
- `xai/grok-3` - xAI Grok

## 💡 Приклади використання

### JavaScript (Браузер/Node.js)

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: 'dummy-key',
    baseURL: 'https://8a42c760f69d.ngrok-free.app/v1'
});

// Простий чат
const response = await client.chat.completions.create({
    model: 'microsoft/phi-3-mini-4k-instruct',
    messages: [
        { role: 'user', content: 'Привіт! Як справи?' }
    ]
});

console.log(response.choices[0].message.content);

// Стрімінг
const stream = await client.chat.completions.create({
    model: 'microsoft/phi-3-mini-4k-instruct',
    messages: [{ role: 'user', content: 'Розкажи історію' }],
    stream: true
});

for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="dummy-key",
    base_url="https://8a42c760f69d.ngrok-free.app/v1"
)

# Простий чат
response = client.chat.completions.create(
    model="microsoft/phi-3-mini-4k-instruct",
    messages=[
        {"role": "user", "content": "Привіт! Як справи?"}
    ]
)

print(response.choices[0].message.content)

# Стрімінг
stream = client.chat.completions.create(
    model="microsoft/phi-3-mini-4k-instruct",
    messages=[{"role": "user", "content": "Розкажи історію"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

## 🔧 Налаштування

### Веб-чат
Відредагуйте `webchat/chat.js`, щоб змінити:
- API URL
- Модель за замовчуванням
- Параметри генерації (temperature, max_tokens)

### Консольні скрипти
Змініть константи в файлах:
- `test-openai-sdk.mjs` для Node.js
- `test-openai-sdk.py` для Python

## 📱 Функції веб-чату

- **Вибір моделі**: Випадаючий список з усіма доступними моделями
- **Автоматичне масштабування**: Текстове поле автоматично розширюється
- **Індикатор набору**: Анімована індикація, коли AI "думає"
- **Форматування**: Підтримка **жирного**, *курсиву* та `коду`
- **Статистика**: Показ використаних токенів
- **Обробка помилок**: Інформативні повідомлення про помилки
- **Адаптивний дизайн**: Працює на всіх пристроях

## 🎨 Дизайн

Веб-чат використовує сучасний дизайн з:
- Градієнтними кольорами
- Плавними анімаціями
- Адаптивною типографікою
- Зручним інтерфейсом

## ⚡ Продуктивність

- **Швидкі відповіді**: Оптимізовано для мінімальної затримки
- **Ефективне кешування**: Браузерне кешування ресурсів  
- **Асинхронні запити**: Неблокуючі операції
- **Стрімінг**: Миттєвий початок отримання відповідей

## 🔒 Безпека

- CORS налаштовано для крос-доменних запитів
- API ключі мають фіктивні значення для тестування
- Валідація вхідних даних
- Обробка помилок без розкриття деталей сервера

## 🐛 Діагностика

### Перевірка з'єднання
```bash
curl "https://8a42c760f69d.ngrok-free.app/v1/models"
```

### Тестовий чат
```bash
curl -X POST "https://8a42c760f69d.ngrok-free.app/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{"model": "microsoft/phi-3-mini-4k-instruct", "messages": [{"role": "user", "content": "Test"}]}'
```

### TTS тест
```bash
curl "https://8a42c760f69d.ngrok-free.app/tts?text=Hello%20World" -o test.mp3
```

## 📈 Статистика тестування

✅ **58 моделей** доступно через API  
✅ **Стрімінг** працює бездоганно  
✅ **TTS** генерує аудіо файли  
✅ **OpenAI SDK** повністю сумісний  
✅ **Веб-інтерфейс** адаптивний та швидкий  

## 🎯 Наступні кроки

- [ ] Додати збереження історії у localStorage
- [ ] Реалізувати експорт розмов
- [ ] Додати підтримку завантаження файлів
- [ ] Інтеграція з голосовим введенням
- [ ] Додати темну/світлу теми
- [ ] Персоналізація асистента

---

**🎉 Ваш AI чат готовий до використання!**

Посилання:
- 🌐 Веб-чат: відкрийте `webchat/index.html`
- 🔗 API: https://8a42c760f69d.ngrok-free.app/v1
- 🔊 TTS: https://8a42c760f69d.ngrok-free.app/tts?text=Привіт
