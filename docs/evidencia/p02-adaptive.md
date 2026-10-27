# Evidencia local P-02

Fecha: 2026-10-27. Rama: `feat/backend-contratos`. Contrato vigente: [P-02](../../specs/p02-adaptive-policy.md).

## Correcciones verificadas

- Schema compartido para `adaptiveDecisions`, selección `ringContact` y conteo `infectiousContacts`; validación de umbrales de histéresis.
- Registro de cierre ejecutado frente a solicitud; motivos de omisión por presupuesto, inventario, capacidad o elegibilidad. La pausa I=0 se identifica sin declarar extinción si E>0.
- CSV usa el serializador común para arrays/booleanos; evita uso de `json` sin importar y errores al leer comas/CRLF. Backend y cliente incluyen decisiones y puntuación de anillo.
- Cliente admite los cierres adaptativos fuera del calendario fijo exclusivamente para la variante configurada y explica el anillo. Validación de observaciones/acciones y comparación de parámetros por valor.
- API de configuración mantiene `asyncJobs:false` hasta publicar realmente las rutas P-03; anunciar true rompía su contrato y el inicio del cliente.

## Ejecuciones

1. Suite focalizada final: `test_adaptive.py`, `test_adaptive_export.py`, `test_adaptive_regression.py`, `test_resource_schedule.py`, `test_combined.py`: **37 pruebas aprobadas**. Incluye 17 de adaptativa, conservación física/monetaria con saldo cero y limitado, entregas futuras, dosis fallidas sin repetición, reapertura, último día, I=0/E>0, reglas deshabilitadas, independencia del orden de políticas/réplicas, exportación/reproducción y rechazo de decisiones alteradas incluso recalculando hashes.
2. Frontend: **102 pruebas aprobadas**; compilación TypeScript/Vite comprobada. Incluye restaurar reglas equivalentes sin mutar entradas e invalidar umbrales invertidos.
3. Ruff: fuentes y pruebas P-02 sin incidencias; formato comprobado. Mypy focalizado en configuración, motor y exportación sin incidencias. El chequeo global conserva pendientes P-03 descritos abajo.
4. HTTP real: `scripts/verify_adaptive_integration.mjs`, servidor loopback `scripts/serve_api.py --port 18002`, cliente TypeScript real. Recorre preview -> compare con frames -> CSV. N=50, T=3, R=2, semilla 314159265, presupuesto 10000 centavos, calendario de recursos y variante adaptativa. Verifica cierre fuera del calendario fijo, anillo, 24 filas diarias y rechazo cliente de fracción/cierre/selección falsificados. Resultado: **passed**, hash `sha256:5982f9b414dad23ecfb1a4008a0898ff6832319e8ca45e7fc7a6d118c552c1da`.

Para repetir HTTP, iniciar servidor en una terminal y ejecutar en otra:

```powershell
.\backend\.venv\Scripts\python.exe scripts/serve_api.py --port 18002
.\.tools\node\node.exe --experimental-strip-types scripts/verify_adaptive_integration.mjs
```

`API_BASE` permite otro servidor local. Las respuestas de la prueba proceden del motor; el transporte simulado se usa únicamente para comprobar rechazo de respuestas alteradas.

## Límites y pendientes separados

La ejecución amplia `pytest backend/tests --ignore=backend/tests/test_jobs_local.py -q --tb=short` obtuvo **340 aprobadas y 3 fallos**. Se corrigió el fallo de configuración y se volvió a ejecutar su prueba: aprobada. Los otros dos fallos son lecturas de `schemas/openapi.yaml` por anchors YAML duplicados introducidos con P-03, pendientes del siguiente incremento. No se declara suite global aprobada.

`test_jobs_local.py` se excluyó de esa ejecución amplia porque sus fixtures tienen valores inválidos ya comprobados antes de P-02 (50 personas con 100 vacunas predeterminadas y solicitud de 50 réplicas frente al máximo 30). P-03 además requiere conectar rutas reales, limitar concurrencia, revisar cancelación/idempotencia y completar sus contratos. El mypy global mantiene errores en el código de trabajos/API P-03; las fuentes P-02 se comprobaron por separado.

El sandbox Windows impidió inicialmente usar temporales y sockets en pruebas generales. La ejecución amplia y HTTP se repitieron con permisos locales suficientes; esos fallos de permisos no se contaron como errores del motor.

El backend y compatibilidad del cliente P-02 quedan verificados localmente. Falta el editor e historial visual específico del frontend. No se ejecutó AWS, calibración real ni el protocolo científico T-22.
