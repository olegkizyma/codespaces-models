Локальне тестування rate limit та метрик

Коротка інструкція для швидкої перевірки локально (замість складного навантаження):

1) Запустіть сервер з малим лімітом (фоново або в іншому терміналі):

```bash
RATE_LIMIT_PER_MINUTE=3 METRICS_ENABLED=1 PORT=3010 node server.js &
```

2) Надішліть серію швидких запитів до `/v1/test-model` (наприклад 6 запитів):

```bash
for i in $(seq 1 6); do
  curl -s -X POST http://localhost:3010/v1/test-model -H 'Content-Type: application/json' -d '{"model":"gpt-4o-mini"}' -w "\nHTTP_STATUS:%{http_code}\n"
  sleep 0.2
done
```

Очікуваний результат: перші ~3 запити — 200, наступні — 429 з полем `rate_limit.retry_after_ms` у відповіді.

3) Перевірте readiness і метрики Prometheus:

```bash
curl -s http://localhost:3010/ready
curl -s http://localhost:3010/metrics | sed -n '1,200p'
```

Порада: для тестування Redis‑режиму запустіть Redis і вкажіть `REDIS_URL` перед запуском сервера.

Примітка: при великій кількості унікальних шляхів варто нормалізувати path‑лейбл у метриках, щоб уникнути високої cardinality.
