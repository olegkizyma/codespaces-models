const h = location;
const BASE = `${h.protocol}//${h.host}`; // same ngrok origin
const API = `${BASE}/v1`;
const TTS = `${BASE}/tts`;

const els = {
  feed: document.getElementById('feed'),
  input: document.getElementById('input'),
  send: document.getElementById('send'),
  model: document.getElementById('model'),
  voice: document.getElementById('voice'),
  ping: document.getElementById('ping'),
};

function addMsg(role, html, extras) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="role">${role === 'user' ? '🧑' : role === 'sys' ? 'ℹ️' : '🤖'}</div>
    <div class="bubble">${html}${extras || ''}</div>
  `;
  els.feed.appendChild(div);
  els.feed.scrollTop = els.feed.scrollHeight;
}

function esc(s) {
  return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}

async function sendChat() {
  const text = els.input.value.trim();
  if (!text) return;
  const model = els.model.value;
  els.input.value='';
  addMsg('user', esc(text));

  try {
    const r = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dummy-key' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Ви дружній український асистент.' },
          { role: 'user', content: text }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!r.ok) {
      let body='';
      try { body = await r.text(); } catch(_){}
      throw new Error(`HTTP ${r.status} ${r.statusText}: ${body.slice(0,500)}`);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || '(порожньо)';

  // Обмежуємо довжину TTS тексту для надійної доставки аудіо
  const MAX_TTS_CHARS = 1200;
  const textForTTS = content.length > MAX_TTS_CHARS ? content.slice(0, MAX_TTS_CHARS) + '…' : content;

  const ttsUrl = new URL(TTS);
  ttsUrl.searchParams.set('text', textForTTS);
    const voice = els.voice.value;
    if (voice) ttsUrl.searchParams.set('voice', voice);

    const audio = `<div class="tools"><audio controls src="${ttsUrl.toString()}"></audio></div>`;
    addMsg('assistant', esc(content), audio);
  } catch (e) {
    addMsg('sys', `Помилка: ${esc(e.message || String(e))}`);
  }
}

els.send.addEventListener('click', sendChat);
els.input.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); sendChat(); } });
els.ping.addEventListener('click', async ()=>{
  try {
    const r = await fetch(`${API}/models`, { headers: { Authorization: 'Bearer dummy-key' } });
    addMsg('sys', r.ok ? '✅ /v1/models OK' : `❌ /v1/models ${r.status}`);
  } catch (e) {
    addMsg('sys', `❌ /v1/models error: ${e.message}`);
  }
});

addMsg('sys', `API: ${API} · TTS: ${TTS}`);
