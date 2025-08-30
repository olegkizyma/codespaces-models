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
