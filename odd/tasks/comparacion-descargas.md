# Comparación comprensible y descargas
Rama: front. Entrega: single-pr sin crear PR; commits y push autorizados por el usuario. Runner: npm test y npm run build en frontend.
Alcance: presentación de resultados y acceso a exportaciones existentes; sin cambios del motor. Estimación: 250 líneas. Espejo Engram pendiente: herramienta no disponible.

## Specs
S1. «De este documento, necesito apliques las correcciones que se necesiten, hay cosas que ya estan corregidas, pero necesito que me indiques cuales se podrian aplicar primero.» Contrastar el informe con la implementación y documentar prioridades; las propuestas de AWS o cambios científicos del documento no autorizan despliegues ni alterar el motor.
S2. «En la parte de comparacion, necesitamos que sea mas intuittivo los resultados que se muestran.» Presentar primero conclusión y confianza del backend, cuatro indicadores con unidades y contexto, evolución acumulada y detalle estadístico accesible. Conservar empates, resultados desfavorables y límites.
S3. «Hay que habilitar el descarga pdf, html, etc.» Reunir PDF, HTML, impresión, JSON y ZIP/CSV en accesos visibles; reutilizar exportadores y comprobar archivos reales.

## Tasks
T1 | S1 | inline: lectura del documento y mapa de código delegado por presupuesto de evidencia | completado | evidencia en docs/evidencia/comparacion-descargas-2026-10-28.md
T2 | S2 | inline: presentación sobre contratos existentes | implementado y compilado; aceptación móvil pendiente | commit de este incremento
T3 | S3 | inline: accesos a exportadores existentes y prueba de descargas | accesos implementados; verificación integral pendiente por entorno PDF | commit de este incremento

## Log
L1. Petición original: «De este documento, necesito apliques las correcciones que se necesiten, hay cosas que ya estan corregidas, pero necesito que me indiques cuales se podrian aplicar primero. En la parte de comparacion, necesitamos que sea mas intuittivo los resultados que se muestran. Hay que habilitar el descarga pdf, html, etc.» Fuente: Mejoras_SpookyThon_2026.docx.
L2. Auditoría: existen recommendation, decisionSummary, PDF/HTML y ZIP/JSON; PDF/HTML están al pie y ausentes del modal Exportar. Se prioriza su descubribilidad y la jerarquía de comparación. Se preservan los cambios locales en AdaptiveStrategyEditor.tsx y CombinedInterventions.tsx.
L3. La presentación no requiere un test RED artificial: no cambia cálculos ni contratos. Se comprobarán resultados y descargas en navegador real, más la suite existente. Risk: none.
L4. Nueva instrucción: «realiza el commit, push y al main». Se entrega el incremento actual con 152 pruebas y compilación aprobadas, sin afirmar que el PDF esté resuelto. API local reiniciada; reportlab falta en backend/.venv. Espejo Engram pendiente por herramienta no disponible.
