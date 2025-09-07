module.exports = {
  apps: [{
    name: 'codespaces-models',
    script: './server.js',
    cwd: '/var/www/codespaces-models',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
      PORT: 3010
    }
  }]
};
