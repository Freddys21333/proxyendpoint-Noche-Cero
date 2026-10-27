# Revisión de conexión frontend/backend — 2026-10-27

Base revisada: `d0168d6`, rama `feat/backend-contratos`. Prioridad explícita del usuario: verificar integración antes de continuar funcionalidades. Esta revisión no ejecuta la matriz científica T-22 ni agrega funciones PRO.

## Entorno y aceptación

Windows, Node 24.21.0, Python del venv existente. API real iniciada con `backend/.venv/Scripts/python.exe scripts/serve_api.py` en 127.0.0.1:8000; Vite con `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`. Proxy `/v1` de Vite al backend, sin mocks y sin AWS. Navegador Edge mediante la skill local playwright-cli, CLI 0.1.22.

Aceptación de esta revisión: health/config reales; preview→compare usando cliente frontend; resultados y errores consistentes; exportación/reproducción; flujos locales adaptativo, presupuesto, inventario y jobs; ejecución de comparación y trabajo desde UI real; invalidación ante cambios. No equivale a aceptación humana completa, accesibilidad ni rendimiento de producción.

## Checks observados

| Comando | Resultado |
|---|---|
| Backend: `python -m pytest -q` | 391 passed, 47,59 s. |
| Backend: `python -m ruff check src tests` | Correcto. |
| Backend: `python -m ruff format --check src tests` | 44 archivos correctos. |
| Backend: `python -m mypy` | 24 archivos sin errores. |
| Frontend: `npm test` | 135 passed, 0 fallidas. |
| Frontend: `npm run build` | Typecheck y build correctos. |
| `node --experimental-strip-types scripts/verify_local_integration.mjs` | Tres escenarios reales, exportación JSON/ZIP, conservación, K=0, beta=0, eficacia=0; errores 409/422/413 verificados a través de Vite. |
| `API_BASE=http://127.0.0.1:5174/v1 node --experimental-strip-types scripts/verify_adaptive_integration.mjs` | passed; 24 filas adaptativas; rechaza decisiones falsificadas. |
| `API_BASE=http://127.0.0.1:5174/v1 node --experimental-strip-types scripts/verify_jobs_flow.mjs` | passed; creación, replay/conflicto idempotente, token desconocido 404, resultado parcial bloqueado 409, cancelación y hash secuencial coincidente. |
| `node --experimental-strip-types scripts/verify_combined_integration.mjs` | Presupuestos 0/2500/100000; saldos válidos, incluido agotamiento. |
| `node --experimental-strip-types scripts/verify_resource_schedule_integration.mjs` | Presupuestos 0/100000; llegadas/inventario/exportación y rechazo de stock adulterado. |

La primera ejecución sandbox de pytest produjo errores de acceso a temporales/caché; la repetición autorizada fuera del sandbox pasó completa. No se alteraron pruebas para ocultar el fallo de entorno.

Salidas locales ignoradas: `.tools/validation-2026-10-27T20-38-05.155Z/`, `.tools/combined-validation-2026-10-27T20-39-52.265Z/`, `.tools/resource-validation-2026-10-27T20-39-53.258Z/`. No versionar tokens, estado de navegador ni trabajos de sesión.

## Recorrido de navegador observado

1. La UI pasa de «Conectando» a «Servidor disponible» con configuración real.
2. Configurar N=60, T=7, K=12, eficacia=100 %, R=2, semilla=314159265; consultar red y comparar desde la UI.
3. Resultado: medias acumuladas none=2, random=1, targeted=1,5. Ganador aleatoria; mejora dirigida−azar expresada como −0,5 personas. La UI conserva la pérdida y etiqueta comparación descriptiva.
4. Descargar JSON y ZIP mediante botones reales. Archivos locales de 81.367 y 7.677 bytes, respectivamente. `backend/.venv/Scripts/python.exe scripts/reproduce.py .tools/integration-browser-export.json` devuelve el mismo hash `sha256:8f729a08c556609ac6eb16e4df3ffb2c513b4f469a64cca4b225477a1ba3a682`.
5. Volver a red, avanzar un día y reiniciar; controles operativos. Editar K invalida la trayectoria anterior y deshabilita comparar hasta nuevo preview. K=61 con N=60 no envía preview al pulsar consultar (validación del formulario); se conserva el valor para corregirlo. El botón no necesita estar deshabilitado para bloquear el envío.
6. Cambiar K=10, consultar nueva red y cerrar el diálogo normal de preview. Abrir PRO: recibe las 60 personas/7 días/semilla vigente y habilita iniciar trabajo.
7. Crear trabajo R=2 desde PRO: llega a Completado, 2 completadas/0 fallidas, 100 %; «Leer resultado completo» carga el resultado real.

Se observó una cabecera obsoleta «PRO · trabajos de ejemplo», mientras el cuerpo y las solicitudes usan API real. Se cambió a «PRO · trabajos locales» y se comprobó en navegador tras HMR. Cambio de texto reversible, sin alterar ciencia, contratos, hashes ni flujo de jobs.

## Límites y pendientes

- Sin fallos funcionales de conexión encontrados en los recorridos ejecutados. Único error de consola observado: 404 de favicon.ico, cosmético; no fallo de API ni excepción de aplicación.
- `buildCommit` local aparece unknown porque el servidor no recibió BUILD_COMMIT. El despliegue debe configurarlo; los hashes de experimento se verificaron por separado.
- No se ejecutó la matriz primaria/contrastes T-22, no se validó eficacia científica global ni se cambiaron semillas/protocolos congelados.
- No se cerraron T-13..T-16: faltan aceptación humana completa, toda la matriz de éxito/empate/pérdida/error, teclado/contraste, móvil, movimiento reducido y medición humana.
- El recorrido de red se comprobó; no se certifican aquí tiles OSM externos, rendimiento del mapa ni funcionamiento offline.
- Jobs siguen siendo memoria local no durable. No hay despliegue AWS, cuotas verificadas ni notificación Budget confirmada.
- No se cambiaron motor, generador, calibración, versiones científicas ni infraestructura.
