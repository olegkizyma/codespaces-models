#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

const AVAILABLE_MODELS = [
  'gpt-4o-mini',
  'gpt-4o', 
  'Phi-3.5-mini-instruct',
  'AI21-Jamba-1.5-Large',
  'Meta-Llama-3.1-405B-Instruct',
  'Cohere-command-r-plus'
];

class CodeGenerator {
  generateBasicJS(model, prompt) {
    return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'dummy-key',
  baseURL: 'http://localhost:3010/v1'
});

async function main() {
  try {
    const response = await client.chat.completions.create({
      model: '${model}',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: '${prompt}' }
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

  generateInteractiveJS(model) {
    return `import OpenAI from 'openai';
import readline from 'readline';

const client = new OpenAI({
  apiKey: 'dummy-key',
  baseURL: 'http://localhost:3010/v1'
});

class ChatSession {
  constructor(model, systemPrompt = 'You are a helpful assistant.') {
    this.model = model;
    this.messages = [{ role: 'system', content: systemPrompt }];
  }

  async chat(userMessage) {
    this.messages.push({ role: 'user', content: userMessage });
    
    try {
      const response = await client.chat.completions.create({
        model: this.model,
        messages: this.messages,
        temperature: 0.7,
        max_tokens: 1000
      });

      const assistantMessage = response.choices[0].message.content;
      this.messages.push({ role: 'assistant', content: assistantMessage });
      
      return {
        message: assistantMessage,
        usage: response.usage
      };
    } catch (error) {
      this.messages.pop();
      throw error;
    }
  }
}

async function main() {
  const chat = new ChatSession('${model}');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🤖 Interactive Chat Started! Type "quit" to exit.');
  
  while (true) {
    const userInput = await new Promise(resolve => {
      rl.question('You: ', resolve);
    });

    if (userInput.toLowerCase() === 'quit') {
      break;
    }

    try {
      const result = await chat.chat(userInput);
      console.log('Assistant:', result.message);
      console.log('Usage:', result.usage);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  rl.close();
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
    model = "${model}"
    prompt = "${prompt}"
    
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
    main()`;
  }

  generateBashScript(model, prompt) {
    return `#!/bin/bash

MODEL="${model}"
PROMPT="${prompt}"

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
    const { model = 'gpt-4o-mini', prompt = 'Hello, world!' } = options;
    
    switch (language) {
      case 'js':
        if (type === 'interactive') {
          return this.generateInteractiveJS(model);
        }
        return this.generateBasicJS(model, prompt);
      
      case 'python':
        return this.generateBasicPython(model, prompt);
        
      case 'bash':
        return this.generateBashScript(model, prompt);
        
      default:
        throw new Error(`Unknown language: ${language}`);
    }
  }

  async saveToFile(code, filename) {
    const dir = path.dirname(filename);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filename, code);
    console.log(`✅ Generated: ${filename}`);
    
    // Make scripts executable
    if (filename.endsWith('.sh') || filename.endsWith('.py')) {
      await fs.chmod(filename, '755');
    }
  }

  async generateAll() {
    const outputDir = './generated-examples';
    
    const examples = [
      { type: 'basic', lang: 'js', file: 'js/basic-chat.mjs', 
        options: { model: 'gpt-4o-mini', prompt: 'Explain AI in simple terms' }},
      { type: 'interactive', lang: 'js', file: 'js/interactive-chat.mjs',
        options: { model: 'gpt-4o-mini' }},
      { type: 'basic', lang: 'python', file: 'python/basic_chat.py',
        options: { model: 'gpt-4o-mini', prompt: 'Tell me a joke' }},
      { type: 'basic', lang: 'bash', file: 'shell/basic-test.sh',
        options: { model: 'gpt-4o-mini', prompt: 'What is machine learning?' }}
    ];

    console.log('🛠️  Generating code examples...');

    for (const example of examples) {
      try {
        const code = this.generateCode(example.type, example.lang, example.options);
        await this.saveToFile(code, path.join(outputDir, example.file));
      } catch (error) {
        console.error(`❌ Failed to generate ${example.file}: ${error.message}`);
      }
    }

    // Create README
    const readmeContent = `# 🛠️ Generated Code Examples

Auto-generated examples for the OpenAI LLM Proxy.

## Structure

- \`js/\` - JavaScript/Node.js examples  
- \`python/\` - Python examples
- \`shell/\` - Shell/curl examples

## Usage

Make sure your server is running:
\`\`\`bash
npm start
\`\`\`

Then run examples:
\`\`\`bash
# JavaScript
node js/basic-chat.mjs
node js/interactive-chat.mjs

# Python
python3 python/basic_chat.py

# Shell
./shell/basic-test.sh
\`\`\`

Generated: ${new Date().toISOString()}
`;

    await this.saveToFile(readmeContent, path.join(outputDir, 'README.md'));

    console.log(`\\n🎉 Examples generated in '${outputDir}' folder!`);
    console.log('\\n📋 Available models:');
    AVAILABLE_MODELS.forEach(model => console.log(`  - ${model}`));
  }
}

// CLI
async function main() {
  console.log('🚀 Starting Code Generator...');
  const generator = new CodeGenerator();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('🔄 Generating all examples...');
    await generator.generateAll();
  } else {
    const [type, language, model, ...promptParts] = args;
    const prompt = promptParts.join(' ') || 'Hello, world!';
    
    try {
      const code = generator.generateCode(type, language, { model, prompt });
      console.log(code);
    } catch (error) {
      console.error(`❌ ${error.message}`);
      console.log('\\nUsage: node code-generator.mjs [type] [language] [model] [prompt]');
      console.log('Types: basic, interactive');
      console.log('Languages: js, python, bash');
    }
  }
}

main().catch(console.error);
