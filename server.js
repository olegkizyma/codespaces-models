import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from 'url';
import { ModelLimitsHandler } from "./model-limits-utils.mjs";

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// We'll mount static after root route to ensure '/' serves mobile.html
app.use('/ui', express.static('public'));

// Serve mobile-first Voice UI at root and /modern
// Serve main page
app.get('/', (req, res) => {
  console.log('📱 Serving simple chat interface');
  res.sendFile(path.join(__dirname, 'public/simple.html'));
});

app.get('/modern', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simple.html'));
});

// Static assets at root (after overriding '/')
app.use(express.static('public'));

// Serve classic UI at /classic
app.get('/classic', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve monitoring interface at /monitor
app.get('/monitor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), models: 58 });
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN;
if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY or GITHUB_TOKEN is not set. The proxy will fail without credentials.");
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined });

// Initialize limits handler
const limitsHandler = new ModelLimitsHandler();

// Simple health moved to /health (root serves UI)

// POST /v1/proxy
// body: { model: string, input: string | messages, type: "chat" | "completion" }
app.post("/v1/proxy", async (req, res) => {
  const { model, input, type = "chat", options = {} } = req.body;
  if (!model) return res.status(400).send({ error: "model is required" });
  
  console.log(`[PROXY] ${type} request for model: "${model}"`);
  const startTime = Date.now();
  
  try {
    if (type === "chat") {
      const messages = Array.isArray(input) ? input : [{ role: "user", content: String(input) }];
      const response = await client.chat.completions.create({
        model,
        messages,
        ...options
      });
      
      // Log successful usage
      const responseTime = Date.now() - startTime;
      limitsHandler.logUsage(model, response.usage, responseTime);
      
      return res.send(response);
    } else {
      const response = await client.responses.create({
        model,
        input,
        ...options
      });
      return res.send(response);
    }
  } catch (err) {
    console.error("proxy error", err);
    
    // Log error usage
    const responseTime = Date.now() - startTime;
    limitsHandler.logUsage(model, { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }, responseTime, err);
    
    const message = err?.message || String(err);
    return res.status(500).send({ error: message, details: err });
  }
});

// Test model endpoint
app.post('/v1/test-model', async (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).send({ error: 'model is required' });
  }

  console.log(`[TEST] Testing model: "${model}"`);
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 10,
      temperature: 0
    });

    const reply = response.choices?.[0]?.message?.content || "No response";
    res.send({ working: true, model, response: reply });
    
  } catch (err) {
    console.error("model test error", err);
    const message = err?.message || String(err);
    const working = !message.includes('404') && !message.includes('Unknown model');
    res.send({ working, model, error: message });
  }
});

// Simple chat endpoint - just message in, text out
app.post('/v1/simple-chat', async (req, res) => {
  const { model, message } = req.body;
  if (!model || !message) {
    return res.status(400).send({ error: 'model and message are required' });
  }

  console.log(`[SIMPLE] Chat request for model: "${model}" - "${message.substring(0, 50)}..."`);
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: message }
      ],
      temperature: 0.7
    });

    const reply = response.choices?.[0]?.message?.content || "No response";
    res.send({ message: reply });
    
  } catch (err) {
    console.error("simple chat error", err);
    const message = err?.message || String(err);
    res.status(500).send({ error: message });
  }
});

// Simple in-memory history store (keeps only current process lifetime)
const HISTORY = [];

app.post('/v1/history', (req, res) => {
  const item = req.body;
  HISTORY.unshift(item);
  if (HISTORY.length > 200) HISTORY.pop();
  res.send(HISTORY);
});

app.get('/v1/history', (req, res) => {
  res.send(HISTORY);
});

// Standard OpenAI API endpoint - FULL COMPATIBILITY
app.post('/v1/chat/completions', async (req, res) => {
  const { model, messages, stream = false, ...otherOptions } = req.body;
  
  if (!model) {
    return res.status(400).json({
      error: {
        message: "you must provide a model parameter",
        type: "invalid_request_error",
        param: "model",
        code: null
      }
    });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      error: {
        message: "you must provide a messages parameter",
        type: "invalid_request_error", 
        param: "messages",
        code: null
      }
    });
  }

  console.log(`[OPENAI-STD] Chat completions request for model: "${model}"`);
  const startTime = Date.now();
  
  if (stream) {
    try {
      // Setup SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const responseStream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        ...otherOptions
      });

      for await (const chunk of responseStream) {
        try {
          // Send each chunk in OpenAI-compatible SSE format
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        } catch (e) {
          console.error('SSE write error:', e);
          break;
        }
      }

      // Signal completion similar to OpenAI
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      console.error('Streaming error', err);
      // If streaming setup failed before headers were committed
      if (!res.headersSent) {
        const statusCode = err?.status || err?.response?.status || 500;
        return res.status(statusCode).json({
          error: {
            message: err?.message || String(err),
            type: 'invalid_request_error',
            param: 'stream',
            code: err?.code || null
          }
        });
      }
      try { res.end(); } catch (_) {}
    }
    return;
  }

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      ...otherOptions
    });
    
    // Log successful usage
    const responseTime = Date.now() - startTime;
    limitsHandler.logUsage(model, response.usage, responseTime);
    
    // Return exact OpenAI response format
    res.json(response);
    
  } catch (err) {
    console.error("OpenAI standard API error", err);
    
    // Log error usage
    const responseTime = Date.now() - startTime;
    limitsHandler.logUsage(model, { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }, responseTime, err);
    
    // Format error in OpenAI standard way
    const errorResponse = {
      error: {
        message: err?.message || String(err),
        type: "invalid_request_error",
        param: null,
        code: err?.code || null
      }
    };
    
    // Try to preserve original status code
    const statusCode = err?.status || err?.response?.status || 500;
    res.status(statusCode).json(errorResponse);
  }
});

// OpenAI Models endpoint - list available models
app.get('/v1/models', async (req, res) => {
  console.log('[OPENAI-STD] Models list request');
  
  const models = [
    // Всі 58 моделей з GitHub Models API
    { id: "ai21-labs/ai21-jamba-1.5-large", object: "model", created: 1677610602, owned_by: "ai21-labs" },
    { id: "ai21-labs/ai21-jamba-1.5-mini", object: "model", created: 1677610602, owned_by: "ai21-labs" },
    { id: "cohere/cohere-command-a", object: "model", created: 1677610602, owned_by: "cohere" },
    { id: "cohere/cohere-command-r-08-2024", object: "model", created: 1677610602, owned_by: "cohere" },
    { id: "cohere/cohere-command-r-plus-08-2024", object: "model", created: 1677610602, owned_by: "cohere" },
    { id: "cohere/cohere-embed-v3-english", object: "model", created: 1677610602, owned_by: "cohere" },
    { id: "cohere/cohere-embed-v3-multilingual", object: "model", created: 1677610602, owned_by: "cohere" },
    { id: "core42/jais-30b-chat", object: "model", created: 1677610602, owned_by: "core42" },
    { id: "deepseek/deepseek-r1", object: "model", created: 1677610602, owned_by: "deepseek" },
    { id: "deepseek/deepseek-r1-0528", object: "model", created: 1677610602, owned_by: "deepseek" },
    { id: "deepseek/deepseek-v3-0324", object: "model", created: 1677610602, owned_by: "deepseek" },
    { id: "meta/llama-3.2-11b-vision-instruct", object: "model", created: 1677610602, owned_by: "meta" },
    { id: "meta/llama-3.2-90b-vision-instruct", object: "model", created: 1677610602, owned_by: "meta" },
    { id: "meta/llama-3.3-70b-instruct", object: "model", created: 1677610602, owned_by: "meta" },
    { id: "meta/llama-4-maverick-17b-128e-instruct-fp8", object: "model", created: 1677610602, owned_by: "meta" },
    { id: "meta/llama-4-scout-17b-16e-instruct", object: "model", created: 1677610602, owned_by: "meta" },
    { id: "meta/meta-llama-3.1-405b-instruct", object: "model", created: 1677610602, owned_by: "meta" },
    { id: "meta/meta-llama-3.1-8b-instruct", object: "model", created: 1677610602, owned_by: "meta" },
    { id: "microsoft/mai-ds-r1", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3-medium-128k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3-medium-4k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3-mini-128k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3-mini-4k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3-small-128k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3-small-8k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3.5-mini-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3.5-moe-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-3.5-vision-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-4", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-4-mini-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-4-mini-reasoning", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-4-multimodal-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/phi-4-reasoning", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "mistral-ai/codestral-2501", object: "model", created: 1677610602, owned_by: "mistral-ai" },
    { id: "mistral-ai/ministral-3b", object: "model", created: 1677610602, owned_by: "mistral-ai" },
    { id: "mistral-ai/mistral-large-2411", object: "model", created: 1677610602, owned_by: "mistral-ai" },
    { id: "mistral-ai/mistral-medium-2505", object: "model", created: 1677610602, owned_by: "mistral-ai" },
    { id: "mistral-ai/mistral-nemo", object: "model", created: 1677610602, owned_by: "mistral-ai" },
    { id: "mistral-ai/mistral-small-2503", object: "model", created: 1677610602, owned_by: "mistral-ai" },
    { id: "openai/gpt-4.1", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-4.1-mini", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-4.1-nano", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-4o", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-4o-mini", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-5", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-5-chat", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-5-mini", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-5-nano", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/o1", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/o1-mini", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/o1-preview", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/o3", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/o3-mini", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/o4-mini", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/text-embedding-3-large", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/text-embedding-3-small", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "xai/grok-3", object: "model", created: 1677610602, owned_by: "xai" },
    { id: "xai/grok-3-mini", object: "model", created: 1677610602, owned_by: "xai" }
  ];

  res.json({
    object: "list",
    data: models
  });
});

// Model recommendations endpoint
app.post("/v1/recommend-model", (req, res) => {
  try {
    const requirements = req.body;
    const recommendations = limitsHandler.recommendModel(requirements);
    res.json({
      recommendations: recommendations.slice(0, 3), // Top 3
      requirements
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Usage statistics endpoint
app.get("/v1/stats", (req, res) => {
  try {
    const stats = limitsHandler.getUsageStats();
    const report = limitsHandler.generateUsageReport();
    res.json({
      usage: stats,
      report
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Context limit check endpoint
app.post("/v1/check-context", (req, res) => {
  try {
    const { text, model } = req.body;
    if (!text || !model) {
      return res.status(400).json({ error: "text and model are required" });
    }
    
    const contextCheck = limitsHandler.checkContextLimit(text, model);
    res.json(contextCheck);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Code generator endpoint
app.post("/api/generate-code", async (req, res) => {
  try {
    const { language, type, model, prompt } = req.body;
    
    if (!language || !type) {
      return res.status(400).json({ error: "language and type are required" });
    }

    // Import CodeGenerator dynamically
    const { default: CodeGeneratorModule } = await import('./code-generator.mjs');
    
    // Create a simple generator class
    class SimpleCodeGenerator {
      generateBasicJS(model, prompt) {
        return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'dummy-key',
  baseURL: 'http://localhost:3010/v1'
});

async function main() {
  try {
    const response = await client.chat.completions.create({
      model: '${model || 'gpt-4o-mini'}',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: '${prompt || 'Hello, world!'}' }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    console.log('✅ Response:', response.choices[0].message.content);
    console.log('📊 Usage:', response.usage);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();`;
      }

      generateBasicPython(model, prompt) {
        return `#!/usr/bin/env python3

from openai import OpenAI
import time

client = OpenAI(
    base_url="http://localhost:3010/v1",
    api_key="dummy-key"
)

def main():
    model = "${model || 'gpt-4o-mini'}"
    prompt = "${prompt || 'Hello, world!'}"
    
    print(f"🤖 Testing model: {model}")
    print(f"💬 Prompt: {prompt}")
    print("=" * 50)
    
    start_time = time.time()
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        duration = time.time() - start_time
        content = response.choices[0].message.content
        
        print("✅ Response received!")
        print(f"📄 Content: {content}")
        print(f"⏱️  Duration: {duration:.2f}s")
        print(f"📊 Usage: {response.usage}")
        
    except Exception as error:
        print(f"❌ Error: {error}")

if __name__ == "__main__":
    main()`;
      }

      generateBasicBash(model, prompt) {
        return `#!/bin/bash

MODEL="${model || 'gpt-4o-mini'}"
PROMPT="${prompt || 'Hello, world!'}"

echo "🤖 Testing model: $MODEL"
echo "💬 Prompt: $PROMPT"
echo "================================================"

echo "📡 Using simple-chat API:"
curl -s -X POST "http://localhost:3010/v1/simple-chat" \\
  -H "Content-Type: application/json" \\
  -d "{\\"message\\": \\"$PROMPT\\", \\"model\\": \\"$MODEL\\"}" | jq -r '.message // .error'

echo ""
echo "📡 Using OpenAI compatible API:"
curl -s -X POST "http://localhost:3010/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"model\\": \\"$MODEL\\",
    \\"messages\\": [
      {\\"role\\": \\"system\\", \\"content\\": \\"You are a helpful assistant.\\"},
      {\\"role\\": \\"user\\", \\"content\\": \\"$PROMPT\\"}
    ],
    \\"temperature\\": 0.7,
    \\"max_tokens\\": 1000
  }" | jq '.choices[0].message.content // .error'`;
      }

      generateCode(type, language, options = {}) {
        const { model, prompt } = options;
        
        switch (language) {
          case 'js':
            return this.generateBasicJS(model, prompt);
          case 'python':
            return this.generateBasicPython(model, prompt);
          case 'bash':
            return this.generateBasicBash(model, prompt);
          default:
            throw new Error(`Unknown language: ${language}`);
        }
      }
    }

    const generator = new SimpleCodeGenerator();
    const code = generator.generateCode(type, language, { model, prompt });
    
    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3010;
app.listen(port, () => console.log(`OpenAI proxy listening on ${port}`));
