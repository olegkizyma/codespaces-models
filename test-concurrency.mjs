#!/usr/bin/env node

/**
 * Тести одночасності та навантаження для API сервера
 * Перевіряє як система обробляє паралельні запити
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const TEST_MODEL = process.env.TEST_MODEL || 'openai/gpt-4o-mini';

class ConcurrencyTester {
  constructor() {
    this.results = [];
    this.errors = [];
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      concurrentRequestsHandled: 0
    };
  }

  async makeRequest(endpoint, body, id) {
    const startTime = performance.now();
    const requestInfo = {
      id,
      endpoint,
      startTime,
      endTime: null,
      duration: null,
      status: null,
      success: false,
      error: null,
      responseSize: 0
    };

    try {
      console.log(`📡 [${id}] Відправляю запит до ${endpoint}`);
      
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy-key'
        },
        body: JSON.stringify(body)
      });

      const endTime = performance.now();
      const responseText = await response.text();
      
      requestInfo.endTime = endTime;
      requestInfo.duration = endTime - startTime;
      requestInfo.status = response.status;
      requestInfo.success = response.ok;
      requestInfo.responseSize = responseText.length;

      if (!response.ok) {
        requestInfo.error = `HTTP ${response.status}: ${responseText}`;
        this.errors.push(requestInfo);
      } else {
        try {
          const jsonResponse = JSON.parse(responseText);
          requestInfo.tokens = jsonResponse.usage?.total_tokens || 0;
        } catch (e) {
          // Response не JSON, це нормально для деяких endpoint'ів
        }
      }

      console.log(`✅ [${id}] Відповідь отримана за ${requestInfo.duration.toFixed(2)}ms (статус: ${response.status})`);
      
    } catch (error) {
      const endTime = performance.now();
      requestInfo.endTime = endTime;
      requestInfo.duration = endTime - startTime;
      requestInfo.error = error.message;
      requestInfo.success = false;
      
      console.log(`❌ [${id}] Помилка: ${error.message}`);
      this.errors.push(requestInfo);
    }

    this.results.push(requestInfo);
    return requestInfo;
  }

  async testSimpleConcurrency() {
    console.log('\\n🔥 ТЕСТ 1: Простий тест одночасності (3 паралельні запити)');
    console.log('='.repeat(60));

    const requests = [
      this.makeRequest('/v1/simple-chat', {
        model: TEST_MODEL,
        message: 'Привіт! Як справи?'
      }, 'REQ-1'),
      
      this.makeRequest('/v1/simple-chat', {
        model: TEST_MODEL,
        message: 'Розкажи мені про Node.js'
      }, 'REQ-2'),
      
      this.makeRequest('/v1/simple-chat', {
        model: TEST_MODEL,
        message: 'Що таке конкурентність?'
      }, 'REQ-3')
    ];

    const results = await Promise.allSettled(requests);
    return this.analyzeResults(results, 'Simple Concurrency');
  }

  async testOpenAIConcurrency() {
    console.log('\\n🔥 ТЕСТ 2: OpenAI API одночасність (5 паралельних запитів)');
    console.log('='.repeat(60));

    const requests = [];
    for (let i = 1; i <= 5; i++) {
      requests.push(
        this.makeRequest('/v1/chat/completions', {
          model: TEST_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: `Це тестовий запит номер ${i}. Дай коротку відповідь.` }
          ],
          max_tokens: 50,
          temperature: 0.7
        }, `OPENAI-${i}`)
      );
    }

    const results = await Promise.allSettled(requests);
    return this.analyzeResults(results, 'OpenAI Concurrency');
  }

  async testMixedEndpoints() {
    console.log('\\n🔥 ТЕСТ 3: Змішані endpoints (різні типи запитів одночасно)');
    console.log('='.repeat(60));

    const requests = [
      // Health check
      this.makeRequest('/health', {}, 'HEALTH'),
      
      // Models list
      fetch(`${BASE_URL}/v1/models`).then(async (res) => ({
        id: 'MODELS',
        success: res.ok,
        status: res.status,
        duration: 0, // Спрощено для цього тесту
        responseSize: (await res.text()).length
      })),
      
      // Simple chat
      this.makeRequest('/v1/simple-chat', {
        model: TEST_MODEL,
        message: 'Коротка відповідь про погоду'
      }, 'CHAT-1'),
      
      // OpenAI completions
      this.makeRequest('/v1/chat/completions', {
        model: TEST_MODEL,
        messages: [{ role: 'user', content: 'Привіт' }],
        max_tokens: 20
      }, 'OPENAI-1'),
      
      // Test model
      this.makeRequest('/v1/test-model', {
        model: TEST_MODEL
      }, 'TEST-MODEL')
    ];

    const results = await Promise.allSettled(requests);
    return this.analyzeResults(results, 'Mixed Endpoints');
  }

  async testHighLoad() {
    console.log('\\n🔥 ТЕСТ 4: Високе навантаження (10 одночасних запитів)');
    console.log('='.repeat(60));

    const requests = [];
    for (let i = 1; i <= 10; i++) {
      requests.push(
        this.makeRequest('/v1/simple-chat', {
          model: TEST_MODEL,
          message: `Запит №${i} - дай дуже коротку відповідь (1-2 слова)`
        }, `LOAD-${i}`)
      );
    }

    const startTime = performance.now();
    const results = await Promise.allSettled(requests);
    const totalTime = performance.now() - startTime;

    console.log(`⏱️  Загальний час виконання 10 запитів: ${totalTime.toFixed(2)}ms`);
    
    return this.analyzeResults(results, 'High Load', { totalTime });
  }

  async testSequentialVsParallel() {
    console.log('\\n🔥 ТЕСТ 5: Послідовний vs Паралельний (порівняння продуктивності)');
    console.log('='.repeat(60));

    const testMessage = 'Коротка відповідь про JavaScript';
    
    // Послідовний виконання
    console.log('📊 Послідовне виконання 3 запитів...');
    const sequentialStart = performance.now();
    
    await this.makeRequest('/v1/simple-chat', { model: TEST_MODEL, message: testMessage }, 'SEQ-1');
    await this.makeRequest('/v1/simple-chat', { model: TEST_MODEL, message: testMessage }, 'SEQ-2');
    await this.makeRequest('/v1/simple-chat', { model: TEST_MODEL, message: testMessage }, 'SEQ-3');
    
    const sequentialTime = performance.now() - sequentialStart;
    
    // Паралельне виконання
    console.log('📊 Паралельне виконання 3 запитів...');
    const parallelStart = performance.now();
    
    await Promise.all([
      this.makeRequest('/v1/simple-chat', { model: TEST_MODEL, message: testMessage }, 'PAR-1'),
      this.makeRequest('/v1/simple-chat', { model: TEST_MODEL, message: testMessage }, 'PAR-2'),
      this.makeRequest('/v1/simple-chat', { model: TEST_MODEL, message: testMessage }, 'PAR-3')
    ]);
    
    const parallelTime = performance.now() - parallelStart;
    
    console.log(`\\n📈 РЕЗУЛЬТАТИ ПОРІВНЯННЯ:`);
    console.log(`   Послідовно: ${sequentialTime.toFixed(2)}ms`);
    console.log(`   Паралельно: ${parallelTime.toFixed(2)}ms`);
    console.log(`   Прискорення: ${(sequentialTime / parallelTime).toFixed(2)}x`);
    
    return {
      sequential: sequentialTime,
      parallel: parallelTime,
      speedup: sequentialTime / parallelTime
    };
  }

  analyzeResults(results, testName, additionalInfo = {}) {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    if (successful.length > 0) {
      const durations = successful.map(r => r.duration);
      this.metrics.averageResponseTime = durations.reduce((a, b) => a + b) / durations.length;
      this.metrics.minResponseTime = Math.min(...durations);
      this.metrics.maxResponseTime = Math.max(...durations);
    }
    
    this.metrics.totalRequests = this.results.length;
    this.metrics.successfulRequests = successful.length;
    this.metrics.failedRequests = failed.length;

    console.log(`\\n📊 РЕЗУЛЬТАТИ ТЕСТУ: ${testName}`);
    console.log(`   ✅ Успішні запити: ${successful.length}/${this.results.length}`);
    console.log(`   ❌ Невдалі запити: ${failed.length}`);
    
    if (successful.length > 0) {
      console.log(`   ⏱️  Середній час відповіді: ${this.metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`   ⚡ Найшвидший: ${this.metrics.minResponseTime.toFixed(2)}ms`);
      console.log(`   🐌 Найповільніший: ${this.metrics.maxResponseTime.toFixed(2)}ms`);
    }
    
    if (failed.length > 0) {
      console.log(`\\n❌ ПОМИЛКИ:`);
      failed.forEach(f => {
        console.log(`   [${f.id}] ${f.error}`);
      });
    }

    if (additionalInfo.totalTime) {
      console.log(`   🕐 Загальний час: ${additionalInfo.totalTime.toFixed(2)}ms`);
    }

    // Очищуємо результати для наступного тесту
    const testResults = [...this.results];
    this.results = [];
    
    return {
      testName,
      successful: successful.length,
      failed: failed.length,
      total: testResults.length,
      metrics: { ...this.metrics },
      additionalInfo
    };
  }

  async checkServerHealth() {
    console.log('🏥 Перевірка доступності сервера...');
    
    try {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Сервер працює (${data.status}) - ${data.models} моделей доступно`);
        return true;
      } else {
        console.log(`❌ Сервер недоступний: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Не вдалося підключитися до сервера: ${error.message}`);
      console.log(`   Переконайтеся, що сервер запущено на ${BASE_URL}`);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 ЗАПУСК ТЕСТІВ ОДНОЧАСНОСТІ ТА НАВАНТАЖЕННЯ');
    console.log('='.repeat(80));
    console.log(`📍 Базовий URL: ${BASE_URL}`);
    console.log(`🤖 Тестова модель: ${TEST_MODEL}`);
    console.log('='.repeat(80));

    // Перевірка доступності сервера
    const isHealthy = await this.checkServerHealth();
    if (!isHealthy) {
      console.log('\\n❌ Сервер недоступний. Завершення тестів.');
      process.exit(1);
    }

    const allResults = [];

    try {
      // Запуск усіх тестів
      allResults.push(await this.testSimpleConcurrency());
      allResults.push(await this.testOpenAIConcurrency());
      allResults.push(await this.testMixedEndpoints());
      allResults.push(await this.testHighLoad());
      
      const performanceComparison = await this.testSequentialVsParallel();

      // Підсумковий звіт
      console.log('\\n' + '='.repeat(80));
      console.log('📋 ПІДСУМКОВИЙ ЗВІТ');
      console.log('='.repeat(80));

      allResults.forEach(result => {
        const successRate = ((result.successful / result.total) * 100).toFixed(1);
        console.log(`📊 ${result.testName}:`);
        console.log(`   Успішність: ${successRate}% (${result.successful}/${result.total})`);
        if (result.metrics.averageResponseTime > 0) {
          console.log(`   Сер. час: ${result.metrics.averageResponseTime.toFixed(2)}ms`);
        }
        console.log('');
      });

      console.log(`🏃 Паралельна обробка працює в ${performanceComparison.speedup.toFixed(2)}x швидше`);

      // Загальні висновки
      const totalRequests = allResults.reduce((sum, r) => sum + r.total, 0);
      const totalSuccessful = allResults.reduce((sum, r) => sum + r.successful, 0);
      const overallSuccessRate = ((totalSuccessful / totalRequests) * 100).toFixed(1);

      console.log('\\n🎯 ЗАГАЛЬНІ ВИСНОВКИ:');
      console.log(`   📈 Загальна успішність: ${overallSuccessRate}% (${totalSuccessful}/${totalRequests})`);
      
      if (overallSuccessRate >= 95) {
        console.log('   ✅ Система відмінно справляється з одночасними запитами');
      } else if (overallSuccessRate >= 80) {
        console.log('   ⚠️  Система задовільно справляється, але є місце для покращень');
      } else {
        console.log('   ❌ Система має проблеми з одночасністю, потрібна оптимізація');
      }

      if (this.errors.length > 0) {
        console.log(`\\n⚠️  Виявлено ${this.errors.length} помилок. Рекомендації:`);
        console.log('   • Перевірте налаштування rate limiting');
        console.log('   • Розгляньте додавання черги запитів');
        console.log('   • Оптимізуйте обробку помилок');
      }

    } catch (error) {
      console.error('❌ Критична помилка під час тестування:', error.message);
    }
  }
}

// Запуск тестів
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ConcurrencyTester();
  tester.runAllTests().catch(console.error);
}

export default ConcurrencyTester;
