# Integración local incremental en feat/front-end

## I-01 — Servidor real y proxy

`scripts/serve_api.py` publica los cuatro handlers solo en 127.0.0.1:8000, con traducción HTTP→evento v2→bytes HTTP. Conserva Content-Encoding gzip y Content-Length de los bytes reales. Entrada limitada a 64 KiB; no habilita CORS wildcard. Vite reenvía /v1 al mismo backend mediante proxy. No reemplaza despliegue ni ejecuta simulaciones desde la interfaz todavía.

Rojo observado: test_local_server falló antes de crear serve_api.py. Verde: prueba HTTP real en puerto efímero para health/preview/error, con cierre explícito de conexión HTTPError y servidor. Resultado: 32 pruebas aprobadas de test_local_server.py + test_api.py; las 9 pruebas originales del frontend también pasaron. Lint del proyecto desde backend y mypy correctos para código nuevo. Se usa pyproject.toml desde backend para resolver src y evitar reglas globales ajenas al proyecto.

Node 24.22.1 y npm 11 quedaron en .tools/node (ignorado), sin instalaciones globales. `scripts/frontend.ps1` usa esas herramientas si existen y, en otros equipos, npm instalado. Se instalaron 390 paquetes con npm ci respetando package-lock.json. Para iniciar: backend/.venv/Scripts/python.exe scripts/serve_api.py y, en otra terminal, scripts/frontend.ps1 run dev. Servidor secuencial y loopback, solo desarrollo.

Siguiente incremento: cliente de API y preview desde el formulario; la red/animación y comparación seguirán identificadas como demo hasta conectar sus vistas.
