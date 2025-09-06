#!/usr/bin/env node

/**
 * Головний тестувальний скрипт для перевірки системи на одночасність та навантаження
 * Запускає всі типи тестів та генерує повний звіт
 */

import ConcurrencyTester from './test-concurrency.mjs';
import StressTester from './test-stress.mjs';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';
const REPORT_FILE = 'load-test-report.json';

class LoadTestSuite {
  constructor() {
    this.testResults = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      concurrencyTests: {},
      stressTests: {},
      summary: {},
      recommendations: []
    };
  }

  async runConcurrencyTests() {
    console.log('🚀 Запуск тестів одночасності...');
    const tester = new ConcurrencyTester();
    
    // Перехоплюємо результати тестів
    const originalResults = [];
    const originalLog = tester.analyzeResults;
    tester.analyzeResults = (results, testName, additionalInfo) => {
      const result = originalLog.call(tester, results, testName, additionalInfo);
      originalResults.push(result);
      return result;
    };

    await tester.runAllTests();
    
    this.testResults.concurrencyTests = {
      results: originalResults,
      summary: this.summarizeConcurrencyTests(originalResults)
    };
  }

  async runStressTests() {
    console.log('\\n🔥 Запуск стрес-тестів...');
    const tester = new StressTester();
    
    // Запускаємо стрес-тести з меншими параметрами для швидкості
    const stressResults = [];
    
    // Burst test
    stressResults.push(await tester.burstTest(8, 150));
    
    // Sustained load test (коротший)
    stressResults.push(await tester.sustainedLoadTest(10000, 1000));
    
    // Ramp-up test
    stressResults.push(await tester.rampUpTest(8, 3));
    
    // Error resilience test
    stressResults.push(await tester.errorResilienceTest());

    this.testResults.stressTests = {
      results: stressResults,
      summary: this.summarizeStressTests(stressResults)
    };
  }

  summarizeConcurrencyTests(results) {
    const totalRequests = results.reduce((sum, r) => sum + r.total, 0);
    const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
    const avgSuccessRate = (totalSuccessful / totalRequests * 100);
    
    return {
      totalTests: results.length,
      totalRequests,
      totalSuccessful,
      successRate: avgSuccessRate.toFixed(1),
      averageResponseTime: results
        .filter(r => r.metrics?.averageResponseTime)
        .reduce((sum, r) => sum + r.metrics.averageResponseTime, 0) / results.length
    };
  }

  summarizeStressTests(results) {
    const totalRequests = results.reduce((sum, r) => sum + r.total, 0);
    const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
    const avgSuccessRate = (totalSuccessful / totalRequests * 100);
    
    const responseTimes = results
      .filter(r => r.metrics?.avgResponseTime)
      .map(r => parseFloat(r.metrics.avgResponseTime));
    
    return {
      totalTests: results.length,
      totalRequests,
      totalSuccessful,
      successRate: avgSuccessRate.toFixed(1),
      averageResponseTime: responseTimes.length > 0 
        ? (responseTimes.reduce((a, b) => a + b) / responseTimes.length).toFixed(2)
        : null,
      timeouts: results.reduce((sum, r) => sum + (r.timedOut || 0), 0)
    };
  }

  generateRecommendations() {
    const concurrencySuccessRate = parseFloat(this.testResults.concurrencyTests.summary.successRate);
    const stressSuccessRate = parseFloat(this.testResults.stressTests.summary.successRate);
    const avgResponseTime = this.testResults.concurrencyTests.summary.averageResponseTime;

    const recommendations = [];

    // Аналіз успішності
    if (concurrencySuccessRate < 90) {
      recommendations.push({
        type: 'critical',
        category: 'concurrency',
        issue: 'Низька успішність при одночасних запитах',
        solution: 'Додайте rate limiting, оптимізуйте обробку запитів'
      });
    }

    if (stressSuccessRate < 85) {
      recommendations.push({
        type: 'critical',
        category: 'stress',
        issue: 'Система не витримує навантаження',
        solution: 'Впровадьте чергу запитів, розгляньте кластеризацію'
      });
    }

    // Аналіз продуктивності
    if (avgResponseTime > 5000) {
      recommendations.push({
        type: 'warning',
        category: 'performance',
        issue: 'Повільний час відгуку',
        solution: 'Оптимізуйте код, додайте кешування, перевірте мережу'
      });
    } else if (avgResponseTime > 2000) {
      recommendations.push({
        type: 'info',
        category: 'performance',
        issue: 'Помірний час відгуку',
        solution: 'Розгляньте оптимізацію для покращення UX'
      });
    }

    // Аналіз timeout'ів
    if (this.testResults.stressTests.summary.timeouts > 0) {
      recommendations.push({
        type: 'warning',
        category: 'reliability',
        issue: 'Виявлено timeouts',
        solution: 'Збільште timeouts або оптимізуйте обробку запитів'
      });
    }

    // Позитивні рекомендації
    if (concurrencySuccessRate >= 95 && stressSuccessRate >= 90) {
      recommendations.push({
        type: 'success',
        category: 'general',
        issue: 'Відмінна продуктивність',
        solution: 'Система готова до продакшену'
      });
    }

    this.testResults.recommendations = recommendations;
  }

  generateSummary() {
    const concurrencyScore = Math.min(100, parseFloat(this.testResults.concurrencyTests.summary.successRate));
    const stressScore = Math.min(100, parseFloat(this.testResults.stressTests.summary.successRate));
    const overallScore = ((concurrencyScore + stressScore) / 2).toFixed(1);

    let grade;
    if (overallScore >= 95) grade = 'A';
    else if (overallScore >= 85) grade = 'B';
    else if (overallScore >= 75) grade = 'C';
    else if (overallScore >= 60) grade = 'D';
    else grade = 'F';

    this.testResults.summary = {
      overallScore: overallScore,
      grade,
      concurrencyScore,
      stressScore,
      status: grade === 'A' || grade === 'B' ? 'PASS' : 'NEEDS_IMPROVEMENT'
    };
  }

  async saveReport() {
    try {
      await fs.writeFile(REPORT_FILE, JSON.stringify(this.testResults, null, 2));
      console.log(`\\n📄 Детальний звіт збережено у файл: ${REPORT_FILE}`);
    } catch (error) {
      console.error('❌ Помилка збереження звіту:', error.message);
    }
  }

  printFinalReport() {
    const { summary, recommendations } = this.testResults;
    
    console.log('\\n' + '='.repeat(80));
    console.log('📊 ФІНАЛЬНИЙ ЗВІТ ТЕСТУВАННЯ НАВАНТАЖЕННЯ');
    console.log('='.repeat(80));
    
    console.log(`🎯 ЗАГАЛЬНА ОЦІНКА: ${summary.grade} (${summary.overallScore}%)`);
    console.log(`📈 Одночасність: ${summary.concurrencyScore.toFixed(1)}%`);
    console.log(`🔥 Стрес-тести: ${summary.stressScore.toFixed(1)}%`);
    console.log(`✅ Статус: ${summary.status}`);
    
    console.log('\\n💡 РЕКОМЕНДАЦІЇ:');
    if (recommendations.length === 0) {
      console.log('   Рекомендації відсутні - система працює відмінно!');
    } else {
      recommendations.forEach((rec, index) => {
        const icon = rec.type === 'critical' ? '🔴' : 
                    rec.type === 'warning' ? '🟡' : 
                    rec.type === 'success' ? '🟢' : 'ℹ️';
        console.log(`   ${icon} ${rec.issue}`);
        console.log(`      → ${rec.solution}`);
      });
    }

    console.log('\\n📋 ШВИДКІ СТАТИСТИКИ:');
    const concTests = this.testResults.concurrencyTests.summary;
    const stressTests = this.testResults.stressTests.summary;
    
    console.log(`   🔄 Тести одночасності: ${concTests.totalRequests} запитів, ${concTests.successRate}% успішних`);
    console.log(`   💥 Стрес-тести: ${stressTests.totalRequests} запитів, ${stressTests.successRate}% успішних`);
    
    if (concTests.averageResponseTime) {
      console.log(`   ⏱️  Середній час відгуку: ${concTests.averageResponseTime.toFixed(0)}ms`);
    }
    
    console.log('='.repeat(80));
  }

  async runAllTests() {
    const startTime = performance.now();
    
    console.log('🧪 ПОВНИЙ НАБІР ТЕСТІВ НАВАНТАЖЕННЯ ТА ОДНОЧАСНОСТІ');
    console.log('='.repeat(80));
    console.log(`🌐 URL: ${BASE_URL}`);
    console.log(`🕐 Початок тестування: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80));

    try {
      // Перевірка доступності сервера
      const healthCheck = await fetch(`${BASE_URL}/health`);
      if (!healthCheck.ok) {
        throw new Error('Сервер недоступний');
      }
      console.log('✅ Сервер доступний\\n');

      // Запуск тестів
      await this.runConcurrencyTests();
      await this.runStressTests();

      // Аналіз результатів
      this.generateRecommendations();
      this.generateSummary();

      // Виведення результатів
      this.printFinalReport();
      
      // Збереження звіту
      await this.saveReport();

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`\\n🕐 Загальний час тестування: ${totalTime}s`);

    } catch (error) {
      console.error('❌ Критична помилка під час тестування:', error.message);
      console.log('💡 Переконайтеся, що сервер запущено на:', BASE_URL);
      process.exit(1);
    }
  }
}

// Допоміжна функція для запуску швидких тестів
async function quickTest() {
  console.log('⚡ ШВИДКИЙ ТЕСТ ОДНОЧАСНОСТІ (3 запити)');
  console.log('='.repeat(50));
  
  const promises = [];
  for (let i = 1; i <= 3; i++) {
    promises.push(
      fetch(`${BASE_URL}/v1/simple-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          message: `Швидкий тест #${i}`
        })
      }).then(async res => ({
        id: i,
        success: res.ok,
        status: res.status,
        response: res.ok ? (await res.json()).message : await res.text()
      }))
    );
  }

  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.value?.success).length;
  
  console.log(`Результат: ${successful}/3 запитів успішні`);
  
  if (successful === 3) {
    console.log('✅ Система обробляє одночасні запити правильно');
  } else {
    console.log('⚠️  Виявлено проблеми, запустіть повний тест: node test-load-suite.mjs');
  }
}

// Головна функція
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    await quickTest();
  } else {
    const suite = new LoadTestSuite();
    await suite.runAllTests();
  }
}

// Запуск
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default LoadTestSuite;
