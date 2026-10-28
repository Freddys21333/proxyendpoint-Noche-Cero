# Estabilización local — 2026-10-28

Estado: verificado localmente para la matriz ejecutada. Prioridad autorizada por el usuario: sitio usable localmente → UX → AWS por etapas. Esta revisión no requiere cerrar calibración nueva, miles de réplicas ni prueba formal de jurado.

Aceptación: desde sesión limpia y API real, configurar → preview → comparar → reproducir/mapa-red → exportar JSON/ZIP/PDF/HTML; entradas inválidas conservadas, resultado anterior invalidado al editar, error recuperable de API; presupuesto agotado/sin elegibles e inventario; trabajos completos, cancelación y retorno al resultado. Comprobar consola y recursos, tamaños desktop/móvil y teclado básico. Corregir bloqueos reproducidos con prueba roja/verde. Mantener hashes/cálculos, protocolo T-22, identidad Noche Cero y límites educativos.

Se registran ejecución, artefactos, pendientes y entorno en docs/evidencia. No se sustituye aceptación humana por automatización ni se marca T-13..T-16/T-23 completo por esta revisión. Sin despliegue ni AWS.

Resultado: [evidencia](../docs/evidencia/estabilidad-local-2026-10-28.md), [guía local](../docs/probar-local.md). Preflight PRO usa maxRepetitions y maxEdgeDayReplicates publicados, tamaño de la red y duración de la vista previa; no cambia parámetros automáticamente ni duplica cálculos epidemiológicos. La semilla de PRO es la de esa red; para cambiarla se genera una nueva vista previa. Backend permanece como autoridad. Regresión roja/verde, 151 pruebas frontend y flujo real comprobado.
