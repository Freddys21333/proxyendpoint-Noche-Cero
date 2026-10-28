# Datos explicativos para UX · 2026-10-27

Estado: incremento verificado localmente. [Contrato y fórmulas](../../specs/decision-summary.md). No cierra UX-01..UX-08, aceptación humana T-13..T-16, P-07 visual ni T-22.

## Qué cambia

`decisionSummary` (`decision-summary-v1`) se añade a nuevas respuestas de comparación, resultados de jobs y exportaciones JSON. Python deriva porcentajes de población/reducción, siguiente alternativa, dosis, gasto/saldo medios, costo por evitado y evitados por USD 100 desde réplicas y registros. Los motivos se cuentan solo donde hay decisiones adaptativas habilitadas y se expresan en réplica-día, no personas.

Se retiraron de `CombinedCostResults.tsx` los cálculos de gasto medio, saldo, evitados y cocientes. El componente formatea los valores del backend; `DecisionSummaryResults.tsx` presenta indicadores contextualizados, alternativa siguiente y motivos, conservando confianza, empates y pérdidas. El cliente comprueba formato, finitud y metadatos del resumen presente; nunca deriva cifras científicas para sustituirlo.

El campo es opcional para JSON antiguos, queda fuera del hash científico y se comprueba contra las réplicas si existe. Nuevas exportaciones lo calculan; carga no lo inventa para documentos antiguos. Reproducción compara el campo cuando estaba presente. Sin costos configurados se conservan null; beneficio ≤0 o referencia cero producen «No aplica» donde corresponde. ZIP/CSV conserva sus archivos y columnas; el resumen completo se entrega en JSON.

## TDD y verificaciones

- Base: 443 pruebas backend.
- Rojo backend: dos pruebas fallan con `KeyError: decisionSummary`, antes de implementar el campo.
- Rojo cliente: la API aceptaba una proyección de versión inválida; la prueba falla por ausencia de rechazo. Tras integrar la guarda, pasa.
- Verde: **450 pruebas backend** (62,67 s), Ruff y formato correctos (52 archivos), mypy sin problemas en 28 archivos. Siete casos nuevos cubren empate, ausencia de costos, manipulación, compatibilidad, referencia cero, pérdida, cocientes, segunda posición empatada, presupuesto cero/positivo, entregas y motivos reales, reproducción antigua/nueva.
- **139 pruebas frontend**, typecheck y build pasan. Incluye validación de números, versión, ranking, razones inválidas y compatibilidad sin campo.

```powershell
# Desde backend/
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m ruff check src tests
.venv/Scripts/python.exe -m ruff format --check src tests
.venv/Scripts/python.exe -m mypy
# Desde frontend/
npm test -- --run
npm run build
```

La prueba de referencia cero usa entradas unitarias de aritmética explícitamente identificadas, no una simulación con casos iniciales cero (el contrato actual exige al menos uno). Ningún fixture se presenta como evidencia de una corrida real.

## API y reproducción reales

API aislada `:18009`, sin AWS. Pasan los verificadores de comparación/preview/exportación, adaptación y jobs con el cliente real: `verify_local_integration.mjs`, `verify_adaptive_integration.mjs`, `verify_jobs_flow.mjs`. Informe `.tools/validation-2026-10-28T00-58-00.421Z/report.json` (UTC; fecha local 2026-10-27). Los hashes de esos escenarios permanecen iguales a los anteriores.

```powershell
$env:API_BASE = 'http://127.0.0.1:18009/v1'
node --experimental-strip-types scripts/verify_decision_summary.mjs
backend/.venv/Scripts/python.exe -X utf8 scripts/reproduce.py .tools/integration-browser-export.json
backend/.venv/Scripts/python.exe -X utf8 scripts/reproduce.py .tools/decision-summary/combined.json
```

`verify_decision_summary.mjs` comprueba los datos contra réplicas/registros de dos escenarios reales y guarda JSON en `.tools/decision-summary/`. Las cuentas independientes son oráculos de prueba, no lógica del frontend de producción.

- Base: hash `sha256:25b32fe843f969ad8a6994d7ec762e9eff4e2db038a2ae3f0f8c83a2edc62181`; costos null y empate verdadero.
- Combinado adaptativo: hash `sha256:5982f9b414dad23ecfb1a4008a0898ff6832319e8ca45e7fc7a6d118c552c1da`, igual al registrado previamente. Presupuesto USD 100; Aleatoria gasta USD 6 y Dirigida USD 21; ambas tienen cero beneficio positivo en este escenario β=0. Sus cocientes son null, sin fabricar ahorro epidemiológico. El inventario vacío se conserva como 4 días de réplica para vacunas y 2 para brigadas.
- Reproducción antigua: `sha256:8f729a08c556609ac6eb16e4df3ffb2c513b4f469a64cca4b225477a1ba3a682`. Reproducción nueva: `5982f9b4…1da`. Ambas pasan en procesos nuevos, contrastando también frames/eventos y derivados.

## Navegador

Edge con Playwright sobre frontend aislado `:5186` y proxy a API `:18009`, sin alterar servidores existentes. Configuración manual N60/T7/R2, semilla 314159265, 12 dosis:

- Comparación base: Aleatoria 1/60 (1,67 %), reducción 50 %; Dirigida 1,5/60 (2,5 %), reducción 25 %. La diferencia frente a la siguiente alternativa es 0,5 infectados medios, manteniendo confianza descriptiva.
- Se activa presupuesto y variante adaptativa en la UI y se vuelve a ejecutar. Aleatoria/Dirigida empatan en media 1, con gasto USD 760/220 y saldo USD 1.240/1.780. La UI conserva el empate pese a diferencias económicas; no cambia el objetivo de recomendación.
- Panel de omisiones: 5 días de réplica con brigadas en pausa por ausencia de infecciosos; unidad visible. Sin variante adaptativa declara información no registrada, sin presentar un cero ficticio.
- Captura completa revisada: `.tools/decision-summary/ui-final.png`, encabezados, tabla y detalle legibles con Noche Cero. Único error de consola en carga: favicon 404.

## Límites

Las omisiones reflejan el registro disponible; no infieren motivos para variantes que no los producen ni equivalen a un conteo de personas o acciones individuales. No hay nuevo objetivo económico, datos epidemiológicos externos, cambios del motor o calibración. No se aprueban gates científicos o humanos por estas pruebas. Un servidor local ya iniciado necesita reiniciarse para cargar el código nuevo; resultados antiguos sin proyección muestran un mensaje explícito.
