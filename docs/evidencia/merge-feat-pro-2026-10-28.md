# Merge de `feat/pro` sobre `feat/backend-contratos` (2026-10-28)

Estado: **merge resuelto y verificado en local**. No hay despliegue, no se ejecutaron lotes AWS y no se modificó ningún protocolo congelado.

## 1. Contexto

- `feat/backend-contratos` (lado conservado) contenía el estado más reciente y verificado: T-22 aprobado, P-02/P-03/P-05/P-06 locales, P-08 PDF backend, P-07 backend, `decisionSummary` y rendimiento.
- `origin/feat/pro` aportó 13 commits con P-07 UI (navegación temporal, `step-back`, atajos, movimiento reducido), P-08 HTML/CLI, SEO/`index.html`, `docs/costos.md` y varias evidencias.
- Base común del merge: `d444ccf`. Copia de seguridad previa: rama `backup/backend-contratos-pre-merge-20261027`.

## 2. Criterio de resolución

1. **Documentación y specs:** se conservó el lado ya verificado (`feat/backend-contratos`) y se actualizaron sus afirmaciones con lo que el merge incorpora realmente (P-07 UI integrada, P-08 HTML/CLI, recuentos de pruebas). Los docs de `feat/pro` describían 357 pruebas backend y P-05/P-06 pausados: ese estado ya era obsoleto y no se conservó.
2. **Protocolo T-22:** se conservaron intactos `specs/validation/t22-v1`, `docs/evidencia/t22-v1-ejecucion.md` y `.json` del lado verificado (la versión de `feat/pro` era un resumen previo).
3. **Pantalla PRO (P-03):** se conservó la implementación verificada (`JobsWorkspace`, `JobForm`, `JobStatusPanel`, `JobHistory`, `jobs-model`, `job-session`), que usa token en `sessionStorage`, idempotencia, sondeo, reintento e historial. La variante de `feat/pro` era anterior y basada en fixtures.
4. **Código nuevo de `feat/pro` que sí se integra:** `PreviewNetwork`, `SimulationWorkspace`, `simulation-playback` (`step-back` y movimiento reducido), `ContactNetwork.css`, `ProWorkspace.css`, `index.html` (SEO), `docs/costos.md`, `scripts/export_mayor_report_pdf.mjs` y `lib/seo.test.ts`.
5. **Módulos duplicados descartados** (la lógica equivalente ya existe en el lado verificado): `pro/adaptive-decisions.ts` y `pro/AdaptiveDecisionHistory.tsx` (cubiertos por `lib/adaptive.ts` y `components/AdaptiveDecisionsPanel.tsx`), `pro/jobs-errors.ts` (cubierto por `jobs-model` y el reintento de `JobsWorkspace`) y `pro/fixtures/jobs.ts` (la pantalla PRO no usa fixtures).
6. **Informe P-08:** se conservaron **ambas** rutas. El PDF canónico sigue viniendo del backend (`fetchMayorReport` → `POST /v1/reports/mayor`), y se añadió `buildMayorReportHtml` para impresión/HTML autocontenido, usado por la CLI y por los botones «Imprimir informe» y «Descargar informe (HTML)» del panel de descarga.

## 3. Verificación ejecutada después del merge

| Verificación | Comando | Resultado observado |
|---|---|---|
| Pruebas backend | `backend/.venv/Scripts/python.exe -m pytest -q` | **487 passed** (51,99 s) |
| Lint backend | `ruff check src tests` | All checks passed |
| Formato backend | `ruff format --check src tests` | 55 files already formatted |
| Tipos backend | `mypy` | Success: no issues found in 28 source files |
| Pruebas frontend | `npm test -- --run` | **147 tests, 147 pass, 0 fail** |
| Tipos frontend | `npm run typecheck` | Sin errores |
| Build frontend | `npm run build` | `✓ built in 4.82s` |
| P-05 | `python scripts/p05_import_dengue.py verify` | `passed`; 94 semanas, 18 259 casos, `csv_sha256` `e51b0858…` |
| P-06 | `python scripts/p06_calibrate.py verify` | `passed`; preset `manabi-dengue-2025-v1`, hash `sha256:2cde2f34…` |

No se regraficaron hashes: `data/p05`, `data/p06/dengue-preset-v1.json` y las fixtures del motor quedaron iguales.

## 3.1 Humo en navegador (post-merge)

Con la API local (`scripts/serve_api.py`, `:8000`) y Vite (`:5174`) sobre el árbol fusionado:

- La página carga sin errores de consola y el estado del servidor pasa a «Servidor disponible».
- La vista PRO renderiza con la hoja de estilos fusionada: encabezado, «Experimento disponible ahora», nota de servidor local, navegación de secciones y estado de integración.
- Flujo real completo: «Consultar red» (1000 personas, 90 días) y «Comparar estrategias» con 30 réplicas terminaron en «Comparación de estrategias» con resultados del motor, sin errores de consola.
- En Comparación aparecen los tres botones del informe: PDF del backend, «Imprimir informe» y «Descargar informe (HTML)».
- En la vista de red aparecen los controles de reproducción con «Día 0 / 90», retroceso y avance de día, alternancia «Movimiento reducido» y la pista de atajos.

Este humo comprueba que el merge no rompe la aplicación; **no sustituye** la aceptación formal de P-07 (rendimiento visual, táctil, foco) ni T-13..T-16.

## 4. Límites

- El merge **no añade aceptación humana**: T-13..T-16, T-23 y la semilla externa siguen pendientes.
- P-07 queda **UI integrada con aceptación pendiente**: el humo en navegador confirma que funciona, pero faltan la aceptación formal de rendimiento visual, dispositivos táctiles y foco/teclado.
- P-04/AWS sigue sin iniciarse; `infra/` permanece vacío y no hay URL pública.
- La evidencia de `feat/pro` citaba 138 pruebas frontend y 21 archivos backend; tras el merge el recuento real es 147 frontend y 28 archivos backend tipados.
