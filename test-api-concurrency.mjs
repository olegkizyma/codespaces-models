#!/usr/bin/env node

/**
 * Тести одночасності для API endpoints (без UI)
 * Перевіряє OpenAI-сумісні endpoints на навантаження
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const TEST_MODEL = process.env.TEST_MODEL || 'openai/gpt-4o-mini';
const API_KEY = process.env.GITHUB_TOKEN || 'dummy-key';

class APIConcurrencyTester {
  constructor() {
    this.results = [];
    this.errors = [];
    this.activeRequests = new Set();
  }

  async makeAPIRequest(endpoint, body, id, timeout = 30000) {
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
      tokens: 0,
      responseSize: 0
    };

    this.activeRequests.add(requestInfo);

    try {
      console.log(`📡 [${id}] → ${endpoint}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const responseText = await response.text();
      
      requestInfo.endTime = endTime;
      requestInfo.duration = endTime - startTime;
      requestInfo.status = response.status;
      requestInfo.success = response.ok;
      requestInfo.responseSize = responseText.length;

      if (response.ok) {
        try {
          const jsonResponse = JSON.parse(responseText);
          requestInfo.tokens = jsonResponse.usage?.total_tokens || 0;
          console.log(`✅ [${id}] ${requestInfo.duration.toFixed(0)}ms (${requestInfo.tokens} tokens)`);
        } catch (e) {
          console.log(`✅ [${id}] ${requestInfo.duration.toFixed(0)}ms (non-JSON response)`);
        }
      } else {
        requestInfo.error = `HTTP ${response.status}: ${responseText.substring(0, 200)}`;
        console.log(`❌ [${id}] ${response.status} - ${responseText.substring(0, 100)}`);
      }

    } catch (error) {
      const endTime = performance.now();
      requestInfo.endTime = endTime;
      requestInfo.duration = endTime - startTime;
      requestInfo.error = error.name === 'AbortError' ? 'Timeout' : error.message;
      console.log(`❌ [${id}] ${requestInfo.error}`);
    }

    this.activeRequests.delete(requestInfo);
    this.results.push(requestInfo);
    
    if (!requestInfo.success) {
      this.errors.push(requestInfo);
    }

    return requestInfo;
  }

  async testChatCompletions() {
    console.log('\\n🔥 ТЕСТ: /v1/chat/completions (5 паралельних запитів)');
    console.log('='.repeat(60));

    const requests = [];
    for (let i = 1; i <= 5; i++) {
      requests.push(
        this.makeAPIRequest('/v1/chat/completions', {
          model: TEST_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: `API test request #${i}. Give a short response.` }
          ],
          max_tokens: 50,
          temperature: 0.7
        }, `CHAT-${i}`)
      );
    }

    await Promise.allSettled(requests);
    return this.analyzeResults('Chat Completions');
  }

  async testStreamingChatCompletions() {
    console.log('\\n🔥 ТЕСТ: /v1/chat/completions STREAMING (3 паралельні запити)');
    console.log('='.repeat(60));

    const requests = [];
    for (let i = 1; i <= 3; i++) {
      requests.push(
        this.makeStreamingRequest('/v1/chat/completions', {
          model: TEST_MODEL,
          messages: [
            { role: 'user', content: `Streaming test ${i}. Count to 5.` }
          ],
          max_tokens: 30,
          stream: true
        }, `STREAM-${i}`)
      );
    }

    await Promise.allSettled(requests);
    return this.analyzeResults('Streaming Chat Completions');
  }

  async makeStreamingRequest(endpoint, body, id) {
    const startTime = performance.now();
    const requestInfo = {
      id,
      endpoint: endpoint + ' (streaming)',
      startTime,
      endTime: null,
      duration: null,
      status: null,
      success: false,
      error: null,
      chunks: 0
    };

    try {
      console.log(`📡 [${id}] → ${endpoint} (streaming)`);
      
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(body)
      });

      requestInfo.status = response.status;

      if (response.ok) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\\n').filter(line => line.startsWith('data: '));
          requestInfo.chunks += lines.length;
        }

        requestInfo.success = true;
        const endTime = performance.now();
        requestInfo.duration = endTime - startTime;
        console.log(`✅ [${id}] ${requestInfo.duration.toFixed(0)}ms (${requestInfo.chunks} chunks)`);
      } else {
        requestInfo.error = `HTTP ${response.status}`;
        console.log(`❌ [${id}] ${response.status}`);
      }

    } catch (error) {
      requestInfo.error = error.message;
      console.log(`❌ [${id}] ${error.message}`);
    }

    requestInfo.endTime = performance.now();
    this.results.push(requestInfo);
    
    if (!requestInfo.success) {
      this.errors.push(requestInfo);
    }

    return requestInfo;
  }

  async testCompletions() {
    console.log('\\n🔥 ТЕСТ: /v1/completions (3 паралельні запити)');
    console.log('='.repeat(60));

    const requests = [];
    for (let i = 1; i <= 3; i++) {
      requests.push(
        this.makeAPIRequest('/v1/completions', {
          model: TEST_MODEL,
          prompt: `Complete this sentence about API testing #${i}:`,
          max_tokens: 30,
          temperature: 0.5
        }, `COMPLETION-${i}`)
      );
    }

    await Promise.allSettled(requests);
    return this.analyzeResults('Completions');
  }

  async testEmbeddings() {
    console.log('\\n🔥 ТЕСТ: /v1/embeddings (4 паралельні запити)');
    console.log('='.repeat(60));

    const requests = [];
    const embeddingModel = 'openai/text-embedding-3-small';
    
    for (let i = 1; i <= 4; i++) {
      requests.push(
        this.makeAPIRequest('/v1/embeddings', {
          model: embeddingModel,
          input: `Text for embedding test number ${i}`
        }, `EMBED-${i}`)
      );
    }

    await Promise.allSettled(requests);
    return this.analyzeResults('Embeddings');
  }

  async testMixedAPICalls() {
    console.log('\\n🔥 ТЕСТ: Змішані API виклики (різні endpoints одночасно)');
    console.log('='.repeat(60));

    const requests = [
      // Chat completion
      this.makeAPIRequest('/v1/chat/completions', {
        model: TEST_MODEL,
        messages: [{ role: 'user', content: 'Mixed test 1' }],
        max_tokens: 20
      }, 'MIX-CHAT'),

      // Completion
      this.makeAPIRequest('/v1/completions', {
        model: TEST_MODEL,
        prompt: 'Mixed test prompt',
        max_tokens: 20
      }, 'MIX-COMPLETION'),

      // Embedding
      this.makeAPIRequest('/v1/embeddings', {
        model: 'openai/text-embedding-3-small',
        input: 'Mixed test embedding'
      }, 'MIX-EMBED'),

      // Models list (GET request)
      this.makeGetRequest('/v1/models', 'MIX-MODELS')
    ];

    await Promise.allSettled(requests);
    return this.analyzeResults('Mixed API Calls');
  }

  async makeGetRequest(endpoint, id) {
    const startTime = performance.now();
    const requestInfo = {
      id,
      endpoint,
      startTime,
      endTime: null,
      duration: null,
      status: null,
      success: false,
      error: null
    };

    try {
      console.log(`📡 [${id}] → GET ${endpoint}`);
      
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const endTime = performance.now();
      requestInfo.endTime = endTime;
      requestInfo.duration = endTime - startTime;
      requestInfo.status = response.status;
      requestInfo.success = response.ok;

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ [${id}] ${requestInfo.duration.toFixed(0)}ms (${data.data?.length || 0} items)`);
      } else {
        requestInfo.error = `HTTP ${response.status}`;
        console.log(`❌ [${id}] ${response.status}`);
      }

    } catch (error) {
      requestInfo.error = error.message;
      console.log(`❌ [${id}] ${error.message}`);
    }

    this.results.push(requestInfo);
    return requestInfo;
  }

  async testHighConcurrency() {
    console.log('\\n🔥 ТЕСТ: Високий рівень одночасності (15 запитів)');
    console.log('='.repeat(60));

    const requests = [];
    for (let i = 1; i <= 15; i++) {
      requests.push(
        this.makeAPIRequest('/v1/chat/completions', {
          model: TEST_MODEL,
          messages: [{ role: 'user', content: `High concurrency test ${i}` }],
          max_tokens: 10
        }, `HIGH-${i}`)
      );
    }

    console.log(`📡 Відправлено 15 паралельних запитів...`);
    const startTime = performance.now();
    await Promise.allSettled(requests);
    const totalTime = performance.now() - startTime;

    console.log(`⏱️  Загальний час: ${totalTime.toFixed(0)}ms`);
    return this.analyzeResults('High Concurrency', { totalTime });
  }

  analyzeResults(testName, additionalInfo = {}) {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    const results = {
      testName,
      total: this.results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / this.results.length * 100).toFixed(1)
    };

    if (successful.length > 0) {
      const durations = successful.map(r => r.duration);
      const tokens = successful.map(r => r.tokens || 0);
      
      results.metrics = {
        avgResponseTime: (durations.reduce((a, b) => a + b) / durations.length).toFixed(2),
        minResponseTime: Math.min(...durations).toFixed(2),
        maxResponseTime: Math.max(...durations).toFixed(2),
        totalTokens: tokens.reduce((a, b) => a + b),
        avgTokens: tokens.length > 0 ? (tokens.reduce((a, b) => a + b) / tokens.length).toFixed(0) : 0
      };
    }

    // Виведення результатів
    console.log(`\\n📊 РЕЗУЛЬТАТИ: ${testName}`);
    console.log(`   ✅ Успішні: ${successful.length}/${this.results.length} (${results.successRate}%)`);
    
    if (successful.length > 0) {
      console.log(`   ⏱️  Середній час: ${results.metrics.avgResponseTime}ms`);
      console.log(`   📊 Діапазон: ${results.metrics.minResponseTime}-${results.metrics.maxResponseTime}ms`);
      if (results.metrics.totalTokens > 0) {
        console.log(`   🔢 Токени: ${results.metrics.totalTokens} всього (avg: ${results.metrics.avgTokens})`);
      }
    }

    if (failed.length > 0) {
      console.log(`   ❌ Помилки: ${failed.length}`);
      failed.forEach(f => console.log(`      [${f.id}] ${f.error}`));
    }

    if (additionalInfo.totalTime) {
      console.log(`   🕐 Загальний час: ${additionalInfo.totalTime.toFixed(0)}ms`);
    }

    // Очищення для наступного тесту
    const testResults = [...this.results];
    this.results = [];
    
    return results;
  }

  async checkAPIHealth() {
    console.log('🏥 Перевірка API...');
    
    try {
      // Health check
      const healthResponse = await fetch(`${BASE_URL}/health`);
      const healthData = await healthResponse.json();
      
      // Models check
      const modelsResponse = await fetch(`${BASE_URL}/v1/models`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      });
      const modelsData = await modelsResponse.json();
      
      if (healthResponse.ok && modelsResponse.ok) {
        console.log(`✅ API працює - ${healthData.models} моделей, статус: ${healthData.status}`);
        console.log(`📋 Доступно моделей: ${modelsData.data?.length || 0}`);
        return true;
      } else {
        console.log(`❌ Проблеми з API`);
        return false;
      }
    } catch (error) {
      console.log(`❌ API недоступне: ${error.message}`);
      return false;
    }
  }

  async runAllAPITests() {
    console.log('🚀 ТЕСТУВАННЯ API НА ОДНОЧАСНІСТЬ ТА НАВАНТАЖЕННЯ');
    console.log('='.repeat(80));
    console.log(`📍 API URL: ${BASE_URL}`);
    console.log(`🤖 Тестова модель: ${TEST_MODEL}`);
    console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...`);
    console.log('='.repeat(80));

    // Перевірка API
    const isHealthy = await this.checkAPIHealth();
    if (!isHealthy) {
      console.log('\\n❌ API недоступне. Завершення тестів.');
      return;
    }

    const allResults = [];

    try {
      // Послідовність тестів
      allResults.push(await this.testChatCompletions());
      allResults.push(await this.testStreamingChatCompletions());
      allResults.push(await this.testCompletions());
      allResults.push(await this.testEmbeddings());
      allResults.push(await this.testMixedAPICalls());
      allResults.push(await this.testHighConcurrency());

      // Підсумковий звіт
      console.log('\\n' + '='.repeat(80));
      console.log('📋 ПІДСУМКОВИЙ ЗВІТ API ТЕСТІВ');
      console.log('='.repeat(80));

      let totalRequests = 0;
      let totalSuccessful = 0;
      let totalTokens = 0;

      allResults.forEach(result => {
        console.log(`📊 ${result.testName}:`);
        console.log(`   Успішність: ${result.successRate}% (${result.successful}/${result.total})`);
        if (result.metrics?.avgResponseTime) {
          console.log(`   Середній час: ${result.metrics.avgResponseTime}ms`);
        }
        if (result.metrics?.totalTokens) {
          console.log(`   Токени: ${result.metrics.totalTokens}`);
          totalTokens += parseInt(result.metrics.totalTokens);
        }
        console.log('');
        
        totalRequests += result.total;
        totalSuccessful += result.successful;
      });

      const overallSuccessRate = ((totalSuccessful / totalRequests) * 100).toFixed(1);

      console.log('🎯 ЗАГАЛЬНІ РЕЗУЛЬТАТИ:');
      console.log(`   📈 Загальна успішність: ${overallSuccessRate}% (${totalSuccessful}/${totalRequests})`);
      console.log(`   🔢 Всього токенів: ${totalTokens}`);
      
      if (overallSuccessRate >= 95) {
        console.log('   ✅ API відмінно справляється з одночасними запитами');
        console.log('   💡 Система готова до продакшену');
      } else if (overallSuccessRate >= 85) {
        console.log('   ⚠️  API задовільно працює під навантаженням');
        console.log('   💡 Рекомендується моніторинг під реальним навантаженням');
      } else {
        console.log('   ❌ API має проблеми з одночасністю');
        console.log('   💡 Критичні рекомендації:');
        console.log('      • Додайте rate limiting');
        console.log('      • Оптимізуйте обробку запитів');
        console.log('      • Розгляньте connection pooling');
      }

      console.log('='.repeat(80));

    } catch (error) {
      console.error('❌ Критична помилка під час тестування:', error.message);
    }
  }
}

// Швидкий тест
async function quickAPITest() {
  console.log('⚡ ШВИДКИЙ API ТЕСТ');
  console.log('='.repeat(40));
  
  try {
    const start = performance.now();
    const promises = [];
    
    for (let i = 1; i <= 3; i++) {
      promises.push(
        fetch(`${BASE_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            model: TEST_MODEL,
            messages: [{ role: 'user', content: `Quick test ${i}` }],
            max_tokens: 10
          })
        })
      );
    }

    const results = await Promise.allSettled(promises);
    const duration = performance.now() - start;
    const successful = results.filter(r => r.value?.ok).length;
    
    console.log(`Результат: ${successful}/3 запитів успішні за ${duration.toFixed(0)}ms`);
    
    if (successful === 3) {
      console.log('✅ API працює правильно з одночасними запитами');
    } else {
      console.log('⚠️  Виявлено проблеми. Запустіть повний тест: node test-api-concurrency.mjs');
    }
    
  } catch (error) {
    console.log(`❌ Помилка: ${error.message}`);
  }
}

// Запуск
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    quickAPITest().catch(console.error);
  } else {
    const tester = new APIConcurrencyTester();
    tester.runAllAPITests().catch(console.error);
  }
}

export default APIConcurrencyTester;
