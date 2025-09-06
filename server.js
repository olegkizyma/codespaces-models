import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from 'url';
import { ModelLimitsHandler } from "./model-limits-utils.mjs";
import os from 'os';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== Global process resilience =====
let FATAL_ERROR_COUNT = 0;
process.on('uncaughtException', (err)=>{
  FATAL_ERROR_COUNT++; 
  console.error('[FATAL] uncaughtException', err);
  if(FATAL_ERROR_COUNT > 3){
    console.error('[FATAL] Too many fatal errors, exiting to allow supervisor restart');
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason)=>{
  console.error('[WARN] unhandledRejection', reason);
});

function gracefulShutdown(signal){
  console.log(`[SHUTDOWN] Received ${signal}, closing server...`);
  try { server?.close(()=>{ console.log('[SHUTDOWN] Closed HTTP server'); process.exit(0); }); } catch(e){ console.error('Error closing server', e); process.exit(1);} 
  setTimeout(()=>process.exit(1), 8000).unref();
}
['SIGINT','SIGTERM'].forEach(sig=> process.on(sig, ()=>gracefulShutdown(sig)));

/**
 * ===== Runtime Performance & Throttling Helpers =====
 * Легка in‑memory реалізація:
 *  - Rate limiting (per API key + model)
 *  - Контроль максимальної кількості одночасних upstream викликів
 *  - Черга очікування з тайм-аутом
 * Все це OPTIONAL та вмикається через env.
 */

const RATE_LIMIT_ENABLED = toBool(process.env.RATE_LIMIT_ENABLED ?? '1');
const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '30', 10); // дефолт під навантаження 20-30 req/min
const RATE_LIMIT_BUCKET_LEEWAY = parseInt(process.env.RATE_LIMIT_BUCKET_LEEWAY || '2', 10); // запас
const CONCURRENCY_ENABLED = toBool(process.env.UPSTREAM_CONCURRENCY_ENABLED ?? '1');
const UPSTREAM_MAX_CONCURRENT = parseInt(process.env.UPSTREAM_MAX_CONCURRENT || '5', 10);
const QUEUE_MAX_LENGTH = parseInt(process.env.UPSTREAM_QUEUE_MAX || '50', 10);
const QUEUE_WAIT_TIMEOUT_MS = parseInt(process.env.UPSTREAM_QUEUE_TIMEOUT_MS || '30000', 10);

function toBool(v){
  v = String(v).trim().toLowerCase();
  return ['1','true','yes','on'].includes(v);
}

// Sliding window counters: key => { count, windowStart }
const rateCounters = new Map();
function checkRateLimit(key){
  if(!RATE_LIMIT_ENABLED) return { allowed: true };
  const now = Date.now();
  const windowMs = 60_000;
  let entry = rateCounters.get(key);
  if(!entry || (now - entry.windowStart) >= windowMs){
    entry = { count: 0, windowStart: now };
  }
  entry.count += 1;
  rateCounters.set(key, entry);
  if(entry.count > (RATE_LIMIT_PER_MINUTE + RATE_LIMIT_BUCKET_LEEWAY)){
    return { allowed: false, resetMs: entry.windowStart + windowMs - now, used: entry.count };
  }
  return { allowed: true, used: entry.count };
}

// Concurrency gate
let activeUpstream = 0;
const waitQueue = [];// each item: {resolve, reject, startedAt}

function acquireSlot(){
  if(!CONCURRENCY_ENABLED) return Promise.resolve(()=>{});
  return new Promise((resolve, reject)=>{
    const grant = () => {
      activeUpstream += 1;
      let released = false;
      resolve(()=>{ if(!released){ released=true; activeUpstream = Math.max(0, activeUpstream-1); pumpQueue(); }});
    };
    if(activeUpstream < UPSTREAM_MAX_CONCURRENT){
      grant();
    } else {
      if(waitQueue.length >= QUEUE_MAX_LENGTH){
        return reject(new Error('queue_overflow'));
      }
      const item = { resolve: grant, reject, startedAt: Date.now() };
      waitQueue.push(item);
      // Timeout handling
      setTimeout(()=>{
        if(waitQueue.includes(item)){
          const idx = waitQueue.indexOf(item); if(idx>=0) waitQueue.splice(idx,1);
          item.reject(new Error('queue_timeout'));
        }
      }, QUEUE_WAIT_TIMEOUT_MS).unref?.();
    }
  });
}

function pumpQueue(){
  if(!CONCURRENCY_ENABLED) return;
  while(activeUpstream < UPSTREAM_MAX_CONCURRENT && waitQueue.length){
    const next = waitQueue.shift();
    next.resolve();
  }
}

async function executeUpstream(task){
  const release = await acquireSlot();
  try { return await task(); } finally { release(); }
}

// Middleware applying rate limit & queue introspection
app.use((req,res,next)=>{
  // Only guard API routes under /v1/* (exclude /health, static)
  if(!/\/v1\//.test(req.path)) return next();
  const apiKey = getApiKeyFromRequest(req) || 'anon';
  const model = req.body?.model || 'general';
  const rateKey = `${apiKey}:${model}`;
  const rl = checkRateLimit(rateKey);
  if(!rl.allowed){
    return res.status(429).json({
      error: {
        message: `Rate limit exceeded (limit ~${RATE_LIMIT_PER_MINUTE}/min). Retry after ${Math.ceil(rl.resetMs/1000)}s`,
        type: 'rate_limit_exceeded',
        param: 'model',
        code: 'rate_limit'
      },
      rate_limit: {
        window_seconds: 60,
        used: rl.used,
        limit: RATE_LIMIT_PER_MINUTE,
        reset_ms: rl.resetMs
      }
    });
  }
  // Expose queue / concurrency metrics
  res.setHeader('X-Upstream-Active', String(activeUpstream));
  res.setHeader('X-Upstream-Queue', String(waitQueue.length));
  next();
});

/** ================== Metrics / Prometheus ==================
 * Легка реалізація без зовнішніх бібліотек.
 * Формат: OpenMetrics / Prometheus text exposition.
 */
const METRICS_ENABLED = toBool(process.env.METRICS_ENABLED ?? '1');
const METRICS_PATH = process.env.METRICS_PATH || '/metrics';

// Counters / Gauges / Histograms storage
const metrics = {
  counters: {
    http_requests_total: new Map(), // key: method|path|status
    http_errors_total: 0,
    rate_limit_exceeded_total: 0,
    tokens_prompt_total: 0,
    tokens_completion_total: 0
  },
  gauges: {
    upstream_active: () => activeUpstream,
    upstream_queue: () => waitQueue.length
  },
  histograms: {
    http_request_duration_seconds: {
      buckets: [0.05,0.1,0.25,0.5,1,2.5,5,10],
      counts: Array(9).fill(0), // 8 buckets + inf
      sum: 0,
      count: 0
    },
    queue_wait_duration_seconds: {
      buckets: [0.01,0.05,0.1,0.25,0.5,1,2.5,5],
      counts: Array(9).fill(0),
      sum: 0,
      count: 0
    }
  },
  lastScrape: 0
};

function observeDuration(seconds){
  const dh = metrics.histograms.http_request_duration_seconds;
  const qh = metrics.histograms.queue_wait_duration_seconds;
  qh.count += 1; qh.sum += seconds;
  let qplaced=false; for(let i=0;i<qh.buckets.length;i++){ if(seconds<=qh.buckets[i]){ qh.counts[i]+=1; qplaced=true; break; } }
  if(!qplaced) qh.counts[qh.counts.length-1]+=1;
  h.count += 1;
  h.sum += seconds;
  let placed = false;
  for(let i=0;i<h.buckets.length;i++){
    if(seconds <= h.buckets[i]){ h.counts[i]+=1; placed=true; break; }
  }
  if(!placed) h.counts[h.counts.length-1]+=1; // +Inf idx (last)
}

function incRequest(method,path,status,durationMs){
  const key = `${method}|${path}|${status}`;
  metrics.counters.http_requests_total.set(key,(metrics.counters.http_requests_total.get(key)||0)+1);
  if(status >=500) metrics.counters.http_errors_total +=1;
  observeDuration(durationMs/1000);
}

// Rate limit hook increment (wrap existing rate limit decision)
const originalCheckRateLimit = checkRateLimit;
checkRateLimit = function(key){
  const res = originalCheckRateLimit(key);
  if(!res.allowed) metrics.counters.rate_limit_exceeded_total +=1;
  return res;
};

// Request timing middleware (must be after body parse, before routes) — exclude /metrics itself
if (METRICS_ENABLED) {
  app.use((req,res,next)=>{
    if(req.path === METRICS_PATH) return next();
    const start = Date.now();
    res.once('finish',()=>{
      try { incRequest(req.method, req.route?.path || req.path, res.statusCode, Date.now()-start); } catch(_){}
    });
    next();
  });
}

function formatPrometheus(){
  const lines = [];
  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for(const [key,val] of metrics.counters.http_requests_total.entries()){
    const [method,path,status] = key.split('|');
    lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${val}`);
  }
  lines.push('# HELP http_errors_total Total HTTP 5xx errors');
  lines.push('# TYPE http_errors_total counter');
  lines.push(`http_errors_total ${metrics.counters.http_errors_total}`);
  lines.push('# HELP rate_limit_exceeded_total Number of rate limited requests');
  lines.push('# TYPE rate_limit_exceeded_total counter');
  lines.push(`rate_limit_exceeded_total ${metrics.counters.rate_limit_exceeded_total}`);
  lines.push('# HELP tokens_prompt_total Total prompt tokens (approx)');
  lines.push('# TYPE tokens_prompt_total counter');
  lines.push(`tokens_prompt_total ${metrics.counters.tokens_prompt_total}`);
  lines.push('# HELP tokens_completion_total Total completion tokens (approx)');
  lines.push('# TYPE tokens_completion_total counter');
  lines.push(`tokens_completion_total ${metrics.counters.tokens_completion_total}`);
  lines.push('# HELP upstream_active_current Current active upstream operations');
  lines.push('# TYPE upstream_active_current gauge');
  lines.push(`upstream_active_current ${metrics.gauges.upstream_active()}`);
  lines.push('# HELP upstream_queue_length Current queued upstream operations');
  lines.push('# TYPE upstream_queue_length gauge');
  lines.push(`upstream_queue_length ${metrics.gauges.upstream_queue()}`);
  // Histogram
  const h = metrics.histograms.http_request_duration_seconds;
  lines.push('# HELP http_request_duration_seconds Request duration seconds');
  lines.push('# TYPE http_request_duration_seconds histogram');
  let cumulative = 0;
  for(let i=0;i<h.buckets.length;i++){
    cumulative += h.counts[i];
    lines.push(`http_request_duration_seconds_bucket{le="${h.buckets[i]}"} ${cumulative}`);
  }
  cumulative += h.counts[h.counts.length-1];
  lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${cumulative}`);
  lines.push(`http_request_duration_seconds_sum ${h.sum}`);
  lines.push(`http_request_duration_seconds_count ${h.count}`);
  // Quantiles (approx from buckets) for convenience (Prometheus native preferred)
  function quantileFrom(histo, q){
    if(!histo.count) return 0;
    const target = histo.count * q;
    let cum = 0;
    for(let i=0;i<histo.buckets.length;i++){
      cum += histo.counts[i];
      if(cum >= target) return histo.buckets[i];
    }
    return Infinity;
  }
  const p95 = quantileFrom(h,0.95);
  const p99 = quantileFrom(h,0.99);
  lines.push('# HELP http_request_duration_seconds_p95 Approx 95th percentile latency');
  lines.push('# TYPE http_request_duration_seconds_p95 gauge');
  lines.push(`http_request_duration_seconds_p95 ${p95}`);
  lines.push('# HELP http_request_duration_seconds_p99 Approx 99th percentile latency');
  lines.push('# TYPE http_request_duration_seconds_p99 gauge');
  lines.push(`http_request_duration_seconds_p99 ${p99}`);
  // Queue wait histogram
  const qh = metrics.histograms.queue_wait_duration_seconds;
  lines.push('# HELP queue_wait_duration_seconds Queue wait duration seconds');
  lines.push('# TYPE queue_wait_duration_seconds histogram');
  let qcum=0; for(let i=0;i<qh.buckets.length;i++){ qcum+=qh.counts[i]; lines.push(`queue_wait_duration_seconds_bucket{le="${qh.buckets[i]}"} ${qcum}`);} qcum+=qh.counts[qh.counts.length-1];
  lines.push(`queue_wait_duration_seconds_bucket{le="+Inf"} ${qcum}`);
  lines.push(`queue_wait_duration_seconds_sum ${qh.sum}`);
  lines.push(`queue_wait_duration_seconds_count ${qh.count}`);
  const qp95 = quantileFrom(qh,0.95);
  const qp99 = quantileFrom(qh,0.99);
  lines.push('# HELP queue_wait_duration_seconds_p95 Approx 95th percentile queue wait');
  lines.push('# TYPE queue_wait_duration_seconds_p95 gauge');
  lines.push(`queue_wait_duration_seconds_p95 ${qp95}`);
  lines.push('# HELP queue_wait_duration_seconds_p99 Approx 99th percentile queue wait');
  lines.push('# TYPE queue_wait_duration_seconds_p99 gauge');
  lines.push(`queue_wait_duration_seconds_p99 ${qp99}`);
  // Process metrics
  const mem = process.memoryUsage();
  lines.push('# HELP process_resident_memory_bytes Resident memory');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${mem.rss}`);
  lines.push('# HELP process_uptime_seconds Process uptime seconds');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${process.uptime()}`);
  lines.push('# HELP nodejs_active_handles Active libuv handles');
  lines.push('# TYPE nodejs_active_handles gauge');
  lines.push(`nodejs_active_handles ${(process._getActiveHandles?.().length)||0}`);
  lines.push('# EOF');
  return lines.join('\n')+'\n';
}

if (METRICS_ENABLED) {
  app.get(METRICS_PATH, (req,res)=>{
    res.setHeader('Content-Type','text/plain; version=0.0.4; charset=utf-8');
    try { res.send(formatPrometheus()); } catch (e){ res.status(500).send('# metrics error'); }
  });
}

// Strict OpenAI mode flag
const STRICT_OPENAI_API = (() => {
  const v = String(process.env.STRICT_OPENAI_API || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
})();

// Optional proxy access key middleware
// - If PROXY_SERVER_KEY is set, require clients to provide it
// - Accepted as:
//   • Header: X-Proxy-Server-Key: <key>
//   • Or Authorization: Bearer <key> (only when PROXY_AUTH_MODE=env)
function requireProxyKey(req, res, next) {
  const requiredKey = process.env.PROXY_SERVER_KEY;
  if (!requiredKey) return next();

  const headerKeyRaw = req.headers['x-proxy-server-key'] || req.headers['x-proxy-key'];
  const headerKey = Array.isArray(headerKeyRaw) ? String(headerKeyRaw[0]) : String(headerKeyRaw || '');

  let authKey = '';
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const mode = (process.env.PROXY_AUTH_MODE || 'prefer-request').toLowerCase();
  if (mode === 'env' && authHeader && /^Bearer\s+/i.test(authHeader)) {
    authKey = String(authHeader).replace(/^Bearer\s+/i, '').trim();
  }

  const provided = headerKey || authKey;
  if (provided && provided === requiredKey) return next();

  const statusCode = 401;
  return res.status(statusCode).json({
    error: {
      message: 'missing or invalid proxy key',
      type: 'authentication_error',
      param: null,
      code: 'proxy_key_invalid'
    }
  });
}

// Enforce proxy key only for API routes
app.use('/v1', requireProxyKey);
app.use('/api', requireProxyKey);

if (!STRICT_OPENAI_API) {
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
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), models: 58 });
});

// Lightweight proxy for local TTS container
// Usage: GET /tts?text=...&voice=anatol&name=foo&scale=1.2
// Env config:
//   TTS_PROXY_TARGET=http://127.0.0.1:8080 (default)
//   ENABLE_TTS_PROXY=true|false (default: true)
const ENABLE_TTS_PROXY = (() => {
  const v = String(process.env.ENABLE_TTS_PROXY ?? '1').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
})();
const TTS_PROXY_TARGET = String(process.env.TTS_PROXY_TARGET || 'http://127.0.0.1:8080');

if (ENABLE_TTS_PROXY) {
  // Map /tts and /tts/* → TTS_PROXY_TARGET
  // Быстрый ответ на CORS preflight
  app.options(['/tts', '/tts/*'], (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type, X-Requested-With');
    res.status(204).end();
  });

  // Легкий HEAD для проверки доступности сервиса
  app.head(['/tts', '/tts/*'], async (req, res) => {
    try {
      const prefixStripped = req.path.replace(/^\/tts/, '') || '/';
      const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      const targetUrl = `${TTS_PROXY_TARGET}${prefixStripped}${qs}`;

      const upstream = await fetch(targetUrl, { method: 'HEAD' });
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end();
    } catch (e) {
      res.status(502).end();
    }
  });

  app.get(['/tts', '/tts/*'], async (req, res) => {
    try {
      // Rebuild target URL: preserve query, drop '/tts' prefix from path
      const prefixStripped = req.path.replace(/^\/tts/, '') || '/';
      const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      const targetUrl = `${TTS_PROXY_TARGET}${prefixStripped}${qs}`;

      console.log(`[TTS] Проксирую запит: ${targetUrl}`);

      // Проксируем ключевые заголовки клиента (напр., Range) и выставляем безопасные значения по умолчанию
      const passThroughHeaders = {
        'User-Agent': req.headers['user-agent'] || 'TTS-Proxy/1.0',
        'Accept': req.headers['accept'] || 'audio/wav, audio/mpeg, audio/*',
        'Accept-Language': req.headers['accept-language'] || 'uk-UA, uk, ru, en',
        'Accept-Charset': 'UTF-8'
      };
      if (req.headers['range']) passThroughHeaders['Range'] = req.headers['range'];
      if (req.headers['if-none-match']) passThroughHeaders['If-None-Match'] = req.headers['if-none-match'];
      if (req.headers['if-modified-since']) passThroughHeaders['If-Modified-Since'] = req.headers['if-modified-since'];

      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: passThroughHeaders
      });

      if (!upstream.ok) {
        throw new Error(`TTS сервер повернув ${upstream.status}: ${upstream.statusText}`);
      }

      // Пробрасываем важные заголовки, поддерживаем 200/206 и потоковую передачу без буферизации в памяти
      const statusCode = upstream.status; // 200 или 206 (при Range)
      const ct = upstream.headers.get('content-type') || 'audio/wav';
      const cd = upstream.headers.get('content-disposition');
      const cl = upstream.headers.get('content-length');
      const cr = upstream.headers.get('content-range');
      const ar = upstream.headers.get('accept-ranges');
      const cc = upstream.headers.get('cache-control');
      const etag = upstream.headers.get('etag');

      res.status(statusCode);
      res.setHeader('Content-Type', ct);
      if (cd) res.setHeader('Content-Disposition', cd);
      if (cl) res.setHeader('Content-Length', cl);
      if (cr) res.setHeader('Content-Range', cr);
      if (ar) res.setHeader('Accept-Ranges', ar);
      if (cc) res.setHeader('Cache-Control', cc);
      if (etag) res.setHeader('ETag', etag);

      // CORS для веба
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');

      // Потоковая передача тела ответа
      const { Readable } = await import('node:stream');
      const nodeStream = Readable.fromWeb(upstream.body);
      let sent = 0;
      nodeStream.on('data', (chunk) => { sent += chunk.length; });
      nodeStream.on('end', () => {
        console.log(`[TTS] Відправлено аудіо клієнту: ~${sent} байт (status ${statusCode})`);
      });
      nodeStream.on('error', (e) => {
        console.error('[TTS] Stream error:', e?.message || e);
      });
      nodeStream.pipe(res);
      
    } catch (err) {
      console.error('[TTS] Помилка:', err.message);
      const message = err?.message || String(err);
      res.status(502).json({
        error: {
          message: `TTS proxy error: ${message}`,
          type: 'bad_gateway',
          param: null,
          code: 'tts_upstream_error'
        }
      });
    }
  });
}

// Request-scoped API key/baseURL resolution
function getApiKeyFromRequest(req) {
  // Resolve auth mode: env | request | prefer-request
  const headerMode = req.headers['x-proxy-auth-mode'];
  const envMode = process.env.PROXY_AUTH_MODE;
  const mode = (headerMode ? String(Array.isArray(headerMode) ? headerMode[0] : headerMode) : envMode || 'prefer-request').toLowerCase();

  const envKey = process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN || '';
  const auth = req.headers?.authorization || req.headers?.Authorization;
  const alt = req.headers['x-openai-api-key'] || req.headers['x-proxy-api-key'];
  const reqKey = (() => {
    if (auth && /^Bearer\s+/i.test(auth)) {
      const key = String(auth).replace(/^Bearer\s+/i, '').trim();
      if (key) return key;
    }
    if (alt) return Array.isArray(alt) ? String(alt[0]) : String(alt);
    return '';
  })();

  switch (mode) {
    case 'env':
      return envKey;
    case 'request':
      return reqKey;
    default: // prefer-request
      return reqKey || envKey;
  }
}

function getBaseUrlFromRequest(req) {
  const allowOverride = String(process.env.ALLOW_BASE_URL_OVERRIDE || '').trim().toLowerCase();
  const canOverride = (allowOverride === '1' || allowOverride === 'true' || allowOverride === 'yes' || allowOverride === 'on') && !STRICT_OPENAI_API;
  if (canOverride) {
    const headerUrl = req.headers['x-openai-base-url'];
    if (headerUrl) return Array.isArray(headerUrl) ? String(headerUrl[0]) : String(headerUrl);
  }
  return process.env.OPENAI_BASE_URL || undefined;
}

function getClient(req) {
  const apiKey = getApiKeyFromRequest(req);
  if (!apiKey && !process.env.SUPPRESS_KEY_WARN) {
    console.warn('[WARN] No API key provided; using empty key. Set OPENAI_API_KEY/GITHUB_TOKEN or send Authorization header.');
  }
  const baseURL = getBaseUrlFromRequest(req);
  return new OpenAI({ apiKey, baseURL });
}

// Initialize limits handler
const limitsHandler = new ModelLimitsHandler();

// Simple health moved to /health (root serves UI)

if (!STRICT_OPENAI_API) {
// POST /v1/proxy
// body: { model: string, input: string | messages, type: "chat" | "completion" }
app.post("/v1/proxy", async (req, res) => {
  const { model, input, type = "chat", options = {} } = req.body;
  if (!model) return res.status(400).send({ error: "model is required" });
  
  console.log(`[PROXY] ${type} request for model: "${model}"`);
  const startTime = Date.now();
  
  try {
  const client = getClient(req);
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
    
    const statusCode = err?.status || err?.response?.status || 500;
    return res.status(statusCode).json({
      error: {
        message: err?.message || String(err),
        type: 'invalid_request_error',
        param: null,
        code: err?.code || null
      }
    });
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
  const client = getClient(req);
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
  const client = getClient(req);
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

// OpenAI Responses API - standard endpoint
app.post('/v1/responses', async (req, res) => {
  try {
    const client = getClient(req);
    const { stream, ...payload } = req.body || {};
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const responseStream = await client.responses.create({ ...payload, stream: true });
      for await (const chunk of responseStream) {
        try { res.write(`data: ${JSON.stringify(chunk)}\n\n`); } catch (_) { break; }
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const response = await client.responses.create(payload);
    res.json(response);
  } catch (err) {
    const statusCode = err?.status || err?.response?.status || 500;
    res.status(statusCode).json({
      error: {
        message: err?.message || String(err),
        type: 'invalid_request_error',
        param: null,
        code: err?.code || null
      }
    });
  }
});

// OpenAI Embeddings API - standard endpoint
app.post('/v1/embeddings', async (req, res) => {
  try {
    const client = getClient(req);
    const { model, input, ...other } = req.body || {};
    if (!model || typeof input === 'undefined') {
      return res.status(400).json({
        error: { message: 'you must provide model and input', type: 'invalid_request_error', param: null, code: null }
      });
    }
  const response = await executeUpstream(()=> client.embeddings.create({ model, input, ...other }));
    res.json(response);
  } catch (err) {
    const statusCode = err?.status || err?.response?.status || 500;
    res.status(statusCode).json({
      error: {
        message: err?.message || String(err),
        type: 'invalid_request_error',
        param: null,
        code: err?.code || null
      }
    });
  }
});

// OpenAI Completions API (legacy) - compatible endpoint
// Maps to chat.completions under the hood and transforms to text_completion format
app.post('/v1/completions', async (req, res) => {
  try {
    const { model, prompt, stream = false, ...other } = req.body || {};
    if (!model || typeof prompt === 'undefined') {
      return res.status(400).json({
        error: { message: 'you must provide model and prompt', type: 'invalid_request_error', param: null, code: null }
      });
    }

    // Normalize prompt to chat messages
    const messages = Array.isArray(prompt)
      ? prompt.map((p) => ({ role: 'user', content: String(p) }))
      : [{ role: 'user', content: String(prompt) }];

    const client = getClient(req);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      try {
        const responseStream = await client.chat.completions.create({
          model,
          messages,
          stream: true,
          ...other,
        });

        for await (const chunk of responseStream) {
          const delta = chunk?.choices?.[0]?.delta?.content || '';
          const done = chunk?.choices?.[0]?.finish_reason || null;
          const payload = {
            id: chunk?.id || undefined,
            object: 'text_completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                text: delta || '',
                index: 0,
                logprobs: null,
                finish_reason: done,
              },
            ],
          };
          try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (_) { break; }
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        const statusCode = err?.status || err?.response?.status || 500;
        if (!res.headersSent) {
          return res.status(statusCode).json({
            error: { message: err?.message || String(err), type: 'invalid_request_error', param: null, code: err?.code || null },
          });
        }
        try { res.end(); } catch (_) {}
      }
      return;
    }

  const response = await executeUpstream(()=> client.chat.completions.create({ model, messages, ...other }));
    const text = response?.choices?.[0]?.message?.content || '';
    const finish = response?.choices?.[0]?.finish_reason || 'stop';
    const payload = {
      id: response?.id || undefined,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        { text, index: 0, logprobs: null, finish_reason: finish },
      ],
      usage: response?.usage,
    };
    res.json(payload);
  } catch (err) {
    const statusCode = err?.status || err?.response?.status || 500;
    res.status(statusCode).json({
      error: { message: err?.message || String(err), type: 'invalid_request_error', param: null, code: err?.code || null },
    });
  }
});
} // end of non-strict endpoints

// === Always-on endpoints (duplicated when STRICT_OPENAI_API enabled) ===
// If strict mode is on, embeddings & legacy completions above were skipped – recreate minimal variants.
if (STRICT_OPENAI_API) {
  app.post('/v1/embeddings', async (req,res)=>{
    try {
      const client = getClient(req);
      const { model, input, ...other } = req.body || {};
      if (!model || typeof input === 'undefined') {
        return res.status(400).json({ error: { message: 'you must provide model and input', type: 'invalid_request_error', param: null, code: null }});
      }
      const response = await executeUpstream(()=> client.embeddings.create({ model, input, ...other }));
      res.json(response);
    } catch (err){
      const statusCode = err?.status || err?.response?.status || 500;
      res.status(statusCode).json({ error: { message: err?.message || String(err), type: 'invalid_request_error', param: null, code: err?.code || null }});
    }
  });

  app.post('/v1/completions', async (req,res)=>{
    try {
      const { model, prompt, stream = false, ...other } = req.body || {};
      if (!model || typeof prompt === 'undefined') {
        return res.status(400).json({ error: { message: 'you must provide model and prompt', type: 'invalid_request_error', param: null, code: null }});
      }
      const messages = Array.isArray(prompt)
        ? prompt.map(p=>({ role:'user', content: String(p) }))
        : [{ role:'user', content: String(prompt) }];
      const client = getClient(req);
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        try {
          const responseStream = await client.chat.completions.create({ model, messages, stream: true, ...other });
          for await (const chunk of responseStream) {
            const delta = chunk?.choices?.[0]?.delta?.content || '';
            const done = chunk?.choices?.[0]?.finish_reason || null;
            const payload = { id: chunk?.id, object:'text_completion', created: Math.floor(Date.now()/1000), model, choices:[{ text: delta, index:0, logprobs:null, finish_reason: done }]};
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          return res.end();
        } catch (err){
          if(!res.headersSent){
            const statusCode = err?.status || err?.response?.status || 500;
            return res.status(statusCode).json({ error: { message: err?.message || String(err), type: 'invalid_request_error', param: null, code: err?.code || null }});
          }
          return res.end();
        }
      }
      const response = await executeUpstream(()=> client.chat.completions.create({ model, messages, ...other }));
      const text = response?.choices?.[0]?.message?.content || '';
      const finish = response?.choices?.[0]?.finish_reason || 'stop';
      return res.json({ id: response?.id, object:'text_completion', created: Math.floor(Date.now()/1000), model, choices:[{ text, index:0, logprobs:null, finish_reason: finish }], usage: response?.usage });
    } catch (err){
      const statusCode = err?.status || err?.response?.status || 500;
      res.status(statusCode).json({ error: { message: err?.message || String(err), type:'invalid_request_error', param:null, code: err?.code || null }});
    }
  });
}

// Standard OpenAI API endpoint - FULL COMPATIBILITY
async function handleChatCompletions(req, res) {
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

  // Guard against placeholder values like "<model-id>" or "<take id from /v1/models>"
  if (typeof model === 'string' && /[<>]/.test(model)) {
    return res.status(400).json({
      error: {
        message: "invalid model parameter: replace placeholder with a real model id (e.g., 'openai/gpt-4o-mini'); call /v1/models to list available ids",
        type: "invalid_request_error",
        param: "model",
        code: "model_placeholder"
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
      const client = getClient(req);
      // Acquire slot for streaming lifetime
      const release = CONCURRENCY_ENABLED ? await acquireSlot() : ()=>{};
      // Approx prompt tokens (messages content length /4)
      try {
        const promptChars = messages.map(m=> (typeof m.content==='string'? m.content: JSON.stringify(m.content)||'')).join('').length;
        metrics.counters.tokens_prompt_total += Math.ceil(promptChars/4);
      } catch(_){}
      let tokensApprox = 0; // completion
      try {
        const upstreamStream = await client.chat.completions.create({ model, messages, stream: true, ...otherOptions });
        for await (const chunk of upstreamStream) {
          try {
            const delta = chunk?.choices?.[0]?.delta?.content || '';
            tokensApprox += delta ? Math.ceil(delta.length / 4) : 0;
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          } catch (e) {
            console.error('SSE write error:', e); break;
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
        metrics.counters.tokens_completion_total += tokensApprox;
      } finally { release(); }
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
    const client = getClient(req);
    const response = await client.chat.completions.create({
      model,
      messages,
      ...otherOptions
    });
    // Non-stream token accounting
    try {
      const promptChars = messages.map(m=> (typeof m.content==='string'? m.content: JSON.stringify(m.content)||'')).join('').length;
      metrics.counters.tokens_prompt_total += Math.ceil(promptChars/4);
      const completionText = response?.choices?.map(c=>c.message?.content||'').join('') || '';
      metrics.counters.tokens_completion_total += Math.ceil(completionText.length/4);
    } catch(_){}

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
}

// Alias for compatibility with UIs expecting /api/* paths (only in non-strict mode)  
if (!STRICT_OPENAI_API) {
  app.post('/api/chat/completions', handleChatCompletions);
}

// OpenAI Models endpoint - list available models
async function handleModelsList(req, res) {
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
}

// Alias for compatibility (only in non-strict mode)
if (!STRICT_OPENAI_API) {
  app.get('/api/models', handleModelsList);
}

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


// Standard OpenAI endpoints always available (including in strict mode)
app.post('/v1/chat/completions', handleChatCompletions);
app.get('/v1/models', handleModelsList);

const port = process.env.PORT || 3010;
app.listen(port, () => console.log(`OpenAI proxy listening on ${port}`));
