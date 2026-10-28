# Actualización AWS de informe y UX — 28/10/2026

Aplicación publicada: `36b79ccbbacaa7186960fd3611eede4d899cec2c`, main.
URL: https://staging.d2uefmypgx02e9.amplifyapp.com/

Plan revisado/aplicado: cero altas, diez funciones actualizadas, cero destrucciones.
Sin trabajo activo al iniciar. Amplify deployment 2: SUCCEED. Plan posterior sin
cambios. No se iniciaron jobs ni se consumieron admisiones Monte Carlo.

Smoke real API: health/build correcto, preview, comparación pequeña y perfil
N200/T20/R30, PDF y rechazo temprano de carga excesiva. Comparación del perfil:
2,640 s; PDF 1,932 s, una muestra (no p95). PDF small/default/large-imported:
dos páginas cada uno. Artefactos `.tools/aws-smoke-1793182990040`.

Edge desde URL pública: conclusión económica de backend, tres tarjetas pareadas,
navegación Monte Carlo, estado superior sin textos extra, ayuda naranja/oscuro,
seek hasta final y botón de movimiento con estado. Cero errores de página.
Anchos 320/390/768 sin desbordamiento una vez estabilizado el layout. La primera
lectura inmediata tras resize detectó un ancho transitorio; se repitió esperando
700 ms y pasó. No se afirma ausencia de transitorios durante resize.

Caso N120/T21/R30 con presupuesto USD2000: gasto USD940, saldo USD1060,
18,9 contagios evitados, USD49,74 por evitado; cifras del backend. Hash publicado:
`sha256:4d6f614547d5d617a771ae11612f85b74f04069c64072709001abecf8fb9037a`.
Depende del entorno del manifiesto; no se sustituyeron hashes locales por el de AWS.

Evidencia cruda: `.tools/aws-update-*`. No contiene tokens ni URLs firmadas.
Prueba de 1000 réplicas, aceptación humana y Budget operativo siguen pendientes.
