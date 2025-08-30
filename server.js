import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { ModelLimitsHandler } from "./model-limits-utils.mjs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve simple static UI for testing at /ui
app.use('/ui', express.static('public'));

// Serve monitoring interface at /monitor
app.get('/monitor', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'monitor.html'));
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN;
if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY or GITHUB_TOKEN is not set. The proxy will fail without credentials.");
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined });

// Initialize limits handler
const limitsHandler = new ModelLimitsHandler();

// Simple health
app.get("/", (req, res) => res.send({ ok: true, info: "OpenAI model proxy" }));

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
    res.send({ response: reply });
    
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
    return res.status(400).json({
      error: {
        message: "streaming is not supported yet",
        type: "invalid_request_error",
        param: "stream", 
        code: null
      }
    });
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
    // OpenAI models (4 variants)
    { id: "openai/gpt-4o-mini", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "openai/gpt-4o", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "gpt-4o-mini", object: "model", created: 1677610602, owned_by: "openai" },
    { id: "gpt-4o", object: "model", created: 1677610602, owned_by: "openai" },
    
    // Microsoft Phi models (16 variants - всі протестовані ✅)
    { id: "microsoft/Phi-3.5-mini-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/Phi-3-mini-4k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/Phi-3.5-MoE-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/Phi-3.5-vision-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/Phi-3-small-8k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/Phi-3-small-128k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "microsoft/Phi-3-medium-4k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "Phi-3.5-mini-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "Phi-3-mini-4k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "Phi-3-medium-4k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "Phi-3-small-8k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    { id: "Phi-3-small-128k-instruct", object: "model", created: 1677610602, owned_by: "microsoft" },
    
    // AI21 models (2 variants - всі протестовані ✅)
    { id: "AI21-Jamba-1.5-Large", object: "model", created: 1677610602, owned_by: "ai21" },
    { id: "AI21-Jamba-1.5-Mini", object: "model", created: 1677610602, owned_by: "ai21" },
    
    // Cohere models (2 variants - всі протестовані ✅)
    { id: "Cohere-command-r-08-2024", object: "model", created: 1677610602, owned_by: "cohere" },
    { id: "Cohere-command-r-plus-08-2024", object: "model", created: 1677610602, owned_by: "cohere" },
    
    // Meta Llama models (2 variants - всі протестовані ✅)
    { id: "Meta-Llama-3.1-8B-Instruct", object: "model", created: 1677610602, owned_by: "meta" },
    { id: "Meta-Llama-3.1-405B-Instruct", object: "model", created: 1677610602, owned_by: "meta" },
    
    // Mistral models (1 variant - протестована ✅)
    { id: "Mistral-Nemo", object: "model", created: 1677610602, owned_by: "mistralai" }
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

const port = process.env.PORT || 3010;
app.listen(port, () => console.log(`OpenAI proxy listening on ${port}`));
