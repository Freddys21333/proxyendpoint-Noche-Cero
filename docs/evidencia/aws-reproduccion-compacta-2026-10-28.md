# AWS: reproducción compacta — 28/10/2026

Aplicación actualizada a main `099b53c808084823998f67d800eca514456f00d3`.
URL https://staging.d2uefmypgx02e9.amplifyapp.com/.
Amplify deployment3 SUCCEED. Plan: cero altas, diez actualizaciones, cero bajas.
No había trabajo activo al iniciar; no se crearon trabajos Monte Carlo.

Prueba Edge con API real: deslizador ancho completo y grupo compacto, fila inferior
centrada, control y descripción de movimiento ausentes, conclusión sin gastos AWS.
Sin pageerrors; 320/390/768 sin desbordamiento después de estabilizar resize.
Captura `.tools/aws-compact-playback.png`, pasos `.tools/aws-compact-browser.log`.

Smoke API pasó: preview/compare/PDF y rechazo de cargas excesivas. PDF pequeño,
predeterminado e importado grande: dos páginas y sin texto gastos/factura AWS.
Artefactos `.tools/aws-compact-*` y último `.tools/aws-smoke-*`.
No cambia motor, hashes científicos, límites de jobs ni cuota diaria.
