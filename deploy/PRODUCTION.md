Production process supervision

Systemd (recommended on modern Linux):

- Copy `deploy/systemd/codespaces-models.service` to `/etc/systemd/system/`
- Update `WorkingDirectory` and `ExecStart` paths and set `Environment=REDIS_URL=` if using Redis
- Run: `systemctl daemon-reload && systemctl enable --now codespaces-models`

PM2 (alternative):

- Install pm2: `npm i -g pm2`
- Copy `deploy/pm2/ecosystem.config.js` to your deploy folder and update `cwd` if needed
- Start: `pm2 start ecosystem.config.js`
- Use `pm2 save` and `pm2 startup` to make persistent across reboots

Notes:
- Use a process supervisor instead of the repo `watchdog.sh` in production. Keep health checks /readiness wired into your orchestration.
- Set `REDIS_URL` in environment to enable Redis-backed global rate limiting.
