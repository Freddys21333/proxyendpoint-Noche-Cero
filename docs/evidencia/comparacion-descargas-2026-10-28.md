# Comparación y acceso a descargas

## Prioridades del documento Mejoras SpookyThon 2026

1. Aplicado en este incremento: conclusión del motor con confianza explícita, cuatro indicadores por estrategia y barras con una escala común; evolución acumulada por defecto, aclaración de unidades y estadísticas completas plegadas.
2. Aplicado en este incremento: acceso visible a PDF, HTML, impresión, JSON y ZIP/CSV en comparación; PDF/HTML también aparecen en Exportar. Se reutilizan los exportadores existentes.
3. Ya implementado anteriormente: parámetros comprensibles, explicación de estrategias, selección de origen en el mapa, reproducción, zoom con rueda, tamaño de puntos y contraste del mapa. La cobertura geográfica sigue limitada a polígonos residenciales verificados.
4. Próxima prioridad: comprobar todos los archivos descargados y el recorrido completo, corregir el entorno PDF y evaluar la comprensión con personas ajenas al proyecto.
5. Separado del frontend: AWS, presupuesto, observabilidad y aceptación científica deben seguir su propio alcance y autorización. El documento contiene propuestas, no evidencia de que esas entregas estén realizadas.

## Comprobaciones y límites

Suite frontend: 152 pruebas aprobadas. Compilación y typecheck finales aprobados. En navegador se generó una comparación real de 50 personas, 10 días y dos repeticiones. Se observaron la conclusión descriptiva sin afirmar certeza, el gráfico acumulado, los accesos a formatos y los cuatro indicadores con datos del motor.

La API local anterior devolvió «Ruta no encontrada» al pedir el PDF y omitía decisionSummary. Se reinició con el código actual. El entorno backend/.venv carece de reportlab; el runtime general incluye reportlab pero carece de jsonschema. Se restableció el servicio con backend/.venv. La generación PDF y la apertura de HTML/JSON/ZIP quedan pendientes de prueba integral; no se declaran descargas verificadas.

La vista conserva compatibilidad con respuestas sin decisionSummary: presenta summaryByPolicy y pairedComparisons, sin recalcular ganadores, agregados o incertidumbre. Solo escala la longitud visual de las barras según la población. Se mantienen los empates, resultados negativos y advertencias del modelo educativo.

El usuario pidió commit, push e integración en main antes de terminar la validación de descargas. Los cambios previos en AdaptiveStrategyEditor.tsx y CombinedInterventions.tsx quedan excluidos.

Risk: none.
