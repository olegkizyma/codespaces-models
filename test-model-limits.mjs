#!/usr/bin/env node

/**
 * Демонстрація роботи з лімітами моделей
 * Показує як правильно обробляти rate limits та token limits
 */

import OpenAI from 'openai';

const API_BASE_URL = 'http://localhost:3010/v1';
const client = new OpenAI({
  apiKey: 'dummy-key',
  baseURL: API_BASE_URL,
});

// Тест різних моделей з їх лімітами
const MODEL_TESTS = [
  {
    name: 'gpt-4o-mini',
    description: 'Швидка модель (128K контекст)',
    maxTokens: 1000,
    expectedSpeed: 'Дуже швидко'
  },
  {
    name: 'Meta-Llama-3.1-405B-Instruct',
    description: 'Найбільша модель (128K контекст)',
    maxTokens: 500, // Менше токенів через ліміти
    expectedSpeed: 'Повільно'
  },
  {
    name: 'Phi-3-mini-4k-instruct',
    description: 'Економна модель (4K контекст)',
    maxTokens: 800,
    expectedSpeed: 'Швидко'
  },
  {
    name: 'AI21-Jamba-1.5-Large',
    description: 'Найдовший контекст (256K токенів)',
    maxTokens: 1000,
    expectedSpeed: 'Повільно'
  },
  {
    name: 'microsoft/Phi-3.5-vision-instruct',
    description: 'Vision модель (128K + зображення)',
    maxTokens: 600,
    expectedSpeed: 'Середньо'
  }
];

async function testModelWithLimits(modelConfig) {
  console.log(`\n🧪 Тестування: ${modelConfig.name}`);
  console.log(`📋 Опис: ${modelConfig.description}`);
  console.log(`⚡ Очікувана швидкість: ${modelConfig.expectedSpeed}`);
  
  const startTime = Date.now();
  
  try {
    const response = await client.chat.completions.create({
      model: modelConfig.name,
      messages: [
        {
          role: 'user',
          content: 'Коротко розкажи про свої можливості та обмеження.'
        }
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: 0.7
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const usage = response.usage;
    
    console.log(`✅ Успіх за ${responseTime}ms`);
    console.log(`📊 Токени: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, response: ${usage.completion_tokens})`);
    console.log(`💬 Відповідь: ${response.choices[0].message.content.substring(0, 100)}...`);
    
    // Аналіз ефективності
    const tokensPerSecond = Math.round((usage.total_tokens / responseTime) * 1000);
    console.log(`🚀 Швидкість: ${tokensPerSecond} токенів/сек`);
    
    if (responseTime > 10000) {
      console.log(`⚠️  ПОВІЛЬНА МОДЕЛЬ: ${Math.round(responseTime/1000)}s - рекомендується кешування`);
    }
    
    if (usage.total_tokens > 2000) {
      console.log(`⚠️  ВИСОКЕ СПОЖИВАННЯ ТОКЕНІВ: ${usage.total_tokens} - оптимізуйте промпт`);
    }
    
  } catch (error) {
    console.log(`❌ Помилка: ${error.message}`);
    
    if (error.status === 429) {
      console.log(`🚨 RATE LIMIT: Занадто багато запитів`);
      console.log(`💡 Рекомендації:`);
      console.log(`   - Додайте затримку між запитами`);
      console.log(`   - Використовуйте exponential backoff`);
      console.log(`   - Виберіть менш навантажену модель`);
    }
    
    if (error.message.includes('context_length')) {
      console.log(`🚨 TOKEN LIMIT: Перевищено ліміт контексту`);
      console.log(`💡 Рекомендації:`);
      console.log(`   - Скоротіть промпт`);
      console.log(`   - Розбийте на менші частини`);
      console.log(`   - Виберіть модель з більшим контекстом`);
    }
  }
}

async function testRateLimits() {
  console.log('\n🔄 Тестування rate limits...');
  
  const quickModel = 'gpt-4o-mini';
  const slowModel = 'Meta-Llama-3.1-405B-Instruct';
  
  console.log(`\n⚡ Швидкі запити до ${quickModel}:`);
  for (let i = 1; i <= 5; i++) {
    try {
      const start = Date.now();
      await client.chat.completions.create({
        model: quickModel,
        messages: [{role: 'user', content: `Швидкий тест ${i}`}],
        max_tokens: 50
      });
      const time = Date.now() - start;
      console.log(`   ${i}/5: ${time}ms ✅`);
    } catch (error) {
      console.log(`   ${i}/5: ${error.message} ❌`);
    }
  }
  
  console.log(`\n🐌 Повільні запити до ${slowModel}:`);
  for (let i = 1; i <= 3; i++) {
    try {
      const start = Date.now();
      await client.chat.completions.create({
        model: slowModel,
        messages: [{role: 'user', content: `Повільний тест ${i}`}],
        max_tokens: 30
      });
      const time = Date.now() - start;
      console.log(`   ${i}/3: ${time}ms ✅`);
    } catch (error) {
      console.log(`   ${i}/3: ${error.message} ❌`);
    }
  }
}

async function demonstrateContextLimits() {
  console.log('\n📖 Тестування лімітів контексту...');
  
  // Короткий контекст (4K)
  const shortContextModel = 'Phi-3-mini-4k-instruct';
  // Довгий контекст (256K) 
  const longContextModel = 'AI21-Jamba-1.5-Large';
  
  const shortText = 'Коротький текст для тесту.';
  const longText = 'Це дуже довгий текст. '.repeat(500); // ~2500 токенів
  
  console.log(`\n📝 Короткий текст (${shortText.length} символів):`);
  
  // Тест з коротким контекстом
  try {
    const response = await client.chat.completions.create({
      model: shortContextModel,
      messages: [{role: 'user', content: shortText + ' Прокоментуй цей текст.'}],
      max_tokens: 100
    });
    console.log(`   ${shortContextModel}: ✅ Успіх`);
  } catch (error) {
    console.log(`   ${shortContextModel}: ❌ ${error.message}`);
  }
  
  console.log(`\n📚 Довгий текст (${longText.length} символів):`);
  
  // Тест з коротким контекстом на довгому тексті
  try {
    const response = await client.chat.completions.create({
      model: shortContextModel,
      messages: [{role: 'user', content: longText + ' Прокоментуй цей текст.'}],
      max_tokens: 100
    });
    console.log(`   ${shortContextModel}: ✅ Несподіваний успіх`);
  } catch (error) {
    console.log(`   ${shortContextModel}: ❌ ${error.message.substring(0, 100)}...`);
  }
  
  // Тест з довгим контекстом
  try {
    const response = await client.chat.completions.create({
      model: longContextModel,
      messages: [{role: 'user', content: longText + ' Прокоментуй цей текст.'}],
      max_tokens: 100
    });
    console.log(`   ${longContextModel}: ✅ Успіх з довгим контекстом`);
  } catch (error) {
    console.log(`   ${longContextModel}: ❌ ${error.message}`);
  }
}

async function showBestPractices() {
  console.log('\n💡 Кращі практики роботи з лімітами:\n');
  
  console.log('🚀 Для швидкості:');
  console.log('   • gpt-4o-mini - найшвидша для простих завдань');
  console.log('   • Phi-3.5-mini-instruct - економна та швидка');
  console.log('   • Встановлюйте низький max_tokens для коротких відповідей\n');
  
  console.log('🧠 Для якості:');
  console.log('   • Meta-Llama-3.1-405B-Instruct - найвища якість');
  console.log('   • gpt-4o - універсальна потужна модель');
  console.log('   • Використовуйте temperature=0 для консистентності\n');
  
  console.log('📖 Для довгих текстів:');
  console.log('   • AI21-Jamba-1.5-Large - 256K контекст');
  console.log('   • Phi-3-small-128k-instruct - економна 128K');
  console.log('   • Розбивайте на частини якщо контекст перевищено\n');
  
  console.log('💰 Для економії:');
  console.log('   • Phi-3-mini-4k-instruct - найдешевша');
  console.log('   • Кешуйте результати повторюваних запитів');
  console.log('   • Оптимізуйте промпти - прибирайте зайві слова\n');
  
  console.log('⚠️  Для обробки помилок:');
  console.log('   • Використовуйте try/catch для всіх запитів');
  console.log('   • Перевіряйте error.status === 429 для rate limits');
  console.log('   • Додавайте exponential backoff при 429');
  console.log('   • Логуйте usage для моніторингу споживання\n');
}

// Головна функція
async function main() {
  console.log('📊 ДЕМОНСТРАЦІЯ ЛІМІТІВ ТА РЕКОМЕНДАЦІЙ МОДЕЛЕЙ\n');
  
  try {
    // Перевірка підключення
    const health = await fetch(`${API_BASE_URL.replace('/v1', '')}/`);
    const healthData = await health.json();
    
    if (!healthData.ok) {
      throw new Error('Сервер недоступний');
    }
    
    console.log('✅ Сервер працює\n');
    
    // Показати кращі практики
    await showBestPractices();
    
    // Тестування моделей
    console.log('🧪 ТЕСТУВАННЯ РІЗНИХ МОДЕЛЕЙ:\n');
    for (const modelConfig of MODEL_TESTS) {
      await testModelWithLimits(modelConfig);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Пауза між запитами
    }
    
    // Тестування rate limits
    await testRateLimits();
    
    // Тестування контекстних лімітів
    await demonstrateContextLimits();
    
    console.log('\n✅ Всі тести завершено!');
    console.log('\n📚 Детальні ліміти дивіться у файлі MODEL_LIMITS_RECOMMENDATIONS.md');
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    console.log('\n💡 Переконайтеся що сервер запущено: npm start');
  }
}

main();
