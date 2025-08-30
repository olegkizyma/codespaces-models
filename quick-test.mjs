#!/usr/bin/env node

/**
 * 🚀 Quick Model Tester
 * Швидке тестування моделі з інтерактивним вибором
 */

import OpenAI from 'openai';
import readline from 'readline';

const MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'Phi-3.5-mini-instruct', 
  'AI21-Jamba-1.5-Large',
  'Meta-Llama-3.1-405B-Instruct',
  'Cohere-command-r-plus'
];

const PROMPTS = [
  'What is the capital of France?',
  'Write a haiku about programming',
  'Solve: 2 + 2 * 3 = ?',
  'Explain quantum computing briefly',
  'What is the weather like?',
  'Custom prompt...'
];

const client = new OpenAI({
  apiKey: 'dummy-key',
  baseURL: 'http://localhost:3010/v1'
});

class QuickTester {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async selectModel() {
    console.log('\n🤖 Available Models:');
    MODELS.forEach((model, i) => {
      console.log(`${i + 1}. ${model}`);
    });

    const answer = await this.ask('\nSelect model (1-6): ');
    const index = parseInt(answer) - 1;
    
    if (index >= 0 && index < MODELS.length) {
      return MODELS[index];
    }
    throw new Error('Invalid selection');
  }

  async selectPrompt() {
    console.log('\n💬 Quick Prompts:');
    PROMPTS.forEach((prompt, i) => {
      console.log(`${i + 1}. ${prompt}`);
    });

    const answer = await this.ask('\nSelect prompt (1-6): ');
    const index = parseInt(answer) - 1;
    
    if (index >= 0 && index < PROMPTS.length - 1) {
      return PROMPTS[index];
    } else if (index === PROMPTS.length - 1) {
      return await this.ask('Enter custom prompt: ');
    }
    throw new Error('Invalid selection');
  }

  async testModel(model, prompt) {
    const startTime = Date.now();
    
    try {
      console.log('\n⏳ Testing...');
      
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const duration = Date.now() - startTime;
      const content = response.choices[0].message.content;
      const usage = response.usage;

      console.log('\n✅ Success!');
      console.log('═'.repeat(50));
      console.log('📄 Response:', content);
      console.log('═'.repeat(50));
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Tokens: ${usage.total_tokens} (in: ${usage.prompt_tokens}, out: ${usage.completion_tokens})`);
      
      return { success: true, content, duration, usage };
    } catch (error) {
      console.log('\n❌ Error!');
      console.log('═'.repeat(50));
      console.log('Error:', error.message);
      return { success: false, error: error.message, duration: Date.now() - startTime };
    }
  }

  async ask(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }

  async runInteractiveTest() {
    console.log('🚀 Quick Model Tester Started!');
    
    while (true) {
      try {
        const model = await this.selectModel();
        const prompt = await this.selectPrompt();
        
        console.log(`\n🎯 Testing: ${model}`);
        console.log(`💬 Prompt: "${prompt}"`);
        
        const result = await this.testModel(model, prompt);
        
        const again = await this.ask('\nTest another model? (y/n): ');
        if (again.toLowerCase() !== 'y') {
          break;
        }
        
      } catch (error) {
        console.error(`❌ ${error.message}`);
        const retry = await this.ask('Try again? (y/n): ');
        if (retry.toLowerCase() !== 'y') {
          break;
        }
      }
    }
    
    console.log('\n👋 Goodbye!');
    this.rl.close();
  }

  async runBenchmark() {
    console.log('🏆 Running Benchmark on All Models...\n');
    
    const testPrompt = 'What is artificial intelligence?';
    const results = [];

    for (const model of MODELS) {
      console.log(`Testing ${model}...`);
      const result = await this.testModel(model, testPrompt);
      results.push({ model, ...result });
      
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 Benchmark Results:');
    console.log('═'.repeat(80));
    
    results
      .sort((a, b) => a.duration - b.duration)
      .forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const duration = result.success ? `${result.duration}ms` : 'Failed';
        const tokens = result.success ? `${result.usage.total_tokens}t` : 'N/A';
        
        console.log(`${index + 1}. ${status} ${result.model.padEnd(25)} ${duration.padStart(8)} ${tokens.padStart(6)}`);
      });

    this.rl.close();
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const tester = new QuickTester();

  if (args.includes('--benchmark') || args.includes('-b')) {
    await tester.runBenchmark();
  } else {
    await tester.runInteractiveTest();
  }
}

main().catch(console.error);
