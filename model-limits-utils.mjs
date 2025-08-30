/**
 * Утиліти для роботи з лімітами моделей
 * Допоміжні функції для обробки помилок та оптимізації
 */

import fs from 'fs/promises';

export class ModelLimitsHandler {
  constructor() {
    this.rateLimitHistory = new Map();
    this.errorStats = new Map();
    this.modelPerformance = new Map();
  }

  /**
   * Обробка rate limit помилок з exponential backoff
   */
  async handleRateLimit(error, model, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 секунда
    
    if (retryCount >= maxRetries) {
      throw new Error(`Rate limit перевищено після ${maxRetries} спроб для ${model}`);
    }
    
    const delay = baseDelay * Math.pow(2, retryCount);
    console.log(`⏳ Rate limit для ${model}. Чекаємо ${delay}ms перед повтором...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return { retry: true, delay };
  }

  /**
   * Перевірка чи вміщується текст в ліміт контексту
   */
  checkContextLimit(text, model) {
    const contextLimits = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'Phi-3-mini-4k-instruct': 4000,
      'Phi-3-small-128k-instruct': 128000,
      'Phi-3.5-mini-instruct': 128000,
      'AI21-Jamba-1.5-Large': 256000,
      'Meta-Llama-3.1-405B-Instruct': 128000
    };

    // Приблизний підрахунок токенів (1 токен ≈ 4 символи)
    const estimatedTokens = Math.ceil(text.length / 4);
    const limit = contextLimits[model] || 4000;
    
    return {
      estimatedTokens,
      limit,
      fits: estimatedTokens <= limit,
      usage: (estimatedTokens / limit * 100).toFixed(1)
    };
  }

  /**
   * Рекомендація найкращої моделі для задачі
   */
  recommendModel(requirements) {
    const { 
      speed = 'medium', 
      quality = 'medium', 
      contextSize = 'small', 
      cost = 'medium',
      task = 'general' 
    } = requirements;

    const models = [
      {
        name: 'gpt-4o-mini',
        speed: 5, quality: 4, context: 4, cost: 5, // 5 = найкраще
        tasks: ['general', 'quick', 'simple']
      },
      {
        name: 'gpt-4o',
        speed: 4, quality: 5, context: 4, cost: 3,
        tasks: ['general', 'complex', 'vision']
      },
      {
        name: 'Meta-Llama-3.1-405B-Instruct',
        speed: 2, quality: 5, context: 4, cost: 1,
        tasks: ['complex', 'research', 'analysis']
      },
      {
        name: 'Phi-3-mini-4k-instruct',
        speed: 5, quality: 3, context: 1, cost: 5,
        tasks: ['simple', 'quick', 'budget']
      },
      {
        name: 'AI21-Jamba-1.5-Large',
        speed: 2, quality: 4, context: 5, cost: 2,
        tasks: ['long-context', 'documents', 'analysis']
      }
    ];

    const weights = {
      speed: speed === 'high' ? 3 : speed === 'low' ? 1 : 2,
      quality: quality === 'high' ? 3 : quality === 'low' ? 1 : 2,
      context: contextSize === 'large' ? 3 : contextSize === 'small' ? 1 : 2,
      cost: cost === 'low' ? 3 : cost === 'high' ? 1 : 2
    };

    const scored = models.map(model => {
      let score = 0;
      score += model.speed * weights.speed;
      score += model.quality * weights.quality;
      score += model.context * weights.context;
      score += model.cost * weights.cost;
      
      // Бонус якщо модель підходить для задачі
      if (model.tasks.includes(task)) score += 5;
      
      return { ...model, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Логування використання моделі
   */
  logUsage(model, usage, responseTime, error = null) {
    const timestamp = new Date().toISOString();
    
    if (!this.modelPerformance.has(model)) {
      this.modelPerformance.set(model, {
        totalRequests: 0,
        totalTokens: 0,
        totalTime: 0,
        errors: 0,
        avgResponseTime: 0,
        avgTokensPerRequest: 0
      });
    }
    
    const stats = this.modelPerformance.get(model);
    stats.totalRequests++;
    
    if (error) {
      stats.errors++;
    } else {
      stats.totalTokens += usage.total_tokens;
      stats.totalTime += responseTime;
      stats.avgResponseTime = stats.totalTime / (stats.totalRequests - stats.errors);
      stats.avgTokensPerRequest = stats.totalTokens / (stats.totalRequests - stats.errors);
    }
    
    // Логування у файл
    const logEntry = {
      timestamp,
      model,
      usage,
      responseTime,
      error: error?.message
    };
    
    this.appendToLog(logEntry);
  }

  /**
   * Запис логу у файл
   */
  async appendToLog(entry) {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile('./model-usage.log', logLine);
    } catch (error) {
      console.warn('Не вдалося записати лог:', error.message);
    }
  }

  /**
   * Отримання статистики використання
   */
  getUsageStats() {
    const stats = {};
    
    for (const [model, data] of this.modelPerformance.entries()) {
      const errorRate = (data.errors / data.totalRequests * 100).toFixed(1);
      const tokensPerSecond = data.avgResponseTime > 0 ? 
        Math.round(data.avgTokensPerRequest / (data.avgResponseTime / 1000)) : 0;
      
      stats[model] = {
        ...data,
        errorRate: `${errorRate}%`,
        tokensPerSecond,
        efficiency: this.calculateEfficiency(data)
      };
    }
    
    return stats;
  }

  /**
   * Розрахунок ефективності моделі
   */
  calculateEfficiency(stats) {
    if (stats.totalRequests === 0) return 0;
    
    const successRate = (stats.totalRequests - stats.errors) / stats.totalRequests;
    const speedScore = stats.avgResponseTime > 0 ? Math.min(10000 / stats.avgResponseTime, 1) : 0;
    const tokenEfficiency = stats.avgTokensPerRequest > 0 ? Math.min(stats.avgTokensPerRequest / 1000, 1) : 0;
    
    return Math.round((successRate * 0.5 + speedScore * 0.3 + tokenEfficiency * 0.2) * 100);
  }

  /**
   * Очищення старих логів
   */
  async cleanupLogs(daysOld = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const logContent = await fs.readFile('./model-usage.log', 'utf8');
      const lines = logContent.split('\n').filter(line => line.trim());
      
      const filteredLines = lines.filter(line => {
        try {
          const entry = JSON.parse(line);
          return new Date(entry.timestamp) > cutoffDate;
        } catch {
          return false;
        }
      });
      
      await fs.writeFile('./model-usage.log', filteredLines.join('\n') + '\n');
      console.log(`🧹 Очищено логи старші ${daysOld} днів`);
      
    } catch (error) {
      console.warn('Помилка при очищенні логів:', error.message);
    }
  }

  /**
   * Аналіз найчастіших помилок
   */
  analyzeErrors() {
    const errorAnalysis = {};
    
    for (const [error, count] of this.errorStats.entries()) {
      const category = this.categorizeError(error);
      if (!errorAnalysis[category]) {
        errorAnalysis[category] = { count: 0, examples: [] };
      }
      errorAnalysis[category].count += count;
      errorAnalysis[category].examples.push(error);
    }
    
    return errorAnalysis;
  }

  /**
   * Категоризація помилок
   */
  categorizeError(error) {
    if (error.includes('429') || error.includes('rate limit')) return 'RATE_LIMIT';
    if (error.includes('context') || error.includes('token')) return 'CONTEXT_LIMIT';
    if (error.includes('404') || error.includes('not found')) return 'MODEL_NOT_FOUND';
    if (error.includes('timeout')) return 'TIMEOUT';
    if (error.includes('auth') || error.includes('401')) return 'AUTH_ERROR';
    return 'UNKNOWN';
  }

  /**
   * Генерація звіту про використання
   */
  generateUsageReport() {
    const stats = this.getUsageStats();
    const errors = this.analyzeErrors();
    const timestamp = new Date().toISOString();
    
    const report = {
      timestamp,
      summary: {
        totalModels: Object.keys(stats).length,
        totalRequests: Object.values(stats).reduce((sum, s) => sum + s.totalRequests, 0),
        totalErrors: Object.values(stats).reduce((sum, s) => sum + s.errors, 0)
      },
      modelStats: stats,
      errorAnalysis: errors,
      recommendations: this.generateRecommendations(stats, errors)
    };
    
    return report;
  }

  /**
   * Генерація рекомендацій на основі статистики
   */
  generateRecommendations(stats, errors) {
    const recommendations = [];
    
    // Аналіз найповільніших моделей
    const slowModels = Object.entries(stats)
      .filter(([_, s]) => s.avgResponseTime > 5000)
      .map(([model, _]) => model);
    
    if (slowModels.length > 0) {
      recommendations.push({
        type: 'PERFORMANCE',
        message: `Повільні моделі: ${slowModels.join(', ')}. Розгляньте використання більш швидких альтернатив.`
      });
    }
    
    // Аналіз помилок rate limit
    if (errors.RATE_LIMIT && errors.RATE_LIMIT.count > 0) {
      recommendations.push({
        type: 'RATE_LIMIT',
        message: `Виявлено ${errors.RATE_LIMIT.count} rate limit помилок. Додайте затримки між запитами.`
      });
    }
    
    // Аналіз ефективності
    const inefficientModels = Object.entries(stats)
      .filter(([_, s]) => s.efficiency < 50)
      .map(([model, s]) => ({ model, efficiency: s.efficiency }));
    
    if (inefficientModels.length > 0) {
      recommendations.push({
        type: 'EFFICIENCY',
        message: `Низька ефективність: ${inefficientModels.map(m => `${m.model}(${m.efficiency}%)`).join(', ')}`
      });
    }
    
    return recommendations;
  }
}
