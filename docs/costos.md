# Costos y evidencia

Estado: **estimación de planificación con supuestos explícitos; no es cotización ni gasto observado**. No hay despliegue público confirmado ni benchmark Lambda/Distributed Map.

## Estimación mensual

El AWS Budget observado está configurado en **USD 20 al mes**; ese límite de alerta no es una proyección de consumo ni un tope que detenga el gasto.

### Escenario ilustrativo mensual

Supuestos de planificación (sin Free Tier ni créditos): 1.000 visitas × 1,5 MB servidos; 10 builds Amplify × 3 min; artefactos activos 0,1 GB; 10.000 solicitudes de API; 10.000 invocaciones API Lambda de 128 MB/250 ms; 0,5 GB de logs base y tres unidades de alarma. Para PRO se agregan 10 trabajos × 1.000 réplicas, Lambda de 2 GB y 2–10 s por réplica, 10.005 transiciones Standard/Distributed Map (una transición por réplica + cinco estados padre) y 0,5 GB de logs adicionales.

Tarifas publicadas consultadas el 2026-10-28: Amplify build $0,01/min, almacenamiento $0,023/GB-mes y salida $0,15/GB; API Gateway HTTP $1 por millón en el primer tramo; Lambda x86 $0,20/millón de requests y $0,0000166667/GB-s; CloudWatch logs $0,50/GB y alarma estándar $0,10 por métrica; Step Functions Standard $0,000025 por transición en el ejemplo publicado para us-east-1. En el cálculo se deja Step Functions como tarifa provisional porque la fuente consultada no muestra el valor de us-east-2. Fuentes: [Amplify](https://aws.amazon.com/amplify/pricing/), [API Gateway](https://aws.amazon.com/api-gateway/pricing/), [Lambda](https://aws.amazon.com/lambda/pricing/), [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/) y [Step Functions](https://aws.amazon.com/step-functions/pricing/).

| Servicio | Cálculo visible | Mensual estimado |
|---|---|---:|
| Amplify | 30 min × $0,01 + 1,5 GB × $0,15 + 0,1 GB × $0,023 | $0,53 |
| API Gateway HTTP | 10.000 × $1 / 1.000.000 | $0,01 |
| Lambda API | 10.000 × $0,20 / 1.000.000 + (10.000 × 0,25 s × 0,128 GB × $0,0000166667) | $0,01 |
| CloudWatch base | 0,5 GB × $0,50 + 3 × $0,10 | $0,55 |
| **Subtotal base (sin trabajos PRO)** | Suma de las filas anteriores | **$1,10** |
| Lambda PRO bajo | 10.000 × 2 s × 2 GB × $0,0000166667 + 10.000 × $0,20 / 1.000.000 | $0,67 |
| Lambda PRO alto | 10.000 × 10 s × 2 GB × $0,0000166667 + 10.000 × $0,20 / 1.000.000 | $3,34 |
| Step Functions PRO | 10.005 × $0,000025 (tarifa de ejemplo us-east-1, provisional para Ohio) | $0,25 |
| CloudWatch PRO | 0,5 GB × $0,50 | $0,25 |
| **Total ilustrativo con 10.000 réplicas/mes** | Base + componentes PRO cuantificados | **$2,26–$4,93 + S3** |

La salida de simulación se estima en ~2,8 GB para guardar 10.000 resultados usando como proxy 8,3 MB por 30 réplicas del JSON local T-22. El costo de almacenamiento/PUT/GET de S3 queda **fuera del total** hasta fijar retención/objetos y confirmar las tarifas estándar de us-east-2. También se excluyen dominio, impuestos, soporte, WAF, DynamoDB si se decide incorporarlo, transferencia sobre umbrales gratuitos y reintentos. La suma utiliza importes sin redondear, por eso puede diferir un centavo de la suma de filas redondeadas. Como no se han medido duración ni memoria de Lambda, **$2,26–$4,93 es un subtotal de planeamiento, no una factura prevista fiable**; verificar en AWS Pricing Calculator para us-east-2 antes de aprobar infraestructura.

| Servicio | Unidad de uso que debe medirse | Fórmula | Uso mensual | Tarifa us-east-2 | Subtotal |
|---|---|---|---:|---:|---:|
| API Gateway/Lambda | solicitudes y duración/recursos | solicitudes × tarifa + GB-s × tarifa | Pendiente | Pendiente | Pendiente |
| Step Functions Distributed Map | transiciones/ejecuciones | transiciones × tarifa + ejecuciones × tarifa | Pendiente | Pendiente | Pendiente |
| S3 | GB-mes, solicitudes y transferencia | almacenamiento + solicitudes + transferencia | Pendiente | Pendiente | Pendiente |
| Frontend/CDN | almacenamiento, solicitudes y transferencia | almacenamiento + solicitudes + transferencia | Pendiente | Pendiente | Pendiente |
| Logs y observabilidad | GB ingeridos/almacenados | ingestión + retención | Pendiente | Pendiente | Pendiente |
| **Total mensual estimado** | | suma de subtotales, con supuestos visibles | | | **Pendiente** |

Para completar la estimación se deben fijar usuarios activos, solicitudes por usuario, réplicas, duración/media de Lambda, concurrencia, bytes por experimento, días de retención y transferencia. Añadir la tarifa oficial consultada con fecha y región conforme al TRD §16. Presupuesto y estimación son valores diferentes.

## Gasto real

Las capturas archivadas muestran USD 0,00 de USD 20,00 mensuales para octubre de 2026, pero no son consulta actual ni gasto final del evento. **El gasto real del evento queda sin confirmar; no se declarará USD 0 por falta de una lectura verificable.** Los destinatarios aparecen como 0/2 verificados; queda pendiente comprobar su verificación.

| Métrica del evento | Estado | Evidencia que falta |
|---|---|---|
| Costos de infraestructura AWS | No medidos | Despliegue autorizado, periodo exacto, Cost Explorer/Cost and Usage Report y etiquetas de proyecto |
| Costos educativos de intervenciones | Se calculan dentro de simulaciones | JSON de experimento aceptado y desglose por estrategia |
| Gasto total real del evento | Pendiente | Evidencia de facturación del periodo del evento; no inferirlo del límite Budget |

## Evidencia provisional de AWS Budget

- [Detalle del presupuesto mensual](budget.png).
- [Umbrales de las cinco alertas](budget2.png): costo real al 25/50/75/100 % y costo previsto al 100 %.

Las capturas no muestran las direcciones de correo de los destinatarios; conservan el nombre visible del titular en la barra superior.

El envío de verificación está bloqueado por permisos de `notifications-contacts` en la experiencia simplificada de AWS. La consola solicita activar características avanzadas para modificar los permisos del rol. La recepción de notificaciones no está confirmada y el requisito de alerta operativa permanece pendiente. Una alerta de Budget no detiene automáticamente el gasto.

Falta resolver la verificación, actualizar las capturas y registrar el gasto final del evento.
