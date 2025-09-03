#!/usr/bin/env python3
"""
Тестування вашого API через OpenAI Python SDK
Використання: python test-openai-sdk.py [--chat] [--stream] [--full]
"""

from openai import OpenAI
import time
import sys

# Налаштування клієнта OpenAI для вашого API
client = OpenAI(
    api_key="dummy-key",
    base_url="https://8a42c760f69d.ngrok-free.app/v1"
)

# Доступні моделі для тестування
MODELS = [
    'microsoft/phi-3-mini-4k-instruct',
    'microsoft/phi-3.5-mini-instruct', 
    'openai/gpt-4o-mini',
    'meta/llama-3.3-70b-instruct',
    'mistral-ai/mistral-small-2503'
]

def test_models():
    """Тестування різних моделей"""
    print("🚀 Тестування моделей через OpenAI Python SDK\n")
    
    try:
        # Отримуємо список моделей
        print("📋 Отримання списку моделей...")
        models_response = client.models.list()
        print(f"✅ Знайдено {len(models_response.data)} моделей\n")
        
        # Тестуємо кілька моделей
        test_prompt = "Привіт! Коротко розкажи про себе українською мовою."
        
        for model in MODELS[:3]:  # Тестуємо перші 3 моделі
            print(f"🤖 Тестування моделі: {model}")
            
            try:
                start_time = time.time()
                
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "Ти корисний AI асистент, який відповідає українською мовою."},
                        {"role": "user", "content": test_prompt}
                    ],
                    temperature=0.7,
                    max_tokens=200
                )
                
                duration = int((time.time() - start_time) * 1000)
                
                print(f"✅ Відповідь ({duration}ms):")
                content = response.choices[0].message.content
                print(f'   "{content[:100]}..."')
                print(f"📊 Токени: {response.usage.total_tokens} (prompt: {response.usage.prompt_tokens}, completion: {response.usage.completion_tokens})\n")
                
            except Exception as error:
                status = getattr(error, 'status', None) or getattr(getattr(error, 'response', None), 'status', None)
                body = ''
                resp = getattr(error, 'response', None)
                if resp is not None and hasattr(resp, 'data') and resp.data is not None:
                    try:
                        import json as _json
                        body = _json.dumps(resp.data)[:500]
                    except Exception:
                        body = str(resp.data)[:500]
                msg = str(error)
                print(f"❌ Помилка{f' ({status})' if status else ''}: {body or msg}\n")
                
    except Exception as error:
        status = getattr(error, 'status', None) or getattr(getattr(error, 'response', None), 'status', None)
        body = ''
        resp = getattr(error, 'response', None)
        if resp is not None and hasattr(resp, 'data') and resp.data is not None:
            try:
                import json as _json
                body = _json.dumps(resp.data)[:500]
            except Exception:
                body = str(resp.data)[:500]
        print(f"❌ Помилка підключення{f' ({status})' if status else ''}: {body or error}")

def interactive_chat():
    """Інтерактивний чат"""
    print("\n💬 Інтерактивний чат (введіть 'exit' для виходу)\n")
    
    messages = [
        {"role": "system", "content": "Ти корисний AI асистент, який відповідає українською мовою."}
    ]
    
    model = 'microsoft/phi-3-mini-4k-instruct'  # Використовуємо стабільну модель
    
    while True:
        try:
            user_input = input("👤 Ви: ").strip()
            
            if user_input.lower() == 'exit':
                break
                
            if user_input:
                messages.append({"role": "user", "content": user_input})
                
                try:
                    print("🤖 Думаю...")
                    
                    response = client.chat.completions.create(
                        model=model,
                        messages=messages,
                        temperature=0.7,
                        max_tokens=500
                    )
                    
                    assistant_message = response.choices[0].message.content
                    messages.append({"role": "assistant", "content": assistant_message})
                    
                    print(f"🤖 AI: {assistant_message}\n")
                    
                except Exception as error:
                    print(f"❌ Помилка: {error}\n")
                    
        except KeyboardInterrupt:
            print("\n👋 До побачення!")
            break

def test_streaming():
    """Тестування стрімінгу"""
    print("\n🌊 Тестування стрімінгу...\n")
    
    try:
        response = client.chat.completions.create(
            model='microsoft/phi-3-mini-4k-instruct',
            messages=[
                {"role": "system", "content": "Ти корисний AI асистент, який відповідає українською мовою."},
                {"role": "user", "content": "Розкажи коротку історію про роботів майбутнього."}
            ],
            stream=True,
            temperature=0.7,
            max_tokens=300
        )
        
        print("🤖 AI (streaming): ")
        print("   ", end="", flush=True)
        
        for chunk in response:
            if chunk.choices[0].delta.content is not None:
                print(chunk.choices[0].delta.content, end="", flush=True)
        
        print("\n✅ Стрімінг завершено\n")
        
    except Exception as error:
        print(f"❌ Помилка стрімінгу: {error}")

def test_multiple_turns():
    """Тестування багатоходової розмови"""
    print("\n🔄 Тестування багатоходової розмови...\n")
    
    try:
        messages = [
            {"role": "system", "content": "Ти корисний AI асистент, який відповідає українською мовою."},
            {"role": "user", "content": "Як тебе звати?"},
            {"role": "assistant", "content": "Я AI асистент, створений для допомоги вам."},
            {"role": "user", "content": "А що ти можеш робити?"}
        ]
        
        response = client.chat.completions.create(
            model='microsoft/phi-3-mini-4k-instruct',
            messages=messages,
            temperature=0.7,
            max_tokens=300
        )
        
        print("🤖 Відповідь на багатоходову розмову:")
        print(f"   {response.choices[0].message.content}")
        print(f"📊 Токени: {response.usage.total_tokens}\n")
        
    except Exception as error:
        print(f"❌ Помилка: {error}")

def test_tts():
    """Інформація про TTS API"""
    print("🔊 Тестування TTS API...\n")
    
    tts_url = "https://8a42c760f69d.ngrok-free.app/tts?text=Привіт%20від%20вашого%20AI%20асистента!"
    print(f"🌐 TTS URL: {tts_url}")
    print("💡 Відкрийте це посилання в браузері, щоб прослухати аудіо\n")

def show_usage():
    """Показати інформацію про використання"""
    print("💡 Додаткові опції:")
    print("   --chat, -c     : Інтерактивний чат")
    print("   --stream, -s   : Тестування стрімінгу")
    print("   --tts, -t      : Тестування TTS")
    print("   --full, -f     : Повний тест усіх функцій")
    print("   --help, -h     : Показати цю довідку\n")

def main():
    """Головна функція"""
    args = sys.argv[1:]
    
    if '--help' in args or '-h' in args:
        show_usage()
        return
    
    if '--chat' in args or '-c' in args:
        interactive_chat()
    elif '--stream' in args or '-s' in args:
        test_streaming()
    elif '--tts' in args or '-t' in args:
        test_tts()
    elif '--full' in args or '-f' in args:
        test_models()
        test_streaming()
        test_multiple_turns()
        test_tts()
        interactive_chat()
    else:
        # Базовий тест за замовчуванням
        test_models()
        test_multiple_turns()
        show_usage()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n👋 Програму завершено користувачем")
    except Exception as e:
        print(f"❌ Критична помилка: {e}")
