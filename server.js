import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve simple static UI for testing at /ui
app.use('/ui', express.static('public'));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN;
if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY or GITHUB_TOKEN is not set. The proxy will fail without credentials.");
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined });

// Simple health
app.get("/", (req, res) => res.send({ ok: true, info: "OpenAI model proxy" }));

// POST /v1/proxy
// body: { model: string, input: string | messages, type: "chat" | "completion" }
app.post("/v1/proxy", async (req, res) => {
  const { model, input, type = "chat", options = {} } = req.body;
  if (!model) return res.status(400).send({ error: "model is required" });
  
  console.log(`[PROXY] ${type} request for model: "${model}"`);
  
  try {
    if (type === "chat") {
      const messages = Array.isArray(input) ? input : [{ role: "user", content: String(input) }];
      const response = await client.chat.completions.create({
        model,
        messages,
        ...options
      });
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

const port = process.env.PORT || 3010;
app.listen(port, () => console.log(`OpenAI proxy listening on ${port}`));
