#!/usr/bin/env python3

from openai import OpenAI
import time

client = OpenAI(
    base_url="http://localhost:3010/v1",
    api_key="dummy-key"
)

def chat_with_model(model: str, prompt: str):
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
        usage = response.usage.dict() if response.usage else {}
        
        return {
            "success": True,
            "content": content,
            "usage": usage,
            "duration": duration
        }
        
    except Exception as error:
        return {
            "success": False,
            "error": str(error),
            "duration": time.time() - start_time
        }

def main():
    model = "gpt-4o-mini"
    prompt = "Tell me a joke"
    
    print(f"🤖 Testing model: {model}")
    print(f"💬 Prompt: {prompt}")
    print("=" * 50)
    
    result = chat_with_model(model, prompt)
    
    if result["success"]:
        print("✅ Response received!")
        print(f"📄 Content: {result['content']}")
        print(f"⏱️  Duration: {result['duration']:.2f}s")
        print(f"📊 Usage: {result['usage']}")
    else:
        print(f"❌ Error: {result['error']}")

if __name__ == "__main__":
    main()