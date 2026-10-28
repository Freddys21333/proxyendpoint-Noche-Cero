# Costos y evidencia

Estado: **sin estimación mensual verificable ni gasto final del evento**. No hay despliegue público confirmado ni tarifas fechadas contrastadas con una arquitectura medida.

## Estimación mensual

El AWS Budget observado está configurado en **USD 20 al mes**; ese límite de alerta no es una proyección de consumo ni un tope que detenga el gasto.

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
