#!/usr/bin/env node

/**
 * Розширені стрес-тести для перевірки поведінки під навантаженням
 * Симулює реальні сценарії використання API
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const TEST_MODEL = process.env.TEST_MODEL || 'openai/gpt-4o-mini';

class StressTester {
  constructor() {
    this.activeRequests = new Set();
    this.completedRequests = [];
    this.errors = [];
    this.startTime = null;
  }

  async makeTimedRequest(endpoint, body, id, timeout = 30000) {
    const requestStart = performance.now();
    const requestInfo = {
      id,
      endpoint,
      startTime: requestStart,
      endTime: null,
      duration: null,
      status: null,
      success: false,
      error: null,
      timeout: false
    };

    this.activeRequests.add(requestInfo);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        requestInfo.timeout = true;
      }, timeout);

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy-key'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const endTime = performance.now();
      requestInfo.endTime = endTime;
      requestInfo.duration = endTime - requestStart;
      requestInfo.status = response.status;
      requestInfo.success = response.ok;

      if (!response.ok) {
        const errorText = await response.text();
        requestInfo.error = `HTTP ${response.status}: ${errorText}`;
      }

    } catch (error) {
      const endTime = performance.now();
      requestInfo.endTime = endTime;
      requestInfo.duration = endTime - requestStart;
      
      if (error.name === 'AbortError' || requestInfo.timeout) {
        requestInfo.error = `Timeout after ${timeout}ms`;
        requestInfo.timeout = true;
      } else {
        requestInfo.error = error.message;
      }
    }

    this.activeRequests.delete(requestInfo);
    this.completedRequests.push(requestInfo);
    
    if (!requestInfo.success) {
      this.errors.push(requestInfo);
    }

    return requestInfo;
  }

  async burstTest(requestCount = 20, burstDelay = 100) {
    console.log(`\\n💥 BURST TEST: ${requestCount} запитів з інтервалом ${burstDelay}ms`);
    console.log('='.repeat(60));

    const promises = [];
    this.startTime = performance.now();

    for (let i = 1; i <= requestCount; i++) {
      const promise = this.makeTimedRequest('/v1/simple-chat', {
        model: TEST_MODEL,
        message: `Burst запит #${i} - дай коротку відповідь`
      }, `BURST-${i}`);
      
      promises.push(promise);
      
      // Додаємо невеликий інтервал між запитами
      if (i < requestCount) {
        await new Promise(resolve => setTimeout(resolve, burstDelay));
      }
    }

    console.log(`📡 Відправлено ${requestCount} запитів. Очікування завершення...`);
    await Promise.allSettled(promises);

    return this.analyzeResults('Burst Test');
  }

  async sustainedLoadTest(duration = 30000, requestInterval = 2000) {
    console.log(`\\n⚡ SUSTAINED LOAD TEST: ${duration/1000}s з запитом кожні ${requestInterval}ms`);
    console.log('='.repeat(60));

    this.startTime = performance.now();
    const endTime = this.startTime + duration;
    let requestCounter = 1;

    const promises = [];

    while (performance.now() < endTime) {
      const promise = this.makeTimedRequest('/v1/simple-chat', {
        model: TEST_MODEL,
        message: `Sustained запит #${requestCounter}`
      }, `SUSTAINED-${requestCounter}`);
      
      promises.push(promise);
      requestCounter++;
      
      console.log(`📊 Активні запити: ${this.activeRequests.size}, Завершені: ${this.completedRequests.length}`);
      
      await new Promise(resolve => setTimeout(resolve, requestInterval));
    }

    console.log(`🕒 Час вийшов. Очікування завершення ${this.activeRequests.size} активних запитів...`);
    await Promise.allSettled(promises);

    return this.analyzeResults('Sustained Load Test');
  }

  async rampUpTest(maxConcurrency = 15, rampSteps = 5) {
    console.log(`\\n📈 RAMP-UP TEST: поступово до ${maxConcurrency} одночасних запитів`);
    console.log('='.repeat(60));

    const stepSize = Math.ceil(maxConcurrency / rampSteps);
    this.startTime = performance.now();

    for (let step = 1; step <= rampSteps; step++) {
      const concurrency = Math.min(step * stepSize, maxConcurrency);
      console.log(`\\n🚀 Крок ${step}: ${concurrency} одночасних запитів`);

      const promises = [];
      for (let i = 1; i <= concurrency; i++) {
        promises.push(
          this.makeTimedRequest('/v1/simple-chat', {
            model: TEST_MODEL,
            message: `Ramp-up запит, крок ${step}, запит ${i}`
          }, `RAMP-${step}-${i}`)
        );
      }

      await Promise.allSettled(promises);
      
      // Пауза між кроками
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return this.analyzeResults('Ramp-up Test');
  }

  async errorResilienceTest() {
    console.log(`\\n🛡️  ERROR RESILIENCE TEST: тест обробки помилок`);
    console.log('='.repeat(60));

    this.startTime = performance.now();
    const promises = [];

    // Невірна модель
    promises.push(
      this.makeTimedRequest('/v1/simple-chat', {
        model: 'nonexistent-model',
        message: 'Це має викликати помилку'
      }, 'ERROR-BAD-MODEL')
    );

    // Невірний endpoint
    promises.push(
      fetch(`${BASE_URL}/v1/nonexistent-endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).then(async (res) => ({
        id: 'ERROR-BAD-ENDPOINT',
        success: false,
        status: res.status,
        error: await res.text()
      })).catch(error => ({
        id: 'ERROR-BAD-ENDPOINT',
        success: false,
        error: error.message
      }))
    );

    // Великий запит (можливе переповнення контексту)
    const hugeMessage = 'Дуже довгий текст. '.repeat(1000);
    promises.push(
      this.makeTimedRequest('/v1/simple-chat', {
        model: TEST_MODEL,
        message: hugeMessage
      }, 'ERROR-HUGE-REQUEST')
    );

    // Валідні запити разом з помилковими
    for (let i = 1; i <= 5; i++) {
      promises.push(
        this.makeTimedRequest('/v1/simple-chat', {
          model: TEST_MODEL,
          message: `Валідний запит #${i} серед помилкових`
        }, `VALID-${i}`)
      );
    }

    await Promise.allSettled(promises);
    return this.analyzeResults('Error Resilience Test');
  }

  async analyzeResults(testName) {
    const successful = this.completedRequests.filter(r => r.success);
    const failed = this.completedRequests.filter(r => !r.success);
    const timedOut = this.completedRequests.filter(r => r.timeout);

    const results = {
      testName,
      total: this.completedRequests.length,
      successful: successful.length,
      failed: failed.length,
      timedOut: timedOut.length,
      successRate: (successful.length / this.completedRequests.length * 100).toFixed(1),
      metrics: {}
    };

    if (successful.length > 0) {
      const durations = successful.map(r => r.duration);
      results.metrics = {
        avgResponseTime: (durations.reduce((a, b) => a + b) / durations.length).toFixed(2),
        minResponseTime: Math.min(...durations).toFixed(2),
        maxResponseTime: Math.max(...durations).toFixed(2),
        p95ResponseTime: this.percentile(durations, 0.95).toFixed(2),
        p99ResponseTime: this.percentile(durations, 0.99).toFixed(2)
      };
    }

    // Виведення результатів
    console.log(`\\n📊 РЕЗУЛЬТАТИ: ${testName}`);
    console.log(`   ✅ Успішні: ${successful.length}/${this.completedRequests.length} (${results.successRate}%)`);
    console.log(`   ❌ Помилки: ${failed.length}`);
    console.log(`   ⏰ Timeout: ${timedOut.length}`);

    if (successful.length > 0) {
      console.log(`   📈 Середній час: ${results.metrics.avgResponseTime}ms`);
      console.log(`   📊 P95: ${results.metrics.p95ResponseTime}ms`);
      console.log(`   📊 P99: ${results.metrics.p99ResponseTime}ms`);
      console.log(`   ⚡ Найшвидший: ${results.metrics.minResponseTime}ms`);
      console.log(`   🐌 Найповільніший: ${results.metrics.maxResponseTime}ms`);
    }

    if (failed.length > 0) {
      console.log(`\\n❌ ПОМИЛКИ (показано перші 5):`);
      failed.slice(0, 5).forEach(f => {
        console.log(`   [${f.id}] ${f.error}`);
      });
    }

    // Очищення для наступного тесту
    this.completedRequests = [];
    this.errors = [];

    return results;
  }

  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return lower === upper ? sorted[lower] : sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
  }

  async checkServerHealth() {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();
      return response.ok;
    } catch {
      return false;
    }
  }

  async runStressTests() {
    console.log('🔥 ЗАПУСК СТРЕС-ТЕСТІВ ТА ТЕСТІВ НАВАНТАЖЕННЯ');
    console.log('='.repeat(80));
    console.log(`📍 Базовий URL: ${BASE_URL}`);
    console.log(`🤖 Тестова модель: ${TEST_MODEL}`);
    console.log('='.repeat(80));

    // Перевірка сервера
    console.log('🏥 Перевірка доступності сервера...');
    const isHealthy = await this.checkServerHealth();
    if (!isHealthy) {
      console.log('❌ Сервер недоступний. Завершення тестів.');
      return;
    }
    console.log('✅ Сервер працює\\n');

    const allResults = [];

    try {
      // Послідовність тестів від простого до складного
      allResults.push(await this.burstTest(10, 200));
      allResults.push(await this.sustainedLoadTest(15000, 1500));  // 15 секунд, запит кожні 1.5с
      allResults.push(await this.rampUpTest(12, 4));
      allResults.push(await this.errorResilienceTest());

      // Підсумковий звіт
      console.log('\\n' + '='.repeat(80));
      console.log('📋 ПІДСУМКОВИЙ ЗВІТ СТРЕС-ТЕСТІВ');
      console.log('='.repeat(80));

      allResults.forEach(result => {
        console.log(`📊 ${result.testName}:`);
        console.log(`   Успішність: ${result.successRate}% (${result.successful}/${result.total})`);
        if (result.metrics.avgResponseTime) {
          console.log(`   Сер. час: ${result.metrics.avgResponseTime}ms`);
          console.log(`   P95: ${result.metrics.p95ResponseTime}ms`);
        }
        console.log('');
      });

      // Загальні висновки
      const totalRequests = allResults.reduce((sum, r) => sum + r.total, 0);
      const totalSuccessful = allResults.reduce((sum, r) => sum + r.successful, 0);
      const overallSuccessRate = ((totalSuccessful / totalRequests) * 100).toFixed(1);

      console.log('🎯 ЗАГАЛЬНІ ВИСНОВКИ:');
      console.log(`   📈 Загальна успішність: ${overallSuccessRate}% (${totalSuccessful}/${totalRequests})`);

      if (overallSuccessRate >= 95) {
        console.log('   ✅ Система відмінно витримує навантаження');
        console.log('   💡 Рекомендації: система готова до продакшену');
      } else if (overallSuccessRate >= 85) {
        console.log('   ⚠️  Система задовільно витримує навантаження');
        console.log('   💡 Рекомендації: розгляньте оптимізацію під піковими навантаженнями');
      } else {
        console.log('   ❌ Система має проблеми під навантаженням');
        console.log('   💡 Критичні рекомендації:');
        console.log('      • Додайте rate limiting та черги');
        console.log('      • Оптимізуйте обробку запитів');
        console.log('      • Розгляньте горизонтальне масштабування');
      }

    } catch (error) {
      console.error('❌ Критична помилка під час стрес-тестування:', error.message);
    }
  }
}

// Запуск стрес-тестів
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new StressTester();
  tester.runStressTests().catch(console.error);
}

export default StressTester;
