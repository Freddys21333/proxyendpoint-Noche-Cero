# P-08 · Informe para el alcalde

Estado: **verificado localmente**. Aceptación PRO-7 / P-08, RF-13/19. Este incremento local está autorizado expresamente; AWS queda fuera. T-22 sigue pendiente y no se modifica. [Evidencia y límites](../docs/evidencia/p08-informe-2026-10-27.md). La aceptación humana integral T-13..T-16 no se cierra por este incremento.

## Contrato y diseño

`POST /v1/reports/mayor` recibe directamente un `CompareResponse` exportado completo (hasta 32 MiB). Devuelve `application/pdf`, adjunto `informe-alcaldia.pdf`, o un error JSON saneado. No admite configuración suelta, trabajos parciales ni cifras escritas a mano. El adaptador mantiene límites propios para documentos exportados, sin ampliar los límites de preview/compare. Sin almacenamiento, credenciales, servicios externos o LLM.

Antes de generar: validar esquema, hashes y registros existentes mediante `load_export`; exigir todas las réplicas; recalcular agregados, curvas, diferencias y recomendación desde las réplicas para detectar manipulación de derivados no incluidos en el hash. No volver a ejecutar el motor ni afirmar validación científica por pasar estos controles.

Proyección `mayor-report-v1`: escenario ficticio, población, horizonte, parámetros, recursos, versiones, configuración completa, hash, comparación, incertidumbre y costos calculados en backend. Conservar medias y datos fuente sin redondear en la proyección; redondear solo su presentación. La animación representa una réplica; la conclusión usa el agregado. No inferir procedencia de parámetros a partir de coincidencias numéricas. El preset P-06 sigue `fitted-not-validated` y el informe no debe presentar dengue validado.

PDF con plantilla ReportLab y metadatos invariantes, sin fecha de reloj ni UUID nuevos. Para un mismo JSON y entorno debe producir los mismos bytes. No modifica JSON ni hashes. Incluye escenario, conclusión condicionada, tabla de impacto y recursos, diferencias pareadas, intervalos, victorias/empates/pérdidas, costos educativos o ausencia de costos configurados, límites, fuente sintética y anexo reproducible. La configuración completa queda en el anexo; el JSON sigue siendo el artefacto para reproducir.

Interfaz: botón «Descargar informe para alcaldía (PDF)» en resultados completos, disponible también cuando provienen de jobs. Estado de generación, error recuperable y prevención de descargas de resultados obsoletos. No efectuar cálculos financieros o científicos nuevos en React.

CLI: `backend/.venv/Scripts/python.exe scripts/report_mayor.py experimento.json --output informe.pdf`.

## Aceptación y pruebas previstas

- Proyección coincide con métricas/registro diario y no muta el documento; costos ausentes se informan como no configurados, nunca como precio real cero.
- Presupuesto y gasto medios correctos; costo por evitado nulo si diferencia ≤0; conservar pérdidas, empates y cero gasto.
- Rechazar JSON incompleto, hash modificado, agregados/recomendación manipulados, progreso parcial y réplicas faltantes.
- Con <30 réplicas advertir comparación descriptiva; P05–P95 no es IC; con ≥30 conservar bootstrap existente. Mostrar frecuencia de victorias/empates/pérdidas pareadas.
- PDF determinista, texto español legible, tablas sin recortes, paginación y hash completos; verificar por extracción y renderizado de todas las páginas.
- Handler real y CLI, errores 400/413/422/405; cliente maneja fallo y cancelación sin descargar datos obsoletos.
- Suites existentes, Ruff, mypy, tipos/build, evidencia y commit/push antes de declarar cierre local. T-22 y aceptación humana integral mantienen su estado independiente.
