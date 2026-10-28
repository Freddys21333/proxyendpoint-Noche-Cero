# P-04 — implementación y validación local

Fecha: 28 de octubre de 2026. Rama: `feat/aws-infra`. No desplegado.

Se implementan repositorio durable DynamoDB/S3, API con capacidades e idempotencia,
workers por índices globales, agregación canónica, cancelación terminal y
orquestación Standard Distributed Map. El estado local P-03 conserva límite 100;
AWS admite hasta 1000. La comparación síncrona conserva límite 30.

## Evidencia ejecutada

- Prueba inicialmente roja: faltaba `simulation.distributed`. Tras implementarlo,
  lotes desordenados coinciden exactamente con `run_experiment` (incluidos frames),
  y se rechazan índices duplicados/incompletos.
- Prueba de 1000 réplicas **locales**, N50/T1/beta0: exportación canónica y conteos
  completos. Es un caso funcional, no un experimento científico ni ejecución AWS.
- boto3 contra Moto para DynamoDB/S3: transacciones, progreso idempotente,
  admisión diaria, bloqueo, capacidades, expiración, cancelación, transporte HTTP,
  resultado privado y reproducción de hash. Step Functions se sustituye por un
  doble controlado en estas pruebas; no acredita su integración desplegada.
- Cliente: descarga firmada regional, rechazo de origen ajeno y ausencia de
  `X-Job-Token` en la llamada a S3; validación completa del experimento descargado.
- Terraform validate correcto. Plan con jobs habilitados: **83 altas, cero cambios,
  cero destrucciones**; no aplicado. El stack de aplicación permanece retirado.
- Validador oficial de Step Functions consultado con ARNs de ejemplo:
  `result: OK`, `diagnostics: []`. No creó una máquina ni ejecutó un flujo.
- Protocolo T-22: 15 experimentos, 450 pares, 150 primarios; hash congelado
  `cb6b3e62795de8a6ec87f1a7e4c972c692ebbcb5144d3546ec6f622a92ffbb8b`,
  cero simulaciones T-22 ejecutadas. No se modificó v1.

Los resultados de la suite completa, tipos, build y paquete se registran al cierre
de esta iteración. Datos auxiliares y planes locales: `.tools/p04-*` (ignorados).

## Operación y límites

Ver [P04-OPERACION.md](../../infra/P04-OPERACION.md). Un trabajo activo, dos workers,
tres admisiones diarias por stack, hasta 1000 réplicas dentro de 50 millones de
arista-día-réplica, expiración de metadatos y artefactos, timeout y reintentos
limitados. Sin presupuestos monetarios inventados ni afirmación de costo real.

## Pendiente de aceptación AWS

Publicar con autorización y medir primero 100 réplicas; después una prueba de
1000 autorizada por separado. Comprobar permisos efectivos, Step Functions→Lambda,
EventBridge, CORS S3, progreso/cancelación desde navegador, reproducción con el
entorno del manifiesto y costos completos. P-04 permanece abierto hasta contar
con esta evidencia; pruebas locales, mocks y plan no equivalen a miles en AWS.

## Cierre de verificación

Suite final: **519 pruebas backend**, Ruff/formato/mypy correctos (31 módulos),
**152 pruebas frontend**, typecheck y build correctos. Terraform validate correcto;
validador ASL oficial OK, sin diagnósticos. Paquete Linux con SDK AWS construido
con las versiones científicas fijadas; el constructor verifica límites de ZIP y
contenido descomprimido de Lambda. No se aplicó Terraform ni se ejecutaron lotes AWS.

Actualización posterior: [main desplegado y prueba real de 100 réplicas](despliegue-main-p04-2026-10-28.md). El estado no desplegado de este informe corresponde a su fase local.
