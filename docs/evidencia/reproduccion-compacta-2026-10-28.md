# Reproducción compacta y textos de costos — 28/10/2026

Solicitud: acercar deslizador/controles verticalmente, centrar fila inferior,
retirar botón/descripción de movimiento y menciones a gastos AWS.

Se corrige la precedencia CSS de network-playback que introducía un gap grande:
flex vertical explícito, gap6px, padding10/12px, slider20px y fila inferior centrada.
Se retira el toggle manual y su descripción; se conserva prefers-reduced-motion.
Textos de conclusión, tabla financiera y PDF/HTML sin referencia a gastos AWS.
Las referencias técnicas a infraestructura en Monte Carlo permanecen.

Compatibilidad: se admiten exactamente las dos redacciones históricas de conclusión
mediante normalización al validar/reproducir; no se relaja la validación de cifras.
El frontend también presenta limpiamente las conclusiones antiguas.

Verificaciones: 154 pruebas frontend y build correctos; 24 pruebas focalizadas
backend de resumen/informe y después 10 de resumen con compatibilidad explícita.
Mypy/Ruff/formato correctos. Navegador con API local real y presupuesto, cero
pageerrors, controles centrados, toggle ausente, texto sin gastos AWS, anchos
320/390/768 sin desbordamiento tras estabilizar layout (700ms). Captura revisada
`.tools/compact-playback.png`. No se invocó ni desplegó AWS.
