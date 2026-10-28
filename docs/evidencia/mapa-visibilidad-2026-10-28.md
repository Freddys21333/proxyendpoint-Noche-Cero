# Visibilidad y navegación del mapa

## Cambios

- Radios entre 2,5 y 7 px según zoom; infecciosos mantienen un tamaño mayor. La rueda permite acercar y alejar. Sin animación de zoom para evitar la reducción transitoria del canvas.
- Mapa base gris, con brillo reducido; el filtro se aplica solo a las teselas, no a personas, fichas ni controles.
- El filtro de contactos conserva visibles las personas sin contactos activos (relleno 0,65 en lugar de 0,12). Antes podían parecer desaparecer al cambiar de día. Se reutiliza el cálculo de contactos de la red y se conserva el color SEIR.
- Distribución determinista con peso por raíz del área: reduce el predominio del polígono grande del oeste. Mantiene hogares, IDs y pertenencia a polígonos residenciales verificados. No modifica el modelo epidemiológico.
- Se incluye la conexión pendiente del filtro del mapa y el ajuste de cámara al centrar. Los textos de los editores de intervenciones quedan fuera de este commit.

## Verificación

Se observaron fallos antes del ajuste para rueda, tamaño mínimo, opacidad y reparto entre sectores; después aprobaron las 15 pruebas de mapa y geografía. La suite frontend aprobó sus 152 pruebas y la compilación terminó correctamente. Tras desactivar la animación de zoom, se repitieron y aprobaron las cinco pruebas de cámara.

Prueba visual con API local aislada: 100 personas, 10 días, dos repeticiones reales. Reproducción de Sin intervención del día 0 al 10 sin desaparición observada en Todos los tipos. El zoom mediante rueda cambió la escala del mapa y conservó los puntos. No se demostró un fallo adicional de Canvas sin filtro. Las pruebas de capas conservan marcadores y coordenadas con 50, 1000 y 2000 personas.

## Límite de cobertura

El recurso actual contiene 22 polígonos residenciales de OSM entre aproximadamente -80,755 y -80,667 de longitud, y -0,998 y -0,952 de latitud. La distribución mejora entre esas áreas; no representa todos los barrios de Manta. Extenderla fuera de ellas requiere incorporar nuevos polígonos residenciales verificados, sin ubicar personas sobre el mar o terreno no validado.

Risk: none.
