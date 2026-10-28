# Informe ejecutivo v2 para alcaldía

Solicitud: informe más gráfico, breve y con lenguaje sencillo. Trabajo en main;
sin despliegue AWS ni cambios en el motor, semillas, parámetros o hashes científicos.

## Cambios

- PDF fijo de dos páginas, antes cuatro en los casos de prueba: conclusión,
  barras de contagios con escala común, impacto y dosis; recursos, resultados
  mejores/iguales/peores e incertidumbre en la segunda página.
- Gráficos vectoriales, etiquetas y cifras además del color. P05-P95 se distingue
  de intervalo de confianza; se conservan pérdidas, empates y ausencia de respaldo.
- Se retiran anexos extensos del PDF ejecutivo. Configuración, versiones y datos
  completos siguen disponibles en el JSON; identificador completo en ambas páginas.
- HTML e impresión con la misma estructura breve, barras y tablas accesibles.
  El HTML presenta gasto/saldo del decisionSummary del backend: no agrega gastos
  desde réplicas ni inventa importes si falta el resumen.
- Se conserva determinismo del PDF, validación de integridad y rechazo de documentos
  parciales/manipulados. Plantilla `mayor-report-v2`; sin cambio de esquema del motor.

## Evidencia ejecutada

Primero se observaron dos pruebas rojas: el informe anterior tenía cuatro páginas.
Después: **520 pruebas backend**, **153 frontend**, mypy/Ruff/formato y build correctos.
Las 15 pruebas del informe se repitieron al cerrar tipos y plantilla.

Ejemplo real local: N120/T21/R30, raíz 20261026, vacunas30, presupuesto educativo
USD100 y variante adaptativa. Resultado:
`sha256:0b0cbc059760c94c3e3df01a3e2677ef63e0ac1fffb7e0b577c6cce4991072c5`.
No es una prueba de predicción real ni una ejecución de T-22.

Archivos locales ignorados:

- `.tools/report-review/adaptive.json`: fuente completa del ejemplo.
- `.tools/output/pdf/informe-alcaldia.pdf`: muestra final de dos páginas.
- `.tools/report-review/html-printed.pdf`: impresión real del HTML, dos páginas.
- PNGs de todas las páginas, casos sin presupuesto y con variante adaptativa.

Se renderizaron con Poppler y se inspeccionaron visualmente las páginas finales:
sin recortes, superposiciones o pérdida de etiquetas. Edge imprimió el HTML en
dos A4 y no presentó desbordamiento en 390 px. También se revisaron los gráficos
y cifras de un caso sin costos monetarios.

La ruta local POST `/v1/reports/mayor`, con petición gzip, devolvió HTTP200 y
`application/pdf` de dos páginas, idéntico al CLI. SHA-256 del PDF:
`71ba176c6ca02432d7a2fdf0f2fc07fafac9e21037c85e3d1f60c0235751d8ab`.
Se retiraron dos procesos API antiguos que compartían el puerto 8000; quedó el
proceso con la plantilla nueva. La integridad no se relajó para aceptar documentos
de otro entorno; los ejemplos se ejecutaron con las dependencias locales fijadas.

## Límites

La impresión de terceros puede variar por navegador. La aceptación humana del
alcalde sigue pendiente. Se conserva `fitted-not-validated` para la referencia
separada de dengue y se aclara que este reporte no acredita T-22 ni riesgo real.
El sitio AWS no se actualizó: necesita un despliegue posterior autorizado.
