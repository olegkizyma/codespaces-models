# OpenAI Model Proxy API

This repository includes a Express-based proxy to call OpenAI-compatible models via GitHub Models.

## 🚀 Two API Modes

### **1. Standard OpenAI API (NEW!)** - Full Compatibility
- **GET /v1/models** - list all available models 
- **POST /v1/chat/completions** - standard OpenAI chat completions
- ✅ **Works with any OpenAI SDK and tools**
- ✅ **Standard authentication, errors, metadata**

### **2. Extended API** - Additional Features
- **GET /** - health check
- **GET /ui/** - web interface with two tabs (Simple Chat + Advanced)
- **POST /v1/proxy** - detailed API proxy
- **POST /v1/simple-chat** - simple chat endpoint
- **POST /v1/test-model** - test model availability
- **GET/POST /v1/history** - request history

## 🎯 Quick Start for Standard OpenAI API

```python
import openai
client = openai.OpenAI(api_key="dummy", base_url="http://localhost:3010/v1")
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Tested Working Models (as of Aug 2025)

✅ **OpenAI models:**
- `openai/gpt-4o-mini` / `gpt-4o-mini`
- `openai/gpt-4o` / `gpt-4o`

✅ **Microsoft Phi models:**
- `microsoft/Phi-3.5-mini-instruct` / `Phi-3.5-mini-instruct`
- `microsoft/Phi-3-mini-4k-instruct` / `Phi-3-mini-4k-instruct`
- `microsoft/Phi-3-medium-4k-instruct` / `Phi-3-medium-4k-instruct`
- `microsoft/Phi-3-small-8k-instruct` / `Phi-3-small-8k-instruct`
- `microsoft/Phi-3-small-128k-instruct` / `Phi-3-small-128k-instruct`
- `microsoft/Phi-3.5-MoE-instruct` (Mixture of Experts)
- `microsoft/Phi-3.5-vision-instruct` (Vision support)

✅ **AI21 Jamba models:**
- `AI21-Jamba-1.5-Mini`
- `AI21-Jamba-1.5-Large`

✅ **Cohere Command models:**
- `Cohere-command-r-08-2024`
- `Cohere-command-r-plus-08-2024`

✅ **Meta Llama models:**
- `Meta-Llama-3.1-8B-Instruct`
- `Meta-Llama-3.1-405B-Instruct`

✅ **Mistral models:**
- `Mistral-Nemo`

> **Всього: 24 працюючих моделей!** 
> Повний список з описами у файлі `AVAILABLE_MODELS.md`
- Cohere models
- Mistral models

## Quick Start

1. Copy `.env.example` to `.env` and set `GITHUB_TOKEN`
2. Install dependencies: `npm install`
3. Start server: `npm start` (defaults to port 3010)
4. Open http://localhost:3010/ui/ for web interface

## Testing Models

- Use the **"Test Model"** button in Simple Chat tab
- Run: `npm run test-models` to test all models programmatically
- Check server logs for detailed error messages

## Features

- **Simple Chat tab:** Natural conversation interface
- **Advanced tab:** Full JSON control with response metadata
- **History:** Auto-saved request/response history
- **Error handling:** Clear error messages for unavailable models
- **Model testing:** Built-in model availability checker
