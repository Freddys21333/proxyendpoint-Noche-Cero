# Merge de parámetros comprensibles — 2026-10-28

Rama destino: `feat/backend-contratos`, base `33dfc76fffedc51fa098d13deaab7fb1a06799be`. Origen: `origin/codex/parametros-comprensibles`, commit `db54e03f0f4c6d5430c8fd5407ceadbd010db438` (siete commits nuevos). Merge real de ambas historias; sin cambios de backend, esquemas, datos ni protocolo T-22.

## Resolución

- App: se integra organización escenario → red → comparación, explicación de estrategias, campos comprensibles y porcentajes. Se conserva la lógica del preset P-06 oculto y el estado PRO de trabajos locales reales; se elimina el modal de ejecución sustituido por el flujo nuevo. Mensajes de error conservan claves de lista únicas.
- CombinedInterventions: se conservan el editor adaptativo y la estructura de inputs del lado verificado, incorporando useId, ayuda contextual, nombres/inputMode y secciones plegables del origen.
- ResourceScheduleEditor: se combinan input-wrap existente y atributos de entrada del origen.
- PreviewNetwork: se conserva step-back, movimiento reducido/atajos y configuración completa en VaccinationDetails; se incorporan las secciones plegables y textos nuevos de mapa/red/reproducción.
- Se integran el resto de cambios de estilos, mapa/buscadores, ayuda, controles y pruebas de parámetros. La auditoría de usabilidad importada se conserva como documento histórico, con nota de contexto actual.

## Verificación ejecutada

- Antes del merge: 147 pruebas frontend y typecheck correctos.
- Después: **150 pruebas frontend**, typecheck y build correctos.
- Backend: **510 pruebas**, Ruff y mypy correctos. Backend/esquemas/datos/T-22 no presentan diferencias respecto de la base.
- Navegador real con Playwright (Edge), API aislada :18012 y Vite :5188 con proxy: servidor disponible; editar N60/T7/K10, contagio 8 y eficacia 50; consultar red y comparar con respuesta HTTP 200. La petición envía beta=0,08 y eficacia=0,5, preservando el contrato backend. Se reciben frames reales, se vuelve a Explorar red y se avanza/retrocede un día hasta día 0 mediante step-back.
- Scripts/instantáneas de la comprobación local bajo `.tools/merge-params-browser.js`, `.tools/merge-parametros-before.yml`, `.tools/merge-parametros-preview.yml` y `.playwright-cli/`. Sin mocks de simulación.

## Límites observados

Apareció un error asíncrono de Leaflet `Cannot read properties of undefined (reading 'clearRect')` al actualizar/desmontar el mapa (dos ocurrencias en el flujo). `geographic-map.ts` y `geographic-agents-layer.ts` son idénticos entre ambas ramas; la gestión del renderer ya era compartida. No se cambió su ciclo de vida dentro de este merge. La comparación y los controles de reproducción funcionaron, pero no se declara aceptación completa del mapa/P-07 ni ausencia de errores de consola. También se observó un 404 de favicon.ico.

La prueba usa una configuración temporal de Vite fuera del producto para dirigir /v1 a la API aislada. No se modificó la configuración productiva ni se reinició la API compartida :8000. T-13..T-16, aceptación táctil/humana, T-23 y AWS mantienen sus pendientes. Las cifras y prioridades antiguas de la auditoría importada no sustituyen los estados actuales de P-02/P-03/P-08.
