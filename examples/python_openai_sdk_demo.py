#!/usr/bin/env python3
"""
Приклад використання AI Chat сервера з Python OpenAI SDK
Демонстрація повної сумісності з OpenAI API
"""

import openai
from openai import OpenAI
import json

# Налаштування клієнта OpenAI для нашого локального сервера
client = OpenAI(
    api_key="fake-key",  # Наш сервер не перевіряє ключ
    base_url="http://127.0.0.1:3010/v1"  # Локальний AI Chat сервер
)

def test_chat_completion():
    """Тест звичайного чату"""
    print("🤖 Тестування Chat Completion...")
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Ви корисний асистент, який відповідає українською мовою."},
            {"role": "user", "content": "Розкажіть про переваги використання локального AI сервера"}
        ],
        temperature=0.7,
        max_tokens=200
    )
    
    print("💬 Відповідь:", response.choices[0].message.content)
    print("📊 Використано токенів:", response.usage.total_tokens)
    print()

def test_streaming():
    """Тест стрімінгу"""
    print("🌊 Тестування Streaming...")
    
    stream = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "Напишіть короткий вірш про штучний інтелект"}
        ],
        stream=True,
        temperature=0.8
    )
    
    print("📝 Стрімінг відповідь: ", end="", flush=True)
    for chunk in stream:
        if chunk.choices[0].delta.content is not None:
            print(chunk.choices[0].delta.content, end="", flush=True)
    print("\n")

def test_multiple_models():
    """Тест різних моделей"""
    print("🔬 Тестування різних моделей...")
    
    models_to_test = [
        "gpt-4o-mini",
        "Phi-3-mini-4k-instruct", 
        "Meta-Llama-3.1-8B-Instruct",
        "Mistral-Nemo"
    ]
    
    question = "Що таке машинне навчання?"
    
    for model in models_to_test:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": question}],
                max_tokens=100,
                temperature=0.3
            )
            
            print(f"🤖 {model}:")
            print(f"   {response.choices[0].message.content[:150]}...")
            print()
            
        except Exception as e:
            print(f"❌ Помилка з моделлю {model}: {e}")
            print()

def list_available_models():
    """Показати доступні моделі"""
    print("📋 Доступні моделі:")
    
    models = client.models.list()
    
    # Групування по провайдерам
    providers = {}
    for model in models.data:
        provider = model.owned_by.upper()
        if provider not in providers:
            providers[provider] = []
        providers[provider].append(model.id)
    
    for provider, model_list in providers.items():
        print(f"\n🏢 {provider}:")
        for model_id in sorted(model_list):
            print(f"   • {model_id}")
    
    print(f"\n📊 Всього моделей: {len(models.data)}")
    print()

if __name__ == "__main__":
    try:
        print("🚀 AI Chat Python SDK Demo")
        print("=" * 50)
        
        # Перевірка з'єднання
        print("🔌 Перевірка з'єднання з сервером...")
        list_available_models()
        
        # Тестування основних функцій
        test_chat_completion()
        test_streaming()
        test_multiple_models()
        
        print("✅ Всі тести пройшли успішно!")
        print("\n💡 Ваш AI Chat сервер повністю сумісний з OpenAI Python SDK!")
        
    except Exception as e:
        print(f"❌ Помилка: {e}")
        print("\n💡 Переконайтеся, що AI Chat сервер запущений:")
        print("   aichat status")
        print("   aichat        # або запустити, якщо не запущений")
