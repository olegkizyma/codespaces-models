#!/usr/bin/env node

/**
 * Демонстрація стандартного OpenAI API
 * Тестує сумісність з популярними інструментами
 */

import OpenAI from 'openai';

const API_BASE_URL = 'http://localhost:3010/v1';
const API_KEY = 'dummy-key'; // Може бути будь-яким

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: API_BASE_URL,
});

console.log('🚀 Тестування стандартного OpenAI API\n');

async function testModels() {
  console.log('📋 1. Отримання списку моделей...');
  try {
    const models = await client.models.list();
    console.log(`✅ Знайдено ${models.data.length} моделей:`);
    models.data.slice(0, 5).forEach(model => {
      console.log(`   • ${model.id} (${model.owned_by})`);
    });
    console.log(`   ... та ще ${models.data.length - 5} моделей\n`);
  } catch (error) {
    console.error('❌ Помилка при отриманні моделей:', error.message);
  }
}

async function testChat(modelName, prompt) {
  console.log(`💬 Тест чату з ${modelName}:`);
  console.log(`👤 Запит: "${prompt}"`);
  
  try {
    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    const response = completion.choices[0].message.content;
    const usage = completion.usage;
    
    console.log(`🤖 Відповідь: ${response.substring(0, 150)}...`);
    console.log(`📊 Токени: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`);
    console.log(`🏷️  Модель: ${completion.model}`);
    console.log('');
    
  } catch (error) {
    console.error(`❌ Помилка з ${modelName}:`, error.message);
    console.log('');
  }
}

async function testMultipleModels() {
  const testCases = [
    ['gpt-4o-mini', 'Привіт! Як справи?'],
    ['Meta-Llama-3.1-405B-Instruct', 'What makes you special as a large model?'],
    ['microsoft/Phi-3.5-vision-instruct', 'What can you do with images?'],
    ['AI21-Jamba-1.5-Large', 'Tell me about your capabilities'],
    ['Cohere-command-r-plus-08-2024', 'What are your strengths?']
  ];

  for (const [model, prompt] of testCases) {
    await testChat(model, prompt);
    // Невелика пауза між запитами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testErrorHandling() {
  console.log('🔧 3. Тестування обробки помилок...');
  try {
    await client.chat.completions.create({
      model: 'non-existent-model',
      messages: [{ role: 'user', content: 'Hello' }]
    });
  } catch (error) {
    console.log(`✅ Правильна обробка помилки: ${error.message}`);
  }
  console.log('');
}

// Головна функція
async function main() {
  try {
    // Перевірка з'єднання
    const response = await fetch(`${API_BASE_URL.replace('/v1', '')}/`);
    const health = await response.json();
    
    if (!health.ok) {
      throw new Error('Сервер недоступний');
    }
    
    console.log(`✅ Сервер працює: ${health.info}\n`);
    
    // Тестування
    await testModels();
    await testMultipleModels();
    await testErrorHandling();
    
    console.log('🎉 Всі тести завершено успішно!');
    console.log('\n📚 Документація:');
    console.log('   • STANDARD_OPENAI_API.md - повний гід по стандартному API');
    console.log('   • AVAILABLE_MODELS.md - список всіх моделей');
    console.log('   • http://localhost:3010/ui/ - веб-інтерфейс');
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    console.log('\n💡 Переконайтеся що сервер запущено: npm start');
  }
}

main();
