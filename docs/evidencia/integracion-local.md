# Integración local incremental en feat/front-end

## I-01 — Servidor real y proxy

`scripts/serve_api.py` publica los cuatro handlers solo en 127.0.0.1:8000, con traducción HTTP→evento v2→bytes HTTP. Conserva Content-Encoding gzip y Content-Length de los bytes reales. Entrada limitada a 64 KiB; no habilita CORS wildcard. Vite reenvía /v1 al mismo backend mediante proxy. No reemplaza despliegue ni ejecuta simulaciones desde la interfaz todavía.

Rojo observado: test_local_server falló antes de crear serve_api.py. Verde: prueba HTTP real en puerto efímero para health/preview/error, con cierre explícito de conexión HTTPError y servidor. Resultado: 32 pruebas aprobadas de test_local_server.py + test_api.py; las 9 pruebas originales del frontend también pasaron. Lint del proyecto desde backend y mypy correctos para código nuevo. Se usa pyproject.toml desde backend para resolver src y evitar reglas globales ajenas al proyecto.

Node 24.22.1 y npm 11 quedaron en .tools/node (ignorado), sin instalaciones globales. `scripts/frontend.ps1` usa esas herramientas si existen y, en otros equipos, npm instalado. Se instalaron 390 paquetes con npm ci respetando package-lock.json. Para iniciar: backend/.venv/Scripts/python.exe scripts/serve_api.py y, en otra terminal, scripts/frontend.ps1 run dev. Servidor secuencial y loopback, solo desarrollo.

Siguiente incremento: cliente de API y preview desde el formulario; la red/animación y comparación seguirán identificadas como demo hasta conectar sus vistas.


## I-02 — Cliente y consulta de preview real

Cliente tipado health/config/preview con base /v1 configurable (VITE_API_BASE_URL), traducción Scenario→configuration, errores HTTP/red/JSON y AbortSignal. La interfaz consulta health/config al montar y el formulario llama a preview; no invoca compare todavía. El diálogo muestra datos reales de población/contactos/semilla. Cambios/reset cancelan e invalidan preview, preservando entradas; se ignoran respuestas abortadas. La red, animación y comparación siguen etiquetadas como demo.

Rojo: las cuatro pruebas iniciales del cliente fallaron con API client/Scenario mapping not implemented antes de implementarlos. Verde: mapeo, URLs, errores y prueba adicional de cancelación. Build y tipos correctos; 14 pruebas frontend en total (9 previas + 5 de cliente). Servidor/API: 32 pruebas específicas; lint del backend y mypy correctos. Se manejan conexiones cerradas por el navegador al cancelar.

Prueba manual en navegador sobre Vite 127.0.0.1:5174 y backend 127.0.0.1:8000: estado Servidor disponible; formulario N=50/T=3/K=10→Consultar red→diálogo con 50 personas, 322 contactos y semilla 20261026. Al cambiar población a 51, se verificó la invalidación y preservación del nuevo valor. Screenshot local en .tools/integration-preview.png (ignorado, no es resultado científico). El proxy/browser descomprime gzip sin código de base64 en cliente. Se verificó la separación explícita entre preview real y explorador demo. Procesos locales ejecutados fuera del aislamiento para permitir acceso desde navegador, siempre loopback.

Pendiente I-03: renderizar grafo/origen real y conectar reproducción/curvas/resultados. T-12/13 no se declaran cerrados por estos avances parciales. No se alteró main ni se desplegó AWS.
