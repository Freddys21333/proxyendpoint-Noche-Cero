# Costos AWS y presupuesto del evento

Corte: **28/10/2026, 06:13 (America/Guayaquil)**. Infraestructura en **us-east-2 (Ohio)**. Importes en USD, antes de impuestos. Presupuesto educativo del simulador y facturación AWS son conceptos independientes.

## Presupuesto y fechas

- **USD 20 asignados al evento desde el 26 de octubre**, según el equipo.
- **Operación del despliegue actual: 28–30 de octubre de 2026**, ambos incluidos.
- AWS Budget `SpookyThon2026-PRO` está configurado por **USD 20 mensuales**, para octubre completo. No tiene un período personalizado que empiece el 26.
- El Budget avisa; no bloquea consumo. Las capturas archivadas muestran **0/2 destinatarios verificados**: no acreditan entrega de correo.

## Estimación mensual reproducible

**USD 2,63/mes para el escenario de planificación siguiente**, sin descontar Free Tier ni créditos. No es una tarifa fija, factura ni máximo garantizado. No extrapolar este importe a redes más grandes o uso ilimitado.

Se supone un mes de 30 días con 1000 visitas (5 MiB de archivos por visita), 1000 comparaciones, 1000 previews, 200 informes, 8000 consultas ligeras y 1000 solicitudes de trabajos/sondeo. Diez trabajos de 1000 réplicas cada uno, **N=60/T=7**, repartidos en 200 lotes de cinco por trabajo; no son mil workers simultáneos. Despliegue manual: compilación local, **cero minutos de build en Amplify**. Los diez trabajos caben en la cuota de tres admisiones diarias si se distribuyen en varios días.

Duraciones **supuestas**, pendientes de medición mensual: comparación 3 s/3008 MB; preview 1 s/1024 MB; informe 2 s/2048 MB; consulta ligera 0,1 s/256 MB; API jobs 0,2 s/1024 MB; worker 2 s/3008 MB; agregado 30 s/3008 MB; preparación y limpieza 1 s/256 MB. Hay diez preparaciones, diez agregaciones y margen de veinte llamadas de limpieza. Memoria GB = MB/1024; se presupuestan 13 240 invocaciones y 23 651,25 GB-s.

Step Functions se presupuesta con **cuatro transiciones por lote más diez por trabajo** como margen de planificación para ejecuciones padre/hijas. No es un conteo observado ni una transición por réplica: hay que contrastarlo con el historial real, incluidas repeticiones/reintentos. No se descuentan las 4000 transiciones gratuitas.

Almacenamiento medio: Amplify 0,1 GB; S3 0,5 GB incluyendo artefactos y versiones del estado; DynamoDB 0,1 GB. Se reservan 5000 PUT y 15 000 GET S3; 20 000 unidades de escritura y 100 000 de lectura DynamoDB (unidades facturables, no llamadas; contemplar tamaño y operaciones transaccionales). Logs: 1 GB/mes, retención siete días y cinco alarmas estándar. Salida API/S3: 2 GB adicionales a los archivos frontend. No se descuenta la franquicia de transferencia. Una consulta de Cost Explorer para el cierre.

| Servicio | Cálculo en USD | Mensual (USD) |
|---|---|---:|
| Amplify | 1000 × 5/1024 GB × 0,15 + 0,1 GB-mes × 0,023; build AWS = 0 | 0.7347 |
| API Gateway HTTP | 11200 solicitudes × 0,000001 | 0.0112 |
| Lambda | 23651.2500 GB-s × 0,0000166667 + 13240 solicitudes × 0,0000002 | 0.3968 |
| Step Functions Standard | 10 × (200 × 4 + 10) transiciones × 0,000025 | 0.2025 |
| S3 | 0,5 GB-mes × 0,023 + 5000 PUT × 0,000005 + 15000 GET × 0,0000004 | 0.0425 |
| DynamoDB | 20000 WRU × 0,000000625 + 100000 RRU × 0,000000125 + 0,1 GB-mes × 0,25 | 0.0500 |
| CloudWatch | 1 GB logs × 0,50 + (7/30) GB-mes × 0,03 + 5 alarmas × 0,10 | 1.0070 |
| Salida API/S3 | 2 GB × 0,09 (separados del frontend) | 0.1800 |
| Cost Explorer | 1 consulta de cierre × 0,01 | 0.0100 |
| **Total** | Suma sin redondeo intermedio | **2.63** |

Reproducir desde la raíz (solo calcula, no conecta a AWS):

```powershell
backend/.venv/Scripts/python.exe scripts/estimate_monthly_costs.py
```

El script usa `Decimal` y suma sin redondeo intermedio. Los valores de uso son supuestos visibles; al disponer de mediciones se deben reemplazar, conservando la fecha y la versión de esta estimación.

### Tarifas y alcance

Consultadas el 28/10/2026. Tarifas bajo demanda del primer tramo: Lambda x86 USD 0,0000166667/GB-s y 0,20/millón de invocaciones; HTTP API USD 1/millón; Standard USD 0,025/1000 transiciones. S3 Standard USD 0,023/GB-mes, 0,005/1000 PUT y 0,0004/1000 GET. DynamoDB Standard USD 0,625/millón WRU, 0,125/millón RRU y 0,25/GB-mes de almacenamiento facturable. S3, DynamoDB y HTTP API se contrastaron además con AWS Price List para `us-east-2`.

Amplify: USD 0,15/GB servido y 0,023/GB-mes almacenado. CloudWatch: USD 0,50/GB de ingestión, 0,03/GB-mes y 0,10/alarma estándar; salida a Internet presupuestada a USD 0,09/GB. Confirmar región, tramo y cambios de tarifa al repetir la estimación.

Fuentes oficiales: [Lambda](https://aws.amazon.com/lambda/pricing/), [API Gateway](https://aws.amazon.com/api-gateway/pricing/), [Step Functions](https://aws.amazon.com/step-functions/pricing/), [S3](https://aws.amazon.com/s3/pricing/), [DynamoDB](https://aws.amazon.com/dynamodb/pricing/), [Amplify](https://aws.amazon.com/amplify/pricing/), [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/) y [transferencia](https://aws.amazon.com/ec2/pricing/on-demand/).

El stack usa diez Lambdas, HTTP API, Amplify, S3, DynamoDB, Step Functions y recuperación de estados terminales mediante eventos de servicios AWS en EventBridge. No crea EC2, NAT Gateway, VPC, dominio propio, Bedrock ni SageMaker. No se presupuestan impuestos, soporte de pago, servicios ajenos al stack, trabajo humano ni compras opcionales. Nuevos recursos, más tráfico, logs, sondeo, reintentos o ejecuciones fallidas cambian el total. Las versiones antiguas del estado Terraform permanecen y pueden aumentar S3.

## Gasto real disponible y cierre pendiente

| Concepto | Resultado de la consulta del 28/10 | Alcance |
|---|---:|---|
| AWS Budget mensual | USD 0,00 consumidos / USD 20,00 | Indicador mensual de cuenta; no prueba de factura final |
| Cost Explorer, 26 de octubre | Uso USD 0,0000000304; crédito USD −0,0000000304; neto USD 0,00 | Cuenta completa, `Estimated=true` |
| Cost Explorer, 27 de octubre | USD 0,00 | Cuenta completa, `Estimated=true` |
| Cost Explorer, 28 de octubre | USD 0,00 | **Acumulado provisional del primer día de despliegue**, `Estimated=true` |
| 29–30 de octubre | **Aún no disponibles** | Fechas futuras al corte |
| **Total final del despliegue 28–30** | **Pendiente de cierre** | No declarar cero definitivo |

La [lectura versionada](evidencia/facturacion-2026-10-28.json) conserva fecha, métrica, períodos y tipos de registro, sin credenciales ni destinatarios. La consulta agrupa por tipo de registro y suma sus grupos, separando consumo y créditos. No se han activado filtros de asignación por proyecto: no permite atribuir cada cargo de la cuenta exclusivamente a esta aplicación.

Cost Explorer actualiza al menos diariamente y puede tardar más de 24 h. Sus cifras estimadas cambian hasta el cierre; que hoy aparezca cero no acredita operación gratuita ni descuenta consumos pendientes de ingestión. [Actualización y costo de consulta](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html) y [diferencias con facturación](https://docs.aws.amazon.com/cost-management/latest/userguide/differences-billing-data-cost-explorer-data.html).

La [prueba real AWS de 100 réplicas](evidencia/despliegue-main-p04-2026-10-28.md) midió 32,7854375 GB-s en workers: multiplicados por la tarifa son aproximadamente **USD 0,000546 de cómputo worker**. Ese cálculo no incluye API, preparación, agregado, Step Functions, almacenamiento ni logs, y no sustituye la factura. La ejecución real de 1000 réplicas sigue pendiente.

### Cómo cerrar el gasto después del 30

Consultar cuando haya transcurrido la latencia de facturación, guardar una lectura nueva y reemplazar el estado pendiente por el resultado observado. Mantener el corte provisional para trazabilidad. Cada solicitud paginada de Cost Explorer cuesta USD 0,01; evitar sondeo repetido.

```powershell
# Fechas de facturación UTC: End es exclusivo.
aws ce get-cost-and-usage --time-period Start=2026-10-28,End=2026-10-31 --granularity DAILY --metrics UnblendedCost --group-by Type=DIMENSION,Key=RECORD_TYPE --region us-east-1 --output json
# Para reconciliar los USD 20 del evento completo, repetir con Start=2026-10-26.
```

Sumar `Groups[].Metrics.UnblendedCost.Amount` por día usando decimal; con agrupación no tomar `Total` como sustituto. Conservar `Estimated`, separar `Usage`, `Credit` y otros tipos presentes, y verificar la factura final de octubre. Esta ventana usa días UTC; si se requiere el horario local exacto del evento, declarar y reconciliar esa diferencia. Sin etiquetas de costo activadas, reportar el total como cuenta completa y documentar otros consumos.

## Evidencia del Budget

Capturas archivadas, no capturas nuevas del corte de facturación. La consulta del 28/10 confirmó límite mensual USD 20 y alertas de consumo real al 25/50/75/100 %, más previsto al 100 %. Estado `OK` significa umbral no superado; no demuestra recepción de correo. Verificación de destinatarios y entrega de alertas **pendientes**. No se enviaron correos de verificación.

![Budget mensual de USD 20; captura con destinatarios pendientes](budget.png)

![Alertas configuradas de consumo y previsión](budget2.png)

Para publicar y retirar: [ciclo Terraform](../infra/CICLO-DESPLIEGUE.md) y [operación Monte Carlo](../infra/P04-OPERACION.md). Retirar la aplicación conserva el Budget y el bucket de estado; no elimina cargos ya incurridos.
