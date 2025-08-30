import OpenAI from 'openai';
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
  const chat = new ChatSession('gpt-4o-mini');
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

main();