#!/usr/bin/env node

/**
 * 🔧 Model Configuration Helper  
 * Допомагає налаштувати та перевірити моделі
 */

import fs from 'fs/promises';
import OpenAI from 'openai';

const DEFAULT_CONFIG = {
  server: {
    port: 3010,
    host: 'localhost'
  },
  models: {
    enabled: [
      'gpt-4o-mini',
      'gpt-4o',
      'Phi-3.5-mini-instruct'
    ],
    default: 'gpt-4o-mini'
  },
  api: {
    timeout: 30000,
    retries: 3
  }
};

class ModelHelper {
  constructor() {
    this.client = new OpenAI({
      apiKey: 'dummy-key',
      baseURL: `http://localhost:${DEFAULT_CONFIG.server.port}/v1`
    });
  }

  async checkServerStatus() {
    try {
      const response = await fetch(`http://localhost:${DEFAULT_CONFIG.server.port}/health`);
      if (response.ok) {
        const data = await response.json();
        return { running: true, data };
      }
      return { running: false, error: 'Server not responding' };
    } catch (error) {
      return { running: false, error: error.message };
    }
  }

  async listAvailableModels() {
    try {
      const response = await this.client.models.list();
      return response.data.map(model => ({
        id: model.id,
        created: new Date(model.created * 1000),
        owned_by: model.owned_by
      }));
    } catch (error) {
      throw new Error(`Failed to list models: ${error.message}`);
    }
  }

  async testModel(modelId, prompt = 'Hello, world!') {
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100
      });

      return {
        success: true,
        duration: Date.now() - startTime,
        response: response.choices[0].message.content,
        usage: response.usage
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async generateConfig(outputPath = './model-config.json') {
    const config = {
      ...DEFAULT_CONFIG,
      generated: new Date().toISOString(),
      version: '1.0.0'
    };

    try {
      await fs.writeFile(outputPath, JSON.stringify(config, null, 2));
      console.log(`✅ Configuration saved to: ${outputPath}`);
      return config;
    } catch (error) {
      console.error(`❌ Failed to save config: ${error.message}`);
      throw error;
    }
  }

  async healthCheck() {
    console.log('🔍 Running Health Check...\n');
    
    // 1. Server Status
    console.log('📡 Checking server status...');
    const serverStatus = await this.checkServerStatus();
    
    if (serverStatus.running) {
      console.log('✅ Server is running');
      console.log(`   Port: ${DEFAULT_CONFIG.server.port}`);
    } else {
      console.log('❌ Server is not running');
      console.log(`   Error: ${serverStatus.error}`);
      return;
    }

    // 2. Available Models
    console.log('\n🤖 Checking available models...');
    try {
      const models = await this.listAvailableModels();
      console.log(`✅ Found ${models.length} models:`);
      models.forEach(model => {
        console.log(`   - ${model.id} (${model.owned_by})`);
      });
    } catch (error) {
      console.log(`❌ Failed to list models: ${error.message}`);
      return;
    }

    // 3. Model Tests
    console.log('\n🧪 Testing models...');
    const testModels = DEFAULT_CONFIG.models.enabled.slice(0, 3); // Test first 3
    
    for (const modelId of testModels) {
      console.log(`Testing ${modelId}...`);
      const result = await this.testModel(modelId, 'Hi! How are you?');
      
      if (result.success) {
        console.log(`  ✅ ${result.duration}ms - ${result.usage?.total_tokens || 0} tokens`);
      } else {
        console.log(`  ❌ ${result.error}`);
      }
    }

    console.log('\n🎉 Health check complete!');
  }

  async interactiveSetup() {
    console.log('⚙️  Interactive Model Setup\n');
    
    // Generate default config
    console.log('📝 Generating default configuration...');
    await this.generateConfig();
    
    // Health check
    await this.healthCheck();
    
    console.log('\n✅ Setup complete! Use these commands:');
    console.log('   npm start              # Start server');
    console.log('   node quick-test.mjs    # Test models');
    console.log('   node model-helper.mjs health  # Health check');
  }

  async showUsage() {
    console.log(`
🔧 Model Configuration Helper

Usage:
  node model-helper.mjs [command]

Commands:
  health      Run complete health check
  models      List available models  
  test MODEL  Test specific model
  config      Generate configuration file
  setup       Interactive setup

Examples:
  node model-helper.mjs health
  node model-helper.mjs test gpt-4o-mini
  node model-helper.mjs models
`);
  }
}

// CLI
async function main() {
  const helper = new ModelHelper();
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case 'health':
        await helper.healthCheck();
        break;
        
      case 'models':
        console.log('🤖 Available Models:');
        const models = await helper.listAvailableModels();
        models.forEach(model => {
          console.log(`  ${model.id} (${model.owned_by})`);
        });
        break;
        
      case 'test':
        if (!args[0]) {
          console.log('❌ Please specify a model to test');
          break;
        }
        console.log(`🧪 Testing ${args[0]}...`);
        const result = await helper.testModel(args[0], args.slice(1).join(' ') || 'Hello!');
        console.log(result.success ? `✅ Success: ${result.response}` : `❌ Error: ${result.error}`);
        break;
        
      case 'config':
        await helper.generateConfig();
        break;
        
      case 'setup':
        await helper.interactiveSetup();
        break;
        
      default:
        await helper.showUsage();
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

main().catch(console.error);
