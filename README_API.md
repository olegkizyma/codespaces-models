This repository includes a small Express-based proxy to call OpenAI-compatible models.

Endpoints

- GET / - health
- POST /v1/proxy - proxy a request to the OpenAI SDK
  - body: { model: string, input: string | array, type: 'chat' | 'completion', options?: object }

Usage

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` and optionally `OPENAI_BASE_URL`.
2. npm install
3. npm start (defaults to port 3010) or set PORT to override

The proxy uses the `openai` SDK already present in this repo and accepts arbitrary `model` ids (for example `openai/gpt-4o-mini` or `mistral-ai/mistral-small`).
