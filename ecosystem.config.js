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
        UPSTREAM_CONCURRENCY_ENABLED: "1"
      },
      autorestart: true,
      restart_delay: 1000,
      max_restarts: 10,
      max_memory_restart: "512M",
      error_file: "./logs/openai-proxy-error.log",
      out_file: "./logs/openai-proxy-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true
    }
  ]
};
