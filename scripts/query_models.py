#!/usr/bin/env python3
import os
import json
import sys
import time
import urllib.request

def read_env(path='.env'):
    env = {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"')
    except FileNotFoundError:
        pass
    return env


def http_get(url, token):
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json'
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def http_post(url, token, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    })
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)


def short_text_from_response(resp):
    # support chat completions and classic completions
    try:
        # Chat-style
        return resp['choices'][0]['message']['content']
    except Exception:
        pass
    try:
        return resp['choices'][0].get('text') or resp['choices'][0].get('content')
    except Exception:
        return None


def main():
    env = read_env()
    BASE = env.get('OPENAI_BASE_URL', 'https://models.github.ai/inference').rstrip('/')
    TOKEN = env.get('GITHUB_TOKEN') or env.get('OPENAI_API_KEY')
    if not TOKEN:
        print('❌ Не знайдено токена у .env (GITHUB_TOKEN або OPENAI_API_KEY).')
        sys.exit(1)

    models_url = f'{BASE}/v1/models'
    print(f'📋 Отримую список моделей з {models_url} ...')
    try:
        models_resp = http_get(models_url, TOKEN)
    except Exception as e:
        print('❌ Помилка при отриманні моделей:', e)
        sys.exit(1)

    models = [m.get('id') or m.get('name') for m in models_resp.get('data', [])]
    print(f'✅ Знайдено {len(models)} моделей')

    limit = int(os.environ.get('MODEL_LIMIT', '10'))
    if limit <= 0:
        print('MODEL_LIMIT встановлено <= 0 — нічого не роблю')
        return

    models = models[:limit]

    out_dir = '/tmp/model_responses'
    os.makedirs(out_dir, exist_ok=True)

    for idx, model in enumerate(models, start=1):
        print(f'[{idx}/{len(models)}] Запит до моделі: {model}')
        payload = {
            'model': model,
            'messages': [
                {'role': 'user', 'content': 'Привіт! Скажи одне речення про себе.'}
            ],
            'max_tokens': 80,
            'temperature': 0.5
        }
        try:
            resp = http_post(f'{BASE}/v1/chat/completions', TOKEN, payload)
            text = short_text_from_response(resp) or json.dumps(resp)[:200]
            snippet = text.replace('\n', ' ')[:300]
            print('→ Відповідь (коротко):', snippet)
            safe_name = model.replace('/', '_')
            out_path = os.path.join(out_dir, f'resp_{safe_name}.json')
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump({'model': model, 'response': resp}, f, ensure_ascii=False, indent=2)
            print('  Збережено у', out_path)
        except Exception as e:
            print('❌ Помилка запиту:', e)
        time.sleep(1)

    print('\n🎉 Готово. Перевірте файли у', out_dir)


if __name__ == '__main__':
    main()
