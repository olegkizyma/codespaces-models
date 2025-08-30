# OpenAI Model Proxy API

This repository includes a Express-based proxy to call OpenAI-compatible models via GitHub Models.

## Endpoints

- **GET /** - health check
- **GET /ui/** - web interface with two tabs (Simple Chat + Advanced)
- **POST /v1/proxy** - detailed API proxy
  - body: `{ model: string, input: string | array, type: 'chat' | 'completion', options?: object }`
- **POST /v1/simple-chat** - simple chat endpoint
  - body: `{ model: string, message: string }`
  - returns: `{ response: string }`
- **POST /v1/test-model** - test model availability
  - body: `{ model: string }`
  - returns: `{ working: boolean, model: string, response?: string, error?: string }`
- **GET/POST /v1/history** - request history

## Tested Working Models (as of Aug 2025)

✅ **OpenAI models:**
- `openai/gpt-4o-mini`
- `openai/gpt-4o`

✅ **Microsoft models:**
- `microsoft/Phi-3.5-mini-instruct`
- `microsoft/Phi-3-mini-4k-instruct`

✅ **AI21 models:**
- `AI21-Jamba-1.5-Mini`
- `AI21-Jamba-1.5-Large`

❌ **Not available with current token:**
- OpenAI: gpt-4, gpt-3.5-turbo
- Meta Llama models
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
