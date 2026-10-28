# Cierre P-08: informe determinista para alcaldía en PDF y HTML

Fecha: 2026-10-28.
Alcance: generación directa y reproducible de PDF y HTML imprimible para alcaldía/comité desde una respuesta `CompareResponse` validada. Escenario ficticio/educativo; sin datos de dengue ni costos AWS.

## 1. Implementación

1. **Generador y estilos de paginación (`frontend/src/lib/mayor-report.ts`):**
   - Configuración `@page { size: A4 portrait; margin: 15mm; }` y reglas de `@media print` para evitar cortes de tablas y secciones (`break-inside: avoid`), mantener títulos ligados (`break-after: avoid`) y asegurar contraste tipográfico legible.
   - Soporte opcional de `autoPrint: true` para invocar inmediatamente el diálogo de guardado en PDF al abrir la ventana.
   - Integración completa de la variante adaptativa P-02 (`adaptive-policy-v1`): expone umbrales de cierre/reapertura de contexto, prioridad de anillo y decisiones observables sin alterar el hash del experimento.
   - Presupuesto y gasto educativo de intervención combinada P-01: saldo estimado, costos medios por política y advertencia visible de que son supuestos educativos y no costos sanitarios reales ni AWS.

2. **Acciones en la interfaz (`ComparisonResults.tsx` y `App.tsx`):**
   - **Imprimir / Guardar informe (PDF):** abre una ventana dedicada con el informe renderizado y activa la orden de impresión del navegador para guardar directamente en PDF. Si el navegador bloquea la ventana emergente, realiza una descarga alternativa automática del archivo HTML.
   - **Descargar informe (HTML):** descarga el archivo HTML autocontenido para archivado, auditoría o visualización offline.

3. **Script CLI oficial para generación reproducible de PDF (`scripts/export_mayor_report_pdf.mjs`):**
   - Comando documentado:
     ```sh
     node --experimental-strip-types scripts/export_mayor_report_pdf.mjs [experimento.json] [--output salida.pdf] [--html-only]
     ```
   - Detecta automáticamente el ejecutable de Chromium (incluyendo binarios en caché de Playwright o el sistema).
   - Genera el PDF con `--headless --disable-gpu --no-pdf-header-footer --print-to-pdf=<archivo>`.
   - Valida determinismo, tamaño > 0 y cabecera estándar `%PDF-`.

## 2. Comandos y evidencia de verificación

| Verificación | Comando | Resultado |
|---|---|---|
| Pruebas frontend | `cd frontend && npm test -- --run` | **136 pruebas aprobadas** (incluyendo pruebas unitarias del reporte, soporte adaptativo y ejecución del script CLI). |
| Tipado frontend | `cd frontend && npm run typecheck` | Aprobado sin errores (`tsc --noEmit`). |
| Build frontend | `cd frontend && npm run build` | Aprobado. Chunk `mayor-report`: 3.72 KB gzip (lazy loaded). Bundle base: 122.67 KB gzip. |
| Backend | `cd backend && .venv/bin/python -m pytest -q` | **357 pruebas aprobadas**, 38.13 s. |
| Calidad backend | `cd backend && .venv/bin/python -m ruff check src tests && .venv/bin/python -m mypy` | Aprobado; 0 alertas, 21 archivos revisados por mypy. |
| Generación PDF CLI (fixture) | `node --experimental-strip-types scripts/export_mayor_report_pdf.mjs --output .tools/informe-test.pdf` | **56.528 bytes**, cabecera `%PDF-`, empate reportado. |
| Generación PDF CLI (`base-root-0`) | `node --experimental-strip-types scripts/export_mayor_report_pdf.mjs .tools/t22-v1-attempt-01/base-root-0.json --output .tools/informe-base-root-0.pdf` | **60.592 bytes**, cabecera `%PDF-`, ganador `targeted`, hash `ead1ee4c...ae3e0c5`. |

## 3. Estado de aceptación de P-08

- [x] Plantilla determinista con problema, escenario ficticio, recursos, comparación, incertidumbre y límites.
- [x] Cifras idénticas a la respuesta validada del experimento.
- [x] Conservación de empates y pérdidas negativas sin prometer ganador absoluto por semilla.
- [x] Salida directa PDF reproducible mediante comando documentado y vía diálogo del navegador en la interfaz web.
- [x] Identificación explícita de escenario ficticio y población sintética (no representa dengue real).
- [ ] *Nota de dependencia:* no incluye calibración con dengue real porque P-05 y P-06 continúan abiertos según el orden oficial del proyecto.
