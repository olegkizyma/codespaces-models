# 🤖 AI Chat - Makefile та глобальна команда

Простий спосіб запуску чату з 24 AI моделями з будь-якої папки в терміналі.

## 🚀 Швидкий старт

### Локальне використання (з папки проекту)
```bash
# Показати довідку
make help

# Запустити чат сервер
make chat

# Запустити на іншому порту
make chat PORT=3011

# Перевірити статус
make status

# Показати логи
make logs

# Тестувати API
make test

# Зупинити сервер
make stop

# Перезапустити
make restart
```

### Глобальна команда (з будь-якої папки)
```bash
# Встановити глобально
make install

# Тепер можна використовувати з будь-якої папки:
cd /tmp
aichat              # запустити чат
aichat status       # перевірити статус
aichat stop         # зупинити
aichat test         # тестувати API
aichat help         # повна довідка
```

## 📋 Доступні команди

| Команда | Опис |
|---------|------|
| `make chat` або `aichat` | Запустити чат сервер (порт 3010) |
| `make chat PORT=N` або `aichat PORT=N` | Запустити на вказаному порту |
| `make stop` або `aichat stop` | Зупинити сервер |
| `make restart` або `aichat restart` | Перезапустити сервер |
| `make status` або `aichat status` | Перевірити статус сервера |
| `make logs` або `aichat logs` | Показати логи сервера |
| `make test` або `aichat test` | Швидкий тест API |
| `make install` | Встановити глобальну команду `aichat` |
| `make clean` або `aichat clean` | Очистити тимчасові файли |
| `make help` або `aichat help` | Показати довідку |

## 🤖 Підтримувані AI моделі

- **🤖 OpenAI**: gpt-4o, gpt-4o-mini
- **🏢 Microsoft**: phi-3-mini-4k, phi-3-medium-4k, phi-3-medium-128k, phi-3.5-mini-instruct
- **📚 AI21**: jamba-1.5-mini, jamba-1.5-large, jamba-instruct
- **🔄 Cohere**: command-r, command-r-plus
- **🦙 Meta**: llama-3.1-405b-instruct, llama-3.1-70b-instruct, llama-3.1-8b-instruct, llama-3.2-11b-vision-instruct, llama-3.2-90b-vision-instruct
- **🌟 Mistral**: mistral-large-2407, mistral-nemo, mistral-small

## 🌐 Веб інтерфейс

Після запуску сервера, відкрийте в браузері:
- **Простий чат**: http://127.0.0.1:3010
- **Health check**: http://127.0.0.1:3010/health

## 🎯 Приклади використання

### Локальний розробник
```bash
cd ~/my-project
make chat          # запуск з папки проекту
```

### Глобальне використання
```bash
cd /any/folder
aichat             # запуск з будь-якої папки
aichat PORT=3011   # на іншому порту
aichat test        # швидкий тест
```

### API тестування
```bash
# Через Makefile
make test

# Через глобальну команду
aichat test

# Ручний тест
curl -X POST http://127.0.0.1:3010/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Привіт!"}], "model":"gpt-4o-mini"}'
```

## 🔧 Налаштування

### Змінити шлях для глобальної команди
Відредагуйте файл `/usr/local/bin/aichat` та змініть `CHAT_PROJECT_DIR`:

```bash
sudo nano /usr/local/bin/aichat
# Змініть: CHAT_PROJECT_DIR="/your/new/path"
```

### Видалити глобальну команду
```bash
sudo rm /usr/local/bin/aichat
```

## 🛠 Вимоги

- **Node.js** - для сервера
- **lsof** - для перевірки портів
- **curl** - для health checks та тестів
- **make** - для запуску команд Makefile

### Встановлення на macOS
```bash
# Через Homebrew
brew install node lsof curl make

# Node.js також можна встановити з https://nodejs.org
```

## 📝 Логи та відлагодження

```bash
# Показати логи
aichat logs

# Детальні логи
tail -f server.log

# Перевірити процеси
aichat status

# Очистити тимчасові файли
aichat clean
```

## ✨ Особливості

- 🚀 **Швидкий запуск** - одна команда для запуску
- 🌐 **Глобальний доступ** - працює з будь-якої папки
- 🎯 **Автоматичні перевірки** - health checks та dependency checks
- 🔍 **Відлагодження** - детальні логи та статуси
- 🛑 **Безпечне зупинення** - правильне завершення процесів
- 🎨 **Кольоровий вивід** - зручне читання в терміналі
