module.exports = {
  apps: [
    {
      name: "openai-proxy",
      script: "./server.js",
      cwd: process.cwd(),
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: "4000",
        STRICT_OPENAI_API: "true",
        METRICS_ENABLED: "1",
        RATE_LIMIT_ENABLED: "1",
        ADAPTIVE_RATE_LIMITS: "1",
        UPSTREAM_CONCURRENCY_ENABLED: "1",
        UPSTREAM_MAX_CONCURRENT: "8",
        QUEUE_MAX_LENGTH: "100",
        QUEUE_WAIT_TIMEOUT_MS: "45000",
        RETRY_ATTEMPTS: "3",
        RETRY_DELAY_MS: "1000",
        CIRCUIT_BREAKER_THRESHOLD: "10",
        CIRCUIT_BREAKER_TIMEOUT: "60000",
        RATE_LIMIT_PER_MINUTE: "30"
      },
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 15,
      max_memory_restart: "1G",
      min_uptime: "10s",
      kill_timeout: 5000,
      error_file: "./logs/openai-proxy-error.log",
      out_file: "./logs/openai-proxy-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
      ignore_watch: [
        "node_modules",
        "logs",
        "*.log"
      ],
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
}
